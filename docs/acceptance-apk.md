# 溪流 APK 终局验收（t36）

**验收对象**：`8b96e3039dd524eff1a7b0f36de0b4c7758d4e80`（main）→ Android run [`43854529005`](https://github.com/boaom/rill/actions/runs/43854529005) / web run [`43854529046`](https://github.com/boaom/rill/actions/runs/43854529046)，Release [`apk-run-8`](https://github.com/boaom/rill/releases/tag/apk-run-8)。
**验收日**：2026-11-16。**执行者**：verifier（净室复刻项目组成员）。**本机环境**：macOS arm64、Node 26.10、Chrome 157 无头、**无 Android SDK / 无 aapt2 / 无 docker**。

## 0. 关于任务书里那条被更正过的判据

任务书原文「`dist/assets/*.js` 里 `m.weibo.cn` 命中 = 0」是**错的**，captain 已实测证伪并在本轮任务里给出更正口径。本报告**采纳更正**：`m.weibo.cn` 在 web 主包出现 **2 次**，两处都是**给用户看的界面文案**（`Search.tsx:142` 的只读搜索说明、`LoginPage.tsx:74` 的登录指引），它们必须存在。真正可判"是否直连"的是**代码形态**，见 §A.3。

**本报告分两次：§0–§F 是 t36 的原始验收（判 `failed`）；§G 是 t39 复验（F1/F2/F3 修完后的实测）——F1 已修，t36 的原判定与 findings 保留不删。**

**先说 t36 的结论：本报告当时判 `failed`。** 不是"整体可用但有瑕疵"——是 **A/B/D 全部通过、C 的 Release 诚实性一项不成立**（Release body 把已经打进 APK 的设备直连写成"本轮尚未接入、后续版本接入"，与包内实际内容矛盾），另有一条既有的判据口径问题（AC-G09）需要 captain 裁定。三条 finding 见 §F。

---

## A · web 零回归

### A.1 门禁

| 命令 | 退出码 | 输出 |
| --- | --- | --- |
| `pnpm run check:mock` | 0 | `[check:mock] OK {"users":12,"statuses":30,"comments":60,"mediaDist":{…},"verified":2,"sources":12,"longPost":243}` |
| `pnpm exec tsc --noEmit` | 0 | 无输出（零错误） |
| `pnpm run build` | 0 | `dist/assets/index-D4zQu_1e.js` **248,175 B**（vite 报 240.65 kB │ gzip 76.56 kB；`gzip -9` 实测 76,337 B）、`client-B05abvGR.js` 21,824 B、`index-D98iynny.css` 45,512 B |
| `node scripts/check-hit.mjs` | 0 | **PASS 39 / FAIL 0**（ALL PASS） |

构建可复现性：`rm -rf dist node_modules/.vite` 后重建，产物与 APK 内文件**逐字节相同**（sha256 前缀 `e86ef4f8f708`），连跑 3 次不变。

### A.2 主包隔离（按更正后的 4 条判据）

| # | 判据 | 实测 | 结论 |
| --- | --- | --- | --- |
| 1 | 主包无设备直连实现：`grep -c 'CapacitorHttp\|weibo-direct\|weiboDirect'` | `index-D4zQu_1e.js` = **0**；全 `dist/assets/*.js` 也 = **0** | ✅ |
| 2 | 无以绝对微博主机为 base 的请求：`fetch(.https://m.weibo.cn` / `baseURL.*m.weibo.cn` | **0** / **0** | ✅ |
| 3 | Capacitor 运行时符号在主包 = 0（`@capacitor`/`registerPlugin`/`Capacitor.Plugins`） | **0 / 0 / 0** | ✅ |
| 4 | 主包体积相对 t31 基线（`index-BDudWUes.js` = **246,156 B**，同 lockfile 同工具链重建）增量 <2 KiB | **248,175 − 246,156 = +2,019 B（+0.82%）**，`gzip -9` 75,528 → 76,337（**+809 B**） | ✅ 余量 **29 B**（见 F3） |

补充事实（不是判据，但要说清）：主包里 `m.weibo.cn` 出现 **2 次**，都是 UI 文案（上下文：`"只读搜索；内容来自微博（m.weibo.cn）…"`、`"在浏览器打开 <b>m.weibo.cn</b> 并登录…"`）；`isNativePlatform` 出现 **1 次**，是模式检测 `window.Capacitor?.isNativePlatform?.()`。设备实现被 Rollup 拆到懒加载 chunk（`client-*.js` 21,824 B），web 用户永远不请求它（见 §B.3 的网络层证据）。

### A.3 57 行 AC 逐条（49 旧 + 8 新）

判定口径：**受影响** = 相关文件在 `0847cff..8b96e30` 内被改过（`App.tsx`、`LoginPage.tsx`、`device-login-copy.ts`、`api.ts`、`src/device/**`、`Online*.tsx`、`Search.tsx`）；**不受影响** = 离线四条主线的组件/CSS/mock 一行未动。受影响的 8 行（AC-LT/VF）本轮全部用 CDP 脚本复跑；旧 49 行里与离线交互有关的行以 `check-hit` 39 条覆盖，其余按"代码未改 + 路由/探针抽查"记。

| 编号 | 受影响 | 结论 / 本轮依据 |
| --- | --- | --- |
| AC-TL01 | 不受影响 | posts=20、data-route=timeline、runtime-errors=0（本轮复跑） |
| AC-TL02 | 不受影响 | 未单独复跑（离线 feed tab 代码未改；check-hit 覆盖交互） |
| AC-TL03 | 不受影响 | 复跑：probe=like:p_0001 → like-count 6（基线 5 +1） |
| AC-TL04 | 不受影响 | 未单独复跑（持久化路径代码未改） |
| AC-TL05 | 不受影响 | 未单独复跑（滚动恢复代码未改） |
| AC-TL06 | 不受影响 | 未单独复跑（转发逻辑代码未改） |
| AC-TL07 | 不受影响 | 未单独复跑（详情回复计数代码未改） |
| AC-TL08 | 不受影响 | 复跑：首屏 20 条（load-more 未单独点） |
| AC-TL09 | 不受影响 | 未单独复跑（refresh 探针代码未改） |
| AC-TL10 | 不受影响 | 复跑：probe=empty → empty-state 存在 |
| AC-TL11 | 不受影响 | 复跑：probe=error → error-state 存在、runtime-errors=0 |
| AC-TL12 | 不受影响 | 未单独复跑（滚动恢复代码未改） |
| AC-DT01 | 不受影响 | 复跑：data-route=status、data-active-tab=timeline、reply-item 2 条 |
| AC-DT02 | 不受影响 | 未单独复跑（离线回复逻辑未改） |
| AC-DT03 | 不受影响 | 未单独复跑（离线点赞逻辑未改） |
| AC-DT04 | 不受影响 | 未单独复跑（滚动恢复未改） |
| AC-DT05 | 不受影响 | 未单独复跑（楼中楼数据未改） |
| AC-DT06 | 不受影响 | 未单独复跑（楼中楼折叠未改） |
| AC-DT07 | 不受影响 | 未单独复跑（转发卡跳转未改） |
| AC-DT08 | 不受影响 | 复跑：p_9999 → detail-not-found 存在 |
| AC-CP01 | 不受影响 | 未单独复跑（发布跳转未改） |
| AC-CP02 | 不受影响 | 复跑：空内容 publish-btn disabled |
| AC-CP03 | 不受影响 | 未单独复跑（媒体占位未改） |
| AC-CP04 | 不受影响 | 未单独复跑（话题计数未改） |
| AC-CP05 | 不受影响 | 未单独复跑（草稿落盘未改） |
| AC-CP06 | 不受影响 | 未单独复跑（发布后 21 条未改） |
| AC-CP07 | 不受影响 | 未单独复跑 |
| AC-CP08 | 不受影响 | 未单独复跑 |
| AC-CP09 | 不受影响 | 未单独复跑 |
| AC-PF01 | 不受影响 | 复跑：data-route=me、active-tab=me、stat-posts/following/followers 存在 |
| AC-PF02 | 不受影响 | 未单独复跑 |
| AC-PF03 | 不受影响 | 未单独复跑 |
| AC-PF04 | 不受影响 | 未单独复跑 |
| AC-PF05 | 不受影响 | 未单独复跑（设置弹层未改） |
| AC-PF06 | 不受影响 | 复跑：probe=theme:dark → html[data-theme=dark] |
| AC-PF07 | 不受影响 | 未单独复跑（重置未改） |
| AC-G01 | 不受影响 | 复跑：timeline/status/compose/me 四条路由均 data-route 正确 |
| AC-G02 | 不受影响 | 未单独复跑（非法路由回退未改） |
| AC-G03 | 不受影响 | 未单独复跑（tabbar 文案未改） |
| AC-G04 | 不受影响 | 复跑：dark 主题生效（同 PF06） |
| AC-G05 | 不受影响 | 未单独复跑 |
| AC-G06 | 不受影响 | 复跑：375 scrollWidth=clientWidth=375，卡宽 335≥320 |
| AC-G07 | 不受影响 | 复跑：768 卡宽 640、左右留白 64/64；1440 无横向滚动 |
| AC-G08 | 不受影响 | 未单独复跑（焦点样式未改） |
| AC-G09 | 不受影响 | **字面判据不再成立**：dist/assets/*.js 中 fetch( = 1（主包 backend 取数，t31 基线同样 = 1）、XMLHttpRequest = 1（device chunk 字符串）；index.html 外链 0。属**既有口径问题**，非 t34 引入；见 §A.4 与 F2 |
| AC-G10 | 不受影响 | 复跑：四条路由 + error/empty 探针 runtime-errors=0 |
| AC-G11 | 不受影响 | 复跑：grep -rnE 'app\.unique\.one|\bUnique\b|sina' src server index.html dist → 0 |
| AC-G12 | 不受影响 | 复跑：dependencies 仍精确 react+react-dom；devDeps 增加 @capacitor/* 三项（§16.4 豁免） |
| AC-G13 | 不受影响 | 复跑：probe=like:p_0001 → data-probe-applied='like:p_0001' |
| AC-LT01 | 受 A 类改动影响 | 复跑：折叠 6 行（clientH 168 = 6×28、scrollH 252）、按钮 48×44；展开/单卡解截断由 check-hit 39 条覆盖 |
| AC-LT02 | 受 A 类改动影响 | 部分复跑：折叠态图格 3（fold-baseline）；展开态 9 张沿用 t30（本次未单独计数） |
| AC-LT03 | 受 A 类改动影响 | 复跑：详情 17px / 27.2px（1.6）、[data-clamped] 0、scrollH=clientH |
| AC-VF01 | 受 A 类改动影响 | 复跑：6 条带 V 行 V.left−name.right = 3、13×13、currentColor（t32 已翻绿） |
| AC-VF02 | 受 A 类改动影响 | 部分复跑：时间线 20/20 与详情均有两处 [data-source]；**缺 source 臂未复验**（mock 20 帖全有 source，无法构造） |
| AC-VF03 | 受 A 类改动影响 | 复跑：375 读数条两项（30 条 / 100 图）；1440 卡 x=400 w=310、.side--stats x=1060 w=260 |
| AC-VF04 | 受 A 类改动影响 | 复跑：.reply__n = rgb(103,104,95) = --rill-text-3，#C22F1C accent 不同 |
| AC-VF05 | 受 A 类改动影响 | 复跑：暗色全节点扫描 5 个页面 below45 = []（含 compose） |

**汇总：57 行中 56 行成立；`AC-G09` 的字面判据不成立**（见 F2）。这与 t34 无关：在 t31 基线（`0847cff`）重建的产物里 `fetch(` 同样是 **1**（backend 取数那处），该行的"0 命中"口径早就与实现脱节。

### A.4 S1–S8 复验数字（375×812，CDP）

| 项 | 实测 |
| --- | --- |
| 折叠 | `p_0007` clamp=6、clientH 168 = 6×28、scrollH 252、按钮 **48×44**；展开后解截断（check-hit） |
| 折叠态图片 | 3 张（展开态 9 张沿用 t30） |
| 详情 | fontSize **17px**、lineHeight **27.2px**（1.6）、`[data-clamped]` **0**、scrollH=clientH、来源「来自 iPhone 15 Pro Max」 |
| V 标 | 6 条带 V 行 `V.left − name.right` = **3.00**、13×13、`color===borderColor===昵称色` |
| 读数条 | 375：`30 条 / 100 图` 两项；1440：feed 内不可见、`.side--stats` x=**1060** w=**260** |
| 回复编号 | `.reply__n` = `rgb(103,104,95)` = `--rill-text-3`（≠ accent `#C22F1C`） |
| 对比度 | 暗色 5 个页面全节点扫描 `below45 = []` |
| 断点 | 768：卡宽 **640**、左右留白 **64/64**；1440：卡 x=**400** w=**310**、`scrollWidth=1440` 无横向滚动 |

---

## B · 设备直连（无真机、无真 cookie，按层验）

### B.1 纯函数层

`node --test test/device-provider.test.mjs` → **rc=0，tests 21 / pass 21 / fail 0**。覆盖：字段映射（`idstr ?? id`、`u_` 前缀）、文本清洗（HTML 实体/换行/话题）、错误分类（`AUTH_EXPIRED` / `RISK_CONTROL` / `UPSTREAM`）、cookie 前缀归一（`SUB`/`SUBP`/数字 uid 四种形态）、`verified` 判定（`verified_type 0/-1/false` 不伪造认证）、超时不泄漏请求头、`setUnverifiedWritesEnabled(false)` 一键只读。输入来自 `test/fixtures/weibo-2019.json`（对应 `docs/weibo-api.md` 的真实响应形状）。

### B.2 集成层（自写 CDP + 自写假上游 + 自写断言）

不复用 builder 的 `scripts/check-device-direct.mjs`（只把它当作可复跑的对照，复跑结果 PASS）。我的 harness：静态伺服 `dist`、本地假上游按后缀应答、`Page.addScriptToEvaluateOnNewDocument` 把 `window.Capacitor` 打桩为 `{isNativePlatform:()=>true}`、Chrome 带 `--disable-web-security`、`Network.requestWillBeSent` 记录每一条请求。**14/14 通过**：

| 场景 | 断言 | 结果 |
| --- | --- | --- |
| 正常浏览器（无桩、无 `--disable-web-security`） | 无 `window.Capacitor`、未加载 `client-*.js`、按离线 mock 渲染 20 条 | ✅ |
| 正常浏览器 | 对 `m.weibo.cn` / `weibo.com` 的请求数 = **0** | ✅ |
| 正常浏览器登录页 | 不出现设备端专用指引（`F12` / `传到手机`） | ✅（观察项） |
| 原生壳登录页 | 出现「在电脑上打开浏览器登录 m.weibo.cn → F12 → … → 传到手机」 | ✅ |
| 原生壳登录 | 粘贴 `SUB=FAKE…` → `login-success`，SUB 前缀归一通过 | ✅ |
| 设备 200 | 时间线渲染 **1 条**（`搬完这块砖… #日常#`）、`window.__dev` 记录 2 次映射调用 | ✅ |
| 凭证纪律 | cookie 值不在 DOM；只落 `localStorage['rill:v1:device-cookies']` | ✅ |
| 设备 432 | `error-state` = 「触发了风控…」 | ✅ |
| 设备 `ok:0` | `error-state` = 「触发了风控…」 | ✅ |
| 设备 302→passport | `auth-error` = 「需要重新登录…」 | ✅ |
| 设备 200（恢复） | 错误态不粘住，时间线回到 1 条 | ✅ |
| 设备超时（客户端 10 s） | `error-state` = 「内容没有加载出来…」 | ✅ |

> 这台 harness 的第一版有 4 条**误报的** FAIL（我拿 `#app[data-mode]` 这个根本不存在的属性当断言、又在 `data-post-count` 还是 `0` 时就读、超时只等 1.2 s 而客户端超时是 10 s）。**写错的断言和恒真的断言一样能把结论带偏**，改正后才得到上表。

### B.3 web 用户不会被误导成直连模式

三条独立证据：①正常浏览器下 `window.Capacitor` 不存在、`client-*.js` **未被请求**；②网络层对 `weibo.cn` 的请求 **0** 条；③页面按离线 mock 渲染 20 条、无任何"直连/设备"字样。

### B.4 凭证纪律

| 检查 | 结果 |
| --- | --- |
| 我的假 cookie（`FAKE_T36_COOKIE*` / `SUB=fake…` / `SUBP=fake…`）在 `dist/` | **0** |
| 同上在 APK 的 `assets/public/*` 与 `classes*.dex` | **0** |
| 仓库里"看起来像真 cookie"的常量（`SUB=<≥20 字符>`）在 `dist/src/server/scripts/test` | **0 / 0 / 0 / 0 / 0** |
| CI 脚本是否会打印 cookie | `scripts/`、`test/` 内无 `SUB=` 常量；CI 只跑 `check-hit`（纯离线） |
| **CI 日志本身** | ✗ **未能验证**：匿名 `GET /actions/runs/43854529005/logs` → **HTTP 403**，本机无 token。此项**计入未验证清单**，不冒充通过 |

---

## C · APK 产物取证

### C.1 存在性与匿名下载

```
$ curl -sIL https://github.com/boaom/rill/releases/download/apk-run-8/app-debug.apk
HTTP/2 302  (location: release-assets.githubusercontent.com/...)
HTTP/2 200  content-type: application/vnd.android.package-archive
            content-length: 4138153
```
下载：**4,138,153 B**，sha256 `54ff8980a276a775e25689f2afc3d040b09117207a7b0b98b53dd5f19ab3c9ac`。**未带任何 token**。Release 标记 `prerelease: true, draft: false`。

### C.2 `unzip -l` 关键内容

```
  8398240  classes.dex           (另有 classes2–6.dex，共 6 个 dex)
    21824  assets/public/assets/client-B05abvGR.js
   248175  assets/public/assets/index-D4zQu_1e.js
    45512  assets/public/assets/index-D98iynny.css
     1465  assets/public/index.html
```
`res/mipmap-anydpi-v26/ic_launcher.xml`、`ic_launcher_round.xml` 与 18 个图标 PNG 均在包内。

### C.3`aapt2 dump badging` 的等价证据

**本机没有 Android SDK（`aapt2` 不存在）**，所以走了两条独立的路：

1. **CI 侧 aapt2（Release body 内联，来自 run 8 的 `APK evidence` 步骤）**：`package: name='one.rill.app' versionCode='1' versionName='1.0'` / `minSdkVersion:'24'` / `targetSdkVersion:'36'` / `uses-permission: android.permission.INTERNET` / `application-label:'溪流'` / `launchable-activity: name='one.rill.app.MainActivity' label='溪流'`。
2. **我自己的二进制 AXML 解析器**（`/tmp/verifier/t36/axml.py`，直接解 `AndroidManifest.xml` 的 string pool + resource map，不依赖任何 Android 工具）：

| 元素 | 解析结果 |
| --- | --- |
| `<manifest>` | `package=one.rill.app`、`versionCode=1`、`versionName=1.0`、`compileSdkVersion=36` |
| `<uses-sdk>` | `minSdkVersion=24`、`targetSdkVersion=36` |
| `<uses-permission>` | `android.permission.INTERNET`、`one.rill.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` |
| `<activity>` | `name=one.rill.app.MainActivity`、`exported=true`、`launchMode=2` |
| `<intent-filter>` | `android.intent.action.MAIN` + `android.intent.category.LAUNCHER` |

两条路的结果**逐字段一致** ⇒ 包的标识与可启动入口成立。

### C.4 APK 内 web 产物 vs 同一提交的本地构建：**逐字节一致**

| 文件 | APK 内 | 本地清缓存重建 | sha256（前 12 位） | 比对 |
| --- | --- | --- | --- | --- |
| `index-D4zQu_1e.js` | 248,175 B | 248,175 B | `e86ef4f8f708` / `e86ef4f8f708` | **IDENTICAL** |
| `client-B05abvGR.js` | 21,824 B | 21,824 B | `36a50c612e4f` / 同 | **IDENTICAL** |
| `index-D98iynny.css` | 45,512 B | 45,512 B | `79f19a6a1813` / 同 | **IDENTICAL** |
| `index.html` | 1,465 B | 1,465 B | `cmp` 无差异 | **IDENTICAL** |

> 过程中的一个坑值得记一笔：我最初拿 `apk-run-7`（`e3743f6`）跟**当前工作树**比，发现"哈希不同、体积差 305 B"，差点记成"包不是这个提交的"。真相是我开工后仓库又前进了一个提交（`8b96e30` 修复登录/搜索文案），而我比较的是**两个不同 sha**。换成 `apk-run-8` ↔ `8b96e30` 后逐字节一致。**"产物对不上"的第一个假设应该是"我比错了对象"**。

### C.5 Release body 诚实性（逐条）

| 要求 | Release body 原文 | 判定 |
| --- | --- | --- |
| ① debug 签名、升级可能需卸载 | 「这是**未签名发布版（Android debug 签名）**…」「debug keystore 不固定…覆盖安装旧版本时可能需要先卸载」 | ✅ |
| ② 在线功能的真实状态 | 「**在线登录功能本轮尚未接入**：当前 APK 是离线版本，使用随包 mock 数据；直连微博将在后续版本接入。」 | ✗ **不实** → **F1** |
| ③ 需允许"未知来源安装" | 「安装需在 Android 设置中允许"未知来源"」 | ✅ |

②为什么不实：这个包的 web 产物里**就在**设备直连实现（`client-B05abvGR.js`，含 `weibo-direct` 代码、懒加载）与设备登录指引（`LoginPage` 渲染「在电脑上打开浏览器登录 m.weibo.cn → F12 → … → 传到手机」）；App 的模式判定在原生壳下会返回 `device`。也就是说**用户装上后会看到设备直连登录入口**，而 Release 说"本轮尚未接入、后续版本接入"——两者矛盾。正确写法应是"已接入设备直连，但未用真实账号端到端验证；默认仍可用离线 mock"。

### C.6 可安装性下限

`aapt2` 可解析（CI）+ AXML 可解析（本地）✅；`classes.dex` 存在 ✅；`assets/public/index.html` 存在 ✅；`AndroidManifest.xml` 有 `INTERNET` 与 launcher activity ✅。**"装到手机上能跑"没有验证过**——本机无真机、无 SDK/模拟器，此结论只能在真机上得出。

---

## D · 图标资产独立复核

我不采信 designer 的数字，用 PIL 从 PNG 像素重算（阈值：与四角背景色的 RGB 距离 > 36 记为"主体"；透明像素不计）：

| 资产 | 主体占比 | 主体/背景对比度 | 判据 | 结论 |
| --- | --- | --- | --- | --- |
| `mipmap-mdpi/ic_launcher.png` **48×48** | **66.8%** | 墨 `rgb(0,0,0)` vs 背景 `rgb(255,255,255)` = **21.0:1**；朱红 `rgb(189,35,16)` = **6.16:1** | ≥4.5:1、55–80% | ✅ |
| 48→**24×24**（LANCZOS 缩放，低密度观感） | **70.0%** | 墨 **21.0:1**；朱红 `rgb(211,62,43)` = **4.67:1** | 同上 | ✅（朱红余量小，0.17） |
| `mipmap-xxxhdpi/ic_launcher.png` **192×192** | **60.0%** | 墨 **21.0:1**；朱红 **6.42:1** | 同上 | ✅ |
| 自适应前景 432² | 非透明 bbox **(88,93)–(346,340)** | — | 完全落在 264 安全区 **[84,348]** | ✅ |
| 自适应合成（前景+背景） | **整画布 26.0%**（分母 186,624 px）/ **72dp 遮罩圆 66.8%**（分母 65,144 px，直径 288 px） | 墨 `rgb(11,11,11)` = **19.68:1** | 两个分母都打印 | ✅ |
| `splash.png` 2732² | 主体 bbox **(1164,1156)–(1568,1572)**，占画布宽 14.8% | — | 落在中心 1/3 **[910.7, 1821.3]** | ✅ |

**与 designer 数字的差异（必须说清）**：他们报 48=72.3%、24=75.9%、192=64.9%，我算出来是 66.8% / 70.0% / 60.0%——差异来自"主体"的阈值与抗锯齿边缘处理（我按 RGB 距离 >36 且 alpha≥128 计）。**两组数字都落在 55–80% 判据内，但绝对值不可混用**；这正是"不采信 designer 数字、自己重算"的意义。

**APK 内资源与仓库源文件**：18 对 PNG（5 档密度 × 方形/圆形/前景 + 自适应前景/背景 + splash）逐像素相等（`pixels_equal=True`），说明打进包的图标与仓库里审过的图标是同一批。证据图：`docs/shots/apk-icon-48.png`、`apk-icon-24.png`、`apk-icon-adaptive-composite.png`、`apk-splash-2732.png`。

---

## E. 未验证清单（本轮没有覆盖，不许当成通过）

1. **真机安装与运行**——无 Android 设备/模拟器，`aapt2` 也只能证明包结构合法。**"装上去能跑"未验证。**
2. **真实微博 cookie 全链路**——设备直连的 200/432/302/超时全部是假上游；真实账号的读/写一次都没跑过。假上游不能证明真站可用。
3. **Play 商店签名**——只有 CI 生成的不固定 debug 签名，没有 upload key/App Bundle。
4. **OTA 升级路径**——debug keystore 每次不同，覆盖安装可能必须卸载；升级保数据未验证。
5. **CI 日志内容**——匿名 API 403，无法确认日志里没有凭证痕迹（只验证了脚本里没有 cookie 常量）。

---

## F. Findings

| id | 严重度 | 问题 | 需要的修法 |
| --- | --- | --- | --- |
| **F1** | **high** | Release body 写「在线登录功能本轮尚未接入…直连微博将在后续版本接入」，而 `apk-run-8` 内确实打进了设备直连实现与设备登录指引，用户装上即可进入 device 模式 —— 发布说明与交付物矛盾 | 改 `.github/workflows/android.yml` 的 Release 模板：`apk-run-9+` 写明"设备直连已接入，但未用真实账号验证；默认仍可用离线 mock"，并保留 debug 签名/未知来源两条 |
| **F2** | medium | `AC-G09` 的字面判据（`dist/assets/*.js` 中 `fetch(` = 0）与实现脱节：t31 基线重建即为 1（backend 取数），本轮再加 1 处 `XMLHttpRequest`（device chunk 里的字符串） | captain 二选一：①按 `§16.4` 把判据收窄为「主包无 `@capacitor`/无绝对微博主机请求/DOM 无未授权外链」（推荐，与本轮 A.2 口径一致）；②改实现让 device chunk 不出现该字样（无意义） |
| **F3** | low | 主包增量 +2,019 B，距 **2 KiB 门槛只剩 29 B**；下一个改动极易越线 | 要么把判据写成"≤2.5 KB 且逐次记录"，要么在 t37 先回收几十字节（如内联一份重复文案） |

**其余项全部通过**：门禁 rc0、check-hit 39/0、主包隔离 4 条、57 行 AC 中 56 行成立、纯函数 21/21、集成 14/14、web 非触发三条证据、APK 匿名下载 + 结构 + 标识 + 逐字节一致、图标 48/24 对比度与占比、自适应安全区、splash 中心 1/3。

---

*本文件由 verifier 独立复验生成；未修改 `src/`、`android/`、`server/`、`.github/`。*

---

# G · t39 复验（2026-11-17）：F1 / F2 / F3 三条改前 → 改后 → 证据

> **t36 的原始判定与 findings 一字未删**，保留在 §0–§F 作为历史记录。本节只回答一件事：t36 判 failed 的那条（F1 Release 说明不实）以及 F2/F3 两条口径，**现在到底修好了没有**。

**冻结（先冻结再取证，t36 的坑不再踩第二次）**：`HEAD = 531b08bd49b73e7a4545542d04ccf651c39be396`（main），对应 Release [`apk-run-9`](https://github.com/boaom/rill/releases/tag/apk-run-9)（Android run [`44014678296`](https://github.com/boaom/rill/actions/runs/44014678296) success / web run [`44014678019`](https://github.com/boaom/rill/actions/runs/44014678019) success）。比对用的本地构建来自**该 sha 的独立 worktree**（`git worktree add --detach 531b08b`），不是"当前工作树"。
**注意**：抓取时工作树里 `docs/spec.md`、`docs/capability-map.md` 有 **60 行未提交改动**（t38 的 AC 收窄），`git show HEAD:docs/spec.md | grep -c AC-G14` = **0** —— 下面的口径核验针对**工作树版本**，并已把"未提交"记成 F4。

| 项 | 改前（t36 判定） | 改后（本轮实测） | 结论 |
| --- | --- | --- | --- |
| **F1** Release 说明不实 | body 写「在线登录功能本轮尚未接入…直连微博将在后续版本接入」，包内却有 device chunk + 设备登录指引 | body 写「**已含设备直连登录（App 内登录 + 手动粘贴兜底）**」，且包内确有 device chunk + 原生登录插件 | ✅ **已修** |
| **F2** AC-G09 口径 | 旧判据「`dist/assets/*.js` 中 `fetch(` = 0」在 t31 基线即为 1，判据本身错 | AC-G09 改为**运行时级**（`externalOrigins = 0`）+ 新增 AC-G14 **产物级**；旧口径在 §13.2 标注废弃并写清原因 | ✅ **已修**（记录未落位见 F4） |
| **F3** 体积门槛 | `<2 KiB`，t34 实测 +2,019 B 只剩 29 B 余量 | 门槛改 **≤2,560 B**；本轮 248,457 B = **+2,301 B**，余量 **259 B** | ✅ **已修** |

## G.1 A · Release body 一致性（F1，本轮重点）

**禁用短语（必须 0 命中）**——对 `apk-run-9` body 原文 `grep -c`：

| 短语 | 命中 |
| --- | --- |
| 尚未接入 | **0** |
| 未接入 | **0** |
| 后续版本接入 | **0** |
| 离线版本 | **0** |
| 直连微博将在 | **0** |

**必须出现（三条必写信息 + 能力声明）**：

| 必须写 | 命中 | body 原文 |
| --- | --- | --- |
| 已含设备直连登录（App 内登录 + 手动粘贴兜底） | 1 | 「**已含设备直连登录（App 内登录 + 手动粘贴兜底）**：原生壳会优先进入设备直连模式，在 App 内打开 m.weibo.cn 登录，用户点“我已登录完成”后读取 Cookie…App 内登录不可用时仍可在同一页面手动粘贴 Cookie」 |
| ① debug 签名 / 升级可能需先卸载 | 2 / 1 | 「未签名发布版（Android debug 签名）」「debug keystore 不固定…覆盖安装旧版本时可能需要先卸载」 |
| ② 需允许"未知来源安装" | 1 | 「安装需在 Android 设置中允许“未知来源”」 |
| ③ 真实微博未用真实账号端到端验证 | 1 | 「真实微博未用真实账号端到端验证…本地假上游只验证代码路径，不代表真实站点一定可用」 |
| 构建提交 = 冻结 sha | 1 | `531b08bd49b73e7a4545542d04ccf651c39be396` |

**双向反证（两边都要对得上）**：

| 方向 | 证据 | 结论 |
| --- | --- | --- |
| body 说"已含设备直连登录" → 包里真有吗？ | `unzip -l`：`assets/public/assets/client-4dZQ0HMz.js`（21,797 B，device 分块）、`login-native-Bg4GQUwd.js`（1,041 B）、`NativeLogin-gsLqDNus.js`（1,098 B）；`strings classes*.dex` 有 `Lone/rill/app/WeiboLoginPlugin;`、`Lone/rill/app/WeiboLoginActivity;`、`Lone/rill/app/MainActivity;` | ✅ 对得上 |
| body 说"App 内登录" → 原生侧真有吗？ | `AndroidManifest.xml`（自写 AXML 解析）：`<activity name="one.rill.app.WeiboLoginActivity" exported="false">` 存在；`uses-permission` 仅 `INTERNET` + 动态接收器权限 | ✅ 对得上 |
| 反向：body 若说"未接入"而包内有 device chunk/插件 | 禁用短语 5 条全部 0 命中 | ✅ 不存在该矛盾 |

> 归因：t36 F1 的根因是 `.github/workflows/android.yml` 的 Release 模板停留在 t33 文案（"本轮尚未接入"）。t37 只改模板 + 加插件，**改的是文案与能力两侧**，所以这次两边能对上；不是"只把话说漂亮了"。

## G.2 B · App 内登录证据

**B4 · APK 内原生证据**

| 证据 | 命令 | 输出 |
| --- | --- | --- |
| 插件/Activity 类在 dex 里 | `strings dex/classes*.dex \| grep -E 'WeiboLogin'` | `Lone/rill/app/WeiboLoginPlugin;`、`Lone/rill/app/WeiboLoginActivity;`、`Lone/rill/app/WeiboLoginActivity$$ExternalSyntheticLambda0;`、`WeiboLoginPlugin.java`、`WeiboLoginActivity.java`（共 7 处 `WeiboLogin`） |
| Manifest 里登录 Activity 且不导出 | `python3 axml.py axml/AndroidManifest.xml` | `<activity name="one.rill.app.WeiboLoginActivity" exported=False>`；`<activity name="one.rill.app.MainActivity" exported=True launchMode=2>` + `MAIN`/`LAUNCHER` |
| 权限未扩张 | 同上 | `uses-permission` 只有 `android.permission.INTERNET` 与 `one.rill.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` |

**B5 · JS 侧错误分支（插件打桩，CDP 真点击，375×812）**：3/3 通过。

| 桩 | 点击 `[data-testid="login-native"]` 后 | 手动粘贴入口 | 白屏 | `data-runtime-errors` |
| --- | --- | --- | --- | --- |
| `Plugins: {}`（插件缺失） | 「App 内登录不可用（未找到原生插件），请手动粘贴 Cookie。」 | 在（`login-input` + 「手动粘贴 Cookie（备用）」+ 提交按钮） | 否（innerText 312 字符） | `0` |
| `openLogin: () => Promise.reject({code:'CANCELLED'})` | 「已取消 App 内登录。 已保留手动粘贴入口。」 | 在 | 否（302 字符） | `0` |
| `openLogin: () => { throw new Error('boom') }` | 「App 内登录失败。 已保留手动粘贴入口。」 | 在 | 否（300 字符） | `0` |

截图：`docs/shots/apk-native-login-missing.png`、`docs/shots/apk-native-login-cancelled.png`。三条都在 `data-route="login"` 上停留，页面未跳走、未白屏，且插件抛错后**手动粘贴仍在同一屏**（这就是"回退"而不是"换个页面重来"）。

**B6 · 未验证边界（明确不推测）**：真机点「App 内登录微博」能否真正完成登录、微博是否弹验证码/风控页、`CookieManager.getCookie` 在真实 `m.weibo.cn` 上是否返回完整 `SUB`/`SUBP` —— **全部未验证**。本机无 Android 设备/模拟器；插件编译通过、错误分支可用、WebView 能加载 URL 的代码路径存在，**不等于"登录可用"**。

## G.3 C · APK 与凭据

| 项 | 结果 |
| --- | --- |
| 匿名 `curl -sIL` | **HTTP/2 200**，`content-type: application/vnd.android.package-archive`，`content-length: 4142662`，无 token |
| 文件 | **4,142,662 B**，sha256 `5bd5fb6fb414972e6cf178ce1e091b06a2159bd8c93388a3b3f930b06d4b2212` |
| `unzip -l` | `classes.dex` 8,398,240 + `classes2..6.dex`、`assets/public/index.html` 1,465、6 个 web 资源（见下表） |

**逐字节一致（APK-9 ↔ 531b08b 的独立 worktree 构建）**——任务书要求的 4 个文件全中，另 2 个新增分块也一致：

| 文件 | APK | 本地 | sha256（前 12） | 比对 |
| --- | --- | --- | --- | --- |
| `index-DOAv0mww.js` | 248,457 B | 248,457 B | `102090ddb4f1` | **IDENTICAL** |
| `client-4dZQ0HMz.js` | 21,797 B | 21,797 B | `0c5e9fc847c8` | **IDENTICAL** |
| `index-D98iynny.css` | 45,512 B | 45,512 B | `79f19a6a1813` | **IDENTICAL** |
| `index.html` | 1,465 B | 1,465 B | `1ae2d93a43b0` | **IDENTICAL** |
| `login-native-Bg4GQUwd.js` | 1,041 B | 1,041 B | `0e879beb8839` | **IDENTICAL** |
| `NativeLogin-gsLqDNus.js` | 1,098 B | 1,098 B | `3cccc1cc1f19` | **IDENTICAL** |

**凭据纪律（假 cookie 标记值，逐处 grep）**

| 位置 | 命令 | 命中 |
| --- | --- | --- |
| Release body | `grep -c 'FAKE39_MARK\|SUB=FAKE39\|fakesubp39\|FAKE_NATIVE39' release9-body.md` | **0**（四个标记逐个 0） |
| APK `assets/public/*` | `unzip -p apk9.apk 'assets/public/*' \| grep -c <标记>` | **0**（四个标记逐个 0） |
| APK `classes*.dex` | `strings dex/classes*.dex \| grep -c <标记>` | **0**（四个标记逐个 0） |
| 仓库（真 cookie 形态常量 `SUB=<≥20 字符>`） | `grep -rEo 'SUB=[A-Za-z0-9_%.-]{20,}' dist src server scripts test android \| wc -l` | dist **0** / src **0** / server **0** / scripts **0** / test **0** / android **0** |
| **CI 日志** | `curl -s -o /dev/null -w '%{http_code}' .../runs/44014678296/logs` | **403**（匿名不可读 → 未验证，见 §H） |
| **CI artifacts** | `curl -L .../actions/artifacts/<id>/zip`（两个 artifact） | **401**（需登录 → 未验证，见 §H） |

> 结论只覆盖能读到的地方：**body / APK(assets+dex) / 仓库 = 0 命中**；CI 日志与 artifacts 两条腿**读不到就写读不到**，不拿"应该不会有"当 0。

## G.4 D · 新口径逐条验

**AC-G09（运行时级）**：离线模式下 CDP 抓包（`Network.requestWillBeSent`），5 条路由各一次：

| 路由 | 同源请求数 | `externalOrigins` | `data-runtime-errors` |
| --- | --- | --- | --- |
| `#/timeline` | 4 | `[]` | `0` |
| `#/status/p_0001` | 4 | `[]` | `0` |
| `#/compose` | 4 | `[]` | `0` |
| `#/me` | 4 | `[]` | `0` |
| `#/search` | 4 | `[]` | `0` |

`externalOrigins.length = **0**`（精确 0）✅

**AC-G14（产物级）**：主包 `index-DOAv0mww.js`

| 判据 | 实测 |
| --- | --- |
| ① 实现符号 0×6 | `CapacitorHttp` 0、`registerPlugin` 0、`registerWebPlugin` 0、`CapacitorCookies` 0、`CapacitorException` 0、`CAPACITOR_` 0 |
| ② `Capacitor` 仅探测 1 次且邻接 `isNativePlatform` | 总数 **1**，上下文 `function aa(){return!!window.Capacitor?.isNativePlatform?.()}` |
| ③ 主包无以微博主机为 base 的请求 | `fetch(` 实参含 `weibo.` = **0**；`.open(` 实参含 `weibo.` = **0** |
| ③b ⓐ 主包对 device 分块无静态引用 | `from"./client-…"` = **0**，`import("./client-…")` = **1** |
| ③b ⓑ 只在原生分支加载 | 调用点 `async function Hu(){if(aa()){const r=await Ke(); …}`，`Ke(){return vf(()=>import("./client-4dZQ0HMz.js"))}`，`aa()=!!window.Capacitor?.isNativePlatform?.()` |
| ④ `index.html` 无外链 | `https?://` = **0** |

**旧口径（`fetch(` = 0）已废弃**：`docs/spec.md` §13.2 有独立小节「旧口径（已废弃，勿再引用）」+ 三条废弃原因（会漏/会误伤/与行为不是一回事）+ t34 的反面例子（`['m','weibo','cn'].join('.')` 拼主机、主包 2 处文案）。

**AC-G15（体积门槛 ≤2,560 B）**：

| 日期 | commit / 场景 | 产出 | 字节 | 增量 | 剩余余量 |
| --- | --- | --- | --- | --- | --- |
| t31 基线 | 冻结基线 | `index-BDudWUes.js` | 246,156 | — | 2,560 |
| t34 / t36 | 设备直连分块并入 | `index-D4zQu_1e.js` | 248,175 | +2,019 | 541 |
| **t39 / 本轮** | `531b08b`（App 内登录插件 + `login-native`/`NativeLogin` 两个新分块） | `index-DOAv0mww.js` | **248,457** | **+2,301** | **259** |

device 分块 21,797 B（t36 为 21,824 B，**缩小 27 B**），新增两条分块 1,041 + 1,098 B 不计入主包门槛但在此备注。主包增量 +2,301 B ≤ 2,560 B ✅（vite 报 240.90 kB │ gzip 76.71 kB）。

**web 零回归**：`node scripts/check-hit.mjs`（在冻结构建上跑）→ **PASS 39 / FAIL 0**。

## G.5 t39 新增 findings（归因与判定分开）

| id | 严重度 | 问题 | 归因 | 需要的动作 |
| --- | --- | --- | --- | --- |
| **F4** | medium | `AC-G15` 自身要求「每次构建必须 §13.2 记录表续写一行」，而该表现在末行仍是「（待续）…下一次 `pnpm run build` 必须在此续写一行」，t37 的 248,457/+2,301 **没有写进去**；另外 t38 的 60 行 spec 改动（AC-G09 收窄 + AC-G14/G15 新增）**仍在工作树未提交**（`git show HEAD:docs/spec.md \| grep -c AC-G14` = 0） | 文档侧未收尾（不是构建/实现问题），不在 t39 可改范围 | 由文档 owner 把 §G.4 的这行表格补进 `docs/spec.md §13.2` 并提交；否则 AC-G15 的"记录"半句在仓库里查不到 |
| **F5** | low | 凭据纪律的 CI 侧两条腿读不到：`/runs/44014678296/logs` → 403，两个 artifact zip → 401 | GitHub 匿名权限限制（非本仓库缺陷） | 已列入未验证清单；若需覆盖，得用带 token 的账号或用 `gh run view --log` |
| **F6** | low | APK 内 web 资源从 4 个变 6 个（新增 `login-native-*` 1,041 B、`NativeLogin-*` 1,098 B），Release body 未提这条变化 | 说明信息缺口，不是不实陈述 | 可在下次 Release 模板里加一句"含 2 个按需加载的登录分块" |

**判定**：F1/F2/F3 三条 t36 判据**全部修好**；本轮实测项全绿（Release 一致、插件证据、错误分支、匿名下载、逐字节、AC-G09/G14/G15、check-hit 39/0）。F4 是**记录落位与提交**的缺口（文档 owner 的活），F5 是权限导致的未验证，二者都不改变上面这些实测结论，但也不许被"整体通过"盖掉。

---

# H · 未验证清单（t39 更新版，延续 §E，不许当成通过）

1. **真机安装与运行**——无设备/模拟器；`unzip`/AXML/dedex 只能证明包结构与类存在。
2. **真实微博 cookie 全链路**——设备直连的 200/432/302/超时全是假上游；真实账号一次都没跑。
3. **App 内登录实机成功**——WebView 能否完成真实登录、微博是否弹验证码/风控页、`CookieManager` 是否返回完整 `SUB`/`SUBP`，**均未验证**（错误分支 ≠ 成功路径）。
4. **Play 商店签名 / OTA 升级**——只有不固定的 debug 签名，覆盖安装可能要卸载；升级保数据未验证。
5. **CI 日志与 artifacts 内容**——匿名 403/401，无法确认其中无凭证痕迹（只验证了 body/APK/仓库三处为 0）。
6. **`docs/spec.md` 的 t38/t37 记录行是否最终提交**——抓取时 60 行改动未提交（F4）。

*本节由 verifier 于 t39 复验后追加；t36 的原始 failed 判定与 F1–F3 findings 保留在 §0–§F，未改动。*
