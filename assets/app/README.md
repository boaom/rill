# APK 视觉资产（A「日报」方向）

生成脚本：[`scripts/gen-app-assets.py`](../../scripts/gen-app-assets.py)（**唯一来源，可复现**：`python3 scripts/gen-app-assets.py`，零外链、只用 Pillow + 本地字体）。
人眼确认页：[`docs/shots/app-icon-preview.png`](../../docs/shots/app-icon-preview.png)（1200×1180：1024 基准图标 + 192 + 48 + 24 + 圆形 + 自适应两层/合成 + splash 缩略）。

## 1. 设计

A 的语言是「报纸 / 日报」：**纸面 + 墨色刊头块 + 一条朱红报眉**。图标不是"把界面缩成一个小截图"，而是把 A 的**报头结构**抽成一个可缩到 24px 的记号：

- 墨色刊头块（方形、零圆角，与 A 里所有卡片一致的"报纸块感"）；
- 块内**反白一个 `R`**（溪流 / Rill 的首字母），Arial Black（笔画最粗的本地字体），保证在 48×48 与 24×24 下反白字不被糊掉；
- 块下一条**朱红报眉线**（A 里唯一的彩色，`--rill-accent`），相当于报纸的报眉/日期条。

字体策略（**没有偷偷兜底**）：

| 用途 | 字体 | 为什么 |
| --- | --- | --- |
| 图标主标 `R` | `/System/Library/Fonts/Supplemental/Arial Black.ttf` | 几何、笔画均匀，24px 下仍成立（实测见 §4） |
| splash 副标「溪流 · RILL」 | `/System/Library/Fonts/Supplemental/Songti.ttc`（宋体） | 报纸刊头本来用宋体，这是**设计选择**而非缺字体兜底 |

> **为什么主标不用「溪」单字**：24×24 下实测会碎成 8 个连通块、最大块只占 70% 墨量（`R` 标记是 4 块 / 96%）。密集笔画在 24px 粘连成一团纹理，读不出字。所以主标用 `R`，「溪流」只在 splash 里当副标（那里有 2732px 可用）。

## 2. 文件清单

| 文件 | 尺寸 | 用途 | 放到 Android 工程的路径 |
| --- | --- | --- | --- |
| `icon-foreground.png` | 432×432 | 自适应图标**前景**（`@capacitor/assets` 的 `icon-foreground`） | `android/app/src/main/res/drawable/ic_launcher_foreground.png` |
| `icon-background.png` | 432×432 | 自适应图标**背景**（纯纸色） | `android/app/src/main/res/drawable/ic_launcher_background.png` |
| `mipmap-*/ic_launcher.png` | 48 / 72 / 96 / 144 / 192 | 兼容方形图标（自绘圆角，**不依赖系统裁切**） | `android/app/src/main/res/mipmap-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_launcher.png` |
| `mipmap-*/ic_launcher_round.png` | 48 / 72 / 96 / 144 / 192 | 圆形图标（自绘圆） | 同上目录 `ic_launcher_round.png` |
| `icon-legacy.png` | 192×192 | 方形图标母版（`xxxhdpi` 的同一图） | 可覆盖 `mipmap-xxxhdpi/ic_launcher.png`，或给 iOS/商店用 1024 派生 |
| `splash-2732x2732.png` | 2732×2732 | 启动图母版（Capacitor 按密度切） | `android/app/src/main/res/drawable/splash.png`（或 `@capacitor/assets` 的 `splash`） |

**谁生成、谁复制**：

- 若走 `@capacitor/assets`：把 `assets/app/icon-foreground.png`、`icon-background.png`、`icon-legacy.png`（作为 `icon-only`）与 `splash-2732x2732.png` 放进 `assets/` 后跑 `npx @capacitor/assets generate --android`，它会自动切出 `mipmap-*/ic_launcher*` 与各密度 splash。
- 若**手工替换**（不需要装 `@capacitor/assets`）：本目录的 `mipmap-*/` 五档已按 Android 密度规范切好（48/72/96/144/192），逐个复制到上表路径即可；圆形图标一并复制。

**替换后重建**：

```bash
# 手工路径
cp -R assets/app/mipmap-* android/app/src/main/res/
cp assets/app/icon-foreground.png android/app/src/main/res/drawable/ic_launcher_foreground.png
cp assets/app/icon-background.png android/app/src/main/res/drawable/ic_launcher_background.png
cp assets/app/splash-2732x2732.png android/app/src/main/res/drawable/splash.png
# 或 @capacitor/assets 路径
npx @capacitor/assets generate --android
# 然后
npx cap sync android && (cd android && ./gradlew assembleDebug)
```

> 注：`android/` 目录不归本任务维护（t33 负责），上面只是目标路径约定。

## 3. 配色（全部取自 A 的 token，无第四色相）

| 色值 | 用途 | 对应 token（`A/index.html` 的 `:root`） |
| --- | --- | --- |
| `#FFFFFF` | 纸面 / 图标底 / 反白字 | `--rill-bg` |
| `#F1F1EE` | 备用纸色（预览页底色，资产本身未用） | `--rill-surface-2` |
| `#0B0B0B` | 墨色刊头块 | `--rill-text` |
| `#C22F1C` | 报眉线 | `--rill-accent` |

对比度（WCAG，脚本每次运行都打印）：墨 vs 纸 **19.68:1**，朱红 vs 纸 **5.65:1**（阈值 4.5）。

## 4. 硬判据实测（脚本内断言，失败即抛异常）

```
墨 vs 纸 对比度 19.68:1（要求 >=4.5）
朱红 vs 纸 对比度 5.65:1（要求 >=4.5）
自适应前景非透明包围盒 (88, 93, 346, 340)，安全区 [84,348] → 在内
方形图标 192×192: 主体占比 64.9%（要求 55%–80%）
方形图标 48×48: 主体占比 72.3%（要求 55%–80%）
方形图标 24×24: 主体占比 75.9%（要求 55%–80%）
自适应合成 432: 主体占整画布 26.1%，占 72dp 遮罩区 58.6%（后者才是用户看到的比例）
splash 主体包围盒 (1162, 1153, 1572, 1573)，中心 1/3 区 [911,1821] → 在内
24×24 R 反白标记: 中间调像素 151 / 576 = 26.2%
```

- **安全区**：432 画布下 264×264 安全区是 `[84,348]`，前景非透明像素 `(88,93)–(346,340)` **完全在内**（只留 2px 抗锯齿余量）。
- **48×48 可辨认**：主体占比 72.3%（区间 55–80%），对比度 19.68:1；`48×48` 的 ASCII 拓片能看到完整的 `R`（竖干 + 上碗 + 斜腿）。
- **自适应图标的占比口径**：Android 会把 108dp 画布**遮罩到 72dp**（面积只剩 44%），所以"主体占整张 432 画布 26.1%"是错觉；**用户看到的是占遮罩区 58.6%**，落在 55–80% 内。两个数字都打印出来，避免用大分母自我安慰。
- **splash 居中**：主体（刊头 + 副标）包围盒 410×420，落在中心 1/3（911–1821）正中，四周留白 >59%。

## 5. 在 A 的 375 时间线上的定位（一句话）

> 图标就是时间线上那条**日期头**的等比例缩影 —— 62px 的日期头是纸面上一块墨色刊头，图标把刊头抽成一个 `R` 方块 + 一条朱红报眉；把图标拉回 375 屏，它读起来应该是"今天这份日报的报头"，而不是"某个 App 的 Logo"。