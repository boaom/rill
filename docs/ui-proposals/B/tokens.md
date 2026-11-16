# 方向 B · 此刻 Rill Now · tokens

> 原型：`B/index.html`（三屏 + 1440 时间线；`?only=timeline|detail|compose` 单屏模式）
> 截图：`shots/{timeline,detail,compose}-375.png` + `shots/timeline-1440.png`
> 基线：`docs/design.md` 的 84 个 `--rill-*` token（亮色 19 + 字族字阶 14 + 间距 12 + 圆角描边阴影 10 + 动效层级 10 + 结构尺寸 19 = 84；暗色另有 22 条覆写）

**form 来自内容的哪里**：每条正文只有 2 行，一条占不满一屏，但「什么时候」永远确定（12:00）—— 把 86px 时间戳做成版面主角，一屏一条，用滑动代替列表，详情就是把同一屏往下摊开。

**外观家族**：近黑底 + 单墨白；零彩色、零圆角（除胶囊）　**温度**：大胆

---

## 1. 颜色（19 项，亮色）

| token | design.md | 本方向 | 状态 |
| --- | --- | --- | --- |
| `--rill-bg` | #0D1312 | #0A0A0A | 替换 |
| `--rill-surface` | #151D1C | #101010 | 替换 |
| `--rill-surface-2` | #1E2826 | #1A1A1A | 替换 |
| `--rill-surface-3` | #293431 | #262626 | 替换 |
| `--rill-border` | #25302E | #2A2A2A | 替换 |
| `--rill-border-strong` | #66756F | #6E6E6E | 替换 |
| `--rill-text` | #E9EFED | #F2F2F2 | 替换 |
| `--rill-text-2` | #A6B3AF | #A9A9A9 | 替换 |
| `--rill-text-3` | #859490 | #7E7E7E | 替换 |
| `--rill-accent` | #4ADFC1 | #F2F2F2 | 替换 |
| `--rill-accent-pressed` | #6FE7CE | #D4D4D4 | 替换 |
| `--rill-accent-soft` | #123330 | #1E1E1E | 替换 |
| `--rill-on-accent` | #06201B | #0A0A0A | 替换 |
| `--rill-like` | #FF7B72 | #F2F2F2 | 替换 |
| `--rill-danger` | #FF7A6B | #FF7A6B | 沿用 |
| `--rill-overlay` | rgba(0, 0, 0, .62) | rgba(0, 0, 0, .62) | 沿用 |
| `--rill-toast-bg` | #E9EFED | #F2F2F2 | 替换 |
| `--rill-toast-text` | #111A19 | #0A0A0A | 替换 |
| `--rill-focus` | #4ADFC1 | #F2F2F2 | 替换 |

本方向基调实测（正文/次要/强调 对底）：正文 `17.68:1`、次要 `8.42:1`、三级 `4.88:1`、强调 `17.68:1`、强调底上的字 `17.68:1`、赞色 `17.68:1`、危险色 `7.78:1`。

## 2. 亮色（B 是暗底基调，这里是从暗底反相派生的亮色版：12 项，其余沿用）

| token | 派生值 | 对派生底的实测对比度 |
| --- | --- | --- | --- |
| `--rill-bg` | #F2F2F2 | 1.0:1 |
| `--rill-surface` | #FFFFFF | 1.12:1 |
| `--rill-surface-2` | #E8E8E8 | 1.09:1 |
| `--rill-surface-3` | #DCDCDC | 1.22:1 |
| `--rill-border` | #D2D2D2 | 1.35:1 |
| `--rill-border-strong` | #8A8A8A | 3.08:1 |
| `--rill-text` | #0A0A0A | 17.68:1 |
| `--rill-text-2` | #4E4E4E | 7.43:1 |
| `--rill-text-3` | #6B6B6B | 4.76:1 |
| `--rill-accent` | #0A0A0A | 17.68:1 |
| `--rill-accent-pressed` | #333333 | 11.29:1 |
| `--rill-accent-soft` | #EEEEEE | 1.04:1 |
| `--rill-on-accent` | #FFFFFF | 1.12:1 |
| `--rill-like` | #0A0A0A | 17.68:1 |
| `--rill-danger` | #A52A1B | 6.37:1 |
| `--rill-overlay` | rgba(0, 0, 0, .44) | — |
| `--rill-toast-bg` | #0A0A0A | 17.68:1 |
| `--rill-toast-text` | #F2F2F2 | 1.0:1 |
| `--rill-focus` | #0A0A0A | 17.68:1 |

> **亮色截图：`shots/timeline-375-light.png`**（`?theme=light`）。实测最低对比度 **4.76:1**、最小字号 12、0 裁切、0 重叠。⚠️ **B 的辨识度只在暗底成立**：换成亮色后深色像素从 50.8% 掉到 **1.8%**，和 C（1.4%）几乎一样 —— 「零彩色近黑」这条身份在亮色下会消失。这是选型决策信息，不是补图。

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
| `--rill-lh-tight` | 1.35 | 1.25 | 替换 |
| `--rill-lh-normal` | 1.5 | 1.75 | 替换 |
| `--rill-lh-relaxed` | 1.6 | 1.85 | 替换 |
| `--rill-fw-regular` | 400 | 400 | 沿用 |
| `--rill-fw-medium` | 500 | 500 | 沿用 |
| `--rill-fw-semibold` | 600 | 600 | 沿用 |
| `--rill-tracking-tight` | -0.01em | -0.05em | 替换 |

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
| `--rill-radius-4` | 4px | 2px | 替换 |
| `--rill-radius-8` | 8px | 4px | 替换 |
| `--rill-radius-12` | 12px | 6px | 替换 |
| `--rill-radius-16` | 16px | 8px | 替换 |
| `--rill-radius-20` | 20px | 10px | 替换 |
| `--rill-radius-full` | 999px | 999px | 沿用 |
| `--rill-border-w` | 1px | 1px | 沿用 |
| `--rill-shadow-1` | 0 1px 2px rgba(0, 0, 0, .40) | none | 弃用（归零） |
| `--rill-shadow-2` | 0 6px 20px rgba(0, 0, 0, .48) | 0 6px 20px rgba(0,0,0,.50) | 替换 |
| `--rill-shadow-3` | 0 16px 40px rgba(0, 0, 0, .56) | 0 16px 40px rgba(0,0,0,.60) | 替换 |

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
| `--rill-header-h` | 52px | 96px | 替换 |
| `--rill-tabbar-h` | 56px | 56px | 沿用 |
| `--rill-hit` | 44px | 44px | 沿用 |
| `--rill-avatar` | 40px | 40px | 沿用 |
| `--rill-avatar-sm` | 32px | 28px | 替换 |
| `--rill-avatar-lg` | 64px | 64px | 沿用 |
| `--rill-icon` | 24px | 24px | 沿用 |
| `--rill-icon-sm` | 18px | 18px | 沿用 |
| `--rill-card-pad-y` | 12px | 14px | 替换 |
| `--rill-card-pad-x` | 16px | 20px | 替换 |
| `--rill-media-gap` | 4px | 2px | 替换 |
| `--rill-media-ratio` | 16 / 9 | 1 / 1 | 替换 |
| `--rill-line-clamp` | 6 | 6 | 沿用 |
| `--rill-textarea-min` | 168px | 120px | 替换 |
| `--rill-compose-bar-h` | 56px | 64px | 替换 |
| `--rill-sheet-max-h` | 82vh | 82vh | 沿用 |
| `--rill-sheet-w` | 480px | 480px | 沿用 |

## 8. 新增 token（design.md 里没有）

| 新 token | 值 | 用途 |
| --- | --- | --- | --- |
| `--rill-fs-clock` | 86px | 时间戳字号（桌面 128px） |
| `--rill-photo-ratio` | 1 / 1 | 满版照片位比例（视频位为 16 / 9） |
| `--rill-pager-h` | 30px | 滑动指示行高度 |

## 9. 迁移成本估计

| 项 | 量 |
| --- | --- |
| 变动的 token | **40** 个（颜色 + 字阶 + 圆角阴影 + 结构尺寸里与基线不同者） |
| `src/styles/tokens.css` | 约 **68** 行（亮色 43 + 暗色 22 + 新增 3），文件仍是「只放变量」 |
| 组件层重写 | 约 **139** 行 CSS（本方向原型扣掉 tokens 段后的组件样式；原型 CSS 总量 156 行） |
| 要动的文件 | `src/styles/tokens.css`、`src/styles/app.css`（`.rill-app` / `.rill-col` / 头部 / tabbar）、`src/styles/components.css`（卡片 / 详情 / 发博 / reply / 计数行）、`src/ui/*.js`（时间线从列表改成分页 → `timeline.js` 要改渲染与滚动恢复） |
| 不动的东西 | 数据层（`store.js` / `mock.json`）、路由、testid、13 条探针 |

**结论**：B 是「tokens.css 换值 + 组件层重写 139 行」的量级，唯一要 spec 让步的是「时间线可否一屏一条」（§4.7 的可滚动列表假设）。

## 10. 与 spec / design.md 的冲突清单

1. **结构化冲突 1**：时间线从「可滚动列表」变成「一屏一条 + 滑动翻页」，触及 `spec.md §4.7` 的滚动位置恢复（AC-TL06 的 `data-scroll-restored` 语义要重写：记页码而不是 scrollTop）。
2. **结构化冲突 2**：`--rill-tabbar-h` 仍在，但底栏是三个手绘图标（并入 C4 的「tabbar 是产品的手」），`design.md §3.1` 的「文字标签优先」在本方向被图标替代 → 必须给图标补 `aria-label`，否则 AC 的可用性检查会挂。
3. 强调色被弃用（accent = 正文色）：`design.md §2.1` 的单一强调色纪律在本方向改成零彩色纪律，点赞态用实心而不是变色 → 若 AC-DT05 查颜色，要改成查 `aria-pressed`。
4. **四件套顺序 vs spec §4.2 卡片结构表**：时间线是「满版照片 → 作者行 → 正文 → 计数」（media=129–504 → author=504–558 → body=566–622 → counts=622–652），详情屏保持原序（author=79–101 → body=109–137 → media=147–247 → counts）。**我查过 AC：没有一条断言顺序** —— AC-TL01 只查 `timeline-root` 存在 / `data-post-count ≥ 20` / `data-route`，AC-DT01 只查详情正文不带 `data-clamped=6`。所以这个改动**不会挂任何现有 AC**，需要改的是 `spec.md §4.2` 那张卡片结构表（或加一句「时间线卡片顺序可换，详情必须原序」）。captain 已裁定：原型不承担 AC 约束，落地时一次性改 spec，并把受影响的 AC 放宽为「信息层次可辨（作者/正文/计数可区分）」而非硬顺序。

## 11. 度量证据（截图里量出来的）

| 屏 | 尺寸 | 最小 / 最大字号 | 最低对比度 | 横向溢出 | 四件套纵向位置（top–bottom，px） |
| --- | --- | --- | --- | --- | --- |
| timeline | 375×812 | 12 / 86 | 4.88:1（`em` 12px） | 0 | media=129–504, author=504–552, body=552–608, counts=608–654 |
| detail | 375×812 | 12 / 26 | 4.88:1（`em` 12px） | 0 | author=52–98, media=110–485, body=485–541, counts=541–587 |
| compose | 375×812 | 12 / 26 | 4.88:1（`p` 16px） | 0 |  |
| timeline（桌面） | 1440×900 | 12 / 128 | 4.88:1 | 0 | — |

- 三屏与桌面版**零外链、零位图、零 CDN 字体**（`performance.getEntriesByType('resource')` 为空，`img/link/script[src]/use[href]` 计数 0）。
- 重叠检测（`tools/overlap.expr.js`，已排除 tabbar/FAB 这类浮层）：375 三屏 **0** 处重叠、1440 **0** 处；越出屏幕 0 处。
- 点按区抽查：可见屏里 **44×44 以下的可点元素 0 个**（计数行/段选/返回/发布/底栏都补到 44）。
- 主题对照（`?theme=dark|light`）：见上方截图与数据。

