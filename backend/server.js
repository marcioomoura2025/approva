require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');
const { init } = require('./db');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Rotas da API
app.use('/api', require('./routes/auth'));
app.use('/api', require('./routes/catalog'));
app.use('/api', require('./routes/questions'));
app.use('/api', require('./routes/importacao'));
app.use('/api', require('./routes/simulados'));
app.use('/api', require('./routes/interacoes'));
app.use('/api', require('./routes/stats'));

// Em produção, o mesmo servidor entrega o build estático do frontend.
const distDir = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distDir));
app.get(/^\/(?!api).*/, (_req, res, next) => {
  res.sendFile(path.join(distDir, 'index.html'), err => (err ? next() : null));
});

// Tratamento central de erros (mensagens claras em português).
app.use((err, _req, res, _next) => {
  if (err?.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'Arquivo muito grande (limite de 5 MB).' });
  }
  console.error(err);
  res.status(500).json({ error: 'Erro interno do servidor. Tente novamente.' });
});

const PORT = process.env.PORT || 4000;

// Em hospedagens sem acesso a terminal (ex.: plano gratuito do Render), o banco
// é populado automaticamente na primeira subida. Se já houver qualquer usuário,
// nada é feito — logo, reinícios e novos deploys nunca duplicam dados.
// Para desativar, defina AUTO_SEED=false nas variáveis de ambiente.
async function autoSeed() {
  if (String(process.env.AUTO_SEED).toLowerCase() === 'false') return;
  const { get } = require('./db');
  const row = await get('SELECT COUNT(*) AS n FROM users');
  if (row?.n > 0) return;
  console.log('Banco vazio detectado — criando dados iniciais…');
  const { seed } = require('./seed-data');
  await seed();
}

// Garante que o e-mail definido em ADMIN_EMAIL seja administrador, mesmo que a
// conta já tivesse sido criada antes da variável existir. Roda a cada subida e
// não altera nada se o usuário já for admin (ou se a variável não estiver definida).
async function ensureAdmin() {
  const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
  if (!email) return;
  const { get, run } = require('./db');
  const user = await get('SELECT id, role FROM users WHERE email = ?', [email]);
  if (!user) {
    console.log(`ADMIN_EMAIL definido (${email}), mas ainda não há conta com esse e-mail. Cadastre-se e ela virá como administradora.`);
    return;
  }
  if (user.role === 'admin') return;
  await run("UPDATE users SET role = 'admin' WHERE id = ?", [user.id]);
  console.log(`✓ Conta ${email} promovida a administradora.`);
}

init().then(async () => {
  try {
    await autoSeed();
    await ensureAdmin();
  } catch (err) {
    // Uma falha aqui não deve impedir o app de subir.
    console.error('Aviso: não foi possível preparar os dados iniciais:', err.message);
  }
  app.listen(PORT, () => console.log(`✓ Approva API rodando em http://localhost:${PORT}`));
}).catch(err => {
  console.error('Falha ao inicializar o banco:', err);
  process.exit(1);
});
