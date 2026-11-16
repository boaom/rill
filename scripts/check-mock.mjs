// scripts/check-mock.mjs —— mock 数据契约自检（pnpm build 前置）
// 1) 仓库里的 src/data/mock.json 必须与确定性生成器的当前输出逐字节一致（防止手改 / 漂移）
// 2) §5.2/§5.3 的结构、引用完整性、分布、不变量全部校验
// 3) 新增样本（长文 / 认证 / 客户端尾巴）自身的不变量，防止数据退回纸面规则
// 退出码非 0 即视为数据层坏了，不允许进入构建。

import { readFileSync } from 'node:fs';
import { buildMock } from './mock-data.mjs';

const path = new URL('../src/data/mock.json', import.meta.url);
const raw = readFileSync(path, 'utf8');
const expected = `${JSON.stringify(buildMock(), null, 2)}\n`;
const errors = [];

if (raw !== expected) {
  errors.push('mock.json 与确定性生成器输出不一致：请跑 pnpm gen:mock 并提交结果（不要手改）');
}

const data = JSON.parse(raw);
const { users, statuses, comments } = data;

const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const forbid = /unique|微博|weibo|sina|app\.unique\.one/i;

// 新增样本的锚点：长帖 = p_0007；首卡作者 = statuses[0].authorId
const LONG_POST_ID = 'p_0007';
const EXPECTED_VERIFIED = 2;
const EXPECTED_SOURCE_COUNT = 12;

// ---------- users ----------
if (users.length !== 12) errors.push(`users 应为 12 条，实际 ${users.length}`);
if (new Set(users.map((u) => u.id)).size !== users.length) errors.push('users.id 有重复');
if (users.filter((u) => u.isCurrentUser).length !== 1) errors.push('isCurrentUser=true 必须恰好 1 条');
if (users[0].id !== 'u_01' || users[0].isCurrentUser !== true) errors.push('u_01 必须是当前用户');
for (const u of users) {
  if (!/^u_\d{2}$/.test(u.id)) errors.push(`${u.id}: id 不匹配 u_NN`);
  if (!/^[a-z0-9_]{3,16}$/.test(u.handle)) errors.push(`${u.id}: handle 不匹配 [a-z0-9_]{3,16}`);
  if (u.nickname.length < 1 || u.nickname.length > 12) errors.push(`${u.id}: nickname 长度越界`);
  if (u.avatarText.length < 1 || u.avatarText.length > 2) errors.push(`${u.id}: avatarText 长度越界`);
  if (!(u.avatarHue >= 0 && u.avatarHue <= 359)) errors.push(`${u.id}: avatarHue 越界`);
  if (u.bio.length > 60) errors.push(`${u.id}: bio 超过 60 字`);
  if (typeof u.verified !== 'boolean') errors.push(`${u.id}: verified 必须是布尔，实际 ${typeof u.verified}`);
  for (const k of ['followingCount', 'followerCount', 'postCount']) {
    if (!Number.isInteger(u[k]) || u[k] < 0) errors.push(`${u.id}: ${k} 必须为非负整数`);
  }
}
if (new Set(users.map((u) => u.handle)).size !== users.length) errors.push('users.handle 有重复');
const verifiedUsers = users.filter((u) => u.verified === true);
if (verifiedUsers.length !== EXPECTED_VERIFIED) {
  errors.push(`verified=true 应恰好 ${EXPECTED_VERIFIED} 个，实际 ${verifiedUsers.length}（${verifiedUsers.map((u) => u.id).join(',')}）`);
}

// ---------- statuses ----------
if (statuses.length !== 30) errors.push(`statuses 应为 30 条，实际 ${statuses.length}`);
const postsById = new Map();
for (const p of statuses) {
  if (postsById.has(p.id)) errors.push(`${p.id}: 重复`);
  postsById.set(p.id, p);
  if (!/^p_\d{4}$/.test(p.id)) errors.push(`${p.id}: id 不匹配 p_NNNN`);
  if (!users.some((u) => u.id === p.authorId)) errors.push(`${p.id}: authorId 不存在`);
  if (p.text.length > 500) errors.push(`${p.id}: 正文超过 500 字`);
  if (p.text.length === 0 && p.media.length === 0 && p.repostOfId === null) {
    errors.push(`${p.id}: 空正文必须带图或转发原文`);
  }
  if (p.media.length > 9) errors.push(`${p.id}: 配图超过 9 张`);
  if (p.topics.length > 3) errors.push(`${p.id}: 话题超过 3 个`);
  for (const t of p.topics) {
    if (t.length < 1 || t.length > 20) errors.push(`${p.id}: 话题长度越界`);
    if (t.includes('#')) errors.push(`${p.id}: 话题词不得含 #`);
  }
  if (!Number.isInteger(p.createdAt)) errors.push(`${p.id}: createdAt 必须是整数 epoch ms`);
  for (const k of ['reposts', 'replies', 'likes']) {
    if (!Number.isInteger(p.counts[k]) || p.counts[k] < 0) errors.push(`${p.id}: counts.${k} 非法`);
  }
  const ratioc = { square: 1, wide: 1, tall: 1 };
  for (const m of p.media) {
    if (!ratioc[m.ratio]) errors.push(`${p.id}/${m.id}: ratio 非法`);
    if (!(m.hue >= 0 && m.hue <= 359)) errors.push(`${p.id}/${m.id}: hue 越界`);
    if (m.alt.length < 1 || m.alt.length > 40) errors.push(`${p.id}/${m.id}: alt 长度越界`);
  }
  if (p.media.length === 1 && p.media[0].ratio !== 'wide') errors.push(`${p.id}: 单图必须为 wide`);
}

// 新增样本①：每条动态都有非空客户端尾巴；12 种取值；同一作者固定同一台设备
const sources = new Set();
const sourceByAuthor = new Map();
for (const p of statuses) {
  if (typeof p.source !== 'string') {
    errors.push(`${p.id}: source 必须是字符串，实际 ${typeof p.source}`);
    continue;
  }
  if (p.source.trim().length === 0) errors.push(`${p.id}: source 不得为空`);
  if (p.source !== p.source.trim()) errors.push(`${p.id}: source 首尾不得有空白`);
  if (p.source.length > 24) errors.push(`${p.id}: source 超过 24 字`);
  sources.add(p.source);
  const seen = sourceByAuthor.get(p.authorId);
  if (seen !== undefined && seen !== p.source) {
    errors.push(`${p.authorId}: 同作者的 source 应固定（${seen} / ${p.source}）`);
  }
  sourceByAuthor.set(p.authorId, p.source);
}
if (sources.size !== EXPECTED_SOURCE_COUNT) {
  errors.push(`source 应有 ${EXPECTED_SOURCE_COUNT} 种取值，实际 ${sources.size}`);
}

// 新增样本②：长帖 = 正文 >=140 字、有分段、含 #话题# / @提及 / t.cn 短链，topics 与之对应
const longPost = postsById.get(LONG_POST_ID);
if (!longPost) errors.push(`${LONG_POST_ID}: 长帖样本不存在`);
else {
  if (longPost.text.length < 140) errors.push(`${LONG_POST_ID}: 长帖正文应 >=140 字，实际 ${longPost.text.length}`);
  if (longPost.text.length > 500) errors.push(`${LONG_POST_ID}: 长帖正文超过 500 字`);
  if (!longPost.text.includes('\n')) errors.push(`${LONG_POST_ID}: 长帖应有分段（换行）`);
  if (!/#[^#\s]{1,20}#/.test(longPost.text)) errors.push(`${LONG_POST_ID}: 长帖应含 1 个 #话题#`);
  if (!/@[a-z0-9_]{3,16}/.test(longPost.text)) errors.push(`${LONG_POST_ID}: 长帖应含 1 个 @提及（合法 handle）`);
  if (!/t\.cn\//.test(longPost.text)) errors.push(`${LONG_POST_ID}: 长帖应含 1 个 t.cn 短链`);
  if (longPost.topics.length !== 1) errors.push(`${LONG_POST_ID}: 长帖应恰好 1 个话题词，实际 ${longPost.topics.length}`);
  for (const t of longPost.topics) {
    if (!longPost.text.includes(`#${t}#`)) errors.push(`${LONG_POST_ID}: topics 里的「${t}」必须出现在正文的 #…# 里`);
  }
  if (longPost.repostOfId !== null) errors.push(`${LONG_POST_ID}: 长帖必须是原创（不能是转发）`);
}

// 新增样本③：首卡作者与长帖作者都必须 verified（两个锚点各一个认证）
const firstCardAuthor = users.find((u) => u.id === statuses[0].authorId);
if (!firstCardAuthor || firstCardAuthor.verified !== true) errors.push('首卡作者必须 verified=true');
if (longPost && users.find((u) => u.id === longPost.authorId)?.verified !== true) errors.push('长帖作者必须 verified=true');

for (let i = 1; i < statuses.length; i += 1) {
  if (!(statuses[i - 1].createdAt > statuses[i].createdAt)) {
    errors.push(`statuses 未严格按 createdAt 倒序（位置 ${i}）`);
    break;
  }
}
for (const p of statuses) {
  if (p.repostOfId === null) continue;
  const target = postsById.get(p.repostOfId);
  if (!target) errors.push(`${p.id}: 转发原文不存在`);
  else {
    if (target.id === p.id) errors.push(`${p.id}: 不得转发自身`);
    if (target.repostOfId !== null) errors.push(`${p.id}: 只允许一层转发`);
  }
}

const mediaDist = {};
for (const p of statuses) mediaDist[p.media.length] = (mediaDist[p.media.length] || 0) + 1;
const expectedMediaDist = { 0: 8, 1: 5, 2: 3, 3: 2, 4: 5, 9: 7 };
if (!eq(mediaDist, expectedMediaDist)) {
  errors.push(`配图分布应为 ${JSON.stringify(expectedMediaDist)}，实际 ${JSON.stringify(mediaDist)}`);
}
const repostCount = statuses.filter((p) => p.repostOfId !== null).length;
if (repostCount !== 4) errors.push(`repostOfId 非空应为 4 条，实际 ${repostCount}`);
const topicCount = statuses.filter((p) => p.topics.length > 0).length;
if (topicCount !== 6) errors.push(`topics 非空应为 6 条，实际 ${topicCount}`);

const authorPostDist = {};
for (const u of users) authorPostDist[u.id] = statuses.filter((p) => p.authorId === u.id).length;
for (const u of users) {
  if (u.postCount !== authorPostDist[u.id]) errors.push(`${u.id}: postCount 与 mock 动态数不一致`);
}
const expectedAuthorDist = {
  u_01: 3, u_02: 1, u_03: 1, u_04: 1, u_05: 1, u_06: 1, u_07: 1, u_08: 1, u_09: 1,
  u_10: 6, u_11: 6, u_12: 7,
};
if (!eq(authorPostDist, expectedAuthorDist)) {
  errors.push(`作者-动态分布应为 ${JSON.stringify(expectedAuthorDist)}，实际 ${JSON.stringify(authorPostDist)}`);
}

// ---------- comments ----------
if (comments.length !== 60) errors.push(`comments 应为 60 条，实际 ${comments.length}`);
const repliesById = new Map();
for (const c of comments) {
  if (repliesById.has(c.id)) errors.push(`${c.id}: 重复`);
  repliesById.set(c.id, c);
  if (!/^c_\d{4}$/.test(c.id)) errors.push(`${c.id}: id 不匹配 c_NNNN`);
  const post = postsById.get(c.postId);
  if (!post) errors.push(`${c.id}: postId 不存在`);
  else if (!(c.createdAt > post.createdAt)) errors.push(`${c.id}: createdAt 必须晚于其动态`);
  if (!users.some((u) => u.id === c.authorId)) errors.push(`${c.id}: authorId 不存在`);
  if (c.text.trim().length < 1 || c.text.length > 140) errors.push(`${c.id}: 正文 1–140 字`);
}
for (const c of comments) {
  if (c.replyToReplyId === null) continue;
  const parent = repliesById.get(c.replyToReplyId);
  if (!parent) errors.push(`${c.id}: 父回复不存在`);
  else {
    if (parent.postId !== c.postId) errors.push(`${c.id}: 父回复不在同一条动态下`);
    if (parent.replyToReplyId !== null) errors.push(`${c.id}: 楼中楼只允许一层`);
  }
}
const nested = comments.filter((c) => c.replyToReplyId !== null).length;
if (nested !== 12) errors.push(`楼中楼应为 12 条，实际 ${nested}`);

const repliesPerPost = {};
for (const c of comments) repliesPerPost[c.postId] = (repliesPerPost[c.postId] || 0) + 1;
const postsWithReplies = Object.keys(repliesPerPost).length;
if (postsWithReplies !== 29) errors.push(`回复应分布在 29 条动态上，实际 ${postsWithReplies}`);
if ((repliesPerPost['p_0030'] || 0) !== 0) errors.push('p_0030 必须 0 回复（详情空态用）');
for (const p of statuses) {
  const actual = repliesPerPost[p.id] || 0;
  if (p.counts.replies !== actual) errors.push(`${p.id}: counts.replies(${p.counts.replies}) ≠ 实际回复数(${actual})`);
}

// ---------- 禁用串 ----------
if (forbid.test(raw)) errors.push('mock.json 含禁用串');

// ---------- 输出 ----------
const summary = {
  users: users.length,
  statuses: statuses.length,
  comments: comments.length,
  mediaDist,
  repost: repostCount,
  topics: topicCount,
  nested,
  postsWithReplies,
  verified: verifiedUsers.length,
  sources: sources.size,
  longPost: longPost ? longPost.text.length : 0,
};
if (errors.length > 0) {
  console.error(`[check:mock] FAIL (${errors.length})`);
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}
console.log(`[check:mock] OK ${JSON.stringify(summary)}`);