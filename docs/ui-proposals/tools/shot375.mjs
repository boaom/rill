import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = Number(process.env.CDP_PORT || 9333);
const url = process.argv[2];
const out = process.argv[3] || '/tmp/scout-cdp/shot.png';
const width = Number(process.argv[4] || 375), height = Number(process.argv[5] || 812);
// 与 tools/probe.mjs 统一口径：dsf 可传（--dsf=1|2|3，缺省 1），PNG 宽度恒等于 width
const dsfArg = process.argv.slice(6).find(a => a.startsWith('--dsf='));
const DSF = Math.max(1, Math.min(3, Number((dsfArg || '--dsf=1').split('=')[1]) || 1));
const child = spawn(CHROME, ['--headless=new', `--remote-debugging-port=${PORT}`, '--no-sandbox',
  `--user-data-dir=${path.join(os.tmpdir(), `rill-cdp-${process.pid}`)}`, '--hide-scrollbars', '--force-device-scale-factor=1', 'about:blank'],
  { stdio: 'ignore', detached: false });
const sleep = ms => new Promise(r => setTimeout(r, ms));
let ver;
for (let i = 0; i < 40; i++) {
  try { ver = await (await fetch(`http://127.0.0.1:${PORT}/json/version`)).json(); break; } catch { await sleep(150); }
}
if (!ver) { console.error('CDP_UP_FAIL'); child.kill(); process.exit(2); }
const ws = new WebSocket(ver.webSocketDebuggerUrl);
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let id = 0; const pend = new Map();
ws.onmessage = ev => { const m = JSON.parse(ev.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); } };
const send = (method, params = {}, sessionId) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params, sessionId })); });
const t = await send('Target.createTarget', { url: 'about:blank' });
const s = await send('Target.attachToTarget', { targetId: t.result.targetId, flatten: true });
const sid = s.result.sessionId;
await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: DSF, mobile: true }, sid);
await send('Page.enable', {}, sid);
await send('Page.navigate', { url }, sid);
await sleep(1400);
const cap = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sid);
if (!cap.result) { console.error('CAP_FAIL', JSON.stringify(cap).slice(0, 300)); }
else { fs.writeFileSync(out, Buffer.from(cap.result.data, 'base64')); const png = fs.readFileSync(out); const pngW = png.readUInt32BE(16), pngH = png.readUInt32BE(20);
if (pngW !== width * DSF) { console.error('WIDTH_MISMATCH', pngW, '!=', width * DSF); process.exit(3); }
console.log('OK', out, fs.statSync(out).size, 'bytes', `IHDR ${pngW}x${pngH}`, `dsf=${DSF}`); }
ws.close(); child.kill();
