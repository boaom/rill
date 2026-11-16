// server/routes/write.mjs —— t19 写操作：点赞/转发/评论/发博。
// 关键约束：写请求绝不因网络/5xx 自动重发；幂等键 5 分钟缓存；每账号 6 次/分钟。
import { TokenBucket, readJson, sendJson, HttpError } from '../http.mjs';
import { readSession } from './session.mjs';
import { sendApiError } from './feed.mjs';

const IDEMPOTENCY_TTL_MS = 5 * 60_000;
const IDEMPOTENCY_MAX = 2_000;
const WRITE_RATE = 6;

export class IdempotencyStore {
  constructor(ttlMs = IDEMPOTENCY_TTL_MS, max = IDEMPOTENCY_MAX) {
    this.ttlMs = ttlMs;
    this.max = max;
    this.map = new Map();
  }
  prune(now = Date.now()) {
    for (const [key, value] of this.map) {
      if (now - value.at > this.ttlMs) this.map.delete(key);
    }
    while (this.map.size > this.max) this.map.delete(this.map.keys().next().value);
  }
  get(key, now = Date.now()) {
    const value = this.map.get(key);
    if (!value) return null;
    if (now - value.at > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    return value.value;
  }
  set(key, value, now = Date.now()) {
    this.map.delete(key);
    this.map.set(key, { value, at: now });
    this.prune(now);
  }
  clear() { this.map.clear(); }
}

export const writeLimiter = new TokenBucket(WRITE_RATE, 60_000);
export const idempotency = new IdempotencyStore();
const inFlight = new Map();

/** 测试用：重置进程内写状态（不会触碰上游）。 */
export function resetWriteState() {
  writeLimiter.entries.clear();
  idempotency.clear();
  inFlight.clear();
}

function authRequired() {
  const error = new Error('需要登录');
  error.code = 'AUTH_REQUIRED';
  return error;
}

function badInput(message) {
  return new HttpError(400, 'BAD_INPUT', message);
}

function contentRejected(message) {
  const error = new Error(message);
  error.code = 'CONTENT_REJECTED';
  return error;
}

function validateText(text, { required = true, max = 140 } = {}) {
  const value = String(text ?? '').trim();
  if (required && !value) throw contentRejected('内容不能为空');
  if (Array.from(value).length > max) throw contentRejected(`内容超过 ${max} 字`);
  return value;
}

function idempotencyKey(req) {
  const raw = String(req.headers['idempotency-key'] || '').trim();
  if (!raw) return null;
  if (!/^[A-Za-z0-9._:-]{8,160}$/.test(raw)) throw badInput('Idempotency-Key 格式不正确');
  return raw;
}

function mockPost({ text = '', repostOfId = null } = {}) {
  const now = Date.now();
  return {
    id: `p_new_online_${now}`,
    authorId: 'u_01',
    text,
    media: [],
    topics: [],
    repostOfId,
    createdAt: now,
    counts: { reposts: 0, replies: 0, likes: 0 },
  };
}

async function mockWrite(action, id, body, ctx) {
  // 离线前端不会走这里；保留 mock server 的可测试语义，不持久化、不联网。
  if (action === 'like') {
    const post = await ctx.providers.mock.getStatus(id);
    if (!post) throw Object.assign(new Error('内容不存在'), { code: 'NOT_FOUND' });
    return { liked: body.on, count: post.counts.likes + (body.on ? 1 : 0) };
  }
  if (action === 'repost') return { post: mockPost({ text: body.text || '', repostOfId: id }) };
  if (action === 'comment') {
    const now = Date.now();
    return {
      reply: {
        id: `c_new_online_${now}`,
        postId: id,
        authorId: 'u_01',
        text: body.text,
        createdAt: now,
        replyToReplyId: body.replyTo || null,
      },
    };
  }
  return { post: mockPost({ text: body.text }) };
}

function readSessionForWrite(session) {
  if (!session || session.provider !== 'weibo') throw authRequired();
  return session;
}

async function execute(action, id, body, ctx, session) {
  if (action === 'like' && typeof body.on !== 'boolean') throw contentRejected('点赞参数必须是布尔值');
  if (action === 'comment') validateText(body.text, { required: true });
  if (action === 'repost') validateText(body.text, { required: false });
  if (action === 'publish') validateText(body.text, { required: !Array.isArray(body.pics) || body.pics.length === 0 });
  if (ctx.providerName === 'mock') return mockWrite(action, id, body, ctx);
  const sessionInfo = readSessionForWrite(session);
  const provider = new ctx.WeiboProvider({ cookies: sessionInfo.cookies });
  if (action === 'like') return provider.like(id, body.on);
  if (action === 'repost') {
    const text = validateText(body.text, { required: false });
    return { post: await provider.repost(id, text) };
  }
  if (action === 'comment') {
    const text = validateText(body.text, { required: true });
    return { reply: await provider.comment(id, text, body.replyTo || null) };
  }
  const text = validateText(body.text, { required: !Array.isArray(body.pics) || body.pics.length === 0 });
  const post = await provider.publish(text, Array.isArray(body.pics) ? body.pics : undefined);
  return {
    post,
    notice: provider.lastPublishNotice || undefined,
    pending: provider.lastPublishPending || post.id.startsWith('pending_') || undefined,
  };
}

async function dispatch(action, req, res, ctx, id, body, key, session) {
  const fullKey = key ? `${session?.sid || 'no-session'}|${action}|${id}|${key}` : null;
  if (fullKey) {
    const cached = idempotency.get(fullKey);
    if (cached) {
      sendJson(res, cached.status, cached.body);
      return;
    }
  }
  if (fullKey && inFlight.has(fullKey)) {
    const result = await inFlight.get(fullKey);
    sendJson(res, result.status, result.body);
    return;
  }
  const sid = session?.sid || 'anonymous';
  const rate = writeLimiter.take(sid);
  if (!rate.allowed) {
    sendJson(res, 429, { error: { code: 'RATE_LIMITED', message: '写操作太频繁，请稍后再试' } }, { 'retry-after': '60' });
    return;
  }
  const task = (async () => {
    const value = await execute(action, id, body, ctx, session);
    return { status: 200, body: value };
  })();
  if (fullKey) inFlight.set(fullKey, task);
  try {
    const result = await task;
    if (fullKey) idempotency.set(fullKey, result);
    sendJson(res, result.status, result.body);
  } catch (error) {
    sendApiError(res, error);
  } finally {
    if (fullKey) inFlight.delete(fullKey);
  }
}

/** 返回 true 表示该请求已被写路由处理。 */
export async function handleWrite(req, res, url, ctx) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const like = /^\/api\/status\/([^/]+)\/like$/.exec(pathname);
  const repost = /^\/api\/status\/([^/]+)\/repost$/.exec(pathname);
  const comment = /^\/api\/status\/([^/]+)\/comment$/.exec(pathname);
  const publish = pathname === '/api/status/publish';
  if (!like && !repost && !comment && !publish) return false;
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 POST' } });
    return true;
  }
  try {
    const session = ctx.providerName === 'mock' ? null : readSession(req, ctx);
    if (ctx.providerName !== 'mock' && !session) throw authRequired();
    const body = await readJson(req);
    const key = idempotencyKey(req);
    if (like) {
      await dispatch('like', req, res, ctx, decodeURIComponent(like[1]), body, key, session);
      return true;
    }
    if (repost) {
      await dispatch('repost', req, res, ctx, decodeURIComponent(repost[1]), body, key, session);
      return true;
    }
    if (comment) {
      await dispatch('comment', req, res, ctx, decodeURIComponent(comment[1]), body, key, session);
      return true;
    }
    await dispatch('publish', req, res, ctx, '', body, key, session);
    return true;
  } catch (error) {
    sendApiError(res, error);
    return true;
  }
}
