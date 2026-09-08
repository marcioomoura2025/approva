const { db, get } = require('./db');

class PaperError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new PaperError(status, message); };
const one = async (client, sql, args = []) => (await client.execute({ sql, args })).rows[0] || null;
const sqlTime = iso => iso.replace('T', ' ').slice(0, 19);

async function transaction(fn) {
  const tx = await db.transaction('write');
  try { const result = await fn(tx); await tx.commit(); return result; }
  catch (err) { await tx.rollback().catch(() => {}); throw err; }
  finally { tx.close(); }
}

async function ownSim(client, id, userId) {
  const sim = await one(client, 'SELECT * FROM simulados WHERE id = ? AND user_id = ?', [id, userId]);
  if (!sim) fail(404, 'Simulado não encontrado.');
  return sim;
}

function limitFor(sim) {
  if (sim.time_mode === 'total') return Number(sim.total_seconds) || null;
  if (sim.time_mode === 'questao') return (Number(sim.seconds_per_question) * Number(sim.total_questions)) || null;
  return null;
}

async function createSession(client, sim) {
  await client.execute({ sql: 'INSERT INTO paper_sessions (simulado_id, time_limit_seconds) VALUES (?, ?)', args: [Number(sim.id), limitFor(sim)] });
  // Toda tentativa no papel só revela correção após a transcrição definitiva.
  await client.execute({ sql: "UPDATE simulados SET feedback_mode = 'final' WHERE id = ?", args: [Number(sim.id)] });
}

async function paperFor(id) {
  let p = await get('SELECT * FROM paper_sessions WHERE simulado_id = ?', [id]);
  if (p?.phase === 'running' && p.time_limit_seconds != null) {
    const deadline = Date.parse(p.started_at) + Number(p.time_limit_seconds) * 1000;
    if (Date.now() >= deadline) {
      await db.execute({
        sql: "UPDATE paper_sessions SET phase = 'transcribing', ended_at = ?, elapsed_seconds = ?, end_reason = 'limit', revision = revision + 1 WHERE simulado_id = ? AND phase = 'running'",
        args: [new Date(deadline).toISOString(), Number(p.time_limit_seconds), id],
      });
      p = await get('SELECT * FROM paper_sessions WHERE simulado_id = ?', [id]);
    }
  }
  return p;
}

function publicPaper(p) {
  if (!p) return null;
  return {
    phase: p.phase, started_at: p.started_at, ended_at: p.ended_at,
    elapsed_seconds: p.elapsed_seconds == null ? null : Number(p.elapsed_seconds),
    time_limit_seconds: p.time_limit_seconds == null ? null : Number(p.time_limit_seconds),
    end_reason: p.end_reason, revision: Number(p.revision),
    answers: JSON.parse(p.draft_json), server_now: new Date().toISOString(),
  };
}

async function prepare(id, userId, newAttempt = false) {
  return transaction(async tx => {
    let sim = await ownSim(tx, id, userId);
    const existing = await one(tx, 'SELECT * FROM paper_sessions WHERE simulado_id = ?', [id]);
    if (existing && !newAttempt) return { id: Number(sim.id) };
    const answered = await one(tx, 'SELECT COUNT(*) AS n FROM answers WHERE simulado_id = ?', [id]);
    if (!newAttempt && (sim.status === 'finalizado' || Number(answered.n) > 0)) {
      fail(409, 'Esta tentativa já tem respostas ou foi finalizada. Use “Nova tentativa no papel” para preservar seu histórico.');
    }
    if (newAttempt) {
      const rs = await tx.execute({
        sql: 'INSERT INTO simulados (user_id, title, feedback_mode, time_mode, total_seconds, seconds_per_question, total_questions) VALUES (?, ?, ?, ?, ?, ?, ?)',
        args: [userId, sim.title, 'final', sim.time_mode, sim.total_seconds, sim.seconds_per_question, sim.total_questions],
      });
      const newId = Number(rs.lastInsertRowid);
      await tx.execute({ sql: 'INSERT INTO simulado_questions (simulado_id, question_id, position) SELECT ?, question_id, position FROM simulado_questions WHERE simulado_id = ? ORDER BY position', args: [newId, id] });
      sim = { ...sim, id: newId };
    }
    await createSession(tx, sim);
    return { id: Number(sim.id) };
  });
}

async function changePhase(id, userId, action) {
  await transaction(async tx => {
    await ownSim(tx, id, userId);
    const p = await one(tx, 'SELECT * FROM paper_sessions WHERE simulado_id = ?', [id]);
    if (!p) fail(409, 'Prepare esta tentativa para realizar a prova no papel.');
    const now = Date.now();
    if (action === 'start') {
      // Repetir a requisição nunca reinicia o relógio.
      if (p.phase === 'ready') await tx.execute({
        sql: "UPDATE paper_sessions SET phase = 'running', started_at = ?, revision = revision + 1 WHERE simulado_id = ? AND phase = 'ready'",
        args: [new Date(now).toISOString(), id],
      });
    } else {
      if (p.phase === 'ready') fail(409, 'Inicie o cronômetro antes de encerrar a prova.');
      if (p.phase === 'running') {
        const start = Date.parse(p.started_at);
        const deadline = p.time_limit_seconds == null ? Infinity : start + Number(p.time_limit_seconds) * 1000;
        const end = Math.min(now, deadline);
        await tx.execute({
          sql: "UPDATE paper_sessions SET phase = 'transcribing', ended_at = ?, elapsed_seconds = ?, end_reason = ?, revision = revision + 1 WHERE simulado_id = ? AND phase = 'running'",
          args: [new Date(end).toISOString(), Math.max(0, Math.floor((end - start) / 1000)), now >= deadline ? 'limit' : 'manual', id],
        });
      }
    }
  });
  return publicPaper(await paperFor(id));
}

function validateAnswers(input, questions) {
  if (!Array.isArray(input) || input.length > questions.length) fail(400, 'Cartão de respostas inválido.');
  const byId = new Map(questions.map(q => [Number(q.id), q]));
  const seen = new Set();
  return input.map(a => {
    if (!a || typeof a !== 'object' || !Number.isInteger(a.question_id) || !byId.has(a.question_id) || seen.has(a.question_id)) fail(400, 'Há questões inválidas ou repetidas no cartão.');
    seen.add(a.question_id);
    if (a.selected_index !== null && (!Number.isInteger(a.selected_index) || a.selected_index < 0 || a.selected_index >= JSON.parse(byId.get(a.question_id).options).length)) fail(400, 'Selecione uma alternativa válida ou marque “Em branco”.');
    if (a.guessed !== undefined && typeof a.guessed !== 'boolean') fail(400, 'Marcação de chute inválida.');
    return { question_id: a.question_id, selected_index: a.selected_index, guessed: a.selected_index !== null && a.guessed === true };
  });
}

async function saveOrCorrect(id, userId, body, correct = false) {
  return transaction(async tx => {
    const sim = await ownSim(tx, id, userId);
    const p = await one(tx, 'SELECT * FROM paper_sessions WHERE simulado_id = ?', [id]);
    if (!p) fail(409, 'Este simulado não está no modo impresso.');
    // Repetir um envio cuja resposta se perdeu não duplica a correção.
    if (correct && p.phase === 'corrected' && sim.status === 'finalizado') return { corrected: true, id: Number(sim.id) };
    if (p.phase !== 'transcribing' || sim.status !== 'em_andamento') fail(409, 'Encerre a prova antes de preencher o cartão de respostas.');
    if (!Number.isInteger(body.revision) || body.revision !== Number(p.revision)) fail(409, 'O cartão foi alterado em outra aba. Recarregue para continuar com a versão salva.');
    const questions = (await tx.execute({ sql: 'SELECT q.id, q.options, q.correct_index FROM simulado_questions sq JOIN questions q ON q.id = sq.question_id WHERE sq.simulado_id = ? ORDER BY sq.position', args: [id] })).rows;
    const answers = validateAnswers(body.answers, questions);
    if (!correct) {
      await tx.execute({ sql: 'UPDATE paper_sessions SET draft_json = ?, revision = revision + 1 WHERE simulado_id = ?', args: [JSON.stringify(answers), id] });
      return { revision: Number(p.revision) + 1, saved_at: new Date().toISOString() };
    }
    const map = new Map(answers.map(a => [a.question_id, a]));
    const blanks = questions.filter(q => map.get(Number(q.id))?.selected_index == null).length;
    if (blanks > 0 && body.confirm_blank_count !== blanks) fail(400, `Confirme as ${blanks} questões em branco antes de corrigir.`);
    const existing = await one(tx, 'SELECT COUNT(*) AS n FROM answers WHERE simulado_id = ?', [id]);
    if (Number(existing.n)) fail(409, 'Esta tentativa já possui respostas registradas. Recarregue o resultado.');
    let hits = 0;
    const complete = questions.map(q => {
      const a = map.get(Number(q.id)) || { question_id: Number(q.id), selected_index: null, guessed: false };
      const isCorrect = a.selected_index !== null && a.selected_index === Number(q.correct_index) ? 1 : 0;
      hits += isCorrect;
      return { ...a, isCorrect };
    });
    // Sem tempo inventado por questão. O tempo total está na sessão impressa.
    await tx.batch(complete.map(a => ({
      sql: 'INSERT INTO answers (simulado_id, question_id, user_id, selected_index, is_correct, guessed, time_spent, answered_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
      args: [id, a.question_id, userId, a.selected_index, a.isCorrect, a.guessed ? 1 : 0, sqlTime(p.ended_at)],
    })));
    const score = questions.length ? Math.round(hits / questions.length * 1000) / 10 : 0;
    await tx.execute({ sql: "UPDATE simulados SET status = 'finalizado', correct_count = ?, score = ?, elapsed_seconds = ?, finished_at = ? WHERE id = ?", args: [hits, score, Number(p.elapsed_seconds), sqlTime(p.ended_at), id] });
    await tx.execute({ sql: "UPDATE paper_sessions SET phase = 'corrected', draft_json = ?, revision = revision + 1 WHERE simulado_id = ?", args: [JSON.stringify(complete.map(({ isCorrect, ...a }) => a)), id] });
    return { corrected: true, id: Number(sim.id) };
  });
}

module.exports = { PaperError, createSession, paperFor, publicPaper, prepare, changePhase, saveOrCorrect };
