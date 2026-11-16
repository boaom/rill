// src/store.ts —— 纯 React state + reducer 的单一真源（不引 redux/zustand）。
// 显示口径遵循 docs/spec.md §5.5 的六条不变量：
//   INV-1 点赞只改 likedIds，显示值 = 基线 + (已赞?1:0)，绝不再改 counts.likes
//   INV-2 转发只插入 1 条 p_rp_*（幂等），原帖转发显示 = 基线 + (已转发?1:0)
//   INV-3 我的「动态数」= 当前用户 mock postCount + 已发布数
//   INV-4 回复数 = mock 回复数 + 我发表的回复数
//   INV-5 没有任何随机/时间依赖；刷新只重置分页可见集

import {
  createContext,
  createElement,
  useContext,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import { CURRENT_USER, FOLLOWING_AUTHOR_IDS, MOCK } from './data/mock';
import { KEYS, readJSON, readString, readNumber, writeJSON, writeString, writeNumber } from './storage';
import type {
  Action,
  AppState,
  FeedTab,
  MediaRef,
  Post,
  ProfileTab,
  Reply,
  ThemeMode,
} from './types';

/** mock 的时间锚点（2026-11-16 12:00 +08:00）；新内容一律基于它做确定性偏移。 */
export const BASE_TIMESTAMP = 1794801600000;
export const FIRST_PAGE_SIZE = 20;
export const PAGE_STEP = 10;

const MY_POST_PREFIX = 'p_new_';
const MY_REPOST_PREFIX = 'p_rp_';
const MY_REPLY_PREFIX = 'c_new_';

// ---------------------------------------------------------------- 纯工具

function sortPostsDesc(posts: readonly Post[]): Post[] {
  return posts
    .slice()
    .sort((a, b) => (b.createdAt - a.createdAt) || a.id.localeCompare(b.id));
}

function dedupeById<T extends { id: string }>(items: readonly T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const item of items) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    out.push(item);
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function asPostArray(value: unknown): Post[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Post =>
      !!item && typeof item === 'object' && typeof (item as Post).id === 'string' &&
      typeof (item as Post).authorId === 'string' && typeof (item as Post).createdAt === 'number',
  );
}

function asReplyArray(value: unknown): Reply[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is Reply =>
      !!item && typeof item === 'object' && typeof (item as Reply).id === 'string' &&
      typeof (item as Reply).postId === 'string' && typeof (item as Reply).createdAt === 'number',
  );
}

function readStoredTheme(): ThemeMode {
  const saved = readString(KEYS.theme, '');
  if (saved === 'dark' || saved === 'light') return saved;
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function isMyPost(post: Post): boolean {
  return post.id.startsWith(MY_POST_PREFIX);
}

function isMyReply(reply: Reply): boolean {
  return reply.id.startsWith(MY_REPLY_PREFIX);
}

// ---------------------------------------------------------------- 初始状态

/** 从 mock + localStorage 组装初始状态（确定性：同样输入 → 同样状态）。
 *  options.empty=true 用于 `probe=empty`：空数据集启动（不读已发布的本地内容）。 */
export function createInitialState(options: { empty?: boolean } = {}): AppState {
  if (options.empty) {
    return {
      posts: [],
      replies: [],
      likedIds: [],
      repostedIds: [],
      publishedIds: [],
      draft: readString(KEYS.draft, ''),
      theme: readStoredTheme(),
    };
  }
  const likedIds = asStringArray(readJSON<unknown>(KEYS.liked, []));
  const repostedIds = asStringArray(readJSON<unknown>(KEYS.reposted, []));
  const publishedIds = asStringArray(readJSON<unknown>(KEYS.published, []));
  const storedMyPosts = asPostArray(readJSON<unknown>(KEYS.myPosts, []));
  const storedMyReplies = asReplyArray(readJSON<unknown>(KEYS.myReplies, []));

  // 已发布/已转发的本体在 my-posts 里；mock 只读。合并后按时间倒序（新到旧）。
  const posts = sortPostsDesc(dedupeById([...storedMyPosts, ...MOCK.statuses]));
  const replies = dedupeById([...storedMyReplies, ...MOCK.comments]);

  return {
    posts,
    replies,
    likedIds,
    repostedIds,
    publishedIds,
    draft: readString(KEYS.draft, ''),
    theme: readStoredTheme(),
  };
}

// ---------------------------------------------------------------- reducer

function timestampForNewContent(state: AppState): number {
  const created = state.publishedIds.length + state.repostedIds.length + 1;
  const newestPost = state.posts[0]?.createdAt ?? BASE_TIMESTAMP;
  const newestReply = state.replies.reduce((max, reply) => Math.max(max, reply.createdAt), 0);
  // 新内容必须晚于「所有已有内容」，否则新回复会排在旧回复后面（AC-DT02 要求首条是新回复）。
  return Math.max(BASE_TIMESTAMP + created * 60000, newestPost + 60000, newestReply + 60000);
}

function nextNumberedId(prefix: string, ids: readonly string[]): string {
  let max = 0;
  for (const id of ids) {
    if (!id.startsWith(prefix)) continue;
    const n = Number.parseInt(id.slice(prefix.length), 10);
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

/** 下一条待发布动态的 id（UI 发布后用它做「新卡片」定位，reducer 用同一规则生成）。 */
export function nextPostId(state: AppState): string {
  return nextNumberedId(MY_POST_PREFIX, state.posts.map((post) => post.id));
}

/** 从正文里抽出 `#话题#`（去重、去 #，最多 3 个，与 reducer 的 publish 口径一致）。 */
export function topicsFromText(text: string): string[] {
  const found = text.match(/#[^#\s]{1,20}#/g) ?? [];
  const out: string[] = [];
  for (const raw of found) {
    const name = raw.slice(1, -1).trim();
    if (name && !out.includes(name) && out.length < 3) out.push(name);
  }
  return out;
}

export function canPublish(text: string, media: readonly MediaRef[]): boolean {
  return text.trim().length > 0 || media.length > 0;
}

export function countTopicsInText(text: string): number {
  // 成对的 #...# 计 1 个；不成对的忽略。
  const pairs = text.match(/#[^#\s]+#/g);
  return pairs ? pairs.length : 0;
}

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'like': {
      if (state.likedIds.includes(action.postId)) return state; // 幂等
      return { ...state, likedIds: [action.postId, ...state.likedIds] };
    }
    case 'unlike': {
      if (!state.likedIds.includes(action.postId)) return state; // 幂等
      return { ...state, likedIds: state.likedIds.filter((id) => id !== action.postId) };
    }
    case 'repost': {
      const target = state.posts.find((post) => post.id === action.postId);
      if (!target) return state; // 非法 id：安静忽略（不抛）
      if (state.repostedIds.includes(action.postId)) return state; // 幂等：INV-2
      const repost: Post = {
        id: nextNumberedId(MY_REPOST_PREFIX, state.repostedIds),
        authorId: CURRENT_USER.id,
        text: '',
        media: [],
        topics: [],
        repostOfId: action.postId,
        createdAt: timestampForNewContent(state),
        counts: { reposts: 0, replies: 0, likes: 0 },
      };
      return {
        ...state,
        posts: sortPostsDesc([repost, ...state.posts]),
        repostedIds: [action.postId, ...state.repostedIds],
      };
    }
    case 'reply': {
      const text = action.text.trim();
      if (!text) return state;
      const target = state.posts.find((post) => post.id === action.postId);
      if (!target) return state;
      if (action.replyToReplyId) {
        const parent = state.replies.find((reply) => reply.id === action.replyToReplyId);
        // 只允许一层楼中楼：父回复必须存在、同帖、且自身没有父级。
        if (!parent || parent.postId !== action.postId || parent.replyToReplyId !== null) return state;
      }
      const reply: Reply = {
        id: nextNumberedId(MY_REPLY_PREFIX, state.replies.map((item) => item.id)),
        postId: action.postId,
        authorId: CURRENT_USER.id,
        text: text.slice(0, 140),
        createdAt: timestampForNewContent(state),
        replyToReplyId: action.replyToReplyId,
      };
      return { ...state, replies: [...state.replies, reply] };
    }
    case 'publish': {
      const text = action.text.trim();
      const media = action.media.slice(0, 9);
      if (!canPublish(text, media)) return state;
      const topics = action.topics
        .map((topic) => topic.trim().replace(/^#|#$/g, ''))
        .filter((topic) => topic.length > 0 && topic.length <= 20 && !topic.includes('#'))
        .slice(0, 3);
      const postId = nextNumberedId(MY_POST_PREFIX, state.posts.map((item) => item.id));
      const post: Post = {
        id: postId,
        authorId: CURRENT_USER.id,
        text: text.slice(0, 500),
        media: media.map((ref, index) => ({ ...ref, id: `m_${postId}_${index + 1}` })),
        topics,
        repostOfId: null,
        createdAt: timestampForNewContent(state),
        counts: { reposts: 0, replies: 0, likes: 0 },
      };
      return {
        ...state,
        posts: sortPostsDesc([post, ...state.posts]),
        publishedIds: [post.id, ...state.publishedIds],
        draft: '',
      };
    }
    case 'setDraft':
      return { ...state, draft: action.text.slice(0, 500) };
    case 'setTheme':
      return state.theme === action.theme ? state : { ...state, theme: action.theme };
    case 'reset': {
      // 落盘清理由调用方先做（storage.clearAll），reducer 只负责回到 mock 初始态。
      return {
        posts: sortPostsDesc(MOCK.statuses),
        replies: [...MOCK.comments],
        likedIds: [],
        repostedIds: [],
        publishedIds: [],
        draft: '',
        theme: state.theme,
      };
    }
    default:
      return state;
  }
}

// ---------------------------------------------------------------- 选择器

export function findPost(state: AppState, postId: string): Post | undefined {
  return state.posts.find((post) => post.id === postId);
}

/** 某条动态的全部回复（含楼中楼），新到旧。 */
export function repliesOf(state: AppState, postId: string): Reply[] {
  return state.replies
    .filter((reply) => reply.postId === postId)
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id));
}

export function replyCountOf(state: AppState, postId: string): number {
  return state.replies.reduce((sum, reply) => (reply.postId === postId ? sum + 1 : sum), 0);
}

export function displayLikes(state: AppState, post: Post): number {
  return post.counts.likes + (state.likedIds.includes(post.id) ? 1 : 0);
}

export function likedByMe(state: AppState, postId: string): boolean {
  return state.likedIds.includes(postId);
}

export function repostedByMe(state: AppState, postId: string): boolean {
  return state.repostedIds.includes(postId);
}

export function displayReposts(state: AppState, post: Post): number {
  return post.counts.reposts + (state.repostedIds.includes(post.id) ? 1 : 0);
}

const FOLLOWING_AUTHOR_ID_SET: ReadonlySet<string> = new Set(FOLLOWING_AUTHOR_IDS);

/** 时间线 feed：关注 = 8 位被关注作者的动态；推荐 = 全部。两者都新到旧。 */
export function timelineFor(state: AppState, tab: FeedTab): Post[] {
  if (tab === 'following') {
    return state.posts.filter((post) => FOLLOWING_AUTHOR_ID_SET.has(post.authorId));
  }
  return state.posts;
}

export function profilePostsFor(state: AppState, tab: ProfileTab): Post[] {
  if (tab === 'liked') {
    return state.likedIds
      .map((id) => state.posts.find((post) => post.id === id))
      .filter((post): post is Post => !!post);
  }
  return state.posts.filter((post) => post.authorId === CURRENT_USER.id);
}

/** INV-3：我的动态数 = mock 基线 + 已发布数；口径与「我的博文」列表严格同源，
 *  保证统计行数字永远等于列表条数（含本人转发）。 */
export function statPostCount(state: AppState): number {
  return state.posts.filter((post) => post.authorId === CURRENT_USER.id).length;
}

/** 我发布的动态（新到旧），用于「我的」列表与持久化。 */
export function myPosts(state: AppState): Post[] {
  return state.posts.filter(isMyPost);
}

export function myReplies(state: AppState): Reply[] {
  return state.replies.filter(isMyReply);
}

/** 首屏可见条数：默认 20；自己新发/新转会即时进入可见集（AC-CP06 期望 20 → 21）。
 *  refresh（AC-TL09）与 load-more 的基准永远是 20，不受已发布数影响。 */
export function visibleTimelineCount(
  state: AppState,
  tab: FeedTab,
  firstPageOnly = false,
): number {
  const total = timelineFor(state, tab).length;
  const limit = firstPageOnly
    ? FIRST_PAGE_SIZE
    : FIRST_PAGE_SIZE + state.publishedIds.length + state.repostedIds.length;
  return Math.min(limit, total);
}

// ---------------------------------------------------------------- 持久化

/** 把内存态写回 localStorage（probe 未带 &persist=1 时调用方不应调用）。 */
export function persistState(state: AppState): void {
  writeJSON(KEYS.liked, state.likedIds);
  writeJSON(KEYS.reposted, state.repostedIds);
  writeJSON(KEYS.published, state.publishedIds);
  writeJSON(KEYS.myPosts, myPosts(state));
  writeJSON(KEYS.myReplies, myReplies(state));
  // 草稿由编辑器单独维护（发博页的失焦/输入节流），这里不写，避免旧 state.draft 覆盖用户正在写的内容。
  writeString(KEYS.theme, state.theme);
}

// ---------------------------------------------------------------- React 绑定

export interface StoreValue {
  state: AppState;
  dispatch: Dispatch<Action>;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ value, children }: { value: StoreValue; children: ReactNode }) {
  return createElement(StoreContext.Provider, { value }, children);
}

export function useStore(): StoreValue {
  const value = useContext(StoreContext);
  if (!value) throw new Error('useStore 必须在 StoreProvider 内使用');
  return value;
}

/** 骨架期便捷入口；App 会用自己的 useReducer（要先施加 boot 探针）。 */
export function useRillStore(): StoreValue {
  const [state, dispatch] = useReducer(reducer, undefined, () => createInitialState());
  return { state, dispatch };
}

export { readNumber, writeNumber, readString, writeString };