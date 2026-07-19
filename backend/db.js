// Camada de dados — SQLite local via @libsql/client.
// Em produção, use Turso definindo TURSO_DATABASE_URL e TURSO_AUTH_TOKEN
// (os nomes DATABASE_URL / DATABASE_AUTH_TOKEN também são aceitos).
require('dotenv').config();
const { createClient } = require('@libsql/client');

const remoteUrl = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL || null;
const remoteToken = process.env.TURSO_AUTH_TOKEN || process.env.DATABASE_AUTH_TOKEN || undefined;

if (remoteUrl) {
  console.log(`✓ Banco remoto (Turso) configurado: ${String(remoteUrl).replace(/\/\/.*@/, '//')}`);
} else if (process.env.RENDER || process.env.NODE_ENV === 'production') {
  // Sem banco remoto em produção os dados somem a cada deploy/reinício.
  console.warn('⚠ ATENÇÃO: nenhum banco remoto configurado. Os dados serão gravados em arquivo local e SERÃO PERDIDOS no próximo deploy. Defina TURSO_DATABASE_URL e TURSO_AUTH_TOKEN.');
}

const db = createClient({
  url: remoteUrl || 'file:approva.db',
  authToken: remoteToken,
});

// Helpers: sempre retornam tipos simples de JS.
async function all(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return rs.rows;
}
async function get(sql, args = []) {
  const rows = await all(sql, args);
  return rows[0] || null;
}
async function run(sql, args = []) {
  const rs = await db.execute({ sql, args });
  return { lastId: rs.lastInsertRowid != null ? Number(rs.lastInsertRowid) : null, changes: rs.rowsAffected };
}

async function init() {
  const stmts = [
    `CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE
    )`,
    `CREATE TABLE IF NOT EXISTS topics (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id INTEGER NOT NULL REFERENCES subjects(id),
      name TEXT NOT NULL,
      UNIQUE(subject_id, name)
    )`,
    `CREATE TABLE IF NOT EXISTS passages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT,
      content TEXT NOT NULL,
      image_url TEXT,
      source TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      topic_id INTEGER NOT NULL REFERENCES topics(id),
      passage_id INTEGER REFERENCES passages(id),
      statement TEXT NOT NULL,
      options TEXT NOT NULL,           -- JSON: ["...", "..."] (2 a 6)
      correct_index INTEGER NOT NULL,  -- índice da alternativa correta (0-based)
      comment TEXT,
      difficulty TEXT NOT NULL DEFAULT 'media', -- facil | media | dificil
      banca TEXT, ano INTEGER, orgao TEXT, cargo TEXT, nivel TEXT,
      image_url TEXT, video_url TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`,
    `CREATE TABLE IF NOT EXISTS simulados (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id),
      title TEXT,
      feedback_mode TEXT NOT NULL DEFAULT 'final',   -- imediato | final
      time_mode TEXT NOT NULL DEFAULT 'livre',       -- livre | total | questao
      total_seconds INTEGER,          -- modo "total"
      seconds_per_question INTEGER,   -- modo "questao"
      status TEXT NOT NULL DEFAULT 'em_andamento',   -- em_andamento | finalizado
      total_questions INTEGER NOT NULL DEFAULT 0,
      correct_count INTEGER,
      score REAL,                     -- percentual 0-100
      elapsed_seconds INTEGER,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      finished_at TEXT
    )`,
    `CREATE TABLE IF NOT EXISTS simulado_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulado_id INTEGER NOT NULL REFERENCES simulados(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      position INTEGER NOT NULL,
      UNIQUE(simulado_id, question_id)
    )`,
    `CREATE TABLE IF NOT EXISTS answers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      simulado_id INTEGER NOT NULL REFERENCES simulados(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      user_id INTEGER NOT NULL REFERENCES users(id),
      selected_index INTEGER,          -- NULL = tempo esgotado sem resposta
      is_correct INTEGER NOT NULL DEFAULT 0,
      guessed INTEGER NOT NULL DEFAULT 0, -- 1 = usuário marcou que "chutou"
      time_spent INTEGER,              -- segundos gastos na questão
      answered_at TEXT NOT NULL DEFAULT (datetime('now')),
      UNIQUE(simulado_id, question_id)
    )`,
    `CREATE TABLE IF NOT EXISTS user_question_state (
      user_id INTEGER NOT NULL REFERENCES users(id),
      question_id INTEGER NOT NULL REFERENCES questions(id),
      favorite INTEGER NOT NULL DEFAULT 0,
      review INTEGER NOT NULL DEFAULT 0,
      note TEXT,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      PRIMARY KEY (user_id, question_id)
    )`,
    `CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic_id)`,
    `CREATE INDEX IF NOT EXISTS idx_answers_user ON answers(user_id)`,
    `CREATE INDEX IF NOT EXISTS idx_sq_simulado ON simulado_questions(simulado_id)`,
  ];
  for (const sql of stmts) await db.execute(sql);
  // Migração: meta de aprovação definida pelo usuário (coluna nova em bases antigas)
  try { await db.execute('ALTER TABLE users ADD COLUMN pass_threshold INTEGER'); } catch { /* já existe */ }

}

module.exports = { db, all, get, run, init };
