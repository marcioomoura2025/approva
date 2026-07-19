const express = require('express');
const { all, get, run } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

async function ensureState(userId, questionId) {
  const q = await get('SELECT id FROM questions WHERE id = ?', [questionId]);
  if (!q) return null;
  await run(`INSERT INTO user_question_state (user_id, question_id) VALUES (?, ?)
             ON CONFLICT(user_id, question_id) DO NOTHING`, [userId, questionId]);
  return get('SELECT * FROM user_question_state WHERE user_id = ? AND question_id = ?', [userId, questionId]);
}

// Alterna favorito / marcação de revisão.
router.post('/questoes/:id/favorito', auth, async (req, res) => {
  const st = await ensureState(req.user.id, req.params.id);
  if (!st) return res.status(404).json({ error: 'Questão não encontrada.' });
  const next = st.favorite ? 0 : 1;
  await run(`UPDATE user_question_state SET favorite = ?, updated_at = datetime('now') WHERE user_id = ? AND question_id = ?`, [next, req.user.id, req.params.id]);
  res.json({ favorite: !!next });
});

router.post('/questoes/:id/revisao', auth, async (req, res) => {
  const st = await ensureState(req.user.id, req.params.id);
  if (!st) return res.status(404).json({ error: 'Questão não encontrada.' });
  const next = st.review ? 0 : 1;
  await run(`UPDATE user_question_state SET review = ?, updated_at = datetime('now') WHERE user_id = ? AND question_id = ?`, [next, req.user.id, req.params.id]);
  res.json({ review: !!next });
});

// Anotação pessoal (uma por usuário/questão; salvar vazio remove).
router.get('/questoes/:id/anotacao', auth, async (req, res) => {
  const st = await get('SELECT note FROM user_question_state WHERE user_id = ? AND question_id = ?', [req.user.id, req.params.id]);
  res.json({ note: st?.note || '' });
});

router.put('/questoes/:id/anotacao', auth, async (req, res) => {
  const st = await ensureState(req.user.id, req.params.id);
  if (!st) return res.status(404).json({ error: 'Questão não encontrada.' });
  const note = String(req.body?.note ?? '').trim();
  await run(`UPDATE user_question_state SET note = ?, updated_at = datetime('now') WHERE user_id = ? AND question_id = ?`, [note || null, req.user.id, req.params.id]);
  res.json({ note });
});

// Ids marcados pelo usuário.
router.get('/me/marcadas', auth, async (req, res) => {
  const rows = await all('SELECT question_id, favorite, review FROM user_question_state WHERE user_id = ? AND (favorite = 1 OR review = 1)', [req.user.id]);
  res.json({
    favoritas: rows.filter(r => r.favorite).map(r => r.question_id),
    revisao: rows.filter(r => r.review).map(r => r.question_id),
  });
});

const FULL_QUESTION_SQL = `
  SELECT q.id, q.statement, q.options, q.correct_index, q.comment, q.difficulty,
    q.banca, q.ano, q.orgao, q.cargo, q.nivel, q.image_url, q.video_url,
    t.name AS topic_name, s.name AS subject_name,
    p.title AS passage_title, p.content AS passage_content, p.image_url AS passage_image, p.source AS passage_source,
    st.favorite, st.review, st.note`;

function mapFull(r, extra = {}) {
  return {
    id: r.id, statement: r.statement, options: JSON.parse(r.options),
    correct_index: r.correct_index, comment: r.comment, difficulty: r.difficulty,
    banca: r.banca, ano: r.ano, orgao: r.orgao, cargo: r.cargo, nivel: r.nivel,
    image_url: r.image_url, video_url: r.video_url,
    subject_name: r.subject_name, topic_name: r.topic_name,
    passage: r.passage_content ? { title: r.passage_title, content: r.passage_content, image_url: r.passage_image, source: r.passage_source } : null,
    favorite: !!r.favorite, review: !!r.review, note: r.note || '',
    ...extra,
  };
}

// Questões completas marcadas (tela de Revisões) — inclui gabarito e anotação.
router.get('/me/marcadas/completas', auth, async (req, res) => {
  const type = req.query.tipo === 'favoritas' ? 'favorite' : 'review';
  const rows = await all(`${FULL_QUESTION_SQL}
    FROM user_question_state st
    JOIN questions q ON q.id = st.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s ON s.id = t.subject_id
    LEFT JOIN passages p ON p.id = q.passage_id
    WHERE st.user_id = ? AND st.${type} = 1
    ORDER BY st.updated_at DESC`, [req.user.id]);
  res.json(rows.map(r => mapFull(r)));
});

// Caderno de erros & chutes: questões que o usuário errou ou marcou como chute
// (mesmo acertando, o chute indica que o conteúdo ainda precisa ser estudado).
router.get('/me/erros', auth, async (req, res) => {
  const rows = await all(`${FULL_QUESTION_SQL},
      MAX(a.answered_at) AS last_answered,
      SUM(CASE WHEN a.is_correct = 0 THEN 1 ELSE 0 END) AS wrong_count,
      SUM(a.guessed) AS guess_count
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s ON s.id = t.subject_id
    LEFT JOIN passages p ON p.id = q.passage_id
    LEFT JOIN user_question_state st ON st.question_id = q.id AND st.user_id = a.user_id
    WHERE a.user_id = ? AND (a.is_correct = 0 OR a.guessed = 1)
    GROUP BY q.id
    ORDER BY last_answered DESC LIMIT 200`, [req.user.id]);
  res.json(rows.map(r => mapFull(r, {
    wrong_count: Number(r.wrong_count),
    guess_count: Number(r.guess_count),
  })));
});

module.exports = router;
