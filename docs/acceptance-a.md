# A「日报」终局验收（t30，冻结提交 `f410745`）

**回归全绿 ≠ 新设计成立。** 本报告仍分两块，标题各自写明性质：块一（回归）回答「有没有把原来能用的东西搞坏」，块二（设计验收补充）回答「A 是不是真的落在**已提交的树**里」。两块独立判定。

**t24 判 failed 的两条硬阻塞，本轮逐条复查并关闭**（见 §6、§4）：验收对象从「未提交的工作树」换成了提交 `f410745f20851fa59c40373ee5d90c8f4b84713c`；变异反证从「check-hit 对 clamp 恒真」变成了「改错就 FAIL、恢复就 PASS」。

| 项 | 结果 |
| --- | --- |
| 判定 | **通过（completed）** |
| 验收对象 | 提交 `f410745`，工作树 `git status` 干净，`git ls-files src`=45 = `find src`=45 |
| 块一（回归） | 49/49 通过（46 条套件行 218 断言 + 补测 G09/G11/G12 按 t30 新口径）；双主题 × 双模式全绿 |
| 块二（设计补充） | S1/S2/S3/S5/S6/S7/S8 成立；**S4 成立但带偏差 O1（V 与昵称间距 6px ≠ final-spec 3px，未修复，如实留档）** |
| 变异反证 | **成立**：CSS `line-clamp` 改 2 → `check-hit` **FAIL（38/2）**；TS clamp 6→5 → **FAIL（38/2）**；恢复 → **39/0 ALL PASS** |
| 假绿修复 | **已修并反证**：禁用串命令注入违规样本 → 1，撤销 → 0（三组样本） |
| 偏差/观察 | O1（V 间距 6px）、O2（详情页 RISK_CONTROL 用通用文案）、O3（spec/capability-map 旧命令未同步）——都不阻塞，已入 §9 |
| **t32 更新** | **O1 已修（间距实测 3.00px）、O2 已修（三页同文案）、O3 已由 t31 同步**；AC-VF01 由“带偏差”翻为**通过**，旧结论仍保留在 §3/§9，翻牌证据见 **§11 更新记录** |

---

## 1. 被验对象

| 项 | 值 |
| --- | --- |
| 提交 | `f410745f20851fa59c40373ee5d90c8f4b84713c`（`fix(ci): 收口在线前端入库、折叠守门与索引态护栏`） |
| 工作树 | `git status --short` 为空（本报告只改 `docs/`，源码提交在 t29 完成） |
| `src/` 索引 vs 磁盘 | `git ls-files src` = **45**，`find src -type f` = **45**，差值 0 |
| 构建产物 | `dist/assets/index-DYfQkNEH.js`（238.43 kB，sha256 前缀 `8b79d4896e199cef`）、`index-DZFlHw8W.css`（45.53 kB，前缀 `cc011340bd39fe77`），构建 in 578ms |
| 构造确定性 | 与本机 16:52 那版 dist **逐字节同哈希** ⇒ 同一份源码可复现出同一产物 |
| CI | run **43836710321**（push，attempt 1，`head_sha=f410745…`，`conclusion=success`），两个 job 均 success |

---

## 2. 块一（回归）：49 条 AC 逐条重跑 + 双主题 × 双模式

### 2.1 构建门禁

| 命令 | rc | 结果 |
| --- | --- | --- |
| `pnpm run check:mock` | 0 | `OK {"users":12,"statuses":30,"comments":60,"mediaDist":{"0":8,"1":5,"2":3,"3":2,"4":5,"9":7},"repost":4,"topics":6,"nested":12,"postsWithReplies":29,"verified":2,"sources":12,"longPost":243}` |
| `pnpm exec tsc --noEmit` | 0 | 零错误 |
| `pnpm run build` | 0 | js/css 见 §1 |
| `node scripts/check-hit.mjs`（绑定冻结构建） | 0 | **PASS 39 / FAIL 0 / ALL PASS**；其中 4 条折叠基线：`p_0007 折叠态为 6 行`（clamped=6、clientHeight=168=6×28、scrollHeight=252）、`有「展开全文」按钮`、`展开后 data-expanded=true 且解除截断`、`详情页不折叠（[data-clamped] 计数 0）` |

### 2.2 49 条 AC 表（t30 新口径）

证据类型：**CDP**＝无头 Chrome + `Emulation.setDeviceMetricsOverride` 真视口，读 `#app` 聚合 `data-*` 与 testid；**CDP-Net**＝`Network.requestWillBeSent` 抓请求；**grep/静态**＝读文件或产物。

| AC | 结论 | 断言 | 证据类型 | 证据要点 |
| --- | --- | --- | --- | --- |
| AC-TL01 | 通过 | 5 | CDP | 时间线首屏：根节点 + 聚合计数 + 路由 |
| AC-TL02 | 通过 | 3 | CDP | 关注流段选：8 条 + 选中态文本 |
| AC-TL03 | 通过 | 3 | CDP | 点赞 +1 且 aria-pressed=true（差值恰 1） |
| AC-TL04 | 通过 | 7 | CDP | 同一 profile 三次运行：like 持久化 → 重开仍在 → unlike 回落 |
| AC-TL05 | 通过 | 4 | CDP | 滚动位 900 恢复 + 进详情路由正确 |
| AC-TL06 | 通过 | 4 | CDP | 转发后顶部出现 `p_rp_*` 卡且恰好 1 条 |
| AC-TL07 | 通过 | 2 | CDP | 详情回复 +1 且聚合值与 DOM 回复条数一致 |
| AC-TL08 | 通过 | 8 | CDP | 首屏 20 → 真点坐标 load-more → 30 → 文案/禁用 |
| AC-TL09 | 通过 | 2 | CDP | 刷新探针：refresh-count=1 且可见集回 20 |
| AC-TL10 | 通过 | 4 | CDP | 空态：empty-state + 0 条 + 无卡片 |
| AC-TL11 | 通过 | 3 | CDP | 错误态：error-state + 运行期错误 0 |
| AC-TL12 | 通过 | 2 | CDP | 同源滚动位：→ `#/me` → 回 `#/timeline` 仍 900 |
| AC-DT01 | 通过 | 6 | CDP | 详情结构：无 data-clamped 的正文 + 回复 + tab 归属 |
| AC-DT02 | 通过 | 2 | CDP | 回复探针：+1 且首条回复文本 = PROBE-REPLY |
| AC-DT03 | 通过 | 2 | CDP | 详情内点赞 +1 且 aria-pressed |
| AC-DT04 | 通过 | 2 | CDP | 详情往返：scroll:900 建立后经 status 回 timeline 仍 900 |
| AC-DT05 | 通过 | 2 | CDP | 楼中楼：存在 data-parent-id 回复且带「回复 @」前缀 |
| AC-DT06 | 通过 | 8 | CDP | 折叠→展开：aria-expanded 与子项可见性 |
| AC-DT07 | 通过 | 6 | CDP | 内嵌转发卡：点击后路由替换为原帖 id |
| AC-DT08 | 通过 | 3 | CDP | 非法 id：detail-not-found 且不抛错 |
| AC-CP01 | 通过 | 4 | CDP | 发布探针：replace 回时间线 + 首卡 `p_new_*` + 文本 |
| AC-CP02 | 通过 | 4 | CDP | 空编辑器：发布禁用 + 0/500 计数 |
| AC-CP03 | 通过 | 1 | CDP | 带 1 张占位图：首卡 `data-media-count=1` |
| AC-CP04 | 通过 | 3 | CDP | 话题探针：`data-topics=1` + 成对 `#` |
| AC-CP05 | 通过 | 3 | CDP | 草稿持久化：probe=draft 后不带探针重开仍回填 |
| AC-CP06 | 通过 | 2 | CDP | 发布后计数 20→21 且 data-post-id 去重一致 |
| AC-CP07 | 通过 | 3 | CDP | 发布持久化：profile 统计 3→4 + 我的博文首条为新内容 |
| AC-CP08 | 通过 | 8 | CDP | 真点击：tabbar 发博 → 输入 → 取消回时间线 → 再进内容保留 |
| AC-CP09 | 通过 | 3 | CDP | 发布失败态：publish-error + 内容未丢 + 草稿已落盘 |
| AC-PF01 | 通过 | 4 | CDP | 我的页：路由/高亮/三项统计均为数字 |
| AC-PF02 | 通过 | 3 | CDP | 赞过的：`#/me?tab=liked` 选中并含 `p_0001` |
| AC-PF03 | 通过 | 3 | CDP | 取消赞后从「赞过的」移除（双向） |
| AC-PF04 | 通过 | 4 | CDP | 我的页滚动位 300 + 段选恢复 |
| AC-PF05 | 通过 | 10 | CDP | 真点击 tabbar 设置：原生 `dialog[open]`，路由不变 |
| AC-PF06 | 通过 | 5 | CDP | 暗色主题：html / 开关 / storage 三处一致（含第二次运行） |
| AC-PF07 | 通过 | 9 | CDP | 清空数据二次确认：20/3 复位 + 无已赞 |
| AC-G01 | 通过 | 4 | CDP | 4 条路由可直达 |
| AC-G02 | 通过 | 9 | CDP | `#/`、`#`、`#/nope` 全部归一到 timeline 且无错误 |
| AC-G03 | 通过 | 5 | CDP | tabbar 4 项文本 + aria-current + 详情归属时间线 |
| AC-G04 | 通过 | 5 | CDP | 亮/暗切换用同一套 CSS 变量名 |
| AC-G05 | 通过 | 4 | CDP | 滚动恢复三连：timeline 900 / 重开 900 / me 300 |
| AC-G06 | 通过 | 8 | CDP | 真 375 视口：无横向滚动 + 卡片 ≥320 |
| AC-G07 | 通过 | 14 | CDP | 768 / 1440：640 列居中 + 无横向滚动 |
| AC-G08 | 通过 | 7 | CDP | 键盘可达：Tab 依次到 tabbar 4 项与首卡 like，`:focus-visible` 有描边 |
| AC-G10 | 通过 | 9 | CDP | 4 路由 + 4 空/错探针：`data-runtime-errors` 恒 0 |
| AC-G13 | 通过 | 13 | CDP | 13 个 boot 探针原样回显到 `data-probe-applied` |
| **AC-G09** | 通过（**新口径**） | 4 | CDP-Net | 离线（`RILL_PROVIDER=mock`）五页抓包：`externalOrigins=[]`（所有请求 origin 仅 self）；`/api/(timeline|feed|status|comments|search|user|container|write|statuses)` 命中 **0**；timeline 仅 5 个请求（`/` + 两个产物 + `/api/config` + `/api/session`），其余四页 **0 请求** |
| **AC-G11** | 通过（**新口径**） | 3 | grep | 新判据 `grep -rnE 'app\.unique\.one\|\bUnique\b\|sina' src server index.html dist` → **0**；词边界自检：`asUniqueUsers` 不命中、独立 `Unique` 命中；注入反证三组均 0→1→0（§5） |
| AC-G12 | 通过 | — | 静态 | 运行时依赖恰 2 项：`react`、`react-dom` |

合计：**49 行 = 46 行套件（CDP，218 断言全过）+ 3 行补测（G09 按新口径通过 / G11 按新口径通过 / G12 通过）**。

**口径变更记录（旧口径作废，理由写在这里）**

- **AC-G09**：旧口径是「产物里 `fetch(`/`XMLHttpRequest`/`WebSocket` 命中 0」。它与「离线 + 在线双模式」设计**直接冲突**——在线数据层 `src/data/api.ts:114` 必然编译进 1 处 `fetch`；产物里有 fetch 字面量 ≠ 运行时会发网络请求。新口径改判**运行时证据**（见上表），并加一条更强的断言：离线路径不调用任何在线取数接口。
- **AC-G11**：旧口径禁 `微博/Weibo/weibo/sina`。本产品已自我定义为**微博第三方客户端**（登录页必须说明「用微博账号 cookie 登录」），继续禁这两个词会让文案自相矛盾。新口径收窄为「**原 app 标识**」：`app.unique.one`、独立词 `Unique`、`sina`；允许 `微博/Weibo/weibo`。

### 2.3 双主题 × 双模式

| 场景 | 结果 |
| --- | --- |
| 离线（mock provider）时间线 | `data-post-count=20`、首卡 `p_0001`（与历史基线一致）、`scrollWidth=375` |
| 离线 `#/search` | `search-offline`：「搜索只在线可用 / 离线模式继续用随包 mock 时间线」——不白屏 |
| 离线 `#/login` | `login-root` + cookie 粘贴说明——不白屏 |
| 在线 `AUTH_EXPIRED` 时间线 / 搜索 / 详情 | 401 → 时间线 `auth-error`「需要重新登录 / Cookie 可能已过期或被吊销；重新粘贴后继续。」+「去登录」；搜索内联同义文案；详情 `auth-error`「需要重新登录 / Cookie 可能已过期；重新登录后继续。」+「去登录」；三者均不白屏 |
| 在线 `RISK_CONTROL` 时间线 / 搜索 | 「触发了风控 / 微博要求人工验证；稍后再试，或换网络。」+「重试」；搜索内联同文案 |
| 在线 `RISK_CONTROL` 详情 | 通用错误态「内容没有加载出来 / 检查 server 与网络后再试。」（见 O2） |
| 在线正常（假上游） | 时间线/搜索正常渲染假上游卡片，无错误态 |
| 亮/暗同页像素差 | timeline `diffPx=304498`、detail `304500`、compose `304500`（各 100% 像素，bbox 全画布）⇒ 主题确实换了 |
| 暗色「白底白字」 | 5 页共 **292** 个文本节点，对比度 `<4.5` 命中 **0**，最低 **4.712**（compose 次要文字） |

---

## 3. 块二（设计验收补充）：S1–S8

| 判据 | 结论 | 实测证据 |
| --- | --- | --- |
| **S1** 折叠态 6 行 + 「展开全文」可点 | 成立 | `p_0007`：`clientHeight=168=6×28`、`scrollHeight=252`、`clamp=6`；按钮 48×44（有效命中区 50×46）；点击后 `data-expanded=true`、`clientHeight=392=14×28`、`scrollHeight===clientHeight` |
| **S2** 折叠态图片限量 ≤3，短帖不一刀切 | 成立 | 长帖折叠 `media=3`、展开 9；短正文+9 图 `p_0002`(28字)/`p_0008`(27字)/`p_0011`(29字) 折叠态均 **9 张全量**（`data-count=9`，9 个 111px 图格），无「展开全文」节点 |
| **S3** 详情 17px/1.6 不折叠 | 成立 | `font-size=17px`、`line-height=27.2px`（1.6）、`--rill-fs-detail=17px`/`--rill-lh-detail=1.6`、无 `data-clamped`、`scrollHeight===clientHeight` |
| **S4** V 13×13 / currentColor / data-verified / 缺字段不显示 | 成立，**带偏差 O1**（← t30 原始判定，**已于 t32 翻绿：3.00px，见 §11**；下文保留原测） | `p_0001`/`p_0007`：13×13、颜色 === 昵称色（亮 `rgb(11,11,11)` 19.683:1 / 暗 `rgb(237,237,237)` 16.002:1）、`data-verified="true"`；缺字段不渲染（`verified !== true → null`）。**偏差：与昵称间距 6px，final-spec 写 3px**（3px `margin-left` + 作者行 `column-gap:3px` 叠加）——**未修复，如实留档，不按 6px 冒充 3px 通过** |
| **S5** 硬编码消失 + 前缀在呈现层统一 | 成立 | 静态：`grep -rn "来自 溪流" src/` = **0**（含注释）；单一 helper `src/lib/source.ts:displaySource`，`PostCard`/`Detail` 两处共用、条件渲染。动态三臂（假上游）：已带前缀 `来自 iPhone 15 Pro` **原样**；`<a>iPhone客户端</a>` → **`来自 iPhone客户端`**（无「来自 来自」）；无 source → **`[data-source]` 节点不存在**。详情页 `来自 iPhone 13 mini`，右对齐（`padding-right:20px` 贴内容右缘），`emptySpans=0` |
| **S6** 读数条 375 两项 / 1440 右栏 | 成立 | 375：`.statbar`「30 条 100 图」= 两项；1440：`.side.side--stats` x=1060 w=260 |
| **S7** 回复编号用 `--rill-text-3` | 成立 | `.reply__n` = `rgb(103,104,95)` === `--rill-text-3` `#67685F`，11px |
| **S8** 亮/暗各点 ≥4.5 | 成立 | 亮最低 **5.642**（次要/尾巴/展开）；暗最低 **5.677**（compose 4.712）；正文 19.683 / 17.776 |

**几何与命中区（同批实测）**

| 项 | 实测 |
| --- | --- |
| 6 张真 375 | `a-{timeline,detail,compose}-375-{light,dark}.png`，PNG 尺寸校验 **375×812**，六张 `scrollWidth=375=innerWidth` |
| 可点元素 ≥44 | tabbar 94×58（四项）；发布 62×46；赞/评/转 **44×46**（视觉 30×32 + 外扩命中区）；展开全文 48×44；取消 44×52 |
| 遮挡 | tabbar 中心 `elementFromPoint` → 自身（6 张逐张）；发布按钮中心 → `publish-btn` 自身 |
| 九宫格 | 展开 `p_0007` 9×111×111，全部在 `.card__media`（335×335）与卡片内，边界不相交 |
| 1440 三栏 | `.side--date` **x=80 w=300**；卡片 **x=400/730 w=310**（feed 400–1040 = 640）；`.side--stats` **x=1060 w=260**；`scrollWidth=1440` |
| 主题切换真实路径 | 设置 → `theme-toggle`：`aria-checked` false→true、`html[data-theme]=dark`、`localStorage['rill:v1:theme']=dark` |

> 唯一「不达 44」记录是 `expand-text(p_0007)` 在首屏未滚动时测得的 0×0——屏幕外元素，属测量假象；滚动到视口内为 48×44（脚本已修）。

---

## 4. 变异反证（t24 的阻塞 2 已关闭）

做法：从**冻结提交**重新 `git clone` 到 `/tmp/verifier/t30-mutant`（`HEAD=f410745`，`git status` 干净），改坏后重建，跑仓库自带的 `scripts/check-hit.mjs`（39 条，含 4 条折叠基线）。

**变异①：CSS `-webkit-line-clamp` 写死为 2**

```
src/styles/daily.css | 2 +-        （1 file changed）
✓ built in 537ms
变异树实测：p_0007 clientHeight=56 (=2×28)、scrollHeight=196、clamp=2
$ node scripts/check-hit.mjs      →  rc=1   PASS 38 / FAIL 2
FAIL 375 p_0007 折叠态为 6 行（scrollHeight > clientHeight） ::
     {"clamped":"6","expanded":null,"clientHeight":56,"scrollHeight":196,"lineHeight":28,"textLength":243,"buttonText":"展开全文"}
```

**变异②：TS `PostCard` 的 clamp 6→5**

```
src/components/PostCard.tsx | 2 +-   （1 file changed）
✓ built in 585ms
$ node scripts/check-hit.mjs      →  rc=1   PASS 38 / FAIL 2
FAIL 375 p_0007 折叠态为 6 行（scrollHeight > clientHeight） ::
     {"clamped":"5","clientHeight":140,"scrollHeight":252,"lineHeight":28,…}
```

**恢复（`git checkout --` 两个文件）→ 重建 → 重跑**

```
$ node scripts/check-hit.mjs      →  rc=0   PASS 39 / FAIL 0 / ALL PASS
```

方法论事实：**只改 `card.css` 里那行 `var(--rill-clamp…)` 不会生效**（`daily.css:143` 同一声明在层叠中胜出，实测仍是 6 行、check-hit 全绿）。变异必须落在**真正生效的那一处**（`daily.css` 的声明或 `PostCard` 的 clamp 值），否则「改了没效果」会被误当成「测试抓不到」。这次两种有效变异都被抓住。

---

## 5. 假绿修复：禁用串自检曾结构性恒 0

**问题（t24 发现）**：spec §15 的命令

```
grep -rni -e unique -e 微博 -e weibo -e sina weibo-lite/src weibo-lite/index.html weibo-lite/dist | grep -v 'weibo-lite/' | wc -l  → 0
```

**恒为 0**：`grep -r` 的每一行输出都以路径 `weibo-lite/...` 开头，`| grep -v 'weibo-lite/'` 把**所有行**滤掉。这条 0 一直被当 AC-G11 的通过证据引用——它不是证据，是命令写错。冻结树上的真实命中（旧口径，按内容）：**230**（`微博` 71 / `weibo` 61 / `WEIBO` 53 / `Weibo` 41 / 含 `Unique` 的英文标识 4）。

**修法**：①口径按 captain t30 裁定收窄为「原 app 标识」（见 §2.2）；②命令改为按内容计数、加词边界：

```
grep -rnE 'app\.unique\.one|\bUnique\b|sina' src server index.html dist | wc -l    # 期望 0 → 实测 0
```

**注入反证（证明不再恒真）**，在冻结树干净 clone 里做，注入后撤销：

| 注入（写入 `src/probe.ts` 末尾） | 命令输出 | 撤销后 |
| --- | --- | --- |
| `// forbidden-brand probe: see app.unique.one for reference` | **1** | **0** |
| `const BRAND = 'Unique';` | **1** | **0** |
| `const UPSTREAM = 'https://api.sina.com.cn';` | **1** | **0** |

**仍待同步（不在 t30 范围，需下一步处理）**：`docs/spec.md:847`（§15 原始命令）与 `docs/capability-map.md:15`、`:119` 仍写着被滤掉的那条命令与旧口径。本文件与 `docs/acceptance.md`（§15 修订记录）已按新口径记录。

---

## 6. 树完整性（t24 的阻塞 1 已关闭）

| 判据 | 结果 | 证据 |
| --- | --- | --- |
| `git ls-files src \| wc -l` = `find src -type f \| wc -l` | **通过** | 45 = 45，差值 0（`git status --short` 为空；未入库的仅 `dist/`、`node_modules/`、`test-results/`、`*.log`、`*.sqlite`、`/data/` 等 gitignore 项） |
| `git cat-file -e <sha>:src/data/api.ts` | **通过** | `api.ts` / `src/lib/source.ts` / `src/auth/LoginPage.tsx` 均 `cat-file -e` 成功 |
| `git show <sha>:src/App.tsx` 命中 `api\|Auth\|Login` | **通过** | 命中 **17** 行（t24 时该 sha 为 0） |
| 该 sha 的 CI run = success | **通过** | run **43836710321**，`head_sha=f410745…`，`conclusion=success`，`event=push`，attempt 1 |

两个 job 与关键 step（GitHub API 逐 step 结论）：

```
build + checks              success (17 steps)
   6  Check mock data                       success
   7  Typecheck                             success
   8  Build                                 success
   9  Guard - 在线路由必须真的在仓库里        success   ← 索引态护栏在 Build 之后
  10  Server unit tests                     success
  11  Server smoke                         success
  12  Hit-test UI (coordinate clicks)      success   ← 39 条（含折叠基线）
docker build + container smoke   success (9 steps)
   4  docker build                                 success
   5  Container smoke（run → /api/health 200 → logs） success
```

护栏的变异证据（t29 记录，本轮核对 CI step 结论一致）：`git rm --cached src/data/api.ts` → guard exit 1；`git add` 恢复 → exit 0；把产物里的 `login-input` 改掉 → grep exit 1，恢复 → 0。**只判断文件是否存在于磁盘的 `git ls-files` 抓不到 `rm --cached`，而 `git ls-files --error-unmatch`（索引态）能抓到**——这正是护栏采用它的原因。

---

## 7. 与 t24 的差异（历史留痕，不覆盖旧结论）

| t24 结论（当时属实） | t30 复查 |
| --- | --- |
| 验收对象是未提交工作树，`src/` 33 vs 45，缺 12 个在线前端文件 | 已提交 `f410745`，45 = 45，`cat-file -e` 全通，App.tsx 命中 17 |
| CI 绿绑在不含在线前端的 sha 上，不能当验收证据 | CI run 43836710321 的 sha 就是本轮验收对象，两个 job 均 success |
| 变异反证不成立：clamp 改错后 check-hit 仍全绿（脚本对 fold 零断言） | 基线已并入（39 条），两种有效变异均 FAIL（38/2），恢复 ALL PASS |
| 禁用串自检命令恒 0（假绿） | 命令已修，注入三组样本 0→1→0 |
| AC-G09/G11 字面不符 | 按 captain 新口径判**通过**，并在 §2.2 写明「旧口径作废 + 理由 + 新判据」 |

---

## 8. 未验证 / 证据限度（不要当已通过）

1. **真实 cookie 全链**（赞→取消→评论→转发→发文字→发图）仍未对真实站点执行；真实凭证从未进仓库，清单在 `server/test/real-cookie-checklist.md`。在线结论全部基于**假上游**。
2. **在线详情正常态**未打通（假上游返回 status 时详情仍显示「内容没有加载出来」）⇒ 只验证了详情的两个错误态。
3. **Docker 镜像行为**只能在 CI runner 上证明；匿名读日志 403、artifact 401，属证据限度。本机无 docker。
4. **截图未做人眼审阅**（当前模型不支持读图）：所有视觉结论均为几何/计算样式/`elementFromPoint`/对比度枚举/逐像素 diff 的量化证据，截图只作可复现留档。

---

## 9. 偏差与观察项（不阻塞，供下一轮）

| 编号 | 内容 | 现状 | 建议修法 |
| --- | --- | --- | --- |
| **O1** | V 与昵称间距 **6px**，final-spec 写 **3px** | **已修（t31 改 / t32 复验 3.00px，见 §11）**；t30 当时状态“未修复，如实留档”保留为历史 | 删掉 `VerifiedMark` 的 `margin-left:3px`（作者行已有 `column-gap:3px`），或反之，二选一 |
| **O2** | 详情页 `RISK_CONTROL` 显示通用错误文案 | **已修（t31 改 / t32 复验三页同文案，见 §11）**；原状态“态正确、文案不专”保留为历史 | `OnlineDetail.tsx` 在 `authLike` 之外补 `RISK_CONTROL` 分支 |
| **O3** | `docs/spec.md:847`、`docs/capability-map.md:15,119` 仍用被滤掉的旧命令 | **已同步（t31 随 t28 改动提交）**：spec §15 现为新命令 + 旧命令标“已废弃”，capability-map 两处已改；原状态保留为历史 | 与 §5 新命令同步（t30 范围外） |

---

## 10. 复跑命令（拿到任一交付 sha 即可照抄）

```bash
cd weibo-lite
git ls-files src | wc -l ; find src -type f | wc -l            # 45 = 45
git cat-file -e HEAD:src/data/api.ts && echo ok
git show HEAD:src/App.tsx | grep -cE 'api|Auth|Login'          # > 0
NODE=…/node; PNPM=…/pnpm.mjs
$NODE $PNPM run check:mock ; $NODE $PNPM exec tsc --noEmit ; $NODE $PNPM run build
node scripts/check-hit.mjs                                     # PASS 39 / FAIL 0
node /tmp/verifier/t24/ac-a.mjs                                # 46 行 / 218 断言
node /tmp/verifier/t24/a-visual2.mjs                           # 6 张 375 + 几何/对比度/遮挡/九宫格/1440
node /tmp/verifier/t24/dark-audit.mjs                          # 暗色逐节点对比度（292 节点，<4.5 命中 0）
node /tmp/verifier/t24/t24-modes.mjs                           # 离线基线 + 在线 AUTH_EXPIRED/RISK_CONTROL
node /tmp/verifier/t24/t24-f1f2.mjs                            # F1/F2/C2 三臂
node /tmp/verifier/t30-g09.mjs                                 # AC-G09 新口径：离线零外部请求
# 变异反证：clone 后改 daily.css 的 -webkit-line-clamp 为 2 → build → check-hit 必须 rc=1
```

**一句话收尾**：A 的三页版式、折叠契约、认证与尾巴、九宫格、1440 三栏、暗色对比度，这次都落在**一个可复现的提交**上，回归也没坏；t24 的两条硬阻塞（树不完整、变异反证不成立）已分别由 `f410745` 与并入 `check-hit` 的折叠基线关闭；剩下的是一条 3px 的间距偏差（O1）和两条文案/文档项，已如实留档，没拿 6px 冒充通过。

---

## 11. 更新记录（t32 收尾复验，终局 sha `0847cff`）

本节只追加，不改上文任何旧结论：§3 的“带偏差 O1（6px）”与 §9 的 O1/O2/O3 原判定**保留原文**，状态变化在此记录。

### 11.1 AC-VF01（V 标与昵称间距）→ **通过：3.00px**

- **方法（按要求量 rect 差值，不读 CSS 声明）**：`gap = vm.getBoundingClientRect().left - name.getBoundingClientRect().right`，在真 375 视口下对**所有**带 V 的作者行逐条测量，亮/暗各一轮。
- **命令**：`node /tmp/verifier/t32-probe.mjs`（CDP，`Emulation.setDeviceMetricsOverride 375×812`）。
- **输出**：

```
源码 RISK_CONTROL_COPY = {"wantTitle":"触发了风控","wantText":"微博要求人工验证；稍后再试，或换网络。"}
PASS light: 找到 6 条带 V 的作者行 :: {"pids":["p_0001","p_0003","p_0006","p_0007","p_0011","p_0015"]}
PASS light: V.left - name.right 全部 = 3.00 :: {"gaps":[3,3,3,3,3,3]}
PASS light: VerifiedMark 仍 13×13 :: {"vm":{"w":13,"h":13,"color":"rgb(11, 11, 11)","borderColor":"rgb(11, 11, 11)","currentColorEqName":true}}
PASS light: 作者行仍单行（h=22、scrollH=clientH）且五项齐全 :: {"head":{"h":22,"clientH":22,"scrollH":22,"clientW":335,"scrollW":335,"gapCss":"3px"},"items":[{"k":"name","ok":true},{"k":"vm","ok":true},{"k":"handle","ok":true},{"k":"time","ok":true},{"k":"src","ok":true}]}
PASS dark: 找到 6 条带 V 的作者行 / V.left - name.right 全部 = 3.00 :: {"gaps":[3,3,3,3,3,3]}
PASS dark: VerifiedMark 仍 13×13 :: {"vm":{"w":13,"h":13,"color":"rgb(237, 237, 237)","currentColorEqName":true}}
PASS dark: 作者行仍单行（h=22、scrollH=clientH）且五项齐全
```

- **同时确认 S4 的既有契约没被改坏**：13×13、`color === borderColor === 昵称色`（`currentColor`，亮 `rgb(11,11,11)` / 暗 `rgb(237,237,237)`）、`data-verified="true"`；作者行仍 `height=22 = scrollHeight=22`、`scrollWidth=clientWidth=335`，**五项（昵称/V/handle/时间/来源）全在且无换行**——收间距没有把行挤断。
- **归因**：t31 删掉了 `.vm { margin-left: 3px }`，间距只剩作者行 `.card__head { gap: 3px }` 一个来源；t30 的 6px 正是“3px margin + 3px gap”叠加。**这条偏差的根因（两层间距叠加）与修法（只留一层）在实测里都得到印证**：`gapCss` 仍是 3px 而实测差值从 6→3。

### 11.2 O2（详情页风控文案）→ **通过：三页逐字一致**

- **方法**：假上游对全部读接口回 403（`{ok:0,msg:'风控'}`），真 375 视口分别进 `#/timeline`、`#/search`（**真的点 `search-submit` 发起搜索**，不是停在“搜点什么”空态）、`#/status/M1`；期望文案**从源码 `src/data/api.ts` 的 `RISK_CONTROL_COPY` 现场解析**，不用我背下来的字符串。
- **命令**：`node /tmp/verifier/t32-probe2.mjs`。
- **输出**：

```
PASS search 真的发起了（出现 search-error，而不是 search-empty）
PASS search 标题 = 源码 title
PASS search 正文 = 源码 text
PASS detail 标题 = 源码 title
PASS detail 正文 = 源码 text 且不等于通用文案
PASS timeline 正文 = 源码 text
PASS 三页正文逐字一致
rows = { timeline {testid:error-state,  title:触发了风控, text:微博要求人工验证；稍后再试，或换网络。},
         search   {testid:search-error, title:触发了风控, text:同上},
         detail   {testid:error-state,  title:触发了风控, text:同上} }
```

- **截图（375×812）**：`docs/shots/a-timeline-risk-375.png`、`docs/shots/a-search-risk-375.png`、`docs/shots/a-detail-risk-375.png`。
- **一处必须说清的口径**：**T30 报告里“详情页风控文案不专”的判断现在不成立了**——但那是 t30 当时的实测（当时代码确实落到通用文案），本轮是另一个 sha。旧结论保留在 §2.3/§9，状态变化记在这里。
- **另一个必须说清的教训**：我第一版 O2 脚本用“回车键”驱动搜索，实际没触发搜索（页面停在“搜点什么”），而我又给搜索那一条断言写了 `|| true` 式的兜底——**第一次跑出来是 15/15 全绿，但其中 1 条是恒真的假绿**。复查时发现并改成严格断言 + 真点 `search-submit`，才得到上面 7/7。**这正是本任务反复强调的那件事：恒真的检查看起来永远绿。**

### 11.3 守门（check-hit）仍然有效：变异矩阵

| 变异 | 是否真的改变了折叠 | 实测 | `check-hit` |
| --- | --- | --- | --- |
| `src/styles/card.css:26` 声明 `var(--rill-clamp…)` → `2` | **否**（`daily.css:143` 同声明在产物里更靠后、胜出；且折叠值来自内联 `--rill-clamp`） | `clamp=6, clientHeight=168` | **PASS 39**（变异没打到生效处，不是测试失效） |
| `src/styles/daily.css:143` 声明 → `2` | **是** | `clamp=2, clientHeight=56=2×28` | **rc=1 PASS 38 / FAIL 2**，失败项 `{"clamped":"6","clientHeight":56,"scrollHeight":196}` |
| `src/components/PostCard.tsx` `const clamp = compact ? 4 : 6` → `5` | **是** | `data-clamped=5, clientHeight=140=5×28` | **rc=1 PASS 38 / FAIL 2**，`{"clamped":"5","clientHeight":140}` |
| 恢复两处 → 重建 | — | `clamp=6, clientHeight=168` | **rc=0 PASS 39 / FAIL 0 / ALL PASS** |

**方法论记录（值得写下来，因为它差点骗过我）**：前两次变异跑出来“全绿”，原因是 **4185 端口上还挂着一个 t30 留下的旧 preview**——我之前的清理命令 `pkill -f "vite preview"` 匹配不到 `node …/vite.js preview` 这种命令行，旧进程一直活着并继续伺服**旧 dist**，于是“变异后仍 6 行”其实是“我量的是旧产物”。改成 `pkill -f "vite.js preview"` + `lsof` 确认端口空出 + 校验 `curl / | grep assets/index-*.js` 与服务端 dist 文件名一致之后，变异矩阵才如上表。**“测试全绿”和“被验对象根本不是新产物”这两件事，看起来一模一样。**

### 11.4 回归不破 + 树与 CI（终局 sha `0847cff`）

| 项 | 结果 |
| --- | --- |
| `pnpm run check:mock` | rc=0，`{"users":12,"statuses":30,"comments":60,…,"verified":2,"sources":12,"longPost":243}` |
| `pnpm exec tsc --noEmit` | rc=0 |
| `pnpm run build` | rc=0 → `index-BDudWUes.js` 238.46 kB / `index-D98iynny.css` 45.51 kB（新产物，区别于 t30 的 `DYfQkNEH`，因 O1/O2 改了源） |
| `node scripts/check-hit.mjs` | **PASS 39 / FAIL 0 / ALL PASS** |
| 离线基线 | `data-post-count=20`、首卡 `p_0001`、`scrollWidth=375`、`data-runtime-errors=0` |
| `git ls-files src` vs `find src` | **45 = 45**（`git status --short` 在验收开始时为空） |
| CI run | **43840064290** `conclusion=success`（`head_sha=0847cff…`）：`build + checks` success（Build #8 → **Guard #9** → Server unit #10 / smoke #11 → **Hit-test #12**）、`docker build + container smoke` success |

### 11.5 仍未验证（本轮没有覆盖，继续保留“未验证”）

1. **真实 cookie 全链路**（赞→取消→评论→转发→发文→发图）——仍未对真站执行，凭证从未进仓库。
2. **在线详情正常态**（假上游返回真实 status 时详情正常渲染）——本轮只验了详情的 **错误态**（403 风控/401 重登），happy path 仍未打通。
3. **Docker 镜像行为**——只在 CI runner 上验证，本机无 docker。
4. **截图人眼审阅**——模型不支持读图；本轮新增的三张风控截图同样只作留档。

**AC-VF01 翻绿只说明“这一条间距对了”，不改变上面四条的状态。**
