# 溪流（Rill）视觉规范 —— tokens / 布局 / 自制图标 / 交互反馈

> 任务：[T2] 视觉规范 · 产出者：designer · 上游依据：`weibo-lite/docs/spec.md`（T2 规格，已验收）+ `capability-inventory.md`（T0）
> 下游消费者：builder（T3 骨架 / T4 UI）、verifier（T5 截图与断言）
> 本文与 spec 的分工：**spec 定"要有哪些节点、哪些交互、怎么断言"；本文定"这些节点长什么样、多大、用什么颜色"**。冲突时：结构/字段/testid 以 spec 为准，颜色/字阶/尺寸变量以本文为准（spec §4.7 已写明这条优先级）。
> 全部自制：**不引用任何图标库、字体 CDN、UI 组件库**；所有图标是本文件里自带 `path` 的 inline SVG，所有颜色是本文件里自带值的 CSS 变量。

---

## 1. 三条纪律

| # | 纪律 | 原因 |
| --- | --- | --- |
| 1 | **首帧即真内容，不做骨架屏、不做遮罩层** | captain 的硬约束：`#app` 上的 `data-post-count` / `data-scroll-restored` / `data-probe-applied` 必须在首帧可读；骨架屏或全屏遮罩会把 node 挡住（`--dump-dom` 读到的是遮罩而不是卡片），验收会假失败 |
| 2 | **一套 class 切主题，不依赖 `prefers-color-scheme`** | 验收要能强制切换：`html[data-theme="dark"]` 与 `html.theme-dark` 等价，任选其一；`prefers-color-scheme` 只用于"从没选过主题"时的初始值（见 §3.2），绝不定于运行时 |
| 3 | **装饰让位于信息密度** | 单列信息流，视觉主角是正文与作者；不用渐变、不用玻璃拟态、不用大圆角卡片、不用投影堆叠。阴影只用于**浮层**（toast / dialog / tabbar），列表卡片只靠分隔线 |

**风格定位**：主流信息流产品的"安静版"——中性暖灰底 + 白卡片 + 单一墨绿强调色（呼应"溪流"的水色），层级只靠**字号/字重/灰阶**三件事，不靠色块。

---

## 2. Design tokens

> 落地文件：`src/styles/tokens.css`（**只放变量，不放选择器规则**）；§2.6 的代码块可整段复制。
> 命名统一前缀 `--rill-`，避免与将来任何库冲突。**每个 token 都在 §2.1–§2.6 给出名字与值**。

### 2.1 颜色（亮 / 暗两套，值可逐项核对；括号内为实测对比度）

| token | 亮色值 | 暗色值 | 用途 | 实测对比度（亮 / 暗） |
| --- | --- | --- | --- | --- |
| `--rill-bg` | `#F5F7F6` | `#0D1312` | 页面底色（列表容器/详情/发博/我的） | — |
| `--rill-surface` | `#FFFFFF` | `#151D1C` | 卡片、顶栏、tabbar、sheet 的底 | — |
| `--rill-surface-2` | `#EDF2F0` | `#1E2826` | 二级底：转发引用块、话题 chip、段控件槽、图占位衬底 | — |
| `--rill-surface-3` | `#E1E7E4` | `#293431` | 三级底：禁用按钮、分割条纹、拖拽把手 | — |
| `--rill-border` | `#E0E5E2` | `#25302E` | 分隔线（装饰级，无最低对比要求） | 1.27 / 1.26 |
| `--rill-border-strong` | `#828D88` | `#66756F` | **输入框/按钮描边**（非文本 UI 边界，需 ≥3:1） | 3.43 / 3.54 |
| `--rill-text` | `#111A19` | `#E9EFED` | 正文、标题 | **17.71 / 14.73** |
| `--rill-text-2` | `#48564F` | `#A6B3AF` | 次要信息：昵称旁 `@handle`、说明、引用块作者 | **7.72 / 7.91** |
| `--rill-text-3` | `#5F6F69` | `#859490` | 三级信息：时间戳、计数数字、占位提示 | **5.30 / 5.42**（在 `surface-2` 上 4.68 / 4.79） |
| `--rill-accent` | `#0B6E60` | `#4ADFC1` | 强调：链接、选中 tab、段控件选中、focus ring | **6.15 / 10.30** |
| `--rill-accent-pressed` | `#08574C` | `#6FE7CE` | 强调色按压态 | — |
| `--rill-accent-soft` | `#E1F2EE` | `#123330` | 强调底：选中 chip、发布按钮 hover 底 | `accent` 在其上 **5.31 / 8.18** |
| `--rill-on-accent` | `#FFFFFF` | `#06201B` | 强调底上的文字（发布按钮） | 6.15 / 10.26 |
| `--rill-like` | `#B94237` | `#FF7B72` | 已赞态的心形与数字 | **5.39 / 6.80** |
| `--rill-danger` | `#B03A2E` | `#FF7A6B` | 错误文案、「清空本地数据」 | **6.02 / 6.74** |
| `--rill-overlay` | `rgba(9,15,14,.44)` | `rgba(0,0,0,.62)` | dialog/sheet 的遮罩 | — |
| `--rill-toast-bg` | `#152221` | `#E9EFED` | toast 底（亮色下深底、暗色下浅底，保证"浮起来"） | `toast-text` 在其上 **15.02 / 15.21** |
| `--rill-toast-text` | `#F2F6F4` | `#111A19` | toast 文字 | 同上 |
| `--rill-focus` | `#0B6E60` | `#4ADFC1` | `:focus-visible` 描边 | 6.15 / 10.30 |

> 全部数字来自实测（脚本按 WCAG 2.1 相对亮度公式算，见 §9）。规则：**正文/次要/三级文本 ≥4.5:1；非文本 UI 边界（输入框描边、focus ring）≥3:1**。不达标的组合一律不进页面。

### 2.2 字族与字阶

| token | 值 | 用途 |
| --- | --- | --- |
| `--rill-font` | `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif` | 全站唯一字族；**无 web font、无 `@font-face`、无 CDN** |
| `--rill-fs-11` | `11px` | tabbar 标签、极少量角标 |
| `--rill-fs-13` | `13px` | 时间戳、`@handle`、计数数字、说明、toast 文案 |
| `--rill-fs-15` | `15px` | **卡片正文、回复正文、列表主文案**（移动端基准） |
| `--rill-fs-17` | `17px` | 详情页正文、顶栏标题、发博输入区、我的页昵称 |
| `--rill-fs-20` | `20px` | 页面级标题（"时间线"/"详情"/"发博"/"我的"在宽屏时） |
| `--rill-fs-24` | `24px` | 空态标题、大数字（我的页统计值在宽屏时） |
| `--rill-lh-tight` | `1.35` | 标题 |
| `--rill-lh-normal` | `1.5` | 卡片正文（配合 6 行截断） |
| `--rill-lh-relaxed` | `1.6` | 详情正文（长文阅读） |
| `--rill-fw-regular` | `400` | 正文 |
| `--rill-fw-medium` | `500` | 昵称、计数、按钮 |
| `--rill-fw-semibold` | `600` | 标题、发布按钮 |
| `--rill-tracking-tight` | `-0.01em` | 20/24px 标题（中文不打散） |

**用法映射**：卡片昵称 `15/500`；`@handle` 与时间 `13/400` + `--rill-text-3`；卡片正文 `15/400/1.5`；详情正文 `17/400/1.6`；回复正文 `15/400/1.5`；计数数字 `13/500` + `--rill-text-3`（已赞时 `--rill-like`）。

### 2.3 间距（4 的倍数，按像素命名，不做语义别名）

| token | 值 | token | 值 | token | 值 |
| --- | --- | --- | --- | --- | --- |
| `--rill-space-2` | `2px` | `--rill-space-12` | `12px` | `--rill-space-32` | `32px` |
| `--rill-space-4` | `4px` | `--rill-space-16` | `16px` | `--rill-space-40` | `40px` |
| `--rill-space-6` | `6px` | `--rill-space-20` | `20px` | `--rill-space-48` | `48px` |
| `--rill-space-8` | `8px` | `--rill-space-24` | `24px` | `--rill-space-64` | `64px` |

**约束**：页面左右留白只用 `16`；卡片内上下列间距只用 `8/12`；区块之间只用 `12/16/24`；不允许出现 `13px`、`18px` 这类非标值。

### 2.4 圆角 / 描边 / 阴影

| token | 值 | 用在哪 |
| --- | --- | --- |
| `--rill-radius-4` | `4px` | 图占位块（九宫格内的小块）、chip |
| `--rill-radius-8` | `8px` | 引用块、次级按钮、输入框 |
| `--rill-radius-12` | `12px` | toast、图占位大块、sheet 内分区 |
| `--rill-radius-16` | `16px` | sheet 顶部圆角、宽屏卡片 |
| `--rill-radius-20` | `20px` | 头像（40px 一半）、大圆按钮 |
| `--rill-radius-full` | `999px` | 发布按钮、段控件、主题开关、chip（胶囊） |
| `--rill-border-w` | `1px` | 分隔线/描边默认宽度 |
| `--rill-shadow-1` | `0 1px 2px rgba(17,26,25,.06)` | 顶栏吸顶时的极轻投影 |
| `--rill-shadow-2` | `0 6px 20px rgba(17,26,25,.10)` | tabbar / toast |
| `--rill-shadow-3` | `0 16px 40px rgba(17,26,25,.18)` | dialog / sheet（桌面居中态） |

**暗色下阴影改由"亮度差 + 描边"承担**（暗底上阴影几乎不可见，硬堆 alpha 只会脏）：`--rill-shadow-1/2/3` 在暗色块里替换为更紧的黑色投影，同时给浮层加 `1px solid var(--rill-border)`。

### 2.5 动效 / 层级 / 结构尺寸

| token | 值 | 用途 |
| --- | --- | --- |
| `--rill-dur-fast` | `120ms` | 按压、灰色态切换 |
| `--rill-dur-base` | `180ms` | toast 进出、sheet 进出 |
| `--rill-dur-slow` | `240ms` | 点赞 pop、tab 指示条 |
| `--rill-ease` | `cubic-bezier(.2,.8,.2,1)` | 所有过渡的默认缓动（出场不拖沓） |
| `--rill-ease-spring` | `cubic-bezier(.34,1.4,.64,1)` | 点赞 pop（轻微过冲） |
| `--rill-z-sticky` | `10` | 吸顶顶栏 |
| `--rill-z-tabbar` | `20` | 底部 tabbar |
| `--rill-z-overlay` | `30` | sheet 遮罩 |
| `--rill-z-dialog` | `40` | sheet 本体 |
| `--rill-z-toast` | `50` | toast（永远最上） |
| `--rill-content-max` | `640px` | ≥768 时内容列上限（spec §4.7） |
| `--rill-gutter` | `16px` | 页面左右留白（= `--rill-space-16`） |
| `--rill-header-h` | `52px` | 顶栏高 |
| `--rill-tabbar-h` | `56px` | tabbar 高（不含安全区） |
| `--rill-hit` | `44px` | **最小可点区**（含透明外扩，不改变视觉尺寸） |
| `--rill-avatar` | `40px` | 卡片头像 |
| `--rill-avatar-sm` | `32px` | 回复头像 |
| `--rill-avatar-lg` | `64px` | 我的页头像 |
| `--rill-icon` | `24px` | tabbar 图标 |
| `--rill-icon-sm` | `18px` | 卡片计数行图标 |
| `--rill-card-pad-y` | `12px` | 卡片上下内距 |
| `--rill-card-pad-x` | `16px` | 卡片左右内距 |
| `--rill-media-gap` | `4px` | 图格间距 |
| `--rill-media-ratio` | `16 / 9` | 单图比例 |
| `--rill-line-clamp` | `6` | 卡片正文截断行数 |
| `--rill-textarea-min` | `168px` | 发博输入区最小高 |
| `--rill-compose-bar-h` | `56px` | 发博底部工具条高 |
| `--rill-sheet-max-h` | `82vh` | 375 下 sheet 最大高 |
| `--rill-sheet-w` | `480px` | ≥768 下 sheet 宽 |

### 2.6 完整变量块（`src/styles/tokens.css`，可整段复制）

```css
/* tokens.css —— 只有变量。值改这里，组件不用动。 */
:root {
  color-scheme: light;

  /* 颜色 · 亮色（默认） */
  --rill-bg: #F5F7F6;
  --rill-surface: #FFFFFF;
  --rill-surface-2: #EDF2F0;
  --rill-surface-3: #E1E7E4;
  --rill-border: #E0E5E2;
  --rill-border-strong: #828D88;
  --rill-text: #111A19;
  --rill-text-2: #48564F;
  --rill-text-3: #5F6F69;
  --rill-accent: #0B6E60;
  --rill-accent-pressed: #08574C;
  --rill-accent-soft: #E1F2EE;
  --rill-on-accent: #FFFFFF;
  --rill-like: #B94237;
  --rill-danger: #B03A2E;
  --rill-overlay: rgba(9, 15, 14, .44);
  --rill-toast-bg: #152221;
  --rill-toast-text: #F2F6F4;
  --rill-focus: #0B6E60;

  /* 字族 · 字阶 */
  --rill-font: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
  --rill-fs-11: 11px;
  --rill-fs-13: 13px;
  --rill-fs-15: 15px;
  --rill-fs-17: 17px;
  --rill-fs-20: 20px;
  --rill-fs-24: 24px;
  --rill-lh-tight: 1.35;
  --rill-lh-normal: 1.5;
  --rill-lh-relaxed: 1.6;
  --rill-fw-regular: 400;
  --rill-fw-medium: 500;
  --rill-fw-semibold: 600;
  --rill-tracking-tight: -0.01em;

  /* 间距 */
  --rill-space-2: 2px;
  --rill-space-4: 4px;
  --rill-space-6: 6px;
  --rill-space-8: 8px;
  --rill-space-12: 12px;
  --rill-space-16: 16px;
  --rill-space-20: 20px;
  --rill-space-24: 24px;
  --rill-space-32: 32px;
  --rill-space-40: 40px;
  --rill-space-48: 48px;
  --rill-space-64: 64px;

  /* 圆角 · 描边 · 阴影 */
  --rill-radius-4: 4px;
  --rill-radius-8: 8px;
  --rill-radius-12: 12px;
  --rill-radius-16: 16px;
  --rill-radius-20: 20px;
  --rill-radius-full: 999px;
  --rill-border-w: 1px;
  --rill-shadow-1: 0 1px 2px rgba(17, 26, 25, .06);
  --rill-shadow-2: 0 6px 20px rgba(17, 26, 25, .10);
  --rill-shadow-3: 0 16px 40px rgba(17, 26, 25, .18);

  /* 动效 · 层级 */
  --rill-dur-fast: 120ms;
  --rill-dur-base: 180ms;
  --rill-dur-slow: 240ms;
  --rill-ease: cubic-bezier(.2, .8, .2, 1);
  --rill-ease-spring: cubic-bezier(.34, 1.4, .64, 1);
  --rill-z-sticky: 10;
  --rill-z-tabbar: 20;
  --rill-z-overlay: 30;
  --rill-z-dialog: 40;
  --rill-z-toast: 50;

  /* 结构尺寸 */
  --rill-content-max: 640px;
  --rill-gutter: 16px;
  --rill-header-h: 52px;
  --rill-tabbar-h: 56px;
  --rill-hit: 44px;
  --rill-avatar: 40px;
  --rill-avatar-sm: 32px;
  --rill-avatar-lg: 64px;
  --rill-icon: 24px;
  --rill-icon-sm: 18px;
  --rill-card-pad-y: 12px;
  --rill-card-pad-x: 16px;
  --rill-media-gap: 4px;
  --rill-media-ratio: 16 / 9;
  --rill-line-clamp: 6;
  --rill-textarea-min: 168px;
  --rill-compose-bar-h: 56px;
  --rill-sheet-max-h: 82vh;
  --rill-sheet-w: 480px;
}

/* 暗色：属性与 class 等价，任选其一；验收可强制切换 */
[data-theme="dark"],
html.theme-dark {
  color-scheme: dark;

  --rill-bg: #0D1312;
  --rill-surface: #151D1C;
  --rill-surface-2: #1E2826;
  --rill-surface-3: #293431;
  --rill-border: #25302E;
  --rill-border-strong: #66756F;
  --rill-text: #E9EFED;
  --rill-text-2: #A6B3AF;
  --rill-text-3: #859490;
  --rill-accent: #4ADFC1;
  --rill-accent-pressed: #6FE7CE;
  --rill-accent-soft: #123330;
  --rill-on-accent: #06201B;
  --rill-like: #FF7B72;
  --rill-danger: #FF7A6B;
  --rill-overlay: rgba(0, 0, 0, .62);
  --rill-toast-bg: #E9EFED;
  --rill-toast-text: #111A19;
  --rill-focus: #4ADFC1;
  --rill-shadow-1: 0 1px 2px rgba(0, 0, 0, .40);
  --rill-shadow-2: 0 6px 20px rgba(0, 0, 0, .48);
  --rill-shadow-3: 0 16px 40px rgba(0, 0, 0, .56);
}
```

---

## 3. 主题切换实现

### 3.1 唯一开关入口

`#app` 根元素的 `data-theme="light|dark"` + `html.theme-dark` class（两者等价，builder 可只写属性；写 class 时不要同时写属性，避免两个来源打架）。

```ts
// theme.ts —— 单一真源；storage key 见 spec §4.5
export function applyTheme(mode: 'light' | 'dark') {
  document.documentElement.dataset.theme = mode;       // 规范写法
  document.documentElement.classList.toggle('theme-dark', mode === 'dark');
  document.documentElement.style.colorScheme = mode;
  localStorage.setItem('rill:v1:theme', mode);
}
```

### 3.2 首帧防白闪（`index.html` 的 `<head>`，必须在 bundle 之前）

```html
<script>
  try {
    var t = localStorage.getItem('rill:v1:theme');
    if (t !== 'dark' && t !== 'light') t = matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    document.documentElement.dataset.theme = t;
    if (t === 'dark') document.documentElement.classList.add('theme-dark');
  } catch (e) {}
</script>
```

- 只在**没有存过偏好**时读 `prefers-color-scheme`（一次），之后完全由用户显式选择决定 —— 满足 captain 的"别用系统偏好独断、验收要能强制切换"。
- 验收可强制：`#/me?probe=theme:dark`，或直接在 `<html>` 上设 `data-theme="dark"`。

---

## 4. 布局规范（移动优先 375 → 768 / 1440）

### 4.1 断点与容器

| 断点 | 行为 |
| --- | --- |
| `<768px` | 单列；左右 `--rill-gutter`（16）；顶栏与 tabbar 通栏；sheet 为**底部抽屉**（顶部圆角 16，最高 82vh） |
| `≥768px` | 内容列 `max-width: var(--rill-content-max)`（640）居中；顶栏内容同样收进 640；tabbar 内层收进 640 但底色通栏；sheet 为**居中对话框**（宽 480，圆角 16，四周留白 24） |
| `≥1200px` | 同 ≥768，只增加页面上下留白（24 → 32）；**不出现第二列**（单列是产品决策，不是响应式妥协） |

```css
.rill-app {
  min-height: 100dvh;
  background: var(--rill-bg);
  color: var(--rill-text);
  font-family: var(--rill-font);
  font-size: var(--rill-fs-15);
  line-height: var(--rill-lh-normal);
  -webkit-font-smoothing: antialiased;
  overflow-x: clip;               /* 兜住任何意外横向溢出（spec AC-G06） */
}
.rill-col { width: 100%; max-width: var(--rill-content-max); margin-inline: auto; padding-inline: var(--rill-gutter); }
```

### 4.2 骨架（所有页共用）

```text
┌──────────────────────────────┐
│ .rill-header   52px  吸顶 z10│   ← 标题 17/600；左侧返回（详情页）；右侧动作
├──────────────────────────────┤
│ .rill-main                   │   ← 唯一滚动容器是 window（spec §4.7 硬约束）
│   列表 / 表单 / 头部          │
│                              │
├──────────────────────────────┤
│ .rill-tabbar   56px + 安全区 │   ← 固定底部 z20；4 项等分
└──────────────────────────────┘
```

| 元素 | 尺寸（375） | 尺寸（≥768） | 备注 |
| --- | --- | --- | --- |
| 顶栏高 | 52 | 52 | `position: sticky; top: 0`；底边 1px 分隔线；滚动时加 `--rill-shadow-1` |
| 顶栏标题 | 17/600，居中 | 20/600，靠左 20 | 详情页标题固定"详情" |
| 顶栏动作 | 文字按钮 13/500 `--rill-accent`，命中区 44×44 | 同 | 右侧「刷新」、左侧「返回」都用**文字**：本规范不为一次性动作新增图标（图标集只留 tabbar 与计数动作所需的 7 个），文字在中文界面里同样清晰 |
| 页面左右留白 | 16 | 16（列内） | 卡片本身不加外边距 |
| 列表项间距 | 0（用 1px 分隔线） | 0 | 卡片之间不加间隙，避免"卡片流"视觉噪音 |
| tabbar | 56 + `env(safe-area-inset-bottom)` | 56 | 4 项等分；图标 24 + 标签 11/500；选中 `--rill-accent` |
| 内容底部预留 | `calc(56px + 16px + env(safe-area-inset-bottom))` | 同 | 防止最后一条被 tabbar 挡住 |

> 顶栏两个动作（刷新 / 返回）都用文字按钮：`<button class="btn--text">刷新</button>`、`<button class="btn--text" aria-label="返回">返回</button>`。理由：图标集只服务 tabbar 与计数动作；中文字在 13px 下比 24px 图标更省空间也更明确。

### 4.3 时间线卡片（spec §6 的 `post-card`）

```text
┌────────────────────────────────────────┐
│ ○  昵称 15/500          @handle 13/400 │ ← .card__head 高 40
│    3 小时前 13/400                      │   （头像 40 / 间距 8 / 时间与 handle 同行）
│ 正文最多 6 行，15/400/1.5               │ ← .card__text
│ ┌────┬────┐                            │ ← .card__media（1/2/3/4/5–9 自动布局）
│ └────┴────┘                            │
│ 转发 @某人：原文……（灰底块）           │ ← .card__quote（可选）
│ ⟲ 12    💬 7    ♡ 186                  │ ← .card__actions 高 32
└────────────────────────────────────────┘
   padding: 12px 16px；1px 底边分隔线
```

| 部分 | 规格 |
| --- | --- |
| 卡片容器 | 底 `--rill-surface`；上下 `--rill-card-pad-y`(12)、左右 `--rill-card-pad-x`(16)；底边 `1px solid var(--rill-border)`；**无圆角、无阴影**（列表是"纸"，浮层才是"卡"） |
| 作者行 | 高 40；头像 40 / 圆角 20 / 占位底 `hsl(<avatarHue> 34% 78%)` + 1–2 字 `--rill-text`；昵称与 `@handle` 同行（昵称 15/500，handle 13/400 `--rill-text-3`，超长 `text-overflow: ellipsis`）；时间单独一行 13/400 `--rill-text-3` |
| 正文 | 15/400/1.5；`display: -webkit-box; -webkit-line-clamp: var(--rill-line-clamp); -webkit-box-orient: vertical; overflow: hidden;`（截断只在 CSS，DOM 文本完整，spec 的 `data-clamped` 由此而来） |
| 图格 | `display: grid; gap: var(--rill-media-gap)`；1 张：单列 `aspect-ratio: 16/9`；2 张：2 列 1:1；3 张：3 列 1:1；4 张：2×2；5–9 张：3 列 1:1（末行不足 3 张时靠左，不拉伸） |
| 图占位块 | 圆角 4；底 `hsl(<hue> 26% 84%)`（暗色 `hsl(<hue> 22% 22%)`）；中央 11/400 `--rill-text-3` 显示 `alt` 前 6 字；**不可点击**（大图查看属 P2） |
| 引用块（转发） | 底 `--rill-surface-2`；圆角 8；内距 8 12；作者 13/500 `--rill-text-2`；原文 13/400/1.5 `--rill-text-2`，最多 3 行；位于正文与图格之后 |
| 计数行 | 高 32；三项等宽靠左（`gap: 28px`）；每项 = 图标 18 + 数字 13/500；默认图标与数字 `--rill-text-3`；**已赞**时两项都变 `--rill-like` 且图标用实心变体；命中区 44×44（用 `::after` 外扩，不改视觉尺寸） |

**图格列宽公式**（不写死像素，宽度随容器走）：

```css
.card__media { display: grid; gap: var(--rill-media-gap); margin-top: var(--rill-space-8); margin-inline: calc(-1 * var(--rill-card-pad-x)); }
.card__media[data-count="1"] { grid-template-columns: 1fr; }
.card__media[data-count="1"] .ph { aspect-ratio: var(--rill-media-ratio); }
.card__media[data-count="2"] { grid-template-columns: repeat(2, 1fr); }
.card__media[data-count="3"] { grid-template-columns: repeat(3, 1fr); }
.card__media[data-count="4"] { grid-template-columns: repeat(2, 1fr); }
.card__media[data-count="5"],
.card__media[data-count="6"],
.card__media[data-count="7"],
.card__media[data-count="8"],
.card__media[data-count="9"] { grid-template-columns: repeat(3, 1fr); }
.card__media .ph:not([data-ratio="wide"]) { aspect-ratio: 1 / 1; }
```

> **图格贴卡片边（full-bleed）**：`.card__media` 用 `margin-inline: calc(-1 * var(--rill-card-pad-x))` 抵消卡片左右内距，媒体区宽度 = **卡片宽度**（375 下 343 = 屏宽 − 2×16 的列内距；≥768 下 608 = 640 列 − 2×16），文本仍留在内距里。卡片内距在 ≥768 断点用 `--rill-card-pad-x: var(--rill-space-20)` 覆写 —— **贴边的负边距必须读同一个变量**，否则宽屏会少贴 4px（自检里就是这么发现并改掉的）。
> 于是 3 列单格 = (343 − 2×4) / 3 = **111.67px**、2 列单格 = (343 − 4) / 2 = **169.5px**、单图 16:9 = 343×**192.9**——与 spec §4.7 的 111.6 一致（那是按"没扣卡片内距"的列宽算的，只有 true 贴边才对得上，所以这里定死贴边）。**不要**为图格写死 `111px`。
> 详情页/我的页复用同一个 `.card__media`，贴边规则自动生效。

### 4.4 详情页（spec §7）

| 部分 | 规格 |
| --- | --- |
| 正文 | 17/400/1.6；**不限行**；无 `-webkit-line-clamp`；`overflow-wrap: anywhere` |
| 作者行 | 与卡片同结构，但头像 40、昵称 17/500、时间 13/400 单独一行、右侧显示"来自 溪流"13/400 `--rill-text-3` |
| 图格 | 同卡片公式 |
| 计数行 | 与卡片一致（共享状态），高 36，图标 20 |
| 回复输入 | 顶部 `1px` 分隔线；`padding: 12px 16px`；`textarea` 15/400/1.5，`min-height: 40px`，自动增高至 120 上限后内部滚动；右下发"发送"按钮（高 32、圆角 full、`--rill-accent-soft` 底 + `--rill-accent` 字，`trim()` 为空时变 `--rill-surface-3` 底 + `--rill-text-3` 字并 `disabled`） |
| 回复项 | `padding: 12px 16px`；头像 32；昵称 13/500；`回复 @xxx` 前缀 13/400 `--rill-text-3`；正文 15/400/1.5；右上"回复"文字按钮 13/400 `--rill-accent` |
| 楼中楼 | 左侧缩进 8 + `2px solid var(--rill-border)` 引导线；内部条目 `padding: 8px 0`；"展开 N 条回复" 13/400 `--rill-accent` |
| 空/错误态 | 见 §5.9 / §5.10 |

### 4.5 发博页（spec §8）

| 部分 | 规格 |
| --- | --- |
| 输入区 | `textarea` 17/400/1.6；`min-height: var(--rill-textarea-min)`(168)；无边框、无底色（就是页面底）；`padding: 16px`；placeholder `--rill-text-3` |
| 字数 | 右下角 13/400 `--rill-text-3`，`n/500`；≥450 变 `--rill-accent`；=500 变 `--rill-danger` |
| 图占位区 | 3 列网格（同卡片 3 列公式）；每块 1:1、圆角 4、删除按钮 20×20 在右上角（命中区 44 由 `::after` 外扩） |
| 工具条 | 高 56；左侧"图片"/"话题"两个图标按钮（36×36 命中 44，图标 20，`:hover` 底 `--rill-surface-2`）；右侧发布按钮 |
| 发布按钮 | 高 32、`padding-inline: 16`、圆角 full、14/600；可用 = `--rill-accent` 底 + `--rill-on-accent` 字；禁用 = `--rill-surface-3` 底 + `--rill-text-3` 字、`cursor: not-allowed` |
| 草稿提示 | 13/400 `--rill-text-3`，出现在工具条左侧，文案"已保存草稿" |

### 4.6 我的页 + 设置 sheet（spec §9）

| 部分 | 规格 |
| --- | --- |
| 头部 | `padding: 20px 16px 16px`；头像 64 / 圆角 32；右侧昵称 20/600、`@handle` 13/400 `--rill-text-3`；简介 15/400 `--rill-text-2`，2 行截断；下方统计 3 列等分（值 17/600，标签 13/400 `--rill-text-3`） |
| 段控件 | 高 40；两项等分；选中项 15/500 `--rill-text` + 底部 2px `--rill-accent` 指示条；未选中 15/400 `--rill-text-3`；整条底边 1px `--rill-border` |
| 列表 | 与时间线同卡片（compact：正文最多 4 行、无图格时不留空） |
| sheet（375） | 底部抽屉：`border-radius: var(--rill-radius-16) var(--rill-radius-16) 0 0`；`max-height: var(--rill-sheet-max-h)`；`padding-bottom: env(safe-area-inset-bottom)`；顶部把手 36×4 圆角 full `--rill-surface-3` |
| sheet（≥768） | 居中：宽 `var(--rill-sheet-w)`(480)；圆角 16；`--rill-shadow-3`；四周 24 留白；无把手 |
| sheet 行 | 高 56；左图标 20 + 标签 15/500；右侧控件；行间 1px `--rill-border`；「清空本地数据」整行文字 `--rill-danger` |
| 主题开关 | 44×26 胶囊（轨道）+ 22 圆点；亮色轨道 `--rill-surface-3`、暗色轨道 `--rill-accent`；圆点 `--rill-surface`；切换 180ms `--rill-ease`；`role="switch"` + `aria-checked` |
| 关于块 | 13/400/1.6 `--rill-text-2`；版本号"v0.1.0"用 13/500 `--rill-text`；距底部 24 |

**实现载体**：设置用**原生 `<dialog open data-testid="dialog-settings">`**（AC-PF05 断言的是 `[open]` 属性）。不用 `showModal()` 也能得到同样的视觉（默认 `position: absolute`，这里覆写成 `fixed`）；若坚持用 `showModal()`，必须把 `::backdrop` 置透明并保留自绘 `.sheet__scrim`，否则截图里会出现系统遮罩的黑色。dialog 的 UA 默认样式（`margin: auto` / `border` / `padding` / `max-width` / `max-height`）要在 `.sheet__panel` 里全部清掉。

### 4.7 一屏预算核对（375×812，用于 T5 截图判读）

| 页面 | 计算 | 结论 |
| --- | --- | --- |
| 时间线 | 视口 812 − 顶栏 52 − tabbar 56 = 704 可用；首卡（3 行正文 + 2 图）= 12+40+8+68+8+169.5+8+32+12 ≈ **357** | 首屏可见 **≈1.9 张完整卡片**（≥1.5 ✓）。**给 builder 的硬要求：mock 首条 `p_0001` 用 2 张图、正文 ≤3 行**，否则九图卡（≈508 高）会让首屏掉到 1.3 张 |
| 详情 | 52 顶栏 + 作者行 68 + 正文（≤8 行 ≈218）+ 图（可选）+ 计数 36 + 输入 64 | 首屏可见正文 + 首条回复（若正文 ≤8 行且无图） |
| 发博 | 顶栏 52 + 输入 168 + 工具条 56 | 剩余 536 为键盘/空白，输入区充足 |
| 我的 | 顶栏 52 + 头部 ≈ 20+64+16+56 ≈ 156 + 段控件 40 | 首屏可见头部 + 段控件 + 首条 |

---

## 5. 组件规格

### 5.1 按钮

| 变体 | 视觉 | 尺寸 | 状态 |
| --- | --- | --- | --- |
| `btn--primary`（发布/发送） | `--rill-accent` 底 + `--rill-on-accent` 字；圆角 full | 高 32 / 内距 16 / 14·600 | hover `--rill-accent-pressed`；active `scale(.98)`；disabled `--rill-surface-3` + `--rill-text-3` |
| `btn--ghost`（取消/重试） | 透明底 + `--rill-accent` 字 | 高 36 / 内距 12 / 15·500 | hover 底 `--rill-accent-soft` |
| `btn--icon`（工具条 / sheet 关闭） | 透明底 + `--rill-text-2` 图标 20–24 | 视觉 36×36（工具条）/ 44×44（sheet 关闭） | hover 底 `--rill-surface-2`；active `--rill-surface-3`；关闭按钮复用 `plus` 图标并 `transform: rotate(45deg)` 成 ×（不新增图标） |
| `btn--text`（回复/展开） | 无底、无框 | 13/400，行高 44 命中 | 颜色 `--rill-accent` |

**统一规则**：所有可点元素的**命中区 ≥44×44**（视觉可以更小，用 `::after { inset: -10px }` 外扩）；`:focus-visible` 用 `outline: 2px solid var(--rill-focus); outline-offset: 2px`，**不用** `outline: none`。

### 5.2 输入框 / textarea

- 单行输入：高 40、圆角 8、底 `--rill-surface`、描边 `1px solid var(--rill-border-strong)`（3.43:1，满足非文本 3:1）、内距 12；聚焦时描边换 `--rill-focus` + `box-shadow: 0 0 0 3px var(--rill-accent-soft)`。
- textarea：无描边（发博）/有描边（回复框两种都可以，**统一用无描边 + 顶部分隔线**，减少视觉噪音）；`resize: none`。
- 占位符 `--rill-text-3`；**不用**低于 4.5:1 的灰色。

### 5.3 段控件（feed-tab / profile-tab）

高 40；`display: flex`；每项 `flex: 1`、居中、15·500；选中 = `--rill-text` + 底部 2px `--rill-accent` 指示条（`transition: transform var(--rill-dur-slow) var(--rill-ease)`）；未选中 `--rill-text-3`。整组底边 1px 分隔线。**不用**胶囊底块（视觉噪音）。

### 5.4 话题 chip

13/400；`padding: 2px 6px`；圆角 4；底 `--rill-surface-2`；字 `--rill-accent`（亮 5.31 / 暗 8.18）；**不可点**（spec：话题页 P1-5 延后），因此不加 hover 与下划线 —— 不可点的东西不要装作能点。

### 5.5 头像占位（无位图）

```css
.av { width: var(--rill-avatar); height: var(--rill-avatar); border-radius: var(--rill-radius-20);
      display: grid; place-items: center; font-size: var(--rill-fs-15); font-weight: var(--rill-fw-medium);
      color: var(--rill-text); background: hsl(var(--hue, 168) 34% 78%); }
[data-theme="dark"] .av, html.theme-dark .av { background: hsl(var(--hue, 168) 24% 26%); color: var(--rill-text); }
```

### 5.6 图占位（无位图）

圆角 4；亮色 `hsl(hue 26% 84%)`、暗色 `hsl(hue 22% 22%)`；居中 11/400 `--rill-text-3`，内容为 `alt` 前 6 字；`aria-hidden="false"` + `role="img"` + `aria-label=alt`（无障碍需要，但视觉只是一块色）。

### 5.7 计数行（卡片/详情共用）

三项：图标 18（详情 20）+ 数字 13/500；间距 `--rill-space-24`；默认 `--rill-text-3`；已赞 `--rill-like` + 实心图标；数字用 `font-variant-numeric: tabular-nums`（计数变化不抖动）。

### 5.8 toast

| 项 | 规格 |
| --- | --- |
| 位置 | 底部居中，`bottom: calc(var(--rill-tabbar-h) + var(--rill-space-16) + env(safe-area-inset-bottom))`；水平 `left: 50%; translateX(-50%)` |
| 外观 | 高 40、`padding: 0 16px`、圆角 12、底 `--rill-toast-bg`、字 13/500 `--rill-toast-text`、`--rill-shadow-2`；最大宽 `calc(100% - 32px)` |
| 入场/出场 | 入场 `opacity 0→1` + `translateY(8px→0)`，180ms `--rill-ease`；停留 2000ms（发布成功 2200ms）；出场 180ms 反向 |
| 层级 | `z-index: var(--rill-z-toast)`；`role="status" aria-live="polite"`；**不阻塞点击**（`pointer-events: none`） |
| 文案 | 「已赞」「已转发」「已回复」「已发布」「已刷新」「最多 9 张」「最多 3 个话题」「已恢复初始数据」「发布失败，内容已存为草稿」 |

### 5.9 空态

| 项 | 规格 |
| --- | --- |
| 结构 | 插图（§6.3 的 SVG，宽 160）+ 标题 17/500 + 说明 13/400 `--rill-text-3` + 可选主按钮 |
| 间距 | 插图与标题 16；标题与说明 8；说明与按钮 24；整块垂直居中于剩余空间 |
| 文案 | 时间线："这里还没有内容" / "去发一条"；详情回复："还没有回复，来说第一句"；我的博文："还没有发过内容"；赞过的："还没有赞过的内容" |
| 颜色 | 插图用 `--rill-surface-3` 线与 `--rill-accent-soft` 填充，不用彩色渐变 |

### 5.10 错误态

结构与空态相同，但：插图换成"断线的溪流"（同一套 SVG，`stroke` 用 `--rill-danger`）；标题"内容没有加载出来"；说明"稍后再试，或从下面的按钮重来"；主按钮"重试"（`btn--ghost`）。**错误态不覆盖整页**：错误块高度自适应，`#app` 的 `data-runtime-errors` 与 `data-probe-applied` 仍可读。

---

## 6. 图标集（9 个，全部 inline SVG，自带 path）

### 6.1 通用规则

- `viewBox="0 0 24 24"`；**描边式**：`fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"`。
- 尺寸：tabbar 24；卡片计数 18；详情计数 20；按钮内 20。**缩放不改 `stroke-width`**（1.75 在 18–24 都清晰）。
- 无障碍：装饰性图标加 `aria-hidden="true"`；纯图标按钮必须在按钮上写 `aria-label`。
- 不许 `fill` 除实心变体（like 已赞）之外的颜色；不许出现外链 `<use href="...">`、图标字体、`<img>`。
- 颜色全部 `currentColor` —— 由父级 `color` 控制（`--rill-text-3` / `--rill-accent` / `--rill-like`）。

### 6.2 图标清单与使用矩阵

| # | 名字 | 形状 | 本期挂载处 | 尺寸 |
| --- | --- | --- | --- | --- |
| 1 | `home` | 屋顶 + 门洞 | tabbar「时间线」（详情页同高亮） | 24 |
| 2 | `explore` | 罗盘（圆 + 指针） | **不挂载**（对应已砍的搜索/发现 P2）；仅供后续形状参考 | — |
| 3 | `plus` | 十字 | tabbar「发博」（中间强调项） | 24 |
| 4 | `bell` | 铃铛 + 铃舌 | **不挂载**（对应已砍的通知面 P2） | — |
| 5 | `user` | 头 + 肩 | tabbar「我的」 | 24 |
| 6 | `like` | 心形（描边 + 实心两态） | 卡片/详情点赞 | 18 / 20 |
| 7 | `reply` | 对话气泡带尾 | 卡片/详情回复 | 18 / 20 |
| 8 | `repost` | 双向箭头 | 卡片/详情转发 | 18 / 20 |
| 9 | `settings` | 三条滑杆（sliders） | tabbar「设置」（spec §4.2 的"sliders 语义"） | 24 |

**为什么是 9 个而不是 8 个**（captain 要求说明）：任务书枚举的 8 个名字里，`explore` 与 `bell` 对应的两个 tab（发现 / 消息）已被 captain 的 P2 锁定砍掉，而 spec §4.2 的第 4 个 tab 是「设置」，用铃铛画设置是语义错误。所以：**任务书枚举的 8 个全部给出 path（按名字都能查到）**，实际渲染的是 7 个（home / plus / user / settings / like / reply / repost）；`explore`、`bell` 只在本文留档，**不进 `src/components/icons.tsx`**，不产生死代码。
**主题（captain 列的"主题"项）不使用 SVG**：设置 sheet 里的主题行是一个 44×26 的 CSS 双态开关（§4.6），开关本身已经表达亮/暗，再加一个太阳/月亮图标只会多一个不必要的元素。若后续要图标，加 `sun`/`moon` 各 3 行 path 即可（同样是本规范的做法）。

### 6.3 图标源码（可直接拷进 `src/components/icons.tsx`）

每个图标一个组件，签名统一：`function Icon({ size = 24, ...rest }: { size?: number } & SVGProps<SVGSVGElement>)`。

**1. home**

```html
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.2v-5.1H9.2V20H5a1 1 0 0 1-1-1z"/>
</svg>
```

**2. explore**（本期不挂载）

```html
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="12" r="8"/>
  <path d="M15.2 8.8 13.3 13l-4.5 1.8L10.7 11z"/>
</svg>
```

**3. plus**

```html
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 5v14M5 12h14"/>
</svg>
```

**4. bell**（本期不挂载）

```html
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 4a5.5 5.5 0 0 0-5.5 5.5v3.1L5 15.6h14l-1.5-3V9.5A5.5 5.5 0 0 0 12 4z"/>
  <path d="M9.9 18a2.1 2.1 0 0 0 4.2 0"/>
</svg>
```

**5. user**

```html
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <circle cx="12" cy="8.2" r="3.7"/>
  <path d="M5 19.6c0-3.3 3.1-5.4 7-5.4s7 2.1 7 5.4"/>
</svg>
```

**6. like**（描边态 / 实心态）

```html
<!-- 未赞：描边 -->
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M12 19.4S4.6 14.9 4.6 9.9A4 4 0 0 1 12 7.5a4 4 0 0 1 7.4 2.4c0 5-7.4 9.5-7.4 9.5z"/>
</svg>

<!-- 已赞：实心（同一 path，换 fill/stroke） -->
<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" stroke="none" aria-hidden="true">
  <path d="M12 19.4S4.6 14.9 4.6 9.9A4 4 0 0 1 12 7.5a4 4 0 0 1 7.4 2.4c0 5-7.4 9.5-7.4 9.5z"/>
</svg>
```

**7. reply**

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M20 12.3c0 3.6-3.6 6.4-8 6.4-1 0-2-.2-2.9-.5L5 20l1.1-3.4A6.3 6.3 0 0 1 4 12.3C4 8.7 7.6 6 12 6s8 2.7 8 6.3z"/>
</svg>
```

**8. repost**

```html
<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M6.5 8.5h10.6"/>
  <path d="M14.2 5.4l3.2 3.1-3.2 3.1"/>
  <path d="M17.5 15.5H6.9"/>
  <path d="M9.8 12.4 6.6 15.5l3.2 3.1"/>
</svg>
```

**9. settings**（sliders）

```html
<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
  <path d="M4.5 7.5h15M4.5 12h15M4.5 16.5h15"/>
  <circle cx="9.5" cy="7.5" r="1.9" fill="var(--rill-surface)"/>
  <circle cx="15" cy="12" r="1.9" fill="var(--rill-surface)"/>
  <circle cx="10.5" cy="16.5" r="1.9" fill="var(--rill-surface)"/>
</svg>
```

> sliders 的三个圆用 `--rill-surface` 填充，是为了在轨道线上"挖洞"（视觉更像滑杆）；暗色下自动跟随底色的 `--rill-surface`，不需要额外规则。若某处底色不是 `--rill-surface`（例如放在 `--rill-surface-2` 上），用 `fill="var(--rill-surface-2)"` 覆盖即可。

### 6.4 图标骨架（tabbar 用法）

```html
<a class="tab" href="#/timeline" aria-current="page">
  <svg class="tab__icon" viewBox="0 0 24 24" width="24" height="24" …>…home path…</svg>
  <span class="tab__label">时间线</span>
</a>
```

```css
.rill-tabbar__inner { display: grid; grid-template-columns: repeat(4, 1fr); }
.tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;
       min-height: var(--rill-tabbar-h); color: var(--rill-text-3); text-decoration: none;
       font-size: var(--rill-fs-11); font-weight: var(--rill-fw-medium); }
.tab[aria-current="page"] { color: var(--rill-accent); }
.tab__icon { width: var(--rill-icon); height: var(--rill-icon); }
```

---

## 7. 交互反馈

### 7.1 点赞微动效

```css
@keyframes rill-like-pop {
  0%   { transform: scale(1); }
  40%  { transform: scale(1.18); }
  100% { transform: scale(1); }
}
.act__icon--like.is-active { color: var(--rill-like); animation: rill-like-pop var(--rill-dur-slow) var(--rill-ease-spring); }
@media (prefers-reduced-motion: reduce) {
  .act__icon--like.is-active { animation: none; }
}
```

- 只在**从未赞变已赞**时播；取消赞不播（撤回动作不该有"奖励感"）。
- 动效只作用于图标，不动数字（数字用 `tabular-nums`，变化本身已经足够说明）。
- 动效期间不改变 `aria-pressed`（状态立即更新，动画只是装饰）。

### 7.2 发博成功的 toast

流程：`publish` 落 store → `history.replaceState('#/timeline')` → 时间线首卡即为新条目 → toast「已发布」推入（2200ms）→ 新卡入场不做位移，只让首卡顶部出现 1px 强调描边亮一下（`outline` 120ms 后消失），避免整列表跳动。

```css
@keyframes rill-toast-in {
  from { opacity: 0; transform: translate(-50%, 8px); }
  to   { opacity: 1; transform: translate(-50%, 0); }
}
.toast { animation: rill-toast-in var(--rill-dur-base) var(--rill-ease); }
@keyframes rill-fresh-flash {
  0%   { box-shadow: inset 0 0 0 2px var(--rill-accent); }
  100% { box-shadow: inset 0 0 0 2px transparent; }
}
.card.is-fresh { animation: rill-fresh-flash 900ms var(--rill-ease); }
```

### 7.3 空态插图（纯 SVG，自带 path）

```html
<svg class="empty__art" viewBox="0 0 160 120" width="160" height="120" role="img" aria-label="空的时间线">
  <rect x="0.5" y="0.5" width="159" height="119" rx="16" fill="var(--rill-surface-2)"/>
  <path d="M24 78c14-22 30-22 44 0s30 22 44 0 24-14 24-14" fill="none"
        stroke="var(--rill-surface-3)" stroke-width="6" stroke-linecap="round"/>
  <path d="M24 90c14-22 30-22 44 0s30 22 44 0 24-14 24-14" fill="none"
        stroke="var(--rill-accent-soft)" stroke-width="6" stroke-linecap="round"/>
  <circle cx="70" cy="36" r="9" fill="var(--rill-accent-soft)" stroke="var(--rill-surface-3)" stroke-width="3"/>
  <circle cx="96" cy="48" r="5" fill="var(--rill-surface-3)"/>
</svg>
```

错误态复用同一张图，把两条 `stroke` 改为 `var(--rill-danger)`（描边 6 的曲线）即可；不改几何。

### 7.4 按压 / 悬停 / 焦点

| 状态 | 规则 |
| --- | --- |
| hover（仅 `@media (hover: hover)`） | 图标按钮底 `--rill-surface-2`；文字按钮下划线；卡片整块 `background: var(--rill-surface-2)` 的 40% 混合（用 `color-mix` 则可，不支持时回退无变化） |
| active | `transform: scale(.97)` + `--rill-dur-fast`；列表卡片不做 active 位移 |
| focus-visible | `outline: 2px solid var(--rill-focus); outline-offset: 2px`；**键盘才显示**，鼠标点击不显示 |
| disabled | `--rill-surface-3` 底 + `--rill-text-3` 字 + `cursor: not-allowed`；不发 hover/active |
| 主题切换 | 所有颜色属性加 `transition: background-color var(--rill-dur-base) var(--rill-ease), color var(--rill-dur-base) var(--rill-ease), border-color var(--rill-dur-base) var(--rill-ease)`（只给这几条，别写 `all`） |

### 7.5 下拉刷新视觉（spec 把动作降级为按钮，视觉仍是"刷新"）

不实现下拉手势，但顶栏刷新按钮要有的反馈：点击后按钮变 `--rill-text-3` 并 `disabled` 240ms（`--rill-dur-slow`）+ toast「已刷新」；`prefers-reduced-motion` 下取消 240ms 的等待感，直接 toast。**不使用旋转图标**（本规范没有 refresh 图标；旋转文字按钮只会显得抖）。

---

## 8. 给 builder 的落地清单

| 顺序 | 文件 | 内容 | 验收对应 |
| --- | --- | --- | --- |
| 1 | `src/styles/tokens.css` | §2.6 整段 | AC-G04（同套变量切主题） |
| 2 | `index.html` `<head>` | §3.2 防白闪 3 行 | AC-PF06 |
| 3 | `src/components/icons.tsx` | §6.3 的 **7 个**（home/plus/user/settings/like/reply/repost，含 like 实心变体） | 无外部图标依赖 |
| 4 | `src/styles/base.css` | §4.1/§4.2 容器与骨架 | AC-G06/AC-G07（无横向滚动、640 居中） |
| 5 | `src/styles/card.css` | §4.3 卡片 + §5.5–§5.7 | AC-TL01（首屏卡片数） |
| 6 | `src/styles/detail.css` | §4.4 | AC-DT01（正文不限行） |
| 7 | `src/styles/compose.css` | §4.5 | AC-CP02（禁用态/计数） |
| 8 | `src/styles/profile.css` | §4.6 + sheet | AC-PF05/06 |
| 9 | `src/styles/feedback.css` | §5.8–§5.10、§7.1–§7.5 | AC-CP01（toast）、AC-TL10/11（空/错误态） |

**testid 纪律**：所有 `data-testid` / `data-*` 断言属性由 spec §3–§9 定义，**本文不新增、不改名**；CSS 一律用 class 选择器，**不要**写 `[data-testid=...]` 选择器（否则断言属性一变样式就崩）。`data-post-count` / `data-scroll-restored` / `data-probe-applied` 所在的节点必须在首帧可见可读——这也是 §1 纪律 1 的由来。

**禁止清单**（T5 会 grep/目检）：
- 无 `@import` / `url(http` / `@font-face` / 任何 CDN 链接；
- 无图标字体（`font-family: 'Material Icons'` 之类）、无 `<img src>` 图标；
- 无 UI 组件库的 class 约定（`ant-*` / `Mui*` / `chakra-*`）；
- 无骨架屏、无全屏遮罩（除了 sheet 自己的 `.sheet__scrim`）；
- 不出现禁用串（`Unique/unique/微博/Weibo/sina`，见 spec §15）。

---

## 9. 自检记录（本机实测，可复现）

做法：用脚本从**本文件**抽取全部 `css` 代码块与 §6.3 的 SVG（保证"测的就是文档里的值"），拼成两个自检页——`styleguide.html`（组件全摆一遍）与 `phone-*.html`（375×812 设备框，时间线/详情/发博/我的/设置各一屏）；Chrome 157 无头 `--dump-dom` 读回内联脚本写出的 JSON，再用 Python 判分。

复现命令：

```bash
python3 /tmp/rill-design/gen3.py && cd /tmp/rill-design
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new --no-sandbox --disable-gpu \
  --hide-scrollbars --disable-crash-reporter --disable-breakpad --no-first-run \
  --user-data-dir=/tmp/rill-design/ud --window-size=768,1024 --virtual-time-budget=2500 \
  --dump-dom file:///tmp/rill-design/styleguide.html > dom-768.html
python3 /tmp/rill-design/check.py      # → RESULT: ALL PASS
```

### 9.1 断言结果（全部通过）

| # | 检查 | 实测 | 结论 |
| --- | --- | --- | --- |
| 1 | token 数量与命名 | **84 个**，全部 `--rill-` 前缀，无空值；暗色块覆写 **22** 个（颜色 + 阴影） | PASS |
| 2 | token 都有说明 | 84 个 token 每个在本文出现 ≥2 次（声明 + 表格说明） | PASS |
| 3 | 对比度与 §2.1 表一致 | **18 组**（亮/暗各 9 组）逐项与表内数值一致（±0.02） | PASS |
| 4 | 正文可读性 | 亮：text 17.71 / text-2 7.72 / text-3 5.30（灰底 4.68）；暗：14.73 / 7.91 / 5.42（4.79）——全部 ≥4.5:1 | PASS |
| 5 | 非文本边界 | border-strong 对 surface **3.43**（亮）/ **3.54**（暗）；对 bg 3.19 / 3.88——≥3:1 | PASS |
| 6 | 强调底上的字 | on-accent/accent **6.15**（亮）/ **10.26**（暗） | PASS |
| 7 | 主题切换 | 同一套选择器：卡片底色 `rgb(255,255,255)` → `rgb(21,29,28)`；`?theme=dark` 直接启动时首帧即暗（无白闪） | PASS |
| 8 | 图标几何 | 10 个 svg（9 个 + like 两态）bbox 全部落在 `0–24` 内：home 16×15、explore 16×16、plus 14×14、bell 14×16.1、user 14×15.1、like 14.82×13.81、reply 16×14、repost 11×13.2、settings 15×12.8 | PASS |
| 9 | 图标属性 | 全部 `viewBox="0 0 24 24"`；描边态 `stroke=currentColor / stroke-width=1.75`；实心态 `fill=currentColor` | PASS |
| 10 | 零外部依赖 | `performance.getEntriesByType('resource')` 与 `[src]/[href]` 扫描结果 **0 条**；字体栈里没有 `http`/`url(` | PASS |
| 11 | 无横向溢出 | 768：`scrollWidth 768 == clientWidth 768`；1440：同；375 设备框：`scrollWidth 375` | PASS |
| 12 | 宽屏列居中 | 768 下卡片左边缘 **80px**、宽 **608px**；1440 下左 **416px** | PASS |
| 13 | 375 图格（贴边） | 媒体区宽 **343** = 卡宽；2 列 **169.5**、3 列 **111.67**、4 图 2 列 **169.5**、9 图 3 列 **111.67**、单图 16:9 **343×192.94**；2/3/4/9 图格高=宽 | PASS |
| 14 | 关键尺寸 | 顶栏 **52**、tabbar **56**、tab 56、头像 **40/32/64**、tab 图标 **24**、计数图标 **18**（详情 20）、段控件 **40**、发布按钮 **32×60**、toast **40**、文字按钮命中 **44**、发博输入 **≥168**、空态插图 **160×120** | PASS |
| 15 | 排版 | 卡片正文 **15px / 22.5px（1.5）/ 截断 6 行**；详情正文 **17px / 27.2px（1.6）/ 不限行**；我的页昵称 **20px**；时间戳三级灰 `rgb(95,111,105)` | PASS |
| 16 | 首帧节点不被遮挡 | 空态、错误态同帧渲染（无骨架屏、无全屏遮罩）；`data-post-count="3"` 可读 | PASS |
| 17 | 设置 sheet | 原生 `<dialog open data-testid="dialog-settings">` 渲染成功；≥768 下 480×236.8、水平居中（left 144）；<768 下为贴底全宽抽屉；暗色下同样可断言 | PASS |

### 9.2 自检过程中发现并修掉的两个坑（builder 也会遇到）

1. **宽屏下媒体区少贴 4px**：`--rill-card-pad-x` 是 16，但 ≥768 的卡片内距写成了硬编码 20，负边距只抵消了 16 → 媒体区宽 367 而不是 375。修法：断点里覆写同一个变量 `--rill-card-pad-x: var(--rill-space-20)`（见 §10 的 `.card` 规则）。**贴边的负边距必须与内距同源**。
2. **无头 Chrome 最小窗口宽 500**：`--window-size=375,812` 实测 `innerWidth=500`（`--force-device-scale-factor=2` 也不改 CSS 视口）。所以本文件用"375px 宽的 frame"量 375 档布局；**T5 若要真 375 视口，必须用 CDP 的 `Emulation.setDeviceMetricsOverride`（Playwright `viewport: {width:375}`）**，纯命令行参数做不到——这条也请写进 acceptance 的注意事项，否则"375 无横向滚动"会在 500 上被误判为通过。

### 9.3 截图（像素抽样核对，未做人工视觉终审）

`/tmp/rill-design/` 下：`s-timeline.png`、`s-timeline-dark.png`、`s-detail.png`、`s-compose.png`、`s-profile.png`、`s-sheet.png`（500×900，内含 375×812 设备框）、`s-desktop.png`（1440×900）。

抽样结果（Pillow 逐像素计数）：时间线亮色页里 `#F5F7F6` 23,603 px、`#FFFFFF` 138,994 px、`#0B6E60` 156 px；暗色页 `#0D1312` 22,496 / `#151D1C` 139,173；发博页发布按钮实测 **60×32** 且为 `#0B6E60` 实底；设置 sheet 页：sheet 白色面板横跨设备框左右边（x 64–436）共 242 行（≈242px 高），遮罩把页面底色压到几乎为 0，说明层级（scrim 30 / sheet 40）正确。**颜色、尺寸、层级都对得上规范。**

> 说明：本次执行的模型不能读图，所以**审美终审（间距是否舒服、层级是否清楚）交给 captain / verifier 看截图**；本文把可机械验证的部分（颜色、尺寸、几何、字数截断）全部锁死了。

## 10. 参考实现（CSS，可直接拷）

> 规则以 §2–§7 的表格为准；这一段是"照着表格写好的 CSS"，让 builder 少走弯路。类名与 §4–§6 的结构图一致；**没有**任何外部依赖。

```css
/* ---------- 10.1 基础与骨架 ---------- */
*, *::before, *::after { box-sizing: border-box; }
body { margin: 0; }
.rill-app {
  min-height: 100dvh; background: var(--rill-bg); color: var(--rill-text);
  font-family: var(--rill-font); font-size: var(--rill-fs-15); line-height: var(--rill-lh-normal);
  -webkit-font-smoothing: antialiased; overflow-x: clip;
}
.rill-col { width: 100%; max-width: var(--rill-content-max); margin-inline: auto; padding-inline: var(--rill-gutter); }

.rill-header {
  position: sticky; top: 0; z-index: var(--rill-z-sticky);
  height: var(--rill-header-h); display: flex; align-items: center; gap: var(--rill-space-8);
  padding-inline: var(--rill-space-16); background: var(--rill-surface);
  border-bottom: var(--rill-border-w) solid var(--rill-border);
}
.rill-header__title { margin: 0; font-size: var(--rill-fs-17); font-weight: var(--rill-fw-semibold); letter-spacing: var(--rill-tracking-tight); }
.rill-header__spacer { flex: 1; }
.rill-main { padding-bottom: calc(var(--rill-tabbar-h) + var(--rill-space-16) + env(safe-area-inset-bottom)); }

.btn--icon {
  width: var(--rill-hit); height: var(--rill-hit); display: grid; place-items: center;
  border: 0; border-radius: var(--rill-radius-full); background: none; color: var(--rill-text-2);
}
.btn--icon:hover { background: var(--rill-surface-2); }

.rill-tabbar {
  position: fixed; inset-inline: 0; bottom: 0; z-index: var(--rill-z-tabbar);
  background: var(--rill-surface); border-top: var(--rill-border-w) solid var(--rill-border);
  padding-bottom: env(safe-area-inset-bottom);
}
.rill-tabbar__inner { max-width: var(--rill-content-max); margin-inline: auto; display: grid; grid-template-columns: repeat(4, 1fr); height: var(--rill-tabbar-h); }

/* ---------- 10.2 卡片 ---------- */
.card {
  position: relative; padding: var(--rill-card-pad-y) var(--rill-card-pad-x);
  background: var(--rill-surface); border-bottom: var(--rill-border-w) solid var(--rill-border);
}
@media (min-width: 768px) { .card { --rill-card-pad-x: var(--rill-space-20); padding: var(--rill-space-16) var(--rill-card-pad-x); } }
.card__head { display: grid; grid-template-columns: var(--rill-avatar) 1fr; grid-template-rows: auto auto; column-gap: var(--rill-space-8); }
.card__av {
  grid-row: 1 / span 2; width: var(--rill-avatar); height: var(--rill-avatar); border-radius: var(--rill-radius-20);
  display: grid; place-items: center; background: hsl(var(--hue, 168) 34% 78%);
  font-size: var(--rill-fs-15); font-weight: var(--rill-fw-medium); color: var(--rill-text);
}
html[data-theme="dark"] .card__av, html.theme-dark .card__av { background: hsl(var(--hue, 168) 24% 26%); }
.card__name { margin: 0; font-size: var(--rill-fs-15); font-weight: var(--rill-fw-medium); color: var(--rill-text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.card__handle { margin-left: var(--rill-space-4); font-size: var(--rill-fs-13); font-weight: var(--rill-fw-regular); color: var(--rill-text-3); }
.card__time { font-size: var(--rill-fs-13); color: var(--rill-text-3); }
.card__text {
  margin: var(--rill-space-8) 0 0; font-size: var(--rill-fs-15); line-height: var(--rill-lh-normal);
  display: -webkit-box; -webkit-line-clamp: var(--rill-line-clamp); -webkit-box-orient: vertical;
  overflow: hidden; overflow-wrap: anywhere;
}
.card__quote { margin-top: var(--rill-space-8); padding: var(--rill-space-8) var(--rill-space-12); background: var(--rill-surface-2); border-radius: var(--rill-radius-8); }
.card__quote__name { margin: 0; font-size: var(--rill-fs-13); font-weight: var(--rill-fw-medium); color: var(--rill-text-2); }
.card__quote__text {
  margin: var(--rill-space-4) 0 0; font-size: var(--rill-fs-13); line-height: var(--rill-lh-normal);
  color: var(--rill-text-2); display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden;
}
.card__actions, .detail__actions { display: flex; gap: var(--rill-space-24); align-items: center; margin-top: var(--rill-space-8); height: 32px; }
.detail__actions { margin-top: var(--rill-space-12); height: 36px; }
.act { position: relative; display: inline-flex; align-items: center; gap: var(--rill-space-6); border: 0; background: none; padding: 0; color: var(--rill-text-3); font: inherit; }
.act::after { content: ""; position: absolute; inset: -12px -8px; }
.act__count { font-size: var(--rill-fs-13); font-weight: var(--rill-fw-medium); font-variant-numeric: tabular-nums; }
.act__icon { width: var(--rill-icon-sm); height: var(--rill-icon-sm); }
.detail__actions .act__icon { width: 20px; height: 20px; }
.act.is-active { color: var(--rill-like); }

.card__media { display: grid; gap: var(--rill-media-gap); margin-top: var(--rill-space-8); }
.card__media[data-count="1"] { grid-template-columns: 1fr; }
.card__media[data-count="2"] { grid-template-columns: repeat(2, 1fr); }
.card__media[data-count="3"] { grid-template-columns: repeat(3, 1fr); }
.card__media[data-count="4"] { grid-template-columns: repeat(2, 1fr); }
.card__media[data-count="5"], .card__media[data-count="6"], .card__media[data-count="7"],
.card__media[data-count="8"], .card__media[data-count="9"] { grid-template-columns: repeat(3, 1fr); }
.ph {
  border-radius: var(--rill-radius-4); background: hsl(var(--hue, 200) 26% 84%);
  display: grid; place-items: center; font-size: var(--rill-fs-11); color: var(--rill-text-3);
  aspect-ratio: 1 / 1;
}
.card__media[data-count="1"] .ph { aspect-ratio: var(--rill-media-ratio); }
.ph[data-ratio="wide"] { aspect-ratio: var(--rill-media-ratio); }
html[data-theme="dark"] .ph, html.theme-dark .ph { background: hsl(var(--hue, 200) 22% 22%); }

/* ---------- 10.3 详情与回复 ---------- */
.detail { padding: var(--rill-card-pad-y) var(--rill-card-pad-x) var(--rill-space-16); background: var(--rill-surface); border-bottom: var(--rill-border-w) solid var(--rill-border); }
.detail__text { margin: var(--rill-space-8) 0 0; font-size: var(--rill-fs-17); line-height: var(--rill-lh-relaxed); overflow-wrap: anywhere; }
.replying { display: flex; align-items: flex-end; gap: var(--rill-space-8); padding: var(--rill-space-12) var(--rill-space-16); background: var(--rill-surface); border-top: var(--rill-border-w) solid var(--rill-border); }
.replying__input {
  flex: 1; min-height: 40px; max-height: 120px; resize: none; border: 0; border-radius: var(--rill-radius-8);
  background: var(--rill-bg); padding: var(--rill-space-8) var(--rill-space-12);
  font: inherit; font-size: var(--rill-fs-15); color: var(--rill-text);
}
.replies { background: var(--rill-surface); }
.reply-row { display: grid; grid-template-columns: var(--rill-avatar-sm) 1fr; column-gap: var(--rill-space-8); padding: var(--rill-space-12) var(--rill-space-16); border-top: var(--rill-border-w) solid var(--rill-border); }
.reply-row__av { width: var(--rill-avatar-sm); height: var(--rill-avatar-sm); border-radius: var(--rill-radius-20); display: grid; place-items: center; background: hsl(var(--hue, 210) 30% 80%); font-size: var(--rill-fs-13); }
.reply-row__name { font-size: var(--rill-fs-13); font-weight: var(--rill-fw-medium); }
.reply-row__meta { font-size: var(--rill-fs-13); color: var(--rill-text-3); }
.reply-row__text { margin: var(--rill-space-4) 0 0; font-size: var(--rill-fs-15); line-height: var(--rill-lh-normal); }
.reply-children { margin: var(--rill-space-8) 0 0 var(--rill-space-8); padding-left: var(--rill-space-8); border-left: 2px solid var(--rill-border); }

/* ---------- 10.4 发博 ---------- */
.compose { display: flex; flex-direction: column; min-height: calc(100dvh - var(--rill-header-h) - var(--rill-tabbar-h)); background: var(--rill-surface); }
.compose__input {
  flex: 1; min-height: var(--rill-textarea-min); border: 0; background: transparent; resize: none;
  padding: var(--rill-space-16); font: inherit; font-size: var(--rill-fs-17); line-height: var(--rill-lh-relaxed); color: var(--rill-text);
}
.compose__count { align-self: flex-end; padding: 0 var(--rill-space-16) var(--rill-space-8); font-size: var(--rill-fs-13); color: var(--rill-text-3); font-variant-numeric: tabular-nums; }
.compose__media { display: grid; grid-template-columns: repeat(3, 1fr); gap: var(--rill-media-gap); padding: 0 var(--rill-space-16) var(--rill-space-8); }
.compose__bar { display: flex; align-items: center; gap: var(--rill-space-8); height: var(--rill-compose-bar-h); padding-inline: var(--rill-space-12); border-top: var(--rill-border-w) solid var(--rill-border); }
.btn--primary { height: 32px; padding-inline: var(--rill-space-16); border: 0; border-radius: var(--rill-radius-full); background: var(--rill-accent); color: var(--rill-on-accent); font: inherit; font-size: 14px; font-weight: var(--rill-fw-semibold); }
.btn--primary[disabled] { background: var(--rill-surface-3); color: var(--rill-text-3); cursor: not-allowed; }
.btn--tool { width: 36px; height: 36px; display: grid; place-items: center; border: 0; border-radius: var(--rill-radius-8); background: none; color: var(--rill-text-2); }
.btn--text { min-height: var(--rill-hit); padding-inline: var(--rill-space-4); border: 0; background: none; font: inherit; font-size: var(--rill-fs-13); font-weight: var(--rill-fw-medium); color: var(--rill-accent); }
.btn--icon--close svg { transform: rotate(45deg); }
.btn--ghost { height: 36px; padding-inline: var(--rill-space-12); border: 0; border-radius: var(--rill-radius-8); background: none; color: var(--rill-accent); font: inherit; font-size: var(--rill-fs-15); font-weight: var(--rill-fw-medium); }

/* ---------- 10.5 我的 + 设置 sheet ---------- */
.profile__head { display: grid; grid-template-columns: var(--rill-avatar-lg) 1fr; column-gap: var(--rill-space-16); align-items: center; padding: var(--rill-space-20) var(--rill-space-16) var(--rill-space-16); background: var(--rill-surface); }
.profile__av { width: var(--rill-avatar-lg); height: var(--rill-avatar-lg); border-radius: var(--rill-radius-full); display: grid; place-items: center; background: hsl(var(--hue, 168) 34% 78%); font-size: var(--rill-fs-20); font-weight: var(--rill-fw-semibold); }
.profile__name { margin: 0; font-size: var(--rill-fs-20); font-weight: var(--rill-fw-semibold); }
.profile__handle { font-size: var(--rill-fs-13); color: var(--rill-text-3); }
.profile__bio { margin: var(--rill-space-8) 0 0; font-size: var(--rill-fs-15); color: var(--rill-text-2); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.profile__stats { display: grid; grid-template-columns: repeat(3, 1fr); padding: var(--rill-space-12) var(--rill-space-16); background: var(--rill-surface); border-top: var(--rill-border-w) solid var(--rill-border); }
.stat__value { font-size: var(--rill-fs-17); font-weight: var(--rill-fw-semibold); }
.stat__label { font-size: var(--rill-fs-13); color: var(--rill-text-3); }
.segment { display: flex; height: 40px; background: var(--rill-surface); border-bottom: var(--rill-border-w) solid var(--rill-border); }
.segment__item { position: relative; flex: 1; display: grid; place-items: center; border: 0; background: none; font: inherit; font-size: var(--rill-fs-15); color: var(--rill-text-3); }
.segment__item[aria-selected="true"] { color: var(--rill-text); font-weight: var(--rill-fw-medium); }
.segment__item[aria-selected="true"]::after { content: ""; position: absolute; bottom: 0; width: 40%; height: 2px; border-radius: 2px; background: var(--rill-accent); }

dialog.sheet__panel { position: fixed; margin: 0; border: 0; padding: 0; max-width: none; max-height: none; background: var(--rill-surface); color: var(--rill-text); }
dialog.sheet__panel::backdrop { background: transparent; }
.sheet__scrim { position: fixed; inset: 0; z-index: var(--rill-z-overlay); background: var(--rill-overlay); }
.sheet__panel { position: fixed; inset-inline: 0; bottom: 0; z-index: var(--rill-z-dialog); max-height: var(--rill-sheet-max-h); background: var(--rill-surface); border-radius: var(--rill-radius-16) var(--rill-radius-16) 0 0; box-shadow: var(--rill-shadow-3); padding-bottom: calc(var(--rill-space-24) + env(safe-area-inset-bottom)); }
.sheet__handle { width: 36px; height: 4px; margin: var(--rill-space-8) auto var(--rill-space-4); border-radius: var(--rill-radius-full); background: var(--rill-surface-3); }
.sheet__row { display: flex; align-items: center; gap: var(--rill-space-8); height: 56px; padding-inline: var(--rill-space-16); border-bottom: var(--rill-border-w) solid var(--rill-border); font-size: var(--rill-fs-15); font-weight: var(--rill-fw-medium); }
.sheet__row--danger { color: var(--rill-danger); }
.sheet__about { padding: var(--rill-space-16); font-size: var(--rill-fs-13); line-height: var(--rill-lh-relaxed); color: var(--rill-text-2); }
.switch { position: relative; margin-left: auto; width: 44px; height: 26px; border: 0; border-radius: var(--rill-radius-full); background: var(--rill-surface-3); }
.switch[aria-checked="true"] { background: var(--rill-accent); }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: var(--rill-surface); transition: transform var(--rill-dur-base) var(--rill-ease); }
.switch[aria-checked="true"]::after { transform: translateX(18px); }
@media (min-width: 768px) {
  .sheet__panel { inset: 50% auto auto 50%; transform: translate(-50%, -50%); width: var(--rill-sheet-w); max-height: 70vh; border-radius: var(--rill-radius-16); }
}

/* ---------- 10.6 反馈：toast / 空态 ---------- */
.toast {
  position: fixed; left: 50%; bottom: calc(var(--rill-tabbar-h) + var(--rill-space-16) + env(safe-area-inset-bottom));
  z-index: var(--rill-z-toast); max-width: calc(100% - 32px); height: 40px;
  display: flex; align-items: center; padding-inline: var(--rill-space-16);
  border-radius: var(--rill-radius-12); background: var(--rill-toast-bg); color: var(--rill-toast-text);
  font-size: var(--rill-fs-13); font-weight: var(--rill-fw-medium); box-shadow: var(--rill-shadow-2);
  pointer-events: none; transform: translateX(-50%);
}
.empty { display: grid; justify-items: center; gap: var(--rill-space-16); padding: var(--rill-space-40) var(--rill-space-16); text-align: center; }
.empty__title { margin: 0; font-size: var(--rill-fs-17); font-weight: var(--rill-fw-medium); }
.empty__text { margin: 0; font-size: var(--rill-fs-13); color: var(--rill-text-3); }
.chip { display: inline-block; padding: 2px var(--rill-space-6); border-radius: var(--rill-radius-4); background: var(--rill-surface-2); color: var(--rill-accent); font-size: var(--rill-fs-13); }
.tab { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; min-height: var(--rill-tabbar-h); color: var(--rill-text-3); text-decoration: none; font-size: var(--rill-fs-11); font-weight: var(--rill-fw-medium); }
.tab[aria-current="page"] { color: var(--rill-accent); }
.tab__icon { width: var(--rill-icon); height: var(--rill-icon); }
:focus-visible { outline: 2px solid var(--rill-focus); outline-offset: 2px; }
```

---

*本文档全部视觉资产（颜色、字阶、间距、图标 path、动效曲线）均为自制，不含原 app 的任何资源、字体、图标或布局 XML。*