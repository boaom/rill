# huashu-design 作业书（用在 Rill / 溪流 上）

> 任务 t12 · 产出者 scout · 对象仓库 `<workspace>/huashu-design`（82M，depth 1，v3.3.0）
> 本文只回答一件事：**这份 skill 的哪些章节我们要照做、哪些明确不做、脚本跑不起来时怎么降级。**
> 六个候选方向与收敛建议在 [`candidates.md`](candidates.md)；两者是一套，别拆开看。

---

## 0. 一页结论

| 问题 | 我们的答案 |
| --- | --- |
| 我们走哪个模块 | `references/app-prototype.md`（手机 App 原型）。**不读** deck / motion / infographic / xiaohongshu 四个模块手册 |
| 三方向门走不走 | **走，100%**。六个候选已按 skill 口径生成，见 candidates.md §1–§6（2 最佳设计师 + 2 现实参照 + 2 秒数轮盘） |
| 能不能全自动跑完 script | **不能**：本机 Python 无 playwright（`ModuleNotFoundError`），`ref_board.py` / `polish.py` 截图链路失效；已给 Chrome headless + CDP 替代并**实测通过** |
| 能不能"看图打磨" | **不能**：本 runtime 模型（deepseek-v4.1-flash）不声明图像输入。打磨环降级为"客观统计 + design_lint 红灯 + 人看截图"，并在 polish-log 里如实写明 |
| 素材档位 | **T0**：真图库/程序化材质/数据即图像。Rill 的红线更严：**不外链图片、不带二进制资源** |
| 我们能带走的最大价值 | 不是管线，是**判据**：三方向门（六个候选→挑三）、外观家族不撞、可读性红线、Gate 文件、form 来自内容 |

---

## 1. 开工三件事（已跑，原文输出）

用 DSH 内置 python（`/Users/user/.dsh/dsh-runtimes/dsh-next-primary-runtime/dependencies/python/bin/python3`，Python 3.12.14）。
**先设 `HUASHU_DESIGN_HOME=/tmp/huashu-home`**——两个脚本默认写 `~/.huashu-design/`，在本工作区权限下会被拦，且会污染项目外目录。

```bash
export HUASHU_DESIGN_HOME=/tmp/huashu-home
HD=/Users/user/Downloads/crack/huashu-design
$PY "$HD/scripts/learn.py" 微博 客户端 信息流 中文排版
$PY "$HD/scripts/design_lint.py" ledger
$PY "$HD/scripts/capabilities.py"
```

| 命令 | exit | 原文输出（节选） | 对我们的含义 |
| --- | --- | --- | --- |
| `learn.py 微博 客户端 信息流 中文排版` | 0 | `## 这个用户的偏好：还没有记录（/tmp/huashu-home/experience.md）` / `## 过去项目的经验（微博、客户端、信息流、中文排版）：没有匹配的` | 无历史偏好，**不叠加任何用户口味**；三方向不带倾向 |
| `design_lint.py ledger` | 0 | `外观账本是空的（/tmp/huashu-home/ledger.jsonl）。交付后用 ledger add 记一笔，下次才能主动避开。` | 外观账本空 → 没有"最近交付同类"，六个候选**不因账本顺延** |
| `capabilities.py` | 0 | `素材档位：T0` / `生图：没探测到生图 skill` / `兄弟 skill：没有` / `工具：node ✓ ffmpeg ✓ npx ✓ playwright(py) ✗` | 素材只能 T0；截图必须自带方案 |

> 三条都不阻塞（skill 原话）。我们照跑，**没有把「没记录」当成「没问题」**。

---

## 2. 适用 / 不适用章节（照抄成纪律）

| SKILL.md 章节 | 我们 | 说明 |
| --- | --- | --- |
| 「你是谁」+ 工作室六个角色 | ✅ 照做 | Rill 是 App 原型，主导角色 = 视觉设计师 + 前端工程师，艺术总监做取舍 |
| 开工三件事 | ✅ 已跑（§1） | 用 `HUASHU_DESIGN_HOME` 隔离 |
| 路由表 | ✅ 只走 App 分支 | 见 §0 |
| 窄桥 0–7 | ✅ 逐条本地化（§4） | 每条都给了"我们怎么做 + 证据落哪" |
| 开阔地（风格库 / typography / workflow / tweaks） | ⚠️ 选读 | 只读 `design-styles.md` 的 App 12 + 中文东亚 12 两节，**不读网页 20 / PPT 20 / 信息图 20 / 小红书 8** |
| 收工四件事 | ✅ 本地化（§9） | 命令都要带 `$HD` 与 `HUASHU_DESIGN_HOME` |
| 版本检查（`git ls-remote`） | ❌ 不做 | 不联网访问远程仓库；升级由人决定，我们只记一句「vendor 在 v3.3.0」 |
| deck / motion / infographic / xiaohongshu 模块手册 | ❌ 不读 | 不是本次媒介。读了只会把"幻灯片思维"带进 App 界面 |
| `references/materials.md` 的 T1/T2 档（生图 / 兄弟 skill） | ❌ 不用 | 本机无生图、无兄弟 skill；Rill 也禁止二进制资源 |
| `editable-pptx` / `video-export` / `voiceover-pipeline` 等 | ❌ 不做 | 与本任务无关 |

---

## 3. 素材先行 vs 我们已有的东西（窄桥 1 + 4 的合并口径）

skill 说"从已有的东西出发"。我们已有的比 skill 预期的多，**这是本次最大的省力点**：

| 已有的 | 路径 | 用法 |
| --- | --- | --- |
| 四条主线的字段/交互契约 | [`../spec.md`](../spec.md) | 三方向共用同一份 spec（directions.md Phase 3 要的"共同输入"） |
| 84 个 token（`tokens.css` 106 条声明，亮/暗各一套）+ 9 个图标定义（**实际挂载 7 个**：`explore`/`bell` 只留档）+ 交互反馈 | [`../design.md`](../design.md) | **当前基线方向**（中性暖灰 + 墨绿"安静版"）。三方向是它的三种替代，不是叠加 |
| 真内容（12 用户 / 30 条 / 60 评论，中文真标题真正文） | `src/data/mock.json` | 三方向共用同一批内容，只换设计（skill 硬要求：不用 Lorem） |
| 功能裁剪依据 | [`../capability-inventory.md`](../capability-inventory.md) | 任何"要不要加一屏"的争论回这里 |

**两条纪律从这里长出来**：

1. **design.md 是基线，不是禁区**。选定方向若不是基线，就**重写 token 段**（`src/styles/tokens.css` 变量值），而不是在页面上叠一层新皮肤——否则三方向会退化成"同一骨架换配色"，正是 directions.md 第一轮踩过的坑。
2. **spec.md 的结构假设是硬约束**。当前是单列信息流（design.md §1 纪律 3）。任何方向若想改列数/改一屏预算，必须在方向卡上写明"这里要求改 spec §4.7"，由 captain 裁决——**方向卡不许偷偷改结构**（详见 candidates.md C5 的冲突声明）。

---

## 4. 窄桥 0–7 的本地执行口径

### 0 · 事实验证先于假设 —— 部分降级
`web_search` 在本会话**不可用**（`DEEPSEEK_API_KEY` 未配置，工具直接报错）。降级做法：

- 用 `curl`（带合规 UA）取页面 `<title>` 与正文片段，确认**存在性**：`tapbots.com/ivory`、`en.wikipedia.org/wiki/BeReal`、`en.wikipedia.org/wiki/Tweetbot`、`en.wikipedia.org/wiki/Henry_Steiner`、`en.wikipedia.org/wiki/Irma_Boom`、`wearecollins.com` 均 200。
- 核实过的事实写进 candidates.md 并附 URL；**没核实到的一律标"未核实"**，不写成断言（例：某个 app 的精确品牌色值，一律写"以实拍采样为准"）。
- 本项目不涉及具体产品的版本号/规格，因此 `product-facts.md` 不需要——但这条 gate 的**精神**（先查再写）照守。

### 1 · 从已有的东西出发 —— 照做
见 §3。每个方向卡必须有「form 来自内容的哪里」一句。Rill 的题材事实可用的：中文昵称 + 英文 `@handle` 混排、九图网格、转发引用块、时间戳、计数行。

### 2 · 品牌资产协议 —— **不触发**
Rill 是自造名，**没有 logo / 产品图 / VI / 字体规范**，也不得引用原 app 的任何资产（T0 §5 红线：不出现 Unique / 微博 / Weibo / sina / app.unique.one / sinaweibo）。
→ `brand-spec.md` 不产出；若将来引入"真实品牌"，这条立即变成必做。

### 3 · 三方向门 —— 照做（口径见 §5）
摆出来就停，用 `ask_user_question` 让用户选；选择原话写进 `direction-approved.md`。

### 4 · 素材先行（按能力分档）—— 只剩 T0 一档
见 §8。**每个方向必须先定"主角素材"**，且不许六个方向都是纯排版。

### 5 · 模板装饰与诚实内容 —— 照做，并加本地黑名单
skill 的删除清单（全大写小标签、「A · B · C」中点、按钮尾巴「→」、标题单词换色、非序列用 01/02/03、紫渐变、emoji 图标、左彩条圆角卡、SVG 画人）+ 我们已有的：**不用玻璃拟态、不用渐变背景、不堆投影、不用大圆角卡片**（design.md 纪律 3）。
另有一条本地红线：**头像/图片一律 CSS 占位**（首字母圆点 + 色相变量），不画人像、不引位图。

### 6 · 打磨环 —— 降级（无 playwright + 无看图能力），但**不跳过**
见 §6。每轮写 `polish-log.md`，写"哪一屏、哪个元素、怎么不对"，一轮只改最伤的三处。

### 7 · Gate 文件 —— 见 §7

---

## 5. 三方向门在我们这里的执行口径（六个候选怎么来的）

**Arithmetic（可复算，不许事后编）**

| 逻辑 | 数量 | 我们的取法 |
| --- | --- | --- |
| 最佳设计师 | 2 | C1 **COLLINS**（纽约，Brian Collins；大胆）；C2 **Henry Steiner 石汉瑞**（香港，东西方视觉语言咬合；大胆）。一位西方、一位东亚，气质不同 |
| 现实参照 | 2 | C3 **BeReal**（同为社交内容 App；大胆）；C4 **Ivory / Tweetbot（Tapbots）**（微客户端手艺；安静）。同媒介（App），非跨媒介搬运 |
| 秒数轮盘 | 2 | `date +%S` = **42** → `42 % 12 + 1 = 7`。App 分区第 **7** 号 = 中文内容瀑布流（中性 92%）；中文与东亚分区第 **7** 号 = 中国传统色·节气色谱（中性 90%） |

**轮盘读数留痕**（只用了第一 dip；第二 dip 记下来但没采用）

| dip | 时刻 | `date +%S` | `S%12+1` | App 格 | East 格 | 用了吗 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | 2026-11-16 14:26:42 | 42 | 7 | `app/07-feed-waterfall` 中文内容瀑布流 | `east/07-traditional-colors-solar-terms` 节气色谱 | ✅ 两个格都采用 |
| 2 | 2026-11-16 14:29:23 | 23 | 12 | `app/12-editorial-reader` 编辑式阅读 | `east/12-japan-magazine-dense` 日式生活杂志密排 | ❌ 备用：与 C5 同属"亮色密排"家族，且 2 号档位已满 |

**样张路径逐个 `ls` 验过（真实存在，jpg + html 双份）**

```text
$ ls -l huashu-design/assets/style-specimens/app/07-feed-waterfall.*
-rw-r--r--@ 1 user  staff   7716 Nov 16 14:24 07-feed-waterfall.html
-rw-r--r--@ 1 user  staff  83495 Nov 16 14:24 07-feed-waterfall.jpg
$ ls -l huashu-design/assets/style-specimens/east/07-traditional-colors-solar-terms.*
-rw-r--r--@ 1 user  staff   6097 Nov 16 14:24 07-traditional-colors-solar-terms.html
-rw-r--r--@ 1 user  staff  81663 Nov 16 14:24 07-traditional-colors-solar-terms.jpg
```

> **每个样张都带 `.html` 源码**（`app/` 12 jpg + 12 html，`east/` 12 + 12）。这是没有 playwright 时的最大退路：看不清样张就从它的 HTML 起改（steady-track 的做法），不必从零猜。

**注意**：C1/C2/C3/C4 不是风格库条目，没有"样张"——它们的等价物是方向卡 + 参考板截图。本机截不到真正的 App 界面（见 §6「未亲眼看到」），所以这四张卡按 skill 要求**明确标注"未亲眼看到界面"**，只写公开可核实的事实与归纳。

---

## 6. 降级声明（playwright 缺失 + 无看图能力）

### 6.1 硬事实（逐条有证据，不是猜测）

| 探测 | 命令 | 结果 |
| --- | --- | --- |
| Python playwright | `$PY -c "import playwright"` | `ModuleNotFoundError: No module named 'playwright'` |
| `capabilities.py` 体检 | 同上 | `工具：node ✓ ffmpeg ✓ npx ✓ playwright(py) ✗` |
| `polish.py` | `$PY huashu-design/scripts/polish.py` | 能启动（argparse 正常），但 `shot`/`thumbs` 依赖 playwright → 截图链路断 |
| `ref_board.py` | `$PY huashu-design/scripts/ref_board.py` | 同上，需要浏览器渲染 → 参考板做不出来 |
| 看图能力 | `read_image` | `model "deepseek-v4.1-flash" does not declare image input` |
| `web_search` | 调用 | `no API key for "DEEPSEEK_API_KEY"` |
| node / npx | `node -v` / `npx --version` | `v26.10.0` / `11.19.1`（**可用**，Node 26 自带全局 `WebSocket`） |
| Chrome | `ls "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"` | 存在（`/Applications/…`，367,696 B） |

**结论**：`ref_board.py` 与 `polish.py shot/thumbs` 在本机不可用（如实记录，没有假装跑过）。skill 允许的降级是"用手头任何截图办法逐屏截"，我们用的是 **Chrome headless + CDP**。

### 6.2 替代方案（已实测通过）

工具：[`tools/shot375.mjs`](tools/shot375.mjs)（40 行，Node 26 内置 `WebSocket`，无需 npm 依赖）

```bash
node docs/ui-proposals/tools/shot375.mjs <url-or-file://> <out.png> [width=375] [height=812]
# 强制项：--no-sandbox --user-data-dir=/tmp/... ；内部已固定这两项
```

**实测结果（真做过，不是承诺）**

| 命令方式 | 页内 `innerWidth` | 截图尺寸 | 能否代表 375 设计 |
| --- | --- | --- | --- |
| `chrome --headless --window-size=375,812 --screenshot` | **500**（`innerHeight` 725） | 375×812（把 500 宽布局缩下来） | ❌ 假 375：布局按 500 排，字距与换行都不是手机形态 |
| CDP `Emulation.setDeviceMetricsOverride {width:375,height:812,dpr:2,mobile:true}` | 375 | **750×1624**（=375 CSS × dpr 2） | ✅ 真 375 |

> **坑的准确表述**（纠正一句流行说法）：`--window-size=375` **不会**得到 500 宽的截图文件，而是**得到 375 宽的文件、但页内布局视口被钳到 500**（Headless Chrome 的最小视口）。看起来是手机图，其实是桌面排版被缩放——判读间距/字会全错。**真 375 必须走 CDP。**

**当前能力下的"打磨环"三步替代**（写进每轮 polish-log）

1. `node tools/shot375.mjs` 逐屏截真 375 图（填 `<url>` + 滚动位置或分屏 URL 参数）。
2. 客观统计（机器可读、不靠眼睛）：主色/底色占比、亮暗像素比、每屏文本行数、溢出与 `pageerror`。示例：样张 app/07 采样为 `#F0F0F2` 占 **76.9%**、亮像素 88.5%、暗像素 1.2%（这个数字比"看起来挺亮"可靠）。
3. `design_lint.py check <file>` 修红灯、删黄灯；`polish.py thumbs` 用不了 → 改看 `design_lint.py check` 的"纯色块/空屏"提示。
4. **人看**：把截图路径交给 captain/用户，由有看图能力的一方做第 8 问（"摘一件"）。模型侧不假装看过。

### 6.3 未亲眼看到（诚实声明，不许美化）

- 六格里 C1/C2/C3/C4 的**参考对象**（COLLINS/Steiner 的作品、BeReal/Ivory 的 App 界面）**没有一张是我们亲眼看到的界面截图**。C3 的截图是 Wikipedia 条目、C4 的是 Ivory 官网黑底营销页（`#05050B` 占 99.8%，只能证明"深色品牌基调"，不能当界面参考）。→ 卡片里写明"未亲眼看到界面，只核实存在性与公开描述"。
- 两个风格库样张（app/07、east/07）我们**能截到但看不到**：截图已落在 `_evidence/`，色板由脚本采样，视觉判断留给人。
- 三方向完整版做出来后，**打磨轮必须以人看图为准**；模型侧只提供客观统计与红灯修复。交付时如实写"这一版未经看图打磨"（polish-loop.md 文末的规矩）。

---

## 7. Gate 文件清单（文件不在 = 环节没做）

| Gate 文件 | 何时必须有 | 我们的落点 | 现在有没有 |
| --- | --- | --- | --- |
| `polish-log.md` | **任何设计摆给用户之前**（含三方向初稿） | `weibo-lite/docs/ui-proposals/polish-log.md`（`polish.py shot` 自动起头，用不了就手写三栏：屏/元素/怎么不对） | ❌ 待建（做出第一版时建） |
| `direction-approved.md` | 实现开工前 | 同目录；写"展示了哪几版、截图路径、**用户选择的原话**" | ❌ 待建（用户选定后才写） |
| `brand-spec.md` | 涉及具体品牌时 | —— | 不适用（Rill 无品牌资产） |
| `导演稿.md` | ≥20s 动画开工前 | —— | 不适用（不做动画） |

**纪律**：「用户说继续」授权的是进入下一步，**不是跳过这一步里的 gate**；跳过必须用户明说，并写进对应 gate 文件。

---

## 8. 素材分档结论（T0）与 Rill 的更严红线

| 项 | skill 的 T0 允许 | Rill 额外红线 | 结论 |
| --- | --- | --- | --- |
| 真图库（Wikimedia / Unsplash / Pexels） | 允许 | **不许**：交付物不出现在线图片 | 只在"看素材"阶段参考，**不进交付物** |
| 程序化材质（SVG / canvas / CSS gradient） | 允许 | 渐变仅限"极淡氛围层（opacity ≤0.08）"，不做大面积渐变底 | 允许但克制 |
| 数据即图像（把 mock.json 的数字做成图形） | 允许 | —— | **首选**：九图网格、计数行、时间轴 |
| 生成图（T1）/ 兄弟 skill（T2） | 需要装 | 不许（二进制） | 不做 |
| 基座图片 base64 内嵌（app-prototype 的"真图"默认） | skill 鼓励 | **不许**：没有位图，头像/图位一律 CSS 占位 | 采用 skill 的"诚实占位"，并把"内容必需的图"解释为**数据可视化**而非照片 |

一句话：**本机 T0 档，且我们比 skill 更严——外链图片与二进制资源一律不进交付物**。所以"主角素材"这一栏，六个方向只允许从「数据即图像 / 程序化材质 / 巨字 / 版面本身」里选。

---

## 9. 收工四件事（本地化命令）

```bash
export HUASHU_DESIGN_HOME=/tmp/huashu-home      # 或工作区内 .huashu-design（需确认权限）
HD=/Users/user/Downloads/crack/huashu-design
PY=/Users/user/.dsh/dsh-runtimes/dsh-next-primary-runtime/dependencies/python/bin/python3

# 手机口径必须显式给参数：脚本默认按 deck 量（正文 24 / 标签 16），会误放行 14px 的移动端页面
$PY "$HD/scripts/design_lint.py" check <交付文件> --viewport 375 --min-body 16 --min-label 12
$PY "$HD/scripts/design_lint.py" compare <d1> <d2> <d3> --viewport 375 --min-body 16 --min-label 12 --ignore-layout
$PY "$HD/scripts/design_lint.py" ledger check <dir-*.html>   # 空账本时无输出属正常
$PY "$HD/scripts/design_lint.py" ledger add <最终文件> --project rill --note "<来源：设计师/作品/风格>"
# polish.py shot / thumbs 不可用 → 用 tools/shot375.mjs 逐屏截图 + 人看
# learn.py harvest 只在有人工口味表态时用，本机无记录不必跑
```

> 子命令与参数已 `--help` 核对过：`check|compare|ledger{list,add,check}`，`--viewport / --min-body / --min-label / --brand / --ignore-layout / --json`。**默认值是 deck 口径**（正文 24 / 标签 16），不显式给参数就会把移动端页面判"合格"。

---

## 10. 可读性 / 对比度红线（任何风格都不豁免）

| 项 | skill 底线（content-guidelines §Web和移动端） | 我们取值 | 判读方式 |
| --- | --- | --- | --- |
| 正文 | ≥14px；移动端 16px（避免 iOS 自动缩放） | **移动端正文 16px**（严格于 14px 底线） | 截图逐屏量 |
| 标签/辅助 | ≥12px | **≥12px**；`@handle`、时间戳、计数同为 12px | 同上 |
| 行高 | 1.5–1.7；中文 1.7–1.8 | 中文正文 **1.75** | 计算行盒 |
| 正文对比度 | ≥4.5:1（WCAG AA） | **≥4.5:1**；大字 ≥3:1 | 现有 design.md tokens 已达标：`--rill-text` 17.71/14.73、`--rill-text-2` 7.72/7.91、`--rill-text-3` 5.30/5.42。**新方向若换色，必须重算这三档并写进方向卡** |
| 点击目标 | ≥44×44px | ≥44×44px | 量卡片内 icon 与 tab |
| 判读命令 | —— | `design_lint.py check --viewport 375 --min-body 16 --min-label 12` | 见 §9 |
| 留白 | "要是构图，不是内容缺席" | 同 | 第 3 问（每屏有没有让人停一下的东西） |

---

## 11. 已知坑（一次记住，别重复踩）

1. **`HUASHU_DESIGN_HOME` 必须设**：不设就写 `~/.huashu-design/`，工作区权限下会被拦（skill 在 DSH 段落里明写）。
2. **`$HD` 是 skill 根目录**，不是项目目录；`python3 "$HD/scripts/…"` 照抄，别写裸 `scripts/…`。
3. **`--window-size=375` 是假 375**（页内 `innerWidth=500`），真 375 必须 CDP `Emulation.setDeviceMetricsOverride`（§6.2 实测）。
4. **样张带 `.html` 源码**：`assets/style-specimens/{app,east}/*.html`。看不清样张时从源码起改，比重新猜一遍快。
5. **本 runtime 无看图能力 + 无 web_search**：所有"看了图觉得……"的句子都不许写；改成客观统计 + 标注"未看图"。
6. **三方向初稿要加 `--ignore-layout`**：多台手机并排会被 `design_lint.py compare` 误判成"layout 撞车"。
7. **不要用 skill 的 deck 口径量 App**：deck 正文 ≥24px 那条不适用于我们；用移动端 16px。
8. **`polish.py thumbs` 的 ✗ 判据我们拿不到**：改成"每格必须有真字体、真配色、真骨架、真标题"的人工核对清单。
9. **既有 design.md 是基线**：方向若是重写 token，就把 §2.1 的对比度列一起重算，别只换 hex。
10. **采集/证据文件放 `_evidence/`**：不散落到项目根；二进制证据不进入 `src/`。

---

*本作业书只描述流程与判据，不含原 app 的任何代码、资源或文案。*