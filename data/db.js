const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dataDir = __dirname;
const dbPath = path.join(dataDir, 'chat_history.db');

if (!fs.existsSync(dbPath)) {
  fs.writeFileSync(dbPath, '');
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
