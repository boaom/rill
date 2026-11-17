// src/device/login-native.ts —— 原生壳内登录入口；只由 LoginPage 动态 import。
// 插件不存在、用户取消或读取不到 Cookie 时抛错，由登录页明确回退到手动粘贴。
import { parseCookieInput } from '../data/api';

export interface NativeCookie {
  name: string;
  value: string;
}

interface WeiboLoginPlugin {
  openLogin(): Promise<{ cookie?: unknown } | undefined>;
  readCookies?(): Promise<{ cookie?: unknown } | undefined>;
}

function plugin(): WeiboLoginPlugin | null {
  const capacitor = (window as unknown as {
    Capacitor?: { Plugins?: Record<string, unknown> };
  }).Capacitor;
  const candidate = capacitor?.Plugins?.WeiboLogin as WeiboLoginPlugin | undefined;
  return candidate && typeof candidate.openLogin === 'function' ? candidate : null;
}

function failureMessage(reason: unknown): string {
  if (reason && typeof reason === 'object') {
    const code = String((reason as { code?: unknown }).code || '');
    if (code === 'CANCELLED') return '已取消 App 内登录。';
    if (code === 'NO_COOKIE') return '没有读到完整 Cookie，请重试。';
    if (code === 'UNAVAILABLE') return 'App 内登录插件不可用。';
  }
  return 'App 内登录失败。';
}

/**
 * 打开原生登录 WebView；只有用户点“我已登录完成”后插件才把 Cookie 返回给这里。
 * 返回的 cookie 字符串用现有 parseCookieInput 解析，随后由 loginWithCookies → session 存储。
 */
export async function nativeLoginCookies(): Promise<NativeCookie[]> {
  const native = plugin();
  if (!native) throw new Error('App 内登录不可用（未找到原生插件），请手动粘贴 Cookie。');
  let result: { cookie?: unknown } | undefined;
  try {
    result = await native.openLogin();
  } catch (reason) {
    throw new Error(`${failureMessage(reason)} 已保留手动粘贴入口。`);
  }
  if (!result?.cookie && typeof native.readCookies === 'function') {
    try {
      result = await native.readCookies();
    } catch (reason) {
      throw new Error(`${failureMessage(reason)} 已保留手动粘贴入口。`);
    }
  }
  const raw = typeof result?.cookie === 'string' ? result.cookie : '';
  const parsed = parseCookieInput(raw);
  if (!parsed.cookies.some((cookie) => cookie.name === 'SUB')) {
    throw new Error('微博登录未完成或 Cookie 里没有 SUB，请重试或手动粘贴。');
  }
  return parsed.cookies;
}
