const express = require('express');
const bcrypt = require('bcryptjs');
const { get, run } = require('../db');
const { auth, sign } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_PASS = Number(process.env.PASS_THRESHOLD || 60);

function publicUser(u) {
  return {
    id: u.id, name: u.name, email: u.email, role: u.role,
    pass_threshold: Number(u.pass_threshold || DEFAULT_PASS),
  };
}

router.post('/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Informe nome, e-mail e senha.' });
  if (String(password).length < 6) return res.status(400).json({ error: 'A senha deve ter pelo menos 6 caracteres.' });
  const normEmail = String(email).trim().toLowerCase();
  const exists = await get('SELECT id FROM users WHERE email = ?', [normEmail]);
  if (exists) return res.status(409).json({ error: 'Já existe uma conta com esse e-mail.' });

  // Primeiro usuário do sistema, ou e-mail definido em ADMIN_EMAIL, vira admin.
  const count = await get('SELECT COUNT(*) AS n FROM users');
  const isFirst = Number(count.n) === 0;
  const isAdminEmail = process.env.ADMIN_EMAIL && normEmail === String(process.env.ADMIN_EMAIL).trim().toLowerCase();
  const role = isFirst || isAdminEmail ? 'admin' : 'user';

  const hash = await bcrypt.hash(String(password), 10);
  const { lastId } = await run('INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)', [String(name).trim(), normEmail, hash, role]);
  const user = await get('SELECT id, name, email, role, pass_threshold FROM users WHERE id = ?', [lastId]);
  res.status(201).json({ token: sign(user), user: publicUser(user) });
});

router.post('/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Informe e-mail e senha.' });
  const user = await get('SELECT * FROM users WHERE email = ?', [String(email).trim().toLowerCase()]);
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    return res.status(401).json({ error: 'E-mail ou senha incorretos.' });
  }
  res.json({ token: sign(user), user: publicUser(user) });
});

router.get('/me', auth, (req, res) => res.json({ user: publicUser(req.user) }));

// Meta de desempenho pessoal (percentual mínimo para "Aprovado")
router.put('/me/meta', auth, async (req, res) => {
  const v = Number(req.body?.pass_threshold);
  if (!Number.isInteger(v) || v < 1 || v > 100) {
    return res.status(400).json({ error: 'A meta deve ser um número inteiro entre 1 e 100.' });
  }
  await run('UPDATE users SET pass_threshold = ? WHERE id = ?', [v, req.user.id]);
  res.json({ pass_threshold: v });
});

module.exports = router;
