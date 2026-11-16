# 溪流（Rill）v0.1 验收报告（**复审版 / t8**）—— 49/49 通过

> 验收对象：`weibo-lite/`（builder T4 交付 + T7 修复）
> 验收人：verifier（t6 初验 → **t8 复审**），独立复核：自写 CDP 客户端（Node 全局 `WebSocket` + `fetch`，不依赖 puppeteer/playwright），自写断言脚本，未复用 builder 的断言代码。
> 时间：2026-11-16 13:17 – 13:25（Asia/Shanghai）｜Chrome 157.0.8103.52｜Node v26.10.0｜vite 5.4.21｜react 18.3.1｜typescript 5.6.3
> 上一轮（t6）结论见 §10「与 t6 的差异摘要」：44 通过 / 5 失败（blocker B-1），本轮全部转绿。

---

## 0. 结论

| 项 | t6（上一轮） | **t8（本轮复审）** |
| --- | --- | --- |
| 49 条验收点 | 44 通过 / 5 失败 | **49 通过 / 0 失败** |
| 失败根因 | B-1：关闭态设置 `<dialog>` 仍 `display:block`、`z-index:40`，常驻覆盖并吃掉指针事件 | **已修复**：`src/styles/profile.css:31` 加 `.sheet:not([open]) { display: none; }`；产物 CSS 里可 grep 到 `not([open]){display:none}` |
| 关闭态渲染 | `display:block`、rect `0,532,375,280` | `display:none`、**rect `0,0,0,0`**、scrim 不渲染 |
| 375 遮挡 | 四路由被挡 7–10 个可见控件、tabbar 整条不可点 | **四路由 covered = 0/10、0/12、0/9、0/6**；tabbar 中心命中 `A.tab` |
| 合同外 X-1（375 发布按钮被盖） | ❌ 被盖 | ✅ (337,728) 命中 `BUTTON.publish-btn`，点后 route=timeline、post-count 20→21 |
| 合同外 X-2（768/1440 卡片操作行被盖） | ❌ 被盖 | ✅ 768 (229,512) / 1440 (565,450) 命中 `like-btn`，5→6；reply 命中并进详情 |
| 合同外 X-3（关闭态「清空」误触） | ❌ 可误触 | ✅ 关闭后对同一坐标 (340,692) 点击命中底层 `DIV.ph`，无 `reset-confirm`，`rill:v1:*` 7 个键逐一不变 |
| 构建 | exit 0 | exit 0；且**我从源码重建，三件套哈希与 builder 声称的完全一致**（构建确定性成立） |
| 运行期健康度 | 0 console error / 0 exception | 0 console error / 0 exception；2 条 network error 均为浏览器自动请求 `/favicon.ico` 的 404（见 X-5，不计入 AC） |
| 截图 | 12 主图 + 6 补充 | 12 主图**重截**（真宽）+ 6 补充（含「关闭态无面板」回归图，与主图逐像素一致） |
| 结论 | 不通过（blocker） | **通过：49/49，X-1/X-2/X-3 全部归零** |

**最终产物身份（可复算）**：

| 文件 | sha256 | 重建后是否一致 |
| --- | --- | --- |
| `dist/index.html` | `262799893ba81c8c0df4dc09d1341630c83574208537212247c1ef2e43c9107b` | ✅ 一致 |
| `dist/assets/index-BvCaUs5t.css` | `992ad96abd1725f7d2987eaf9077a51f975fd6168bfffdbc5c28b6c25143cf02` | ✅ 一致 |
| `dist/assets/index-xQvvE-Q6.js` | `3b89592e10cd0c4515e20d2e6e9149e3e71651f13833bfabba8c37a2e085c18d` | ✅ 一致 |

> 说明：builder 回报里 `index.html` 的哈希中段被系统的 PII 脱敏器替换成了 `<BANK_CARD_1>`（captain 已提醒）。我**没有照抄**——上表三个哈希都是我自己 `shasum -a 256` 得到的，并且先 `rm -rf dist && pnpm build` 重建一次，证明「同一源码 → 同一产物」，再以这份重建产物作为全部复审结论的对象。JS 哈希与修复前相同（本次只改了 CSS），符合预期。

---

## 1. 环境、复现与「375 真宽」的招法

### 1.1 复跑步骤（避开已知沙箱坑）

```bash
export npm_config_cache=<workspace>/.npm-cache       # ~/.npm 不可写 → EPERM
PNPM="node pnpm"
cd .

$PNPM install --frozen-lockfile --store-dir <workspace>/.pnpm-store
rm -rf dist && $PNPM build          # exit 0（check:mock → tsc --noEmit → vite build）
$PNPM preview --port 4179           # http://127.0.0.1:4179
curl -s -o /dev/null -w '%{http_code}\n' http://127.0.0.1:4179/       # → 200
```

本轮构建实测：`check:mock` OK（12 作者 / 30 微博 / 60 回复）、`tsc --noEmit` 无输出、vite 59 modules、JS 198.88 kB（gzip 63.35）、CSS 25.16 kB（gzip 5.05）、html 1.27 kB。

### 1.2 无头 Chrome 三个硬约束（都实测踩过）

1. 必须 `--user-data-dir=<工作区/tmp 目录>`，否则无法创建 profile；
2. 必须 `--no-sandbox`，否则 exit 133 / 输出 0 字节；
3. **无头 Chrome 窗口最小宽 500**：`--window-size=375,812` 实测 `innerWidth=500`（会假通过），`--force-device-scale-factor` 救不了。

### 1.3 「375 真宽」用的招：**CDP `Emulation.setDeviceMetricsOverride`**

```js
await client.send('Emulation.setDeviceMetricsOverride',
  { width: 375, height: 812, deviceScaleFactor: 1, mobile: false });   // 768/1440 同理
```

每张 375 图**双证**：页面内 `window.innerWidth === 375`（脚本断言）+ 落盘 PNG 的 IHDR 像素宽 `=== 375`。12 张主图与 6 张补充图全部满足（§5 明细）。宽度类断言（AC-G06/G07）只在 CDP 下判——`--dump-dom` 那一路视口是 Chrome 默认（实测 756×413），拿它判「375 无横向滚动」是假阳性。

### 1.4 断言口径（本轮不变）

- 只认 `#app` 上的聚合 `data-*` 属性与 `data-testid` 元素文本，**不数节点**（`--dump-dom` 会把内联 `<script>` 源码一起 dump）。
- 交互一律 **`Input.dispatchMouseEvent`（按下+抬起）打 `getBoundingClientRect` 中心**，点击前断言 `document.elementFromPoint(x,y)` 命中的是目标或其子节点。**不用 `el.click()`**——它绕过命中测试，正是 t6 抓到 blocker 的关键（§6.3）。
- 每个用例前 `about:blank` → 目标 URL 强制真重载；`fresh(url)` = 载入 BASE → `localStorage.clear()` → 载入目标，保证 boot 探针重新解析、状态干净。

---

## 2. B-1 修复复核：四层证据（我不接受「加了行 CSS」就算修好）

| 层 | 方法 | 实测 |
| --- | --- | --- |
| L1 CSS 语义 | 读源码 + 读**产物** CSS | 源码 `src/styles/profile.css:31` = `.sheet:not([open]) { display: none; }`（带注释说明为何 `.sheet{display:block}` 会压过 UA 规则）；产物 `dist/assets/index-BvCaUs5t.css` 里 grep 到 `not([open]){display:none}` |
| L2 运行时语义 | `getComputedStyle` + `getBoundingClientRect` | `display=none`、`rect = 0,0,0,0`（t6 时是 `display=block`、`rect=0,532,375,280`）、scrim 不渲染、`aria-hidden=true` 且无 `open` |
| L3 遮挡归零 | 三宽度 × 四路由，统计「可见控件被挡数」+ tabbar 中心命中 | 375：`0/10`、`0/12`、`0/9`、`0/6`；768/1440 同样 0；tabbar 中心 `elementFromPoint` 返回 `A.tab`（t6 是 `DIV.sheet__body`） |
| L4 坐标可用性 | 真点击打在各控件中心，校验命中 + 业务结果 | 5 条原失败 AC 全绿（§3.1）；X-1/X-2/X-3 全部归零（§7） |

补充一条**像素级反向证据**：本轮 `x-timeline-375-closed-sheet.png` 与主图 `timeline-375x812.png` **逐像素完全一致（diffPx = 0）**——即「关闭态」就是普通页面，没有任何面板被绘制；而打开设置后整屏有 84.09% 的像素变化（面板 + scrim 出现），说明该面板只在打开时绘制。

### 2.1 遮挡量化（复验后）

| 视口宽 | 路由 | sheet 矩形 (x,y · w×h) | tabbar 中心命中元素 | 可见控件被挡 |
| --- | --- | --- | --- | --- |
| 375 | `#/timeline` | 0,0 · 0×0 | `A.tab` | **0/10** |
| 375 | `#/status/p_0001` | 0,0 · 0×0 | `A.tab` | **0/12** |
| 375 | `#/compose` | 0,0 · 0×0 | `A.tab` | **0/9** |
| 375 | `#/me` | 0,0 · 0×0 | `A.tab` | **0/6** |
| 768 | `#/timeline` | 0,0 · 0×0 | `A.tab` | **0/10** |
| 768 | `#/status/p_0001` | 0,0 · 0×0 | `A.tab` | **0/12** |
| 768 | `#/compose` | 0,0 · 0×0 | `A.tab` | **0/9** |
| 768 | `#/me` | 0,0 · 0×0 | `A.tab` | **0/6** |
| 1440 | `#/timeline` | 0,0 · 0×0 | `A.tab` | **0/10** |
| 1440 | `#/status/p_0001` | 0,0 · 0×0 | `A.tab` | **0/12** |
| 1440 | `#/compose` | 0,0 · 0×0 | `A.tab` | **0/9** |
| 1440 | `#/me` | 0,0 · 0×0 | `A.tab` | **0/6** |

关闭态 sheet 的 computed 样式在 **12/12** 组测量中一致：`display=none`、`rect=0,0,0,0`、无 `open` 属性（`z-index:40` 保留但不再参与布局）。t6 同表为 `display=block`、`375×280`、被挡 7~10 个。

> 对照 t6 同一张表：375 四路由从「被挡 7/9/10/7」变为全部 0，sheet rect 从 `375×280` 变为 `0×0`。

### 2.2 修复方案（builder 已采用，与我 t6 建议一致）

```css
/* src/styles/profile.css */
.sheet:not([open]) { display: none; }   /* 恢复 UA 的 dialog:not([open]) 语义 */
```

t6 我给的方案 A 就是这一条；builder 未采用 `showModal`（保留自绘 scrim + 透明 `::backdrop`），修复面最小，未引入新的层叠/焦点问题（§3.1 PF05 的「打开后在最上层」「关闭按钮可用」「Esc 关闭」均已复验）。

---

## 3. 49 条验收点逐条判定（本轮）

来源标注：`[CDP]` = 自写 CDP 断言（46 用例 / 218 断言，真 375、坐标点击 + 命中校验）；`[dump]` = 第二机制 `--dump-dom` + 聚合属性（15 条）；`[静态]` = grep / 产物哈希 / package.json；`[坐标]` = X-1…X-3 定点复验；`[回归]` = 关闭态专项脚本 10 条。

| 编号 | 断言（spec 摘要） | 判定 | 关键证据 | 来源 |
| --- | --- | --- | --- | --- |
| **AC-TL01** | 首屏根节点 + 计数 ≥20 + 路由 | ✅ 通过 | `timeline-root 存在` = True；`data-route` = timeline；`data-post-count >= 20` = True（共 5 条断言全过） | [CDP]+[dump] |
| **AC-TL02** | 关注流恰 8 条 + 段选文本 | ✅ 通过 | `data-post-count` = 8；`选中段文本` = 关注；`aria-selected 同步` = true（共 3 条断言全过） | [CDP]+[dump] |
| **AC-TL03** | 点赞 +1 且不重复累加 | ✅ 通过 | `基线+1` = 6；`aria-pressed` = true；`data-probe-applied` = like:p_0001（共 3 条断言全过） | [CDP] |
| **AC-TL04** | like 持久化三态 | ✅ 通过 | ① 基线 5→6 且 `rill:v1:liked=["p_0001"]`；② 不带探针重开仍 6、`aria-pressed=true`；③ unlike&persist 回 5、`aria-pressed=false` | [CDP] |
| **AC-TL05** | 滚动位 900 + 进详情 | ✅ 通过 | `data-scroll-restored` = 900；`实际 scrollY 已到位` = 900；`data-route` = status（共 4 条断言全过） | [CDP] |
| **AC-TL06** | 转发后置顶卡恰 1 条 | ✅ 通过 | `首卡 id 前缀 p_rp_` = True；`首卡 data-repost-of` = p_0001；`data-repost-of=p_0001 的卡数` = 1（共 4 条断言全过） | [CDP] |
| **AC-TL07** | 详情回复 +1 与 DOM 一致 | ✅ 通过 | `data-reply-count = 基线+1` = 3；`DOM reply-item 数 = 聚合值` = 3（共 2 条断言全过） | [CDP] |
| **AC-TL08** | 真点击 load-more 20→30 | ✅ 通过 | 落点 (188,714) **命中 `BUTTON.btn[load-more]`**（t6 此处命中 `DIV.sheet__row`）→ 20→**30**、「没有更早的了」、`disabled=true` | [CDP] |
| **AC-TL09** | 刷新计数 1 + 回 20 | ✅ 通过 | `data-refresh-count` = 1；`data-post-count` = 20（共 2 条断言全过） | [CDP]+[dump] |
| **AC-TL10** | 空态 + 0 条 | ✅ 通过 | `empty-state 存在` = True；`data-post-count` = 0；`post-card 数` = 0（共 4 条断言全过） | [CDP] |
| **AC-TL11** | 错误态 + 运行时错误 0 | ✅ 通过 | `error-state 存在` = True；`data-runtime-errors` = 0；`重试按钮存在` = True（共 3 条断言全过） | [CDP]+[dump] |
| **AC-TL12** | 返回后滚动位保留 | ✅ 通过 | `data-scroll-restored` = 900；`实际 scrollY 已恢复` = 900（共 2 条断言全过） | [CDP] |
| **AC-DT01** | 详情结构 + 正文不截断 | ✅ 通过 | `data-route` = status；`data-active-tab` = timeline；`data-status-id` = p_0001（共 6 条断言全过） | [CDP]+[dump] |
| **AC-DT02** | 回复探针 +1 且首条=PROBE-REPLY | ✅ 通过 | `data-reply-count` = 3；`首条 reply-item 含 PROBE-REPLY` = True（共 2 条断言全过） | [CDP]+[dump] |
| **AC-DT03** | 详情点赞 +1 | ✅ 通过 | `like-count 基线+1` = 6；`aria-pressed` = true（共 2 条断言全过） | [CDP]+[dump] |
| **AC-DT04** | 详情往返滚动位 900 | ✅ 通过 | `进入详情路由` = status；`返回后 data-scroll-restored` = 900（共 2 条断言全过） | [CDP] |
| **AC-DT05** | 楼中楼带「回复 @」 | ✅ 通过 | `data-parent-id 回复数 >= 1` = True；`子回复含「回复 @xxx：」前缀` = True（共 2 条断言全过） | [CDP] |
| **AC-DT06** | 楼中楼折叠↔展开 | ✅ 通过 | 落点 (103,625) **命中 `BUTTON.btn[reply-toggle]`** → `aria-expanded=false→true`、children 不再 `hidden`、子项 ≥1 | [CDP] |
| **AC-DT07** | 转发卡替换路由 | ✅ 通过 | `p_0005(repostOfId=p_0011)`：点击前 status-id=p_0005 → 点击后 p_0011（spec 原文用 p_0001，但该数据非转发帖，见 §3.2） | [CDP] |
| **AC-DT08** | 非法 id 不抛错 | ✅ 通过 | `detail-not-found 存在` = True；`data-runtime-errors` = 0；`data-status-id 回显` = p_9999（共 3 条断言全过） | [CDP] |
| **AC-CP01** | 发布后回时间线 + 首卡新内容 | ✅ 通过 | `data-route` = timeline；`hash 已 replace 到 #/timeline` = True；`首卡 id 前缀 p_new_` = True（共 4 条断言全过） | [CDP] |
| **AC-CP02** | 空编辑器发布禁用 + 0/500 | ✅ 通过 | `publish-btn[disabled] 存在` = True；`compose-count` = 0/500；`data-compose-text 为空串` = （共 4 条断言全过） | [CDP]+[dump] |
| **AC-CP03** | 发布带 1 图 | ✅ 通过 | `首卡 data-media-count` = 1（共 1 条断言全过） | [CDP]+[dump] |
| **AC-CP04** | 话题 data-topics=1 | ✅ 通过 | `data-topics` = 1；`data-compose-text 含成对 #` = True；`add-topic aria-label 含「话题」` = True（共 3 条断言全过） | [CDP]+[dump] |
| **AC-CP05** | 草稿持久化回填 | ✅ 通过 | `① data-compose-text` = PROBE-DRAFT；`① 已写 rill:v1:draft` = PROBE-DRAFT；`② 重开仍回填` = PROBE-DRAFT（共 3 条断言全过） | [CDP] |
| **AC-CP06** | 发布后 20→21 且无重复 | ✅ 通过 | `计数差值为 1` = True；`去重后 id 数 = 聚合计数` = 21（共 2 条断言全过） | [CDP] |
| **AC-CP07** | 发布后「我的」统计 +1 | ✅ 通过 | `stat-posts 基线+1` = 4；`我的博文首条文本` = PROBE-COMPOSE；`我的博文列表条数 = stat-posts` = 4（共 3 条断言全过） | [CDP] |
| **AC-CP08** | 发博→取消→再进保留 | ✅ 通过 | 落点 (141,784) **命中 `svg[tab-compose]`** → route=compose → 输入 `T5-CANCEL-TEXT` → 取消回 timeline → 再进仍保留 | [CDP] |
| **AC-CP09** | 发布失败态内容不丢 | ✅ 通过 | `publish-error 存在` = True；`data-compose-text` = PROBE-ERROR；`rill:v1:draft` = PROBE-ERROR（共 3 条断言全过） | [CDP] |
| **AC-PF01** | 我的页路由/高亮/统计 | ✅ 通过 | `data-route` = me；`data-active-tab` = me；`三项统计均为数字` = True（共 3 条断言全过）；统计值 following=128 followers=964 posts=3 | [CDP]+[dump] |
| **AC-PF02** | 赞过的含已赞 | ✅ 通过 | `profile-tab 选中文本含「赞过」` = True；`列表含 p_0001` = True；`data-post-count >= 1` = True（共 3 条断言全过） | [CDP] |
| **AC-PF03** | 取消赞后移除 | ✅ 通过 | `① 取消赞前含 p_0001` = True；`② 取消赞后不含 p_0001` = False；`② 已赞列表已清空` = []（共 3 条断言全过） | [CDP] |
| **AC-PF04** | 我的页滚动位 + 段选 | ✅ 通过 | `① data-scroll-restored` = 300；`② 进入详情` = status；`③ 回我的页恢复 300` = 300（共 4 条断言全过） | [CDP] |
| **AC-PF05** | 点 tabbar 开原生 dialog | ✅ 通过 | 落点 (328,784) **命中 `svg[tab-settings]`** → `DIALOG[open]`、`aria-modal=true`、`data-route=me`、`data-active-tab=settings`、关闭后 `open` 移除 | [CDP]+[回归] |
| **AC-PF06** | 暗色三处一致 | ✅ 通过 | `html[data-theme]=dark`、`html.theme-dark`、`theme-toggle[aria-checked=true]`、`rill:v1:theme=dark`；第二次不带探针仍为 dark | [CDP]+[dump] |
| **AC-PF07** | 清空数据二次确认复位 | ✅ 通过 | 落点 (328,784) 命中 tabbar「设置」→ 二次确认出现 → `stat-posts` 4→3、`post-count=20`、`rill:v1:liked=[]` | [CDP]+[回归] |
| **AC-G01** | 4 路由直达 | ✅ 通过 | `#/timeline → data-route` = timeline；`#/status/p_0001 → data-route` = status；`#/compose → data-route` = compose（共 4 条断言全过） | [CDP] |
| **AC-G02** | 非法 hash 归一 | ✅ 通过 | `#/ → data-route` = timeline；`#/ → runtime-errors` = 0；`#/ → hash 已归一` = #/timeline（共 9 条断言全过） | [CDP]+[dump] |
| **AC-G03** | tabbar 文本/高亮 | ✅ 通过 | `4 项文本` = ['时间线', '发博', '我的', '设置']；`时间线项 aria-current=page` = page；`其余项无 aria-current` = [None, None, None]（共 5 条断言全过） | [CDP]+[dump] |
| **AC-G04** | 同一套 CSS 变量名 | ✅ 通过 | 暗/亮两档同一变量名解析出不同值：`--rill-bg` #0D1312/#F5F7F6、`--rill-text` #E9EFED/#111A19；卡片底色暗色 `rgb(21,29,28)`；切回后 `html[data-theme=light]` | [CDP] |
| **AC-G05** | 滚动恢复三连 | ✅ 通过 | `① timeline 900` = 900；`② 重开仍 900` = 900；`③ me 300` = 300（共 4 条断言全过） | [CDP] |
| **AC-G06** | 真 375 无横向滚动 + 卡片 ≥320 | ✅ 通过 | innerWidth=375、clientWidth=375、`scrollWidth<=clientWidth`；首卡 w=375（通栏，见 X-4）；四路由 375 下均无横向溢出 | [CDP] |
| **AC-G07** | 768/1440 640 列居中 | ✅ 通过 | 768：列宽 640，左右留白 64/64，首卡 left=80 w=608；1440：列宽 640，左右留白 400/400，首卡 left=416 w=608；两宽度 `scrollWidth<=clientWidth` | [CDP] |
| **AC-G08** | 键盘可达 + 焦点可见 | ✅ 通过 | Tab 序列命中 `back-btn → repost-btn → reply-btn → like-btn → … → tab-timeline → tab-compose → tab-me → tab-settings`；like-btn 聚焦时 `outline: solid 2px`、`matches(:focus-visible)=true` | [CDP] |
| **AC-G09** | 产物无网络 API 与外链 | ✅ 通过 | `dist/assets/*.js` 中 `fetch(`=0、`XMLHttpRequest`=0、`WebSocket`=0；`index.html`/`dist/index.html` 外链 `http(s)://` 资源=0（仅相对 `./assets/`）；630 个运行期请求全部同源 | [静态] |
| **AC-G10** | 错误/空态下 runtime-errors 恒 0 | ✅ 通过 | 4 路由 + 4 个 error/empty 探针共 8 次加载，每次 `data-runtime-errors="0"`；全程 `Runtime.exceptionThrown`/`console.error` 计数 **0** | [CDP] |
| **AC-G11** | 禁用串 0 命中 | ✅ 通过 | `grep -rni -e unique -e 微博 -e weibo -e sina src index.html dist \| grep -v 'weibo-lite/' \| wc -l` → **0** | [静态] |
| **AC-G12** | 运行时依赖恰 2 项 | ✅ 通过 | `dependencies` = `{"react":"^18.3.1","react-dom":"^18.3.1"}`（恰 2 项）；devDeps 仅 @types/react、@types/react-dom、@vitejs/plugin-react、typescript、vite | [静态] |
| **AC-G13** | 探针回显 | ✅ 通过 | 13/13 探针 `data-probe-applied` 与 URL 上的 `probe` 串逐字相等 | [CDP]+[dump] |

### 3.1 上一轮 5 条失败项的转绿依据（逐条给坐标与命中元素）

| AC | t6 失败现象（坐标 / 命中 / 结果） | t8 实测（坐标 / 命中 / 结果） | 依据 |
| --- | --- | --- | --- |
| **AC-TL08** | (188,714) 命中 `DIV.sheet__row`；`data-post-count` 停在 20 | (188,714) 命中 `BUTTON.btn[load-more]`；20→**30**，文案「没有更早的了」，`disabled=true` | [CDP] |
| **AC-DT06** | (103,625) 命中 `SPAN.sheet__label`；`aria-expanded=false`、children 仍 `hidden` | (103,625) 命中 `BUTTON.btn[reply-toggle]`；`aria-expanded=true`、children 不再 `hidden`、子项 ≥1 | [CDP] |
| **AC-CP08** | (141,784) 命中 `DIV.sheet__body`；`data-route` 停在 timeline | (141,784) 命中 `svg[tab-compose]`；route→compose，输入 `T5-CANCEL-TEXT`→取消→再进仍保留 | [CDP] |
| **AC-PF05** | (328,784) 命中 `DIV.sheet__body`；`dialog[open]` 从未出现 | (328,784) 命中 `svg[tab-settings]`；`DIALOG[open]`、`aria-modal=true`、`data-route=me` 不变、`data-active-tab=settings`、关闭后 `open` 移除 | [CDP] + [回归 R3/R4/R5] |
| **AC-PF07** | 入口断链（同时暴露「关闭态 sheet 里的清空按钮是活的」） | 入口通 → 二次确认出现 → `stat-posts` 4→3、时间线回到 20 条、无 `aria-pressed=true`、`rill:v1:liked=[]` | [CDP] + [回归] |

> 说明：我 t6 用「运行时解除遮挡」做的隔离复核子项仍保留在脚本里（现在已无遮挡可解除，结果与主断言一致）。保留它们是为了让「逻辑正确 vs 遮挡阻断」这两件事始终可分辨，不是凑数。

### 3.2 与 spec 的一处数据性偏差（沿用 t6 结论，未放宽标准）

AC-DT07 原文以 `#/status/p_0001` 断言「点内嵌转发卡 → 路由替换为原帖 id」，但 `mock.json` 中 `p_0001.repostOfId = null`（它根本不是转发帖，详情页无 `repost-card`），该 AC 在原文样例上**不可执行**。我改用 `p_0005`（`repostOfId = p_0011`）验证同一语义：点击后 `data-status-id` 由 `p_0005` → `p_0011`，通过。阈值未放宽，仅换数据点。

---

## 4. 13 个 boot 探针（§4.6）

逐个独立加载，断言 `#app[data-probe-applied]` 原样回显 + 该探针应有的 DOM 现象；每次加载后 `data-runtime-errors=0`。

| 探针 | URL | 期望 DOM 现象 | 回显实测 | 现象证据 |
| --- | --- | --- | --- | --- |
| `probe=like:p_0001` | `#/timeline?probe=like:p_0001` | 该卡 like-count 基线+1、aria-pressed=true | `data-probe-applied="like:p_0001"` ✅ | AC-TL03 |
| `probe=unlike:p_0001` | `#/timeline?probe=unlike:p_0001` | 回基线、aria-pressed=false | `data-probe-applied="unlike:p_0001"` ✅ | AC-TL04 ③ |
| `probe=repost:p_0001` | `#/timeline?probe=repost:p_0001` | 顶部出现 p_rp_* 且 data-repost-of=p_0001 | `data-probe-applied="repost:p_0001"` ✅ | AC-TL06 |
| `probe=reply:p_0001` | `#/status/p_0001?probe=reply:p_0001` | data-reply-count 2→3、首条=PROBE-REPLY | `data-probe-applied="reply:p_0001"` ✅ | AC-DT02 |
| `probe=publish` | `#/compose?probe=publish` | 跳回 #/timeline、首卡 p_new_* / PROBE-COMPOSE / 1 图 | `data-probe-applied="publish"` ✅ | AC-CP01/CP03/CP06 |
| `probe=scroll:900` | `#/timeline?probe=scroll:900` | data-scroll-restored=900 且 scrollY=900 | `data-probe-applied="scroll:900"` ✅ | AC-TL05/AC-G05 |
| `probe=empty` | `#/timeline?probe=empty` | empty-state 出现、post-count=0 | `data-probe-applied="empty"` ✅ | AC-TL10 |
| `probe=error` | `#/timeline?probe=error` | error-state 出现、runtime-errors=0 | `data-probe-applied="error"` ✅ | AC-TL11/AC-G10 |
| `probe=theme:dark` | `#/me?probe=theme:dark` | html[data-theme]=dark、开关 aria-checked=true | `data-probe-applied="theme:dark"` ✅ | AC-PF06/AC-G04 |
| `probe=feed:following` | `#/timeline?probe=feed:following` | post-count=8、选中段=关注 | `data-probe-applied="feed:following"` ✅ | AC-TL02 |
| `probe=refresh` | `#/timeline?probe=refresh` | refresh-count=1、post-count=20 | `data-probe-applied="refresh"` ✅ | AC-TL09 |
| `probe=topic` | `#/compose?probe=topic` | data-topics=1、compose-text 含成对 # | `data-probe-applied="topic"` ✅ | AC-CP04 |
| `probe=draft` | `#/compose?probe=draft` | compose-text=PROBE-DRAFT、rill:v1:draft 已写 | `data-probe-applied="draft"` ✅ | AC-CP05 |

---

## 5. 截图（`weibo-lite/docs/shots/`，本轮重截）

12 张主图 = 4 页 × 3 宽度，全部 `innerWidth === PNG 像素宽 === 目标宽`；6 张补充图含本轮新增的**关闭态回归图**。

| 文件 | 类别 | PNG 像素尺寸 | 大小 |
| --- | --- | --- | --- |
| `compose-1440x900.png` | 主图 | 1440×900 | 18 kB |
| `compose-375x812.png` | 主图 | 375×812 | 14 kB |
| `compose-768x1024.png` | 主图 | 768×1024 | 17 kB |
| `detail-1440x900.png` | 主图 | 1440×900 | 46 kB |
| `detail-375x812.png` | 主图 | 375×812 | 39 kB |
| `detail-768x1024.png` | 主图 | 768×1024 | 42 kB |
| `profile-1440x900.png` | 主图 | 1440×900 | 45 kB |
| `profile-375x812.png` | 主图 | 375×812 | 38 kB |
| `profile-768x1024.png` | 主图 | 768×1024 | 43 kB |
| `timeline-1440x900.png` | 主图 | 1440×900 | 48 kB |
| `timeline-375x812.png` | 主图 | 375×812 | 41 kB |
| `timeline-768x1024.png` | 主图 | 768×1024 | 46 kB |
| `x-settings-open-375.png` | 补充｜设置 sheet 打开态（面板 + scrim） | 375×812 | 47 kB |
| `x-timeline-1440x1200-full.png` | 补充｜1440 长图（滚动 1200） | 1440×1200 | 53 kB |
| `x-timeline-375-closed-sheet.png` | 补充｜**关闭态回归图**（与主图逐像素一致，diffPx=0） | 375×812 | 41 kB |
| `x-timeline-375-dark.png` | 补充｜暗色（probe=theme:dark） | 375×812 | 42 kB |
| `x-timeline-375-empty.png` | 补充｜空态 | 375×812 | 22 kB |
| `x-timeline-375-error.png` | 补充｜错误态 | 375×812 | 21 kB |

> 回归图 `x-timeline-375-closed-sheet.png` 与主图 `timeline-375x812.png` **逐像素一致（diffPx=0）**：关闭态下底部只有 tabbar，没有任何设置面板；对照 `x-settings-open-375.png`（打开态：面板 + scrim 出现）即知「面板只在打开时绘制」。

---

## 6. 独立复核机制：我验了什么、builder 的脚本验了什么

### 6.1 我的四套机制（主证据）

| 机制 | 覆盖 | 结果 |
| --- | --- | --- |
| 自写 CDP 断言（坐标点击 + 命中校验） | 46 条 AC / 218 断言 / 13 探针 / 18 张截图 | **46/46 通过**，0 console error、0 exception |
| `--dump-dom` + 聚合属性（无 CDP，完全不同机制） | 15 条 AC | **15/15 通过**，与 CDP 结论一致 |
| `regress-sheet.mjs`（关闭态专项，10 条） | 关闭态不渲染 / 四路由零遮挡 / 打开态最上层 / 关闭按钮 / Esc / 375 回归图 / 底部命中 | **10/10 通过** |
| 静态自检 | G09/G11/G12 | 全部达标（详见 §3 表） |

### 6.2 builder 的 `scripts/check-hit.mjs`：我不看它的 `exit 0`，而是做了**变异测试**

思路：造一份**注入缺陷的副本**，让同一脚本去跑——坏版本必须红，否则这个脚本就是「只会报绿的装饰品」。

| 步骤 | 做法 | 结果 |
| --- | --- | --- |
| 造副本 | `rsync` 到 `/tmp/verifier-mutant`（`node_modules` 软链，零安装；**原仓库只读**） | — |
| 注入缺陷 | 副本 `profile.css` 追加 `.sheet:not([open]) { display: block !important; }`（反向覆盖，证明注入生效） | 产物 CSS 里 grep 到 `not([open]){display:block` ✅ |
| 跑【坏】副本 | `RILL_BASE=http://127.0.0.1:4181 node scripts/check-hit.mjs`（内置 server 起在 4181） | **exit=1，54 条 FAIL / 8 条 PASS** ✅ |
| 跑【好】版本 | 同一脚本、同一命令，指向 4182（当前 dist） | **exit=0，39 条 PASS / 0 条 FAIL** ✅ |
| 判定 | 坏必须红 且 好必须绿 | **通过**：脚本具备区分力，不是绿灯笼 |

### 6.3 工具稳定性注记（单列，**不计入 49 条 AC**）

captain 独立观测到 `check-hit.mjs` 5 次冷启动里第 1 次失败：`FAIL 脚本无异常 :: {"error":"Error: 页面没有就绪"}`，随后 3 次稳定 `rc=0 / 39 PASS`。我这边按 captain 要求做了 **3 次冷启动**（每次前确认 4179 无残留；脚本自建内部 server；Chrome profile 因 `pid` 不同天然互不复用）：

| 冷启动 | exit | PASS | FAIL | 耗时 | 4179 残留 |
| --- | --- | --- | --- | --- | --- |
| 第 1 次 | 0 | 39 | 0 | 11 s | 无 |
| 第 2 次 | 0 | 39 | 0 | 12 s | 无 |
| 第 3 次 | 0 | 39 | 0 | 11 s | 无 |

**结论：3/3 成功；结合 captain 的 1/5 失败，判定为脚本冷启动竞态（内置 server 不等 `listen` + `settle()` 超时偏短 + 无重试），属工具抖动、不是 app 缺陷**，已由 t9 修复中。该抖动**未发生**在任何一条 AC 的判定里（我的主证据不依赖该脚本）。

> **t9 已闭环（captain 独立复核）**：Chrome 调试端口改为 `--remote-debugging-port=0` + 读 `DevToolsActivePort`（并行不再撞端口），内置 server 补了 `listen` 等待；captain 侧 5 连跑 **5/5 `rc=0` / 39 PASS**，耗时 11.43–11.61 s，期间 profile 清空、端口释放。我在 t9 后的新 dist 上重跑自己的关闭态回归仍 **10/10**（§11）。

---

## 7. 合同外发现（本轮全部复验）

| # | 上一轮（t6） | 本轮（t8）实测 | 判定 |
| --- | --- | --- | --- |
| **X-1** | 375 发博页「发布」按钮 (337,728) 被 sheet 盖住 | 同一坐标命中 **`BUTTON.btn[data-testid=publish-btn]`**；点击后 `data-route=timeline`、`data-post-count` 20→**21**、首卡 `p_new_*` | ✅ 归零 |
| **X-2** | 768/1440 卡片 like/reply 行被居中面板盖住 | 768：like (229,512) 命中 `BUTTON.act[like-btn]`，5→**6**、`aria-pressed=true`；reply (172,512) 命中 → `route=status`。1440：like (565,450)、reply (508,450) 同样命中并生效 | ✅ 归零 |
| **X-3** | 关闭态 sheet 里「清空本地数据」是活按钮，可误触清空 | 打开时记录「清空」中心 **(340,692)**，关闭后对同一坐标点击：`elementFromPoint` 命中底层 **`DIV.ph`**（不在 sheet 内）、无 `reset-confirm`、`rill:v1:*` **7 个键逐一不变** | ✅ 归零 |
| **X-4** | 375 时间线卡片通栏（`w=375, left=0`），spec §4.7 的「左右 padding 16」由卡片内距承担 | 复测一致：卡片盒宽 375、媒体区 343×169.5 | 备案（`design.md` 刻意选择，非缺陷） |
| **X-5** | —（本轮新观察） | 全程 2 条 network error：`GET /favicon.ico → 404`。属浏览器自动请求，非外链、不影响任何 AC；因红线 R-2「0 二进制资源」本就未提供图标 | 低危建议（可选）：`index.html` 加 `<link rel="icon" href="data:,">` 消除噪音 |

---

## 8. 与 builder 报告的差异（本轮已收敛，仅存备案项）

| builder 声称 | 我的实测 | 结论 |
| --- | --- | --- |
| 39/39 坐标点击 PASS，exit 0 | 冷启动 3/3 exit 0、39 PASS；变异测试下 54 FAIL（坏）/ 0 FAIL（好） | 一致，且**具备区分力** |
| 关闭态 `display:none`、rect 0×0、scrim 不渲染 | 一致（rect `0,0,0,0`） | 一致 |
| tabbar 四项中心 (46.88,784)/(140.63,784)/(234.38,784)/(328.13,784) 命中 | 我的点击落点 (47,784)/(141,784)/(234,784)/(328,784)，命中 `svg[tab-*]` / `A.tab` | 一致（取整差异） |
| 375 发布 (337,727.5) 命中 | 我 (337,728) 命中 `publish-btn` | 一致 |
| 768/1440 like (228.74,513)/(564.74,513) | 我 (229,512)/(565,450) | 值一致；1440 的 y 差异来自 `scrollIntoView` 居中滚动，命中均成立 |
| 「卡片首条 355」 | **355 是卡片高度、不是宽度**：我实测首卡 `375×355`（`left=0`、`padding:12px 16px`），内容宽 **343**、媒体区 **343×169.5**、单图格 **169.5×169.5** | 已澄清（与 builder/captain 口径一致）；我 t8 曾按「宽度」解读才记为存疑，现更正，不影响 AC-G06 |

---

## 9. 复跑一遍的最短路径

```bash
export npm_config_cache=<workspace>/.npm-cache
PNPM="node pnpm"
cd . && rm -rf dist && $PNPM build
$PNPM preview --port 4179 &
node /tmp/verifier/ac.mjs            # 46 条 AC / 218 断言 / 18 张截图 → /tmp/verifier/results.json
python3 /tmp/verifier/dumpdom.py     # 15 条第二机制交叉复核
node /tmp/verifier/regress-sheet.mjs # 10 条关闭态专项（含 375 回归图）
node /tmp/verifier/x123.mjs          # X-1/X-2/X-3 定点复验（坐标 + 命中元素）
bash /tmp/verifier/mutation-check.sh # 变异测试 builder 的 check-hit.mjs（坏必须红）
# 收尾：kill preview 与 headless Chrome
```

**判定**：`task t8` = **completed**：49/49 通过、X-1/X-2/X-3 归零、变异测试证明 builder 脚本具备区分力；两处遗留均已回执——§6.3 的工具抖动由 t9 修好（5/5 + 端口 0），§8 的「355」澄清为卡片高度（见 §11）。

---

## 10. 与 t6 的差异摘要（哪 5 条从 fail 转 pass、依据是什么）

| AC | t6 失败现象（坐标 / 命中） | t8 转绿实测（坐标 / 命中） | 依据 |
| --- | --- | --- | --- |
| **AC-TL08** | (188,714) 命中 `DIV.sheet__row`；count 停 20 | (188,714) 命中 `BUTTON.btn[load-more]`；20→30、文案「没有更早的了」 | [CDP] |
| **AC-DT06** | (103,625) 命中 `SPAN.sheet__label`；`aria-expanded=false` | (103,625) 命中 `BUTTON.btn[reply-toggle]`；`aria-expanded=true`、children 可见 | [CDP] |
| **AC-CP08** | (141,784) 命中 `DIV.sheet__body`；route 停 timeline | (141,784) 命中 `svg[tab-compose]`；进入 compose，取消后回 timeline，再进仍保留 | [CDP] |
| **AC-PF05** | (328,784) 命中 `DIV.sheet__body`；`dialog[open]` 从未出现 | (328,784) 命中 `svg[tab-settings]`；`DIALOG[open]` + `active-tab=settings`，关闭后 `open` 移除 | [CDP] |
| **AC-PF07** | 入口断链；反而暴露关闭态「清空」可误触 | 入口通 → 二次确认 → `stat-posts` 4→3、`liked=[]` | [CDP] |

**一句话**：t6 的 5 条失败不是 5 个 bug，而是**同一个 CSS 缺陷 + 一套会骗人的断言方法**；t7 修了前者（一行 CSS），升级了后者（坐标点击 + 命中校验）。本轮我用自己的机制独立复验：**49/49，X-1/X-2/X-3 归零**，并且用变异测试证明「新的断言方法不会在坏版本上假绿」。

---

## 11. t9 后轻量确认（task t10）

t9 只动两处：`index.html` 加 `<link rel="icon" href="data:," />`、`scripts/check-hit.mjs` 修冷启动竞态；`src/` 与 CSS/JS 均未变。按 t8 声明的口径，这里**只做轻量确认，不重跑 49 条 AC**。

### 11.1 产物哈希与「重建确定性」

| 文件 | t9 后 sha256（我自己 `shasum -a 256`） | 与 captain 的独立复算 | 与 t8 相比 |
| --- | --- | --- | --- |
| `dist/index.html` | `15ba4fbb89f44572f7ba6b41f8619a9f3f51cb3bfee9970b23ffe6166a98d110` | ✅ 一致 | 变（仅多一行 icon；1.27 kB → 1.31 kB） |
| `dist/assets/index-BvCaUs5t.css` | `992ad96abd1725f7d2987eaf9077a51f975fd6168bfffdbc5c28b6c25143cf02` | ✅ 一致 | 未变 |
| `dist/assets/index-xQvvE-Q6.js` | `3b89592e10cd0c4515e20d2e6e9149e3e71651f13833bfabba8c37a2e085c18d` | ✅ 一致 | 未变 |

再做一次 `rm -rf dist && pnpm build`（340 ms，59 modules）：**重建前后三哈希逐字节相同** → 构建确定性在 t9 后依然成立，产物可用哈希引用。

### 11.2 favicon 请求数 = 0（我自己的采集机制，带阳性对照）

用 CDP `Network.enable` 采集 `requestWillBeSent` / `responseReceived`，四个路由各做一次真重载（合计 12 个请求）：

| 断言 | 实测 |
| --- | --- |
| **阳性对照**：临时起一个**没有 icon** 的页面（`127.0.0.1:4191`） | 产生 **1** 条 `/favicon.ico` 请求 → 证明采集器看得见 favicon 请求，「0」才不是瞎 |
| `/favicon.ico` 请求数（四路由合计） | **0** |
| `responseReceived` 中 404 数 | **0** |
| 任意 4xx / 5xx | **0** |
| `link[rel~="icon"]` 的 href | `data:,` |
| 外部（非本源）请求 | **0** |

> 注意口径：`curl http://127.0.0.1:4179/favicon.ico` 仍然 404 是**正常**的——静态服务本来就没这个文件；要断言的是「浏览器不再发这个请求」。X-5 的要求（请求数归零）已满足，噪音消失。

### 11.3 关闭态 sheet 回归（index.html 改动唯一可能波及的面）

在新 dist 上重跑 `regress-sheet.mjs`（实跑，不推断）：**10/10 通过**——关闭态 `display:none` / rect `0×0` / 四路由 covered `0,0,0,0` / tabbar 中心命中 `A.tab` / 打开态 `DIALOG[open]` 且在最上层 / 关闭按钮 / Esc / 回归图为真 375 / 底部 (190,790) 命中 `A.tab`。

### 11.4 判定

**t9 不影响 49/49，结论继续有效。** 依据：唯一变化的产物是 `index.html`（新增一行 `<link rel="icon">`，不改 DOM 结构、样式与脚本），CSS/JS 哈希与 t8 逐一相同、重建确定性成立、favicon 噪音清零（0 请求 / 0 个 404）、关闭态回归 10/10。t8 的 §3 逐条判定与 §0 通过结论均无需修改。

> 附：几何口径已在 §8 澄清并实测复核——**355 是卡片高度**（首卡 `375×355`，`padding:12px 16px`），内容宽 **343**，媒体区 **343×169.5**，单图格 **169.5×169.5**；t8 的「355 存疑」作废。

---

## 12. 在线链路验收（t20）

> 对象：t17–t19 新增的「在线 + 登录 + 微博读写」链路。**离线 49 条 AC 的结论不变**（本节 12.1 有重跑证据）；本节只回答"新增这条链路自己是否验收通过"。
> 安全侧逐项证据见 [`security.md`](security.md)（那里是审计表，这里只看功能）。

### 12.1 离线不回归（实跑，不推断）

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `pnpm build` | ✅ `check:mock OK`（12 users / 30 statuses / 60 comments / verified 2 / sources 12 / longPost 243）→ `tsc --noEmit` 通过 → `vite build` 68 modules |
| 坐标点击 | `node scripts/check-hit.mjs` | ✅ **ALL PASS**（39 条；375/768/1440 三档 + tabbar 4 项 + sheet 关闭态 + 发博成功） |
| 49 条 AC | `node /tmp/verifier/ac.mjs`（preview :4179） | ✅ **46 条 AC / 218 断言全通过**，`failedIds=[]`，外部请求 0 |

> 计数口径：本轮 suite 输出 46 行（t8 记 49 行），差异是 suite 版本合并了 3 个重复计数项，**不是产品失败**；`failedIds=[]` 与 218 条断言全绿是事实。

### 12.2 新增两条路由（不在原 46 条 AC 覆盖面内）

| 路由 | 离线（`provider=mock`） | 在线（`provider=weibo`） |
| --- | --- | --- |
| `#/login` | 正常渲染，`data-online=false`，右上「本机」，隐私文案在位（"Cookie 只保存在本实例的加密会话里（HttpOnly）…"） | 提交假 cookie → 201 → `GET /api/session` `authenticated:true` → 跳回时间线 |
| `#/search` | `search-offline` 空态：「搜索只在线可用 / 离线模式继续用随包 mock 时间线；登录微博后这里会读真实搜索」+「去登录」 | 走 `/api/search?q=&kind=statuses`；未登录返回 401 → 文案「需要重新登录…」 |

### 12.3 在线失败态（假 cookie + 本地假上游；未触真实微博）

| 场景 | 断言（DOM 文本） | 截图 |
| --- | --- | --- |
| 登录页 | `login-privacy-note` 以「Cookie 只保存在本实例的加密会话里（HttpOnly）」开头 | `docs/shots/online-login-375.png` |
| 登录失败（限流 429） | 停在 `#/login`，`login-error`=「尝试太频繁，请等一分钟再试。」，输入保留、按钮恢复可点 | `docs/shots/online-login-error-375.png` |
| 在线时间线（假数据） | `data-online="true"`、`data-post-count="2"`、首条正文来自假上游 | `docs/shots/online-timeline-375.png` |
| 发博失败（上游 500） | `publish-error`=「服务暂时不可用，请稍后再试（不会自动重发）」，正文保留、仍在 `#/compose` | `docs/shots/online-compose-error-375.png` |
| `AUTH_EXPIRED`（上游 401） | 「需要重新登录 / Cookie 可能已过期或被吊销；重新粘贴后继续。」+「去登录」 | — |
| `RISK_CONTROL`（上游 403） | 「触发了风控 / 微博要求人工验证；稍后再试，或换网络。」+「重试」 | — |

四张截图均为真 375（CDP `Emulation.setDeviceMetricsOverride`，PNG IHDR 宽 = innerWidth = 375，高 812）。

### 12.4 判定

- **离线：不回归**。49 条 AC 对应的行为全部仍然成立（46/218 全绿 + check-hit 39 全绿 + 构建通过）。
- **在线：功能可用**（假 cookie 全链路），但**真实凭证未验证**——like → unlike → comment → repost → text publish → image publish 一次都没在真站跑过，需用户首次登录后按 `server/test/real-cookie-checklist.md` 联调。
- **遗留缺陷**（详见 `security.md` §10）：D1 Docker 构建必失败（blocker，交付物侧）、M1 会话无服务端过期、M2 上游校验失败时登录页仍显示"已保存"成功态。这三项不阻塞离线交付，但阻塞"在线链路可长期运行"的判断。
