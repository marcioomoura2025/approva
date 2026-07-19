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
init().then(() => {
  app.listen(PORT, () => console.log(`✓ Approva API rodando em http://localhost:${PORT}`));
}).catch(err => {
  console.error('Falha ao inicializar o banco:', err);
  process.exit(1);
});
