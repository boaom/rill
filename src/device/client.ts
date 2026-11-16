// src/device/client.ts —— 原生分支的薄适配层；只在 device 模式被动态 import。
// 这里集中 provider 生命周期、设备会话与错误翻译，保证 web 主包只留下模式判断。
import { ApiError, type ApiMode, type LikeResult, type Page, type StatusPayload, type WritePostResult, type WriteReplyResult } from '../data/api';
import type { Author, FeedTab, MediaRef, Post, Reply } from '../types';
import { createDeviceProvider, type WeiboDirectProvider } from './weibo-direct';
import { clearDeviceCookies, getDeviceSession, loadDeviceCookies, saveDeviceCookies } from './session';

export interface DeviceSession {
  authenticated: boolean;
  hasSession: boolean;
  provider: 'device';
  mode: 'device';
  user?: { uid: string | null; screenName: string };
}

let providerCache: { signature: string; provider: WeiboDirectProvider } | null = null;
let providerLoading: Promise<WeiboDirectProvider> | null = null;

async function provider(): Promise<WeiboDirectProvider> {
  if (providerCache) return providerCache.provider;
  if (providerLoading) return providerLoading;
  providerLoading = (async () => {
    const cookies = await loadDeviceCookies();
    if (!cookies.length || !cookies.some((cookie) => cookie.name === 'SUB' && cookie.value)) {
      throw new ApiError('AUTH_REQUIRED', '尚未在这台设备上保存 Cookie', 0);
    }
    const signature = cookies.map((cookie) => `${cookie.name}\u0000${cookie.value}`).join('\u0001');
    const created = createDeviceProvider({ cookies });
    providerCache = { signature, provider: created };
    return created;
  })();
  try {
    return await providerLoading;
  } finally {
    providerLoading = null;
  }
}

export function resetDeviceProvider(): void {
  providerCache = null;
  providerLoading = null;
}

function asApiError(reason: unknown): ApiError {
  if (reason instanceof ApiError) return reason;
  const value = reason && typeof reason === 'object' ? reason as Record<string, unknown> : {};
  const raw = String(value.code || '').toUpperCase();
  const code = ['AUTH_EXPIRED', 'AUTH_REQUIRED', 'RATE_LIMITED', 'RISK_CONTROL', 'NOT_FOUND', 'CONTENT_REJECTED', 'UPSTREAM', 'BAD_INPUT'].includes(raw)
    ? raw as ApiError['code']
    : raw === 'READ_ONLY' ? 'CONTENT_REJECTED' : 'UPSTREAM';
  const message = typeof value.message === 'string' && value.message ? value.message : '微博请求失败';
  const status = Number(value.status) || 0;
  const retryAfter = Number(value.retryAfter);
  return new ApiError(code, message, status, Number.isFinite(retryAfter) ? retryAfter : undefined);
}

async function call<T>(fn: (device: WeiboDirectProvider) => Promise<T>): Promise<T> {
  try {
    return await fn(await provider());
  } catch (reason) {
    throw asApiError(reason);
  }
}

export async function readSession(): Promise<DeviceSession> {
  try {
    const info = await getDeviceSession();
    return {
      authenticated: info.authenticated,
      hasSession: info.hasSession,
      provider: 'device',
      mode: 'device',
      ...(info.user ? { user: info.user } : {}),
    };
  } catch {
    return { authenticated: false, hasSession: false, provider: 'device', mode: 'device' };
  }
}

export async function loginDevice(cookies: Array<{ name: string; value: string }>): Promise<DeviceSession> {
  if (!cookies.some((cookie) => cookie.name === 'SUB' && cookie.value)) {
    throw new ApiError('AUTH_REQUIRED', 'Cookie 里没有 SUB，无法建立设备会话', 0);
  }
  const created = createDeviceProvider({ cookies });
  let validation: Awaited<ReturnType<WeiboDirectProvider['validateSession']>>;
  try {
    validation = await created.validateSession();
  } catch (reason) {
    throw asApiError(reason);
  }
  await saveDeviceCookies(cookies);
  resetDeviceProvider();
  return {
    authenticated: true,
    hasSession: true,
    provider: 'device',
    mode: 'device',
    ...(validation.screenName ? { user: { uid: validation.uid, screenName: validation.screenName } } : {}),
  };
}

export async function logoutDevice(): Promise<void> {
  await clearDeviceCookies();
  resetDeviceProvider();
}

export function getTimeline(tab: FeedTab, cursor: string | null): Promise<Page<Post>> {
  return call((device) => device.getTimeline(tab, cursor));
}

export function getStatus(id: string): Promise<StatusPayload> {
  return call(async (device) => {
    const post = await device.getStatus(id);
    return { post, users: device.lastUsers };
  });
}

export function getComments(id: string, cursor: string | null): Promise<Page<Reply>> {
  return call((device) => device.getComments(id, cursor));
}

export function getUser(uid: string): Promise<Author> {
  return call((device) => device.getUser(uid));
}

export function getUserPosts(uid: string, cursor: string | null): Promise<Page<Post>> {
  return call((device) => device.getUserPosts(uid, cursor));
}

export function search(query: string, kind: 'statuses' | 'users' | 'topics', cursor: string | null): Promise<Page<Post | Author>> {
  return call((device) => device.search(query, kind, cursor));
}

export function setLike(id: string, on: boolean): Promise<LikeResult> {
  return call((device) => device.like(id, on));
}

export function repost(id: string, text: string): Promise<WritePostResult> {
  return call((device) => device.repost(id, text));
}

export function comment(id: string, text: string, replyTo: string | null): Promise<WriteReplyResult> {
  return call((device) => device.comment(id, text, replyTo));
}

export function publish(text: string, pics: MediaRef[], key?: string): Promise<WritePostResult> {
  return call((device) => device.publish(text, pics, key));
}

/** 只读的诊断信息；不包含 cookie。 */
export function deviceMode(): ApiMode {
  return 'device';
}
