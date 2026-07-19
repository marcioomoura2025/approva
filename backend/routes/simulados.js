const express = require('express');
const { all, get, run } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();
const DEFAULT_PASS = Number(process.env.PASS_THRESHOLD || 60);
// Meta pessoal do usuário (fallback para o padrão do sistema)
const passOf = (user) => Number(user?.pass_threshold || DEFAULT_PASS);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- Criação (Modo A: simples | Modo B: composição por matéria) ----------
router.post('/simulados', auth, async (req, res) => {
  const b = req.body || {};
  const feedback_mode = ['imediato', 'final'].includes(b.feedback_mode) ? b.feedback_mode : 'final';
  const time_mode = ['livre', 'total', 'questao'].includes(b.time_mode) ? b.time_mode : 'livre';
  const total_seconds = time_mode === 'total' ? Math.max(60, parseInt(b.total_seconds) || 0) : null;
  const seconds_per_question = time_mode === 'questao' ? Math.max(10, parseInt(b.seconds_per_question) || 0) : null;
  if (time_mode === 'total' && !total_seconds) return res.status(400).json({ error: 'Informe o tempo total da prova (mínimo 1 minuto).' });
  if (time_mode === 'questao' && !seconds_per_question) return res.status(400).json({ error: 'Informe o tempo por questão (mínimo 10 segundos).' });

  const warnings = [];
  let questionIds = [];

  const extraWhere = [];
  const extraArgs = [];
  if (b.banca) { extraWhere.push('q.banca = ?'); extraArgs.push(b.banca); }
  if (b.ano) { extraWhere.push('q.ano = ?'); extraArgs.push(b.ano); }

  if (b.mode === 'composto') {
    // Modo B — lista [{ subject_id, quantity }]
    const comp = Array.isArray(b.composition) ? b.composition.filter(c => c.subject_id && Number(c.quantity) > 0) : [];
    if (!comp.length) return res.status(400).json({ error: 'Defina ao menos uma matéria com quantidade de questões.' });
    for (const c of comp) {
      const qty = Math.min(200, Number(c.quantity));
      const where = ['t.subject_id = ?', ...extraWhere];
      const rows = await all(`
        SELECT q.id FROM questions q JOIN topics t ON t.id = q.topic_id
        WHERE ${where.join(' AND ')} ORDER BY RANDOM() LIMIT ?`,
        [c.subject_id, ...extraArgs, qty]);
      if (rows.length < qty) {
        const subj = await get('SELECT name FROM subjects WHERE id = ?', [c.subject_id]);
        warnings.push(`${subj?.name || 'Matéria'}: pedidas ${qty} questões, mas só ${rows.length} disponíveis com esses filtros.`);
      }
      questionIds.push(...rows.map(r => r.id));
    }
  } else {
    // Modo A — quantidade única + filtros opcionais
    const qty = Math.min(200, parseInt(b.quantity) || 0);
    if (!qty) return res.status(400).json({ error: 'Informe a quantidade de questões.' });
    const where = [...extraWhere];
    const args = [...extraArgs];
    if (Array.isArray(b.topic_ids) && b.topic_ids.length) {
      where.push(`q.topic_id IN (${b.topic_ids.map(() => '?').join(',')})`);
      args.push(...b.topic_ids);
    } else if (Array.isArray(b.subject_ids) && b.subject_ids.length) {
      where.push(`t.subject_id IN (${b.subject_ids.map(() => '?').join(',')})`);
      args.push(...b.subject_ids);
    }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = await all(`
      SELECT q.id FROM questions q JOIN topics t ON t.id = q.topic_id
      ${whereSql} ORDER BY RANDOM() LIMIT ?`, [...args, qty]);
    if (!rows.length) return res.status(400).json({ error: 'Nenhuma questão encontrada com esses filtros. Ajuste os critérios.' });
    if (rows.length < qty) warnings.push(`Pedidas ${qty} questões, mas só ${rows.length} disponíveis com esses filtros.`);
    questionIds = rows.map(r => r.id);
  }

  if (!questionIds.length) return res.status(400).json({ error: 'Nenhuma questão disponível para montar o simulado.' });
  questionIds = shuffle(questionIds); // ordem final embaralhada (não agrupa por matéria)

  const { lastId: simuladoId } = await run(`
    INSERT INTO simulados (user_id, title, feedback_mode, time_mode, total_seconds, seconds_per_question, total_questions)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [req.user.id, String(b.title || '').trim() || null, feedback_mode, time_mode, total_seconds, seconds_per_question, questionIds.length]);
  for (let i = 0; i < questionIds.length; i++) {
    await run('INSERT INTO simulado_questions (simulado_id, question_id, position) VALUES (?, ?, ?)', [simuladoId, questionIds[i], i + 1]);
  }
  res.status(201).json({ id: simuladoId, total_questions: questionIds.length, warnings });
});

// ---------- Lista dos simulados do usuário ----------
router.get('/simulados', auth, async (req, res) => {
  const rows = await all(`
    SELECT s.*, (SELECT COUNT(*) FROM answers a WHERE a.simulado_id = s.id) AS answered_count
    FROM simulados s WHERE s.user_id = ? ORDER BY s.id DESC LIMIT 50`, [req.user.id]);
  res.json(rows.map(r => ({ ...r, answered_count: Number(r.answered_count) })));
});

async function loadSimulado(id, userId) {
  return get('SELECT * FROM simulados WHERE id = ? AND user_id = ?', [id, userId]);
}

async function finishSimulado(sim) {
  const stats = await get(`
    SELECT COUNT(*) AS answered, COALESCE(SUM(is_correct), 0) AS correct, COALESCE(SUM(time_spent), 0) AS time_sum
    FROM answers WHERE simulado_id = ?`, [sim.id]);
  const correct = Number(stats.correct);
  const score = sim.total_questions ? Math.round((correct / sim.total_questions) * 1000) / 10 : 0;
  const createdMs = Date.parse(sim.created_at + 'Z');
  const elapsed = Number.isFinite(createdMs) ? Math.max(0, Math.round((Date.now() - createdMs) / 1000)) : Number(stats.time_sum);
  await run(`UPDATE simulados SET status = 'finalizado', correct_count = ?, score = ?, elapsed_seconds = COALESCE(elapsed_seconds, ?), finished_at = datetime('now') WHERE id = ?`,
    [correct, score, elapsed, sim.id]);
  return get('SELECT * FROM simulados WHERE id = ?', [sim.id]);
}

// Encerramento automático quando o tempo total esgota.
async function autoFinishIfExpired(sim) {
  if (sim.status !== 'em_andamento' || sim.time_mode !== 'total') return sim;
  const createdMs = Date.parse(sim.created_at + 'Z');
  if (Number.isFinite(createdMs) && (Date.now() - createdMs) / 1000 >= sim.total_seconds) {
    return finishSimulado(sim);
  }
  return sim;
}

// ---------- Obter simulado com estado + regra de segurança do gabarito ----------
router.get('/simulados/:id', auth, async (req, res) => {
  let sim = await loadSimulado(req.params.id, req.user.id);
  if (!sim) return res.status(404).json({ error: 'Simulado não encontrado.' });
  sim = await autoFinishIfExpired(sim);

  const rows = await all(`
    SELECT sq.position, q.*, t.name AS topic_name, s2.name AS subject_name,
      p.title AS passage_title, p.content AS passage_content, p.image_url AS passage_image, p.source AS passage_source,
      a.selected_index, a.is_correct AS a_correct, a.guessed, a.time_spent, a.id AS answer_id,
      st.favorite, st.review, st.note
    FROM simulado_questions sq
    JOIN questions q ON q.id = sq.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s2 ON s2.id = t.subject_id
    LEFT JOIN passages p ON p.id = q.passage_id
    LEFT JOIN answers a ON a.simulado_id = sq.simulado_id AND a.question_id = q.id
    LEFT JOIN user_question_state st ON st.question_id = q.id AND st.user_id = ?
    WHERE sq.simulado_id = ? ORDER BY sq.position`, [req.user.id, sim.id]);

  const finished = sim.status === 'finalizado';
  const questions = rows.map(r => {
    const answered = r.answer_id != null;
    // Gabarito só é incluído quando revelável: respondida em modo imediato, ou simulado finalizado.
    const revealable = finished || (sim.feedback_mode === 'imediato' && answered);
    const base = {
      id: r.id, position: r.position,
      statement: r.statement, options: JSON.parse(r.options),
      difficulty: r.difficulty, banca: r.banca, ano: r.ano, orgao: r.orgao, cargo: r.cargo, nivel: r.nivel,
      image_url: r.image_url,
      subject_name: r.subject_name, topic_name: r.topic_name,
      passage: r.passage_content ? { title: r.passage_title, content: r.passage_content, image_url: r.passage_image, source: r.passage_source } : null,
      answered,
      selected_index: answered ? r.selected_index : null,
      guessed: answered ? !!r.guessed : false,
      time_spent: r.time_spent,
      favorite: !!r.favorite, review: !!r.review, note: r.note || '',
    };
    if (revealable) {
      base.correct_index = r.correct_index;
      base.is_correct = answered ? !!r.a_correct : false;
      base.comment = r.comment;
      base.video_url = r.video_url;
    }
    return base;
  });

  res.json({
    id: sim.id, title: sim.title, status: sim.status,
    feedback_mode: sim.feedback_mode, time_mode: sim.time_mode,
    total_seconds: sim.total_seconds, seconds_per_question: sim.seconds_per_question,
    total_questions: sim.total_questions, correct_count: sim.correct_count,
    score: sim.score, elapsed_seconds: sim.elapsed_seconds,
    created_at: sim.created_at, finished_at: sim.finished_at,
    pass_threshold: passOf(req.user),
    approved: sim.score != null ? sim.score >= passOf(req.user) : null,
    questions,
  });
});

// ---------- Responder uma questão (com sinalização de chute) ----------
router.post('/simulados/:id/responder', auth, async (req, res) => {
  let sim = await loadSimulado(req.params.id, req.user.id);
  if (!sim) return res.status(404).json({ error: 'Simulado não encontrado.' });
  sim = await autoFinishIfExpired(sim);
  if (sim.status !== 'em_andamento') return res.status(409).json({ error: 'Este simulado já foi finalizado.' });

  const { question_id, selected_index, timed_out, guessed, time_spent } = req.body || {};
  const inSim = await get('SELECT id FROM simulado_questions WHERE simulado_id = ? AND question_id = ?', [sim.id, question_id]);
  if (!inSim) return res.status(404).json({ error: 'Essa questão não faz parte deste simulado.' });
  const already = await get('SELECT id FROM answers WHERE simulado_id = ? AND question_id = ?', [sim.id, question_id]);
  if (already) return res.status(409).json({ error: 'Essa questão já foi respondida e não pode ser alterada.' });

  const q = await get('SELECT * FROM questions WHERE id = ?', [question_id]);
  const options = JSON.parse(q.options);

  let sel = null;
  if (!timed_out) {
    sel = Number(selected_index);
    if (!Number.isInteger(sel) || sel < 0 || sel >= options.length) {
      return res.status(400).json({ error: 'Alternativa inválida.' });
    }
  }
  // Tempo esgotado sem resposta conta como erro, sem alternativa marcada.
  const isCorrect = sel !== null && sel === q.correct_index ? 1 : 0;
  await run(`
    INSERT INTO answers (simulado_id, question_id, user_id, selected_index, is_correct, guessed, time_spent)
    VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [sim.id, question_id, req.user.id, sel, isCorrect, guessed ? 1 : 0, Math.max(0, parseInt(time_spent) || 0)]);

  if (sim.feedback_mode === 'imediato') {
    // Modo estudo: devolve o gabarito na hora.
    return res.json({
      registered: true, is_correct: !!isCorrect, correct_index: q.correct_index,
      comment: q.comment, video_url: q.video_url, guessed: !!guessed,
    });
  }
  res.json({ registered: true });
});

// Atualiza a marcação de "chute" de uma resposta já registrada
// (o candidato pode lembrar depois que respondeu na sorte).
router.post('/simulados/:id/chute', auth, async (req, res) => {
  const sim = await loadSimulado(req.params.id, req.user.id);
  if (!sim) return res.status(404).json({ error: 'Simulado não encontrado.' });
  const { question_id, guessed } = req.body || {};
  const ans = await get('SELECT id FROM answers WHERE simulado_id = ? AND question_id = ?', [sim.id, question_id]);
  if (!ans) return res.status(404).json({ error: 'Responda a questão antes de marcar o chute.' });
  await run('UPDATE answers SET guessed = ? WHERE id = ?', [guessed ? 1 : 0, ans.id]);
  res.json({ ok: true, guessed: !!guessed });
});

// ---------- Finalizar ----------
router.post('/simulados/:id/finalizar', auth, async (req, res) => {
  let sim = await loadSimulado(req.params.id, req.user.id);
  if (!sim) return res.status(404).json({ error: 'Simulado não encontrado.' });
  if (sim.status === 'finalizado') {
    return res.json({ ...sim, pass_threshold: passOf(req.user), approved: sim.score >= passOf(req.user) });
  }
  const elapsed = parseInt(req.body?.elapsed_seconds);
  if (Number.isFinite(elapsed) && elapsed >= 0) {
    await run('UPDATE simulados SET elapsed_seconds = ? WHERE id = ?', [elapsed, sim.id]);
    sim.elapsed_seconds = elapsed;
  }
  const finished = await finishSimulado(sim);
  res.json({ ...finished, pass_threshold: passOf(req.user), approved: finished.score >= passOf(req.user) });
});

// ---------- Versão para impressão ----------
// Retorna a prova em ordem; o gabarito (grade final) só se ?gabarito=1.
router.get('/simulados/:id/impressao', auth, async (req, res) => {
  const sim = await loadSimulado(req.params.id, req.user.id);
  if (!sim) return res.status(404).json({ error: 'Simulado não encontrado.' });
  const rows = await all(`
    SELECT sq.position, q.id, q.statement, q.options, q.correct_index, q.banca, q.ano, q.orgao, q.image_url,
      t.name AS topic_name, s2.name AS subject_name,
      p.title AS passage_title, p.content AS passage_content, p.image_url AS passage_image, p.source AS passage_source
    FROM simulado_questions sq
    JOIN questions q ON q.id = sq.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s2 ON s2.id = t.subject_id
    LEFT JOIN passages p ON p.id = q.passage_id
    WHERE sq.simulado_id = ? ORDER BY sq.position`, [sim.id]);

  const includeKey = req.query.gabarito === '1';
  res.json({
    id: sim.id, title: sim.title, total_questions: sim.total_questions, created_at: sim.created_at,
    questions: rows.map(r => ({
      position: r.position, statement: r.statement, options: JSON.parse(r.options),
      banca: r.banca, ano: r.ano, orgao: r.orgao, image_url: r.image_url,
      subject_name: r.subject_name, topic_name: r.topic_name,
      passage: r.passage_content ? { title: r.passage_title, content: r.passage_content, image_url: r.passage_image, source: r.passage_source } : null,
    })),
    gabarito: includeKey ? rows.map(r => ({ position: r.position, letra: String.fromCharCode(65 + r.correct_index) })) : null,
  });
});

module.exports = router;
