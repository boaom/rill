// scripts/mock-data.mjs
// 确定性 mock 生成器：固定种子（LCG），不使用 Math.random / Date.now。
// 输出结构 = docs/spec.md §5.3：12 作者 / 30 条动态 / 60 条回复；BASE = 1794801600000。
// 同一份代码任何时候重跑都产出逐字节一致的结果（CHECK 脚本会与仓库里的 mock.json 比对）。

export const BASE = 1794801600000;
const SEED = 0x51ed5e01;

/** 32 位 LCG（Numerical Recipes 常数），固定种子 → 固定序列 */
function makeRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

const rand = makeRandom(SEED);
const int = (n) => Math.floor(rand() * n);
const pick = (arr) => arr[int(arr.length)];

function shuffle(arr) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = int(i + 1);
    const t = out[i];
    out[i] = out[j];
    out[j] = t;
  }
  return out;
}

// 认证账号（新增样本）：u_05 = 首卡作者「沉舟」，u_11 = 长帖作者「摄影笔记」。
// 只有这 2 个为 true；其余一律 false。生成器不新增随机调用（否则整份数据会漂移）。
const VERIFIED_IDS = new Set(['u_05', 'u_11']);

// 客户端尾巴（新增样本）：按作者固定一台设备（同一作者所有动态同一条尾巴，共 12 种取值）。
// 与创作者风格一致：摄影号用 Pro/Max、读书号用 iPad、公众号用网页版/Mac、骑行号用 Android。
const SOURCE_BY_AUTHOR = {
  u_01: '来自 iPhone 15 Pro',
  u_02: '来自 iPhone 14 Pro',
  u_03: '来自 iPad Air',
  u_04: '来自 小米 14',
  u_05: '来自 iPhone 13 mini',
  u_06: '来自 网页版',
  u_07: '来自 Android 客户端',
  u_08: '来自 iPhone SE',
  u_09: '来自 iPad mini',
  u_10: '来自 iPhone 15',
  u_11: '来自 iPhone 15 Pro Max',
  u_12: '来自 Mac',
};

// 长帖样本（新增）：p_0007 的正文，>=140 字、有分段、含 1 个 #话题#、1 个 @提及、1 个 t.cn 短链。
// 选择 p_0007 而不是 p_0001：首卡被多处断言引用，正文保持短。
const LONG_POST_INDEX = 6; // 0-based → p_0007
const LONG_POST_TEXT = [
  '这两年我慢慢发现，记录本身比记录的内容更重要。',
  '',
  '一开始只是随手拍，后来变成每天走同一条路都会下意识找角度：树叶的影子、公交车进站的那两秒、便利店门口的灯。',
  '',
  '最大的变化是不太着急了。以前总想一次拍到最好的一张，现在更愿意在同一个路口站十分钟，等光慢慢挪过来。',
  '',
  '拍得多了才明白，所谓手感其实就是熟悉——熟悉这条街什么时候安静，熟悉哪一段墙在下午会发亮。',
  '',
  '如果你也在做类似的练习，欢迎来聊 @citywalk 。往期整理放在 https://t.cn/A6xYz123',
  '',
  '#城市散步#',
].join('\n');

const AUTHORS = [
  { id: 'u_01', nickname: '林见', handle: 'linjian', avatarText: '见', avatarHue: 168, bio: '在城里找安静的地方。', followingCount: 128, followerCount: 964, isCurrentUser: true },
  { id: 'u_02', nickname: '周迟', handle: 'zhouchi', avatarText: '迟', avatarHue: 24, bio: '拍云的人，偶尔写字。', followingCount: 42, followerCount: 3120, isCurrentUser: false },
  { id: 'u_03', nickname: '苏未', handle: 'suwei', avatarText: '未', avatarHue: 210, bio: '把周末留给书店。', followingCount: 76, followerCount: 880, isCurrentUser: false },
  { id: 'u_04', nickname: '阿野', handle: 'aye', avatarText: '野', avatarHue: 96, bio: '骑车穿过整座城。', followingCount: 155, followerCount: 2400, isCurrentUser: false },
  { id: 'u_05', nickname: '沉舟', handle: 'chenzhou', avatarText: '舟', avatarHue: 312, bio: '写点短句，慢慢攒起来。', followingCount: 63, followerCount: 1520, isCurrentUser: false },
  { id: 'u_06', nickname: '木南', handle: 'munan', avatarText: '南', avatarHue: 48, bio: '阳台上有六盆植物。', followingCount: 88, followerCount: 645, isCurrentUser: false },
  { id: 'u_07', nickname: '江余', handle: 'jiangyu', avatarText: '余', avatarHue: 268, bio: '晚饭后散步派。', followingCount: 31, followerCount: 1290, isCurrentUser: false },
  { id: 'u_08', nickname: '白露', handle: 'bailu', avatarText: '露', avatarHue: 196, bio: '记录天气和心情。', followingCount: 57, followerCount: 2080, isCurrentUser: false },
  { id: 'u_09', nickname: '顾行', handle: 'guxing', avatarText: '行', avatarHue: 12, bio: '早睡实验进行中。', followingCount: 24, followerCount: 730, isCurrentUser: false },
  { id: 'u_10', nickname: '城市漫游', handle: 'citywalk', avatarText: '漫', avatarHue: 200, bio: '走走停停，随手一看。', followingCount: 210, followerCount: 18400, isCurrentUser: false },
  { id: 'u_11', nickname: '摄影笔记', handle: 'shutterlog', avatarText: '摄', avatarHue: 268, bio: '只发图，偶尔配一句。', followingCount: 96, followerCount: 25300, isCurrentUser: false },
  { id: 'u_12', nickname: '深夜电台', handle: 'lateshow', avatarText: '夜', avatarHue: 330, bio: '夜里醒着的人都在这里。', followingCount: 74, followerCount: 9700, isCurrentUser: false },
];

// 文案全部自写；不搬运任何原文案，也不含禁用串。
const POST_TEXTS = [
  '今天的云像被风推着走的棉花，站在路口看了三分钟才想起来要赶地铁。',
  '雨停之后又绕了一段路，路面的水洼把整条街的灯都翻了一遍。',
  '把书翻到上次折角的地方，窗外刚好开始下雨，就没再抬头。',
  '骑车穿过老城区，修车铺的收音机在放一首很旧的歌，慢得像没有尽头。',
  '夜里十一点的便利店只有关东煮在冒热气，店员在补货，我在发呆。',
  '换了新的水杯，泡了最普通的茶，一天里居然多出一点仪式感。',
  '周末把手机放在抽屉里，读了两章书，发现时间其实没有变快。',
  '楼下那棵树又开始掉叶子了，扫地的阿姨说每年都是这几天。',
  '刚做完一顿简单的饭，番茄鸡蛋面，不好看但很好吃。',
  '出门忘带耳机，一路听着城市的声音，意外地没有烦躁。',
  '把去年拍的照片翻出来，发现自己其实记录了挺多普通的好日子。',
  '凌晨的街道很安静，只有便利店和红绿灯还醒着，像城市在值夜班。',
  '今天走了很远，只是为了看一场日落，结果看到了两场。',
  '整理书架时掉出一张旧车票，日期已经模糊，路线还记得。',
  '试着早睡了一周，白天真的没那么容易生气，决定继续。',
  '地铁上有人让了座，很普通的一件事，让整节车厢都柔和了一点。',
  '写不出东西的时候就去散步，走回来通常能写出三句话。',
  '新买的椅垫有点硬，坐久了反而坐直了，算是意外的收获。',
  '朋友寄来的明信片到了，邮戳很歪，字比上次认真。',
  '雨天的公交车开得很慢，玻璃上的水痕比窗外更好看。',
  '最近学会了一个人吃饭不刷手机，饭变得有味道了。',
  '傍晚跑了三公里，配速一般，但风很舒服，不打算再加。',
  '把衣柜收拾了一遍，发现常穿的衣服其实只有几件。',
  '在小店吃了一碗面，老板记得我不放香菜，忽然觉得住久了一点。',
  '今天的晚霞只持续了十分钟，正好被我赶上。',
  '看完一场电影走出来，街上已经亮了，像从一个季节走到另一个。',
  '给阳台上的植物换了盆，手上全是土，心情却意外地好。',
  '把待办清单删到只剩三项，终于完成了两项。',
  '入夜以后风变小了，窗户开着也不觉得冷，适合读点东西。',
  '把这一年的小事记在本子上，翻的时候发现大部分都值得。',
];

const REPLY_TEXTS = [
  '我也有同感。',
  '这张图真好看。',
  '记下了，周末去试试。',
  '确实，最近都这样。',
  '在哪个路口拍的？',
  '同款水杯。',
  '看完心情变好了。',
  '下次一起去。',
  '这条我存了。',
  '我也在整理书架。',
  '晚霞那十分钟真的短。',
  '散步确实有用。',
  '谢谢分享。',
  '刚好我这边也在下雨。',
];

const TOPIC_POOL = ['雨后散步', '周末读书', '城市散步', '随手拍', '晚风', '一杯茶', '旧书店', '天台'];
const MEDIA_ALTS = [
  '灰蓝色天空',
  '街角光斑',
  '绿植与窗台',
  '夜色路灯',
  '水面反光',
  '旧书页',
  '咖啡杯',
  '骑行路',
  '晚霞',
];

// 作者-动态分布（§5.3）：u_01 3 条；u_02…u_09 各 1；u_10 6；u_11 6；u_12 7 → 30
const AUTHOR_SLOTS = [
  'u_01', 'u_01', 'u_01',
  'u_02', 'u_03', 'u_04', 'u_05', 'u_06', 'u_07', 'u_08', 'u_09',
  'u_10', 'u_10', 'u_10', 'u_10', 'u_10', 'u_10',
  'u_11', 'u_11', 'u_11', 'u_11', 'u_11', 'u_11',
  'u_12', 'u_12', 'u_12', 'u_12', 'u_12', 'u_12', 'u_12',
];

// 配图分布（§5.3）：0 张 8 / 1 张 5 / 2 张 3 / 3 张 2 / 4 张 5 / 9 张 7
const MEDIA_SLOTS = [
  0, 0, 0, 0, 0, 0, 0, 0,
  1, 1, 1, 1, 1,
  2, 2, 2,
  3, 3,
  4, 4, 4, 4, 4,
  9, 9, 9, 9, 9, 9, 9,
];

const REPOST_INDEXES = [4, 13, 19, 25]; // 这 4 条是转发（一层）
const REPOST_TARGETS = [10, 15, 22, 28]; // 指向更早的原创
// 6 条带话题（总数不变）：把 p_0008 的位让给 p_0007 长帖 —— 正文里含 #城市散步#，
// 所以它的 topics 必须与之对应；条数与分布仍是 6 条。
const TOPIC_INDEXES = [2, 6, 11, 16, 21, 26];

export function buildMock() {
  const authorSlots = shuffle(AUTHOR_SLOTS);
  const mediaSlots = shuffle(MEDIA_SLOTS);

  // 让第一条（最新）固定 2 张图，首屏更像一张真实卡片；确定性交换不改变分布。
  const twoAt = mediaSlots.indexOf(2);
  if (twoAt !== 0) {
    mediaSlots[twoAt] = mediaSlots[0];
    mediaSlots[0] = 2;
  }

  const posts = [];
  for (let i = 0; i < 30; i += 1) {
    const pid = `p_${String(i + 1).padStart(4, '0')}`;
    const repostAt = REPOST_INDEXES.indexOf(i);
    const repostOf =
      repostAt === -1 ? null : `p_${String(REPOST_TARGETS[repostAt] + 1).padStart(4, '0')}`;

    const mediaCount = mediaSlots[i];
    const media = [];
    for (let k = 0; k < mediaCount; k += 1) {
      media.push({
        id: `m_${pid}_${k + 1}`,
        hue: 20 + ((i * 37 + k * 53) % 320),
        ratio: mediaCount === 1 ? 'wide' : k % 3 === 1 ? 'tall' : 'square',
        alt: MEDIA_ALTS[(i + k) % MEDIA_ALTS.length],
      });
    }

    const topicAt = TOPIC_INDEXES.indexOf(i);
    const topics =
      topicAt === -1
        ? []
        : TOPIC_POOL.slice(topicAt * 2 % 6, (topicAt * 2 % 6) + (i % 2 === 0 ? 1 : 2));

    posts.push({
      id: pid,
      authorId: authorSlots[i],
      text: repostOf
        ? '看到就转了，值得留一份。'
        : i === LONG_POST_INDEX
          ? LONG_POST_TEXT
          : POST_TEXTS[i],
      media,
      topics,
      repostOfId: repostOf,
      createdAt: BASE - i * 3600000 - ((i * 7919) % 1800000),
      source: SOURCE_BY_AUTHOR[authorSlots[i]],
      counts: { reposts: (i * 13) % 24, replies: 0, likes: 5 + ((i * 37) % 180) },
    });
  }

  // 回复：60 条分布在 p_0001…p_0029（p_0030 零回复，供详情空态用）
  const replyCounts = new Array(30).fill(0);
  for (let i = 0; i < 29; i += 1) replyCounts[i] = 1;
  for (let extra = 0; extra < 31; extra += 1) replyCounts[int(29)] += 1;

  const eligible = [];
  for (let i = 0; i < 29; i += 1) if (replyCounts[i] >= 2) eligible.push(i);
  const nestedPosts = new Set(shuffle(eligible).slice(0, 12));

  const comments = [];
  let counter = 0;
  for (let i = 0; i < 30; i += 1) {
    let firstReplyId = null;
    for (let k = 0; k < replyCounts[i]; k += 1) {
      counter += 1;
      const id = `c_${String(counter).padStart(4, '0')}`;
      const isNested = nestedPosts.has(i) && k === 1;
      comments.push({
        id,
        postId: posts[i].id,
        authorId: pick(AUTHORS).id,
        text: REPLY_TEXTS[(counter * 7) % REPLY_TEXTS.length],
        createdAt: posts[i].createdAt + (k + 1) * 180000 + ((counter * 7919) % 60000),
        replyToReplyId: isNested ? firstReplyId : null,
      });
      if (k === 0) firstReplyId = id;
    }
  }
  for (let i = 0; i < 30; i += 1) posts[i].counts.replies = replyCounts[i];

  const users = AUTHORS.map((a) => ({
    ...a,
    postCount: posts.filter((p) => p.authorId === a.id).length,
    verified: VERIFIED_IDS.has(a.id),
  }));

  return { users, statuses: posts, comments };
}