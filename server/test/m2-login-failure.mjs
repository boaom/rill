// server/test/m2-login-failure.mjs —— M2：上游 /api/config login:false 时会话不得表现为已认证。
// 零依赖；假上游只在本机，子进程 server 用 RILL_WEIBO_BASE 指向它。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';

const APP = new URL('../../', import.meta.url).pathname;
const UPSTREAM_PORT = 8812;
const APP_PORT = 8813;
let mode = 'login-false';
let upstream;
let child;
let base = '';

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

test.before(async () => {
  upstream = createServer((req, res) => {
    const url = new URL(req.url, 'http://127.0.0.1');
    if (url.pathname === '/api/config') {
      if (mode === 'login-false') return json(res, 200, { ok: 1, data: { login: false, st: '' } });
      return json(res, 200, { ok: 1, data: { login: true, st: 'st', user: { id: 42, screen_name: '测试账号' } } });
    }
    if (url.pathname === '/api/account/get_uid') return json(res, 200, { ok: 1, data: { uid: 42 } });
    return json(res, 404, { ok: 0, msg: 'not found' });
  });
  await new Promise((resolve) => upstream.listen(UPSTREAM_PORT, '127.0.0.1', resolve));

  child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: APP,
    env: {
      ...process.env,
      RILL_SECRET: Buffer.alloc(32, 9).toString('base64'),
      RILL_DB: ':memory:',
      RILL_PROVIDER: 'weibo',
      RILL_WEIBO_BASE: `http://127.0.0.1:${UPSTREAM_PORT}`,
      RILL_PORT: String(APP_PORT),
      RILL_HOST: '127.0.0.1',
    },
    stdio: 'ignore',
  });
  base = `http://127.0.0.1:${APP_PORT}`;
  for (let i = 0; i < 100; i += 1) {
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) return;
    } catch {
      // 等待 listen
    }
    await sleep(50);
  }
  throw new Error('test server did not become healthy');
});

test.after(async () => {
  child?.kill('SIGTERM');
  await new Promise((resolve) => upstream?.close(resolve));
});

async function login() {
  const res = await fetch(`${base}/api/session/cookie`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ cookies: [{ name: 'SUB', value: 'fake-sub' }] }),
  });
  assert.equal(res.status, 201);
  const cookie = res.headers.get('set-cookie') || '';
  const sid = /rill_sid=([^;]+)/.exec(cookie)?.[1];
  assert.ok(sid, 'Set-Cookie contains rill_sid');
  return `rill_sid=${sid}`;
}

test('M2: upstream login:false -> GET /api/session authenticated:false (not hasSession-as-success)', async () => {
  mode = 'login-false';
  const cookie = await login();
  const res = await fetch(`${base}/api/session`, { headers: { cookie } });
  assert.equal(res.status, 200);
  const session = await res.json();
  assert.equal(session.authenticated, false);
  assert.equal(session.hasSession, true);
  assert.equal(session.user, undefined);
});

test('M2: upstream login:true -> GET /api/session authenticated:true with user', async () => {
  mode = 'login-true';
  const cookie = await login();
  const res = await fetch(`${base}/api/session`, { headers: { cookie } });
  const session = await res.json();
  assert.equal(session.authenticated, true);
  assert.equal(session.hasSession, true);
  assert.equal(session.user?.uid, '42');
  assert.equal(session.user?.screenName, '测试账号');
});

test('M2: failed session still has a server row (so user can retry) and DELETE clears it', async () => {
  mode = 'login-false';
  const cookie = await login();
  const failed = await (await fetch(`${base}/api/session`, { headers: { cookie } })).json();
  assert.equal(failed.authenticated, false);
  const del = await fetch(`${base}/api/session`, { method: 'DELETE', headers: { cookie, origin: base } });
  assert.equal(del.status, 204);
  const after = await (await fetch(`${base}/api/session`, { headers: { cookie } })).json();
  assert.equal(after.authenticated, false);
  assert.equal(after.hasSession, false);
});
