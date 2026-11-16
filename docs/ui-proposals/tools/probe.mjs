// probe.mjs —— 无 playwright 情况下的截图 + 页面度量（Chrome CDP，Node 内置 WebSocket）
// 用法：
//   node probe.mjs <url> <out.png> <width> <height> [--dsf=1] [--mobile] [--report=out.json] [--expr=measure.expr.js] [--full]
// 说明：宽度必须走 Emulation.setDeviceMetricsOverride —— `--window-size=375` 实测 innerWidth 被钳到 500。
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const [url, out, wArg, hArg, ...rest] = process.argv.slice(2);
if (!url || !out) { console.error('usage: probe.mjs <url> <out.png> <width> <height> [flags]'); process.exit(2); }
const width = Number(wArg || 375), height = Number(hArg || 812);
const flags = new Map(rest.map(a => { const [k, v] = a.replace(/^--/, '').split('='); return [k, v === undefined ? true : v]; }));
const dsf = Number(flags.get('dsf') || 1);
const mobile = flags.has('mobile');
const full = flags.has('full');
const reportPath = flags.get('report') || null;
const exprPath = flags.get('expr') || path.join(path.dirname(new URL(import.meta.url).pathname), 'measure.expr.js');
const PORT = Number(process.env.CDP_PORT || 9444 + (process.pid % 200));

const child = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox', '--disable-gpu',
  `--user-data-dir=${path.join(os.tmpdir(), `probe-${process.pid}`)}`, '--hide-scrollbars',
  '--disable-crash-reporter', '--disable-breakpad', '--no-first-run', `--force-device-scale-factor=${dsf}`, 'about:blank'],
  { stdio: 'ignore' });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver = null;
for (let i = 0; i < 60; i++) { try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(120); } }
if (!ver) { console.error('CDP_UP_FAIL'); child.kill(); process.exit(2); }

const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });

const t = await send('Target.createTarget', { url: 'about:blank' });
const s = await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
const sid = s.result.sessionId;
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: dsf, mobile }, sid);
await send('Page.enable', {}, sid);
await send('Runtime.enable', {}, sid);
await send('Page.navigate', { url }, sid);
await sleep(1200);

if (reportPath && fs.existsSync(exprPath)) {
  const expr = fs.readFileSync(exprPath, 'utf8');
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true }, sid);
  if (r.result && r.result.result && r.result.result.value !== undefined) {
    fs.writeFileSync(reportPath, JSON.stringify(r.result.result.value, null, 1));
    console.log('REPORT', reportPath, fs.statSync(reportPath).size, 'bytes');
  } else {
    console.error('EVAL_FAIL', JSON.stringify(r).slice(0, 400));
  }
}

const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!full }, sid);
if (!cap.result) { console.error('CAP_FAIL', JSON.stringify(cap).slice(0, 300)); }
else {
  fs.writeFileSync(out, Buffer.from(cap.result.data, 'base64'));
  console.log('SHOT', out, fs.statSync(out).size, 'bytes', `${width}x${height}`, `dsf=${dsf}`);
}
ws.close(); child.kill();