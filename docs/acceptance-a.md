# A「日报」落地终局验收（t24）

**回归全绿 ≠ 新设计成立。** 本报告分两块，标题各自写明性质：块一（回归）回答「有没有把原来能用的东西搞坏」，块二（设计验收补充）回答「A 是不是真的落在 src/ 里了」。两块独立判定，任何一块不成立都不算通过。

写完这行先给结论，免得两块的具体数字被当成整体通过：

| 项 | 结果 |
| --- | --- |
| 判定 | **failed** |
| 阻塞 1 | 验收对象不是已提交的树（HEAD `e27174e`，`src/` 缺 12 个文件） |
| 阻塞 2 | 变异反证不成立：把折叠行数改错后，仓库自带的 `check-hit` 仍然 **39/39 全绿** |
| 块一（回归） | 46 条套件行全过（225 断言）；另 3 行补测：**G09 不符、G11 不符、G12 通过** |
| 块二（设计补充） | S1/S2/S3/S5/S6/S7/S8 成立；**S5 三臂在 t26 修好后的工作树才成立（在 t24 所验 sha 上被 F1 卡住）**；**S4 有 1 条偏差**（详见 §3） |
| 发现项 | F1/F2 在**本轮修复前的那个 sha 上不成立**（见 §4），已按发现项记录，不参与 S 判据 |

---

## 1. 被验对象（这一节决定上面所有数字的适用范围）

| 项 | 值 |
| --- | --- |
| 仓库 | `/Users/user/Downloads/crack/weibo-lite` |
| HEAD | `e27174e`（`fix(docker,git): 修 Dockerfile 缺 COPY server 的 blocker 与 .gitignore 误吞 src/data`） |
| 提交树 `src/` 文件数 | **33** |
| 工作树 `src/` 文件数 | **45** |
| 未提交 `src/` 文件 | 12 个（清单见 §6） |
| dist js | `dist/assets/index-DYfQkNEH.js`，238.43 kB，sha256 前缀 `8b79d4896e199cef`，mtime 16:52:19 |
| dist css | `dist/assets/index-DZFlHw8W.css`，45.53 kB，sha256 前缀 `cc011340bd39fe77` |
| 测量时间 | 16:34–16:58 |

**必须写清楚的两件事**：

1. **所有数字都绑在「未提交的工作树 + 上面那对 dist 哈希」上**，不是任何 sha。也就是说：这些数字证明「我量过的这一版」成立，**不能证明「别人 clone 下来能构建出这一版」**——后者正是 §6 判失败的原因。
2. 测量过程中工作树**在动**：`server/providers/weibo.mjs` 16:36 改过，`src/data/api.ts` 16:47、`src/auth/LoginPage.tsx` 16:49 改过（t26 在并行修 F1/F2/安全余项）。为此我在 16:52 重新构建并**重跑了全部测量**（视觉/AC/暗色/双模式/F1F2 三臂），报告里所有数字都来自这一次冻结后的重跑；早先 16:33 那批 dist（`index-DWha3Njb.js`）的数字已作废、未采用。

---

## 2. 块一（回归）：49 条 AC 逐条重跑 + 双主题 × 双模式

### 2.1 构建门禁（逐条贴 rc）

| 命令 | rc | 结果 |
| --- | --- | --- |
| `pnpm run check:mock` | 0 | `OK {"users":12,"statuses":30,"comments":60,"mediaDist":{"0":8,"1":5,"2":3,"3":2,"4":5,"9":7},"repost":4,"topics":6,"nested":12,"postsWithReplies":29,"verified":2,"sources":12,"longPost":243}` —— 与历史基线逐字一致 |
| `pnpm exec tsc --noEmit` | 0 | 零错误 |
| `pnpm run build` | 0 | `index-DYfQkNEH.js 238.43 kB (gzip 75.71)`、`index-DZFlHw8W.css 45.53 kB (gzip 8.12)`、built in 869ms |
| `node scripts/check-hit.mjs`（`RILL_BASE=4181`，绑定冻结构建） | 0 | **PASS 39 / FAIL 0**，末行 `ALL PASS` |

### 2.2 49 条 AC 表

证据类型：**CDP**＝无头 Chrome 通过 `Emulation.setDeviceMetricsOverride` 设真视口后读 `#app` 的 `data-*` 聚合属性与 testid 文本；**grep/静态**＝读文件或构建产物。

| AC | 结论 | 断言 | 证据类型 | 断言集（脚本里的 title） |
| --- | --- | --- | --- | --- |
| AC-TL01 | 通过 | 5 | CDP | 时间线首屏：根节点 + 聚合计数 + 路由 |
| AC-TL02 | 通过 | 3 | CDP | 关注流段选：8 条 + 选中态文本 |
| AC-TL03 | 通过 | 3 | CDP | 点赞 +1 且 aria-pressed=true（差值恰 1） |
| AC-TL04 | 通过 | 7 | CDP | 三次运行同一 profile：like 持久化 → 重开仍在 → unlike 回落 |
| AC-TL05 | 通过 | 4 | CDP | 滚动位 900 恢复 + 进详情路由正确 |
| AC-TL06 | 通过 | 4 | CDP | 转发后顶部出现 p_rp_* 卡且恰好 1 条 |
| AC-TL07 | 通过 | 2 | CDP | 详情回复 +1 且聚合值与 DOM 回复条数一致 |
| AC-TL08 | 通过 | 8 | CDP | 首屏 20 → 真点击 load-more → 30 → 文案/禁用 |
| AC-TL09 | 通过 | 2 | CDP | 刷新探针：refresh-count=1 且可见集回 20 |
| AC-TL10 | 通过 | 4 | CDP | 空态：empty-state + 0 条 + 无卡片 |
| AC-TL11 | 通过 | 3 | CDP | 错误态：error-state + 运行期错误 0 |
| AC-TL12 | 通过 | 2 | CDP | 同源滚动位：离开到 #/me 再回 #/timeline 仍是 900 |
| AC-DT01 | 通过 | 6 | CDP | 详情结构：无 data-clamped 的正文 + 回复存在 + tab 归属 |
| AC-DT02 | 通过 | 2 | CDP | 回复探针：+1 且首条回复文本 = PROBE-REPLY |
| AC-DT03 | 通过 | 2 | CDP | 详情内点赞 +1 且 aria-pressed |
| AC-DT04 | 通过 | 2 | CDP | 详情往返：scroll:900 建立后经 status 回 timeline 仍 900 |
| AC-DT05 | 通过 | 2 | CDP | 楼中楼：存在 data-parent-id 回复且带「回复 @」前缀 |
| AC-DT06 | 通过 | 8 | CDP | 楼中楼折叠→展开：aria-expanded 与子项可见性 |
| AC-DT07 | 通过 | 6 | CDP | 内嵌转发卡：点击后路由替换为原帖 id |
| AC-DT08 | 通过 | 3 | CDP | 非法 id：detail-not-found 且不抛错 |
| AC-CP01 | 通过 | 4 | CDP | 发布探针：replace 回时间线 + 首卡 p_new_* + 文本 |
| AC-CP02 | 通过 | 4 | CDP | 空编辑器：发布禁用 + 0/500 计数 |
| AC-CP03 | 通过 | 1 | CDP | 发布带 1 张占位图：首卡 data-media-count=1 |
| AC-CP04 | 通过 | 3 | CDP | 话题探针：data-topics=1 + 成对 # + add-topic 可达名 |
| AC-CP05 | 通过 | 3 | CDP | 草稿持久化：probe=draft 后不带探针重开仍回填 |
| AC-CP06 | 通过 | 2 | CDP | 发布后计数 20→21 且 data-post-id 去重前后一致 |
| AC-CP07 | 通过 | 3 | CDP | 发布持久化：profile 统计 3→4 + 我的博文首条为新内容 |
| AC-CP08 | 通过 | 8 | CDP | 真点击：tabbar 发博 → 输入 → 取消回时间线 → 再进内容保留 |
| AC-CP09 | 通过 | 3 | CDP | 发布失败态：publish-error + 内容未丢 + 草稿已落盘 |
| AC-PF01 | 通过 | 4 | CDP | 我的页：路由/高亮/三项统计均为数字 |
| AC-PF02 | 通过 | 3 | CDP | 赞过的：like 持久化后 #/me?tab=liked 选中并含 p_0001 |
| AC-PF03 | 通过 | 3 | CDP | 取消赞后从「赞过的」移除（双向） |
| AC-PF04 | 通过 | 4 | CDP | 我的页滚动位 300 + 段选恢复 |
| AC-PF05 | 通过 | 10 | CDP | 真点击 tabbar 设置：原生 dialog[open]，路由不变 |
| AC-PF06 | 通过 | 5 | CDP | 暗色主题：html/开关/storage 三处一致（含第二次运行） |
| AC-PF07 | 通过 | 9 | CDP | 清空数据二次确认：20/3 复位 + 无已赞 |
| AC-G01 | 通过 | 4 | CDP | 4 条路由可直达 |
| AC-G02 | 通过 | 9 | CDP | #/、#、#/nope 全部归一到 timeline 且无错误 |
| AC-G03 | 通过 | 5 | CDP | tabbar 4 项文本 + aria-current + 详情归属时间线 |
| AC-G04 | 通过 | 5 | CDP | 亮/暗切换用同一套 CSS 变量名 |
| AC-G05 | 通过 | 4 | CDP | 滚动恢复三连：timeline 900 / 重开 900 / me 300 |
| AC-G06 | 通过 | 8 | CDP | 真 375 视口：无横向滚动 + 卡片 ≥320 |
| AC-G07 | 通过 | 14 | CDP | 768 / 1440：640 列居中 + 无横向滚动 |
| AC-G08 | 通过 | 7 | CDP | 键盘可达：Tab 依次到 tabbar 4 项与首卡 like 按钮，:focus-visible 有描边 |
| AC-G10 | 通过 | 9 | CDP | 4 路由 + 4 空/错探针：data-runtime-errors 恒 0 且无未捕获异常 |
| AC-G13 | 通过 | 13 | CDP | 13 个 boot 探针原样回显到 data-probe-applied |
| **AC-G09** | **不符** | — | grep（dist） | `dist/assets/*.js` 命中 `fetch(` **1 次**（`src/data/api.ts:114`，在线数据层）；`XMLHttpRequest` 0、`WebSocket` 0；`dist/index.html` 无外链资源 |
| **AC-G11** | **不符** | — | grep（src/dist） | 修正口径后命中 **51**（`微博` 35、`weibo` 16）；且**原命令恒 0（假绿）**，见 §2.4 |
| AC-G12 | 通过 | — | 静态 | 运行时依赖恰 2 项：`react`、`react-dom` |

合计：**49 行 = 46 行套件（CDP，225 断言全过）+ 3 行补测（G09 不符 / G11 不符 / G12 通过）**。这 3 行此前一直不在我的自动套件里，本轮才逐条实跑——**不是"漏了但应该没事"，是"补跑发现了两条不符"**。

### 2.3 两条不符的归因：都是「A 的设计与旧契约冲突」，不是实现 bug

- **AC-G09**（离线包不得有 `fetch(`/XHR/WS）：这条契约写于「纯离线客户端」时期。A 的落地物包含在线只读/写链路（`src/data/api.ts`），构建产物里必然有 1 处 `fetch(`。**离线模式不调用它**（mock provider 走随包 mock），所以对离线体验没有任何影响；但按字面 AC 就是不符。要修的是**契约口径**（把在线文件列入白名单，或改成"离线路径不得发起网络请求"并在运行时断言 `externalRequests=[]`——后者我的套件已断言为空），不是删掉在线能力。
- **AC-G11**（禁用串：`Unique/unique/微博/weibo/sina/app.unique.one/sinaweibo` 命中 0）：产品要连接上游，"微博""m.weibo.cn"这类词必然出现在登录页与错误文案里。同上，是**契约与 A 的范围冲突**。

**这两条按 captain 的分类属于"设计与旧契约冲突"，处理方式应是改契约并留下版本说明，而不是让实现去迁就一条过时的自检。但改契约不是我（verifier）的权限，也不在本任务 inScope 内，只上报。**

### 2.4 顺带发现：§15 的禁用串自检命令**恒为 0（假绿）**

`docs/spec.md` §15 给的自检命令是：

```
grep -rni -e unique -e 微博 -e weibo -e sina weibo-lite/src weibo-lite/index.html weibo-lite/dist | grep -v 'weibo-lite/' | wc -l   → 期望 0
```

`grep -r` 输出的每一行都以路径 `weibo-lite/...` 开头，因此 `grep -v 'weibo-lite/'` 会把**所有行**过滤掉，结果永远是 0——与仓库里到底有没有禁用串无关。实测：该命令 0，按内容统计（`grep -rhoiE 'unique|微博|weibo|sina'`）**51**。

这条"0"过去一直被当成通过证据引用（G11 是 AC 行）。**它从来不是证据。** 修法：去掉 `grep -v 'weibo-lite/'`，改按内容计数，并把在线文件白名单单列一行说明。

### 2.5 双主题 × 双模式

| 场景 | 结果 |
| --- | --- |
| 离线（`RILL_PROVIDER=mock`）时间线 | `data-post-count=20`、首卡 `p_0001`（与历史基线一致）、`scrollWidth=375` |
| 离线 `#/search` | `search-offline` 态：「搜索只在线可用 / 离线模式继续用随包 mock 时间线」——不白屏 |
| 离线 `#/login` | `login-root` 态 + cookie 粘贴说明——不白屏 |
| 在线（假 cookie + 假上游）`AUTH_EXPIRED` 时间线 | **401 →** `auth-error`：「需要重新登录 / Cookie 可能已过期或被吊销；重新粘贴后继续。」+「去登录」 |
| 在线 `AUTH_EXPIRED` 搜索 | 内联「需要重新登录 / Cookie 可能已过期；重新粘贴后即可继续搜索。」+「去登录」 |
| 在线 `AUTH_EXPIRED` 详情 | `auth-error`：「需要重新登录 / Cookie 可能已过期；重新登录后继续。」+「去登录」 |
| 在线 `RISK_CONTROL` 时间线 | 「触发了风控 / 微博要求人工验证；稍后再试，或换网络。」+「重试」 |
| 在线 `RISK_CONTROL` 搜索 | 同文案内联 |
| 在线 `RISK_CONTROL` 详情 | **通用错误**「内容没有加载出来 / 检查 server 与网络后再试。」（见 §3 观察项 O2） |
| 在线正常（`ok`）时间线 | 假上游卡片正常渲染，无错误态 |
| 亮/暗同页像素差 | timeline `diffPx=304498`、detail `304500`、compose `304500`（各占全帧 100%，bbox 全画布）⇒ 主题确实换了 |
| 暗色下白底白字 | 逐文本节点枚举 5 页共 **292** 个文本元素，`<4.5` 命中 **0**，最低 **4.712**（compose 的次要文字）、时间线/详情/我的/搜索最低 5.677 ⇒ 不存在白底白字 |

在线四态都不白屏、都带具体原因与可操作出口；`AUTH_EXPIRED` 三个页面全部给出重登提示 —— 这一项成立。

---

## 3. 块二（设计验收补充）：S1–S8

判据来源：`docs/ui-proposals/A/final-spec.md` §9/§11 + captain 的 C1/C2 裁定 + 本任务 PLAN。**这些是"设计有没有落地"的实测判据，不是 spec 里的 AC 行**（转成正式 AC 行由 t28 做）。

| 判据 | 结论 | 实测证据 |
| --- | --- | --- |
| **S1** 折叠态正文 6 行 + 「展开全文」可点 | 成立 | `p_0007`：`clientHeight=168 = 6×28`，`scrollHeight=252`（确被截断），`-webkit-line-clamp=6`；按钮 48×44（有效命中区 50×46，≥44）；点击后 `data-expanded=true`、`clientHeight=392=14×28`、`scrollHeight===clientHeight` |
| **S2** 折叠态图片限量 ≤3，且**短帖不被一刀切** | 成立 | 长帖 `p_0007` 折叠态 `media-count=3`、展开态 9；短正文+9 图三条 `p_0002`(28字)/`p_0008`(27字)/`p_0011`(29字) 折叠态均 **9 张全量**（`data-count=9`，9 个 111px 图格），且无「展开全文」节点 ⇒ 限量只对长帖生效 |
| **S3** 详情 17px/1.6 不折叠 | 成立 | 详情 `font-size=17px`、`line-height=27.2px`（=1.6）、`--rill-fs-detail:17px` / `--rill-lh-detail:1.6` 生效、无 `data-clamped`、`scrollHeight===clientHeight` |
| **S4** V 认证 13×13 / `currentColor` / `data-verified` / 缺字段不显示 | **成立，1 条偏差** | `p_0001`/`p_0007`：13×13、颜色 === 昵称色（`rgb(11,11,11)` 亮 / `rgb(237,237,237)` 暗，非黄非品牌色）、`data-verified="true"`、暗色下仍可见（19.68:1 / 16.00:1）；**偏差 O1：与昵称间距实测 6px，final-spec 写 3px**（3px `margin-left` + 作者行 `gap:3px` 叠加） |
| **S5** 硬编码消失 + 前缀在呈现层统一 | **成立（静态 + 三臂；三臂依赖 t26 的 F1 修复，见 §4）** | 静态：`grep -rn "来自 溪流" src/` = **0**（含注释）；单一 helper `src/lib/source.ts`（`displaySource`），`PostCard`/`Detail` 两处共用；两处都是条件渲染（空值不渲染节点）。动态臂①（mock，已带前缀）`来自 iPhone 13 mini` 原样；臂②（假上游 `<a>iPhone客户端</a>`）→ `来自 iPhone客户端`（无「来自 来自」）；臂③（假上游无 `source`）→ **`[data-source]` 不存在**（DOM 查无此节点，非空串非空 span）；详情页同样 `来自 iPhone 13 mini`、右对齐（作者行 `padding-right:20px`，尾巴贴内容右缘） |
| **S6** 读数条：375 只两项 / 1440 移到右栏 | 成立 | 375：`.statbar` 文本「30 条 100 图」= 两项；1440：`.side.side--stats` @ `x=1060 w=260` |
| **S7** 回复编号用 `--rill-text-3` | 成立 | `.reply__n` 颜色 `rgb(103,104,95)` === `--rill-text-3` `#67685F`，11px |
| **S8** 亮/暗各 3 点对比度 ≥4.5 | 成立 | 亮：正文 19.683 / 次要 5.642 / 展开 5.642；暗：正文 17.776 / 次要 5.677 / 展开 5.677；**最低 4.712**（compose 暗色次要） |

**其它几何/视觉契约**（同一批实测）：

- **6 张真 375**（CDP 设备度量，PNG 尺寸校验 375×812）：`a-timeline-375-light/dark`、`a-detail-375-light/dark`、`a-compose-375-light/dark`；六张 `scrollWidth === 375 === innerWidth`。
- **可点元素 44×44**：tabbar 4 项 94×56；发布按钮 60×32 但有效命中区达标；赞/评论/转发 30×32 视觉框、有效命中区 **44×46**（靠外扩命中区，实测中心 ±20px 仍命中自身）；「展开全文」48×44。唯一"不达标"记录是 `expand-text(p_0007)` 在**首屏未滚动时**测得的 0×0 —— 那是屏幕外元素，属测量假象，滚动到视口内测得 48×44（脚本已修）。
- **无遮挡**：tabbar 中心 `elementFromPoint` → `tab-timeline` 自身；发布按钮中心 → `publish-btn` 自身（6 张图逐张校验）。
- **九宫格几何**：展开态 `p_0007` 9 个 111×111 图格，全部在 `.card__media`（335×335）与卡片（375×880）内，边界不相交（`allInsideMedia=true`、`allInsideCard=true`）。折叠线不切图：折叠态 `media-count=3`，3 个图格在容器内。
- **1440 三栏**（不是拉长手机）：`.side.side--date @ x=80 w=300`、feed `@ x=400 w=640`（两张卡 310+20+310）、`.side.side--stats @ x=1060 w=260`；`scrollWidth=1440=innerWidth`。与 final-spec D-1 的 x/w 完全一致。
- **主题切换真实路径**：点「设置」→ 点 `theme-toggle`（`role=switch`）→ `aria-checked false→true`、`html[data-theme]=dark`、`localStorage['rill:v1:theme']=dark`。

### 观察项（不判失败，但请 captain 决定要不要修）

- **O1（S4 偏差）**：V 与昵称间距 6px ≠ final-spec 的 3px。原因：`vm{margin-left:3px}` + 作者行 `column-gap:3px` 叠加。修法：去掉其中一处（建议删 `margin-left`，因为 gap 已经负责间距）。
- **O2（错误文案精度）**：详情页对 `RISK_CONTROL` 显示通用错误「内容没有加载出来」，风控专文案只出现在时间线/搜索。态是对的（有错误态 + 重试），只是文案不够具体。修法：`OnlineDetail.tsx` 的 `authLike` 之外再加一条 `RISK_CONTROL` 分支。

---

## 4. 发现项 F1/F2（不是 S 判据，单独记）

**在线模式下这两样（V 标 / 尾巴）在本轮修复前不成立（见 F1/F2）** —— 这句话是按 t24 验的那个 sha（`e27174e`）说的；那个 sha 上连 provider 的在线映射文件都没提交，行为为空。工作树在 16:36 之后由 t26 修好，我按修好后的工作树补测三臂（见 S5），结论是**已成立**，但那是另一个状态，不能反过来改写"当时不成立"这个事实。

| 编号 | 问题 | 当时 | 现在（工作树） |
| --- | --- | --- | --- |
| **F1** | 上游 `source` 是 HTML（`<a>iPhone客户端</a>`），provider 映射未取 ⇒ 所有在线帖**都没有尾巴**；若取了但不清洗，又会把 HTML 当文本渲染 | 不成立 | 已修：`sourceFromMblog()`（`server/providers/weibo.mjs:238`）用同文件 `cleanText()` 清洗；三臂实测 ①原样 ②补「来自 」③缺失不渲染 |
| **F2** | `authorFromUser` 不读上游 `verified` ⇒ 在线帖**永远没有 V** | 不成立 | 已修：`...verified === true ? { verified: true } : {}`（严格判等，缺字段/0 均为 `undefined` 且不渲染；与 `VerifiedMark` 的 `verified !== true → null` 一致） |

**S4/S5 的通过只是 mock 模式（三臂除外）**：mock 的 30 条帖全都有 `source`、恰好 2 个作者 `verified=true`，所以 S4/S5 在 mock 下"必然"成立；它们证明的是"契约实现了"，不是"数据接通了"。数据接通由 F1/F2 负责，两类不能互相顶替。

---

## 5. 变异反证：**不成立**（这是判失败的第二条）

任务要求：把 CSS 里的 clamp 行数改错（6 → 0/2），`build` 后 `check-hit` 必须失败；恢复后必须全绿。

**做法**（全程在副本里，不动交付树）：`/tmp/verifier/t24/mutant/` 复制仓库（软链 node_modules），把 `src/styles/card.css` 的 `-webkit-line-clamp: var(--rill-clamp, …)` 改成 `2`，重建。

**变异确实生效**（不是"改了没效果"）：`p_0007` 实测 `clientHeight=56`（=2×28）、`scrollHeight=196`、`-webkit-line-clamp=2`，而生产树是 `168=6×28`。

**但仓库自带的 check-hit 照样全绿：**

```
变异树：RILL_BASE=4184 node scripts/check-hit.mjs  →  rc=0  PASS 39 / FAIL 0  ALL PASS
```

**原因**：`scripts/check-hit.mjs` 里**一处都没有**与折叠相关的断言——

```
grep -n "clamp\|clamped\|lineHeight\|clientHeight\|scrollHeight" scripts/check-hit.mjs  →  0 命中
```

它测的是坐标命中、路由、计数，**不测"正文折叠 6 行"**。所以对这条 A 的核心视觉契约，**这套测试是恒真的**，恰恰是任务要反证的那件事。

**补证：这条断言是写得出来的**（证明"缺口可修"，而不是"这事测不了"）。我在副本里加一份折叠基线 4 条断言后对同一变异树跑：

```
FAIL 折叠态正文 = 6 行 :: lines=2 (clientH=56, lineH=28)      ← 变异树
PASS 折叠态确实被截断 :: scrollH=196 > clientH=56
PASS 展开全文按钮存在且 ≥44 高 :: btn=48x44
PASS 折叠态图片限量 3 :: media=3
1 FAILED (rc=1)
```

对生产树跑同一脚本：

```
PASS 折叠态正文 = 6 行 :: lines=6 (clientH=168, lineH=28)
PASS 折叠态确实被截断 :: scrollH=252 > clientH=168
PASS 展开全文按钮存在且 ≥44 高 :: btn=48x44
PASS 折叠态图片限量 3 :: media=3
ALL PASS (rc=0)
```

恢复 CSS（`cp` 回原文件）、重建、重跑：

```
恢复后 check-hit → rc=0  PASS 39 / FAIL 0  ALL PASS
恢复后折叠基线   → ALL PASS
```

**结论**：变异 → 恢复的闭环本身是通的（恢复后确实回绿），**但"变异必须让 check-hit 失败"这一条不成立**。修法：把这 4 条折叠基线并入 `scripts/check-hit.mjs`（builder 在 t23 的变异反证里也是临时加了基线才失败的，正说明基线必须进仓库）。

---

## 6. 树完整性：**不成立**（判失败的第一条）

`node /tmp/verifier/t24/tree-integrity.mjs` 四条断言：

| 断言 | 结果 | 实测 |
| --- | --- | --- |
| `src/` 全部文件已提交（差集需逐一列出） | **FAIL** | 提交 33 / 磁盘 45，缺 12 个 |
| `git cat-file -e e27174e:src/data/api.ts` | **FAIL** | `fatal: path 'src/data/api.ts' exists on disk, but not in 'e27174e…'` |
| 提交版 `src/App.tsx` 引用在线模块 | **FAIL** | `api|Auth|Login` 命中 **0** |
| 绑定该 sha 的 CI run 结论 | PASS | run **43828855776**，`head_sha=e27174e`，`conclusion=success` |

**缺的 12 个文件（全部是在线前端）**：

```
src/auth/LoginPage.tsx        src/pages/OnlineTimeline.tsx
src/components/AccountChip.tsx    src/pages/OnlineDetail.tsx
src/components/VerifiedMark.tsx   src/pages/OnlineProfile.tsx
src/components/WriteSheet.tsx     src/pages/Search.tsx
src/data/api.ts               src/lib/source.ts
src/styles/auth.css           src/styles/daily.css
```

另有 `docs/deploy.md` 未跟踪，工作树合计 **25 个未跟踪 / 25 个已修改**（测量期间 t26 还在改，数量已上涨）。

**这意味着什么，说白一点**：`CI 绿` 是 `e27174e` 这个 sha 的证据，而那个 sha 的 `src/` **不含在线前端**。别人 clone 下来构建出来的，是一个**只能在离线模式跑**的版本；A 的三页改版（daily.css/tokens）也在未提交里。所以：**现在不能对外说"CI 绿通过验收"，也不能说"A 已交付"**——只能说"某个未提交的工作树在你机器上是这样"。

护栏变异（验证 CI 那条 guard 能不能真的抓到"忘了提交在线前端"）6 个场景全部符合预期：

```
A 纯净 clone（提交树，无 dist）        → FAIL ✓
B 有 dist 但 src/data/api.ts 未提交     → FAIL ✓
C 在线前端已提交 + dist 在位            → PASS ✓
D 删掉 src/data/api.ts                  → FAIL ✓
E 恢复 api.ts                            → PASS ✓
F git rm --cached 但文件仍在磁盘         → PASS（⚠ 抓不到）
F' git ls-files --error-unmatch         → FAIL ✓（这条能抓到）
```

⇒ 建议随 `src/` 全量提交一起落地的 guard 用 `F'` 的形态（索引态检查），而不是 `git ls-files` 的文件是否存在：

```yaml
- name: Guard - 在线路由必须真的在仓库里
  run: |
    git ls-files --error-unmatch src/auth/LoginPage.tsx src/data/api.ts
    grep -q 'login-input' dist/assets/*.js
```

---

## 7. 截图清单（`docs/shots/`，全部 PNG 尺寸校验 375×812 或 1440×900）

| 文件 | 用途 | 尺寸 | 字节 |
| --- | --- | --- | --- |
| `a-timeline-375-light.png` | 时间线 亮 | 375×812 | 42952 |
| `a-timeline-375-dark.png` | 时间线 暗 | 375×812 | 41521 |
| `a-detail-375-light.png` | 详情 亮 | 375×812 | 34146 |
| `a-detail-375-dark.png` | 详情 暗 | 375×812 | 33006 |
| `a-compose-375-light.png` | 发博 亮 | 375×812 | 13556 |
| `a-compose-375-dark.png` | 发博 暗 | 375×812 | 13014 |
| `a-longtext-folded-375.png` | 长文折叠（6 行 + 展开全文） | 375×812 | 58251 |
| `a-longtext-expanded-375.png` | 长文展开（14 行 + 9 图 3×3） | 375×812 | 73608 |
| `a-detail-longtext-375.png` | 详情长文（17/1.6 不折叠） | 375×812 | 25338 |
| `a-timeline-1440-light.png` | 1440 三栏 | 1440×900 | 64751 |

未做像素级人工审阅（本模型不支持读图）：所有视觉断言都走**几何/计算样式/CDP 量化**（`getBoundingClientRect`、`getComputedStyle`、`elementFromPoint`、文本节点对比度枚举、亮暗 PNG 逐像素 diff）。截图作为可复现产物留档，不承担"我眼睛看过"的角色。

---

## 8. 未验证 / 证据限度（不要把这些当已通过）

1. **真实 cookie 全链**（点赞→取消→评论→转发→发文字→发图）依旧没跑过，真实凭证从未进仓库；清单在 `server/test/real-cookie-checklist.md`。所有在线结论都基于**假上游**。
2. **Docker 镜像行为**只能在 CI runner 上证明；本机没有 docker。`e27174e` 那次 CI 的 docker job 通过（`Container smoke` 2s 退出 0 ⇒ 容器确实回了 `/api/health`），但日志与 artifact 匿名不可读（403/401），属于证据限度。
3. **在线详情页正常态**（假上游返回真实 `status`）我这次没打通——详情仍显示"内容没有加载出来"。所以"在线详情能正常渲染"这条**未验证**，只验证了它的两个错误态。
4. **AC-PF06 的探针路径**：`?probe=theme:dark` 在"已有存储主题"时会保持已存主题（我脚本踩到过）；真实路径（设置里点 `theme-toggle`）已验证通过。AC 断言本身在 fresh 流程下通过，不构成缺陷，但后来者写探针时要知道这个语义。

---

## 9. 修复项清单（按阻塞级别）

**P0（不修就等于没交付）**

1. **提交 `src/` 全量 + `docs/deploy.md`**，得到一个包含在线前端与 A 版式的 sha；然后在**该 sha 上**重跑本报告全部条目（命令见 §10）。
2. **把折叠基线并入 `scripts/check-hit.mjs`**（4 条：6 行 / 确实截断 / 展开按钮 ≥44 / 折叠态限量 3），使"clamp 改错 → check-hit 失败"真的成立。
3. **随提交落地 CI guard**（用 `git ls-files --error-unmatch` 版本，见 §6）——它防的正是这次的事。

**P1（契约口径，需 captain 裁决）**

4. **AC-G09**：给在线文件白名单，或把契约改成"离线路径不发起网络请求"＋运行时断言（我的套件已断言 `externalRequests=[]`）。
5. **AC-G11**：修正 §15 自检命令（去掉会把所有行滤掉的 `grep -v 'weibo-lite/'`），并按内容重新计数、在线文件单列例外。

**P2（观感/文案，可跟下一轮）**

6. **O1**：V 与昵称间距 6px → 3px（删掉 `margin-left:3px` 或用 `gap` 二选一）。
7. **O2**：详情页补 `RISK_CONTROL` 专文案。

---

## 10. 复跑命令（拿到新 sha 后照抄即可）

```bash
cd weibo-lite
NODE=…/node; PNPM=…/pnpm.mjs
$NODE $PNPM run check:mock
$NODE $PNPM exec tsc --noEmit
$NODE $PNPM run build
node scripts/check-hit.mjs                      # 期望 PASS 39 / FAIL 0（含折叠基线独立断言）
node /tmp/verifier/t24/tree-integrity.mjs       # 期望 4/4 pass
node /tmp/verifier/t24/ac-a.mjs                 # 49 行 AC 的 46 行套件（含断言明细）
node /tmp/verifier/t24/a-visual2.mjs            # 6 张 375 + 几何/对比度/遮挡/9 宫格/1440
node /tmp/verifier/t24/dark-audit.mjs           # 暗色逐文本节点对比度
node /tmp/verifier/t24/t24-modes.mjs            # 离线基线 + 在线 AUTH_EXPIRED/RISK_CONTROL
node /tmp/verifier/t24/t24-f1f2.mjs             # F1/F2/C2 三臂
node /tmp/verifier/t24/fold-baseline.mjs        # 折叠基线 4 条（建议并入 check-hit）
```

**一句话收尾**：A 的视觉契约这次是真的落地了（S1/S2/S3/S6/S7/S8 成立、S4 一条 3px 偏差、S5 静态+两臂成立），回归也没坏（46 行 + G12 全过）；但**这棵树还不是可交付物**——12 个在线前端文件没提交，CI 绿绑在一个没有在线前端的 sha 上，而"变异反证"恰恰证明了现有测试对 A 的核心契约是恒真的。**在补完 §9 的 P0 三条之前，这份报告不能作为"通过"的依据。**