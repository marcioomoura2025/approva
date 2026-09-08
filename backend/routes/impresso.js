const express = require('express');
const { get, all } = require('../db');
const { auth } = require('../middleware/auth');
const { PaperError, paperFor, publicPaper, prepare, changePhase, saveOrCorrect } = require('../paper');
const router = express.Router();
const route = fn => async (req, res, next) => {
  try { await fn(req, res); }
  catch (e) { if (e instanceof PaperError) res.status(e.status).json({ error: e.message }); else next(e); }
};

router.post('/simulados/:id/impresso/preparar', auth, route(async (req, res) => {
  res.json(await prepare(Number(req.params.id), req.user.id, req.body?.new_attempt === true));
}));

router.get('/simulados/:id/impresso', auth, route(async (req, res) => {
  const sim = await get('SELECT * FROM simulados WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!sim) return res.status(404).json({ error: 'Simulado não encontrado.' });
  const paper = await paperFor(Number(sim.id));
  if (!paper) return res.status(409).json({ error: 'Esta tentativa não está no modo impresso.' });
  const questions = await all('SELECT q.id, sq.position, q.options FROM simulado_questions sq JOIN questions q ON q.id = sq.question_id WHERE sq.simulado_id = ? ORDER BY sq.position', [sim.id]);
  // Nenhum gabarito ou comentário é entregue pelo painel de transcrição.
  res.json({ id: Number(sim.id), title: sim.title, status: sim.status, total_questions: sim.total_questions,
    paper: publicPaper(paper), questions: questions.map(q => ({ id: Number(q.id), position: Number(q.position), option_count: JSON.parse(q.options).length })) });
}));

router.post('/simulados/:id/impresso/iniciar', auth, route(async (req, res) => {
  res.json({ paper: await changePhase(Number(req.params.id), req.user.id, 'start') });
}));
router.post('/simulados/:id/impresso/encerrar', auth, route(async (req, res) => {
  res.json({ paper: await changePhase(Number(req.params.id), req.user.id, 'end') });
}));
router.put('/simulados/:id/impresso/respostas', auth, route(async (req, res) => {
  res.json(await saveOrCorrect(Number(req.params.id), req.user.id, req.body || {}));
}));
router.post('/simulados/:id/impresso/corrigir', auth, route(async (req, res) => {
  res.json(await saveOrCorrect(Number(req.params.id), req.user.id, req.body || {}, true));
}));
module.exports = router;
