// src/data/api.ts —— 统一数据源：offline（随包 mock）/ backend（本地 server）/ device（设备直连）。
// browser 只在 server 检测到 RILL_PROVIDER=weibo 时进入 backend；原生 shell 进入 device。
// device 的 cookie 只由 src/device/session.ts 读写；本文件不打印、不上报任何凭证。
import {
  AUTHORS,
  AUTHOR_BY_ID,
  CURRENT_USER,
  FOLLOWING_AUTHOR_IDS,
  POSTS,
  getMockPost,
  repliesForMockPost,
} from './mock';
import type { Author, FeedTab, MediaRef, Post, Reply } from '../types';

export type ApiMode = 'offline' | 'backend' | 'device';

export interface SessionUser {
  uid: string | null;
  screenName: string;
  avatarUrl?: string;
}

export interface SessionInfo {
  authenticated: boolean;
  hasSession?: boolean;
  provider: string;
  mode: string;
  user?: SessionUser;
}

export interface ConfigInfo {
  auth?: { cookieLogin?: boolean; oauth?: boolean };
  provider?: string;
  offlineFallback?: boolean;
}

export interface BootstrapInfo {
  mode: ApiMode;
  config: ConfigInfo | null;
  session: SessionInfo;
  loginGuide?: string;
}

export interface Page<T> {
  items: T[];
  next: string | null;
  hasMore: boolean;
  users: Author[];
}

export interface StatusPayload {
  post: Post;
  users: Author[];
}

export type ApiErrorCode =
  | 'AUTH_EXPIRED'
  | 'AUTH_REQUIRED'
  | 'RATE_LIMITED'
  | 'RISK_CONTROL'
  | 'NOT_FOUND'
  | 'CONTENT_REJECTED'
  | 'UPSTREAM'
  | 'BAD_INPUT'
  | 'UNKNOWN';

export class ApiError extends Error {
  code: ApiErrorCode;
  status: number;
  retryAfter?: number;

  constructor(code: ApiErrorCode, message: string, status = 0, retryAfter?: number) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function isAuthError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'AUTH_EXPIRED' || error.code === 'AUTH_REQUIRED');
}

/** 时间线 / 搜索 / 详情三处共用同一份 RISK_CONTROL 文案；不要各自复制改写。 */
export const RISK_CONTROL_COPY = {
  title: '触发了风控',
  text: '微博要求人工验证；稍后再试，或换网络。',
  action: '重试',
} as const;

const PAGE_SIZE = 20;
let csrfToken: string | null = null;

function setCsrfFrom(response: Response): void {
  const token = response.headers.get('x-rill-csrf');
  if (token) csrfToken = token;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object';
}

function errorCode(raw: unknown, status: number): ApiErrorCode {
  const code = String(raw || '').toUpperCase();
  if (['AUTH_EXPIRED', 'AUTH_REQUIRED', 'RATE_LIMITED', 'RISK_CONTROL', 'NOT_FOUND', 'CONTENT_REJECTED', 'UPSTREAM'].includes(code)) {
    return code as ApiErrorCode;
  }
  if (status === 401) return 'AUTH_EXPIRED';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 403) return 'RISK_CONTROL';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'CONTENT_REJECTED';
  if (status === 400) return 'BAD_INPUT';
  return 'UPSTREAM';
}

async function requestJson<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  const mutating = init.method && !['GET', 'HEAD'].includes(init.method.toUpperCase());
  try {
    response = await fetch(path, {
      ...init,
      credentials: 'same-origin',
      headers: {
        Accept: 'application/json',
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...(csrfToken && mutating ? { 'X-Rill-CSRF': csrfToken } : {}),
        ...(init.headers || {}),
      },
    });
  } catch {
    throw new ApiError('UPSTREAM', '本地服务不可用', 0);
  }
  setCsrfFrom(response);
  const text = await response.text();
  let payload: unknown = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    throw new ApiError('UPSTREAM', '服务返回了非 JSON 响应', response.status);
  }
  if (!response.ok) {
    const errorValue = isRecord(payload) ? payload.error : null;
    const rawCode = typeof errorValue === 'string' ? errorValue : isRecord(errorValue) ? errorValue.code : null;
    const message = isRecord(errorValue) && typeof errorValue.message === 'string'
      ? errorValue.message
      : (typeof errorValue === 'string' ? errorValue : `请求失败 (HTTP ${response.status})`);
    const retryHeader = response.headers.get('retry-after');
    throw new ApiError(errorCode(rawCode, response.status), message, response.status, retryHeader ? Number(retryHeader) : undefined);
  }
  return payload as T;
}

// ---------------------------------------------------------------- bootstrap / auth

/** 原生判定只用 Capacitor 注入的全局对象，不 import @capacitor/core。 */
export function isDeviceRuntime(): boolean {
  return Boolean((window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.());
}

async function deviceModule() {
  return import('../device/client');
}

export async function getBootstrap(): Promise<BootstrapInfo> {
  // 原生壳优先：设备直连不依赖、也不探测本地 server。
  if (isDeviceRuntime()) {
    const client = await deviceModule();
    const session = await client.readSession();
    return { mode: 'device', config: null, session, loginGuide: client.DEVICE_LOGIN_GUIDE };
  }

  let config: ConfigInfo | null = null;
  let session: SessionInfo = {
    authenticated: false,
    provider: 'mock',
    mode: 'offline',
  };

  try {
    config = await requestJson<ConfigInfo>('/api/config');
  } catch {
    return { mode: 'offline', config: null, session };
  }

  try {
    session = await requestJson<SessionInfo>('/api/session');
  } catch {
    session = {
      authenticated: false,
      provider: config.provider || 'mock',
      mode: config.provider === 'weibo' ? 'backend' : 'offline',
    };
  }

  // 默认 mock server → offline；weibo 必须“微博校验通过”才进入 backend。
  // 仅有加密会话行（hasSession）但上游 login:false 时不能算在线：那会让
  // 用户以为登录成功、随后到处 401（M2）。没有 cookie/校验失败保持离线 mock。
  const mode: ApiMode = config.provider === 'weibo' && session.authenticated === true
    ? 'backend'
    : 'offline';
  return { mode, config, session };
}

export async function getSession(): Promise<SessionInfo> {
  return requestJson<SessionInfo>('/api/session');
}

export async function loginWithCookies(cookies: Array<{ name: string; value: string }>): Promise<SessionInfo> {
  if (isDeviceRuntime()) {
    return (await deviceModule()).loginDevice(cookies);
  }
  await requestJson<{ ok: boolean }>('/api/session/cookie', {
    method: 'POST',
    body: JSON.stringify({ cookies }),
  });
  return getSession();
}

export async function logout(): Promise<void> {
  if (isDeviceRuntime()) {
    await (await deviceModule()).logoutDevice();
    return;
  }
  await requestJson<null>('/api/session', {
    method: 'DELETE',
    headers: csrfToken ? { 'X-Rill-CSRF': csrfToken } : {},
  });
  csrfToken = null;
}

// ---------------------------------------------------------------- 写操作

export interface LikeResult {
  liked: boolean;
  count: number;
}

export interface WritePostResult {
  post: Post;
  notice?: string;
  pending?: boolean;
}

export interface WriteReplyResult {
  reply: Reply;
}

export function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}-${Math.random().toString(36).slice(2, 12)}`;
  }
}

async function writeJson<T>(path: string, body: unknown): Promise<T> {
  return requestJson<T>(path, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': newIdempotencyKey(),
    },
    body: JSON.stringify(body),
  });
}

/** 点赞/取消赞：服务端返回真实计数；失败时由调用方回滚乐观状态。 */
export async function setLike(id: string, on: boolean, mode: ApiMode = 'backend'): Promise<LikeResult> {
  if (mode === 'device') return (await deviceModule()).setLike(id, on);
  return writeJson<LikeResult>(`/api/status/${encodeURIComponent(id)}/like`, { on });
}

/** 转发；写失败绝不自动重试，调用方保留草稿。 */
export async function repostStatus(id: string, text: string, mode: ApiMode = 'backend'): Promise<WritePostResult> {
  if (mode === 'device') return (await deviceModule()).repost(id, text);
  return writeJson<WritePostResult>(`/api/status/${encodeURIComponent(id)}/repost`, { text });
}

/** 评论；replyTo 是父评论 id，只允许一层楼中楼。 */
export async function commentStatus(id: string, text: string, replyTo: string | null = null, mode: ApiMode = 'backend'): Promise<WriteReplyResult> {
  if (mode === 'device') return (await deviceModule()).comment(id, text, replyTo);
  return writeJson<WriteReplyResult>(`/api/status/${encodeURIComponent(id)}/comment`, { text, replyTo });
}

/** 发博；pics 为现有 MediaRef 占位时服务端会降级纯文本，并在 notice 里说明。 */
export async function publishStatus(text: string, pics: MediaRef[] = [], key?: string, mode: ApiMode = 'backend'): Promise<WritePostResult> {
  if (mode === 'device') return (await deviceModule()).publish(text, pics, key);
  return requestJson<WritePostResult>('/api/status/publish', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Idempotency-Key': key || newIdempotencyKey(),
    },
    body: JSON.stringify({ text, pics }),
  });
}

/** 把六类写错误翻译成用户能操作的提示；不暴露上游响应体之外的敏感信息。 */
export function writeErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return '操作失败，请稍后再试';
  switch (error.code) {
    case 'AUTH_EXPIRED':
    case 'AUTH_REQUIRED':
      return '登录已过期，请重新登录后再试';
    case 'RATE_LIMITED':
      return '操作太频繁，请等一分钟再试';
    case 'RISK_CONTROL':
      return '触发了微博风控，请稍后再试或换网络';
    case 'CONTENT_REJECTED':
      return `内容被拒绝：${error.message || '请检查文字长度或敏感词'}`;
    case 'NOT_FOUND':
      return '原内容已被删除或不可见';
    case 'BAD_INPUT':
      return '请求参数不正确，请刷新后重试';
    default:
      return '服务暂时不可用，请稍后再试（不会自动重发）';
  }
}

// ---------------------------------------------------------------- cookie 输入解析

export interface CookieParseResult {
  cookies: Array<{ name: string; value: string }>;
  skipped: number;
}

/** 支持 "name=value; name2=value2" 与逐行粘贴；自动去掉 `Cookie:` 前缀与空白。 */
export function parseCookieInput(input: string): CookieParseResult {
  const text = String(input || '').replace(/^\s*Cookie\s*:/i, '').trim();
  if (!text) return { cookies: [], skipped: 0 };
  const chunks = text
    .split(/\r?\n|;/g)
    .map((part) => part.trim())
    .filter(Boolean);
  const map = new Map<string, string>();
  let skipped = 0;
  for (const chunk of chunks) {
    const at = chunk.indexOf('=');
    if (at <= 0 || at === chunk.length - 1) {
      skipped += 1;
      continue;
    }
    const name = chunk.slice(0, at).trim();
    const value = chunk.slice(at + 1).trim();
    if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name) || !value) {
      skipped += 1;
      continue;
    }
    map.set(name, value);
  }
  return { cookies: [...map].map(([name, value]) => ({ name, value })), skipped };
}

// ---------------------------------------------------------------- offline 数据源

function sortPosts(posts: readonly Post[]): Post[] {
  return posts.slice().sort((a, b) => (b.createdAt - a.createdAt) || a.id.localeCompare(b.id));
}

function sortReplies(replies: readonly Reply[]): Reply[] {
  return replies.slice().sort((a, b) => (b.createdAt - a.createdAt) || a.id.localeCompare(b.id));
}

function usersForPosts(posts: readonly Post[]): Author[] {
  const ids = new Set(posts.map((post) => post.authorId));
  const users: Author[] = [];
  for (const id of ids) {
    const author = AUTHOR_BY_ID.get(id);
    if (author) users.push(author);
  }
  return users;
}

function usersForReplies(replies: readonly Reply[]): Author[] {
  const ids = new Set(replies.map((reply) => reply.authorId));
  const users: Author[] = [];
  for (const id of ids) {
    const author = AUTHOR_BY_ID.get(id);
    if (author) users.push(author);
  }
  return users;
}

function localPage<T>(all: readonly T[], cursor: string | null): Page<T> {
  const offset = Math.max(0, Number(cursor || 0) || 0);
  const items = all.slice(offset, offset + PAGE_SIZE);
  const nextOffset = offset + PAGE_SIZE;
  return {
    items,
    next: nextOffset < all.length ? String(nextOffset) : null,
    hasMore: nextOffset < all.length,
    users: [],
  };
}

function localTimeline(tab: FeedTab, cursor: string | null): Page<Post> {
  const allowed = new Set(FOLLOWING_AUTHOR_IDS);
  const all = sortPosts(POSTS.filter((post) => tab === 'recommend' || allowed.has(post.authorId)));
  const page = localPage(all, cursor);
  return { ...page, users: usersForPosts(page.items) };
}

function localStatus(id: string): StatusPayload {
  const post = getMockPost(id);
  if (!post) throw new ApiError('NOT_FOUND', '内容已删除或不可见', 404);
  return { post, users: usersForPosts([post]) };
}

function localComments(postId: string, cursor: string | null): Page<Reply> {
  const page = localPage(sortReplies(repliesForMockPost(postId)), cursor);
  return { ...page, users: usersForReplies(page.items) };
}

function localUser(uid: string): Author {
  const user = AUTHOR_BY_ID.get(uid);
  if (!user) throw new ApiError('NOT_FOUND', '用户不存在', 404);
  return user;
}

function localUserPosts(uid: string, cursor: string | null): Page<Post> {
  const page = localPage(sortPosts(POSTS.filter((post) => post.authorId === uid)), cursor);
  return { ...page, users: usersForPosts(page.items) };
}

function localSearch(query: string, kind: string, cursor: string | null): Page<Post | Author> {
  const needle = query.trim().toLowerCase();
  const authors = new Map(AUTHORS.map((author) => [author.id, `${author.nickname} ${author.handle}`.toLowerCase()]));
  const posts = sortPosts(POSTS.filter((post) => {
    const haystack = [post.text, post.topics.join(' '), authors.get(post.authorId) || ''].join(' ').toLowerCase();
    return haystack.includes(needle);
  }));
  if (kind === 'users') {
    const users = AUTHORS.filter((author) => `${author.nickname} ${author.handle}`.toLowerCase().includes(needle));
    return { ...localPage(users, cursor), users };
  }
  if (kind === 'topics') {
    const words = [...new Set(posts.flatMap((post) => post.topics))]
      .filter((topic) => topic.toLowerCase().includes(needle));
    const topicAuthors: Author[] = words.map((topic) => ({
      id: `topic:${topic}`,
      nickname: `#${topic}#`,
      handle: 'topic',
      avatarText: Array.from(topic).slice(0, 2).join(''),
      avatarHue: 0,
      bio: '',
      followingCount: 0,
      followerCount: 0,
      postCount: 0,
      isCurrentUser: false,
    }));
    return { ...localPage(topicAuthors, cursor), users: topicAuthors };
  }
  const page = localPage(posts, cursor);
  return { ...page, users: usersForPosts(page.items) };
}

// ---------------------------------------------------------------- 统一只读接口

/** 在线适配层的最后一道字段归一：provider 映射过的 source/verified 不丢，
 *  也不把空字符串/空认证伪造成可见数据。前缀「来自 」由呈现层统一补。 */
function normalizeOnlineSource(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const source = value.trim();
  return source || undefined;
}

function normalizeOnlinePost(raw: Post): Post {
  if (!raw || typeof raw !== 'object') return raw;
  const source = normalizeOnlineSource(raw.source);
  if (!source) {
    const { source: _ignored, ...rest } = raw;
    return rest as Post;
  }
  return { ...raw, source };
}

function normalizeOnlineAuthor(raw: Author): Author {
  if (!raw || typeof raw !== 'object') return raw;
  const { verified, ...rest } = raw;
  return verified === true ? { ...rest, verified: true } : rest;
}

function onlinePage<T>(payload: unknown, normalizeItem?: (item: T) => T): Page<T> {
  const record = isRecord(payload) ? payload : {};
  const rawItems = Array.isArray(record.items) ? record.items as T[] : [];
  const items = normalizeItem ? rawItems.map(normalizeItem) : rawItems;
  const rawUsers = Array.isArray(record.users) ? record.users as Author[] : [];
  return {
    items,
    next: typeof record.next === 'string' && record.next ? record.next : null,
    hasMore: record.hasMore === true,
    users: rawUsers.map(normalizeOnlineAuthor),
  };
}

export async function getTimeline(tab: FeedTab, cursor: string | null = null, mode: ApiMode = 'offline'): Promise<Page<Post>> {
  if (mode === 'offline') return localTimeline(tab, cursor);
  if (mode === 'device') return (await deviceModule()).getTimeline(tab, cursor);
  const kind = tab === 'following' ? 'friends' : 'recommend';
  const params = new URLSearchParams({ tab: kind });
  if (cursor) params.set('cursor', cursor);
  return onlinePage<Post>(await requestJson(`/api/timeline?${params}`), normalizeOnlinePost);
}

export async function getStatus(id: string, mode: ApiMode = 'offline'): Promise<StatusPayload> {
  if (mode === 'offline') return localStatus(id);
  if (mode === 'device') return (await deviceModule()).getStatus(id);
  const payload = await requestJson<{ post: Post; users: Author[] }>(`/api/status/${encodeURIComponent(id)}`);
  return {
    post: normalizeOnlinePost(payload.post),
    users: (Array.isArray(payload.users) ? payload.users : []).map(normalizeOnlineAuthor),
  };
}

export async function getComments(id: string, cursor: string | null = null, mode: ApiMode = 'offline'): Promise<Page<Reply>> {
  if (mode === 'offline') return localComments(id, cursor);
  if (mode === 'device') return (await deviceModule()).getComments(id, cursor);
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  return onlinePage<Reply>(await requestJson(`/api/comments/${encodeURIComponent(id)}?${params}`));
}

export async function getUser(uid: string, mode: ApiMode = 'offline'): Promise<Author> {
  if (mode === 'offline') return localUser(uid);
  if (mode === 'device') return (await deviceModule()).getUser(uid);
  const payload = await requestJson<{ user: Author }>(`/api/user/${encodeURIComponent(uid)}`);
  return normalizeOnlineAuthor(payload.user);
}

export async function getUserPosts(uid: string, cursor: string | null = null, mode: ApiMode = 'offline'): Promise<Page<Post>> {
  if (mode === 'offline') return localUserPosts(uid, cursor);
  if (mode === 'device') return (await deviceModule()).getUserPosts(uid, cursor);
  const params = new URLSearchParams();
  if (cursor) params.set('cursor', cursor);
  return onlinePage<Post>(await requestJson(`/api/user/${encodeURIComponent(uid)}/posts?${params}`), normalizeOnlinePost);
}

export async function searchPosts(query: string, kind: 'statuses' | 'users' | 'topics' = 'statuses', cursor: string | null = null, mode: ApiMode = 'offline'): Promise<Page<Post | Author>> {
  if (mode === 'offline') return localSearch(query, kind, cursor);
  if (mode === 'device') return (await deviceModule()).search(query, kind, cursor);
  const params = new URLSearchParams({ q: query, kind });
  if (cursor) params.set('cursor', cursor);
  return onlinePage<Post | Author>(await requestJson(`/api/search?${params}`));
}

export { CURRENT_USER };
