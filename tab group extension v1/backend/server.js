import cors from 'cors';
import express from 'express';
import fs from 'node:fs';
import { join } from 'node:path';
import morgan from 'morgan';
import { nanoid } from 'nanoid';

const PORT = process.env.PORT ?? 8787;
const DATA_FILE = process.env.DATA_FILE ?? join(process.cwd(), 'storage.json');

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(morgan('dev'));

function readStorage() {
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {};
    }
    throw error;
  }
}

function writeStorage(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

function sanitizeSession(rawSession) {
  if (!rawSession || typeof rawSession !== 'object') {
    throw new Error('Invalid session payload');
  }
  const session = { ...rawSession };
  if (!session.id) {
    session.id = nanoid();
  }
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

app.get('/sessions/:key', (req, res) => {
  const store = readStorage();
  const key = req.params.key;
  res.json({ sessions: store[key] ?? [] });
});

app.post('/sessions/:key', (req, res) => {
  try {
    const session = sanitizeSession(req.body?.session);
    const store = readStorage();
    const key = req.params.key;
    const list = store[key] ?? [];
    const existingIndex = list.findIndex((item) => item.id === session.id);
    if (existingIndex >= 0) {
      list[existingIndex] = session;
    } else {
      list.unshift(session);
    }
    store[key] = list;
    writeStorage(store);
    res.status(existingIndex >= 0 ? 200 : 201).json({ session });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.delete('/sessions/:key/:id', (req, res) => {
  const key = req.params.key;
  const id = req.params.id;
  const store = readStorage();
  const list = store[key] ?? [];
  const nextList = list.filter((session) => session.id !== id);
  store[key] = nextList;
  writeStorage(store);
  res.status(204).end();
});

app.listen(PORT, () => {
  console.log(`Universal key store listening on http://localhost:${PORT}`);
});
