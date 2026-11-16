// server/routes/feed.mjs —— t18 只读 API：timeline/status/comments/user/user-posts/search。
// 统一归一化为 { items, next, hasMore, users } / { post, users } / { user }，
// 前端 src/data/api.ts 只依赖这一层，不直接解析微博 JSON。
import { readSession } from './session.mjs';
import { WeiboError } from '../providers/weibo.mjs';
import { mockData } from '../providers/mock.mjs';
import { HttpError, sendJson } from '../http.mjs';

const LIMIT = 20;

function decodePart(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function statusForCode(code) {
  switch (code) {
    case 'AUTH_EXPIRED':
    case 'AUTH_REQUIRED':
      return 401;
    case 'RATE_LIMITED':
      return 429;
    case 'RISK_CONTROL':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'CONTENT_REJECTED':
      return 422;
    default:
      return 502;
  }
}

export function sendApiError(res, error) {
  if (error instanceof WeiboError) {
    sendJson(res, statusForCode(error.code), {
      error: { code: error.code, message: error.message || error.code },
    });
    return;
  }
  if (error instanceof HttpError) {
    sendJson(res, error.status, { error: { code: error.code, message: error.code } });
    return;
  }
  if (error && typeof error.code === 'string') {
    sendJson(res, statusForCode(error.code), { error: { code: error.code, message: error.message || error.code } });
    return;
  }
  sendJson(res, 500, { error: { code: 'UPSTREAM', message: '服务内部错误' } });
}

function authRequired() {
  const error = new Error('需要登录');
  error.code = 'AUTH_REQUIRED';
  return error;
}

function asUniqueUsers(items, key) {
  const ids = [];
  for (const item of items) {
    if (item && item[key]) ids.push(String(item[key]));
  }
  return [...new Set(ids)];
}

async function mockUsers(ctx, posts, replies = []) {
  const ids = [...new Set([
    ...asUniqueUsers(posts, 'authorId'),
    ...asUniqueUsers(replies, 'authorId'),
  ])];
  const users = [];
  for (const id of ids) {
    const user = await ctx.providers.mock.getUser(id);
    if (user) users.push(user);
  }
  return users;
}

function mockPage(items, cursor, limit = LIMIT) {
  const offset = Math.max(0, Number(cursor || 0) || 0);
  return {
    items: items.slice(offset, offset + limit),
    next: offset + limit < items.length ? String(offset + limit) : null,
    hasMore: offset + limit < items.length,
  };
}

async function readContext(req, ctx) {
  if (ctx.providerName === 'mock') {
    return { kind: 'mock', provider: ctx.providers.mock };
  }
  const session = readSession(req, ctx);
  if (!session || session.provider !== 'weibo') throw authRequired();
  return {
    kind: 'weibo',
    provider: new ctx.WeiboProvider({ cookies: session.cookies }),
    session,
  };
}

async function handleTimeline(req, res, url, ctx, read) {
  const tab = url.searchParams.get('tab') === 'friends' || url.searchParams.get('tab') === 'following'
    ? 'following'
    : 'recommend';
  const cursor = url.searchParams.get('cursor');
  if (read.kind === 'mock') {
    const items = await read.provider.getTimeline({ tab, limit: 100 });
    const users = await mockUsers(ctx, items);
    sendJson(res, 200, { ...mockPage(items, cursor), users });
    return;
  }
  const page = await read.provider.getTimeline(tab, cursor);
  sendJson(res, 200, page);
}

async function handleStatus(req, res, url, ctx, read, id) {
  if (read.kind === 'mock') {
    const post = await read.provider.getStatus(id);
    if (!post) throw Object.assign(new Error('内容不存在'), { code: 'NOT_FOUND' });
    const users = await mockUsers(ctx, [post]);
    sendJson(res, 200, { post, users });
    return;
  }
  const post = await read.provider.getStatus(id);
  sendJson(res, 200, { post, users: read.provider.lastUsers || [] });
}

async function handleComments(req, res, url, ctx, read, id) {
  const cursor = url.searchParams.get('cursor');
  if (read.kind === 'mock') {
    const all = await read.provider.getComments(id);
    const page = mockPage(all, cursor);
    sendJson(res, 200, { ...page, users: await mockUsers(ctx, [], page.items) });
    return;
  }
  const page = await read.provider.getComments(id, cursor);
  sendJson(res, 200, page);
}

async function handleUser(req, res, ctx, read, uid) {
  const id = decodePart(uid);
  if (read.kind === 'mock') {
    const user = await read.provider.getUser(id);
    if (!user) throw Object.assign(new Error('用户不存在'), { code: 'NOT_FOUND' });
    sendJson(res, 200, { user });
    return;
  }
  const user = await read.provider.getUser(id);
  sendJson(res, 200, { user });
}

async function handleUserPosts(req, res, url, ctx, read, uid) {
  const id = decodePart(uid);
  const cursor = url.searchParams.get('cursor');
  if (read.kind === 'mock') {
    const all = await read.provider.getUserPosts(id);
    const page = mockPage(all, cursor);
    sendJson(res, 200, { ...page, users: await mockUsers(ctx, page.items) });
    return;
  }
  const page = await read.provider.getUserPosts(id, cursor);
  sendJson(res, 200, page);
}

async function handleSearch(req, res, url, ctx, read) {
  const q = String(url.searchParams.get('q') || '').trim().slice(0, 140);
  const kind = ['users', 'topics'].includes(url.searchParams.get('kind')) ? url.searchParams.get('kind') : 'statuses';
  const cursor = url.searchParams.get('cursor');
  if (!q) {
    sendJson(res, 200, { items: [], next: null, hasMore: false, users: [] });
    return;
  }
  if (read.kind === 'mock') {
    const needle = q.toLowerCase();
    if (kind === 'users') {
      const users = mockData.users
        .filter((user) => `${user.nickname} ${user.handle}`.toLowerCase().includes(needle))
        .sort((a, b) => a.id.localeCompare(b.id));
      sendJson(res, 200, { ...mockPage(users, cursor), users });
      return;
    }
    if (kind === 'topics') {
      const topics = [...new Set(mockData.statuses.flatMap((post) => post.topics))]
        .filter((topic) => topic.toLowerCase().includes(needle))
        .sort((a, b) => a.localeCompare(b));
      sendJson(res, 200, { ...mockPage(topics, cursor), users: [] });
      return;
    }
    const all = await read.provider.search(q, { limit: 100 });
    const page = mockPage(all, cursor);
    sendJson(res, 200, { ...page, users: await mockUsers(ctx, page.items) });
    return;
  }
  const page = await read.provider.search(q, kind, cursor);
  sendJson(res, 200, page);
}

/** 返回 true 表示该 URL 已被只读路由处理。 */
export async function handleFeed(req, res, url, ctx) {
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const isFeed = pathname === '/api/timeline' || pathname === '/api/search'
    || /^\/api\/status\/[^/]+$/.test(pathname)
    || /^\/api\/comments\/[^/]+$/.test(pathname)
    || /^\/api\/user\/[^/]+\/posts$/.test(pathname)
    || /^\/api\/user\/[^/]+$/.test(pathname);
  if (!isFeed) return false;
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: { code: 'METHOD_NOT_ALLOWED', message: '只支持 GET' } });
    return true;
  }

  try {
    const read = await readContext(req, ctx);
    if (pathname === '/api/timeline') return void (await handleTimeline(req, res, url, ctx, read)) || true;
    if (pathname === '/api/search') return void (await handleSearch(req, res, url, ctx, read)) || true;

    const statusMatch = /^\/api\/status\/([^/]+)$/.exec(pathname);
    if (statusMatch) {
      await handleStatus(req, res, url, ctx, read, decodePart(statusMatch[1]));
      return true;
    }
    const commentsMatch = /^\/api\/comments\/([^/]+)$/.exec(pathname);
    if (commentsMatch) {
      await handleComments(req, res, url, ctx, read, decodePart(commentsMatch[1]));
      return true;
    }
    const postsMatch = /^\/api\/user\/([^/]+)\/posts$/.exec(pathname);
    if (postsMatch) {
      await handleUserPosts(req, res, url, ctx, read, postsMatch[1]);
      return true;
    }
    const userMatch = /^\/api\/user\/([^/]+)$/.exec(pathname);
    if (userMatch) {
      await handleUser(req, res, ctx, read, userMatch[1]);
      return true;
    }
  } catch (error) {
    sendApiError(res, error);
    return true;
  }
  return false;
}
