const express = require('express');
const { all, get, run } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

/*
  Provas à vista — alimentam a contagem regressiva do Painel.

  A data é guardada como texto 'AAAA-MM-DD' (sem hora): uma prova no dia 12 é
  no dia 12 em qualquer fuso. Quantos dias faltam é calculado no navegador,
  usando o dia local do usuário, para não errar por uma diária de diferença.
*/

const MAX_ALVOS = 10;
const DATA_VALIDA = /^\d{4}-\d{2}-\d{2}$/;

function valida(body) {
  const name = String(body?.name ?? '').trim();
  const exam_date = String(body?.exam_date ?? '').trim();
  if (name.length < 2) return { erro: 'Dê um nome ao concurso (mínimo 2 caracteres).' };
  if (name.length > 60) return { erro: 'O nome do concurso é muito longo.' };
  if (!DATA_VALIDA.test(exam_date)) return { erro: 'Informe a data da prova.' };
  const d = new Date(`${exam_date}T12:00:00Z`);
  if (Number.isNaN(d.getTime())) return { erro: 'Data inválida.' };
  // Uma prova daqui a mais de 10 anos é quase certamente erro de digitação.
  const limite = new Date(); limite.setFullYear(limite.getFullYear() + 10);
  if (d > limite) return { erro: 'Essa data está muito distante — confira o ano.' };
  return { name, exam_date };
}

router.get('/provas-alvo', auth, async (req, res) => {
  const rows = await all(
    'SELECT id, name, exam_date, created_at FROM exam_targets WHERE user_id = ? ORDER BY exam_date',
    [req.user.id]);
  res.json({
    alvos: rows,
    // Só perguntamos "tem concurso à vista?" para quem nunca respondeu.
    perguntar: rows.length === 0 && !req.user.exam_prompt_dismissed,
  });
});

router.post('/provas-alvo', auth, async (req, res) => {
  const v = valida(req.body);
  if (v.erro) return res.status(400).json({ error: v.erro });

  const total = await get('SELECT COUNT(*) AS n FROM exam_targets WHERE user_id = ?', [req.user.id]);
  if (Number(total?.n || 0) >= MAX_ALVOS) {
    return res.status(400).json({ error: `Você já acompanha ${MAX_ALVOS} concursos.` });
  }
  const r = await run('INSERT INTO exam_targets (user_id, name, exam_date) VALUES (?, ?, ?)',
    [req.user.id, v.name, v.exam_date]);
  const novo = await get('SELECT id, name, exam_date, created_at FROM exam_targets WHERE id = ?', [r.lastId]);
  res.status(201).json(novo);
});

router.put('/provas-alvo/:id', auth, async (req, res) => {
  const alvo = await get('SELECT id FROM exam_targets WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]);
  if (!alvo) return res.status(404).json({ error: 'Concurso não encontrado.' });
  const v = valida(req.body);
  if (v.erro) return res.status(400).json({ error: v.erro });
  await run('UPDATE exam_targets SET name = ?, exam_date = ? WHERE id = ?', [v.name, v.exam_date, alvo.id]);
  const novo = await get('SELECT id, name, exam_date, created_at FROM exam_targets WHERE id = ?', [alvo.id]);
  res.json(novo);
});

router.delete('/provas-alvo/:id', auth, async (req, res) => {
  const alvo = await get('SELECT id FROM exam_targets WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]);
  if (!alvo) return res.status(404).json({ error: 'Concurso não encontrado.' });
  await run('DELETE FROM exam_targets WHERE id = ?', [alvo.id]);
  res.json({ ok: true });
});

// "Agora não" — para a pergunta não voltar a cada visita.
router.post('/provas-alvo/dispensar', auth, async (req, res) => {
  await run('UPDATE users SET exam_prompt_dismissed = 1 WHERE id = ?', [req.user.id]);
  res.json({ ok: true });
});

module.exports = router;
