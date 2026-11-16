# A · 日报 Rill Daily · 落地交接规范（final-spec）

> 用户已选 A（`docs/ui-proposals/direction-approved.md`）。这份文件是**给 builder 照抄的**，不是再讲一遍设计故事。
> 权威原型：`A/index.html`（三屏 + 1440）。所有数值来自原型的实测（对比度/字号/几何），不是估算。
> 与 `docs/spec.md` 的关系：数据契约、路由、testid、49 条 AC **全部不变**（A 是唯一零结构冲突方向）；本文件只覆盖"长什么样、怎么排"。

## 1. 变量块（可直接粘贴）

`src/styles/tokens.css` 的替换内容（亮色）：

```css
:root {
/* —— 颜色（替换 design.md 的 19 个亮色 token，见 tokens.md §1）—— */
  --rill-bg: #FFFFFF; --rill-surface: #FFFFFF; --rill-surface-2: #F1F1EE; --rill-surface-3: #E2E2DE;
  --rill-border: #D6D6D1; --rill-border-strong: #0B0B0B;
  --rill-text: #0B0B0B; --rill-text-2: #46473F; --rill-text-3: #67685F;
  --rill-accent: #C22F1C; --rill-accent-pressed: #97210F; --rill-accent-soft: #FBE9E6; --rill-on-accent: #FFFFFF;
  --rill-like: #C22F1C; --rill-danger: #A52A1B;
  --rill-overlay: rgba(11, 11, 11, .44); --rill-toast-bg: #0B0B0B; --rill-toast-text: #FFFFFF; --rill-focus: #C22F1C;
  /* —— 字阶（15 → 16：移动端正文红线；新增 display 62）—— */
  --rill-fs-11: 12px; --rill-fs-13: 13px; --rill-fs-15: 16px; --rill-fs-17: 17px; --rill-fs-20: 20px; --rill-fs-24: 24px;
  --rill-fs-display: 62px; --rill-fs-num: 25px;
  --rill-lh-tight: 1.4; --rill-lh-normal: 1.75; --rill-lh-relaxed: 1.85;
  --rill-fw-regular: 400; --rill-fw-medium: 500; --rill-fw-semibold: 650;
  /* —— 间距（沿用 12 档，仅把 20 变成版面的 gutter）—— */
  --rill-space-2: 2px; --rill-space-4: 4px; --rill-space-6: 6px; --rill-space-8: 8px; --rill-space-12: 12px;
  --rill-space-16: 16px; --rill-space-20: 20px; --rill-space-24: 24px; --rill-space-32: 32px;
  /* —— 圆角 / 阴影（全部归零：报纸没有圆角）—— */
  --rill-radius-4: 0; --rill-radius-8: 0; --rill-radius-12: 0; --rill-radius-16: 0; --rill-radius-20: 0; --rill-radius-full: 0;
  --rill-border-w: 1px; --rill-shadow-1: none; --rill-shadow-2: none; --rill-shadow-3: 0 16px 40px rgba(11,11,11,.18);
  /* —— 结构尺寸 —— */
  --rill-gutter: 20px; --rill-header-h: 46px; --rill-tabbar-h: 56px; --rill-hit: 44px;
  --rill-card-pad-y: 14px; --rill-card-pad-x: 20px; --rill-media-gap: 1px; --rill-line-clamp: 6;
  --rill-textarea-min: 168px; --rill-compose-bar-h: 56px; --rill-avatar: 36px; --rill-avatar-sm: 28px;
}
```

暗色（`html[data-theme="dark"]`，22 条覆写；`theme` 仍按 spec §4.5 存 `rill:v1:theme`）：

```css
html[data-theme="dark"] {
--rill-bg:#0C0C0C; --rill-surface:#121212; --rill-surface-2:#1A1A19; --rill-surface-3:#242422;
  --rill-border:#333331; --rill-border-strong:#EDEDED;
  --rill-text:#EDEDED; --rill-text-2:#B4B4AE; --rill-text-3:#8E8E86;
  --rill-accent:#FF6B4A; --rill-accent-pressed:#FF8A6E; --rill-accent-soft:#2A1612; --rill-on-accent:#0C0C0C;
  --rill-like:#FF6B4A; --rill-danger:#FF7A6B; --rill-overlay:rgba(0,0,0,.62);
  --rill-toast-bg:#EDEDED; --rill-toast-text:#0C0C0C; --rill-focus:#FF6B4A;
  --rill-statbar-bg:#EDEDED; --rill-statbar-fg:#0C0C0C; --rill-statbar-label:#4A4A44;
  --rill-pub-bg:#EDEDED; --rill-pub-fg:#0C0C0C;
  --rill-shadow-3:0 16px 40px rgba(0,0,0,.55);
}
```

### 1.1 新增的三个成对变量（这是 A 的关键，别改回写死色值）

| 变量 | 亮色 | 暗色 | 用途 |
| --- | --- | --- | --- |
| `--rill-statbar-bg` / `-fg` / `-label` | #0B0B0B / #FFFFFF / #C9C9C4 | #EDEDED / #0C0C0C / #4A4A44 | 底部读数条：亮色是黑底白字，暗色自动反相成浅块 |
| `--rill-pub-bg` / `-fg` | #0B0B0B / #FFFFFF | #EDEDED / #0C0C0C | 发布块 |
| `--rill-vm-size`（建议新增） | 13px | 13px | 认证标记边长 |
| `--rill-fs-detail`（**必须新增**） | 17px | 17px | 详情长文正文（`spec.md §7` 已定 17/1.6，token 阶缺这一档） |
| `--rill-lh-detail`（**必须新增**） | 1.6 | 1.6 | 同上 |

> 反相用的是成对变量而不是 `#fff`：实测过写死 `#fff` 的版本，暗色下读数条会变成白底白字（1.01:1）。

## 2. 五页 DOM 骨架（class + 语义 + testid）

### 2.1 时间线 `#/timeline`
```html
<div class="app" data-route="timeline">
  <header class="mast">           <!-- 报头：刊名 + 关注/推荐 -->
    <span class="mast__name">溪流</span><span class="mast__en">RILL</span>
    <nav class="mast__tabs" data-testid="feed-tab"><a data-selected="true">关注</a><a>推荐</a></nav>
  </header>
  <div class="dateline"><b>11.16</b><em>星期一 · 关注</em></div>   <!-- 日期头条：62px，唯一的 display 级字号 -->
  <main class="feed">
    <article class="card" data-card data-post-id="p_0002">
      <div class="card__head" data-testid="post-author">   <!-- 作者行：昵称 · V · handle · 时间 · 来源 -->
        <span class="card__who">林见</span><span class="vm" data-verified="true">✓</span>
        <span class="card__en">linjian</span><span class="card__time">10:59</span>
        <span class="card__src" data-source>来自 iPhone 15 Pro</span>
      </div>
      <p class="body" data-testid="post-text" data-clamped="6">…</p>
      <button class="more" data-testid="expand-text" hidden>展开全文</button>
      <div class="figs" data-n="9" data-testid="post-media">9 × .ph</div>
      <div class="quote">…转发引用（rail 2px + 原博计数）…</div>
      <div class="counts" data-testid="post-counts">3 × button + b</div>
    </article>
  </main>
  <div class="statbar">   <!-- 375 只留两项；≥900 整条不渲染（右栏「今日读数」替代） -->
    <div><b>30</b><i>条</i></div><div><b>100</b><i>图</i></div>
  </div>
  <nav class="tabbar">4 × a</nav>
</div>
```

### 2.2 详情 `#/status/:id`
```html
<div class="app" data-route="detail">
  <div class="dtop"><a>← 时间线</a><h1>详情<em>detail</em></h1></div>
  <div class="dbody">
    <div class="card__head" data-testid="detail-author">…同作者行（含 V 与来源）…</div>
    <p class="body" data-testid="post-text">…（详情不截断、不带 data-clamped）…</p>
    <div class="quote" data-testid="repost-quote">…若该条是转发…</div>
    <div class="counts big" data-testid="post-counts">…</div>
  </div>
  <div class="replies" data-testid="reply-list">
    <div class="replies__h">回复 · N 条</div>
    <div class="reply"><div class="reply__n">01</div>…</div>   <!-- 编号中性墨色，不用红 -->
  </div>
  <form class="cbar"><input data-testid="reply-input">…</form>
</div>
```

### 2.3 发博 `#/compose`
```html
<div class="app" data-route="compose">
  <div class="dtop"><a>放弃</a><h1>新的一版<em>compose</em></h1></div>
  <textarea class="paper" data-testid="compose-text"></textarea>   <!-- 稿纸：横线底纹 -->
  <div class="slots" data-n="0..9" data-testid="compose-media">9 × .slot</div>
  <button class="chip" data-topic>#雨后散步#</button>
  <div class="pubbar"><span class="count">0 / 2000 · 0 张图</span><button class="pub" data-testid="publish">发布</button></div>
</div>
```
> **注意**：`发布` 按钮里**不要**再放任何数字（原型里曾有 `<span>0.0</span>`，被视觉终审判为 bug，已删）。字数只在左侧 `.count` 出现一次。

### 2.4 我的 `#/me`
```html
<div class="app" data-route="me">
  <div class="me__head">头像(36) · 昵称 · V · handle · bio</div>
  <div class="me__nums"><div><b>12</b><i>博文</i></div><div><b>86</b><i>关注</i></div><div><b>240</b><i>粉丝</i></div></div>
  <nav class="seg"><a data-selected="true">我的博文</a><a>我赞过的</a></nav>
  <main class="feed">同时间线卡片</main>
</div>
```

### 2.5 设置 sheet
```html
<dialog class="sheet" data-testid="settings">
  <h2>设置</h2>
  <label class="row"><span>深色</span><input type="checkbox" name="theme"></label>
  <label class="row"><span>减少动效</span><input type="checkbox" name="reduced"></label>
  <button class="ghost">关闭</button>
</dialog>
```
> 关闭态必须 `.sheet:not([open]){display:none}`（t7 踩过的坑：`.sheet{display:block}` 会压过 UA 规则）。

## 3. 七种状态（每种都要有，别只做 happy path）

| 状态 | 触发 | 视觉（A 的语言） | 断言建议 |
| --- | --- | --- | --- |
| 加载 | 首屏 fetch | 三行 1px 墨线 + 62px 日期占位闪烁（不是 spinner 圆环） | `[data-state="loading"]` |
| 空 | 关注流 0 条 | 「今天的版面上还空着」+ 细线框 + 「去写一条」 | `[data-state="empty"]` |
| 错误 | fetch 失败 | 墨线框 + 一行原因 + 「重试」（无红色，报纸不喊） | `[data-state="error"]` |
| 离线 | `navigator.onLine=false` | 报头下方 1px 黑条：`离线 · 显示本地存档` | `[data-state="offline"]` |
| 在线 | 恢复 | 黑条消失，报头右角瞬现 `已恢复` | 无残留条 |
| cookie 过期 | 401 | 全屏 sheet：「凭证过期，请重新登录」+ 单按钮 | `[data-state="auth"]` |
| 风控/限速 | 429 | 底部 toast（黑底白字）+ 计数不动，**不发假成功** | `[data-state="throttled"]` |

## 4. 断点与栅格

| 断点 | 栅格 | 关键尺寸 |
| --- | --- | --- |
| ≤767（375 基准） | 单列，报头 46 + 日期块 + feed + 读数条 2 项 + tabbar 56 | 边距 20；正文 16/1.75；卡片无圆角无阴影 |
| 768–899 | 640 列居中（spec §4.5 不变），读数条仍在 feed 下 | 与 375 同构，只是居中 |
| ≥900（1440 基准） | **三栏**：300 日期栏 / 640 双列卡 / 260 右栏 | 日期栏 96px 日期；feed 内读数条**隐藏**（右栏「今日读数」替代）；卡片双列 gap 20 |

```css
.app { display: flex; flex-direction: column; }
.app > * { flex: 0 0 auto; }          /* 踩过：不加这行 tabbar 会被压到 19px、feed 变 0 */
.feed { flex: 1 1 auto; min-height: 0; overflow: hidden; }
.side { display: none; }              /* 踩过：放进 @container 块里 → 375 也渲染，侧栏 770 高把 feed 挤没 */
@container (min-width: 900px) { .side { display: block; } }
```

## 5. 动效

| 动作 | 时长 / 曲线 | 细节 |
| --- | --- | --- |
| 点赞 | 120ms `ease` | 数字跳一档 + 朱红填心（`--rill-accent`），无弹跳 |
| 展开全文 | 180ms `ease` | 高度过渡，`prefers-reduced-motion` 下瞬时 |
| 发博 toast | 180ms 入 / 120ms 出 | 黑底白字，1 行，位置 tabbar 上方 12 |
| 路由切换 | 120ms 淡入 | 不做位移（报纸翻页感靠版面不靠动画） |

## 6. 迁移成本复核（实测，非估算）

| 项 | 量 |
| --- | --- |
| 变动 token | 84 个 `--rill-*` 里 **替换 34**、**沿用 42**、**弃用 0**、**新增 3**（成对反相变量），逐项对照见 §10 |
| `tokens.css` | 约 70 行（亮 45 + 暗 22 + 新增 3） |
| 组件层 CSS | **186 行**（原型 `<style>` 非空 203 行 − tokens 段 17 行） |
| 要改的 JS | **0 行**（A 是纯视觉替换；DOM 语义与 testid 全不变） |
| 要改的 spec | **既有结构 0 处**（作者行顺序、字段契约、49 条 AC 全不动）；**新增三样的规则**要进 spec，粘贴稿见 §9 |
| 风险 | 低。唯一需要注意的是「圆角/阴影归零」会让 `design.md §2.4` 的"卡片是唯一有阴影的层"失效 —— 那句话要改写 |

## 7. 与 spec / AC 的对齐

- **零结构冲突**（说的是不推翻既有结构，不是说 spec 一个字不动 —— 见 §9 那三条新规则）：作者行 / 正文 6 行截断 / 1–9 图格 / 转发引用 / 计数行 / 回复，六件套位置与 spec §4.2 一致。
- `data-clamped="6"` 在时间线保留、详情不带（AC-DT01 依赖这个区别）。
- 认证用 `data-verified="true"`、来源用 `data-source`：**布尔与字符串分开**，不要合成一个字段。
- 9 图必须完整可见（3×3），**不允许** `+N` 折叠（captain 判决）。

## 8. 还没画实的三样（等 t21 数据，DOM 已留锚点）

| 项 | 现状 | 需要 t21 的什么 | 落地动作 |
| --- | --- | --- | --- |
| 长文折叠（6 行 + `展开全文` + 展开态） | DOM/CSS 已留（`.body[data-clamped="6"]` + `.more`），**但 mock 里最长 28 字，看不出折叠** | `p_0007` 改成 ≥140 字 | 无需改 CSS，只换数据；展开态靠 `.body` 去 clamp |
| 认证标识 | `.vm` 小方框已画（13px、与名字同色、方框里一个对勾，不是贴纸） | `users[].verified`（2 个 true） | `.vm` 由 `data-verified` 驱动 |
| 客户端尾巴 | `.card__src` 已画（作者行右端 12px 灰字「来自 iPhone 15 Pro」） | `statuses[].source` | 由 `data-source` 渲染 |

> 三样的**视觉决定已经定了**（不是待议）：V 放昵称右 3px、与昵称同色同字号 13px 方框；来源放作者行最右、12px、`--rill-text-3`；长文折叠在 6 行，`展开全文` 单独一行、12px、下划线、不加按钮底色。

## 9. 给 builder：三条要抄进 `spec.md` 的新规则（粘贴稿）

captain 的裁定：A 的"0 处改动"指**结构冲突 0**（作者行顺序、字段契约不动），但**新增三样的规则必须进 spec**，否则下一个人不知道阈值是 6 行还是 4 行。建议插在 `§4.2 卡片结构表` 之后，编号交 builder 定。

| 规则 | 内容 | 可机械复验的判据 |
| --- | --- | --- |
| 长文折叠 | 卡片正文 `-webkit-line-clamp: 6` + `data-clamped="6"`；**判据用「`scrollHeight > clientHeight`」而不是字符数阈值**，成立时渲染「展开全文」；点击后**仅本条**去掉 clamp、按钮文案变「收起」、`data-expanded="true"`。**详情页不折叠**（不带 `data-clamped`，这是 AC-DT01 的判据） |
| 折叠态图片 | **限量而不是隐藏**：折叠态最多一行 **3 张**（`.figs{grid-template-columns:repeat(3,1fr)}`，`nth-child(n+4)` 不渲染）；**只有当「3 张 + 6 行正文」仍导致 feed 裁切或正文被挤时才降到 1 张封面**（实测 16:9 比 1:1 省空间，取 16:9）。**短帖不砍**：若全部图片本来放得下（如 32 字 + 9 图，实测卡高 521 < feed 624），照常显示全部 9 图。展开态一律全量 3×3 | `[data-clamped="6"]` 存在且 `data-expanded` 缺省；点「展开全文」后 `data-expanded="true"` 且该条 `scrollHeight === clientHeight` |
| 认证标识 | `users[].verified === true` 时，昵称**右侧 3px** 渲染 13×13 方框 + 对勾，颜色 `currentColor`（与昵称同色，**不得用黄色/品牌色**）；`data-verified="true"` + `aria-label="已认证"` | 作者行 `[data-verified="true"]` 数量 = 该帖作者 verified 值；方框 `getBoundingClientRect()` 宽高 = 13 |
| 客户端来源 | `statuses[].source` 非空时渲染在**作者行最右端**（`margin-left:auto`）、12px、`--rill-text-3`、`data-source`、`white-space:nowrap`；为空则不渲染该节点 | 作者行高度仍 = 22px（单行）；`[data-source]` 文本 === mock 的 `source` |

> 折叠态的段落间隙要归零（`.card[data-longtext]:not([data-expanded]) .body .para + .para{margin-top:0}`），否则 `clientHeight` 会是 `6 × line-height + 段落间隙`（实测带 10px 间隙时是 188 = 168 + 20，会对不上判据）。

> 判据都**不依赖看图**：DOM 属性 / 几何尺寸 / 文本相等。

## 10. token 映射表（84 个 `--rill-*` ↔ A 定稿）

> 与 `tokens.md` 同一份数据，这里合到一处方便 builder 一次查完。状态含义：**替换**=名字不变、值改；**沿用**=值不变；**弃用**=A 不再用这个 token（组件里删引用）。


### 1. 颜色（19 项，亮色）
| token | design.md | A 定稿 | 状态 |
| --- | --- | --- | --- |
| `--rill-bg` | #0D1312 | #FFFFFF | 替换 |
| `--rill-surface` | #151D1C | #FFFFFF | 替换 |
| `--rill-surface-2` | #1E2826 | #F1F1EE | 替换 |
| `--rill-surface-3` | #293431 | #E2E2DE | 替换 |
| `--rill-border` | #25302E | #D6D6D1 | 替换 |
| `--rill-border-strong` | #66756F | #0B0B0B | 替换 |
| `--rill-text` | #E9EFED | #0B0B0B | 替换 |
| `--rill-text-2` | #A6B3AF | #46473F | 替换 |
| `--rill-text-3` | #859490 | #67685F | 替换 |
| `--rill-accent` | #4ADFC1 | #C22F1C | 替换 |
| `--rill-accent-pressed` | #6FE7CE | #97210F | 替换 |
| `--rill-accent-soft` | #123330 | #FBE9E6 | 替换 |
| `--rill-on-accent` | #06201B | #FFFFFF | 替换 |
| `--rill-like` | #FF7B72 | #C22F1C | 替换 |
| `--rill-danger` | #FF7A6B | #A52A1B | 替换 |
| `--rill-overlay` | rgba(0, 0, 0, .62) | rgba(11, 11, 11, .44) | 替换 |
| `--rill-toast-bg` | #E9EFED | #0B0B0B | 替换 |
| `--rill-toast-text` | #111A19 | #FFFFFF | 替换 |
| `--rill-focus` | #4ADFC1 | #C22F1C | 替换 |

### 3. 字族与字阶（14 项）
| token | design.md | A 定稿 | 状态 |
| --- | --- | --- | --- |
| `--rill-font` | -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif | 同 design.md（系统栈） | 沿用 |
| `--rill-fs-11` | 11px | 12px | 替换 |
| `--rill-fs-13` | 13px | 13px | 沿用 |
| `--rill-fs-15` | 15px | 16px | 替换 |
| `--rill-fs-17` | 17px | 17px | 沿用 |
| `--rill-fs-20` | 20px | 20px | 沿用 |
| `--rill-fs-24` | 24px | 24px | 沿用 |
| `--rill-lh-tight` | 1.35 | 1.4 | 替换 |
| `--rill-lh-normal` | 1.5 | 1.75 | 替换 |
| `--rill-lh-relaxed` | 1.6 | 1.85 | 替换 |
| `--rill-fw-regular` | 400 | 400 | 沿用 |
| `--rill-fw-medium` | 500 | 500 | 沿用 |
| `--rill-fw-semibold` | 600 | 650 | 替换 |
| `--rill-tracking-tight` | -0.01em | -0.045em | 替换 |

### 4. 间距（12 项）
| token | design.md | A 定稿 | 状态 |
| --- | --- | --- | --- |
| `--rill-space-2` | 2px | 2px | 沿用 |
| `--rill-space-4` | 4px | 4px | 沿用 |
| `--rill-space-6` | 6px | 6px | 沿用 |
| `--rill-space-8` | 8px | 8px | 沿用 |
| `--rill-space-12` | 12px | 12px | 沿用 |
| `--rill-space-16` | 16px | 16px | 沿用 |
| `--rill-space-20` | 20px | 20px | 沿用 |
| `--rill-space-24` | 24px | 24px | 沿用 |
| `--rill-space-32` | 32px | 32px | 沿用 |
| `--rill-space-40` | 40px | 40px | 沿用 |
| `--rill-space-48` | 48px | 48px | 沿用 |
| `--rill-space-64` | 64px | 64px | 沿用 |

### 5. 圆角 · 描边 · 阴影（10 项）
| token | design.md | A 定稿 | 状态 |
| --- | --- | --- | --- |
| `--rill-radius-4` | 4px | 0 | 弃用（归零） |
| `--rill-radius-8` | 8px | 0 | 弃用（归零） |
| `--rill-radius-12` | 12px | 0 | 弃用（归零） |
| `--rill-radius-16` | 16px | 0 | 弃用（归零） |
| `--rill-radius-20` | 20px | 0 | 弃用（归零） |
| `--rill-radius-full` | 999px | 0 | 弃用（归零） |
| `--rill-border-w` | 1px | 1px | 沿用 |
| `--rill-shadow-1` | 0 1px 2px rgba(0, 0, 0, .40) | none | 弃用（归零） |
| `--rill-shadow-2` | 0 6px 20px rgba(0, 0, 0, .48) | none | 弃用（归零） |
| `--rill-shadow-3` | 0 16px 40px rgba(0, 0, 0, .56) | 0 16px 40px rgba(11,11,11,.18) | 替换 |

### 6. 动效 · 层级（10 项）
| token | design.md | A 定稿 | 状态 |
| --- | --- | --- | --- |
| `--rill-dur-fast` | 120ms | 120ms | 沿用 |
| `--rill-dur-base` | 180ms | 180ms | 沿用 |
| `--rill-dur-slow` | 240ms | 240ms | 沿用 |
| `--rill-ease` | cubic-bezier(.2, .8, .2, 1) | cubic-bezier(.2, .8, .2, 1) | 沿用 |
| `--rill-ease-spring` | cubic-bezier(.34, 1.4, .64, 1) | cubic-bezier(.34, 1.4, .64, 1) | 沿用 |
| `--rill-z-sticky` | 10 | 10 | 沿用 |
| `--rill-z-tabbar` | 20 | 20 | 沿用 |
| `--rill-z-overlay` | 30 | 30 | 沿用 |
| `--rill-z-dialog` | 40 | 40 | 沿用 |
| `--rill-z-toast` | 50 | 50 | 沿用 |

### 7. 结构尺寸（19 项）
| token | design.md | A 定稿 | 状态 |
| --- | --- | --- | --- |
| `--rill-content-max` | 640px | 640px | 沿用 |
| `--rill-gutter` | 16px | 20px | 替换 |
| `--rill-header-h` | 52px | 46px | 替换 |
| `--rill-tabbar-h` | 56px | 56px | 沿用 |
| `--rill-hit` | 44px | 44px | 沿用 |
| `--rill-avatar` | 40px | 36px | 替换 |
| `--rill-avatar-sm` | 32px | 28px | 替换 |
| `--rill-avatar-lg` | 64px | 64px | 沿用 |
| `--rill-icon` | 24px | 24px | 沿用 |
| `--rill-icon-sm` | 18px | 18px | 沿用 |
| `--rill-card-pad-y` | 12px | 14px | 替换 |
| `--rill-card-pad-x` | 16px | 20px | 替换 |
| `--rill-media-gap` | 4px | 1px | 替换 |
| `--rill-media-ratio` | 16 / 9 | 16 / 9 | 沿用 |
| `--rill-line-clamp` | 6 | 6 | 沿用 |
| `--rill-textarea-min` | 168px | 168px | 沿用 |
| `--rill-compose-bar-h` | 56px | 56px | 沿用 |
| `--rill-sheet-max-h` | 82vh | 82vh | 沿用 |
| `--rill-sheet-w` | 480px | 480px | 沿用 |

## 11. 与 `spec.md` 的差异（必须逐条列，不能只说"零冲突"）

A 的**结构冲突是 0**（作者行 / 正文 6 行 / 1–9 图格 / 转发引用 / 计数行 / 回复，六件套顺序与字段契约都不动）。但定稿后有 **6 处口径差异**，落地时必须逐条处理：

| # | spec 现在怎么写 | A 定稿怎么写 | 处理 |
| --- | --- | --- | --- |
| D-1 | 读数条四项（条/人/回复/图） | 375 只留**两项**（30 条 / 100 图）；1440 整条移到右栏 | 改 spec 的读数条条目；`data-post-count` 等断言不受影响 |
| D-2 | 卡片正文 `line-clamp: 6`（`-webkit-line-clamp: 6`）；图片无规定 | 同 6 行；**折叠态限量图片（≤3 张一行，实测放不下时降 1 张封面），展开态全量 3×3** | 规则见 §9「长文折叠」。注：t22 曾定「折叠态不渲染图格」，**已被 t25 取代**（那条会让带图博文在 feed 里变成纯文字，改变产品语义） |
| D-3 | 详情正文 15px / 1.5（`--rill-fs-15`） | 详情长文 **17px / 1.6**（`dbody--long`） | **裁决已定：新增 `--rill-fs-detail: 17px` + `--rill-lh-detail: 1.6`，保持 17px**（`spec.md §7` 本来就写 17/1.6，是 token 阶缺档、不是设计要改）。**不要**让 builder 自己猜，也不要既写 17 又用 15 的 token |
| D-4 | 回复编号无规定（实现用 `--rill-accent`） | **中性墨色** `--rill-text-3`，红只留可点动作 | 补一句"编号不得使用强调色" |
| D-5 | 认证无规定 | 昵称右 3px、13×13、`currentColor`、`data-verified` | 见 §9 |
| D-6 | `Detail.tsx:186` 硬编码 `来自 溪流` | 渲染 `post.source ?? '来自 溪流'`，位置=作者行最右 | **`source` 的渲染点有两处**：时间线卡片作者行 + 详情页作者行（现在详情页是硬编码，需替换）；字段本身是**可选**（`Post.source?: string`、`Author.verified?: boolean`） |

## 12. 七种状态的落地

| 状态 | 截图 | 实现 |
| --- | --- | --- |
| 空 | `shots/timeline-375-states.png` 左 | `.state` + `.box`（1px 墨线框）+ 「去写一条」按钮 |
| 错误 | 同上 中 | 同上，文案换「这一版没拿到 / 重试」 |
| 离线 | 同上 右 | 顶部 30px 反相条（黑底白字 12px）+ 同款 `.state` |
| 在线恢复 | 无新图 | 复用现有 toast（黑底白字），条消失 |
| 加载中 | 无新图 | 复用现有骨架（三行 1px 墨线），不新增组件 |
| cookie 过期 | 无新图 | 复用 `.sheet`（settings sheet 同款容器），标题换文案 |
| 风控 429 | 无新图 | 复用 toast；**计数不动**，不假装成功 |
