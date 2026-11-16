// server/http.mjs —— node:http 小工具：JSON 响应、cookie 解析、Origin/CSRF 判断。
// 不记录 request body；cookie 值只在内存里用于解密/校验。
const BODY_LIMIT = 64 * 1024;

export class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

export function sendJson(res, status, value, extraHeaders = {}) {
  const body = JSON.stringify(value);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  });
  res.end(body);
}

export function sendEmpty(res, status, extraHeaders = {}) {
  res.writeHead(status, {
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    ...extraHeaders,
  });
  res.end();
}

export async function readJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > BODY_LIMIT) throw new HttpError(413, 'body_too_large');
    chunks.push(chunk);
  }
  if (!total) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'invalid_json');
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie;
  const out = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    let value = part.slice(index + 1).trim();
    try {
      value = decodeURIComponent(value);
    } catch {
      // 保留原值，不因为一个坏 cookie 抛错
    }
    out[name] = value;
  }
  return out;
}

export function serializeCookie(name, value, { maxAge, secure = false, httpOnly = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (httpOnly) parts.push('HttpOnly');
  parts.push('SameSite=Lax', 'Path=/');
  if (secure) parts.push('Secure');
  if (typeof maxAge === 'number') parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join('; ');
}

/**
 * 取客户端 IP。默认不信任 X-Forwarded-For（直连安全，伪造无效）。
 * 仅当 RILL_TRUST_PROXY=1 时采信 XFF 的**最后一跳**：那是与你直连的反代
 * 写进来的地址；前面的跳数可能由客户端伪造。直连不要开；只有前面确实
 * 有你自己控制的反代时才开（见 server/README.md）。
 */
export function clientIp(req, { trustProxy = process.env.RILL_TRUST_PROXY === '1' } = {}) {
  if (trustProxy) {
    const header = req.headers?.['x-forwarded-for'];
    const raw = Array.isArray(header) ? header.join(',') : String(header || '');
    const hops = raw.split(',').map((hop) => hop.trim()).filter(Boolean);
    if (hops.length) return hops[hops.length - 1];
  }
  const raw = req.socket?.remoteAddress || '';
  return raw.replace(/^::ffff:/, '') || 'unknown';
}

/** 只接受与请求自身 Host 完全一致的 Origin；协议只看 http/https。 */
export function originMatchesHost(req, origin) {
  if (!origin) return false;
  try {
    const parsed = new URL(origin);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    return parsed.host === req.headers.host;
  } catch {
    return false;
  }
}

export function isMutating(method) {
  return method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS';
}

/** 简单内存令牌桶：容量 5，60 秒匀速回填（即 5/min）。 */
export class TokenBucket {
  constructor(capacity = 5, windowMs = 60_000) {
    this.capacity = capacity;
    this.windowMs = windowMs;
    this.entries = new Map();
  }

  take(key) {
    const now = Date.now();
    let entry = this.entries.get(key);
    if (!entry) {
      entry = { tokens: this.capacity, updated: now };
      this.entries.set(key, entry);
    }
    const refill = ((now - entry.updated) / this.windowMs) * this.capacity;
    entry.tokens = Math.min(this.capacity, entry.tokens + refill);
    entry.updated = now;
    if (entry.tokens < 1) {
      this.gc(now);
      return { allowed: false, remaining: 0 };
    }
    entry.tokens -= 1;
    this.gc(now);
    return { allowed: true, remaining: Math.floor(entry.tokens) };
  }

  gc(now) {
    if (this.entries.size < 5_000) return;
    for (const [key, entry] of this.entries) {
      if (now - entry.updated > this.windowMs * 2) this.entries.delete(key);
    }
  }
}