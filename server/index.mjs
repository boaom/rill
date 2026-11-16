// server/index.mjs —— Rill 的零依赖 HTTP 服务：API + 生产静态 dist。
// 依赖只有 node:http / node:sqlite / node:crypto；不引入任何 npm 包。
import { readFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { loadSecret } from './crypto.mjs';
import { openDb, Store } from './db.mjs';
import {
  HttpError,
  TokenBucket,
  isMutating,
  originMatchesHost,
  parseCookies,
  sendJson,
} from './http.mjs';
import { handleConfig, handleHealth, handleProvider } from './routes/health.mjs';
import {
  CSRF_HEADER,
  SESSION_COOKIE,
  handleSessionCookie,
  handleSessionDelete,
  handleSessionGet,
  modeFor,
} from './routes/session.mjs';
import { serveStatic } from './routes/static.mjs';
import { handleFeed } from './routes/feed.mjs';
import { handleWrite } from './routes/write.mjs';
import { MockProvider } from './providers/mock.mjs';
import { WeiboProvider } from './providers/weibo.mjs';
import { safeEqual } from './crypto.mjs';

const DIST = fileURLToPath(new URL('../dist', import.meta.url));
const PACKAGE = JSON.parse(
  readFileSync(fileURLToPath(new URL('../package.json', import.meta.url)), 'utf8'),
);

const PORT = Number(process.env.RILL_PORT || 8787);
const HOST = process.env.RILL_HOST || '127.0.0.1';
const NODE_ENV = process.env.NODE_ENV || 'development';
const PROVIDER_NAME = process.env.RILL_PROVIDER || 'mock';
if (PROVIDER_NAME !== 'mock' && PROVIDER_NAME !== 'weibo') {
  console.error(`[rill] RILL_PROVIDER 只能是 mock 或 weibo，收到：${PROVIDER_NAME}`);
  process.exit(1);
}

const major = Number(process.versions.node.split('.')[0]);
if (major < 26) {
  console.warn(`[rill] 当前 Node ${process.versions.node}；node:sqlite 的稳定用法建议 Node 26+（Dockerfile 用 node:26-alpine）。`);
}

let secret;
try {
  secret = loadSecret();
} catch (error) {
  console.error(`[rill] ${error.message}`);
  process.exit(1);
}

const db = openDb();
const store = new Store(db);
const mockProvider = new MockProvider();
const weiboProvider = new WeiboProvider();
const providers = { mock: mockProvider, weibo: weiboProvider };
const provider = providers[PROVIDER_NAME];
const mode = modeFor(PROVIDER_NAME);
const loginLimiter = new TokenBucket(5, 60_000);

const ctx = {
  version: PACKAGE.version,
  providerName: PROVIDER_NAME,
  provider,
  providers,
  WeiboProvider,
  mode,
  nodeEnv: NODE_ENV,
  secret,
  store,
  loginLimiter,
  log(event, fields = {}) {
    // 安全日志：白名单字段；cookies 只保留 name/length，绝不打印请求体或 cookie 值。
    const safe = {};
    for (const [key, value] of Object.entries(fields)) {
      if (key === 'cookies') {
        safe.cookies = Array.isArray(value)
          ? value.map((cookie) => ({
              name: String(cookie && cookie.name ? cookie.name : '?'),
              length: Number.isFinite(cookie && cookie.length) ? cookie.length : 0,
            }))
          : [];
      } else if (['provider', 'mode', 'sid', 'error'].includes(key)) {
        safe[key] = value;
      }
    }
    console.log(`[rill] ${event} ${JSON.stringify(safe)}`);
  },
};

function allowMutation(req, pathname, cookies) {
  if (!isMutating(req.method)) return true;
  const origin = req.headers.origin;
  const sid = cookies[SESSION_COOKIE];
  const token = sid ? store.getKv(`csrf:${sid}`) : null;
  const header = req.headers[CSRF_HEADER];
  if (originMatchesHost(req, origin)) return true;
  if (token && safeEqual(String(header || ''), token)) return true;
  // cookie 登录的 bootstrap：没有会话、也没有 Origin 时放行；带了不匹配 Origin 仍拒绝。
  return pathname === '/api/session/cookie' && !sid && !origin;
}

async function handleApi(req, res, url, cookies) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  if (!allowMutation(req, pathname, cookies)) {
    sendJson(res, 403, { error: 'csrf_origin_mismatch' });
    return;
  }

  if (pathname === '/api/health') {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
    handleHealth(ctx, res);
    return;
  }
  if (pathname === '/api/config') {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
    handleConfig(ctx, res);
    return;
  }
  if (pathname === '/api/provider') {
    if (req.method !== 'GET') return sendJson(res, 405, { error: 'method_not_allowed' });
    handleProvider(ctx, res);
    return;
  }
  if (pathname === '/api/session/cookie') {
    if (req.method !== 'POST') return sendJson(res, 405, { error: 'method_not_allowed' });
    await handleSessionCookie(req, res, ctx);
    return;
  }
  if (await handleWrite(req, res, url, ctx)) return;
  if (await handleFeed(req, res, url, ctx)) return;
  if (pathname === '/api/session') {
    if (req.method === 'GET') {
      await handleSessionGet(req, res, ctx);
      return;
    }
    if (req.method === 'DELETE') {
      await handleSessionDelete(req, res, ctx);
      return;
    }
    return sendJson(res, 405, { error: 'method_not_allowed' });
  }
  sendJson(res, 404, { error: 'not_found' });
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || `${HOST}:${PORT}`}`);
    const cookies = parseCookies(req);
    if (url.pathname.startsWith('/api/')) {
      await handleApi(req, res, url, cookies);
      return;
    }
    await serveStatic(req, res, DIST);
  } catch (error) {
    if (error instanceof HttpError) {
      sendJson(res, error.status, { error: error.code });
      return;
    }
    console.error(`[rill] request error ${req.method} ${(req.url || '').split('?')[0]}: ${error && error.message ? error.message : error}`);
    if (!res.headersSent) sendJson(res, 500, { error: 'internal_error' });
    else res.end();
  }
});

server.listen(PORT, HOST, () => {
  console.log(`[rill] listening on http://${HOST}:${PORT} provider=${PROVIDER_NAME} mode=${mode} node=${process.versions.node}`);
  console.log(`[rill] db=${process.env.RILL_DB || 'data/rill.sqlite'} static=${DIST}`);
});

server.on('error', (error) => {
  console.error(`[rill] server error: ${error.message}`);
  process.exitCode = 1;
});

function shutdown(signal) {
  console.log(`[rill] ${signal} shutdown`);
  server.close(() => {
    store.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));