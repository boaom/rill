#!/usr/bin/env node
/**
 * check-hit.mjs —— 命中测试（坐标点击）验收，替代 el.click() 的假 PASS。
 *
 * 为什么需要它：`el.click()` 直接派发 DOM 事件，绕过浏览器命中测试（elementFromPoint / z-index / 覆盖层）。
 * 本轮 blocker 就是关闭态 `.sheet { display:block }` 盖住 tabbar / 发布按钮，而 el.click() 断言全绿。
 *
 * 做法：一切交互都用 CDP `Input.dispatchMouseEvent`（按下/抬起）打在控件的 getBoundingClientRect 中心，
 * 点击前先用 `document.elementFromPoint(x,y)` 断言命中的是目标元素或其子节点。
 *
 * 覆盖：
 *  1. 375 宽：tabbar 四项中心点逐个命中并真的切换路由（settings 打开 sheet）。
 *  2. 375 宽 compose：坐标点击「发布」，时间线顶部新增条目且 data-post-count +1。
 *  3. 768/1440：时间线首卡 like 坐标点击计数 +1；reply 坐标点击进入详情。
 *  4. 关闭态：sheet display:none、scrim 不存在、原占位区域命中的是底层内容；
 *     旧「清空本地数据」坐标点击不会清空 localStorage。
 *
 * 运行：先 `pnpm build`，再 `pnpm check:ui`（脚本在 BASE 无服务时会自起一个只读 dist 的静态服务器；RILL_BASE 可改 host:port）。
 * 退出码：0 全 PASS；1 有 FAIL 或运行异常。
 * 冷启动：等待 server 'listening'；settle 最长 30s 且等业务属性；goto 失败自动重试一次并带 URL/端口/readyState 诊断。
 */
import { execFileSync, spawn } from 'node:child_process';
import { once } from 'node:events';
import { accessSync, constants as fsConstants, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { dirname, extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const BASE = process.env.RILL_BASE || 'http://127.0.0.1:4179';
const BASE_URL = new URL(BASE);
const BASE_PORT = BASE_URL.port || (BASE_URL.protocol === 'https:' ? '443' : '80');
const BASE_HOST = BASE_URL.hostname;
if (process.env.CHECK_UI_SKIP === '1') {
  console.log('SKIP check:ui：CHECK_UI_SKIP=1（默认必须跑；CI 不应设置此变量）');
  process.exit(0);
}

// Chrome 探测：显式 CHROME_BIN/CHROME 优先且不回退；未显式指定时按 Linux → macOS 顺序找。
// 显式指定无效时失败而不是偷偷回退，避免 CI 设置了错误路径却跑了另一颗浏览器。
const CHROME_ENV = (process.env.CHROME_BIN || process.env.CHROME || '').trim();
const CHROME_CANDIDATES = [
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
];
function detectChrome() {
  const candidates = CHROME_ENV ? [CHROME_ENV] : CHROME_CANDIDATES;
  const tried = [];
  for (const candidate of candidates) {
    if (!candidate || tried.includes(candidate)) continue;
    tried.push(candidate);
    try {
      accessSync(candidate, fsConstants.X_OK);
      return { path: candidate, tried };
    } catch { /* 继续下一个 */ }
  }
  return { path: null, tried };
}
const chromeInfo = detectChrome();
if (!chromeInfo.path) {
  console.log('FAIL 找不到 Chrome，尝试过：');
  for (const candidate of chromeInfo.tried) console.log(`  - ${candidate}`);
  if (!CHROME_ENV) {
    console.log('  （系统路径未找到；可用 CHROME_BIN=/path/to/chrome 指定）');
  } else {
    console.log(`  （显式 CHROME_BIN/CHROME=${CHROME_ENV} 不可执行，按规则不回退到其他浏览器）`);
  }
  console.log('请安装 Google Chrome/Chromium，或在 CI 设置 CHROME_BIN；仅确认无浏览器时可 CHECK_UI_SKIP=1 跳过。');
  process.exit(1);
}
const CHROME = chromeInfo.path;
function chromeVersion() {
  try {
    return execFileSync(CHROME, ['--version'], { encoding: 'utf8', timeout: 5000 }).trim();
  } catch {
    return 'unknown';
  }
}
const CHROME_VERSION = chromeVersion();
const CDP_PORT_ENV = process.env.RILL_CDP_PORT ? Number(process.env.RILL_CDP_PORT) : null;
const UD = `/tmp/rill-hit-ud-${process.pid}`;
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const STARTED_AT = Date.now();
const TIMEOUT_MS = (() => {
  const value = Number(process.env.CHECK_UI_TIMEOUT_MS || 120000);
  return Number.isFinite(value) && value > 0 ? Math.max(1000, value) : 120000;
})();
const ARTIFACT_DIR = join(ROOT, 'test-results');
let staticServer = null;
let chromeProcess = null;
let activeCdp = null;
let watchdog = null;

const checks = [];
const evidence = { tabs375: [], closed: {}, compose: {}, wide: {} };
function check(name, ok, detail) {
  checks.push({ name, ok, detail });
  if (!ok) console.log(`FAIL ${name} :: ${JSON.stringify(detail)}`);
}
function brief(value, max = 220) {
  try {
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return String(value);
  }
}

if (!existsSync(join(ROOT, 'dist', 'index.html'))) {
  console.log('FAIL dist/index.html 不存在：先运行 pnpm build');
  process.exit(1);
}

/**
 * 无服务时就地起一个极简静态服务器（只读 dist/，不依赖 vite preview）。
 * 之前 spawn `vite preview` 在 DSH 自带 node 下会因 rollup 原生模块签名不匹配崩掉；
 * 静态服务器只用 node:http/fs，任何 node 都能跑，端口/Host 完全跟随 RILL_BASE。
 */
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
};
async function serverUp() {
  try {
    const res = await fetch(`${BASE}/`);
    return res.ok;
  } catch {
    return false;
  }
}
async function ensureServer() {
  if (await serverUp()) return;
  const dist = join(ROOT, 'dist');
  const indexFile = join(dist, 'index.html');
  staticServer = createServer(async (request, response) => {
    const rawPath = decodeURIComponent((request.url || '/').split('?')[0]);
    const relative = normalize(rawPath).replace(/^([/\\]|\.\.)+/, '');
    let filePath = join(dist, relative || 'index.html');
    if (rawPath.endsWith('/')) filePath = join(filePath, 'index.html');
    try {
      const data = await readFile(filePath);
      response.writeHead(200, { 'content-type': MIME[extname(filePath)] || 'application/octet-stream', 'cache-control': 'no-store' });
      response.end(data);
      return;
    } catch {
      // hash 路由不会打到服务器，兜底一律回 index.html
      try {
        const data = await readFile(indexFile);
        response.writeHead(200, { 'content-type': MIME['.html'], 'cache-control': 'no-store' });
        response.end(data);
      } catch {
        response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
        response.end('dist not built');
      }
    }
  });
  // 必须等 'listening' 事件（不是只调 listen）：冷启动时否则可能在建连前就 Page.navigate。
  staticServer.listen(Number(BASE_PORT), BASE_HOST);
  await Promise.race([
    once(staticServer, 'listening'),
    once(staticServer, 'error').then(([error]) => { throw error; }),
  ]);
  for (let i = 0; i < 100; i += 1) {
    await sleep(100);
    if (await serverUp()) return;
  }
  console.log(`FAIL 内置静态服务器未能在 ${BASE_HOST}:${BASE_PORT} 上就绪（url=${BASE}）`);
  process.exit(1);
}

/** 一个极小 CDP 客户端（Node 24 自带 WebSocket / fetch）。 */
async function connectChrome() {
  rmSync(UD, { recursive: true, force: true });
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--hide-scrollbars',
    '--disable-crash-reporter', '--disable-breakpad', '--no-first-run',
    `--user-data-dir=${UD}`, `--remote-debugging-port=${CDP_PORT_ENV ?? 0}`, 'about:blank',
  ], { stdio: 'ignore' });
  chromeProcess = chrome;

  // 默认让 Chrome 自己选调试端口（--remote-debugging-port=0 + DevToolsActivePort），
  // 避免与并行运行的另一个 check-hit / verifier 抢固定 9337。显式 RILL_CDP_PORT 时仍尊重它。
  let cdpPort = CDP_PORT_ENV;
  if (cdpPort === null) {
    const portFile = join(UD, 'DevToolsActivePort');
    for (let i = 0; i < 300 && cdpPort === null; i += 1) {
      try {
        const firstLine = readFileSync(portFile, 'utf8').split('\n')[0].trim();
        const parsed = Number(firstLine);
        if (Number.isFinite(parsed) && parsed > 0) cdpPort = parsed;
      } catch { /* Chrome 还在建 profile */ }
      if (cdpPort === null) await sleep(100);
    }
  }
  if (cdpPort === null) {
    chrome.kill('SIGTERM');
    rmSync(UD, { recursive: true, force: true });
    console.log(`FAIL Chrome 未写出 DevToolsActivePort（profile=${UD}）；检查 Chrome 是否可启动`);
    process.exit(1);
  }

  let wsUrl = null;
  for (let i = 0; i < 300 && !wsUrl; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${cdpPort}/json/list`)).json();
      const page = list.find((target) => target.type === 'page');
      if (page) wsUrl = page.webSocketDebuggerUrl;
    } catch { /* Chrome 还在启动 */ }
    await sleep(100);
  }
  if (!wsUrl) {
    chrome.kill('SIGTERM');
    rmSync(UD, { recursive: true, force: true });
    console.log(`FAIL Chrome CDP 未能就绪（port=${cdpPort}，profile=${UD}）；检查是否有残留 Chrome/端口占用`);
    process.exit(1);
  }

  const ws = new WebSocket(wsUrl);
  try {
    await new Promise((resolve, reject) => {
      ws.addEventListener('open', resolve, { once: true });
      ws.addEventListener('error', reject, { once: true });
    });
  } catch (error) {
    chrome.kill('SIGTERM');
    rmSync(UD, { recursive: true, force: true });
    console.log(`FAIL WebSocket 连接 CDP 失败（${wsUrl}）：${error && error.message ? error.message : error}`);
    process.exit(1);
  }
  let seq = 0;
  const pending = new Map();
  ws.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    const entry = message.id ? pending.get(message.id) : undefined;
    if (!entry) return;
    pending.delete(message.id);
    if (message.error) entry.reject(new Error(message.error.message));
    else entry.resolve(message.result);
  });
  const send = (method, params = {}) => {
    seq += 1;
    const id = seq;
    ws.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  };
  const evaluate = async (expression) => {
    const out = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (out.exceptionDetails) throw new Error(out.exceptionDetails.text + ' :: ' + expression);
    return out.result.value;
  };
  return { chrome, ws, send, evaluate, cdpPort };
}

armWatchdog();
await ensureServer();
const cdp = await connectChrome();
activeCdp = cdp;
console.log(`check:ui base=${BASE} chrome=${CHROME} (${CHROME_VERSION}) cdp=${cdp.cdpPort} timeout=${TIMEOUT_MS}ms`);
const { send, evaluate } = cdp;

await send('Page.enable');
await send('Runtime.enable');

let nav = 0;
async function setViewport(width, height) {
  await send('Emulation.setDeviceMetricsOverride', {
    width, height, deviceScaleFactor: 1, mobile: width < 768,
  });
}
function cleanupProcesses() {
  try {
    if (chromeProcess && !chromeProcess.killed) chromeProcess.kill('SIGTERM');
  } catch { /* 忽略 */ }
  try {
    if (staticServer) staticServer.close();
  } catch { /* 忽略 */ }
}
function removeProfile() {
  try {
    rmSync(UD, { recursive: true, force: true });
  } catch { /* 忽略 */ }
}

function armWatchdog() {
  watchdog = setTimeout(async () => {
    console.log(`FAIL check:ui 超时（>${TIMEOUT_MS}ms） chrome=${CHROME} version=${CHROME_VERSION} base=${BASE}`);
    cleanupProcesses();
    await sleep(500);
    removeProfile();
    process.exit(1);
  }, TIMEOUT_MS);
  watchdog.unref();
}

function writeArtifact(name, content) {
  try {
    mkdirSync(ARTIFACT_DIR, { recursive: true });
    writeFileSync(join(ARTIFACT_DIR, name), content);
  } catch { /* artifact 失败不影响判定 */ }
}

async function captureFailureArtifacts(label) {
  if (!activeCdp) return;
  try {
    const shot = await Promise.race([
      activeCdp.send('Page.captureScreenshot', { format: 'png' }),
      sleep(5000).then(() => null),
    ]);
    if (shot && shot.data) writeArtifact('check-hit-failure.png', Buffer.from(shot.data, 'base64'));
  } catch { /* 页面可能已崩 */ }
  try {
    const diagnostics = await pageDiagnostics();
    writeArtifact('check-hit-failure.json', JSON.stringify({
      label, base: BASE, chrome: CHROME, chromeVersion: CHROME_VERSION, diagnostics, checks,
    }, null, 2));
  } catch { /* 忽略 */ }
}

const SETTLE_MS = 30000;
async function pageDiagnostics() {
  try {
    return JSON.parse(await evaluate(`(() => {
      const app = document.getElementById('app');
      const timing = performance.timing;
      return JSON.stringify({
        url: location.href,
        readyState: document.readyState,
        appExists: !!app,
        route: app ? app.getAttribute('data-route') : null,
        postCount: app ? app.getAttribute('data-post-count') : null,
        scriptSrc: [...document.scripts].map((script) => script.src || '(inline)'),
        resourceCount: performance.getEntriesByType('resource').length,
        timing: timing ? {
          domLoading: timing.domLoading,
          domInteractive: timing.domInteractive,
          domComplete: timing.domComplete,
          loadEventEnd: timing.loadEventEnd,
        } : null,
      });
    })()`));
  } catch (error) {
    return { diagnosticsError: String(error && error.message ? error.message : error) };
  }
}
/** 业务就绪：外壳 + React 已挂载（#app 有 data-route / data-post-count）+ tabbar 已渲染。 */
async function settle(url) {
  const deadline = Date.now() + SETTLE_MS;
  let last = null;
  while (Date.now() < deadline) {
    await sleep(120);
    try {
      const ready = JSON.parse(await evaluate(`(() => {
        const app = document.getElementById('app');
        return JSON.stringify({
          readyState: document.readyState,
          app: !!app,
          route: app ? app.getAttribute('data-route') : null,
          postCount: app ? app.getAttribute('data-post-count') : null,
          tabbar: !!document.querySelector('[data-testid="tab-timeline"]'),
        });
      })()`));
      last = ready;
      if (ready.readyState === 'complete' && ready.app && ready.route && ready.postCount !== null && ready.tabbar) {
        await sleep(250);
        return;
      }
    } catch (error) {
      last = { evaluateError: String(error && error.message ? error.message : error) };
    }
  }
  const diag = await pageDiagnostics();
  const current = diag.url || url;
  throw new Error(`页面没有就绪（${SETTLE_MS}ms） url=${current} base=${BASE} port=${BASE_PORT} diag=${JSON.stringify({ last, ...diag })}`);
}
async function navigateAndSettle(url) {
  const result = await send('Page.navigate', { url });
  if (result && result.errorText) {
    throw new Error(`Page.navigate 失败：${result.errorText} url=${url}`);
  }
  await settle(url);
}
async function gotoOnce(hash, clear) {
  if (clear) {
    await navigateAndSettle(`${BASE}/?nav=${++nav}#/timeline`);
    await evaluate('localStorage.clear(); true');
  }
  await navigateAndSettle(`${BASE}/?nav=${++nav}${hash}`);
}
async function goto(hash, width = 375, height = 812, { clear = false } = {}) {
  await setViewport(width, height);
  let firstError = null;
  try {
    await gotoOnce(hash, clear);
    return;
  } catch (error) {
    firstError = error;
    console.log(`WARN goto 第一次未就绪，1.2s 后重试一次：${firstError.message}`);
  }
  await sleep(1200);
  try {
    await gotoOnce(hash, clear);
  } catch (secondError) {
    throw new Error(`goto 两次失败：first=${firstError.message} | second=${secondError.message}`);
  }
}
const snap = async (expression) => JSON.parse(await evaluate(`JSON.stringify(${expression})`));
const rectOf = (selector) => snap(`(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return null; const r = el.getBoundingClientRect(); return { x: +r.x.toFixed(2), y: +r.y.toFixed(2), w: +r.width.toFixed(2), h: +r.height.toFixed(2), cx: +(r.x + r.width / 2).toFixed(2), cy: +(r.y + r.height / 2).toFixed(2) }; })()`);
const hitAt = (x, y) => snap(`(() => { const el = document.elementFromPoint(${x}, ${y}); if (!el) return null; const withId = el.closest('[data-testid]'); const btn = el.closest('button,[role="button"],a'); const tab = el.closest('[data-testid^="tab-"]'); return { tag: el.tagName, testid: withId ? withId.getAttribute('data-testid') : null, text: (el.textContent || '').trim().slice(0, 24), inSheet: !!el.closest('.sheet'), tab: tab ? tab.getAttribute('data-testid') : null, control: btn ? (btn.getAttribute('data-testid') || btn.getAttribute('aria-label') || (btn.textContent || '').trim().slice(0, 12)) : null }; })()`);
const hitsTarget = (selector, x, y) => evaluate(`(() => { const el = document.elementFromPoint(${x}, ${y}); const target = document.querySelector(${JSON.stringify(selector)}); return !!el && !!target && (el === target || target.contains(el)); })()`);
async function clickAt(x, y) {
  await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
  await sleep(340);
}
async function clickSelector(selector) {
  const rect = await rectOf(selector);
  if (!rect) throw new Error(`找不到元素 ${selector}`);
  const hit = await hitAt(rect.cx, rect.cy);
  const within = await hitsTarget(selector, rect.cx, rect.cy);
  await clickAt(rect.cx, rect.cy);
  return { rect, hit, within };
}
const appState = () => snap(`(() => { const app = document.getElementById('app'); return { route: app.dataset.route, tab: app.dataset.activeTab, postCount: app.dataset.postCount, theme: app.dataset.theme, dialog: !!document.querySelector('[data-testid="dialog-settings"][open]'), sheetDisplay: getComputedStyle(document.querySelector('[data-testid="dialog-settings"]')).display, scrim: !!document.querySelector('[data-testid="settings-scrim"]'), firstCard: document.querySelector('[data-testid="post-card"]')?.getAttribute('data-post-id') ?? null, firstText: document.querySelector('[data-testid="post-card"] [data-testid="post-text"]')?.textContent?.slice(0, 30) ?? null, likeCount: document.querySelector('[data-testid="post-card"] [data-testid="like-count"]')?.textContent ?? null, likePressed: document.querySelector('[data-testid="post-card"] [data-testid="like-btn"]')?.getAttribute('aria-pressed') ?? null }; })()`);

try {
  // ---------- 1. 375 宽 tabbar 四项坐标点击 ----------
  await goto('#/timeline', 375, 812, { clear: true });
  const tabOrder = ['tab-timeline', 'tab-compose', 'tab-me', 'tab-timeline', 'tab-settings'];
  const expectedRoute = { 'tab-timeline': 'timeline', 'tab-compose': 'compose', 'tab-me': 'me' };
  for (const tab of tabOrder) {
    const selector = `[data-testid="${tab}"]`;
    const { rect, hit, within } = await clickSelector(selector);
    const state = await appState();
    const entry = {
      tab,
      rect,
      hit,
      within,
      after: { route: state.route, tab: state.tab, dialog: state.dialog },
    };
    evidence.tabs375.push(entry);
    check(`375 ${tab} 命中测试`, within && hit && (hit.tab === tab || hit.testid === tab), entry);
    if (tab === 'tab-settings') {
      check('375 tab-settings 打开 sheet', state.dialog === true && state.tab === 'settings', state);
      check('375 打开态 scrim 存在', state.scrim === true, state);
    } else {
      check(`375 ${tab} 真的切换路由`, state.route === expectedRoute[tab], state);
    }
  }

  // 关闭 sheet（坐标点关闭按钮），随后验证关闭态
  const closeHit = await clickSelector('[data-testid="settings-close"]');
  let state = await appState();
  check('375 关闭按钮命中并关闭', closeHit.within && state.dialog === false, { closeHit, state });
  check('375 关闭态 sheet display:none', state.sheetDisplay === 'none', state);
  check('375 关闭态 scrim 不存在', state.scrim === false, state);

  // ---------- 2. 关闭态：原 sheet 区域命中底层内容 + 清空数据按钮失效 ----------
  await goto('#/timeline', 375, 812, { clear: true });
  const closedState = await appState();
  const sheetRectClosed = await rectOf('[data-testid="dialog-settings"]');
  const bottomHit = await hitAt(187, 700);
  await clickAt(187, 700);
  const afterBottom = await appState();
  evidence.closed = { closedState, sheetRectClosed, bottomHit, afterBottom };
  check('关闭态 sheet 无尺寸', !sheetRectClosed || sheetRectClosed.w === 0 || sheetRectClosed.h === 0, sheetRectClosed);
  check('关闭态 y=700 不命中 sheet', bottomHit && bottomHit.inSheet === false, bottomHit);
  check('关闭态 y=700 点击不打开设置（命中底层内容可正常响应）', afterBottom.dialog === false && afterBottom.sheetDisplay === 'none', afterBottom);

  // 打开设置 → 记录「清空本地数据」坐标 → 关闭 → 点击旧坐标，数据必须还在
  await clickSelector('[data-testid="tab-settings"]');
  state = await appState();
  check('重新打开 sheet 有 open', state.dialog === true && state.sheetDisplay === 'block', state);
  const resetRect = await rectOf('[data-testid="reset-btn"]');
  const resetHit = await hitAt(resetRect.cx, resetRect.cy);
  const resetWithin = await hitsTarget('[data-testid="reset-btn"]', resetRect.cx, resetRect.cy);
  check('打开态 reset 按钮可命中', resetWithin && resetHit && resetHit.testid === 'reset-btn', { resetRect, resetHit });
  await evaluate(`localStorage.setItem('rill:v1:__hit_probe__', '1'); true`);
  const keysBefore = await snap(`Object.keys(localStorage).filter((key) => key.startsWith('rill:v1:')).sort()`);
  await clickSelector('[data-testid="settings-close"]');
  state = await appState();
  check('关闭后再次 display:none', state.dialog === false && state.sheetDisplay === 'none', state);
  const resetHitClosed = await hitAt(resetRect.cx, resetRect.cy);
  await clickAt(resetRect.cx, resetRect.cy);
  const keysAfter = await snap(`Object.keys(localStorage).filter((key) => key.startsWith('rill:v1:')).sort()`);
  const confirmAfter = await evaluate(`!!document.querySelector('[data-testid="reset-confirm"]')`);
  state = await appState();
  evidence.closed.reset = { resetRect, resetHit, resetHitClosed, keysBefore, keysAfter, confirmAfter, afterResetClick: state };
  check('关闭态旧 reset 坐标命中底层而非 sheet', resetHitClosed && resetHitClosed.inSheet === false, resetHitClosed);
  check('关闭态旧 reset 坐标点击未激活确认清空', confirmAfter === false, { confirmAfter, resetHitClosed });
  check('关闭态旧 reset 坐标点击不清空数据', keysAfter.includes('rill:v1:__hit_probe__') && keysAfter.length === keysBefore.length, { keysBefore, keysAfter });
  check('关闭态旧 reset 坐标点击不打开设置', state.dialog === false && state.sheetDisplay === 'none', state);

  // ---------- 3. 长文折叠基线（t29 永久守门，独立计数） ----------
  // A/final-spec.md §9：折叠态 6 行且可展开；展开态解除截断；详情页不折叠。
  await goto('#/timeline', 375, 812, { clear: true });
  await evaluate(`document.querySelector('[data-post-id="p_0007"]')?.scrollIntoView({ block: 'center' }); true`);
  await sleep(250);
  const longFold = await snap(`(() => {
    const card = document.querySelector('[data-post-id="p_0007"]');
    const text = card?.querySelector('[data-testid="post-text"]');
    const button = card?.querySelector('[data-testid="expand-text"]');
    if (!card || !text || !button) return null;
    const cs = getComputedStyle(text);
    return {
      clamped: text.getAttribute('data-clamped'),
      expanded: card.getAttribute('data-expanded'),
      clientHeight: text.clientHeight,
      scrollHeight: text.scrollHeight,
      lineHeight: parseFloat(cs.lineHeight),
      textLength: text.textContent.length,
      buttonText: (button.textContent || '').trim(),
    };
  })()`);
  const foldedOk = !!longFold && longFold.clamped === '6' && longFold.lineHeight > 0
    && longFold.clientHeight === 6 * longFold.lineHeight && longFold.scrollHeight > longFold.clientHeight;
  check('375 p_0007 折叠态为 6 行（scrollHeight > clientHeight）', foldedOk, longFold);
  check('375 p_0007 折叠态有「展开全文」按钮', !!longFold && longFold.buttonText === '展开全文', longFold);

  const expandClick = await clickSelector('[data-post-id="p_0007"] [data-testid="expand-text"]');
  await sleep(350);
  const longExpanded = await snap(`(() => {
    const card = document.querySelector('[data-post-id="p_0007"]');
    const text = card?.querySelector('[data-testid="post-text"]');
    if (!card || !text) return null;
    return {
      expanded: card.getAttribute('data-expanded'),
      clientHeight: text.clientHeight,
      scrollHeight: text.scrollHeight,
      textLength: text.textContent.length,
    };
  })()`);
  const expandedOk = !!longExpanded && longExpanded.expanded === 'true'
    && longExpanded.scrollHeight === longExpanded.clientHeight;
  evidence.clamp = { longFold, expandClick, longExpanded };
  check('375 p_0007 展开后 data-expanded=true 且解除截断', expandedOk, { longFold, expandClick, longExpanded });

  await goto('#/status/p_0007', 375, 812, { clear: true });
  const detailFold = await snap(`(() => ({
    root: !!document.querySelector('[data-testid="detail-root"][data-status-id="p_0007"]'),
    text: document.querySelector('[data-testid="detail-text"]')?.textContent?.length ?? 0,
    clampedCount: document.querySelectorAll('[data-clamped]').length,
  }))()`);
  check('375 详情页 p_0007 不折叠（[data-clamped] 计数 0）', detailFold.root && detailFold.text > 0 && detailFold.clampedCount === 0, detailFold);

  // ---------- 4. 375 compose 坐标点击发布 ----------
  await goto('#/compose', 375, 812, { clear: true });
  const inputRect = await rectOf('[data-testid="compose-input"]');
  const inputHit = await hitAt(inputRect.cx, inputRect.cy);
  const inputWithin = await hitsTarget('[data-testid="compose-input"]', inputRect.cx, inputRect.cy);
  await clickAt(inputRect.cx, inputRect.cy);
  const typed = '坐标点击发布测试';
  await send('Input.insertText', { text: typed });
  await sleep(300);
  const composed = await snap(`(() => ({ text: document.getElementById('app').dataset.composeText, count: document.querySelector('[data-testid="compose-count"]')?.textContent, disabled: document.querySelector('[data-testid="publish-btn"]')?.disabled }))()`);
  check('375 compose 输入框坐标聚焦 + 文本进入受控组件', inputWithin && inputHit && composed.text === typed, { inputRect, inputHit, composed });
  check('375 compose 发布按钮可用', composed.disabled === false && composed.count === `${typed.length}/500`, composed);
  const publishRect = await rectOf('[data-testid="publish-btn"]');
  const publishHit = await hitAt(publishRect.cx, publishRect.cy);
  const publishWithin = await hitsTarget('[data-testid="publish-btn"]', publishRect.cx, publishRect.cy);
  await clickAt(publishRect.cx, publishRect.cy);
  await sleep(500);
  const afterPublish = await appState();
  evidence.compose = { inputRect, inputHit, publishRect, publishHit, afterPublish };
  check('375 发布按钮命中测试', publishWithin && publishHit && publishHit.testid === 'publish-btn', { publishRect, publishHit });
  check('375 坐标发布后回时间线、首卡新条目、post-count=21', afterPublish.route === 'timeline' && afterPublish.postCount === '21' && afterPublish.firstCard === 'p_new_1', afterPublish);
  check('375 坐标发布内容在首卡', (afterPublish.firstText || '').startsWith(typed), afterPublish);

  // ---------- 4. 768 / 1440：卡片 like/reply 坐标点击 ----------
  for (const [width, height] of [[768, 900], [1440, 900]]) {
    await goto('#/timeline', width, height, { clear: true });
    const base = await appState();
    const likeRect = await rectOf('[data-testid="post-card"] [data-testid="like-btn"]');
    const likeHit = await hitAt(likeRect.cx, likeRect.cy);
    const likeWithin = await hitsTarget('[data-testid="post-card"] [data-testid="like-btn"]', likeRect.cx, likeRect.cy);
    await clickAt(likeRect.cx, likeRect.cy);
    const liked = await appState();
    const sheetDisplay = await evaluate(`getComputedStyle(document.querySelector('[data-testid="dialog-settings"]')).display`);
    const centerHit = await hitAt(Math.round(width / 2), 450);
    evidence.wide[width] = { base, likeRect, likeHit, liked, sheetDisplay, centerHit };
    check(`${width} like 坐标命中且计数 +1`, likeWithin && Number(liked.likeCount) === Number(base.likeCount) + 1 && liked.likePressed === 'true', { likeRect, likeHit, base, liked });
    check(`${width} 关闭态 sheet 为 none 且中央不命中 sheet`, sheetDisplay === 'none' && centerHit && centerHit.inSheet === false, { sheetDisplay, centerHit });

    const replyRect = await rectOf('[data-testid="post-card"] [data-testid="reply-btn"]');
    const replyHit = await hitAt(replyRect.cx, replyRect.cy);
    const replyWithin = await hitsTarget('[data-testid="post-card"] [data-testid="reply-btn"]', replyRect.cx, replyRect.cy);
    await clickAt(replyRect.cx, replyRect.cy);
    const afterReply = await appState();
    evidence.wide[width].reply = { replyRect, replyHit, afterReply };
    check(`${width} reply 坐标命中并进入详情`, replyWithin && replyHit && afterReply.route === 'status', { replyRect, replyHit, afterReply });
  }
  if (checks.some((entry) => !entry.ok)) await captureFailureArtifacts('assertion-failure');
} catch (error) {
  await captureFailureArtifacts('exception');
  const diagnostics = await pageDiagnostics();
  check('脚本无异常', false, {
    error: String(error && error.stack ? error.stack : error),
    base: BASE,
    port: BASE_PORT,
    diagnostics,
  });
  console.log(`FAIL 运行异常 url=${diagnostics.url ?? '?'} base=${BASE} port=${BASE_PORT} readyState=${diagnostics.readyState ?? '?'}`);
} finally {
  clearTimeout(watchdog);
  cdp.ws.close();
  cleanupProcesses();
  await sleep(500);
  removeProfile();
}

const failed = checks.filter((entry) => !entry.ok);
const passed = checks.length - failed.length;
console.log(`\n===== check:ui PASS ${passed} / FAIL ${failed.length} =====`);
console.log(`elapsed=${Date.now() - STARTED_AT}ms base=${BASE}`);
for (const entry of checks) {
  console.log(`${entry.ok ? 'PASS' : 'FAIL'} ${entry.name} :: ${brief(entry.detail)}`);
}
console.log('EVIDENCE ' + JSON.stringify(evidence));
if (failed.length) {
  console.log(failed.map((entry) => entry.name).join('\n'));
  process.exitCode = 1;
} else {
  console.log('ALL PASS');
}