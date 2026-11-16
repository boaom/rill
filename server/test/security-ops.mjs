// server/test/security-ops.mjs —— t26 在线映射 + 会话 TTL + 畸形路径 + 反代开关。
// 零依赖：node:test / node:assert；provider 用假 fetch，不触网。
import assert from 'node:assert/strict';
import test from 'node:test';
import { encryptJson } from '../crypto.mjs';
import { openDb, Store } from '../db.mjs';
import { clientIp } from '../http.mjs';
import { MockProvider } from '../providers/mock.mjs';
import { WeiboProvider } from '../providers/weibo.mjs';
import { SESSION_TTL_MS, handleSessionGet, readSession, sessionExpired } from '../routes/session.mjs';
import { serveStatic } from '../routes/static.mjs';

const SECRET = Buffer.alloc(32, 7);

function fakeRes() {
  const headers = {};
  return {
    headers,
    status: 0,
    body: '',
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    writeHead(status, extra = {}) {
      this.status = status;
      for (const [name, value] of Object.entries(extra)) headers[name.toLowerCase()] = value;
    },
    end(chunk) { if (chunk !== undefined) this.body += String(chunk); },
  };
}

function fakeReq(cookie = '') {
  return { headers: { cookie }, socket: { remoteAddress: '127.0.0.1' } };
}

function jsonResponse(payload) {
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function providerFor(mblog, extra = {}) {
  const payload = { ok: 1, data: { mblog: { idstr: 'M1', mid: '999', created_at: 'Fri Jun 14 20:39:20 +0800 2019', text: '正文', ...mblog } } };
  return new WeiboProvider({
    cookies: { SUB: 'fake' },
    fetchImpl: async () => jsonResponse(extra.payload || payload),
    cache: { get: () => null, set: () => {} },
  });
}

test('F1: upstream source HTML -> plain text, no tags/entities, <=24 chars', async () => {
  const post = await providerFor({
    source: '<a href="https://app.weibo.com/t/feed/1Y1K">iPhone &amp; iPad</a>',
    user: { id: 42, screen_name: '甲' },
  }).getStatus('M1');
  assert.equal(post.source, 'iPhone iPad');
  assert.equal(/[<>&]/.test(post.source), false);
  assert.ok(Array.from(post.source).length <= 24);

  const long = await providerFor({
    source: `<a>${'来'.repeat(30)}</a>`,
    user: { id: 42, screen_name: '甲' },
  }).getStatus('M1');
  assert.equal(Array.from(long.source).length, 24);
});

test('F1: missing source is omitted (C1: presentation decides; no 溪流 fallback)', async () => {
  const post = await providerFor({ user: { id: 42, screen_name: '甲' } }).getStatus('M1');
  assert.equal(Object.hasOwn(post, 'source'), false);
  const from = await providerFor({ from: '<a>Android客户端</a>', user: { id: 42, screen_name: '甲' } }).getStatus('M1');
  assert.equal(from.source, 'Android客户端');
});

test('F2: verified true / verified_type mapping; missing is undefined, not false', async () => {
  const p1 = await providerFor({ source: '网页版', user: { id: 42, screen_name: '甲', verified: true } }).getStatus('M1');
  assert.equal(p1.authorId, 'u42');
  assert.equal(p1.source, '网页版');

  const readUsers = async (user) => {
    const p = providerFor({ user });
    await p.getStatus('M1');
    return p.lastUsers[0];
  };
  const verified = await readUsers({ id: 42, screen_name: '甲', verified: true });
  assert.equal(verified.verified, true);

  const type0 = await readUsers({ id: 43, screen_name: '乙', verified_type: 0 });
  assert.equal(type0.verified, true);

  for (const user of [
    { id: 44, screen_name: '丙' },
    { id: 45, screen_name: '丁', verified: false },
    { id: 46, screen_name: '戊', verified: 0 },
    { id: 47, screen_name: '己', verified_type: -1 },
  ]) {
    const author = await readUsers(user);
    assert.equal(author.verified, undefined);
    assert.equal(Object.hasOwn(author, 'verified'), false);
  }
});

test('provider capabilities: write is true (m station writes still need real-cookie proof)', () => {
  assert.deepEqual(new WeiboProvider({ cookies: { SUB: 'x' } }).capabilities, {
    read: true,
    write: true,
    images: false,
  });
});

test('M1: expired session is unauthenticated and deletes row + csrf; valid session is untouched', async () => {
  const db = openDb(':memory:');
  const store = new Store(db);
  const mocked = new MockProvider();
  const ctx = {
    secret: SECRET,
    providerName: 'mock',
    providers: { mock: mocked },
    store,
  };
  const now = Date.now();
  const old = now - SESSION_TTL_MS - 1;
  const payload = encryptJson(SECRET, [{ name: 'SUB', value: 'test' }]);
  store.createSession({
    sid: 'expired',
    createdAt: old,
    lastSeen: old,
    encrypted: payload.encrypted,
    iv: payload.iv,
    tag: payload.tag,
    provider: 'mock',
  });
  store.setKv('csrf:expired', 'csrf-old');
  assert.equal(sessionExpired(store.getSession('expired'), now), true);
  assert.equal(readSession(fakeReq('rill_sid=expired'), ctx), null);
  assert.equal(store.getSession('expired'), undefined);
  assert.equal(store.getKv('csrf:expired'), null);

  const livePayload = encryptJson(SECRET, [{ name: 'SUB', value: 'test' }]);
  store.createSession({
    sid: 'live',
    createdAt: now,
    lastSeen: now - 1_000,
    encrypted: livePayload.encrypted,
    iv: livePayload.iv,
    tag: livePayload.tag,
    provider: 'mock',
  });
  store.setKv('csrf:live', 'csrf-live');
  const liveRes = fakeRes();
  await handleSessionGet(fakeReq('rill_sid=live'), liveRes, ctx);
  const live = JSON.parse(liveRes.body);
  assert.equal(live.authenticated, true);
  assert.equal(live.hasSession, true);
  assert.ok(store.getSession('live').last_seen > now - 1_000);
  assert.equal(store.getKv('csrf:live'), 'csrf-live');

  // 未过期行不会被误删
  assert.ok(store.getSession('live'));
  store.close();
});

test('M1: exactly TTL is still valid; TTL+1 is expired', () => {
  assert.equal(sessionExpired({ last_seen: 1000 }, 1000 + SESSION_TTL_MS), false);
  assert.equal(sessionExpired({ last_seen: 1000 }, 1000 + SESSION_TTL_MS + 1), true);
});

test('L2: malformed percent-encoding returns 400 before SPA fallback', async () => {
  const res = fakeRes();
  await serveStatic({ method: 'GET', url: '/%zz', headers: {} }, res, '/tmp');
  assert.equal(res.status, 400);
});

test('L3: XFF ignored by default, used as last hop only when RILL_TRUST_PROXY is explicitly enabled', () => {
  const req = {
    headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.7' },
    socket: { remoteAddress: '::ffff:10.0.0.1' },
  };
  assert.equal(clientIp(req, { trustProxy: false }), '10.0.0.1');
  assert.equal(clientIp(req, { trustProxy: true }), '198.51.100.7');

  const old = process.env.RILL_TRUST_PROXY;
  delete process.env.RILL_TRUST_PROXY;
  assert.equal(clientIp(req), '10.0.0.1');
  process.env.RILL_TRUST_PROXY = '1';
  assert.equal(clientIp(req), '198.51.100.7');
  if (old === undefined) delete process.env.RILL_TRUST_PROXY;
  else process.env.RILL_TRUST_PROXY = old;
});
