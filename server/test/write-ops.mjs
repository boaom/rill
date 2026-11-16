// server/test/write-ops.mjs —— t19 写操作自证：本地假上游 + 假 cookie，不触网。
// 覆盖 6 类错误、XSRF、幂等、限速、超时、发博不自动重试。
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:http';
import test from 'node:test';
import { setTimeout as sleep } from 'node:timers/promises';
import { WeiboProvider, WEIBO_ERROR_CODES } from '../providers/weibo.mjs';
import { IdempotencyStore, resetWriteState, writeLimiter } from '../routes/write.mjs';

const COOKIE = { SUB: 'test-fake' };
let mode = 'success';
let calls = [];
let server;
let baseUrl;

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}
function formOf(text) { return new URLSearchParams(text); }

server = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    calls.push({ path: url.pathname, headers: req.headers, body });
    if (url.pathname === '/api/config') return json(res, 200, { ok: 1, data: { login: true, st: 'st-test' } });
    if (url.pathname === '/statuses/show') return json(res, 200, { ok: 1, data: { idstr: 'M1', mid: '999', user: { id: 42, screen_name: '测试' }, text: '原博' } });
    if (url.pathname === '/api/attitudes/like' || url.pathname === '/api/attitudes/unlike') {
      if (mode === 'auth') { res.writeHead(302, { location: 'https://passport.weibo.cn/signin/login' }); return res.end(); }
      if (mode === 'risk') { res.writeHead(432); return res.end('anti'); }
      if (mode === 'rate') { res.writeHead(429); return res.end('slow'); }
      if (mode === 'upstream') { res.writeHead(500); return res.end('boom'); }
      if (mode === 'content') return json(res, 200, { ok: 0, msg: '内容包含敏感词' });
      if (mode === 'notfound') return json(res, 404, { ok: 0, msg: '原文不存在' });
      return json(res, 200, { ok: 1, data: { attitudes_count: 7, liked: url.pathname.endsWith('like') } });
    }
    if (url.pathname === '/api/statuses/repost') return json(res, 200, { ok: 1, data: { mblog: { idstr: 'M_REPOST', user: { id: 42, screen_name: '测试' }, text: '转发内容', created_at: 'Fri Jun 14 20:39:20 +0800 2019' } } });
    if (url.pathname === '/api/comments/create') return json(res, 200, { ok: 1, data: { idstr: 'C1', rootid: null, text: '评论内容', user: { id: 42, screen_name: '测试' }, created_at: 'Fri Jun 14 20:39:20 +0800 2019' } });
    if (url.pathname === '/api/statuses/update') {
      if (mode === 'timeout') return setTimeout(() => json(res, 200, { ok: 1, data: { mblog: { idstr: 'M_LATE' } } }), 200);
      if (mode === 'content') return json(res, 200, { ok: 0, msg: '内容超长' });
      if (mode === 'auth') { res.writeHead(302, { location: 'https://passport.weibo.cn/signin/login' }); return res.end(); }
      if (mode === 'risk') { res.writeHead(432); return res.end('anti'); }
      if (mode === 'rate') { res.writeHead(418); return res.end('slow'); }
      if (mode === 'upstream') { res.writeHead(500); return res.end('boom'); }
      return json(res, 200, { ok: 1, data: { mblog: { idstr: 'M_PUBLISH', user: { id: 42, screen_name: '测试' }, text: '新博', created_at: 'Fri Jun 14 20:39:20 +0800 2019' } } });
    }
    json(res, 404, { ok: 0, msg: 'not found' });
  });
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
baseUrl = `http://127.0.0.1:${server.address().port}`;

function provider(options = {}) {
  return new WeiboProvider({ cookies: COOKIE, baseUrl, ...options });
}
function reset(m, p = provider()) { mode = m; calls = []; return p; }
async function codeOf(promise) {
  try { await promise; return 'NO_ERROR'; } catch (error) { return error.code; }
}

test.after(() => server.close());
test.beforeEach(() => resetWriteState());

test('XSRF + like/repost/comment/publish success and field mapping', async () => {
  const p = reset('success');
  const like = await p.like('M1', true);
  assert.deepEqual(like, { liked: true, count: 7 });
  const likeCall = calls.find((call) => call.path === '/api/attitudes/like');
  assert.equal(likeCall.headers['x-xsrf-token'], 'st-test');
  assert.equal(likeCall.headers.origin, 'https://m.weibo.cn');
  assert.equal(formOf(likeCall.body).get('st'), 'st-test');
  assert.equal(formOf(likeCall.body).get('id'), 'M1');

  const repost = await p.repost('M1', '转一下');
  assert.equal(repost.id, 'M_REPOST');
  assert.equal(repost.repostOfId, 'M1');
  const repostCall = calls.find((call) => call.path === '/api/statuses/repost');
  assert.equal(formOf(repostCall.body).get('id'), 'M1');
  assert.equal(formOf(repostCall.body).get('mid'), '999');
  assert.equal(formOf(repostCall.body).get('st'), 'st-test');

  const reply = await p.comment('M1', '评论一下');
  assert.equal(reply.id, 'C1');
  assert.equal(reply.postId, 'M1');
  const commentCall = calls.find((call) => call.path === '/api/comments/create');
  assert.equal(formOf(commentCall.body).get('content'), '评论一下');

  const post = await p.publish('发一条', [{ id: 'm1', hue: 1, ratio: 'square', alt: '占位' }]);
  assert.equal(post.id, 'M_PUBLISH');
  assert.match(p.lastPublishNotice, /占位/);
  const publishCall = calls.find((call) => call.path === '/api/statuses/update');
  assert.equal(formOf(publishCall.body).get('content'), '发一条');
  assert.equal(formOf(publishCall.body).get('st'), 'st-test');
});

test('six write error classes', async () => {
  for (const [m, code] of [
    ['auth', WEIBO_ERROR_CODES.AUTH_EXPIRED],
    ['risk', WEIBO_ERROR_CODES.RISK_CONTROL],
    ['rate', WEIBO_ERROR_CODES.RATE_LIMITED],
    ['content', WEIBO_ERROR_CODES.CONTENT_REJECTED],
    ['notfound', WEIBO_ERROR_CODES.NOT_FOUND],
    ['upstream', WEIBO_ERROR_CODES.UPSTREAM],
  ]) {
    const p = reset(m);
    assert.equal(await codeOf(p.like('M1', true)), code, `like mode=${m}`);
  }
});

test('XSRF auth refreshes token and retries once for like', async () => {
  mode = 'auth';
  const p = provider({ fetchImpl: async (url, init) => {
    const parsed = new URL(String(url));
    if (parsed.pathname === '/api/config') return new Response(JSON.stringify({ ok: 1, data: { login: true, st: 'st-new' } }), { status: 200, headers: { 'content-type': 'application/json' } });
    const count = calls.filter((call) => call.path === '/api/attitudes/like').length;
    calls.push({ path: parsed.pathname, headers: init.headers, body: String(init.body || '') });
    if (count === 0) return new Response('', { status: 302, headers: { location: 'https://passport.weibo.cn/signin/login' } });
    return new Response(JSON.stringify({ ok: 1, data: { attitudes_count: 8 } }), { status: 200, headers: { 'content-type': 'application/json' } });
  } });
  const result = await p.like('M1', true);
  assert.equal(result.count, 8);
  assert.equal(calls.filter((call) => call.path === '/api/attitudes/like').length, 2);
});

test('publish never auto-retries after upstream/auth failure', async () => {
  for (const m of ['upstream', 'auth']) {
    const p = reset(m);
    const expected = m === 'auth' ? WEIBO_ERROR_CODES.AUTH_EXPIRED : WEIBO_ERROR_CODES.UPSTREAM;
    assert.equal(await codeOf(p.publish('不能重复发')), expected, `mode=${m}`);
    assert.equal(calls.filter((call) => call.path === '/api/statuses/update').length, 1, `publish calls mode=${m}`);
  }
});

test('write timeout maps to UPSTREAM without retry', async () => {
  mode = 'timeout';
  calls = [];
  const p = provider({ timeoutMs: 40 });
  const started = Date.now();
  assert.equal(await codeOf(p.publish('慢请求')), WEIBO_ERROR_CODES.UPSTREAM);
  assert.ok(Date.now() - started < 1000);
  assert.equal(calls.filter((call) => call.path === '/api/statuses/update').length, 1);
});

test('rate limiter allows 6 writes per minute and blocks the 7th without a call', () => {
  resetWriteState();
  for (let i = 0; i < 6; i += 1) assert.equal(writeLimiter.take('account-1').allowed, true);
  assert.equal(writeLimiter.take('account-1').allowed, false);
});

test('idempotency store returns cached result and expires after 5 minutes', () => {
  const store = new IdempotencyStore(5 * 60_000, 10);
  const t = 1_000_000;
  store.set('k', { status: 200, body: { post: { id: 'M1' } } }, t);
  assert.deepEqual(store.get('k', t + 1000), { status: 200, body: { post: { id: 'M1' } } });
  assert.equal(store.get('k', t + 5 * 60_000 + 1), null);
});

test('empty/too-long content is rejected before upstream', async () => {
  const p = reset('success');
  assert.equal(await codeOf(p.publish('')), WEIBO_ERROR_CODES.CONTENT_REJECTED);
  assert.equal(await codeOf(p.publish('a'.repeat(141))), WEIBO_ERROR_CODES.CONTENT_REJECTED);
  assert.equal(calls.filter((call) => call.path === '/api/statuses/update').length, 0);
});

test('HTTP route: idempotency replay and per-account write rate limit', async () => {
  reset('success');
  calls = [];
  const port = 8797;
  const secret = Buffer.alloc(32, 7).toString('base64');
  const child = spawn(process.execPath, ['server/index.mjs'], {
    cwd: new URL('../../', import.meta.url).pathname,
    env: {
      ...process.env,
      RILL_SECRET: secret,
      RILL_DB: ':memory:',
      RILL_PORT: String(port),
      RILL_PROVIDER: 'weibo',
      RILL_WEIBO_BASE: baseUrl,
      NODE_ENV: 'test',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let logs = '';
  child.stdout.on('data', (chunk) => { logs += chunk; });
  child.stderr.on('data', (chunk) => { logs += chunk; });
  try {
    for (let i = 0; i < 50 && !logs.includes('listening on'); i += 1) await sleep(100);
    assert.match(logs, /listening on/, logs);
    const login = await fetch(`http://127.0.0.1:${port}/api/session/cookie`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookies: [{ name: 'SUB', value: 'test-fake' }] }),
    });
    assert.equal(login.status, 201);
    const sid = /rill_sid=([^;]+)/.exec(login.headers.get('set-cookie') || '')?.[1];
    const csrf = login.headers.get('x-rill-csrf');
    assert.ok(sid && csrf);
    const write = (key) => fetch(`http://127.0.0.1:${port}/api/status/M1/like`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `rill_sid=${sid}`,
        'x-rill-csrf': csrf,
        'Idempotency-Key': key,
      },
      body: JSON.stringify({ on: true }),
    });
    const first = await write('idem-like-0001');
    assert.equal(first.status, 200);
    const replay = await write('idem-like-0001');
    assert.equal(replay.status, 200);
    assert.deepEqual(await replay.json(), await first.json());
    assert.equal(calls.filter((call) => call.path === '/api/attitudes/like').length, 1);
    for (let i = 0; i < 5; i += 1) {
      const response = await write(`idem-like-unique-${i}`);
      assert.equal(response.status, 200);
    }
    const blocked = await write('idem-like-over-limit');
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error.code, 'RATE_LIMITED');
    assert.equal(calls.filter((call) => call.path === '/api/attitudes/like').length, 6);

    // 新会话验证 publish 幂等：相同 key 只打一次上游，返回同一结果。
    const login2 = await fetch(`http://127.0.0.1:${port}/api/session/cookie`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookies: [{ name: 'SUB', value: 'test-fake' }] }),
    });
    const sid2 = /rill_sid=([^;]+)/.exec(login2.headers.get('set-cookie') || '')?.[1];
    const csrf2 = login2.headers.get('x-rill-csrf');
    const publish = (key) => fetch(`http://127.0.0.1:${port}/api/status/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `rill_sid=${sid2}`,
        'x-rill-csrf': csrf2,
        'Idempotency-Key': key,
      },
      body: JSON.stringify({ text: '只发一次' }),
    });
    const firstPublish = await publish('idem-publish-0001');
    assert.equal(firstPublish.status, 200);
    const replayPublish = await publish('idem-publish-0001');
    assert.equal(replayPublish.status, 200);
    assert.deepEqual(await replayPublish.json(), await firstPublish.json());
    assert.equal(calls.filter((call) => call.path === '/api/statuses/update').length, 1);

    // 内容拒绝必须映射 422 CONTENT_REJECTED，而不是笼统 502。
    mode = 'content';
    const login3 = await fetch(`http://127.0.0.1:${port}/api/session/cookie`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ cookies: [{ name: 'SUB', value: 'test-fake' }] }),
    });
    const sid3 = /rill_sid=([^;]+)/.exec(login3.headers.get('set-cookie') || '')?.[1];
    const csrf3 = login3.headers.get('x-rill-csrf');
    const rejected = await fetch(`http://127.0.0.1:${port}/api/status/publish`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        cookie: `rill_sid=${sid3}`,
        'x-rill-csrf': csrf3,
        'Idempotency-Key': 'idem-publish-rejected',
      },
      body: JSON.stringify({ text: '会被拒绝的内容' }),
    });
    assert.equal(rejected.status, 422);
    assert.equal((await rejected.json()).error.code, 'CONTENT_REJECTED');
    mode = 'success';
  } finally {
    child.kill('SIGTERM');
  }
});
