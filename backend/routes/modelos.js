const express = require('express');
const { all, get, run } = require('../db');
const { auth } = require('../middleware/auth');

const router = express.Router();

/*
  Modelos de simulado — guardam a configuração completa da montagem (matérias,
  quantidades, tempo e modo de correção) sob um nome escolhido pelo usuário.

  A configuração é exatamente o mesmo corpo que a tela de montagem envia para
  POST /api/simulados. Assim, iniciar um modelo é apenas reenviar esse corpo:
  não existe uma segunda lógica de montagem para sair de sincronia.
*/

const MAX_MODELOS = 30;

function publico(row) {
  let config = {};
  try { config = JSON.parse(row.config) || {}; } catch { config = {}; }
  return {
    id: row.id,
    name: row.name,
    config,
    times_used: Number(row.times_used || 0),
    last_used_at: row.last_used_at || null,
    created_at: row.created_at,
  };
}

// Aceita apenas as chaves conhecidas da montagem — evita guardar lixo.
const CHAVES = new Set([
  'title', 'mode', 'quantity', 'topic_ids', 'composition', 'prova_chave',
  'banca', 'ano', 'orgao', 'cargo', 'dificuldade', 'distribuicao',
  'feedback_mode', 'time_mode', 'total_seconds', 'seconds_per_question',
]);

function limparConfig(entrada) {
  if (!entrada || typeof entrada !== 'object') return null;
  const saida = {};
  for (const [k, v] of Object.entries(entrada)) {
    if (CHAVES.has(k) && v !== undefined && v !== null && v !== '') saida[k] = v;
  }
  if (!['simples', 'composto', 'prova'].includes(saida.mode)) return null;
  return saida;
}

router.get('/modelos', auth, async (req, res) => {
  const rows = await all(
    `SELECT * FROM simulado_templates WHERE user_id = ?
     ORDER BY last_used_at IS NULL, last_used_at DESC, name`, [req.user.id]);
  res.json(rows.map(publico));
});

router.post('/modelos', auth, async (req, res) => {
  const name = String(req.body?.name ?? '').trim();
  if (name.length < 2) return res.status(400).json({ error: 'Dê um nome ao modelo (mínimo 2 caracteres).' });
  if (name.length > 60) return res.status(400).json({ error: 'O nome do modelo é muito longo.' });

  const config = limparConfig(req.body?.config);
  if (!config) return res.status(400).json({ error: 'Configuração inválida para salvar como modelo.' });

  const total = await get('SELECT COUNT(*) AS n FROM simulado_templates WHERE user_id = ?', [req.user.id]);
  if (Number(total?.n || 0) >= MAX_MODELOS) {
    return res.status(400).json({ error: `Você já tem ${MAX_MODELOS} modelos. Exclua algum antes de criar outro.` });
  }
  const existe = await get(
    'SELECT id FROM simulado_templates WHERE user_id = ? AND lower(name) = lower(?)', [req.user.id, name]);
  if (existe) return res.status(409).json({ error: 'Já existe um modelo com esse nome.' });

  const r = await run('INSERT INTO simulado_templates (user_id, name, config) VALUES (?, ?, ?)',
    [req.user.id, name, JSON.stringify(config)]);
  const novo = await get('SELECT * FROM simulado_templates WHERE id = ?', [r.lastId]);
  res.status(201).json(publico(novo));
});

router.put('/modelos/:id', auth, async (req, res) => {
  const atual = await get('SELECT * FROM simulado_templates WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]);
  if (!atual) return res.status(404).json({ error: 'Modelo não encontrado.' });

  let name = atual.name;
  if (req.body?.name !== undefined) {
    name = String(req.body.name).trim();
    if (name.length < 2) return res.status(400).json({ error: 'Dê um nome ao modelo (mínimo 2 caracteres).' });
    const outro = await get(
      'SELECT id FROM simulado_templates WHERE user_id = ? AND lower(name) = lower(?) AND id != ?',
      [req.user.id, name, atual.id]);
    if (outro) return res.status(409).json({ error: 'Já existe um modelo com esse nome.' });
  }

  let config = atual.config;
  if (req.body?.config !== undefined) {
    const limpa = limparConfig(req.body.config);
    if (!limpa) return res.status(400).json({ error: 'Configuração inválida para salvar como modelo.' });
    config = JSON.stringify(limpa);
  }

  await run('UPDATE simulado_templates SET name = ?, config = ? WHERE id = ?', [name, config, atual.id]);
  const novo = await get('SELECT * FROM simulado_templates WHERE id = ?', [atual.id]);
  res.json(publico(novo));
});

router.delete('/modelos/:id', auth, async (req, res) => {
  const alvo = await get('SELECT id FROM simulado_templates WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]);
  if (!alvo) return res.status(404).json({ error: 'Modelo não encontrado.' });
  await run('DELETE FROM simulado_templates WHERE id = ?', [alvo.id]);
  res.json({ ok: true });
});

// Registra o uso (chamado logo após o simulado ser criado a partir do modelo).
router.post('/modelos/:id/usado', auth, async (req, res) => {
  const alvo = await get('SELECT id FROM simulado_templates WHERE id = ? AND user_id = ?',
    [req.params.id, req.user.id]);
  if (!alvo) return res.status(404).json({ error: 'Modelo não encontrado.' });
  await run(`UPDATE simulado_templates
             SET times_used = times_used + 1, last_used_at = datetime('now') WHERE id = ?`, [alvo.id]);
  res.json({ ok: true });
});

module.exports = router;
