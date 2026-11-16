# 方向 A · 日报 Rill Daily · tokens

> 原型：`A/index.html`（三屏 + 1440 时间线；`?only=timeline|detail|compose` 单屏模式）
> 截图：`shots/{timeline,detail,compose}-375.png` + `shots/timeline-1440.png`
> 基线：`docs/design.md` 的 84 个 `--rill-*` token（亮色 19 + 字族字阶 14 + 间距 12 + 圆角描边阴影 10 + 动效层级 10 + 结构尺寸 19 = 84；暗色另有 22 条覆写）

**form 来自内容的哪里**：一天 30 条 / 12 人、正文大多只有 2 行，图片（1–9 张）是唯一的大图形 —— 用「日期做头条 + 数字做图形 + 严格四列栅格」把一天排成一版报纸，而不是把每条做成一张卡。

**外观家族**：暖白纸 + 墨黑 + 朱红；圆角 0、阴影 0　**温度**：大胆

---

## 1. 颜色（19 项，亮色）

| token | design.md | 本方向 | 状态 |
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

亮色实测（正文/次要/强调 对底）：正文 `19.68:1`、次要 `9.4:1`、三级 `5.64:1`、强调 `5.65:1`、强调底上的字 `5.65:1`、赞色 `5.65:1`、危险色 `7.13:1`。

## 2. 暗色（22 条覆写，同一规则派生：底色压到同一明度族 → 文字反相 → 强调色提亮到 ≥4.5:1）

| token | 派生值 | 对派生底的实测对比度 |
| --- | --- | --- | --- |
| `--rill-bg` | #0F0F0F | 1.0:1 |
| `--rill-surface` | #1B1B1B | 1.11:1 |
| `--rill-surface-2` | #252525 | 1.25:1 |
| `--rill-surface-3` | #313131 | 1.47:1 |
| `--rill-border` | #353535 | 1.56:1 |
| `--rill-border-strong` | #747474 | 4.1:1 |
| `--rill-text` | #EDEDED | 16.37:1 |
| `--rill-text-2` | #A2A2A2 | 7.51:1 |
| `--rill-text-3` | #878787 | 5.34:1 |
| `--rill-accent` | #D97E72 | 6.55:1 |
| `--rill-accent-pressed` | #E29B92 | 8.52:1 |
| `--rill-accent-soft` | #2F1511 | 1.13:1 |
| `--rill-on-accent` | #FFFFFF | 19.17:1 |
| `--rill-like` | #D97E72 | 6.55:1 |
| `--rill-danger` | #D77669 | 6.1:1 |
| `--rill-overlay` | rgba(0, 0, 0, .62) | — |
| `--rill-toast-bg` | #EDEDED | 16.37:1 |
| `--rill-toast-text` | #0F0F0F | 1.0:1 |
| `--rill-focus` | #D97E72 | 6.55:1 |

> **暗色截图：`shots/timeline-375-dark.png`**（`?theme=dark`）。实测最低对比度 **5.93:1**、最小字号 12、0 裁切、0 重叠；暗色占比 53.3%、亮色 10.5%（读数条与发布块反相成浅块）。反相用的是成对变量（`--rill-statbar-bg/fg/label`、`--rill-pub-bg/fg/sub`），不是写死 #fff，所以换主题不会翻车。

## 3. 字族与字阶（14 项）

| token | design.md | 本方向 | 状态 |
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

## 4. 间距（12 项）

| token | design.md | 本方向 | 状态 |
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

## 5. 圆角 · 描边 · 阴影（10 项）

| token | design.md | 本方向 | 状态 |
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

## 6. 动效 · 层级（10 项）

| token | design.md | 本方向 | 状态 |
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

## 7. 结构尺寸（19 项）

| token | design.md | 本方向 | 状态 |
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

## 8. 新增 token（design.md 里没有）

| 新 token | 值 | 用途 |
| --- | --- | --- | --- |
| `--rill-fs-display` | 62px | 日期头条的字号（桌面 96px） |
| `--rill-fs-num` | 25px | 卡片内计数读数 |
| `--rill-statbar-h` | 70px | 底部读数条高度 |

## 9. 迁移成本估计

| 项 | 量 |
| --- | --- |
| 变动的 token | **42** 个（颜色 + 字阶 + 圆角阴影 + 结构尺寸里与基线不同者） |
| `src/styles/tokens.css` | 约 **70** 行（亮色 45 + 暗色 22 + 新增 3），文件仍是「只放变量」 |
| 组件层重写 | 约 **186** 行 CSS（本方向原型扣掉 tokens 段后的组件样式；原型 CSS 总量 203 行） |
| 要动的文件 | `src/styles/tokens.css`、`src/styles/app.css`（`.rill-app` / `.rill-col` / 头部 / tabbar）、`src/styles/components.css`（卡片 / 详情 / 发博 / reply / 计数行）、`src/ui/*.js`（无（纯视觉替换）） |
| 不动的东西 | 数据层（`store.js` / `mock.json`）、路由、testid、13 条探针 |

**结论**：A 是「tokens.css 换值 + 组件层重写 186 行」的量级，spec 没有任何结构变化。

## 10. 与 spec / design.md 的冲突清单

1. **无结构性冲突**。日期头条替代的是「卡片之间的分隔线」，作者行/正文 6 行截断/1–9 图格/转发引用/计数行/回复都还在原位置，testid 语义不变。
2. `--rill-content-max: 640px` 保留：桌面版是把 640 的正文放进「日期栏 + 双列卡 + 读数栏」三栏里，不是把正文拉宽。
3. 圆角/阴影归零会让 `design.md §2.4` 的「卡片是唯一有阴影的层」失效——这是这条方向的有意取舍（报纸没有圆角），落地时要在 design.md 里改写那句。

## 11. 度量证据（截图里量出来的）

| 屏 | 尺寸 | 最小 / 最大字号 | 最低对比度 | 横向溢出 | 四件套纵向位置（top–bottom，px） |
| --- | --- | --- | --- | --- | --- |
| timeline | 375×812 | 12 / 62 | 5.64:1（`span` 12px） | 0 | author=146–168, body=175–231, media=241–576, counts=576–630, counts2=631–705 |
| detail | 375×812 | 12 / 16 | 5.64:1（`em` 12px） | 0 | author=79–101, body=109–137, media=147–247, counts=249–303 |
| compose | 375×812 | 12 / 16 | 5.64:1（`em` 12px） | 0 |  |
| timeline（桌面） | 1440×900 | 12 / 96 | 5.64:1 | 0 | — |

- 三屏与桌面版**零外链、零位图、零 CDN 字体**（`performance.getEntriesByType('resource')` 为空，`img/link/script[src]/use[href]` 计数 0）。
- 重叠检测（`tools/overlap.expr.js`，已排除 tabbar/FAB 这类浮层）：375 三屏 **0** 处重叠、1440 **0** 处；越出屏幕 0 处。
- 点按区抽查：可见屏里 **44×44 以下的可点元素 0 个**（计数行/段选/返回/发布/底栏都补到 44）。
- 主题对照（`?theme=dark|light`）：见上方截图与数据。

