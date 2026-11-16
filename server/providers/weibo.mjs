// server/providers/weibo.mjs —— 微博 m.weibo.cn 只读 provider（t18）。
// 契约：docs/weibo-api.md §2–§5；错误分类 §5.1；字段映射 §5.2。
// 零 npm 依赖，只使用 Node 26 自带的 fetch / AbortSignal。
//
// 安全约束：
//  - 本文件不打印任何 cookie；请求头只在本进程内使用。
//  - 真实 cookie 由调用方从加密会话解密后传入；这里只接收对象，不落盘。
import { createHash } from 'node:crypto';

const BASE = process.env.RILL_WEIBO_BASE || 'https://m.weibo.cn';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1';
const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 45_000;
const CACHE_MAX = 96;

// ---------------------------------------------------------------- 错误

export const WEIBO_ERROR_CODES = Object.freeze({
  AUTH_EXPIRED: 'AUTH_EXPIRED',
  RATE_LIMITED: 'RATE_LIMITED',
  RISK_CONTROL: 'RISK_CONTROL',
  NOT_FOUND: 'NOT_FOUND',
  CONTENT_REJECTED: 'CONTENT_REJECTED',
  UPSTREAM: 'UPSTREAM',
});

export class WeiboError extends Error {
  constructor(code, detail, status = null) {
    super(String(detail && detail.message ? detail.message : code));
    this.name = 'WeiboError';
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

function authError(detail) {
  return new WeiboError(WEIBO_ERROR_CODES.AUTH_EXPIRED, detail || '登录已过期');
}
function notFound(detail) {
  return new WeiboError(WEIBO_ERROR_CODES.NOT_FOUND, detail || '内容不存在或不可见');
}
function contentRejected(detail) {
  return new WeiboError(WEIBO_ERROR_CODES.CONTENT_REJECTED, detail || '微博拒绝了这段内容');
}
function isContentRejectMessage(message) {
  return /敏感|违规|非法|不合法|禁止|广告|营销|垃圾|重复|超长|太长|字数|为空|不能为空|内容.*(审核|拒绝|不合规|不通过)|审核/.test(String(message || ''));
}

// ---------------------------------------------------------------- 缓存

class LruCache {
  constructor(max = CACHE_MAX, ttlMs = CACHE_TTL_MS) {
    this.max = max;
    this.ttlMs = ttlMs;
    this.map = new Map();
  }
  get(key) {
    const hit = this.map.get(key);
    if (!hit) return null;
    if (Date.now() - hit.at > this.ttlMs) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, hit);
    return hit.value;
  }
  set(key, value) {
    this.map.delete(key);
    this.map.set(key, { value, at: Date.now() });
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
  clear() {
    this.map.clear();
  }
}

// 所有 provider 共享一个进程内 LRU；key 含账号指纹 + 接口 + 参数。
const sharedCache = new LruCache();

function cacheScope(cookies, uid) {
  // 只在内存里做不可逆摘要，绝不把 cookie 值写到日志或响应。
  const digest = createHash('sha256')
    .update(Object.entries(cookies).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n'))
    .digest('hex')
    .slice(0, 16);
  return `uid:${uid || 'anon'}|cookie:${digest}`;
}

// ---------------------------------------------------------------- 小工具

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function hashHue(value) {
  let hash = 0;
  const text = String(value ?? '');
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  return hash % 360;
}

function idOf(object, depth = 0) {
  if (!object || typeof object !== 'object') return '';
  const id = object.idstr ?? object.id ?? object.mid ?? object.bid;
  if (id !== undefined && id !== null && String(id) !== '') return String(id);
  return depth < 2 && object.data && typeof object.data === 'object' ? idOf(object.data, depth + 1) : '';
}

function unwrapPayload(payload) {
  if (payload && typeof payload === 'object' && payload.data && typeof payload.data === 'object' && payload.ok !== undefined) {
    return payload.data;
  }
  return payload;
}

function decodeEntities(text) {
  return String(text ?? '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCodePoint(Number(dec)));
}

/** 微博 HTML → 纯文本；保留 @、#话题#、t.cn 短链的可读文字。 */
function cleanText(input) {
  let text = String(input ?? '');
  text = text.replace(/<img[^>]*alt=["']([^"']*)["'][^>]*>/gi, '$1');
  text = text.replace(/<img[^>]*>/gi, '');
  text = text.replace(/<br\s*\/?>/gi, '\n');
  text = text.replace(/<\/p\s*>/gi, '\n');
  text = text.replace(/<[^>]+>/g, '');
  text = decodeEntities(text);
  return text.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

function textOfMblog(mblog) {
  // raw_text 通常保留原始短链、@ 与话题；优先它，避免 HTML 清洗吞掉语义。
  return cleanText(mblog?.raw_text || mblog?.text || '');
}

const MONTHS = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

/** "Fri Jun 14 20:39:20 +0800 2019"（+0800 不是 UTC）。 */
export function parseWeiboTime(value) {
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

function topicsFromText(text) {
  const out = [];
  for (const match of String(text ?? '').matchAll(/#([^#\s]{1,40})#/g)) {
    if (!out.includes(match[1])) out.push(match[1]);
  }
  return out;
}

function ratioOf(geo) {
  const width = Number(geo?.width);
  const height = Number(geo?.height);
  if (!width || !height) return 'square';
  const ratio = width / height;
  if (ratio > 1.2) return 'wide';
  if (ratio < 0.8) return 'tall';
  return 'square';
}

function mediaFromMblog(mblog) {
  const pics = Array.isArray(mblog?.pics) ? mblog.pics : [];
  if (pics.length) {
    return pics.slice(0, 9).map((pic, index) => {
      const pid = pic?.pid ?? pic?.id ?? `${idOf(mblog)}_${index}`;
      return {
        id: String(pid),
        hue: hashHue(pid),
        ratio: ratioOf(pic?.geo),
        alt: `图片 ${index + 1}`,
      };
    });
  }
  const ids = Array.isArray(mblog?.pic_ids) ? mblog.pic_ids : [];
  return ids.slice(0, 9).map((pid, index) => ({
    id: String(pid),
    hue: hashHue(pid),
    ratio: 'square',
    alt: `图片 ${index + 1}`,
  }));
}

function authorIdOf(user) {
  const raw = String(user?.idstr ?? user?.id ?? '').trim();
  if (!raw) return 'u_unknown';
  // 微博数字 uid 派生 u<uid>；如果上游已经是 u_xxx 形式则原样保留。
  return /^u_/.test(raw) ? raw : `u${raw}`;
}

/**
 * 认证位映射：优先 `verified`，其次 `verified_type`。
 * 只有明确认证才返回 true；缺字段/0/false/-1 一律返回 undefined（不伪造未认证，
 * 也不把“没证据”写成 false）。前端按 `=== true` 显示 V。
 * 依据：docs/weibo-api.md §3.4 的 userInfo 字段（verified, verified_type）。
 */
function verifiedFromUser(user) {
  const direct = user?.verified;
  if (direct !== undefined && direct !== null && direct !== '') {
    return direct === true || direct === 1 || direct === '1' || direct === 'true' ? true : undefined;
  }
  const type = user?.verified_type ?? user?.verifiedType;
  if (type === undefined || type === null || type === '') return undefined;
  const numeric = Number(type);
  return Number.isFinite(numeric) && numeric >= 0 ? true : undefined;
}

/**
 * 上游 source/from 是 HTML（`<a href=...>iPhone客户端</a>`）。
 * 取纯文本、去标签、解实体、折叠空白，并截到 24 个 Unicode 码点；
 * 不做“来自 溪流”兜底（C1：缺省即不渲染尾巴，呈现层负责加前缀）。
 */
function sourceFromMblog(mblog) {
  const raw = mblog?.source ?? mblog?.from;
  if (raw === undefined || raw === null || raw === '') return undefined;
  let text = cleanText(raw);
  // cleanText 已解 &amp;；这里再剥掉残留的标签/实体符号，保证响应里没有 <>&。
  text = text.replace(/[<>]/g, '').replace(/&/g, '').replace(/\s+/g, ' ').trim();
  if (!text) return undefined;
  return Array.from(text).slice(0, 24).join('');
}

function authorFromUser(user, currentUid) {
  const rawId = String(user?.idstr ?? user?.id ?? '').trim();
  const id = authorIdOf(user);
  const screenName = String(user?.screen_name ?? user?.screenName ?? '').trim();
  const avatarText = Array.from(screenName).slice(0, 2).join('') || (rawId ? rawId.slice(-2) : '?');
  const verified = verifiedFromUser(user);
  return {
    id,
    nickname: screenName || (rawId ? `用户${rawId}` : '未知用户'),
    handle: rawId ? `u${rawId.replace(/^u/, '')}` : 'unknown',
    avatarText,
    avatarHue: hashHue(rawId || screenName || id),
    bio: String(user?.description ?? ''),
    followingCount: Number(user?.follow_count ?? 0) || 0,
    followerCount: Number(user?.followers_count ?? 0) || 0,
    postCount: Number(user?.statuses_count ?? 0) || 0,
    isCurrentUser: Boolean(currentUid && rawId && String(currentUid) === rawId),
    ...(verified === true ? { verified: true } : {}),
  };
}

function addUser(users, seen, user, currentUid) {
  if (!user || (typeof user !== 'object')) return;
  const author = authorFromUser(user, currentUid);
  if (!seen.has(author.id)) {
    seen.add(author.id);
    users.push(author);
  }
}

function mblogListFromCards(payload) {
  const data = unwrapPayload(payload) || {};
  const cards = Array.isArray(data.cards) ? data.cards : [];
  const result = [];
  for (const card of cards) {
    if (!card || typeof card !== 'object') continue;
    if (card.mblog) result.push(card.mblog);
    if (Array.isArray(card.card_group)) {
      for (const group of card.card_group) if (group?.mblog) result.push(group.mblog);
    }
  }
  return { mblogs: result, data, cards };
}

// ---------------------------------------------------------------- provider

export class WeiboProvider {
  constructor({ cookies = {}, uid = null, fetchImpl = globalThis.fetch, baseUrl = BASE, cache = sharedCache, timeoutMs = TIMEOUT_MS } = {}) {
    this.name = 'weibo';
    // 读接口已按契约实现；写方法（like/repost/comment/publish）已在 t19 接通，
    // 但 m 站写端点仍属【待实测】。capabilities.write 如实标记为 true；若真实
    // cookie 实测证伪，按 docs/weibo-api.md §8 降级为只读并更新此处与 README。
    this.capabilities = { read: true, write: true, images: false };
    this.cookies = { ...(cookies || {}) };
    this.uid = uid ? String(uid) : null;
    this.baseUrl = String(baseUrl || BASE).replace(/\/+$/, '');
    this.fetchImpl = fetchImpl;
    this.cache = cache;
    this.timeoutMs = Number(timeoutMs) > 0 ? Number(timeoutMs) : TIMEOUT_MS;
    this.scope = cacheScope(this.cookies, this.uid);
    this.xsrfToken = null;
    this.xsrfFetchedAt = 0;
    this.lastPublishNotice = '';
    this.lastPublishPending = false;
    this.lastUsers = [];
    this.lastPostId = null;
    this.lastMid = null;
  }

  cookieHeader() {
    return Object.entries(this.cookies)
      .filter(([name, value]) => name && value !== undefined && value !== null && value !== '')
      .map(([name, value]) => `${name}=${value}`)
      .join('; ');
  }

  requireCookie() {
    if (!this.cookies || !this.cookies.SUB) throw authError('缺少 SUB cookie，请重新登录');
  }

  headers() {
    const headers = {
      'User-Agent': UA,
      Accept: 'application/json, text/plain, */*',
      Referer: 'https://m.weibo.cn/',
      'MWeibo-Pwa': '1',
      'X-Requested-With': 'XMLHttpRequest',
    };
    const cookie = this.cookieHeader();
    if (cookie) headers.Cookie = cookie;
    return headers;
  }

  async _request(path, params = {}, { method = 'GET', body = null, cacheable = false, retries = 2, headers: extraHeaders = null, write = false } = {}) {
    const url = new URL(path, `${this.baseUrl}/`);
    for (const [key, value] of Object.entries(params || {})) {
      if (value !== undefined && value !== null && value !== '') url.searchParams.set(key, String(value));
    }
    const cacheKey = cacheable ? `${this.scope}|${method}|${url.pathname}|${url.search}` : null;
    if (cacheKey) {
      const hit = this.cache.get(cacheKey);
      if (hit) return hit;
    }

    let lastError = null;
    for (let attempt = 0; attempt <= retries; attempt += 1) {
      let response;
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), this.timeoutMs);
        try {
          response = await this.fetchImpl(url.toString(), {
            method,
            headers: { ...this.headers(), ...(extraHeaders || {}) },
            body,
            redirect: 'manual',
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timer);
        }
      } catch (error) {
        lastError = new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: `网络请求失败: ${error?.name || 'Error'}` });
        if (attempt < retries) {
          await sleep(400 * 2 ** attempt);
          continue;
        }
        throw lastError;
      }

      const status = Number(response.status || 0);
      const location = String(response.headers?.get?.('location') || '');
      if ([301, 302, 303, 307, 308].includes(status)) {
        if (/passport|signin|login|sso/i.test(location) || !location) throw authError('微博返回登录页，cookie 可能已过期');
        throw new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: `微博重定向 ${status}` }, status);
      }
      if (status === 401) throw authError('微博返回 401');
      if (status === 403 || status === 432 || status === 418) {
        if ((status === 429 || status === 432) && attempt < retries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        const code = status === 429 || status === 418 ? WEIBO_ERROR_CODES.RATE_LIMITED : WEIBO_ERROR_CODES.RISK_CONTROL;
        throw new WeiboError(code, { message: `微博反爬 HTTP ${status}` }, status);
      }
      if (status === 429) {
        if (attempt < retries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new WeiboError(WEIBO_ERROR_CODES.RATE_LIMITED, { message: '微博限流 HTTP 429' }, status);
      }
      if (status === 404) throw notFound('微博返回 404');
      if (status >= 500) {
        if (attempt < retries) {
          await sleep(500 * 2 ** attempt);
          continue;
        }
        throw new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: `微博上游 HTTP ${status}` }, status);
      }

      const text = await response.text();
      let payload;
      try {
        payload = text ? JSON.parse(text) : null;
      } catch {
        if (/登录|passport|signin|sso/i.test(text)) throw authError('微博返回 HTML 登录页');
        throw new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: '微博返回非 JSON' }, status || null);
      }

      if (payload && payload.ok === 0) {
        const detail = { message: String(payload.msg || payload.message || '微博接口失败'), errno: payload.errno };
        if (/不存在|已删除|不可见|not\s*found/i.test(detail.message)) throw notFound(detail);
        if (write && isContentRejectMessage(detail.message)) throw contentRejected(detail);
        if (/频繁|too\s*fast|rate/i.test(detail.message)) throw new WeiboError(WEIBO_ERROR_CODES.RATE_LIMITED, detail, status);
        if (/安全|验证|风控|risk|captcha/i.test(detail.message) || [432, 418].includes(Number(payload.errno))) {
          throw new WeiboError(WEIBO_ERROR_CODES.RISK_CONTROL, detail, status);
        }
        if ([21301, 21327, 21332, 21314].includes(Number(payload.errno))) throw authError(detail);
        throw new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, detail, status);
      }

      if (cacheKey) this.cache.set(cacheKey, payload);
      return payload;
    }
    throw lastError || new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: '未知微博错误' });
  }

  async getConfig() {
    return this._request('/api/config', {}, { cacheable: false });
  }

  /**
   * 登录态校验 + uid 兜底链（captain t18 实测补充）：
   * /api/config 可能不带 uid → 试 data.user/data.userInfo → 试 /api/account/get_uid。
   * 都拿不到时 authenticated=true 但 uid=null，不能误判未登录。
   */
  async validateSession() {
    this.requireCookie();
    const payload = await this.getConfig();
    const data = unwrapPayload(payload) || {};
    if (data.login !== true && data.login !== 1) throw authError('微博 /api/config 显示未登录');
    let uid = data.uid ?? data.user?.idstr ?? data.user?.id ?? data.userInfo?.idstr ?? data.userInfo?.id ?? null;
    if (uid === null || uid === undefined || String(uid) === '') {
      try {
        const extra = await this._request('/api/account/get_uid', {}, { cacheable: false });
        const extraData = unwrapPayload(extra) || {};
        uid = extraData.uid ?? extraData.id ?? extraData.user?.id ?? extraData.userInfo?.id ?? null;
      } catch {
        // 兜底失败不算未登录；保持 uid=null。
        uid = null;
      }
    }
    this.uid = uid === null || uid === undefined || String(uid) === '' ? null : String(uid);
    this.scope = cacheScope(this.cookies, this.uid);
    return {
      authenticated: true,
      uid: this.uid,
      screenName: String(data.user?.screen_name ?? data.screen_name ?? data.userInfo?.screen_name ?? ''),
    };
  }


  // ---------------------------------------------------------------- 写操作
  // 红线：写请求绝不因网络/5xx 自动重发；只有 XSRF 失效时按任务要求在
  // 重新取一次 token 后重试一次（publish 例外，避免重复发帖）。
  async getXsrfToken({ force = false } = {}) {
    const now = Date.now();
    if (!force && this.xsrfToken && now - this.xsrfFetchedAt < 5 * 60_000) return this.xsrfToken;
    let token = String(this.cookies?.['XSRF-TOKEN'] || '');
    try {
      const payload = await this.getConfig();
      const data = unwrapPayload(payload) || {};
      if (data.login === false || data.login === 0) throw authError('微博 /api/config 显示未登录');
      if (data.st) token = String(data.st);
    } catch (error) {
      if (error?.code === WEIBO_ERROR_CODES.AUTH_EXPIRED || error?.code === WEIBO_ERROR_CODES.RISK_CONTROL) throw error;
      if (!token) throw authError('无法取得 XSRF token，请重新登录');
    }
    if (!token) throw authError('缺少 XSRF token，请重新登录');
    this.xsrfToken = token;
    this.xsrfFetchedAt = Date.now();
    return token;
  }

  async _write(path, params = {}, { retryOnAuth = true } = {}) {
    const send = async (token) => {
      const body = new URLSearchParams();
      for (const [key, value] of Object.entries({ ...params, st: token })) {
        if (value !== undefined && value !== null) body.set(key, String(value));
      }
      return this._request(path, {}, {
        method: 'POST',
        body: body.toString(),
        retries: 0,
        write: true,
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'X-XSRF-TOKEN': token,
          Origin: 'https://m.weibo.cn',
          Referer: 'https://m.weibo.cn/compose/',
        },
      });
    };
    const token = await this.getXsrfToken();
    try {
      return await send(token);
    } catch (error) {
      if (retryOnAuth && error?.code === WEIBO_ERROR_CODES.AUTH_EXPIRED) {
        this.xsrfToken = null;
        this.xsrfFetchedAt = 0;
        const next = await this.getXsrfToken({ force: true });
        return send(next);
      }
      throw error;
    }
  }

  checkWriteText(text, { required = true, max = 140 } = {}) {
    const value = String(text ?? '').trim();
    if (required && !value) throw contentRejected('内容不能为空');
    if (Array.from(value).length > max) throw contentRejected(`内容超过 ${max} 字`);
    return value;
  }

  async _midFor(id) {
    if (this.lastPostId === id && this.lastMid) return this.lastMid;
    try {
      await this.getStatus(id);
      return this.lastMid || id;
    } catch (error) {
      if (error?.code === WEIBO_ERROR_CODES.AUTH_EXPIRED || error?.code === WEIBO_ERROR_CODES.RISK_CONTROL) throw error;
      return id;
    }
  }

  async like(id, on) {
    this.requireCookie();
    const key = String(id || '').trim();
    if (!key) throw notFound('缺少微博 id');
    if (typeof on !== 'boolean') throw contentRejected('like 需要 on=true/false');
    const payload = await this._write(on ? '/api/attitudes/like' : '/api/attitudes/unlike', { id: key });
    const data = unwrapPayload(payload) || {};
    return {
      liked: data.liked === undefined ? on : Boolean(data.liked),
      count: Number(data.attitudes_count ?? data.attitudesCount ?? data.count ?? 0) || 0,
    };
  }

  async repost(id, text = '') {
    this.requireCookie();
    const key = String(id || '').trim();
    if (!key) throw notFound('缺少微博 id');
    const content = this.checkWriteText(text, { required: false });
    const mid = await this._midFor(key);
    const payload = await this._write('/api/statuses/repost', { id: key, mid, content });
    const data = unwrapPayload(payload) || {};
    const mblog = data.mblog || data.status || (idOf(data) ? data : null);
    const users = [];
    let post = mblog ? await this._postFromMblog(mblog, users, new Set()) : null;
    if (!post) post = this._pendingPost({ text: content, repostOfId: key });
    if (post && !post.repostOfId) post.repostOfId = key;
    this.lastUsers = users;
    return post;
  }

  async comment(id, text, replyTo = null) {
    this.requireCookie();
    const key = String(id || '').trim();
    if (!key) throw notFound('缺少微博 id');
    const content = this.checkWriteText(text, { required: true, max: 140 });
    const mid = await this._midFor(key);
    const params = { id: key, mid, content };
    if (replyTo) params.cid = String(replyTo);
    const payload = await this._write('/api/comments/create', params);
    const data = unwrapPayload(payload) || {};
    const source = data.comment || (idOf(data) ? data : null);
    const reply = source ? {
      id: String(source.idstr ?? source.id ?? `c_${Date.now()}`),
      postId: key,
      authorId: authorIdOf(source.user),
      text: cleanText(source.text || source.raw_text || content),
      createdAt: parseWeiboTime(source.created_at) || Date.now(),
      replyToReplyId: replyTo ? String(replyTo) : null,
    } : {
      id: `c_pending_${Date.now()}`,
      postId: key,
      authorId: this.uid ? `u${this.uid}` : 'u_me',
      text: content,
      createdAt: Date.now(),
      replyToReplyId: replyTo ? String(replyTo) : null,
    };
    return reply;
  }

  async _uploadPic(binary, filename = 'pic', contentType = 'image/jpeg') {
    const token = await this.getXsrfToken();
    const form = new FormData();
    form.append('type', 'json');
    form.append('st', token);
    const bytes = typeof binary === 'string' ? Buffer.from(binary.replace(/^data:[^,]+,/, ''), 'base64') : binary;
    form.append('pic', new Blob([bytes], { type: contentType }), filename);
    let response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        response = await this.fetchImpl(`${this.baseUrl}/api/statuses/uploadPic`, {
          method: 'POST',
          headers: {
            ...this.headers(),
            'X-XSRF-TOKEN': token,
            Origin: 'https://m.weibo.cn',
            Referer: 'https://m.weibo.cn/compose/',
          },
          body: form,
          redirect: 'manual',
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timer);
      }
    } catch (error) {
      throw new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: `图片上传失败: ${error?.name || 'Error'}` });
    }
    if ([301, 302, 303, 307, 308].includes(response.status)) throw authError('图片上传返回登录页');
    if (response.status === 429 || response.status === 418) throw new WeiboError(WEIBO_ERROR_CODES.RATE_LIMITED, { message: `图片上传 HTTP ${response.status}` }, response.status);
    if (response.status === 432 || response.status === 403) throw new WeiboError(WEIBO_ERROR_CODES.RISK_CONTROL, { message: `图片上传 HTTP ${response.status}` }, response.status);
    if (response.status >= 500) throw new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: `图片上传 HTTP ${response.status}` }, response.status);
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new WeiboError(WEIBO_ERROR_CODES.UPSTREAM, { message: '图片上传返回非 JSON' }, response.status);
    }
    const data = payload?.data || payload || {};
    const picId = data.pic_id || data.picId || payload?.pic_id;
    if (!picId) throw contentRejected({ message: String(payload?.msg || '图片上传没有返回 pic_id') });
    return String(picId);
  }

  _pendingPost({ text = '', repostOfId = null } = {}) {
    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

  async publish(text, pics = undefined) {
    this.requireCookie();
    this.lastPublishNotice = '';
    this.lastPublishPending = false;
    const content = this.checkWriteText(text, { required: !Array.isArray(pics) || pics.length === 0 });
    const picIds = [];
    if (Array.isArray(pics) && pics.length > 0) {
      for (const pic of pics.slice(0, 9)) {
        const binary = typeof pic === 'string' ? pic : (pic?.data ?? pic?.bytes ?? pic?.buffer);
        if (!binary) {
          this.lastPublishNotice = '图片只是占位，没有二进制内容；已按纯文本发布。';
          continue;
        }
        try {
          picIds.push(await this._uploadPic(binary, pic?.filename || 'pic', pic?.contentType || 'image/jpeg'));
        } catch (error) {
          if (error?.code === WEIBO_ERROR_CODES.AUTH_EXPIRED || error?.code === WEIBO_ERROR_CODES.RISK_CONTROL || error?.code === WEIBO_ERROR_CODES.RATE_LIMITED) throw error;
          this.lastPublishNotice = `图片上传失败（${error?.code || 'UPSTREAM'}），已按纯文本发布。`;
        }
      }
    }
    if (!content && picIds.length === 0) throw contentRejected('内容不能为空');
    const params = { content };
    if (picIds.length) params.picId = picIds.join(',');
    const payload = await this._write('/api/statuses/update', params, { retryOnAuth: false });
    const data = unwrapPayload(payload) || {};
    const mblog = data.mblog || data.status || (idOf(data) ? data : null);
    const users = [];
    let post = mblog ? await this._postFromMblog(mblog, users, new Set()) : null;
    if (!post) {
      post = this._pendingPost({ text: content });
      this.lastPublishPending = true;
    }
    this.lastUsers = users;
    return post;
  }

  async _resolveUid() {
    if (this.uid) return this.uid;
    try {
      const result = await this.validateSession();
      return result.uid;
    } catch (error) {
      if (error?.code === WEIBO_ERROR_CODES.AUTH_EXPIRED) throw error;
      return null;
    }
  }

  async _textFor(mblog) {
    let text = textOfMblog(mblog);
    if (!mblog || !mblog.isLongText) return text;
    const id = idOf(mblog);
    if (!id) return text;
    try {
      const payload = await this._request('/statuses/extend', { id }, { cacheable: true });
      const data = unwrapPayload(payload) || {};
      const html = data.longTextContent ?? data.long_text_content ?? payload?.longTextContent;
      if (html) text = cleanText(html);
    } catch {
      // 长文扩展失败时保留已截断正文，不让详情整页失败。
    }
    return text;
  }

  async _postFromMblog(mblog, users, seen) {
    if (!mblog || typeof mblog !== 'object') return null;
    const user = mblog.user;
    addUser(users, seen, user, this.uid);
    const retweeted = mblog.retweeted_status;
    if (retweeted?.user) addUser(users, seen, retweeted.user, this.uid);
    const text = await this._textFor(mblog);
    const id = idOf(mblog);
    if (!id) return null;
    const source = sourceFromMblog(mblog);
    return {
      id,
      authorId: authorIdOf(user),
      text,
      ...(source ? { source } : {}),
      media: mediaFromMblog(mblog),
      topics: topicsFromText(text),
      repostOfId: retweeted ? (idOf(retweeted) || null) : null,
      createdAt: parseWeiboTime(mblog.created_at),
      counts: {
        reposts: Number(mblog.reposts_count ?? 0) || 0,
        replies: Number(mblog.comments_count ?? 0) || 0,
        likes: Number(mblog.attitudes_count ?? 0) || 0,
      },
    };
  }

  async _pageFromContainer(containerid, cursor, users) {
    const page = Math.max(1, Number(cursor || 1) || 1);
    const payload = await this._request('/api/container/getIndex', { containerid, page }, { cacheable: true });
    const { mblogs } = mblogListFromCards(payload);
    const items = [];
    for (const mblog of mblogs) {
      const post = await this._postFromMblog(mblog, users, new Set(users.map((user) => user.id)));
      if (post) items.push(post);
    }
    return {
      items,
      next: mblogs.length ? String(page + 1) : null,
      hasMore: mblogs.length > 0,
      users,
    };
  }

  async getTimeline(kind = 'recommend', cursor = null) {
    this.requireCookie();
    const containerid = kind === 'following' || kind === 'friends'
      ? (process.env.RILL_WEIBO_FRIENDS_CONTAINER || '231093_-_selffollowed')
      : (process.env.RILL_WEIBO_RECOMMEND_CONTAINER || '102803');
    const users = [];
    return this._pageFromContainer(containerid, cursor, users);
  }

  async getStatus(id) {
    this.requireCookie();
    const key = String(id || '');
    if (!key) throw notFound('缺少微博 id');
    const payload = await this._request('/statuses/show', { id: key }, { cacheable: true });
    const data = unwrapPayload(payload);
    const mblog = data?.mblog || data;
    const users = [];
    const post = await this._postFromMblog(mblog, users, new Set());
    if (!post) throw notFound('微博不存在');
    this.lastUsers = users;
    this.lastPostId = post.id;
    this.lastMid = String(mblog.mid ?? mblog.midstr ?? mblog.idstr ?? mblog.id ?? post.id);
    return post;
  }

  async getComments(postId, cursor = null) {
    this.requireCookie();
    const id = String(postId || '');
    if (!id) throw notFound('缺少微博 id');
    let maxId = null;
    let maxIdType = '0';
    if (cursor) {
      const [left, right] = String(cursor).split('|');
      maxId = left || null;
      maxIdType = right || '0';
    }
    // 详情页先 getStatus 时复用真实 mid；单独调用则退回 id（m 站通常也接受）。
    const mid = this.lastPostId === id && this.lastMid ? this.lastMid : id;
    const params = { id, mid, max_id_type: maxIdType };
    if (maxId) params.max_id = maxId;
    const payload = await this._request('/comments/hotflow', params, { cacheable: true });
    const data = unwrapPayload(payload) || {};
    const comments = Array.isArray(data.data) ? data.data : Array.isArray(payload?.data?.data) ? payload.data.data : [];
    const users = [];
    const seen = new Set();
    const items = [];
    for (const comment of comments) {
      if (!comment || typeof comment !== 'object') continue;
      addUser(users, seen, comment.user, this.uid);
      const rootId = comment.rootid ?? comment.id;
      const reply = {
        id: String(comment.idstr ?? comment.id ?? ''),
        postId: id,
        authorId: authorIdOf(comment.user),
        text: cleanText(comment.text || comment.raw_text || ''),
        createdAt: parseWeiboTime(comment.created_at),
        replyToReplyId: String(rootId) === String(comment.id) ? null : String(rootId),
      };
      if (reply.id) items.push(reply);
      if (Array.isArray(comment.comments)) {
        for (const child of comment.comments) {
          if (!child || typeof child !== 'object') continue;
          addUser(users, seen, child.user, this.uid);
          const childRoot = child.rootid ?? comment.rootid ?? comment.id;
          const childReply = {
            id: String(child.idstr ?? child.id ?? ''),
            postId: id,
            authorId: authorIdOf(child.user),
            text: cleanText(child.text || child.raw_text || ''),
            createdAt: parseWeiboTime(child.created_at),
            replyToReplyId: String(childRoot) === String(comment.id) ? String(comment.id) : (childRoot ? String(childRoot) : String(comment.id)),
          };
          if (childReply.id) items.push(childReply);
        }
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

  async getUser(uid) {
    this.requireCookie();
    const value = String(uid || '');
    if (!value) throw notFound('缺少 uid');
    const payload = await this._request('/api/container/getIndex', { type: 'uid', value }, { cacheable: true });
    const data = unwrapPayload(payload) || {};
    const user = data.userInfo || data.user;
    if (!user) throw notFound('用户不存在');
    return authorFromUser(user, this.uid);
  }

  async getUserPosts(uid, cursor = null) {
    this.requireCookie();
    const value = String(uid || '');
    if (!value) throw notFound('缺少 uid');
    const users = [];
    return this._pageFromContainer(`107603${value}`, cursor, users);
  }

  async search(q, kind = 'statuses', cursor = null) {
    this.requireCookie();
    const query = String(q || '').trim();
    if (!query) throw notFound('搜索词为空');
    const type = kind === 'users' ? 2 : kind === 'topics' ? 3 : 1;
    const page = Math.max(1, Number(cursor || 1) || 1);
    // 微博把查询编码进 containerid；服务端 URLSearchParams 会再编码一层。
    const containerid = `100103type=${type}&q=${query}`;
    const payload = await this._request('/api/container/getIndex', { containerid, page }, { cacheable: true });
    const data = unwrapPayload(payload) || {};
    const cards = Array.isArray(data.cards) ? data.cards : [];
    const users = [];
    const seen = new Set();
    const items = [];
    if (type === 1) {
      for (const card of cards) {
        const mblogs = card?.mblog ? [card.mblog] : Array.isArray(card?.card_group) ? card.card_group.filter((g) => g?.mblog).map((g) => g.mblog) : [];
        for (const mblog of mblogs) {
          const post = await this._postFromMblog(mblog, users, seen);
          if (post) items.push(post);
        }
      }
    } else if (type === 2) {
      for (const card of cards) {
        const user = card?.user || card?.card_group?.find?.((g) => g?.user)?.user;
        if (user) {
          addUser(users, seen, user, this.uid);
          items.push(authorFromUser(user, this.uid));
        }
      }
    } else {
      // 话题卡形状不稳定：把 title/desc 换成可渲染的 Author 占位，UI 只读。
      for (const card of cards) {
        const title = card?.title || card?.desc || card?.card_group?.find?.((g) => g?.title)?.title;
        if (title) {
          items.push({
            id: `topic:${title}`,
            nickname: String(title),
            handle: 'topic',
            avatarText: Array.from(String(title)).slice(0, 2).join(''),
            avatarHue: hashHue(title),
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
}

export { BASE as WEIBO_BASE, sharedCache, cleanText, hashHue };
