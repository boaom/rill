// src/device/weibo-direct.ts —— 设备端直连微博 provider。
// 只由 api.ts 在原生分支动态 import；浏览器主包不会包含本文件。
// CapacitorHttp 在原生 WebView 里全局 patch fetch，因此这里照常 fetch 即可绕过 CORS。
import type { Author, FeedTab, MediaRatio, MediaRef, Post, Reply } from '../types';

// 本文件只由原生分支动态 import，设备分块只在原生壳里加载，web 主包不含它；
// AC-G14①② 已守此约定，所以这里可以直白写微博主机，便于检索与维护。
export const WEIBO_ORIGIN = 'https://m.weibo.cn';
export const WEIBO_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
export const TIMEOUT_MS = 10_000;
export const CACHE_TTL_MS = 45_000;
export const CACHE_MAX = 96;
const PAGE_SIZE_HINT = 20;
const WRITE_RATE_LIMIT = 10;
const WRITE_RATE_WINDOW_MS = 60_000;

export type WeiboDirectErrorCode =
  | 'AUTH_EXPIRED'
  | 'RATE_LIMITED'
  | 'RISK_CONTROL'
  | 'NOT_FOUND'
  | 'CONTENT_REJECTED'
  | 'UPSTREAM'
  | 'BAD_INPUT'
  | 'READ_ONLY';

export class WeiboDirectError extends Error {
  code: WeiboDirectErrorCode;
  status: number;
  retryAfter?: number;

  constructor(code: WeiboDirectErrorCode, message: string, status = 0, retryAfter?: number) {
    super(message);
    this.name = 'WeiboDirectError';
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export interface Page<T> {
  items: T[];
  next: string | null;
  hasMore: boolean;
  users: Author[];
}

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

export interface DeviceProviderOptions {
  cookies?: Array<{ name: string; value: string }> | Record<string, string>;
  uid?: string | null;
  fetchImpl?: typeof fetch;
  baseUrl?: string;
  timeoutMs?: number;
  cache?: LruCache;
  writes?: boolean;
}

// ---------------------------------------------------------------- 纯函数

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' ? value as Record<string, unknown> : null;
}

function arrayOf(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function stringOf(value: unknown): string {
  return value === undefined || value === null ? '' : String(value);
}

function numberOr(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hashHue(value: unknown): number {
  let hash = 0;
  const text = stringOf(value);
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
}

export function decodeEntities(text: unknown): string {
  return stringOf(text)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, dec: string) => String.fromCodePoint(Number(dec)));
}

/** 微博 HTML → 纯文本；保留 @、#话题#、图片 alt 的可读文字。 */
export function cleanText(input: unknown): string {
  let text = stringOf(input);
  text = text.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1');
  text = text.replace(/<img[^>]*>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p\s*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = decodeEntities(text);
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

const MONTHS: Record<string, number> = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** 文档实测格式："Fri Jun 14 20:39:20 +0800 2019"（+0800 不是 UTC）。 */
export function parseWeiboTime(value: unknown): number {
  if (value === undefined || value === null || value === '') return 0;
  const text = String(value);
  const match = /^[A-Za-z]{3} ([A-Za-z]{3}) (\d{1,2}) (\d{1,2}):(\d{2}):(\d{2}) ([+-]\d{4}) (\d{4})$/.exec(text);
  if (match) {
    const [, mon, day, hour, minute, second, offset, year] = match;
    const month = MONTHS[mon];
    if (month === undefined) return 0;
    const sign = offset.startsWith('-') ? -1 : 1;
    const offsetMinutes = sign * (Number(offset.slice(1, 3)) * 60 + Number(offset.slice(3, 5)));
    return Date.UTC(Number(year), month, Number(day), Number(hour), Number(minute), Number(second)) - offsetMinutes * 60_000;
  }
  const parsed = Date.parse(text);
  return Number.isFinite(parsed) ? parsed : 0;
}

/** uid 前缀归一：@u123、u123、u_123 都收敛成数字/短 id；不会凭空前缀造值。 */
export function normalizeUid(value: unknown): string {
  let text = stringOf(value).trim().replace(/^@/, '');
  if (/^u_\d+$/.test(text)) text = text.slice(2);
  else if (/^u\d+$/.test(text)) text = text.slice(1);
  return text;
}

export function authorIdOf(user: unknown): string {
  const item = record(user) || {};
  const raw = stringOf(item.idstr ?? item.id).trim();
  if (!raw) return 'u_unknown';
  if (raw.startsWith('u_')) return raw;
  return `u${normalizeUid(raw)}`;
}

/** verified 优先；只有明确 true 才返回 true。缺字段/0/false/-1 一律 undefined。 */
export function verifiedFromUser(user: unknown): true | undefined {
  const item = record(user) || {};
  const direct = item.verified;
  if (direct !== undefined && direct !== null && direct !== '') {
    return direct === true || direct === 1 || direct === '1' || direct === 'true' ? true : undefined;
  }
  const type = item.verified_type ?? item.verifiedType;
  if (type === undefined || type === null || type === '') return undefined;
  const numeric = Number(type);
  return Number.isFinite(numeric) && numeric > 0 ? true : undefined;
}

/** 上游 source/from 是 HTML；取纯文本、去标签、折叠空白并截到 24 个 Unicode 码点。 */
export function sourceFromMblog(mblog: unknown): string | undefined {
  const item = record(mblog) || {};
  const raw = item.source ?? item.from;
  if (raw === undefined || raw === null || raw === '') return undefined;
  let text = cleanText(raw).replace(/[<>]/g, '').replace(/&/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return Array.from(text).slice(0, 24).join('');
}

export function topicsFromText(text: unknown): string[] {
  const out: string[] = [];
  for (const match of stringOf(text).matchAll(/#([^#\s]{1,40})#/g)) {
    if (!out.includes(match[1])) out.push(match[1]);
  }
  return out;
}

export function ratioOf(geo: unknown): MediaRatio {
  const item = record(geo) || {};
  const width = numberOr(item.width);
  const height = numberOr(item.height);
  if (!width || !height) return 'square';
  const ratio = width / height;
  if (ratio > 1.2) return 'wide';
  if (ratio < 0.8) return 'tall';
  return 'square';
}

export function mediaFromMblog(mblog: unknown): MediaRef[] {
  const item = record(mblog) || {};
  const pics = arrayOf(item.pics);
  if (pics.length) {
    return pics.slice(0, 9).map((pic, index) => {
      const value = record(pic) || {};
      const pid = value.pid ?? value.id ?? `${idOfMblog(mblog)}_${index}`;
      return {
        id: String(pid),
        hue: hashHue(pid),
        ratio: ratioOf(value.geo),
        alt: `图片 ${index + 1}`,
      };
    });
  }
  return arrayOf(item.pic_ids).slice(0, 9).map((pid, index) => ({
    id: String(pid),
    hue: hashHue(pid),
    ratio: 'square',
    alt: `图片 ${index + 1}`,
  }));
}

export function idOfMblog(object: unknown, depth = 0): string {
  const item = record(object);
  if (!item) return '';
  const id = item.idstr ?? item.id ?? item.mid ?? item.bid;
  if (id !== undefined && id !== null && String(id) !== '') return String(id);
  const data = record(item.data);
  return depth < 2 && data ? idOfMblog(data, depth + 1) : '';
}

export function unwrapPayload(payload: unknown): Record<string, unknown> {
  const item = record(payload);
  if (!item) return {};
  const data = record(item.data);
  if (data && item.ok !== undefined) return data;
  return item;
}

export function authorFromUser(user: unknown, currentUid: string | null = null): Author {
  const item = record(user) || {};
  const rawId = stringOf(item.idstr ?? item.id).trim();
  const id = authorIdOf(user);
  const screenName = stringOf(item.screen_name ?? item.screenName).trim();
  const avatarText = Array.from(screenName).slice(0, 2).join('') || (rawId ? rawId.slice(-2) : '?');
  const verified = verifiedFromUser(user);
  return {
    id,
    nickname: screenName || (rawId ? `用户${rawId}` : '未知用户'),
    handle: rawId ? `u${normalizeUid(rawId)}` : 'unknown',
    avatarText,
    avatarHue: hashHue(rawId || screenName || id),
    bio: stringOf(item.description),
    followingCount: numberOr(item.follow_count),
    followerCount: numberOr(item.followers_count),
    postCount: numberOr(item.statuses_count),
    isCurrentUser: Boolean(currentUid && rawId && normalizeUid(currentUid) === normalizeUid(rawId)),
    ...(verified === true ? { verified: true } : {}),
  };
}

export function mblogListFromCards(payload: unknown): { mblogs: unknown[]; data: Record<string, unknown>; cards: unknown[] } {
  const data = unwrapPayload(payload);
  const cards = arrayOf(data.cards);
  const mblogs: unknown[] = [];
  for (const card of cards) {
    const item = record(card);
    if (!item) continue;
    if (item.mblog) mblogs.push(item.mblog);
    for (const group of arrayOf(item.card_group)) {
      const nested = record(group);
      if (nested?.mblog) mblogs.push(nested.mblog);
    }
  }
  return { mblogs, data, cards };
}

export function normalizePostFields(mblog: unknown): Omit<Post, 'authorId'> & { authorId: string } | null {
  const item = record(mblog);
  if (!item) return null;
  const id = idOfMblog(mblog);
  if (!id) return null;
  const retweeted = record(item.retweeted_status);
  const text = cleanText(item.raw_text || item.text || '');
  const source = sourceFromMblog(mblog);
  return {
    id,
    authorId: authorIdOf(item.user),
    text,
    ...(source ? { source } : {}),
    media: mediaFromMblog(mblog),
    topics: topicsFromText(text),
    repostOfId: retweeted ? (idOfMblog(retweeted) || null) : null,
    createdAt: parseWeiboTime(item.created_at),
    counts: {
      reposts: numberOr(item.reposts_count),
      replies: numberOr(item.comments_count),
      likes: numberOr(item.attitudes_count),
    },
  };
}

/** 错误分类的纯函数：状态码/跳转/payload 三者任一命中即可；Web 端与测试复用。 */
export function classifyPayloadError(payload: unknown, status = 200, write = false): WeiboDirectErrorCode | null {
  const item = record(payload);
  if (!item) return null;
  const ok = item.ok;
  if (ok === 0 || ok === false || ok === '0') {
    const errno = numberOr(item.errno, Number.NaN);
    const message = stringOf(item.msg ?? item.message);
    if ([21301, 21327, 21332, 21314].includes(errno)) return 'AUTH_EXPIRED';
    if ([432, 418].includes(errno)) return 'RISK_CONTROL';
    if (/频繁|太快|too\s*fast|rate/i.test(message)) return 'RATE_LIMITED';
    if (/安全|验证|风控|risk|captcha|异常/i.test(message)) return 'RISK_CONTROL';
    if (/不存在|已删除|不可见|not\s*found/i.test(message)) return 'NOT_FOUND';
    if (write && /敏感|违规|非法|不合法|禁止|广告|营销|垃圾|重复|超长|太长|字数|为空|不能为空|审核|拒绝/.test(message)) return 'CONTENT_REJECTED';
    return 'UPSTREAM';
  }
  if (status === 200 && ok === undefined && item.data === undefined) return null;
  const login = record(item.data)?.login;
  if (login === false || login === 0) return 'AUTH_EXPIRED';
  return null;
}

export function classifyHttpError(status: number, location: string | null, payload: unknown, bodyText: string): WeiboDirectErrorCode | null {
  if (status >= 200 && status < 300) return classifyPayloadError(payload, status);
  if (status >= 300 && status < 400) return 'AUTH_EXPIRED';
  if (status === 401) return 'AUTH_EXPIRED';
  if (status === 403 || status === 432 || status === 418) return 'RISK_CONTROL';
  if (status === 429) return 'RATE_LIMITED';
  if (status === 404) return 'NOT_FOUND';
  if (status === 422) return 'CONTENT_REJECTED';
  if (status >= 500) return 'UPSTREAM';
  if (/<html|登录|signin|passport/i.test(bodyText || '') && /passport|signin|login/i.test(location || '')) return 'AUTH_EXPIRED';
  return 'UPSTREAM';
}

export class LruCache {
  private map = new Map<string, { value: unknown; at: number }>();
  private max: number;
  private ttlMs: number;

  constructor(max = CACHE_MAX, ttlMs = CACHE_TTL_MS) {
    this.max = max;
    this.ttlMs = ttlMs;
  }

  get<T>(key: string): T | null {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value as T;
  }

  set(key: string, value: unknown): void {
    this.map.delete(key);
    this.map.set(key, { value, at: Date.now() });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value as string | undefined;
      if (oldest) this.map.delete(oldest);
    }
  }

  clear(): void {
    this.map.clear();
  }
}

/** 本地分钟桶：写操作最多 10 次/分钟；不做任何重试。 */
export class MinuteBucket {
  private hits: number[] = [];
  private limit: number;
  private windowMs: number;

  constructor(limit = WRITE_RATE_LIMIT, windowMs = WRITE_RATE_WINDOW_MS) {
    this.limit = limit;
    this.windowMs = windowMs;
  }

  take(now = Date.now()): void {
    this.hits = this.hits.filter((at) => now - at < this.windowMs);
    if (this.hits.length >= this.limit) {
      throw new WeiboDirectError('RATE_LIMITED', '操作太频繁，请等一分钟再试', 429);
    }
    this.hits.push(now);
  }
}

// 未实测端点一键降级：like/comment 的 m 站端点名来自公开实现，拿不到实测证据。
let writesEnabled = true;
let unverifiedWritesEnabled = true;

export function setDeviceWritesEnabled(enabled: boolean): void {
  writesEnabled = Boolean(enabled);
}

export function areDeviceWritesEnabled(): boolean {
  return writesEnabled;
}

export function setUnverifiedWritesEnabled(enabled: boolean): void {
  unverifiedWritesEnabled = Boolean(enabled);
}

export function areUnverifiedWritesEnabled(): boolean {
  return unverifiedWritesEnabled;
}

export interface DeviceCapabilities {
  read: true;
  write: boolean;
  images: false;
  unverifiedWrites: boolean;
}

export function deviceCapabilities(): DeviceCapabilities {
  return { read: true, write: writesEnabled, images: false, unverifiedWrites: unverifiedWritesEnabled };
}

// ---------------------------------------------------------------- provider

function cookieHeaderOf(cookies: Record<string, string>): string {
  return Object.entries(cookies)
    .filter(([name, value]) => name && value !== undefined && value !== null && value !== '')
    .map(([name, value]) => `${name}=${value}`)
    .join('; ');
}

function digestOf(cookies: Record<string, string>): string {
  let hash = 0;
  const text = Object.entries(cookies).sort(([a], [b]) => a.localeCompare(b)).map(([name, value]) => `${name}=${value}`).join('\n');
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

function toCookieRecord(input: DeviceProviderOptions['cookies']): Record<string, string> {
  const out: Record<string, string> = {};
  if (Array.isArray(input)) {
    for (const cookie of input) {
      if (cookie && cookie.name && cookie.value) out[cookie.name] = cookie.value;
    }
  } else if (input && typeof input === 'object') {
    for (const [name, value] of Object.entries(input)) {
      if (name && value !== undefined && value !== null && value !== '') out[name] = String(value);
    }
  }
  return out;
}

export class WeiboDirectProvider {
  capabilities = { read: true, write: true, images: false };
  cookies: Record<string, string>;
  uid: string | null;
  baseUrl: string;
  fetchImpl: typeof fetch;
  timeoutMs: number;
  cache: LruCache;
  scope: string;
  lastUsers: Author[] = [];
  lastPostId: string | null = null;
  lastMid: string | null = null;
  lastPublishNotice = '';
  lastPublishPending = false;
  private xsrfToken: string | null = null;
  private xsrfFetchedAt = 0;
  private limiter = new MinuteBucket();
  private publishCache = new Map<string, { at: number; result: WritePostResult }>();
  private pendingPostCounter = 0;

  constructor(options: DeviceProviderOptions = {}) {
    this.cookies = toCookieRecord(options.cookies);
    this.uid = options.uid ? normalizeUid(options.uid) : null;
    this.baseUrl = String(options.baseUrl || WEIBO_ORIGIN).replace(/\/+$/, '');
    this.fetchImpl = options.fetchImpl || globalThis.fetch;
    this.timeoutMs = Number(options.timeoutMs) > 0 ? Number(options.timeoutMs) : TIMEOUT_MS;
    this.cache = options.cache || new LruCache();
    this.scope = `uid:${this.uid || 'anon'}|cookie:${digestOf(this.cookies)}`;
    if (options.writes === false) writesEnabled = false;
  }

  cookieHeader(): string {
    return cookieHeaderOf(this.cookies);
  }

  requireCookie(): void {
    if (!this.cookies.SUB) throw new WeiboDirectError('AUTH_EXPIRED', '缺少 SUB cookie，请重新登录');
  }

  headers(write = false): Record<string, string> {
    const headers: Record<string, string> = {
      'User-Agent': WEIBO_UA,
      Accept: 'application/json, text/plain, */*',
      Referer: `${this.baseUrl}/`,
      'MWeibo-Pwa': '1',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    if (write) {
      headers.Origin = this.baseUrl;
      headers.Referer = `${this.baseUrl}/compose/`;
    }
    return headers;
  }

  private async request(
    path: string,
    params: Record<string, unknown> = {},
    options: { method?: string; body?: string; cacheable?: boolean; write?: boolean; headers?: Record<string, string>; redirect?: RequestRedirect } = {},
  ): Promise<unknown> {
    const method = options.method || 'GET';
    const url = new URL(path, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const cacheKey = options.cacheable ? `${this.scope}|${method}|${url.pathname}|${url.search}` : null;
    const cached = cacheKey ? this.cache.get<unknown>(cacheKey) : null;
    if (cached !== null) return cached;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let response: Response;
    try {
      response = await this.fetchImpl(url.toString(), {
        method,
        headers: { ...this.headers(options.write), ...(options.headers || {}) },
        body: options.body,
        redirect: options.redirect || 'manual',
        signal: controller.signal,
        credentials: 'omit',
      });
    } catch (error) {
      const message = error instanceof Error && error.name === 'AbortError' ? '微博请求超时' : '微博连接失败';
      throw new WeiboDirectError('UPSTREAM', message, 0);
    } finally {
      clearTimeout(timer);
    }

    if (response.type === 'opaqueredirect' || (response.status === 0 && response.type !== 'basic')) {
      throw new WeiboDirectError('AUTH_EXPIRED', '登录已过期，请重新粘贴 Cookie', 302);
    }

    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    const location = response.headers.get('location');
    const code = classifyHttpError(response.status, location, payload, text);
    if (code) {
      const retryAfter = response.headers.get('retry-after');
      throw new WeiboDirectError(code, errorMessage(code, payload, text), response.status, retryAfter ? Number(retryAfter) : undefined);
    }
    if (cacheKey) this.cache.set(cacheKey, payload);
    return payload;
  }

  async getConfig(): Promise<Record<string, unknown>> {
    const payload = await this.request('/api/config', {}, { cacheable: false });
    return unwrapPayload(payload);
  }

  /** 登录态校验 + uid 兜底；只保存 token 到内存，不打印。 */
  async validateSession(): Promise<{ authenticated: boolean; uid: string | null; screenName: string }> {
    this.requireCookie();
    const data = await this.getConfig();
    if (data.login !== true && data.login !== 1) throw new WeiboDirectError('AUTH_EXPIRED', '微博显示未登录');
    const rawUid = data.uid ?? record(data.user)?.idstr ?? record(data.user)?.id ?? record(data.userInfo)?.idstr ?? record(data.userInfo)?.id ?? null;
    this.uid = rawUid !== null && rawUid !== undefined && String(rawUid) !== '' ? normalizeUid(rawUid) : null;
    this.scope = `uid:${this.uid || 'anon'}|cookie:${digestOf(this.cookies)}`;
    return {
      authenticated: true,
      uid: this.uid,
      screenName: stringOf(record(data.user)?.screen_name ?? data.screen_name ?? record(data.userInfo)?.screen_name),
    };
  }

  private async textFor(mblog: unknown): Promise<string> {
    const item = record(mblog) || {};
    let text = cleanText(item.raw_text || item.text || '');
    if (!item.isLongText) return text;
    const id = idOfMblog(mblog);
    if (!id) return text;
    try {
      const payload = await this.request('/statuses/extend', { id }, { cacheable: true });
      const data = unwrapPayload(payload);
      const html = data.longTextContent ?? data.long_text_content ?? record(payload)?.longTextContent;
      if (html) text = cleanText(html);
    } catch {
      // 长文扩展失败时保留已截断正文，不让详情整页失败。
    }
    return text;
  }

  private addUser(users: Author[], seen: Set<string>, user: unknown): void {
    if (!user || typeof user !== 'object') return;
    const author = authorFromUser(user, this.uid);
    if (!seen.has(author.id)) {
      seen.add(author.id);
      users.push(author);
    }
  }

  private async postFromMblog(mblog: unknown, users: Author[], seen: Set<string>): Promise<Post | null> {
    const item = record(mblog);
    if (!item) return null;
    this.addUser(users, seen, item.user);
    const retweeted = record(item.retweeted_status);
    if (retweeted?.user) this.addUser(users, seen, retweeted.user);
    const text = await this.textFor(mblog);
    const id = idOfMblog(mblog);
    if (!id) return null;
    const source = sourceFromMblog(mblog);
    return {
      id,
      authorId: authorIdOf(item.user),
      text,
      ...(source ? { source } : {}),
      media: mediaFromMblog(mblog),
      topics: topicsFromText(text),
      repostOfId: retweeted ? (idOfMblog(retweeted) || null) : null,
      createdAt: parseWeiboTime(item.created_at),
      counts: {
        reposts: numberOr(item.reposts_count),
        replies: numberOr(item.comments_count),
        likes: numberOr(item.attitudes_count),
      },
    };
  }

  private async pageFromContainer(containerid: string, cursor: string | null): Promise<Page<Post>> {
    const page = Math.max(1, Number(cursor || 1) || 1);
    const payload = await this.request('/api/container/getIndex', { containerid, page }, { cacheable: true });
    const { mblogs } = mblogListFromCards(payload);
    const users: Author[] = [];
    const seen = new Set<string>();
    const items: Post[] = [];
    for (const mblog of mblogs.slice(0, PAGE_SIZE_HINT)) {
      const post = await this.postFromMblog(mblog, users, seen);
      if (post) items.push(post);
    }
    return {
      items,
      next: mblogs.length ? String(page + 1) : null,
      hasMore: mblogs.length > 0,
      users,
    };
  }

  async getTimeline(tab: FeedTab, cursor: string | null = null): Promise<Page<Post>> {
    this.requireCookie();
    const containerid = tab === 'following' ? '231093_-_selffollowed' : '102803';
    return this.pageFromContainer(containerid, cursor);
  }

  async getStatus(id: string): Promise<Post> {
    this.requireCookie();
    const key = String(id || '');
    if (!key) throw new WeiboDirectError('NOT_FOUND', '缺少微博 id', 404);
    const payload = await this.request('/statuses/show', { id: key }, { cacheable: true });
    const data = unwrapPayload(payload);
    const mblog = data.mblog || data;
    const users: Author[] = [];
    const seen = new Set<string>();
    const post = await this.postFromMblog(mblog, users, seen);
    if (!post) throw new WeiboDirectError('NOT_FOUND', '微博不存在', 404);
    this.lastUsers = users;
    this.lastPostId = post.id;
    const raw = record(mblog) || {};
    this.lastMid = stringOf(raw.mid ?? raw.midstr ?? raw.idstr ?? raw.id ?? post.id);
    return post;
  }

  async getComments(postId: string, cursor: string | null = null): Promise<Page<Reply>> {
    this.requireCookie();
    const id = String(postId || '');
    if (!id) throw new WeiboDirectError('NOT_FOUND', '缺少微博 id', 404);
    let maxId: string | null = null;
    let maxIdType = '0';
    if (cursor) {
      const [left, right] = String(cursor).split('|');
      maxId = left || null;
      maxIdType = right || '0';
    }
    const mid = this.lastPostId === id && this.lastMid ? this.lastMid : id;
    const params: Record<string, unknown> = { id, mid, max_id_type: maxIdType };
    if (maxId) params.max_id = maxId;
    const payload = await this.request('/comments/hotflow', params, { cacheable: true });
    const data = unwrapPayload(payload);
    const comments = arrayOf(data.data).length ? arrayOf(data.data) : arrayOf(record(record(payload)?.data)?.data);
    const users: Author[] = [];
    const seen = new Set<string>();
    const items: Reply[] = [];
    for (const comment of comments) {
      const item = record(comment);
      if (!item) continue;
      this.addUser(users, seen, item.user);
      const rootId = item.rootid ?? item.id;
      const idValue = String(item.idstr ?? item.id ?? '');
      const reply: Reply = {
        id: idValue,
        postId: id,
        authorId: authorIdOf(item.user),
        text: cleanText(item.text || item.raw_text || ''),
        createdAt: parseWeiboTime(item.created_at),
        replyToReplyId: String(rootId) === String(item.id) ? null : String(rootId),
      };
      if (reply.id) items.push(reply);
      for (const child of arrayOf(item.comments)) {
        const nested = record(child);
        if (!nested) continue;
        this.addUser(users, seen, nested.user);
        const childRoot = nested.rootid ?? item.rootid ?? item.id;
        const childId = String(nested.idstr ?? nested.id ?? '');
        const childReply: Reply = {
          id: childId,
          postId: id,
          authorId: authorIdOf(nested.user),
          text: cleanText(nested.text || nested.raw_text || ''),
          createdAt: parseWeiboTime(nested.created_at),
          replyToReplyId: String(childRoot) === String(item.id) ? String(item.id) : (childRoot ? String(childRoot) : String(item.id)),
        };
        if (childReply.id) items.push(childReply);
      }
    }
    const nextId = data.max_id ?? data.maxId ?? null;
    const hasMore = nextId !== null && String(nextId) !== '0' && String(nextId) !== '';
    return {
      items,
      next: hasMore ? `${nextId}|${data.max_id_type ?? maxIdType}` : null,
      hasMore,
      users,
    };
  }

  async getUser(uid: string): Promise<Author> {
    this.requireCookie();
    const value = normalizeUid(uid);
    if (!value) throw new WeiboDirectError('NOT_FOUND', '缺少 uid', 404);
    const payload = await this.request('/api/container/getIndex', { type: 'uid', value }, { cacheable: true });
    const data = unwrapPayload(payload);
    const user = data.userInfo || data.user;
    if (!user) throw new WeiboDirectError('NOT_FOUND', '用户不存在', 404);
    return authorFromUser(user, this.uid);
  }

  async getUserPosts(uid: string, cursor: string | null = null): Promise<Page<Post>> {
    this.requireCookie();
    const value = normalizeUid(uid);
    if (!value) throw new WeiboDirectError('NOT_FOUND', '缺少 uid', 404);
    return this.pageFromContainer(`107603${value}`, cursor);
  }

  async search(query: string, kind: 'statuses' | 'users' | 'topics' = 'statuses', cursor: string | null = null): Promise<Page<Post | Author>> {
    this.requireCookie();
    const q = String(query || '').trim();
    if (!q) throw new WeiboDirectError('NOT_FOUND', '搜索词为空', 404);
    const type = kind === 'users' ? 2 : kind === 'topics' ? 3 : 1;
    const page = Math.max(1, Number(cursor || 1) || 1);
    const containerid = `100103type=${type}&q=${q}`;
    const payload = await this.request('/api/container/getIndex', { containerid, page }, { cacheable: true });
    const data = unwrapPayload(payload);
    const cards = arrayOf(data.cards);
    const users: Author[] = [];
    const seen = new Set<string>();
    const items: Array<Post | Author> = [];
    if (type === 1) {
      for (const card of cards) {
        const item = record(card);
        if (!item) continue;
        const mblogs: unknown[] = [];
        if (item.mblog) mblogs.push(item.mblog);
        for (const group of arrayOf(item.card_group)) {
          const nested = record(group);
          if (nested?.mblog) mblogs.push(nested.mblog);
        }
        for (const mblog of mblogs) {
          const post = await this.postFromMblog(mblog, users, seen);
          if (post) items.push(post);
        }
      }
    } else if (type === 2) {
      for (const card of cards) {
        const item = record(card) || {};
        const nested = arrayOf(item.card_group).map(record).find((value) => value?.user);
        const user = item.user || nested?.user;
        if (user) {
          this.addUser(users, seen, user);
          items.push(authorFromUser(user, this.uid));
        }
      }
    } else {
      for (const card of cards) {
        const item = record(card) || {};
        const nested = arrayOf(item.card_group).map(record).find((value) => value?.title);
        const title = item.title || item.desc || nested?.title;
        if (title) {
          const text = String(title);
          items.push({
            id: `topic:${text}`,
            nickname: text,
            handle: 'topic',
            avatarText: Array.from(text).slice(0, 2).join(''),
            avatarHue: hashHue(text),
            bio: '',
            followingCount: 0,
            followerCount: 0,
            postCount: 0,
            isCurrentUser: false,
          });
        }
      }
    }
    return {
      items,
      next: cards.length ? String(page + 1) : null,
      hasMore: cards.length > 0,
      users,
    };
  }

  // ---------------------------------------------------------------- 写操作

  private assertWrites(): void {
    if (!writesEnabled) throw new WeiboDirectError('READ_ONLY', '当前为只读模式，写操作已关闭', 0);
    this.limiter.take();
  }

  private assertUnverifiedWrites(): void {
    if (!unverifiedWritesEnabled) throw new WeiboDirectError('READ_ONLY', '当前为只读模式：点赞/评论端点尚未实测，已关闭', 0);
  }

  private async getXsrfToken(): Promise<string> {
    const now = Date.now();
    if (this.xsrfToken && now - this.xsrfFetchedAt < 5 * 60_000) return this.xsrfToken;
    let token = String(this.cookies['XSRF-TOKEN'] || '');
    const data = await this.getConfig();
    if (data.login === false || data.login === 0) throw new WeiboDirectError('AUTH_EXPIRED', '微博 /api/config 显示未登录');
    if (data.st) token = String(data.st);
    if (!token) throw new WeiboDirectError('AUTH_EXPIRED', '缺少 XSRF token，请重新登录');
    this.xsrfToken = token;
    this.xsrfFetchedAt = now;
    return token;
  }

  private async writeForm(path: string, params: Record<string, unknown>): Promise<unknown> {
    const token = await this.getXsrfToken();
    const body = new URLSearchParams();
    for (const [key, value] of Object.entries({ ...params, st: token })) {
      if (value !== undefined && value !== null) body.set(key, String(value));
    }
    // 写请求只发一次：不重试、不因 5xx/网络错误自动重发。
    return this.request(path, {}, {
      method: 'POST',
      body: body.toString(),
      cacheable: false,
      write: true,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-XSRF-TOKEN': token,
      },
    });
  }

  private checkWriteText(text: unknown, required = true, max = 140): string {
    const value = String(text ?? '').trim();
    if (required && !value) throw new WeiboDirectError('CONTENT_REJECTED', '内容不能为空', 422);
    if (Array.from(value).length > max) throw new WeiboDirectError('CONTENT_REJECTED', `内容超过 ${max} 字`, 422);
    return value;
  }

  private async midFor(id: string): Promise<string> {
    if (this.lastPostId === id && this.lastMid) return this.lastMid;
    try {
      await this.getStatus(id);
      return this.lastMid || id;
    } catch (error) {
      if (error instanceof WeiboDirectError && (error.code === 'AUTH_EXPIRED' || error.code === 'RISK_CONTROL')) throw error;
      return id;
    }
  }

  private pendingPost(text: string, repostOfId: string | null = null): Post {
    this.pendingPostCounter += 1;
    const suffix = `${Date.now()}_${this.pendingPostCounter}`;
    return {
      id: `pending_${suffix}`,
      authorId: this.uid ? `u${this.uid}` : 'u_me',
      text,
      media: [],
      topics: topicsFromText(text),
      repostOfId,
      createdAt: Date.now(),
      counts: { reposts: 0, replies: 0, likes: 0 },
    };
  }

  async like(id: string, on: boolean): Promise<LikeResult> {
    this.requireCookie();
    this.assertWrites();
    this.assertUnverifiedWrites();
    const key = String(id || '').trim();
    if (!key) throw new WeiboDirectError('NOT_FOUND', '缺少微博 id', 404);
    if (typeof on !== 'boolean') throw new WeiboDirectError('BAD_INPUT', 'like 需要 on=true/false', 400);
    const payload = await this.writeForm(on ? '/api/attitudes/like' : '/api/attitudes/unlike', { id: key });
    const data = unwrapPayload(payload);
    return {
      liked: data.liked === undefined ? on : Boolean(data.liked),
      count: numberOr(data.attitudes_count ?? data.attitudesCount ?? data.count),
    };
  }

  async repost(id: string, text = ''): Promise<WritePostResult> {
    this.requireCookie();
    this.assertWrites();
    const key = String(id || '').trim();
    if (!key) throw new WeiboDirectError('NOT_FOUND', '缺少微博 id', 404);
    const content = this.checkWriteText(text, false);
    const mid = await this.midFor(key);
    const payload = await this.writeForm('/api/statuses/repost', { id: key, mid, content });
    const data = unwrapPayload(payload);
    const mblog = data.mblog || data.status || (idOfMblog(data) ? data : null);
    const users: Author[] = [];
    const post = mblog ? await this.postFromMblog(mblog, users, new Set()) : null;
    const result = post || this.pendingPost(content, key);
    if (!result.repostOfId) result.repostOfId = key;
    this.lastUsers = users;
    return { post: result };
  }

  async comment(id: string, text: string, replyTo: string | null = null): Promise<WriteReplyResult> {
    this.requireCookie();
    this.assertWrites();
    this.assertUnverifiedWrites();
    const key = String(id || '').trim();
    if (!key) throw new WeiboDirectError('NOT_FOUND', '缺少微博 id', 404);
    const content = this.checkWriteText(text, true);
    const mid = await this.midFor(key);
    const params: Record<string, unknown> = { id: key, mid, content };
    if (replyTo) params.cid = String(replyTo);
    const payload = await this.writeForm('/api/comments/create', params);
    const data = unwrapPayload(payload);
    const source = data.comment || (idOfMblog(data) ? data : null);
    const sourceRecord = record(source) || {};
    const user = record(sourceRecord.user);
    const reply: Reply = source ? {
      id: String(sourceRecord.idstr ?? sourceRecord.id ?? `c_${Date.now()}`),
      postId: key,
      authorId: authorIdOf(user),
      text: cleanText(sourceRecord.text || sourceRecord.raw_text || content),
      createdAt: parseWeiboTime(sourceRecord.created_at) || Date.now(),
      replyToReplyId: replyTo ? String(replyTo) : null,
    } : {
      id: `c_pending_${Date.now()}`,
      postId: key,
      authorId: this.uid ? `u${this.uid}` : 'u_me',
      text: content,
      createdAt: Date.now(),
      replyToReplyId: replyTo ? String(replyTo) : null,
    };
    return { reply };
  }

  async publish(text: string, pics: MediaRef[] = [], key?: string): Promise<WritePostResult> {
    this.requireCookie();
    this.assertWrites();
    this.lastPublishNotice = '';
    this.lastPublishPending = false;
    const content = this.checkWriteText(text, true);
    if (key) {
      const cached = this.publishCache.get(key);
      if (cached && Date.now() - cached.at < 10 * 60_000) return cached.result;
    }
    if (pics.length) this.lastPublishNotice = '图片只是占位，没有二进制内容；已按纯文本发布。';
    const payload = await this.writeForm('/api/statuses/update', { content });
    const data = unwrapPayload(payload);
    const mblog = data.mblog || data.status || (idOfMblog(data) ? data : null);
    const users: Author[] = [];
    const post = mblog ? await this.postFromMblog(mblog, users, new Set()) : null;
    const result: WritePostResult = post
      ? { post, notice: this.lastPublishNotice || undefined }
      : { post: this.pendingPost(content), notice: this.lastPublishNotice || undefined, pending: true };
    this.lastPublishPending = Boolean(result.pending);
    this.lastUsers = users;
    if (key) this.publishCache.set(key, { at: Date.now(), result });
    return result;
  }
}

function errorMessage(code: WeiboDirectErrorCode, payload: unknown, bodyText: string): string {
  const item = record(payload);
  const message = stringOf(item?.msg ?? item?.message);
  if (message) return message;
  if (bodyText && !bodyText.startsWith('{') && bodyText.length < 120) return bodyText;
  switch (code) {
    case 'AUTH_EXPIRED': return '登录已过期，请重新登录';
    case 'RATE_LIMITED': return '操作太频繁，请稍后再试';
    case 'RISK_CONTROL': return '触发了微博风控，请稍后再试';
    case 'NOT_FOUND': return '内容不存在或不可见';
    case 'CONTENT_REJECTED': return '内容被拒绝';
    case 'READ_ONLY': return '当前为只读模式';
    case 'BAD_INPUT': return '请求参数不正确';
    default: return '微博服务暂时不可用';
  }
}

export function createDeviceProvider(options: DeviceProviderOptions = {}): WeiboDirectProvider {
  return new WeiboDirectProvider(options);
}
