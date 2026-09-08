const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const express = require('express');
const temp = mkdtempSync(path.join(tmpdir(), 'approva-paper-tests-'));
// Always use a disposable database. Never read a production URL or credential.
process.env.TURSO_DATABASE_URL = `file:${path.join(temp, 'test.db')}`;
process.env.TURSO_AUTH_TOKEN = '';
process.env.DATABASE_URL = '';
process.env.DATABASE_AUTH_TOKEN = '';
process.env.JWT_SECRET = 'isolated-paper-tests-only';
const { db, init, run, get, all } = require('../db');
const { sign } = require('../middleware/auth');
let server, base, sequence = 0;
const correctById = new Map();

before(async () => {
  await init(); await init(); // Existing installations may start repeatedly.
  const subject = await run("INSERT INTO subjects (name) VALUES ('Matéria de teste')");
  const topic = await run("INSERT INTO topics (subject_id, name) VALUES (?, 'Tópico de teste')", [subject.lastId]);
  for (let i = 0; i < 4; i++) {
    const options = Array.from({ length: i === 3 ? 6 : 5 }, (_, j) => `Alternativa ${j}`);
    const index = i === 3 ? 5 : i;
    const q = await run('INSERT INTO questions (topic_id, statement, options, correct_index, comment) VALUES (?, ?, ?, ?, ?)', [topic.lastId, `Questão ${i + 1}`, JSON.stringify(options), index, 'Comentário reservado à correção']);
    correctById.set(q.lastId, index);
  }
  const app = express(); app.use(express.json());
  for (const module of ['simulados', 'impresso', 'stats', 'auth', 'revisao', 'interacoes']) app.use('/api', require(`../routes/${module}`));
  app.use((err, _req, res, _next) => res.status(500).json({ error: 'Erro de teste controlado.' }));
  server = await new Promise(resolve => { const s = app.listen(0, '127.0.0.1', () => resolve(s)); });
  base = `http://127.0.0.1:${server.address().port}/api`;
});
after(async () => { await new Promise(resolve => server?.close(resolve)); db.close(); rmSync(temp, { recursive: true, force: true }); });

async function request(user, route, method = 'GET', body) {
  const res = await fetch(base + route, { method, headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  return { status: res.status, data: await res.json() };
}
async function make(options = {}) {
  sequence++;
  const user = { id: (await run('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)', ['Aluno de teste', `test-${sequence}@example.invalid`, 'not-a-login-password'])).lastId, role: 'user' };
  user.token = sign(user);
  const created = await request(user, '/simulados', 'POST', { quantity: 4, feedback_mode: 'imediato', delivery_mode: 'impresso', ...options });
  assert.equal(created.status, 201);
  const id = created.data.id;
  return { user, id, created, route: `/simulados/${id}`, panel: `/simulados/${id}/impresso` };
}
async function stopped(f, seconds = 125) {
  assert.equal((await request(f.user, `${f.panel}/iniciar`, 'POST')).status, 200);
  await run('UPDATE paper_sessions SET started_at = ? WHERE simulado_id = ?', [new Date(Date.now() - seconds * 1000).toISOString(), f.id]);
  const end = await request(f.user, `${f.panel}/encerrar`, 'POST');
  assert.equal(end.status, 200);
  return (await request(f.user, f.panel)).data;
}

test('Criação impressa não inicia o cronômetro e não expõe gabarito', async () => {
  const f = await make({ time_mode: 'total', total_seconds: 60 });
  await run("UPDATE simulados SET created_at = '2020-01-01 00:00:00' WHERE id = ?", [f.id]);
  const detail = await request(f.user, f.route);
  assert.equal(detail.data.status, 'em_andamento');
  assert.equal(detail.data.paper.phase, 'ready'); assert.equal(detail.data.paper.started_at, null);
  assert.equal(detail.data.feedback_mode, 'final');
  for (const q of detail.data.questions) { assert.equal(q.correct_index, undefined); assert.equal(q.comment, undefined); }
  assert.equal((await request(f.user, `${f.route}/impressao?gabarito=1`)).status, 403);
  assert.equal((await request(f.user, `${f.route}/responder`, 'POST', { question_id: detail.data.questions[0].id, selected_index: 0 })).status, 409);
  assert.equal((await request(f.user, `${f.route}/finalizar`, 'POST')).status, 409);
  assert.equal((await request(f.user, `${f.panel}/encerrar`, 'POST')).status, 409);
  assert.equal((await request(f.user, `${f.panel}/corrigir`, 'POST', { revision: 0, answers: [], confirm_blank_count: 4 })).status, 409);
  assert.equal((await request(f.user, `${f.panel}/respostas`, 'PUT', { revision: 0, answers: [] })).status, 409);
});

test('Início/fim idempotentes, retomada e tempo sem transcrição', async () => {
  const f = await make();
  const first = (await request(f.user, `${f.panel}/iniciar`, 'POST')).data.paper;
  const repeat = (await request(f.user, `${f.panel}/iniciar`, 'POST')).data.paper;
  assert.equal(first.started_at, repeat.started_at); assert.equal(first.revision, repeat.revision);
  const panel = await stopped(f, 125);
  assert.equal(panel.paper.elapsed_seconds, 125); assert.equal(panel.paper.phase, 'transcribing');
  const again = (await request(f.user, `${f.panel}/encerrar`, 'POST')).data.paper;
  assert.equal(again.ended_at, panel.paper.ended_at); assert.equal(again.elapsed_seconds, 125);
  await run("UPDATE simulados SET created_at = '2019-01-01 00:00:00' WHERE id = ?", [f.id]);
  const later = (await request(f.user, f.panel)).data.paper;
  assert.equal(later.elapsed_seconds, 125); assert.equal(later.ended_at, panel.paper.ended_at);
  assert.equal((await request(f.user, f.route)).data.status, 'em_andamento');
});

test('Rascunho persiste, valida alternativas e rejeita versões antigas', async () => {
  const f = await make(), panel = await stopped(f);
  const q = panel.questions[0];
  const payload = { revision: panel.paper.revision, answers: [{ question_id: q.id, selected_index: 0, guessed: true }] };
  const save = await request(f.user, `${f.panel}/respostas`, 'PUT', payload);
  assert.equal(save.status, 200);
  const reload = (await request(f.user, f.panel)).data;
  assert.deepEqual(reload.paper.answers, payload.answers); assert.equal(reload.paper.revision, save.data.revision);
  assert.equal(reload.questions[0].correct_index, undefined);
  assert.equal((await request(f.user, `${f.panel}/respostas`, 'PUT', payload)).status, 409);
  for (const answers of [[{ question_id: q.id, selected_index: 99 }], [{ question_id: q.id }], [{ question_id: 999999, selected_index: 0 }], [payload.answers[0], payload.answers[0]]]) {
    assert.equal((await request(f.user, `${f.panel}/respostas`, 'PUT', { revision: save.data.revision, answers })).status, 400);
  }
  assert.equal((await get('SELECT COUNT(*) AS n FROM answers WHERE simulado_id = ?', [f.id])).n, 0);
});

test('Correção única integra nota, chutes, brancos, estatísticas e gabarito', async () => {
  const f = await make(), panel = await stopped(f, 180);
  const answers = panel.questions.slice(0, 2).map((q, i) => ({ question_id: q.id, selected_index: correctById.get(q.id), guessed: i === 0 }));
  const payload = { revision: panel.paper.revision, answers };
  assert.equal((await request(f.user, `${f.panel}/corrigir`, 'POST', payload)).status, 400);
  assert.equal((await get('SELECT COUNT(*) AS n FROM answers WHERE simulado_id = ?', [f.id])).n, 0);
  payload.confirm_blank_count = 2;
  assert.equal((await request(f.user, `${f.panel}/corrigir`, 'POST', payload)).status, 200);
  assert.equal((await request(f.user, `${f.panel}/corrigir`, 'POST', payload)).status, 200);
  const result = (await request(f.user, f.route)).data;
  assert.equal(result.status, 'finalizado'); assert.equal(result.score, 50); assert.equal(result.correct_count, 2);
  assert.equal(result.elapsed_seconds, 180); assert.equal(result.paper.phase, 'corrected');
  assert.equal(result.questions.length, 4);
  for (const q of result.questions) { assert.equal(typeof q.correct_index, 'number'); assert.equal(q.time_spent, null); assert.equal(q.paper_answer, true); }
  assert.equal(result.questions.filter(q => q.selected_index === null).length, 2);
  const stats = (await request(f.user, '/stats/geral')).data;
  assert.equal(stats.total_respondidas, 4); assert.equal(stats.aproveitamento, 50); assert.equal(stats.dominio_real, 25);
  assert.equal(stats.chutes, 1); assert.equal(stats.tempo_medio_questao, null);
  const review = (await request(f.user, '/revisao-programada')).data;
  assert.equal(review.ja_estudou, true);
  assert.equal((await request(f.user, `${f.route}/impressao?gabarito=1`)).data.gabarito.length, 4);
  assert.equal((await get('SELECT COUNT(*) AS n FROM answers WHERE simulado_id = ?', [f.id])).n, 4);
});

test('Limite encerra a prova, preservando transcrição posterior e tempo correto', async () => {
  const f = await make({ time_mode: 'total', total_seconds: 60 });
  await request(f.user, `${f.panel}/iniciar`, 'POST');
  const started = new Date(Date.now() - 70000).toISOString();
  await run('UPDATE paper_sessions SET started_at = ? WHERE simulado_id = ?', [started, f.id]);
  const panel = (await request(f.user, f.panel)).data;
  assert.equal(panel.paper.phase, 'transcribing'); assert.equal(panel.paper.end_reason, 'limit');
  assert.equal(panel.paper.elapsed_seconds, 60); assert.equal(Date.parse(panel.paper.ended_at), Date.parse(started) + 60000);
  assert.equal((await request(f.user, f.route)).data.status, 'em_andamento');
  assert.equal((await request(f.user, `${f.panel}/corrigir`, 'POST', { revision: panel.paper.revision, answers: [], confirm_blank_count: 4 })).status, 200);
  assert.equal((await request(f.user, f.route)).data.elapsed_seconds, 60);
});

test('Tempo por questão no papel vira limite total', async () => {
  const f = await make({ time_mode: 'questao', seconds_per_question: 90 });
  assert.equal((await request(f.user, f.panel)).data.paper.time_limit_seconds, 360);
  assert.equal(f.created.data.warnings.length, 1);
});

test('Correção é atômica mesmo quando um INSERT falha', async () => {
  const f = await make(), panel = await stopped(f);
  const failId = panel.questions[2].id;
  await db.execute(`CREATE TRIGGER reject_paper_test BEFORE INSERT ON answers WHEN NEW.simulado_id = ${f.id} AND NEW.question_id = ${failId} BEGIN SELECT RAISE(ABORT, 'TEST_FAILURE'); END`);
  const payload = { revision: panel.paper.revision, answers: [], confirm_blank_count: 4 };
  try {
    assert.equal((await request(f.user, `${f.panel}/corrigir`, 'POST', payload)).status, 500);
    assert.equal((await get('SELECT COUNT(*) AS n FROM answers WHERE simulado_id = ?', [f.id])).n, 0);
    assert.equal((await request(f.user, f.route)).data.status, 'em_andamento');
    assert.equal((await request(f.user, f.panel)).data.paper.phase, 'transcribing');
  } finally { await db.execute('DROP TRIGGER reject_paper_test'); }
  assert.equal((await request(f.user, `${f.panel}/corrigir`, 'POST', payload)).status, 200);
});

test('Outro usuário não lê nem modifica uma prova impressa', async () => {
  const f = await make(), stranger = await make();
  for (const [route, method, body] of [[f.panel, 'GET'], [`${f.panel}/iniciar`, 'POST'], [`${f.panel}/encerrar`, 'POST'], [`${f.panel}/preparar`, 'POST', { new_attempt: true }], [`${f.panel}/respostas`, 'PUT', {}], [`${f.panel}/corrigir`, 'POST', {}], [`${f.route}/impressao`, 'GET']]) {
    assert.equal((await request(stranger.user, route, method, body)).status, 404);
  }
  assert.equal((await request(f.user, f.panel)).data.paper.phase, 'ready');
});

test('Nova tentativa no papel mantém questões, ordem e resultado anterior', async () => {
  const f = await make(), panel = await stopped(f);
  await request(f.user, `${f.panel}/corrigir`, 'POST', { revision: panel.paper.revision, answers: [], confirm_blank_count: 4 });
  const original = (await request(f.user, f.route)).data;
  const copy = await request(f.user, `${f.panel}/preparar`, 'POST', { new_attempt: true });
  assert.equal(copy.status, 200); assert.notEqual(copy.data.id, f.id);
  const cloned = (await request(f.user, `/simulados/${copy.data.id}/impresso`)).data;
  assert.equal(cloned.paper.phase, 'ready'); assert.equal(cloned.paper.started_at, null);
  assert.deepEqual(cloned.questions.map(q => q.id), panel.questions.map(q => q.id));
  assert.deepEqual((await request(f.user, f.route)).data.score, original.score);
  assert.equal((await get('SELECT COUNT(*) AS n FROM answers WHERE simulado_id = ?', [f.id])).n, 4);
});

test('Fluxo digital continua corrigindo e pode converter tentativa sem respostas', async () => {
  const f = await make({ delivery_mode: 'digital' });
  let d = (await request(f.user, f.route)).data;
  assert.equal(d.paper, null);
  const first = d.questions[0];
  const response = await request(f.user, `${f.route}/responder`, 'POST', { question_id: first.id, selected_index: correctById.get(first.id), time_spent: 30 });
  assert.equal(response.status, 200); assert.equal(response.data.is_correct, true);
  assert.equal((await request(f.user, `${f.panel}/preparar`, 'POST')).status, 409);
  assert.equal((await request(f.user, `${f.route}/finalizar`, 'POST', { elapsed_seconds: 40 })).status, 200);
  d = (await request(f.user, f.route)).data; assert.equal(d.status, 'finalizado'); assert.equal(d.correct_count, 1);
  const fresh = await make({ delivery_mode: 'digital' });
  assert.equal((await request(fresh.user, `${fresh.panel}/preparar`, 'POST')).status, 200);
  assert.equal((await request(fresh.user, fresh.panel)).data.paper.phase, 'ready');
});

test('Reset do próprio histórico limpa sessões impressas e preserva outros usuários', async () => {
  const f = await make(), other = await make();
  assert.equal((await request(f.user, '/me/dados', 'DELETE', { confirmar: 'APAGAR' })).status, 200);
  assert.equal(await get('SELECT * FROM paper_sessions WHERE simulado_id = ?', [f.id]), null);
  assert.equal((await request(other.user, other.panel)).status, 200);
});
