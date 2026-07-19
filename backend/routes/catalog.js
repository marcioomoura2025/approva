const express = require('express');
const { all, get, run } = require('../db');
const { auth, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Matérias com seus tópicos e contagem de questões por tópico.
router.get('/materias', auth, async (_req, res) => {
  const subjects = await all('SELECT * FROM subjects ORDER BY name');
  const topics = await all(`
    SELECT t.id, t.subject_id, t.name, COUNT(q.id) AS question_count
    FROM topics t LEFT JOIN questions q ON q.topic_id = t.id
    GROUP BY t.id ORDER BY t.name`);
  res.json(subjects.map(s => ({
    ...s,
    topics: topics.filter(t => t.subject_id === s.id).map(t => ({ ...t, question_count: Number(t.question_count) })),
    question_count: topics.filter(t => t.subject_id === s.id).reduce((acc, t) => acc + Number(t.question_count), 0),
  })));
});

router.post('/materias', auth, adminOnly, async (req, res) => {
  const name = String(req.body?.name || '').trim();
  if (!name) return res.status(400).json({ error: 'Informe o nome da matéria.' });
  const exists = await get('SELECT id FROM subjects WHERE name = ?', [name]);
  if (exists) return res.status(409).json({ error: 'Já existe uma matéria com esse nome.' });
  const { lastId } = await run('INSERT INTO subjects (name) VALUES (?)', [name]);
  res.status(201).json(await get('SELECT * FROM subjects WHERE id = ?', [lastId]));
});

router.post('/topicos', auth, adminOnly, async (req, res) => {
  const { subject_id } = req.body || {};
  const name = String(req.body?.name || '').trim();
  if (!subject_id || !name) return res.status(400).json({ error: 'Informe a matéria e o nome do tópico.' });
  const subject = await get('SELECT id FROM subjects WHERE id = ?', [subject_id]);
  if (!subject) return res.status(404).json({ error: 'Matéria não encontrada.' });
  const exists = await get('SELECT id FROM topics WHERE subject_id = ? AND name = ?', [subject_id, name]);
  if (exists) return res.status(409).json({ error: 'Esse tópico já existe nessa matéria.' });
  const { lastId } = await run('INSERT INTO topics (subject_id, name) VALUES (?, ?)', [subject_id, name]);
  res.status(201).json(await get('SELECT * FROM topics WHERE id = ?', [lastId]));
});

// Textos-base (passages)
router.get('/textos-base', auth, async (_req, res) => {
  const rows = await all(`
    SELECT p.*, COUNT(q.id) AS question_count
    FROM passages p LEFT JOIN questions q ON q.passage_id = p.id
    GROUP BY p.id ORDER BY p.id DESC`);
  res.json(rows.map(r => ({ ...r, question_count: Number(r.question_count) })));
});

router.post('/textos-base', auth, adminOnly, async (req, res) => {
  const { title, content, image_url, source } = req.body || {};
  if (!content || !String(content).trim()) return res.status(400).json({ error: 'O conteúdo do texto-base é obrigatório.' });
  const { lastId } = await run('INSERT INTO passages (title, content, image_url, source) VALUES (?, ?, ?, ?)',
    [title || null, String(content).trim(), image_url || null, source || null]);
  res.status(201).json(await get('SELECT * FROM passages WHERE id = ?', [lastId]));
});

router.get('/textos-base/:id', auth, async (req, res) => {
  const p = await get('SELECT * FROM passages WHERE id = ?', [req.params.id]);
  if (!p) return res.status(404).json({ error: 'Texto-base não encontrado.' });
  res.json(p);
});

module.exports = router;
