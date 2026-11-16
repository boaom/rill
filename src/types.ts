// src/types.ts —— 与 docs/spec.md §5.1 一致（7 接口 41 字段）。
// mock.json 顶层键沿用上游契约：users / statuses / comments。

export type ThemeMode = 'light' | 'dark';
export type FeedTab = 'following' | 'recommend';
export type ProfileTab = 'posts' | 'liked';
export type MediaRatio = 'square' | 'wide' | 'tall';

/** mock.json: users[] */
export interface Author {
  id: string; // 'u_01' … 'u_12'
  nickname: string; // 昵称，1–12 字
  handle: string; // '@' 后的短名，唯一，[a-z0-9_]{3,16}
  avatarText: string; // 头像占位字，1–2 字
  avatarHue: number; // 0–359，头像底色 hue
  bio: string; // 简介，0–60 字
  followingCount: number;
  followerCount: number;
  postCount: number; // mock 中该作者的动态数；本人页显示时叠加已发布数
  isCurrentUser: boolean; // 恰好一条为 true
  /**
   * 认证标识（蓝/V 由 UI 决定颜色）：mock 必须提供布尔值，恰好 2 个 true。
   * 在线适配层可能缺省（接口未返回）→ 读取侧一律用 `author.verified === true` 判断。
   */
  verified?: boolean;
}

/** 图片占位：无二进制资源，仅 hue + 比例 + alt */
export interface MediaRef {
  id: string; // 'm_p0001_1'
  hue: number; // 0–359
  ratio: MediaRatio; // 'square' | 'wide' | 'tall'
  alt: string; // ≤40 字
}

export interface Counts {
  reposts: number;
  replies: number;
  likes: number; // 基线计数；显示值 = likes + (liked ? 1 : 0)，见 INV-1
}

/** mock.json: statuses[] */
export interface Post {
  id: string; // 'p_0001' … 'p_0030'；新发布 'p_new_1'；转发 'p_rp_1'
  authorId: string;
  text: string; // 0–500 字（含话题标记）
  media: MediaRef[]; // 0–9 张
  topics: string[]; // 话题词，不含 '#'
  repostOfId: string | null; // 被转发原文 id；只允许一层
  createdAt: number; // epoch ms，确定性
  counts: Counts;
  /**
   * 客户端尾巴，形如 '来自 iPhone 15 Pro'（不含前后空格）。
   * mock 必须提供非空字符串（12 种取值，按作者固定）；新发布/在线可能缺省 →
   * 为空/缺省时呈现层不渲染尾巴，不编造来源。
   */
  source?: string;
}

/** mock.json: comments[] */
export interface Reply {
  id: string; // 'c_0001' … 'c_0060'；我发表的 'c_new_N'
  postId: string;
  authorId: string;
  text: string; // 1–140 字
  createdAt: number;
  replyToReplyId: string | null; // 楼中楼一级；只允许一层
}

/** mock.json 顶层结构 */
export interface MockData {
  users: Author[];
  statuses: Post[];
  comments: Reply[];
}

/** 运行期状态（reducer 单一真源） */
export interface AppState {
  posts: Post[]; // mock.statuses + 已发布/已转发（新到旧）
  replies: Reply[]; // mock.comments + 我发表的回复
  likedIds: string[];
  repostedIds: string[];
  publishedIds: string[];
  draft: string;
  theme: ThemeMode;
}

export type Action =
  | { type: 'like'; postId: string }
  | { type: 'unlike'; postId: string }
  | { type: 'repost'; postId: string }
  | { type: 'reply'; postId: string; text: string; replyToReplyId: string | null }
  | { type: 'publish'; text: string; media: MediaRef[]; topics: string[] }
  | { type: 'setDraft'; text: string }
  | { type: 'setTheme'; theme: ThemeMode }
  | { type: 'reset' };