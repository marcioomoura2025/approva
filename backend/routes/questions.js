const express = require('express');
const { all, get, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

const DIFFICULTIES = ['facil', 'media', 'dificil'];

function parseOptions(row) {
  return { ...row, options: JSON.parse(row.options) };
}

// Lista questões com filtros combináveis.
router.get('/questoes', auth, async (req, res) => {
  const { materia, topico, banca, ano, orgao, cargo, nivel, dificuldade, busca } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

  const where = [];
  const args = [];
  if (materia) { where.push('t.subject_id = ?'); args.push(materia); }
  if (topico) { where.push('q.topic_id = ?'); args.push(topico); }
  if (banca) { where.push('q.banca = ?'); args.push(banca); }
  if (ano) { where.push('q.ano = ?'); args.push(ano); }
  if (orgao) { where.push('q.orgao = ?'); args.push(orgao); }
  if (cargo) { where.push('q.cargo = ?'); args.push(cargo); }
  if (nivel) { where.push('q.nivel = ?'); args.push(nivel); }
  if (dificuldade) { where.push('q.difficulty = ?'); args.push(dificuldade); }
  if (busca) { where.push('q.statement LIKE ?'); args.push(`%${busca}%`); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  const totalRow = await get(`SELECT COUNT(*) AS n FROM questions q JOIN topics t ON t.id = q.topic_id ${whereSql}`, args);
  const rows = await all(`
    SELECT q.*, t.name AS topic_name, s.id AS subject_id, s.name AS subject_name,
      (SELECT COUNT(*) FROM simulado_questions sq WHERE sq.question_id = q.id) AS used_count
    FROM questions q
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s ON s.id = t.subject_id
    ${whereSql}
    ORDER BY q.id DESC LIMIT ? OFFSET ?`, [...args, limit, (page - 1) * limit]);

  res.json({
    total: Number(totalRow.n), page, limit,
    questions: rows.map(r => ({ ...parseOptions(r), used_count: Number(r.used_count) })),
  });
});

// Valores distintos para popular os filtros da interface.
router.get('/questoes/filtros', auth, async (_req, res) => {
  const [bancas, anos, orgaos, cargos] = await Promise.all([
    all(`SELECT DISTINCT banca AS v FROM questions WHERE banca IS NOT NULL AND banca != '' ORDER BY v`),
    all(`SELECT DISTINCT ano AS v FROM questions WHERE ano IS NOT NULL ORDER BY v DESC`),
    all(`SELECT DISTINCT orgao AS v FROM questions WHERE orgao IS NOT NULL AND orgao != '' ORDER BY v`),
    all(`SELECT DISTINCT cargo AS v FROM questions WHERE cargo IS NOT NULL AND cargo != '' ORDER BY v`),
  ]);
  res.json({
    bancas: bancas.map(r => r.v),
    anos: anos.map(r => Number(r.v)),
    orgaos: orgaos.map(r => r.v),
    cargos: cargos.map(r => r.v),
  });
});

function validateQuestionBody(body) {
  const { topic_id, statement, options, correct_index } = body || {};
  if (!topic_id) return 'Selecione o tópico da questão.';
  if (!statement || !String(statement).trim()) return 'O enunciado é obrigatório.';
  if (!Array.isArray(options) || options.length < 2 || options.length > 6) return 'Informe de 2 a 6 alternativas.';
  if (options.some(o => !String(o ?? '').trim())) return 'Nenhuma alternativa pode ficar vazia.';
  const ci = Number(correct_index);
  if (!Number.isInteger(ci) || ci < 0 || ci >= options.length) return 'Indique qual alternativa é a correta.';
  if (body.difficulty && !DIFFICULTIES.includes(body.difficulty)) return 'Dificuldade inválida (facil, media ou dificil).';
  return null;
}

router.post('/questoes', auth, adminOnly, async (req, res) => {
  const err = validateQuestionBody(req.body);
  if (err) return res.status(400).json({ error: err });
  const b = req.body;
  const topic = await get('SELECT id FROM topics WHERE id = ?', [b.topic_id]);
  if (!topic) return res.status(404).json({ error: 'Tópico não encontrado.' });
  if (b.passage_id) {
    const p = await get('SELECT id FROM passages WHERE id = ?', [b.passage_id]);
    if (!p) return res.status(404).json({ error: 'Texto-base não encontrado.' });
  }
  const { lastId } = await run(`
    INSERT INTO questions (topic_id, passage_id, statement, options, correct_index, comment, difficulty, banca, ano, orgao, cargo, nivel, image_url, video_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [b.topic_id, b.passage_id || null, String(b.statement).trim(), JSON.stringify(b.options.map(o => String(o).trim())),
     Number(b.correct_index), b.comment || null, b.difficulty || 'media', b.banca || null, b.ano || null,
     b.orgao || null, b.cargo || null, b.nivel || null, b.image_url || null, b.video_url || null]);
  res.status(201).json(parseOptions(await get('SELECT * FROM questions WHERE id = ?', [lastId])));
});

router.get('/questoes/:id', auth, adminOnly, async (req, res) => {
  const q = await get('SELECT * FROM questions WHERE id = ?', [req.params.id]);
  if (!q) return res.status(404).json({ error: 'Questão não encontrada.' });
  res.json(parseOptions(q));
});

router.put('/questoes/:id', auth, adminOnly, async (req, res) => {
  const existing = await get('SELECT * FROM questions WHERE id = ?', [req.params.id]);
  if (!existing) return res.status(404).json({ error: 'Questão não encontrada.' });
  const err = validateQuestionBody(req.body);
  if (err) return res.status(400).json({ error: err });
  const b = req.body;
  await run(`
    UPDATE questions SET topic_id = ?, passage_id = ?, statement = ?, options = ?, correct_index = ?, comment = ?,
      difficulty = ?, banca = ?, ano = ?, orgao = ?, cargo = ?, nivel = ?, image_url = ?, video_url = ?
    WHERE id = ?`,
    [b.topic_id, b.passage_id || null, String(b.statement).trim(), JSON.stringify(b.options.map(o => String(o).trim())),
     Number(b.correct_index), b.comment || null, b.difficulty || 'media', b.banca || null, b.ano || null,
     b.orgao || null, b.cargo || null, b.nivel || null, b.image_url || null, b.video_url || null, req.params.id]);
  res.json(parseOptions(await get('SELECT * FROM questions WHERE id = ?', [req.params.id])));
});

// Questão já usada em simulado não pode ser excluída (preserva o histórico).
router.delete('/questoes/:id', auth, adminOnly, async (req, res) => {
  const q = await get('SELECT id FROM questions WHERE id = ?', [req.params.id]);
  if (!q) return res.status(404).json({ error: 'Questão não encontrada.' });
  const used = await get('SELECT COUNT(*) AS n FROM simulado_questions WHERE question_id = ?', [req.params.id]);
  if (Number(used.n) > 0) {
    return res.status(409).json({ error: 'Esta questão já foi usada em simulados e não pode ser excluída — apenas editada. Isso preserva o histórico dos candidatos.' });
  }
  await run('DELETE FROM user_question_state WHERE question_id = ?', [req.params.id]);
  await run('DELETE FROM questions WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

module.exports = router;
