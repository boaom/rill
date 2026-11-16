// server/providers/mock.mjs —— 复用 src/data/mock.json 的只读 provider。
// 行为对齐前端现有选择器：推荐=全部、关注=除本人与 u_10/u_11/u_12 外的 8 位作者；
// 动态/回复均新到旧，回复按 createdAt desc + id asc 打破并列（与 src/store.ts 一致）。
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const DATA_URL = new URL('../../src/data/mock.json', import.meta.url);
const data = JSON.parse(readFileSync(fileURLToPath(DATA_URL), 'utf8'));

const clone = (value) => structuredClone(value);
const byPostTimeDesc = (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);
const byReplyTimeDesc = (a, b) => b.createdAt - a.createdAt || a.id.localeCompare(b.id);

const currentUser = data.users.find((user) => user.isCurrentUser) ?? data.users[0];
const followingIds = new Set(
  data.users
    .filter(
      (user) =>
        user.id !== currentUser.id && !['u_10', 'u_11', 'u_12'].includes(user.id),
    )
    .map((user) => user.id),
);

export class MockProvider {
  constructor() {
    this.name = 'mock';
    this.capabilities = { read: true, write: false, images: false };
    this.currentUserId = currentUser.id;
  }

  async getTimeline(arg = {}, cursorOrOptions = {}) {
    // 同时兼容 {tab,limit,offset} 和 docs/weibo-api.md 的 getTimeline(kind, cursor) 调用形态。
    const options = typeof arg === 'string'
      ? { tab: arg, ...(cursorOrOptions && typeof cursorOrOptions === 'object' ? cursorOrOptions : {}) }
      : (arg || {});
    const { tab = 'recommend', limit = 20, offset = 0 } = options;
    const safeLimit = Number.isFinite(Number(limit))
      ? Math.max(0, Math.min(100, Number(limit)))
      : 20;
    const safeOffset = Number.isFinite(Number(offset)) ? Math.max(0, Number(offset)) : 0;
    const posts = data.statuses
      .filter((post) => (tab === 'following' ? followingIds.has(post.authorId) : true))
      .slice()
      .sort(byPostTimeDesc);
    return clone(posts.slice(safeOffset, safeOffset + safeLimit));
  }

  async getStatus(id) {
    return clone(data.statuses.find((post) => post.id === id) ?? null);
  }

  async getComments(postId) {
    return clone(
      data.comments
        .filter((reply) => reply.postId === postId)
        .slice()
        .sort(byReplyTimeDesc),
    );
  }

  async getUser(uid) {
    return clone(data.users.find((user) => user.id === uid) ?? null);
  }

  async getUserPosts(uid) {
    return clone(
      data.statuses
        .filter((post) => post.authorId === uid)
        .slice()
        .sort(byPostTimeDesc),
    );
  }

  async search(query, kindOrOptions = {}) {
    const options = kindOrOptions && typeof kindOrOptions === 'object' ? kindOrOptions : {};
    const { limit = 20 } = options;
    const needle = String(query ?? '').trim().toLowerCase();
    if (!needle) return [];
    const authorText = new Map(
      data.users.map((user) => [
        user.id,
        `${user.nickname} ${user.handle}`.toLowerCase(),
      ]),
    );
    const safeLimit = Number.isFinite(Number(limit))
      ? Math.max(0, Math.min(100, Number(limit)))
      : 20;
    return clone(
      data.statuses
        .filter((post) => {
          const haystack = [
            post.text,
            post.topics.join(' '),
            authorText.get(post.authorId) ?? '',
          ]
            .join(' ')
            .toLowerCase();
          return haystack.includes(needle);
        })
        .slice()
        .sort(byPostTimeDesc)
        .slice(0, safeLimit),
    );
  }
}

export const mockData = data;