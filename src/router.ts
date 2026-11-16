// src/router.ts —— 不引路由库：hash 路由 + 手写解析。
// 路由表（docs/spec.md §4.1）：
//   #/timeline       默认页（#/、#、空 hash、未知 hash 一律 replaceState 到它）
//   #/status/:id     详情（#/detail/:id 为等价别名）
//   #/compose        发博
//   #/me             我的（#/profile 为等价别名）
// 解析规则：取 location.hash.slice(1)，按第一个 ? 切 path/query；不依赖 location.search。

import type { FeedTab, ProfileTab } from './types';

export type RouteName = 'timeline' | 'status' | 'compose' | 'me' | 'login' | 'search';
export type ActiveTab = 'timeline' | 'compose' | 'me' | 'settings';

export interface RouteLocation {
  name: RouteName;
  id: string | null;
  query: Record<string, string>;
  /** 规范化后的 hash（含 query），例如 '#/timeline?probe=like:p_0001' */
  hash: string;
  path: string;
}

export interface ParsedLocation {
  location: RouteLocation;
  canonicalHash: string;
  /** true = 入参不是规范形式（#/、#/nope、#/detail/p_0001 …），需要 replaceState */
  redirected: boolean;
}

function splitPathQuery(raw: string): { path: string; query: Record<string, string> } {
  const at = raw.indexOf('?');
  const path = at === -1 ? raw : raw.slice(0, at);
  const qs = at === -1 ? '' : raw.slice(at + 1);
  const query: Record<string, string> = {};
  if (qs) {
    for (const [key, value] of new URLSearchParams(qs)) query[key] = value;
  }
  return { path, query };
}

function serializeQuery(query: Record<string, string>): string {
  const keys = Object.keys(query).sort();
  if (keys.length === 0) return '';
  const params = new URLSearchParams();
  for (const key of keys) params.set(key, query[key]);
  return `?${params.toString()}`;
}

export function parseLocation(hash: string): ParsedLocation {
  const raw = hash.startsWith('#') ? hash.slice(1) : hash;
  const { path, query } = splitPathQuery(raw);
  const segments = path.split('/').filter(Boolean);

  let name: RouteName = 'timeline';
  let id: string | null = null;

  const head = segments[0];
  if (head === 'status' || head === 'detail') {
    if (segments[1]) {
      name = 'status';
      try {
        id = decodeURIComponent(segments[1]);
      } catch {
        id = segments[1];
      }
    }
  } else if (head === 'compose') {
    name = 'compose';
  } else if (head === 'me' || head === 'profile') {
    name = 'me';
  } else if (head === 'login') {
    name = 'login';
  } else if (head === 'search') {
    name = 'search';
  }
  // 其余（含空路径、未知路径）→ timeline；靠 canonicalHash 触发重定向。

  const canonicalPath =
    name === 'status' && id ? `/status/${encodeURIComponent(id)}` : `/${name}`;
  const canonicalHash = `#${canonicalPath}${serializeQuery(query)}`;
  const redirected = canonicalHash !== `#${raw}`;

  return {
    location: { name, id, query, hash: canonicalHash, path: canonicalPath },
    canonicalHash,
    redirected,
  };
}

export function routeTitle(name: RouteName): string {
  switch (name) {
    case 'timeline':
      return '时间线';
    case 'status':
      return '详情';
    case 'compose':
      return '发博';
    case 'me':
      return '我的';
    case 'login':
      return '登录';
    case 'search':
      return '搜索';
    default:
      return '溪流';
  }
}

/** 详情页仍高亮「时间线」（详情是时间线的压栈页）。 */
export function activeTabOf(name: RouteName): ActiveTab {
  return name === 'status' || name === 'login' || name === 'search' ? 'timeline' : name;
}

/** 滚动位 key：路由 path + 段选（不把 query 里的 probe 算进去）。 */
export function scrollKeyFor(
  location: RouteLocation,
  feedTab: FeedTab,
  profileTab: ProfileTab,
): string {
  switch (location.name) {
    case 'timeline':
      return `timeline:${feedTab}`;
    case 'me':
      return `me:${profileTab}`;
    case 'status':
      return `status:${location.id ?? 'unknown'}`;
    case 'login':
      return 'login';
    case 'search':
      return 'search';
    default:
      return 'compose';
  }
}

export function feedTabFromQuery(query: Record<string, string>): FeedTab | null {
  const tab = query.tab;
  return tab === 'following' || tab === 'recommend' ? tab : null;
}

export function profileTabFromQuery(query: Record<string, string>): ProfileTab | null {
  const tab = query.tab;
  return tab === 'posts' || tab === 'liked' ? tab : null;
}

/** 入栈式跳转（tabbar / 卡片点击）。 */
export function navigate(target: string): void {
  const hash = target.startsWith('#') ? target : `#${target}`;
  window.location.hash = hash;
}

/** 替换当前历史项（未知 hash 重定向、发布成功回时间线）。 */
export function replaceRoute(target: string): void {
  const hash = target.startsWith('#') ? target : `#${target}`;
  window.history.replaceState(null, '', hash);
}

export function readCurrentHash(): string {
  return window.location.hash;
}