const express = require('express');
const { all, get } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

// Visão geral do desempenho do usuário.
// "Domínio real" desconta acertos no chute: acertou mas chutou = ainda não domina.
router.get('/stats/geral', auth, async (req, res) => {
  const o = await get(`
    SELECT COUNT(*) AS answered,
      COALESCE(SUM(is_correct), 0) AS correct,
      COALESCE(SUM(CASE WHEN is_correct = 1 AND guessed = 0 THEN 1 ELSE 0 END), 0) AS solid_correct,
      COALESCE(SUM(guessed), 0) AS guesses,
      COALESCE(SUM(CASE WHEN guessed = 1 AND is_correct = 1 THEN 1 ELSE 0 END), 0) AS lucky,
      COALESCE(AVG(time_spent), 0) AS avg_time
    FROM answers WHERE user_id = ?`, [req.user.id]);
  const sims = await get(`SELECT COUNT(*) AS n, COALESCE(AVG(score), 0) AS avg_score FROM simulados WHERE user_id = ? AND status = 'finalizado'`, [req.user.id]);
  const answered = Number(o.answered);
  res.json({
    total_respondidas: answered,
    total_acertos: Number(o.correct),
    aproveitamento: answered ? Math.round((Number(o.correct) / answered) * 1000) / 10 : 0,
    dominio_real: answered ? Math.round((Number(o.solid_correct) / answered) * 1000) / 10 : 0,
    chutes: Number(o.guesses),
    acertos_no_chute: Number(o.lucky),
    tempo_medio_questao: Math.round(Number(o.avg_time)),
    simulados_finalizados: Number(sims.n),
    media_simulados: Math.round(Number(sims.avg_score) * 10) / 10,
  });
});

// Aproveitamento por matéria e por tópico (com chutes destacados).
async function breakdown(userId, groupBy) {
  const col = groupBy === 'materia' ? 's.id' : 't.id';
  const nameCol = groupBy === 'materia' ? 's.name' : "t.name || ' · ' || s.name";
  const rows = await all(`
    SELECT ${col} AS id, ${nameCol} AS name,
      COUNT(*) AS answered,
      SUM(a.is_correct) AS correct,
      SUM(CASE WHEN a.is_correct = 1 AND a.guessed = 0 THEN 1 ELSE 0 END) AS solid,
      SUM(a.guessed) AS guesses
    FROM answers a
    JOIN questions q ON q.id = a.question_id
    JOIN topics t ON t.id = q.topic_id
    JOIN subjects s ON s.id = t.subject_id
    WHERE a.user_id = ?
    GROUP BY ${col}
    ORDER BY name`, [userId]);
  return rows.map(r => {
    const answered = Number(r.answered);
    return {
      id: r.id, name: r.name, respondidas: answered,
      acertos: Number(r.correct),
      chutes: Number(r.guesses),
      aproveitamento: answered ? Math.round((Number(r.correct) / answered) * 1000) / 10 : 0,
      dominio_real: answered ? Math.round((Number(r.solid) / answered) * 1000) / 10 : 0,
    };
  });
}

router.get('/stats/materias', auth, async (req, res) => res.json(await breakdown(req.user.id, 'materia')));
router.get('/stats/topicos', auth, async (req, res) => res.json(await breakdown(req.user.id, 'topico')));

// Pontos de maior dificuldade: tópicos com menor domínio real (mínimo de 2 respostas).
router.get('/stats/dificuldades', auth, async (req, res) => {
  const topics = (await breakdown(req.user.id, 'topico'))
    .filter(t => t.respondidas >= 2)
    .sort((a, b) => a.dominio_real - b.dominio_real)
    .slice(0, 6);
  res.json(topics);
});

// Evolução: aproveitamento nos últimos simulados finalizados.
router.get('/stats/evolucao', auth, async (req, res) => {
  const rows = await all(`
    SELECT id, title, score, finished_at, total_questions, correct_count
    FROM simulados WHERE user_id = ? AND status = 'finalizado'
    ORDER BY finished_at DESC LIMIT 12`, [req.user.id]);
  res.json(rows.reverse());
});

// Ranking geral entre candidatos com ao menos um simulado finalizado.
router.get('/ranking', auth, async (req, res) => {
  const rows = await all(`
    SELECT u.id, u.name,
      COUNT(s.id) AS simulados,
      AVG(s.score) AS media,
      SUM(s.correct_count) AS acertos
    FROM users u
    JOIN simulados s ON s.user_id = u.id AND s.status = 'finalizado'
    GROUP BY u.id
    ORDER BY media DESC, acertos DESC`);
  res.json(rows.map((r, i) => ({
    posicao: i + 1,
    user_id: r.id,
    nome: r.name,
    simulados: Number(r.simulados),
    media: Math.round(Number(r.media) * 10) / 10,
    acertos: Number(r.acertos) || 0,
    voce: r.id === req.user.id,
  })));
});

module.exports = router;
