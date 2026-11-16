#!/usr/bin/env node
/**
 * check-device-direct.mjs —— 设备直连集成层验收（无 Android SDK 的替代）。
 *
 * 做法：Chrome --disable-web-security；在页面加载前把 window.Capacitor 打桩为原生，
 * 并把设备 provider 的 https 主机请求映射到本地假上游；用 CDP 断言登录、时间线、
 * 风控/登录过期/ok:0/超时四类错误文案。假上游只证明代码路径，不证明真站可用。
 */
import { execFileSync, spawn } from 'node:child_process';
import { accessSync, constants as fsConstants, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createServer as createNetServer } from 'node:net';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DIST = join(ROOT, 'dist');
const STATIC_PORT = Number(process.env.RILL_DEVICE_STATIC_PORT || 4183);
const UPSTREAM_PORT = Number(process.env.RILL_DEVICE_UPSTREAM_PORT || 8789);
const CHROME_CANDIDATES = [
  process.env.CHROME_BIN,
  process.env.CHROME,
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
].filter(Boolean);
const COOKIE_VALUE = ['FAKE', 'DEVICE', 'COOKIE', String(process.pid), String(Date.now())].join('_');
const mode = { value: 'ok' };
const fixture = JSON.parse(readFileSync(join(ROOT, 'test', 'fixtures', 'weibo-2019.json'), 'utf8'));

function chromePath() {
  for (const candidate of CHROME_CANDIDATES) {
    try { accessSync(candidate, fsConstants.X_OK); return candidate; } catch { /* next */ }
  }
  throw new Error('找不到 Chrome');
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': '*',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function html(res, text) {
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'access-control-allow-origin': '*' });
  res.end(text);
}

function upstreamServer() {
  return createServer((req, res) => {
    const url = new URL(req.url || '/', `http://127.0.0.1:${UPSTREAM_PORT}`);
    if (url.pathname === '/__mode') {
      mode.value = url.searchParams.get('value') || 'ok';
      return json(res, 200, { mode: mode.value });
    }
    if (url.pathname === '/__state') return json(res, 200, { mode: mode.value, cookieHeader: Boolean(req.headers.cookie) });
    if (mode.value === 'timeout') {
      const timer = setTimeout(() => { json(res, 200, { ok: 1, data: {} }); }, 10_500);
      req.on('close', () => clearTimeout(timer));
      return;
    }
    if (mode.value === 'auth') {
      res.writeHead(302, { location: 'https://passport.weibo.com/sso/signin' });
      return res.end();
    }
    if (mode.value === 'risk') {
      res.writeHead(432, { 'access-control-allow-origin': '*' });
      return res.end();
    }
    if (url.pathname === '/api/config') {
      return json(res, 200, { ok: 1, data: { login: true, st: 'fake-st', uid: 1669879400, user: { id: 1669879400, screen_name: '测试账号' } } });
    }
    if (url.pathname === '/statuses/show') return json(res, 200, fixture.statusShow);
    if (url.pathname === '/statuses/extend') return json(res, 200, fixture.longText);
    if (url.pathname === '/comments/hotflow') return json(res, 200, fixture.comments);
    if (url.pathname === '/api/container/getIndex') {
      if (mode.value === 'ok0') return json(res, 200, { ok: 0, errno: 10023, msg: '安全验证' });
      if (url.searchParams.get('type') === 'uid') return json(res, 200, fixture.userInfo);
      if (String(url.searchParams.get('containerid') || '').startsWith('100103type=2')) return json(res, 200, fixture.userSearch);
      return json(res, 200, fixture.timeline);
    }
    return json(res, 400, { ok: 0, msg: 'bad fake path' });
  });
}

function staticServer() {
  return createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url || '/', 'http://127.0.0.1').pathname);
    const relative = pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, '');
    const file = normalize(join(DIST, relative));
    if (!file.startsWith(DIST)) { res.writeHead(403); res.end(); return; }
    try {
      const stat = statSync(file);
      if (!stat.isFile()) throw new Error('not file');
      const ext = extname(file);
      const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png' };
      res.writeHead(200, { 'content-type': types[ext] || 'application/octet-stream' });
      res.end(readFileSync(file));
    } catch {
      res.writeHead(404); res.end('not found');
    }
  });
}

function sleep(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }
function listen(server, port) {
  return new Promise((resolve, reject) => server.listen(port, '127.0.0.1', () => resolve(server)));
}
function close(server) {
  return new Promise((resolve) => server.close(() => resolve()));
}
async function freePort() {
  const server = createNetServer();
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  await close(server);
  return port;
}

class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    ws.addEventListener('message', (event) => {
      const message = JSON.parse(event.data);
      const entry = this.pending.get(message.id);
      if (!entry) return;
      this.pending.delete(message.id);
      if (message.error) entry.reject(new Error(message.error.message));
      else entry.resolve(message.result);
    });
  }
  send(method, params = {}) {
    this.seq += 1;
    const id = this.seq;
    this.ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => this.pending.set(id, { resolve, reject }));
  }
  async eval(expression, awaitPromise = true) {
    const out = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise });
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text || 'evaluate failed');
    return out.result?.value;
  }
  async waitFor(expression, timeout = 8000) {
    const started = Date.now();
    while (Date.now() - started < timeout) {
      if (await this.eval(`Boolean(${expression})`)) return true;
      await sleep(80);
    }
    return false;
  }
}

async function main() {
  if (!statSync(DIST).isDirectory()) throw new Error('dist 不存在，请先 pnpm build');
  const staticSrv = await listen(staticServer(), STATIC_PORT);
  const upstreamSrv = await listen(upstreamServer(), UPSTREAM_PORT);
  const cdpPort = await freePort();
  const ud = `/tmp/rill-device-chrome-${process.pid}`;
  mkdirSync(ud, { recursive: true });
  const chrome = spawn(chromePath(), [
    '--headless=new', '--disable-gpu', '--no-sandbox', '--disable-dev-shm-usage',
    '--disable-web-security', '--disable-crash-reporter', '--disable-breakpad', '--disable-extensions',
    `--user-data-dir=${ud}`, `--remote-debugging-port=${cdpPort}`, '--window-size=375,812', 'about:blank',
  ], { stdio: ['ignore', 'pipe', 'pipe'] });
  chrome.stderr.on('data', (chunk) => { if (process.env.RILL_DEVICE_DEBUG) process.stderr.write(chunk); });
  let pageWs;
  try {
    let targets = [];
    for (let i = 0; i < 100; i += 1) {
      try {
        targets = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
        if (process.env.RILL_DEVICE_DEBUG) console.error('targets', targets.map((t) => `${t.type}:${t.url}`).join(','));
        if (targets.some((target) => target.type === 'page')) break;
      } catch { /* wait */ }
      await sleep(100);
    }
    const target = targets.find((item) => item.type === 'page');
    if (!target) throw new Error('没有找到 Chrome page target');
    pageWs = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      pageWs.addEventListener('open', resolve, { once: true });
      pageWs.addEventListener('error', reject, { once: true });
    });
    const cdp = new Cdp(pageWs);
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    const stub = `
      window.Capacitor = { isNativePlatform: () => true, Plugins: {} };
      window.__deviceCalls = [];
      const __realFetch = window.fetch.bind(window);
      window.fetch = (input, init = {}) => {
        const raw = typeof input === 'string' ? input : input.url;
        const target = String(raw);
        if (target.startsWith('https://m.' + 'weibo.cn')) {
          window.__deviceCalls.push({ url: target, method: init.method || 'GET' });
          return __realFetch(target.replace('https://m.' + 'weibo.cn', 'http://127.0.0.1:${UPSTREAM_PORT}'), init);
        }
        return __realFetch(input, init);
      };
    `;
    await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: stub });
    await cdp.send('Page.navigate', { url: `http://127.0.0.1:${STATIC_PORT}/index.html#/login` });
    if (!await cdp.waitFor("document.querySelector('[data-testid=login-root]')", 10000)) throw new Error('登录页未加载');
    const initial = await cdp.eval("({ device: window.Capacitor.isNativePlatform(), route: document.querySelector('[data-testid=login-root]')?.getAttribute('data-online') })");
    if (!initial.device) throw new Error('Capacitor stub 未生效');
    await cdp.eval(`(() => {
      const input = document.querySelector('[data-testid=login-input]');
      const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
      setter.call(input, 'SUB=${COOKIE_VALUE}; SUBP=fake-subp');
      input.dispatchEvent(new Event('input', { bubbles: true }));
      document.querySelector('[data-testid=login-submit]').click();
    })()`);
    if (!await cdp.waitFor("document.querySelector('[data-testid=login-success]')", 8000)) throw new Error('登录未成功');
    await cdp.eval("document.querySelector('[data-testid=login-enter]').click()");
    if (!await cdp.waitFor("document.querySelector('[data-testid=timeline-root]')?.getAttribute('data-post-count') === '1'", 10000)) throw new Error('时间线未加载');
    const timeline = await cdp.eval("({ count: document.querySelector('[data-testid=timeline-root]')?.getAttribute('data-post-count'), text: document.querySelector('[data-testid=post-text]')?.textContent, url: location.href, body: document.body.innerText.slice(0, 500), calls: window.__deviceCalls })");
    if (String(timeline.count) !== '1' || !String(timeline.text).includes('搬完这块砖')) throw new Error(`时间线渲染失败: ${JSON.stringify(timeline)}`);

    const setMode = async (value) => cdp.eval(`fetch('http://127.0.0.1:${UPSTREAM_PORT}/__mode?value=${value}', { cache: 'no-store' }).then(() => true)`);

    const reload = async () => {
      await cdp.send('Page.reload', { ignoreCache: true });
      await sleep(300);
    };
    await setMode('risk'); await reload();
    if (!await cdp.waitFor("document.querySelector('[data-testid=error-state]')", 5000)) throw new Error('432 未渲染错误态');
    const riskText = await cdp.eval("document.querySelector('[data-testid=error-state]')?.textContent || ''");
    if (!riskText.includes('触发了风控')) throw new Error(`432 文案不对: ${riskText}`);

    await setMode('auth'); await reload();
    if (!await cdp.waitFor("document.querySelector('[data-testid=auth-error]')", 5000)) throw new Error(`302 未渲染登录态错误: ${JSON.stringify(await cdp.eval("({body:document.body.innerText.slice(0,500),calls:window.__deviceCalls})"))}`);
    const authText = await cdp.eval("document.querySelector('[data-testid=auth-error]')?.textContent || ''");
    if (!authText.includes('需要重新登录')) throw new Error(`302 文案不对: ${authText}`);

    await setMode('ok0'); await reload();
    if (!await cdp.waitFor("document.querySelector('[data-testid=error-state]')", 5000)) throw new Error('ok:0 未渲染错误态');
    const ok0Text = await cdp.eval("document.querySelector('[data-testid=error-state]')?.textContent || ''");
    if (!ok0Text.includes('触发了风控')) throw new Error(`ok:0 文案不对: ${ok0Text}`);

    await setMode('timeout'); await reload();
    if (!await cdp.waitFor("document.querySelector('[data-testid=error-state]')", 12_000)) throw new Error('超时未渲染错误态');
    const timeoutText = await cdp.eval("document.querySelector('[data-testid=error-state]')?.textContent || ''");
    if (!timeoutText.includes('没有加载')) throw new Error(`超时文案不对: ${timeoutText}`);

    const cookieLeak = await cdp.eval(`({
      inDom: document.documentElement.outerHTML.includes('${COOKIE_VALUE}'),
      stored: Boolean(localStorage.getItem('rill:v1:device-cookies'))
    })`);
    if (cookieLeak.inDom) throw new Error('cookie 值出现在 DOM 产物');
    if (!cookieLeak.stored) throw new Error('cookie 未落设备本地');
    const calls = await cdp.eval('window.__deviceCalls.length');
    if (!calls) throw new Error('没有走设备 fetch 映射');
    console.log(JSON.stringify({
      PASS: true,
      timeline,
      errors: { risk: riskText.trim(), auth: authText.trim(), ok0: ok0Text.trim(), timeout: timeoutText.trim() },
      cookie: { storedInLocalStorage: cookieLeak.stored, leakedInDom: cookieLeak.inDom, deviceFetchCalls: calls },
    }, null, 2));
  } finally {
    try { pageWs?.close(); } catch { /* ignore */ }
    chrome.kill('SIGKILL');
    await sleep(300);
    await close(staticSrv);
    await close(upstreamSrv);
    try { rmSync(ud, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* chrome may still flush */ }
  }
}

main().catch((error) => {
  console.error('FAIL', error && error.stack ? error.stack : error);
  process.exit(1);
});
