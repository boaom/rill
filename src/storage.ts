// src/storage.ts —— 唯一的 localStorage 出入口（组件里不许直接读写）。
// 所有 key 前缀 rill:v1:；脏数据一律 try/catch 回落默认值，不抛错。

export const STORAGE_PREFIX = 'rill:v1:';

export const KEYS = {
  theme: 'rill:v1:theme',
  liked: 'rill:v1:liked',
  reposted: 'rill:v1:reposted',
  published: 'rill:v1:published',
  myPosts: 'rill:v1:my-posts',
  myReplies: 'rill:v1:my-replies',
  draft: 'rill:v1:draft',
  scroll: (routeKey: string) => `rill:v1:scroll:${routeKey}`,
} as const;

function store(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function safeGet(key: string): string | null {
  try {
    return store()?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string): void {
  try {
    store()?.setItem(key, value);
  } catch {
    /* 隐私模式 / 配额满：静默忽略，页面继续用内存态 */
  }
}

function safeRemove(key: string): void {
  try {
    store()?.removeItem(key);
  } catch {
    /* 同上 */
  }
}

export function readJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (parsed === null || parsed === undefined) return fallback;
    return parsed as T;
  } catch {
    return fallback;
  }
}

export function writeJSON(key: string, value: unknown): void {
  try {
    safeSet(key, JSON.stringify(value));
  } catch {
    /* 循环引用等异常值：不写，不抛 */
  }
}

export function readString(key: string, fallback = ''): string {
  const raw = safeGet(key);
  return raw === null ? fallback : raw;
}

export function writeString(key: string, value: string): void {
  safeSet(key, value);
}

export function readNumber(key: string, fallback = 0): number {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function writeNumber(key: string, value: number): void {
  safeSet(key, String(value));
}

export function removeKey(key: string): void {
  safeRemove(key);
}

/** 清空本应用写入的全部本地数据（设置 sheet 的「清空本地数据」）。 */
export function clearAll(): void {
  try {
    const ls = store();
    if (!ls) return;
    const doomed: string[] = [];
    for (let i = 0; i < ls.length; i += 1) {
      const key = ls.key(i);
      if (key && key.startsWith(STORAGE_PREFIX)) doomed.push(key);
    }
    for (const key of doomed) ls.removeItem(key);
  } catch {
    /* 不抛错 */
  }
}