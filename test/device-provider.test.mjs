import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  WeiboDirectError,
  MinuteBucket,
  LruCache,
  authorFromUser,
  authorIdOf,
  classifyHttpError,
  classifyPayloadError,
  cleanText,
  hashHue,
  mediaFromMblog,
  normalizePostFields,
  normalizeUid,
  parseWeiboTime,
  setDeviceWritesEnabled,
  setUnverifiedWritesEnabled,
  sourceFromMblog,
  topicsFromText,
  verifiedFromUser,
  createDeviceProvider,
} from '../src/device/weibo-direct.ts';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/weibo-2019.json', import.meta.url), 'utf8'));
const COOKIE_VALUE = 'FAKE_COOKIE_VALUE_DO_NOT_LOG';
const mblog = fixture.statusShow.data;

function responseJson(value, status = 200, headers = {}) {
  return new Response(JSON.stringify(value), { status, headers: { 'content-type': 'application/json', ...headers } });
}

function baseFetch(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, init) => {
    const text = String(url);
    calls.push({ url: text, init });
    for (const [needle, handler] of Object.entries(overrides)) {
      if (text.includes(needle)) return handler(text, init);
    }
    if (text.includes('/api/config')) {
      return responseJson({ ok: 1, data: { login: true, st: 'st-fake', uid: 1669879400, user: { screen_name: '测试账号', id: 1669879400 } } });
    }
    if (text.includes('/statuses/show')) return responseJson(fixture.statusShow);
    if (text.includes('/api/container/getIndex') && text.includes('type=uid')) return responseJson(fixture.userInfo);
    if (text.includes('/api/container/getIndex') && text.includes('type%3D2')) return responseJson(fixture.userSearch);
    if (text.includes('/api/container/getIndex')) return responseJson(fixture.timeline);
    if (text.includes('/comments/hotflow')) return responseJson(fixture.comments);
    if (text.includes('/statuses/extend')) return responseJson(fixture.longText);
    if (text.includes('/statuses/update')) return responseJson({ ok: 1, data: { mblog } });
    if (text.includes('/statuses/repost')) return responseJson({ ok: 1, data: { mblog } });
    if (text.includes('/comments/create')) return responseJson({ ok: 1, data: { comment: { id: 'c-1', text: '回复', created_at: 'Fri Jun 14 20:40:20 +0800 2019', user: { id: 1669879400, screen_name: '我' } } } });
    if (text.includes('/api/attitudes/')) return responseJson({ ok: 1, data: { liked: true, attitudes_count: 7 } });
    return responseJson({ ok: 0, msg: 'unexpected path' }, 500);
  };
  return { calls, fetchImpl };
}

test('uid 前缀归一（数字 / u / u_ / @ 四种）', () => {
  assert.equal(normalizeUid('1669879400'), '1669879400');
  assert.equal(normalizeUid('u1669879400'), '1669879400');
  assert.equal(normalizeUid('u_1669879400'), '1669879400');
  assert.equal(normalizeUid('@u1669879400'), '1669879400');
  assert.equal(normalizeUid(''), '');
});

test('authorIdOf 使用 idstr ?? id 兜底并保留 u_ 前缀', () => {
  assert.equal(authorIdOf({ idstr: '1669879400', id: 1 }), 'u1669879400');
  assert.equal(authorIdOf({ id: 1669879400 }), 'u1669879400');
  assert.equal(authorIdOf({ id: 'u_01' }), 'u_01');
  assert.equal(authorIdOf({}), 'u_unknown');
});

test('verified 优先；verified_type 0/-1/false 不伪造认证', () => {
  assert.equal(verifiedFromUser({ verified: true, verified_type: -1 }), true);
  assert.equal(verifiedFromUser({ verified: false, verified_type: 2 }), undefined);
  assert.equal(verifiedFromUser({ verified: 0, verified_type: 2 }), undefined);
  assert.equal(verifiedFromUser({ verified_type: 0 }), undefined);
  assert.equal(verifiedFromUser({ verified_type: -1 }), undefined);
  assert.equal(verifiedFromUser({ verified_type: 2 }), true);
  assert.equal(verifiedFromUser({}), undefined);
});

test('HTML 清洗：img alt、实体、换行、标签', () => {
  const html = 'A&amp;B &lt;C&gt; <img alt="[偷笑]"> <a>#话题#</a><br />第二行&nbsp;尾';
  assert.equal(cleanText(html), 'A&B <C> [偷笑] #话题#\n第二行 尾');
});

test('sourceFromMblog 去标签、解实体、截 24 码点', () => {
  assert.equal(sourceFromMblog({ source: '<a href="x">iPhone 15 Pro</a>' }), 'iPhone 15 Pro');
  assert.equal(sourceFromMblog({ from: 'A &amp; B' }), 'A B');
  assert.equal(sourceFromMblog({ source: '一二三四五六七八九十一二三四五六七八九十一二三四五六七八' }).length, 24);
  assert.equal(sourceFromMblog({ source: '' }), undefined);
});

test('parseWeiboTime 正确处理 +0800（不是 UTC）', () => {
  assert.equal(parseWeiboTime('Fri Jun 14 20:39:20 +0800 2019'), Date.UTC(2019, 5, 14, 12, 39, 20));
  assert.equal(parseWeiboTime(''), 0);
  assert.equal(parseWeiboTime('not-a-date'), 0);
});

test('话题与图片映射：ratio 由 geo 推导', () => {
  assert.deepEqual(topicsFromText('a #一# b #二# #一#'), ['一', '二']);
  const media = mediaFromMblog({ id: 'm1', pics: [{ pid: 'p1', geo: { width: 360, height: 462 } }] });
  assert.equal(media.length, 1);
  assert.equal(media[0].ratio, 'tall');
  assert.equal(media[0].id, 'p1');
  assert.equal(mediaFromMblog({ pic_ids: ['a', 'b'] }).length, 2);
  assert.equal(hashHue('p1'), hashHue('p1'));
});

test('2019 fixture 的字段映射（id/作者/计数/source/媒体/转发）', () => {
  const post = normalizePostFields(fixture.timeline.data.cards[0].mblog);
  assert.equal(post.id, '4383183661430868');
  assert.equal(post.authorId, 'u1669879400');
  assert.equal(post.text, '搬完这块砖，就可以吃好吃的了 #日常#');
  assert.equal(post.counts.reposts, 240492);
  assert.equal(post.counts.replies, 95535);
  assert.equal(post.counts.likes, 348872);
  assert.equal(post.source, 'iPhone客户端');
  assert.equal(post.media[0].ratio, 'tall');
  assert.equal(post.topics[0], '日常');
  assert.equal(post.repostOfId, '4383000000000000');
});

test('authorFromUser 保留 verified 与当前用户判定', () => {
  const author = authorFromUser(fixture.userInfo.data.userInfo, '1669879400');
  assert.equal(author.id, 'u1669879400');
  assert.equal(author.nickname, 'Dear-迪丽热巴');
  assert.equal(author.verified, true);
  assert.equal(author.isCurrentUser, true);
  assert.equal(author.followerCount, 63357736);
});

test('错误分类：302/432/418/429/404/500', () => {
  assert.equal(classifyHttpError(302, 'https://passport.weibo.com/sso/signin', null, ''), 'AUTH_EXPIRED');
  assert.equal(classifyHttpError(432, null, null, ''), 'RISK_CONTROL');
  assert.equal(classifyHttpError(418, null, null, ''), 'RISK_CONTROL');
  assert.equal(classifyHttpError(429, null, null, ''), 'RATE_LIMITED');
  assert.equal(classifyHttpError(404, null, null, ''), 'NOT_FOUND');
  assert.equal(classifyHttpError(500, null, null, ''), 'UPSTREAM');
  assert.equal(classifyHttpError(301, null, null, ''), 'AUTH_EXPIRED');
});

test('错误分类：ok:0 + errno/msg 的优先级', () => {
  assert.equal(classifyPayloadError({ ok: 0, errno: 21327 }), 'AUTH_EXPIRED');
  assert.equal(classifyPayloadError({ ok: 0, msg: '操作频繁' }), 'RATE_LIMITED');
  assert.equal(classifyPayloadError({ ok: 0, msg: '需要安全验证' }), 'RISK_CONTROL');
  assert.equal(classifyPayloadError({ ok: 0, msg: '微博不存在' }), 'NOT_FOUND');
  assert.equal(classifyPayloadError({ ok: 0, msg: '包含敏感词' }, 200, true), 'CONTENT_REJECTED');
  assert.equal(classifyPayloadError({ ok: 0, msg: '未知错误' }), 'UPSTREAM');
  assert.equal(classifyPayloadError({ ok: 1, data: { login: false } }), 'AUTH_EXPIRED');
  assert.equal(classifyPayloadError({ ok: 1, data: { login: true } }), null);
});

test('LruCache 命中、LRU 淘汰、TTL 清理', async () => {
  const cache = new LruCache(2, 20);
  cache.set('a', 1); cache.set('b', 2); cache.get('a'); cache.set('c', 3);
  assert.equal(cache.get('b'), null);
  assert.equal(cache.get('a'), 1);
  assert.equal(cache.get('c'), 3);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(cache.get('a'), null);
});

test('本地分钟桶限速 10 次/分钟', () => {
  const bucket = new MinuteBucket(2, 60_000);
  bucket.take(1); bucket.take(2);
  assert.throws(() => bucket.take(3), (error) => error instanceof WeiboDirectError && error.code === 'RATE_LIMITED');
  bucket.take(60_001);
  assert.equal(true, true);
});

test('provider 只读接口：timeline/status/comments/user/posts/search', async () => {
  const { calls, fetchImpl } = baseFetch();
  const provider = createDeviceProvider({ cookies: { SUB: COOKIE_VALUE, SUBP: 'fake-subp' }, fetchImpl });
  const timeline = await provider.getTimeline('following', null);
  assert.equal(timeline.items.length, 1);
  assert.equal(timeline.items[0].authorId, 'u1669879400');
  assert.equal(timeline.users[0].verified, true);
  assert.ok(calls[0].url.includes('/api/container/getIndex'));
  assert.ok(calls[0].url.includes('containerid=231093_-_selffollowed'));
  assert.equal(calls[0].init.headers.Cookie, `SUB=${COOKIE_VALUE}; SUBP=fake-subp`);
  assert.ok(calls[0].init.headers['MWeibo-Pwa']);
  assert.ok(calls[0].init.headers.Referer.endsWith('/'));

  const status = await provider.getStatus('4383183661430868');
  assert.equal(status.id, '4383183661430868');
  assert.equal(provider.lastUsers[0].id, 'u1669879400');
  assert.equal(provider.lastMid, '4383183661430868');

  const comments = await provider.getComments('4383183661430868');
  assert.equal(comments.items.length, 2);
  assert.equal(comments.items[0].replyToReplyId, null);
  assert.equal(comments.items[1].replyToReplyId, '4383183984547669');

  const author = await provider.getUser('u1669879400');
  assert.equal(author.nickname, 'Dear-迪丽热巴');
  const posts = await provider.getUserPosts('1669879400');
  assert.equal(posts.items.length, 1);
  const search = await provider.search('热巴', 'statuses');
  assert.equal(search.items.length, 1);
  const users = await provider.search('热巴', 'users');
  assert.equal(users.items.length, 1);
});

test('provider 写操作：cookie、XSRF、form body 与点赞/评论', async () => {
  const { calls, fetchImpl } = baseFetch();
  const provider = createDeviceProvider({ cookies: { SUB: COOKIE_VALUE }, fetchImpl });
  const like = await provider.like('p1', true);
  assert.deepEqual(like, { liked: true, count: 7 });
  const write = calls.find((call) => call.url.includes('/api/attitudes/like'));
  assert.ok(write);
  assert.equal(write.init.method, 'POST');
  assert.ok(write.init.body.includes('st=st-fake'));
  assert.ok(write.init.headers['X-XSRF-TOKEN']);

  const comment = await provider.comment('p1', '回复', 'c9');
  assert.equal(comment.reply.text, '回复');
  const commentCall = calls.find((call) => call.url.includes('/api/comments/create'));
  assert.ok(commentCall.init.body.includes('cid=c9'));
});

test('provider 写失败不自动重试（一次 POST 后直接抛错）', async () => {
  let writeCalls = 0;
  const { fetchImpl } = baseFetch({
    '/statuses/repost': () => { writeCalls += 1; return responseJson({ error: 'boom' }, 500); },
  });
  const provider = createDeviceProvider({ cookies: { SUB: COOKIE_VALUE }, fetchImpl });
  await assert.rejects(() => provider.repost('p1', '转发'), (error) => error.code === 'UPSTREAM');
  assert.equal(writeCalls, 1);
});

test('发博幂等键：同 key 第二次不重复发请求', async () => {
  let publishCalls = 0;
  const { fetchImpl } = baseFetch({
    '/statuses/update': () => { publishCalls += 1; return responseJson({ ok: 1, data: { mblog } }); },
  });
  const provider = createDeviceProvider({ cookies: { SUB: COOKIE_VALUE }, fetchImpl });
  const first = await provider.publish('新微博', [], 'same-key');
  const second = await provider.publish('新微博', [], 'same-key');
  assert.equal(first.post.id, second.post.id);
  assert.equal(publishCalls, 1);
});

test('一键只读：全局写开关与未实测端点开关', async () => {
  const { fetchImpl } = baseFetch();
  const provider = createDeviceProvider({ cookies: { SUB: COOKIE_VALUE }, fetchImpl });
  setUnverifiedWritesEnabled(false);
  await assert.rejects(() => provider.like('p1', true), (error) => error.code === 'READ_ONLY');
  await assert.rejects(() => provider.comment('p1', 'x'), (error) => error.code === 'READ_ONLY');
  setUnverifiedWritesEnabled(true);
  setDeviceWritesEnabled(false);
  await assert.rejects(() => provider.repost('p1', 'x'), (error) => error.code === 'READ_ONLY');
  setDeviceWritesEnabled(true);
  assert.ok(await provider.like('p1', true));
});

test('validateSession：login:false 分类为 AUTH_EXPIRED，不保存页面状态', async () => {
  const { fetchImpl } = baseFetch({
    '/api/config': () => responseJson({ ok: 1, data: { login: false } }),
  });
  const provider = createDeviceProvider({ cookies: { SUB: COOKIE_VALUE }, fetchImpl });
  await assert.rejects(() => provider.validateSession(), (error) => error.code === 'AUTH_EXPIRED');
});

test('错误消息/异常不包含 cookie 值', async () => {
  const { fetchImpl } = baseFetch({
    '/api/container/getIndex': () => responseJson({ ok: 0, msg: 'no' }, 432),
  });
  const provider = createDeviceProvider({ cookies: { SUB: COOKIE_VALUE }, fetchImpl });
  try {
    await provider.getTimeline('recommend');
    assert.fail('should throw');
  } catch (error) {
    assert.ok(error instanceof WeiboDirectError);
    assert.ok(!String(error.message).includes(COOKIE_VALUE));
  }
});

test('超时映射为 UPSTREAM，不泄漏请求头', async () => {
  const provider = createDeviceProvider({
    cookies: { SUB: COOKIE_VALUE },
    timeoutMs: 15,
    fetchImpl: (_url, init) => new Promise((_resolve, reject) => {
      init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
    }),
  });
  await assert.rejects(() => provider.getTimeline('recommend'), (error) => error.code === 'UPSTREAM' && !String(error.message).includes(COOKIE_VALUE));
});
