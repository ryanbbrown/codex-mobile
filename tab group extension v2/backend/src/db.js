import Database from 'better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nanoid } from 'nanoid';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_PATH = process.env.SQLITE_FILE ?? join(__dirname, '..', 'data.sqlite');
mkdirSync(dirname(DATA_PATH), { recursive: true });

const db = new Database(DATA_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL,
    payload TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
`);

function normalizeSession(raw) {
  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid session payload');
  }
  const session = { ...raw };
  session.id = session.id ?? nanoid();
  session.name = String(session.name ?? 'Untitled session');
  session.createdAt = new Date(session.createdAt ?? Date.now()).toISOString();
  if (!Array.isArray(session.groups)) {
    session.groups = [];
  }
  session.groups = session.groups.map((group) => ({
    id: String(group.id ?? nanoid()),
    title: String(group.title ?? ''),
    color: group.color ?? 'grey',
    collapsed: Boolean(group.collapsed),
    tabs: Array.isArray(group.tabs)
      ? group.tabs.map((tab) => ({
          id: String(tab.id ?? nanoid()),
          url: String(tab.url ?? ''),
          title: String(tab.title ?? ''),
          pinned: Boolean(tab.pinned)
        }))
      : []
  }));
  return session;
}

export function listSessions(userId) {
  const stmt = db.prepare(
    'SELECT id, name, created_at as createdAt, payload FROM sessions WHERE user_id = ? ORDER BY datetime(created_at) DESC'
  );
  return stmt.all(userId).map((row) => ({
    ...JSON.parse(row.payload),
    id: row.id,
    name: row.name,
    createdAt: row.createdAt
  }));
}

export function saveSession(userId, rawSession) {
  const session = normalizeSession(rawSession);
  const stmt = db.prepare(`
    INSERT INTO sessions (id, user_id, name, created_at, payload)
    VALUES (@id, @userId, @name, @createdAt, @payload)
    ON CONFLICT(id) DO UPDATE SET
      user_id = excluded.user_id,
      name = excluded.name,
      created_at = excluded.created_at,
      payload = excluded.payload
  `);
  stmt.run({
    id: session.id,
    userId,
    name: session.name,
    createdAt: session.createdAt,
    payload: JSON.stringify(session)
  });
  return session;
}

export function deleteSession(userId, sessionId) {
  const stmt = db.prepare('DELETE FROM sessions WHERE id = ? AND user_id = ?');
  stmt.run(sessionId, userId);
}

