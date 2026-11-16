#!/usr/bin/env node
// t19 在线写操作 CDP 自证：mock provider + 假 cookie，375 宽坐标点击。
// 只用于本地验收；不写 docs、不触真实微博。
import { spawn } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PORT = 8788;
const BASE = `http://127.0.0.1:${PORT}`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const CHROME_CANDIDATES = ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome', '/usr/bin/chromium'];
const CHROME = process.env.CHROME_BIN || CHROME_CANDIDATES.find((p) => existsSync(p));
if (!CHROME) { console.log('FAIL chrome not found'); process.exit(1); }
if (!existsSync(join(ROOT, 'dist', 'index.html'))) { console.log('FAIL dist not built'); process.exit(1); }

let upstreamPublishFail = false;
const upstream = createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    const send = (value) => { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(value)); };
    if (url.pathname === '/api/config') return send({ ok: 1, data: { login: true, uid: 42, st: 'st-cdp', user: { idstr: '42', screen_name: '测试账号' } } });
    if (url.pathname === '/api/container/getIndex') {
      return send({ ok: 1, data: { cards: [{ mblog: {
        idstr: 'M1', mid: '9001', user: { idstr: '42', screen_name: '测试账号' },
        text: 'CDP 在线时间线内容', created_at: 'Mon Nov 16 20:00:00 +0800 2026',
        attitudes_count: 5, comments_count: 0, reposts_count: 0,
      } }] } });
    }
    if (url.pathname === '/statuses/show') return send({ ok: 1, data: { mblog: {
      idstr: 'M1', mid: '9001', user: { idstr: '42', screen_name: '测试账号' },
      text: 'CDP 在线时间线内容', created_at: 'Mon Nov 16 20:00:00 +0800 2026', attitudes_count: 5,
    } } });
    if (url.pathname === '/api/attitudes/like') return send({ ok: 1, data: { attitudes_count: 6, liked: true } });
    if (url.pathname === '/api/attitudes/unlike') return send({ ok: 1, data: { attitudes_count: 5, liked: false } });
    if (url.pathname === '/api/statuses/repost') return send({ ok: 1, data: { mblog: {
      idstr: 'M_REPOST', user: { idstr: '42', screen_name: '测试账号' }, text: 'CDP 转发',
      created_at: 'Mon Nov 16 20:01:00 +0800 2026',
    } } });
    if (url.pathname === '/api/comments/create') return send({ ok: 1, data: { idstr: 'C1', text: 'CDP 评论', user: { idstr: '42', screen_name: '测试账号' }, created_at: 'Mon Nov 16 20:02:00 +0800 2026' } });
    if (url.pathname === '/api/statuses/update' && upstreamPublishFail) { res.writeHead(500); return res.end('boom'); }
    if (url.pathname === '/api/statuses/update') return send({ ok: 1, data: { mblog: {
      idstr: 'M_CDP_PUB', user: { idstr: '42', screen_name: '测试账号' }, text: 'CDP 发博',
      created_at: 'Mon Nov 16 20:03:00 +0800 2026',
    } } });
    send({ ok: 0, msg: 'not found' });
  });
});
await new Promise((resolve) => upstream.listen(8790, '127.0.0.1', resolve));

const server = spawn(process.execPath, ['server/index.mjs'], {
  cwd: ROOT,
  env: { ...process.env, RILL_PORT: String(PORT), RILL_DB: ':memory:', RILL_PROVIDER: 'weibo', RILL_WEIBO_BASE: 'http://127.0.0.1:8790', RILL_SECRET: Buffer.alloc(32, 3).toString('base64'), NODE_ENV: 'test' },
  stdio: ['ignore', 'pipe', 'pipe'],
});
let logs = '';
server.stdout.on('data', (c) => { logs += c; });
server.stderr.on('data', (c) => { logs += c; });
for (let i = 0; i < 80 && !logs.includes('listening on'); i += 1) await sleep(100);
if (!logs.includes('listening on')) { console.log('FAIL server', logs); server.kill(); process.exit(1); }

let chrome;
let ws;
let nextId = 1;
const pending = new Map();
const checks = [];
function check(name, ok, detail) {
  checks.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` :: ${JSON.stringify(detail).slice(0, 300)}` : ''}`);
}
async function cdp(method, params = {}) {
  const id = nextId++;
  ws.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    setTimeout(() => { if (pending.has(id)) { pending.delete(id); reject(new Error(`CDP timeout ${method}`)); } }, 15000);
  });
}
async function evaluate(expression, awaitPromise = true) {
  const result = await cdp('Runtime.evaluate', { expression, awaitPromise, returnByValue: true, userGesture: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text || 'evaluate failed');
  return result.result?.value;
}
async function waitFor(expression, timeout = 10000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    try { if (await evaluate(expression, false)) return true; } catch { /* retry */ }
    await sleep(100);
  }
  return false;
}
async function click(testid) {
  const rect = await evaluate(`(() => { const el = document.querySelector('[data-testid="${testid}"]'); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: !!document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.closest('[data-testid="${testid}"]') }; })()`, false);
  if (!rect) throw new Error(`missing ${testid}`);
  await cdp('Input.dispatchMouseEvent', { type: 'mousePressed', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  await cdp('Input.dispatchMouseEvent', { type: 'mouseReleased', x: rect.x, y: rect.y, button: 'left', clickCount: 1 });
  return rect;
}
async function setInput(testid, text) {
  await evaluate(`(() => { const el = document.querySelector('[data-testid="${testid}"]'); if (!el) return false; const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, ${JSON.stringify(text)}); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`, false);
}

try {
  const ud = `/tmp/rill-t19-${process.pid}`;
  rmSync(ud, { recursive: true, force: true });
  chrome = spawn(CHROME, ['--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars', `--user-data-dir=${ud}`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  let cdpPort = null;
  for (let i = 0; i < 300 && !cdpPort; i += 1) {
    try { cdpPort = Number(readFileSync(join(ud, 'DevToolsActivePort'), 'utf8').split('\n')[0]); } catch { /* wait */ }
    if (!cdpPort) await sleep(100);
  }
  if (!cdpPort) throw new Error('no DevToolsActivePort');
  const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
  const target = list.find((item) => item.type === 'page');
  if (!target) throw new Error('no page target');
  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    const p = pending.get(message.id);
    if (!p) return;
    pending.delete(message.id);
    if (message.error) p.reject(new Error(message.error.message));
    else p.resolve(message.result);
  };
  await cdp('Page.enable');
  await cdp('Runtime.enable');
  await cdp('Emulation.setDeviceMetricsOverride', { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });
  await cdp('Page.navigate', { url: `${BASE}/#/timeline` });
  await waitFor(`document.readyState === 'complete'`, 15000);
  await evaluate(`fetch('/api/session/cookie', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ cookies: [{ name: 'SUB', value: 'test-fake' }] }) }).then((r) => r.status)`, true);
  await evaluate('location.reload()', false);
  await sleep(500);
  check('在线假上游时间线加载', await waitFor(`document.querySelector('[data-testid="timeline-root"]')?.getAttribute('data-online') === 'true' && Number(document.querySelector('[data-testid="timeline-root"]')?.getAttribute('data-post-count')) > 0`, 15000), await evaluate(`({ route: location.hash, count: document.querySelector('[data-testid="timeline-root"]')?.getAttribute('data-post-count'), online: document.querySelector('[data-testid="timeline-root"]')?.getAttribute('data-online') })`, false));

  const beforeLike = Number(await evaluate(`document.querySelector('[data-testid="like-btn"]')?.textContent`, false));
  const hit = await click('like-btn');
  const liked = await waitFor(`Number(document.querySelector('[data-testid="like-btn"]')?.textContent) === ${beforeLike + 1}`, 8000);
  check('点赞坐标命中，乐观更新 +1', liked && hit.hit, { beforeLike, after: await evaluate(`document.querySelector('[data-testid="like-btn"]')?.textContent`, false) });

  await sleep(500);
  const afterLike = Number(await evaluate(`document.querySelector('[data-testid="like-btn"]')?.textContent`, false));
  await click('like-btn');
  const unliked = await waitFor(`Number(document.querySelector('[data-testid="like-btn"]')?.textContent) === ${afterLike - 1}`, 8000);
  check('取消赞坐标命中，计数回落', unliked, { afterLike, after: await evaluate(`document.querySelector('[data-testid="like-btn"]')?.textContent`, false) });

  await click('repost-btn');
  check('转发弹层打开', await waitFor(`document.querySelector('[data-testid="write-sheet"]')?.hasAttribute('open')`, 5000));
  await setInput('write-input', 'CDP 转发');
  await click('write-submit');
  check('转发提交后弹层关闭', await waitFor(`!document.querySelector('[data-testid="write-sheet"]')?.hasAttribute('open')`, 8000), await evaluate(`document.querySelector('[data-testid="toast"]')?.textContent`, false));

  await click('reply-btn');
  check('评论弹层打开', await waitFor(`document.querySelector('[data-testid="write-sheet"]')?.hasAttribute('open')`, 5000));
  await setInput('write-input', 'CDP 评论');
  await click('write-submit');
  check('评论提交后弹层关闭', await waitFor(`!document.querySelector('[data-testid="write-sheet"]')?.hasAttribute('open')`, 8000));

  await evaluate(`location.hash = '#/compose'`, false);
  await waitFor(`document.querySelector('[data-testid="compose-root"]')`, 8000);
  await setInput('compose-input', 'CDP 发博');
  const beforePublish = await evaluate(`({ disabled: document.querySelector('[data-testid="publish-btn"]')?.disabled })`, false);
  await click('publish-btn');
  const published = await waitFor(`location.hash === '#/timeline' && Number(document.querySelector('[data-testid="timeline-root"]')?.getAttribute('data-post-count')) === 2`, 12000);
  const firstText = await evaluate(`document.querySelector('[data-testid="post-card"] [data-testid="post-text"]')?.textContent || document.querySelector('[data-testid="timeline-root"] .post-card__text')?.textContent`, false);
  check('发博后回时间线且首条为新内容（新 id + 计数）', published && String(firstText).includes('CDP 发博'), { beforePublish, firstText, count: await evaluate(`document.querySelector('[data-testid="timeline-root"]')?.getAttribute('data-post-count')`, false) });

  upstreamPublishFail = true;
  await evaluate(`location.hash = '#/compose'`, false);
  await waitFor(`document.querySelector('[data-testid="compose-root"]')`, 8000);
  await setInput('compose-input', '失败也要保留这段草稿');
  await click('publish-btn');
  const failedState = await waitFor(`Boolean(document.querySelector('[data-testid="publish-error"]'))`, 10000);
  const kept = await evaluate(`({ route: location.hash, text: document.querySelector('[data-testid="compose-input"]')?.value, disabled: document.querySelector('[data-testid="publish-btn"]')?.disabled, error: document.querySelector('[data-testid="publish-error"]')?.textContent })`, false);
  check('发博失败：留在发博页、保留文字、显示原因、按钮可重试', failedState && kept.route === '#/compose' && kept.text === '失败也要保留这段草稿' && kept.disabled === false && String(kept.error).includes('服务'), kept);

  const failed = checks.filter((item) => !item.ok).length;
  console.log(`===== online writes PASS ${checks.length - failed} / FAIL ${failed} =====`);
  if (failed) process.exitCode = 1;
} catch (error) {
  console.log('FAIL exception', error?.stack || error);
  process.exitCode = 1;
} finally {
  server.kill('SIGTERM');
  upstream.close();
  if (ws) ws.close();
  if (chrome) chrome.kill('SIGTERM');
}
