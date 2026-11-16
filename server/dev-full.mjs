// server/dev-full.mjs —— 同时起 Vite 与 API server，不引入 concurrently 等依赖。
// 用法：RILL_SECRET=... pnpm run dev:full（Vite 页面 + /api 代理到 8787）。
import { spawn } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const viteBin = join(ROOT, 'node_modules', 'vite', 'bin', 'vite.js');
const children = [
  spawn(process.execPath, [viteBin], { cwd: ROOT, stdio: 'inherit' }),
  spawn(process.execPath, [join(ROOT, 'server', 'index.mjs')], {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  }),
];

let closing = false;
function close(code = 0) {
  if (closing) return;
  closing = true;
  for (const child of children) {
    if (!child.killed) child.kill('SIGTERM');
  }
  setTimeout(() => process.exit(code), 500).unref();
}

for (const child of children) {
  child.on('exit', (code) => {
    if (!closing && code !== 0) {
      console.error(`[dev:full] child exited ${code}`);
      close(code || 1);
    }
  });
  child.on('error', (error) => {
    console.error(`[dev:full] ${error.message}`);
    close(1);
  });
}

process.on('SIGINT', () => close(0));
process.on('SIGTERM', () => close(0));
console.log('[dev:full] Vite + API server 启动（/api → http://127.0.0.1:8787）');