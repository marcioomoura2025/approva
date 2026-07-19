const jwt = require('jsonwebtoken');
const { get } = require('../db');

const JWT_SECRET = process.env.JWT_SECRET || 'approva-dev-secret-troque-em-producao';

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '30d' });
}

// Exige token válido; anexa req.user.
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Faça login para continuar.' });
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await get('SELECT id, name, email, role, pass_threshold FROM users WHERE id = ?', [payload.id]);
    if (!user) return res.status(401).json({ error: 'Sessão inválida. Faça login novamente.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Sessão expirada. Faça login novamente.' });
  }
}

// Exige papel de administrador (usar depois de auth).
function adminOnly(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Apenas administradores podem executar esta ação.' });
  }
  next();
}

module.exports = { auth, adminOnly, sign };
