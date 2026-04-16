const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Em Vercel, usar /tmp para escrita; em local, usar /data
const dataDir = process.env.VERCEL ? '/tmp' : __dirname;
const dbPath = path.join(dataDir, 'chat_history.db');

try {
  if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '');
  }
} catch (err) {
  console.error('Aviso: não foi possível criar arquivo de banco de dados:', err.message);
}

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id TEXT NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  
  CREATE INDEX IF NOT EXISTS idx_session_id ON conversations(session_id);
  CREATE INDEX IF NOT EXISTS idx_created_at ON conversations(created_at);
`);

function saveConversation(sessionId, question, answer) {
  const stmt = db.prepare(
    'INSERT INTO conversations (session_id, question, answer) VALUES (?, ?, ?)'
  );
  return stmt.run(sessionId, question, answer);
}

function getConversationsBySession(sessionId, limit = 50) {
  const stmt = db.prepare(
    'SELECT * FROM conversations WHERE session_id = ? ORDER BY created_at DESC LIMIT ?'
  );
  return stmt.all(sessionId, limit);
}

function getRecentConversations(limit = 100) {
  const stmt = db.prepare(
    'SELECT * FROM conversations ORDER BY created_at DESC LIMIT ?'
  );
  return stmt.all(limit);
}

module.exports = { saveConversation, getConversationsBySession, getRecentConversations };
