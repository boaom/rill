// server/routes/session.mjs —— cookie 登录会话：加密落库、读取、删除、限流。
import {
  decryptJson,
  encryptJson,
  newCsrfToken,
  newSid,
} from '../crypto.mjs';
import {
  HttpError,
  clientIp,
  parseCookies,
  readJson,
  sendEmpty,
  sendJson,
  serializeCookie,
} from '../http.mjs';

export const SESSION_COOKIE = 'rill_sid';
export const CSRF_HEADER = 'x-rill-csrf';
export const ALLOWED_COOKIE_NAMES = new Set([
  'SUB',
  'SUBP',
  '_T_WM',
  'XSRF-TOKEN',
  'M_WEIBOCN_PARAMS',
  'WEIBOCN_FROM',
]);
const MAX_COOKIE_VALUE = 4096;

/**
 * 服务端会话 TTL：30 天，与 rill_sid 的 Max-Age 对齐。
 * last_seen 只在 GET /api/session（页面启动/显式校验）时续期；读/写请求
 * 不续期，避免“任何流量都无限续命”把 TTL 变成摆设。超过 TTL 的会话
 * 视为未登录，并删除 sessions 行与 kv:csrf:<sid>。
 */
export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

export function sessionExpired(row, now = Date.now()) {
  if (!row) return true;
  const lastSeen = Number(row.last_seen);
  if (!Number.isFinite(lastSeen)) return true;
  return now - lastSeen > SESSION_TTL_MS;
}

function modeFor(provider) {
  return provider === 'weibo' ? 'online' : 'offline';
}

function publicUser(author) {
  if (!author) return undefined;
  return {
    uid: author.uid ?? author.id ?? null,
    screenName: author.screenName ?? author.nickname ?? '已登录',
    avatarUrl: author.avatarUrl ?? '',
  };
}

export function readSession(req, ctx) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (!sid) return null;
  const row = ctx.store.getSession(sid);
  if (!row) return null;
  if (sessionExpired(row)) {
    // deleteSession 同时清 kv:csrf:<sid>；不在这里清 cookie（readSession 没有 res）。
    ctx.store.deleteSession(sid);
    return null;
  }
  try {
    const storedCookies = decryptJson(ctx.secret, {
      encrypted: row.cookies_enc,
      iv: row.iv,
      tag: row.tag,
    });
    if (!Array.isArray(storedCookies)) return null;
    return {
      sid,
      row,
      cookies: Object.fromEntries(storedCookies.map((cookie) => [cookie.name, cookie.value])),
      provider: row.provider || ctx.providerName,
    };
  } catch {
    return null;
  }
}

function setSessionCookie(res, sid, ctx, maxAge = 30 * 24 * 60 * 60) {
  const secure = ctx.nodeEnv === 'production';
  res.setHeader('set-cookie', serializeCookie(SESSION_COOKIE, sid, { secure, maxAge }));
}

function clearSessionCookie(res, ctx) {
  const secure = ctx.nodeEnv === 'production';
  res.setHeader('set-cookie', serializeCookie(SESSION_COOKIE, '', { secure, maxAge: 0 }));
}

function pickCookies(body) {
  if (!body || !Array.isArray(body.cookies)) throw new HttpError(400, 'invalid_cookies');
  const picked = new Map();
  for (const item of body.cookies) {
    if (!item || typeof item.name !== 'string') continue;
    const name = item.name.trim();
    if (!ALLOWED_COOKIE_NAMES.has(name)) continue;
    if (typeof item.value !== 'string' || item.value.length === 0) continue;
    if (item.value.length > MAX_COOKIE_VALUE) continue;
    picked.set(name, item.value);
  }
  return [...picked].map(([name, value]) => ({ name, value }));
}

export async function handleSessionCookie(req, res, ctx) {
  // 令牌桶同时按 sid + IP 与 IP 两个维度计数：新会话还没有稳定 sid，
  // 仅按 sid 会被每次 Set-Cookie 绕开；仅按 IP 又无法区分同一出口下的会话。
  const ip = clientIp(req);
  const rateLimitSid = parseCookies(req)[SESSION_COOKIE] || 'anon';
  const ipBucket = ctx.loginLimiter.take(`login:ip:${ip}`);
  const sidBucket = ctx.loginLimiter.take(`login:sid:${rateLimitSid}:ip:${ip}`);
  if (!ipBucket.allowed || !sidBucket.allowed) {
    sendJson(
      res,
      429,
      { error: 'rate_limited', retryAfter: 60 },
      { 'retry-after': '60' },
    );
    return;
  }

  const body = await readJson(req);
  const cookies = pickCookies(body);
  const sid = newSid();
  const csrfToken = newCsrfToken();
  const now = Date.now();
  const { encrypted, iv, tag } = encryptJson(ctx.secret, cookies);
  ctx.store.createSession({
    sid,
    createdAt: now,
    lastSeen: now,
    encrypted,
    iv,
    tag,
    provider: ctx.providerName,
  });
  ctx.store.setKv(`csrf:${sid}`, csrfToken);
  setSessionCookie(res, sid, ctx);

  // 只记录 cookie 名和长度；绝不记录值。日志函数在 index.mjs 里也只序列化对象。
  ctx.log('session.cookie', {
    provider: ctx.providerName,
    cookies: cookies.map((cookie) => ({ name: cookie.name, length: cookie.value.length })),
  });

  sendJson(
    res,
    201,
    { ok: true, provider: ctx.providerName, mode: modeFor(ctx.providerName) },
    { 'x-rill-csrf': csrfToken },
  );
}

export async function handleSessionGet(req, res, ctx) {
  const cookies = parseCookies(req);
  const sid = cookies[SESSION_COOKIE];
  const fallback = {
    authenticated: false,
    hasSession: false,
    provider: ctx.providerName,
    mode: modeFor(ctx.providerName),
  };
  if (!sid) {
    sendJson(res, 200, fallback);
    return;
  }

  const row = ctx.store.getSession(sid);
  if (!row) {
    sendJson(res, 200, fallback);
    return;
  }
  if (sessionExpired(row)) {
    ctx.store.deleteSession(sid);
    clearSessionCookie(res, ctx);
    sendJson(res, 200, fallback);
    return;
  }

  let storedCookies;
  try {
    storedCookies = decryptJson(ctx.secret, {
      encrypted: row.cookies_enc,
      iv: row.iv,
      tag: row.tag,
    });
    if (!Array.isArray(storedCookies)) throw new Error('invalid session payload');
  } catch {
    ctx.store.deleteSession(sid);
    clearSessionCookie(res, ctx);
    sendJson(res, 200, fallback);
    return;
  }

  ctx.store.touchSession(sid, Date.now());
  const csrfToken = ctx.store.getKv(`csrf:${sid}`);
  const headers = csrfToken ? { 'x-rill-csrf': csrfToken } : {};
  const provider = row.provider || ctx.providerName;
  const base = { authenticated: false, hasSession: true, provider, mode: modeFor(provider) };

  if (provider === 'mock') {
    const user = await ctx.providers.mock.getUser(ctx.providers.mock.currentUserId);
    sendJson(res, 200, { ...base, authenticated: true, user: publicUser(user) }, headers);
    return;
  }

  // weibo：/api/config 校验；uid 拿不到时仍 authenticated=true、user.uid=null。
  const weibo = new ctx.WeiboProvider({ cookies: Object.fromEntries(storedCookies.map((c) => [c.name, c.value])) });
  try {
    const identity = await weibo.validateSession();
    sendJson(res, 200, {
      ...base,
      authenticated: true,
      user: publicUser({
        uid: identity.uid ?? null,
        screenName: identity.screenName || '已登录',
        avatarUrl: '',
      }),
    }, headers);
  } catch {
    sendJson(res, 200, { ...base, authenticated: false }, headers);
  }
}

export async function handleSessionDelete(req, res, ctx) {
  const sid = parseCookies(req)[SESSION_COOKIE];
  if (sid) ctx.store.deleteSession(sid);
  clearSessionCookie(res, ctx);
  sendEmpty(res, 204);
}

export { modeFor };