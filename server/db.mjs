// server/db.mjs —— node:sqlite 持久层：会话（加密 cookie）与 kv（CSRF 等）。
// 零 npm 依赖；Node 26 的 node:sqlite 提供 DatabaseSync。
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
  PRAGMA journal_mode = WAL;
  PRAGMA busy_timeout = 5000;
  CREATE TABLE IF NOT EXISTS sessions (
    sid TEXT PRIMARY KEY,
    created_at INTEGER NOT NULL,
    last_seen INTEGER NOT NULL,
    cookies_enc BLOB NOT NULL,
    iv BLOB NOT NULL,
    tag BLOB NOT NULL,
    provider TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS kv (
    k TEXT PRIMARY KEY,
    v TEXT NOT NULL
  );
`;

export function openDb(file = process.env.RILL_DB || 'data/rill.sqlite') {
  if (file !== ':memory:') mkdirSync(dirname(file), { recursive: true });
  const db = new DatabaseSync(file);
  db.exec(SCHEMA);
  return db;
}

export class Store {
  constructor(db) {
    this.db = db;
  }

  createSession({ sid, createdAt, lastSeen, encrypted, iv, tag, provider }) {
    this.db
      .prepare(
        `INSERT OR REPLACE INTO sessions
          (sid, created_at, last_seen, cookies_enc, iv, tag, provider)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(sid, createdAt, lastSeen, encrypted, iv, tag, provider);
  }

  getSession(sid) {
    return this.db
      .prepare(
        `SELECT sid, created_at, last_seen, cookies_enc, iv, tag, provider
         FROM sessions WHERE sid = ?`,
      )
      .get(sid);
  }

  touchSession(sid, at) {
    this.db.prepare('UPDATE sessions SET last_seen = ? WHERE sid = ?').run(at, sid);
  }

  deleteSession(sid) {
    this.db.prepare('DELETE FROM sessions WHERE sid = ?').run(sid);
    this.deleteKv(`csrf:${sid}`);
  }

  setKv(key, value) {
    this.db.prepare('INSERT OR REPLACE INTO kv (k, v) VALUES (?, ?)').run(key, value);
  }

  getKv(key) {
    const row = this.db.prepare('SELECT v FROM kv WHERE k = ?').get(key);
    return row ? row.v : null;
  }

  deleteKv(key) {
    this.db.prepare('DELETE FROM kv WHERE k = ?').run(key);
  }

  close() {
    this.db.close();
  }
}