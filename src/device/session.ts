// src/device/session.ts —— 设备本地凭证（只存本机，不写日志、不上报）。
// 仅由 src/data/api.ts 在原生分支动态 import；浏览器主包不包含本文件。

const COOKIE_KEY = 'rill:v1:device-cookies';

export interface StoredCookie {
  name: string;
  value: string;
}

export interface DeviceSessionInfo {
  authenticated: boolean;
  hasSession: boolean;
  provider: 'device';
  mode: 'device';
  user?: { uid: string | null; screenName: string };
}

interface PreferencesLike {
  get(options: { key: string }): Promise<{ value: string | null }>;
  set(options: { key: string; value: string }): Promise<void>;
  remove(options: { key: string }): Promise<void>;
}

function preferences(): PreferencesLike | null {
  try {
    const plugin = (window as unknown as {
      Capacitor?: { Plugins?: Record<string, unknown> };
    }).Capacitor?.Plugins?.Preferences as PreferencesLike | undefined;
    return plugin && typeof plugin.get === 'function' && typeof plugin.set === 'function' ? plugin : null;
  } catch {
    return null;
  }
}

function storage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function sanitize(value: unknown): StoredCookie[] {
  if (!Array.isArray(value)) return [];
  const out: StoredCookie[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const name = String((item as { name?: unknown }).name ?? '').trim();
    const cookieValue = String((item as { value?: unknown }).value ?? '');
    if (!name || !cookieValue || seen.has(name)) continue;
    seen.add(name);
    out.push({ name, value: cookieValue });
  }
  return out;
}

function parseStored(raw: string | null): StoredCookie[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as { cookies?: unknown };
    return sanitize(parsed?.cookies);
  } catch {
    return [];
  }
}

/** 读取设备本地 cookie；值只在本模块/请求头中使用。 */
export async function loadDeviceCookies(): Promise<StoredCookie[]> {
  const prefs = preferences();
  if (prefs) {
    try {
      const result = await prefs.get({ key: COOKIE_KEY });
      const cookies = parseStored(result?.value ?? null);
      if (cookies.length) return cookies;
    } catch {
      // Preferences 不可用 → localStorage 兜底；不打印异常内容。
    }
  }
  try {
    return parseStored(storage()?.getItem(COOKIE_KEY) ?? null);
  } catch {
    return [];
  }
}

/** 保存到设备本地；优先 Preferences，失败后退化到 localStorage。 */
export async function saveDeviceCookies(cookies: StoredCookie[]): Promise<void> {
  const clean = sanitize(cookies);
  const payload = JSON.stringify({ version: 1, cookies: clean });
  const prefs = preferences();
  if (prefs) {
    try {
      await prefs.set({ key: COOKIE_KEY, value: payload });
      return;
    } catch {
      // 继续尝试 localStorage；不记录 cookie 值。
    }
  }
  const store = storage();
  if (!store) throw new Error('设备存储不可用，无法保存 Cookie');
  store.setItem(COOKIE_KEY, payload);
}

/** 清除本地凭证；页面退出/换账号时调用。 */
export async function clearDeviceCookies(): Promise<void> {
  const prefs = preferences();
  if (prefs) {
    try {
      await prefs.remove({ key: COOKIE_KEY });
    } catch {
      // 继续清 localStorage。
    }
  }
  try {
    storage()?.removeItem(COOKIE_KEY);
  } catch {
    // 存储被禁用时无可清除。
  }
}

export async function getDeviceSession(): Promise<DeviceSessionInfo> {
  const cookies = await loadDeviceCookies();
  const authenticated = cookies.some((cookie) => cookie.name === 'SUB' && cookie.value !== '');
  return {
    authenticated,
    hasSession: authenticated,
    provider: 'device',
    mode: 'device',
  };
}
