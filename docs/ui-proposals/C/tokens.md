# 方向 C · 格子 Rill Grid · tokens

> 原型：`C/index.html`（三屏 + 1440 时间线；`?only=timeline|detail|compose` 单屏模式）
> 截图：`shots/{timeline,detail,compose}-375.png` + `shots/timeline-1440.png`
> 基线：`docs/design.md` 的 84 个 `--rill-*` token（亮色 19 + 字族字阶 14 + 间距 12 + 圆角描边阴影 10 + 动效层级 10 + 结构尺寸 19 = 84；暗色另有 22 条覆写）

**form 来自内容的哪里**：30 条里 22 条带图、图片 100 张、比例混杂（square/tall/wide，9 图占 7 条）—— 让「图的形状」当节奏，双列错落排，标题只占两行；详情才把一张卡摊平。

**外观家族**：浅冷灰底 + 白卡 + 品牌红；圆角 12、轻阴影　**温度**：中性

---

## 1. 颜色（19 项，亮色）

| token | design.md | 本方向 | 状态 |
| --- | --- | --- | --- |
| `--rill-bg` | #0D1312 | #F4F4F7 | 替换 |
| `--rill-surface` | #151D1C | #FFFFFF | 替换 |
| `--rill-surface-2` | #1E2826 | #EDEDF2 | 替换 |
| `--rill-surface-3` | #293431 | #E2E2EA | 替换 |
| `--rill-border` | #25302E | #E3E3EA | 替换 |
| `--rill-border-strong` | #66756F | #8A8A96 | 替换 |
| `--rill-text` | #E9EFED | #16161A | 替换 |
| `--rill-text-2` | #A6B3AF | #55555F | 替换 |
| `--rill-text-3` | #859490 | #6A6A76 | 替换 |
| `--rill-accent` | #4ADFC1 | #E02338 | 替换 |
| `--rill-accent-pressed` | #6FE7CE | #BC1A2C | 替换 |
| `--rill-accent-soft` | #123330 | #FDE8EA | 替换 |
| `--rill-on-accent` | #06201B | #FFFFFF | 替换 |
| `--rill-like` | #FF7B72 | #E02338 | 替换 |
| `--rill-danger` | #FF7A6B | #C81E2C | 替换 |
| `--rill-overlay` | rgba(0, 0, 0, .62) | rgba(16, 16, 22, .44) | 替换 |
| `--rill-toast-bg` | #E9EFED | #16161A | 替换 |
| `--rill-toast-text` | #111A19 | #FFFFFF | 替换 |
| `--rill-focus` | #4ADFC1 | #E02338 | 替换 |

亮色实测（正文/次要/强调 对底）：正文 `16.44:1`、次要 `6.71:1`、三级 `4.86:1`、强调 `4.28:1`、强调底上的字 `4.7:1`、赞色 `4.28:1`、危险色 `5.2:1`。

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
| `--rill-accent` | #EC7784 | 6.88:1 |
| `--rill-accent-pressed` | #F0959F | 8.68:1 |
| `--rill-accent-soft` | #351316 | 1.15:1 |
| `--rill-on-accent` | #FFFFFF | 19.17:1 |
| `--rill-like` | #EC7784 | 6.88:1 |
| `--rill-danger` | #EB6E7C | 6.44:1 |
| `--rill-overlay` | rgba(0, 0, 0, .62) | — |
| `--rill-toast-bg` | #EDEDED | 16.37:1 |
| `--rill-toast-text` | #0F0F0F | 1.0:1 |
| `--rill-focus` | #EC7784 | 6.88:1 |

> **暗色截图：`shots/timeline-375-dark.png`**（`?theme=dark`）。实测最低对比度 **4.95:1**、最小字号 12、0 重叠（标题 2 行 clamp 保留）。暗色下底色 #101014 / 卡片 #17171C，品牌红占比 1.06% 保持不变（强调色提亮到 #FF5C6B、`on-accent` 反成深墨）。

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
| `--rill-lh-tight` | 1.35 | 1.35 | 沿用 |
| `--rill-lh-normal` | 1.5 | 1.75 | 替换 |
| `--rill-lh-relaxed` | 1.6 | 1.85 | 替换 |
| `--rill-fw-regular` | 400 | 400 | 沿用 |
| `--rill-fw-medium` | 500 | 500 | 沿用 |
| `--rill-fw-semibold` | 600 | 600 | 沿用 |
| `--rill-tracking-tight` | -0.01em | -0.01em | 沿用 |

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
| `--rill-radius-4` | 4px | 4px | 沿用 |
| `--rill-radius-8` | 8px | 8px | 沿用 |
| `--rill-radius-12` | 12px | 12px | 沿用 |
| `--rill-radius-16` | 16px | 16px | 沿用 |
| `--rill-radius-20` | 20px | 20px | 沿用 |
| `--rill-radius-full` | 999px | 999px | 沿用 |
| `--rill-border-w` | 1px | 1px | 沿用 |
| `--rill-shadow-1` | 0 1px 2px rgba(0, 0, 0, .40) | 0 1px 2px rgba(16,16,22,.06) | 替换 |
| `--rill-shadow-2` | 0 6px 20px rgba(0, 0, 0, .48) | 0 6px 20px rgba(16,16,22,.10) | 替换 |
| `--rill-shadow-3` | 0 16px 40px rgba(0, 0, 0, .56) | 0 16px 40px rgba(16,16,22,.16) | 替换 |

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
| `--rill-gutter` | 16px | 16px | 沿用 |
| `--rill-header-h` | 52px | 52px | 沿用 |
| `--rill-tabbar-h` | 56px | 56px | 沿用 |
| `--rill-hit` | 44px | 44px | 沿用 |
| `--rill-avatar` | 40px | 40px | 沿用 |
| `--rill-avatar-sm` | 32px | 24px | 替换 |
| `--rill-avatar-lg` | 64px | 64px | 沿用 |
| `--rill-icon` | 24px | 24px | 沿用 |
| `--rill-icon-sm` | 18px | 18px | 沿用 |
| `--rill-card-pad-y` | 12px | 10px | 替换 |
| `--rill-card-pad-x` | 16px | 10px | 替换 |
| `--rill-media-gap` | 4px | 2px | 替换 |
| `--rill-media-ratio` | 16 / 9 | 16 / 9 | 沿用 |
| `--rill-line-clamp` | 6 | 6 | 沿用 |
| `--rill-textarea-min` | 168px | 168px | 沿用 |
| `--rill-compose-bar-h` | 56px | 60px | 替换 |
| `--rill-sheet-max-h` | 82vh | 82vh | 沿用 |
| `--rill-sheet-w` | 480px | 480px | 沿用 |

## 8. 新增 token（design.md 里没有）

| 新 token | 值 | 用途 |
| --- | --- | --- | --- |
| `--rill-col-gap` | 10px | 双列槽宽（桌面 16px） |
| `--rill-cover-square` | 100% | 封面比例：方图 |
| `--rill-cover-tall` | 133.3% | 封面比例：竖图 |
| `--rill-cover-wide` | 62.5% | 封面比例：宽图 |

## 9. 迁移成本估计

| 项 | 量 |
| --- | --- |
| 变动的 token | **31** 个（颜色 + 字阶 + 圆角阴影 + 结构尺寸里与基线不同者） |
| `src/styles/tokens.css` | 约 **61** 行（亮色 35 + 暗色 22 + 新增 4），文件仍是「只放变量」 |
| 组件层重写 | 约 **166** 行 CSS（本方向原型扣掉 tokens 段后的组件样式；原型 CSS 总量 183 行） |
| 要动的文件 | `src/styles/tokens.css`、`src/styles/app.css`（`.rill-app` / `.rill-col` / 头部 / tabbar）、`src/styles/components.css`（卡片 / 详情 / 发博 / reply / 计数行）、`src/ui/*.js`（时间线从单列改成双列 → `timeline.js` 与滚动恢复逻辑） |
| 不动的东西 | 数据层（`store.js` / `mock.json`）、路由、testid、13 条探针 |

**结论**：C 是「tokens.css 换值 + 组件层重写 166 行」的量级，唯一要 spec 让步的是「时间线是否允许双列」（§4.7 单列假设，captain 已豁免）。

## 10. 与 spec / design.md 的冲突清单

1. **已获豁免**：`spec.md §4.7` / `design.md §4.5` 的单列假设（captain 在收敛裁决里明确豁免）。若最终选 C，spec 需同步改三处：① 一屏预算（一屏从 1.6 条变成 6 张封面）② 列数（1 → 2，桌面 4）③ 卡片流（列表 → 双列错落）。
2. `--rill-line-clamp: 6` 在卡片上不生效（标题只占 2 行），只在详情正文生效 → 需新增 `--rill-title-clamp: 2`。
3. `--rill-card-pad-x` 从 16 收到 10（窄卡必须）；`--rill-media-ratio` 在封面上被 `data-r` 覆盖（1:1 / 3:4 / 16:10 三档），要在 design.md §2.7 补一句「卡片封面按图比例选档」。
4. **四件套顺序 vs spec §4.2 卡片结构表**：瀑布流卡片是「封面 → 标题 → 作者行」（media=89–256 → body=265–311 → author=319–337），详情屏保持原序（author=76–116 → body=126–182 → media=192–270 → counts=313–346）。**AC 层面同样不挂**：AC-TL01 只查要素齐备与 `data-post-count`，AC-DT01 只查详情正文不截断。要改的只有 `spec.md §4.2` 的卡片结构表 + `--rill-line-clamp` 在卡片上让位给 `--rill-title-clamp: 2`。

## 11. 度量证据（截图里量出来的）

| 屏 | 尺寸 | 最小 / 最大字号 | 最低对比度 | 横向溢出 | 四件套纵向位置（top–bottom，px） |
| --- | --- | --- | --- | --- | --- |
| timeline | 375×812 | 12 / 16 | 5.34:1（`span` 13px） | 0 | media=96–263, body=272–318, author=326–344 |
| detail | 375×812 | 12 / 16 | 4.57:1（`.pill` 13px） | 0 | author=76–116, body=126–182, media=192–270, counts=313–346 |
| compose | 375×812 | 12 / 16 | 5.34:1（`.ph1` 16px） | 0 |  |
| timeline（桌面） | 1440×900 | 12 / 16 | 5.56:1 | 0 | — |

- 三屏与桌面版**零外链、零位图、零 CDN 字体**（`performance.getEntriesByType('resource')` 为空，`img/link/script[src]/use[href]` 计数 0）。
- 重叠检测（`tools/overlap.expr.js`，已排除 tabbar/FAB 这类浮层）：375 三屏 **0** 处重叠、1440 **0** 处；越出屏幕 0 处。
- 点按区抽查：可见屏里 **44×44 以下的可点元素 0 个**（计数行/段选/返回/发布/底栏都补到 44）。
- 主题对照（`?theme=dark|light`）：见上方截图与数据。

