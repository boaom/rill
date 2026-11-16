// server/routes/static.mjs —— 生产模式同源静态服务 dist/（开发时由 Vite 提供页面）。
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { sendEmpty, sendJson } from '../http.mjs';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

function resolveInside(root, relative) {
  const clean = normalize(relative).replace(/^([/\\]|\.\.)+/, '');
  const file = join(root, clean);
  if (file !== root && !file.startsWith(root + sep)) return null;
  return file;
}

export async function serveStatic(req, res, root) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    sendJson(res, 405, { error: 'method_not_allowed' });
    return;
  }
  let rawPath;
  try {
    rawPath = decodeURIComponent((req.url || '/').split('?')[0]);
  } catch {
    // 畸形 percent-encoding 是客户端错误；不能让它冒泡成 500，也不能回退 SPA。
    sendEmpty(res, 400);
    return;
  }
  const relative = rawPath === '/' ? 'index.html' : rawPath.replace(/^\/+/, '');
  let file = resolveInside(root, relative);
  try {
    if (file) {
      const info = await stat(file);
      if (info.isDirectory()) file = join(file, 'index.html');
    }
  } catch {
    file = null;
  }
  if (!file) file = join(root, 'index.html');

  try {
    const info = await stat(file);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(file);
    const ext = extname(file);
    const cache = ext === '.html' ? 'no-store' : 'public, max-age=31536000, immutable';
    res.writeHead(200, {
      'content-type': MIME[ext] || 'application/octet-stream',
      'content-length': body.length,
      'cache-control': cache,
      'x-content-type-options': 'nosniff',
    });
    if (req.method === 'HEAD') res.end();
    else res.end(body);
  } catch {
    sendEmpty(res, 404);
  }
}