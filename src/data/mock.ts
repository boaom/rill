// src/data/mock.ts —— mock.json 的带类型入口 + 只读查询工具。
// 数据是直接 import 的 JSON（随包），首帧同步可用；无网络请求、无随机、无时间依赖。

import raw from './mock.json';
import type { Author, MockData, Post, Reply } from '../types';

export const MOCK: MockData = raw as unknown as MockData;
export const AUTHORS: Author[] = MOCK.users;
export const POSTS: Post[] = MOCK.statuses;
export const REPLIES: Reply[] = MOCK.comments;

export const AUTHOR_BY_ID: ReadonlyMap<string, Author> = new Map(
  AUTHORS.map((author) => [author.id, author]),
);

/** 当前用户（mock 中恰好一条 isCurrentUser=true；缺数据时退回第一条，避免白屏）。 */
export const CURRENT_USER: Author = AUTHORS.find((author) => author.isCurrentUser) ?? AUTHORS[0];

/**
 * 「关注」流 = 8 位他人作者（u_02…u_09，spec §6.1）。
 * u_10/u_11/u_12 只出现在「推荐」里，用来区分两条 feed。
 */
export const FOLLOWING_AUTHOR_IDS: readonly string[] = AUTHORS.filter(
  (author) => author.id !== CURRENT_USER.id && !['u_10', 'u_11', 'u_12'].includes(author.id),
).map((author) => author.id);

const UNKNOWN_AUTHOR: Author = {
  id: 'u_unknown',
  nickname: '未知作者',
  handle: 'unknown',
  avatarText: '?',
  avatarHue: 0,
  bio: '',
  followingCount: 0,
  followerCount: 0,
  postCount: 0,
  isCurrentUser: false,
};

/** 引用不存在时也返回一个可渲染对象（INV-6：不抛异常到 window.onerror）。 */
export function getAuthor(id: string): Author {
  return AUTHOR_BY_ID.get(id) ?? UNKNOWN_AUTHOR;
}

export function getMockPost(id: string): Post | undefined {
  return POSTS.find((post) => post.id === id);
}

export function repliesForMockPost(postId: string): Reply[] {
  return REPLIES.filter((reply) => reply.postId === postId);
}

/** 空数据集（probe=empty 用）：仅当前用户，动态与回复为空。 */
export const EMPTY_DATA: MockData = { users: [CURRENT_USER], statuses: [], comments: [] };