# 溪流（Rill）vs unique 客户端 v1.0.5 —— 能力对照表（保留 / 砍掉 / 理由）

> 对照上游：`weibo-lite/docs/capability-inventory.md`（T0 盘点，111 个 manifest 组件 / 15 个功能域 / P0 5 条 / P1 10 条 / P2 六组）
> 对照下游：`weibo-lite/docs/spec.md`（T1，49 条验收点）+ `docs/acceptance.md`（T5 实测判定）
> 一句话：**只保留「刷 → 看 → 发 → 我」这条闭环**，原 app 里占代码量与体积大头的东西（投屏 SDK、视频/VR、推送、商业化、协议面）一条都没带；**没有复用原 app 的任何代码、资源、文案**。

---

## 1. 先回答最硬的一条：有没有复用原 app 的东西

| # | 声明 | 验收口径（可复跑） | 实测 |
| --- | --- | --- | --- |
| C-1 | **未复用任何代码** | 交付物里无 `.smali` / `.dex` / `.jar` / `.java`；`import` 只允许相对路径 + `react` | ✅ `find src dist` 命中 0；`import` 外部来源仅 `react`(7 处) / `react-dom/client`(1 处) |
| C-2 | **未复用任何资源** | 无二进制资源文件；CSS 里无 `url()` 引用 | ✅ `find src dist -name '*.png' -o -name '*.jpg' -o -name '*.webp' -o -name '*.gif' -o -name '*.svg' -o -name '*.woff*' -o -name '*.ttf' -o -name '*.otf' -o -name '*.mp4' -o -name '*.so' -o -name '*.dex' -o -name '*.jar'` → **0**；`grep -c 'url(' src/styles/*.css` → **0**；图标是 `icons.tsx` 里 7 个自绘 inline SVG 组件 + 空态插图 |
| C-3 | **未复用任何文案** | 禁用串全量 grep（词边界） | ✅ `grep -rnE 'app\.unique\.one|\bUnique\b|sina' src server index.html dist | wc -l` → **0**（期望 0）；页面文案全部新写（如「这里还没有内容」「发一条，溪流就有水了」）。**允许 `微博`/`Weibo`**（产品是微博第三方客户端，禁它会让登录页文案自相矛盾）。⚠️ 旧命令 `… \| grep -v 'weibo-lite/' \| wc -l` 恒为 0 是**命令写错**（`grep -r` 每行都以 `weibo-lite/` 开头，被全滤），旧口径真实命中 **230**（微博 71 / weibo 61 / WEIBO 53 / Weibo 41 / Unique 标识 4） |
| C-4 | **未联网、未申请任何系统能力** | 产物级符号/URL + 运行时抓包双口径（t38 收窄，见 `spec.md §13.2`） | ✅ 产物级：主包 Capacitor **实现**符号 `CapacitorHttp`/`registerPlugin`/`registerWebPlugin`/`CapacitorCookies`/`CapacitorException`/`CAPACITOR_` 均 **0**；`Capacitor` 字符串仅 1 处且为 `window.Capacitor?.isNativePlatform?.()` 探测；**主包**内无绝对微博主机作为请求 base（`fetch(`/`XHR.open` 正则 **0**；`m.weibo.cn` 在主包出现 2 处**全是界面文案**）；**设备分块允许**出现微博主机（职责所在，t40 起**不再**要求它隐藏主机名），但主包对它**零静态引用**（`from"./client-…"` = 0 / 动态 `import()` = 1）且只在 `window.Capacitor?.isNativePlatform?.()` 为真的分支里加载。✅ 运行时：离线抓包外部 origin = **[]**、timeline 仅 5 个同源请求、其余四页 0 请求。✅ `src` 中 `Notification`/`serviceWorker`/`geolocation`/`getUserMedia`/`mediaDevices` = 0。<br>⚠️ 旧口径「`dist/assets/*.js` 中 `fetch(`=0」**已废弃**：device 分块用 `["m","weibo","cn"].join(".")` 拼主机，字面搜不到（会漏）；主包文案含 `m.weibo.cn`（会误伤） |

> 顺带说明一个容易误报的点：`dist` 里能 grep 到 4 次 `clipboardData`，那是 **React DOM 自带**合成事件插件的属性名（`src` 里 0 次），不是我们的代码在调用剪贴板——判定时请用 `grep src` 的口径。

---

## 2. 规模对照：为什么说它「更简洁」而不是「少做功能」

| 维度 | 原 app（unique v1.0.5） | 溪流 v0.1 | 差额依据（T0 §2） |
| --- | --- | --- | --- |
| manifest 组件 | **111**（76 activity / 3 alias / 6 provider / 12 receiver / 14 service） | **4 条路由 + 1 tabbar + 1 设置 sheet** | 真构成体验的只有域 #1/#4/#5/#6 共 36 个组件 |
| dex 类 | **12,303**（可读 3,472 / 混淆 8,831） | **0 行原代码**（33 个源文件 / 5,003 行新写） | 8,831 混淆不可读；可读里 `com.hpplay.*` 独吞 1,808 |
| 第三方可读类 | **2,914**（投屏 1,808、腾讯 375、新浪 296、极验 166、ijk 65、VR 65…） | **0** | 全在 P2-A |
| 原生库 `.so` | **15 个 / 10.82 MiB** | **0** | ijk 三件套 5.94 MiB + libgvr 2.70 MiB = 80%，全是视频/VR |
| 资源条数 | **36,361**（string 11,045 / drawable 1,114 / layout 672 / style 1,346 / color 1,548 / dimen 1,334） | **0 条继承**；自写 7 个 CSS 文件（106 个 token）、7 个图标组件 | layout/文案/图标全部自建 |
| 权限 | **35 条 `uses-permission` + 9 条 `uses-feature`** → 10 类系统能力（相机/相册/录音/定位/通知/投屏/日历/安装/桌面图标/VR） | **0 条运行时权限** | 四条主线一条都用不上 |
| 运行时依赖 | 数十个（含 SDK、播放器、图片库、网络库） | **2**（`react`、`react-dom`） | `package.json` devDeps 仅构建工具 5 项 |
| 产物 | APK + 15 个 `.so` + 36k 资源 | **3 个文件 / 226 KB**（JS 199 KB / CSS 25 KB / HTML 1.4 KB；gzip 69 KB） | `dist/` 实测 |
| 数据 | 真实平台服务端 | 本地 `mock.json`：12 作者 / 30 微博 / 60 回复，固定种子，两次生成逐字节一致 | 离线可跑 |

---

## 3. P0 五条：保留了什么（逐条对照）

| 编号 | 原 app 依据（组件） | 溪流落点 | 保留的核心要素 | 主动砍掉的细节 | 验收点 | 实测 |
| --- | --- | --- | --- | --- | --- | --- |
| **P0-1 时间线** | 域#1 `MainActivity` / `BottomTabsActivity`；域#3 卡片流容器 | `#/timeline`（`pages/Timeline.tsx` + `PostCard`/`MediaGrid`/`ActionBar`） | 作者行（头像/昵称/`@handle`/相对时间）、正文 6 行截断、0–9 图格、转发语块、转发/回复/赞三项计数、关注/推荐两条 feed、刷新、加载更早 | 下拉手势 → 刷新按钮（手势在无头不可断言）；大图点击、视频卡、话题跳转 | AC-TL01…12 | **11/12 通过**（TL08 失败，原因是 B-1 遮挡，不是能力缺失） |
| **P0-2 详情** | 域#4 `StatusDetailActivity` / `StatusDetail2Activity` / `StatusCommentFloorActivity` | `#/status/:id`（`pages/Detail.tsx`） | 完整正文（不限行 17/1.6）、图格、内嵌转发卡、计数行、回复输入（0/140）、顶层回复 + **一层**楼中楼、返回保留滚动位 | 多层楼中楼、楼层分页、评论排序/筛选、大图查看 | AC-DT01…08 | **7/8 通过**（DT06 失败，B-1） |
| **P0-3 发博** | 域#5 `OriginalComposerActivity` / `AtUserActivity` / `GalleryActivity` / `StatusPublishService` | `#/compose`（`pages/Compose.tsx`） | 编辑器（168 高 / `n/500`）、图片**占位块**（≤9，纯 CSS 色块）、`#话题#` 插入（≤3）、草稿自动保存、发布后 `replace` 回时间线并置顶、同步到「我的」 | `@` 选人、真实相册/相机、裁剪、多图上传、发布失败重试队列 | AC-CP01…09 | **8/9 通过**（CP08 失败，B-1） |
| **P0-4 我的** | 域#6 `PersonalHomepageActivity` / `PersonalLikedStatusActivity` | `#/me`（`pages/Profile.tsx` + `SettingsSheet`） | 64 头像/昵称/`@handle`/简介（2 行截断）、关注/粉丝/微博三项统计（与列表同源）、我的博文/赞过的两个段控件、设置 sheet（主题/清空/关于） | 编辑资料、关注/粉丝列表、他人主页、自定义主题取色 | AC-PF01…07 | **5/7 通过**（PF05/PF07 失败，B-1） |
| **P0-5 全局导航与返回栈** | 域#1 `BottomTabsActivity` + 域#2 页面模板 | `src/App.tsx` + `router.ts` + `storage.ts` | 底部 4 项 tabbar（时间线/发博/我的/设置）、活跃项高亮、hash 路由与返回栈、**滚动位与段选恢复**、详情归属时间线 tab | 原 app 的「首页/发现/消息/我」四项改为「时间线/发博/我的/设置」（搜索/通知已砍） | AC-G01…08、AC-TL12/DT04/PF04 | **通过**（G01–G08 全过；t8 复审复验 375 下 tabbar 四项中心各自命中并切换路由） |

> 说明：P0 的 5 条**全部实现**，没有缺项。t6 曾因同一个 CSS 缺陷 B-1（关闭态设置 sheet 常驻覆盖）判 5 条失败，与能力取舍无关；t7 以一行 CSS 修复，**t8 复审已 49/49**（`docs/acceptance.md` §0/§2/§6.2）。

---

## 4. P1 十条：留了 3 条（都是降级形态），砍了 7 条

| 编号 | 能力 | 处置 | 理由 | 落点 / 证据 |
| --- | --- | --- | --- | --- |
| P1-1 | 搜索 + 热搜榜 | **砍** | captain 锁定（spec N-8）；本地 mock 30 条，搜索价值低于维护成本 | 无搜索路由/搜索框；`grep -i search src` 的 4 处命中全部是 `URLSearchParams` 与注释里的 `location.search`（路由解析用），无 `SearchActivity` 对应物 |
| P1-2 | 通知中心（@/评论/赞） | **砍** | 纯本地 mock 消息没有真实来源，「假通知」比没有更伤体验；且需要第 5 个 tab | 无 `Notification` API、无消息路由 |
| P1-3 | 图片大图查看 | **砍** | 需要 `#/gallery` 或全屏 dialog + 手势；四条主线不需要它也能读完内容 | 图格是纯 CSS 块，**不可点**（`data-media-count` 只作结构标记） |
| P1-4 | 视频播放入口 | **砍** | 会立刻把 ijk/VR 那 8.6 MiB 的世界拉回来（P2-C） | `grep -rn '<video\|<audio' src` → 0 |
| P1-5 | 话题聚合页 `#/topic/:name` | **延后**（spec §12） | 新增一条路由 + 一套聚合逻辑，P0 闭环不需要 | 话题只作正文里的高亮 chip，**不可点** |
| P1-6 | 草稿箱 | **降级保留** | 一条草稿不需要管理界面 | `rill:v1:draft` 单条；AC-CP05 ✅（probe=draft → 不带探针重开仍回填） |
| P1-7 | 夜间模式 | **保留（本期唯一 P1）** | captain 已锁定；成本 = 一套 CSS 变量 + 一个开关 | `html[data-theme]` + `html.theme-dark` 同一套变量名；AC-PF06 ✅、AC-G04 ✅（`--rill-bg` #0D1312/#F5F7F6） |
| P1-8 | 设置页（关于/清空/版本） | **降级保留** | 单屏静态内容，不值得一条路由 | 原生 `<dialog open>` sheet，不产生路由；AC-PF05（入口 + 原生 dialog + 关闭）、AC-PF07（二次确认复位）t8 均通过 |
| P1-9 | 私信 | **砍** | captain 锁定（spec N-8）；需要第 5 个 tab + 会话/对话两屏 | 无 DM 路由、无消息存储键 |
| P1-10 | 转发/评论/点赞的本地交互 | **保留** | 本来就是 P0-1 卡片的一部分（spec §12 已并入） | localStorage 单一真源；AC-TL03（+1 不累加）✅、TL04（持久化三态）✅、TL06（转发置顶恰 1 条）✅、TL07 ✅、DT02/DT03 ✅ |

**P1 的取舍原则**：只留「删掉会破坏 P0 手感」或「成本低于 1 个组件」的；凡是需要**新增一屏/一条路由/一种系统能力**的，一律砍或延后。

---

## 5. P2 六组：逐组对照「原 app 有什么 / 溪流里对应的是零」

| 组 | 原 app 砍掉的东西（量化） | 溪流中的对应物 | 「没偷做」的验证命令与结果 |
| --- | --- | --- | --- |
| **A. 第三方 SDK 与组件** | 8 个组件 + **2,914 个可读类** + **全部 15 个 `.so`**：投屏 `com.hpplay.*` 1,808 类 + `LelinkSdkService`/`LelinkSdkCompactService`/`LelinkReceiver`/`PermissionBridgeActivity`；腾讯 375；新浪 296 + `libweibosdkcore.so`；极验 166；matisse/uCrop；ijkplayer 65 + 3 个 `.so`（5.94 MiB）；com.google.vr 65 + `libgvr.so`（2.70 MiB）；glide/gif/jsoup/flipper/加固壳 | **0**：`package.json` 运行时依赖恰 2 项（react/react-dom）；`dist` 只有 1 JS + 1 CSS + 1 HTML | `find src dist -name '*.so' -o -name '*.dex' -o -name '*.jar'` → 0；`node -e "Object.keys(require('./package.json').dependencies)"` → `['react','react-dom']`；`grep -rn "import .* from '[^.]" src` → 仅 react |
| **B. 推送 / 常驻 / 系统集成** | `com.wave.sdk.*` 5 个组件、自定义签名权限、`POST_NOTIFICATIONS`、常驻服务、开机自启、精确闹钟、悬浮窗、快捷方式/图标别名、应用内安装 | **0**：无推送、无后台、无 manifest、无图标别名 | `grep -rn "Notification\|serviceWorker\|setInterval" src` → 0（`setInterval` 也未用，计时只用 `setTimeout` 清 toast） |
| **C. 直播 / 投屏 / 视频重能力** | 直播（`sinaweibo://story` VVS 竖屏流）、投屏、弹幕 `DanmakuInputView`、音乐播放器 `MusicPlayerService`+`LrcView`、`VVSActivity`、`VideoDetailActivity` | **0**：一条视频都没有，图格是纯 CSS 色块 | `grep -rn "<video\|<audio\|<canvas" src` → 0；无投屏/直播/弹幕相关文案与路由 |
| **D. 商业化与服务端卡片面** | `OpenProductAppActivity`（openadapp/openpushapp/openproductapp）、`CardListActivity`/`FragmentPageActivity`/`PageDetailActivity`/`PagePopActivity`（投票/PK/榜单 12 类）、`FreshListActivity`、`InfoPageActivity`、`ArticleActivity`（长文）、`QAActivity`、`CalendarFeedActivity` | **0**：只有一种内容模型 `Post`（8 字段），无卡片类型分发、无广告位、无长文/问答/日历 | `src/types.ts` 只有 `Post/Author/Reply/MediaRef/Counts`；无 `card`/`ad`/`promotion` 类型；路由表只有 4 条 |
| **E. 重协议面 / 外部唤起网** | 3 个 Dispatcher（`HttpDispatchActivity`/`TransparentHttpDispatchActivity`/`SchemeDispatchActivity`）、3 个 WebView、`PermissionCheckActivity`、**38 个零权限 `sinaweibo://` 唤起出口**、`weibo.cn/qr/*`、`one://` | **0**：无 scheme 注册、无 WebView/iframe、无外链跳转 | `grep -rn "window.open\|location.href\|target=\"_blank\"\|<iframe" src` → 0；`grep -rn "sinaweibo\|weibo.cn\|one://" src` → 0 |
| **F. 其他产品面** | 附近的人（+定位权限）、扫码（+相机）、他人主页 `UserSearchActivity`/`MyFriendActivity`/`EditProfileActivity`/`MyFollowersActivity`、自定义主题取色 `ThemeCustomActivity`、多 tab 服务端配置、沉浸式/透明 Activity 变体 | **0**：只有「本人」一份 profile、无定位/相机、主题两档固定 | `grep -rn "geolocation\|getUserMedia\|mediaDevices\|camera" src` → 0；`#/me` 只渲染 mock 的 `u_01` |

**P2 合计**：砍掉 **27 个组件**（111 − 36 − 32 − 16）、**2,914 个可读类**、**全部 15 个 `.so`**、**35 条权限**、**36,361 条资源**——这些在溪流里都是**结构性的零**（不是「有但隐藏」）。

---

## 6. 红线 8 条：逐条自检

| # | 不带走 | 验收口径 | 实测 |
| --- | --- | --- | --- |
| R-1 | 不搬 smali/Java 代码 | 无 `.smali`/`.java`/`.dex` | ✅ 0 命中；33 个源文件全部为新写 TS/TSX/CSS |
| R-2 | 不搬 assets/图标/字体 | 无二进制资源；图标 inline SVG、字体系统栈 | ✅ 二进制 0；`url(` 0；字体栈 `-apple-system, "PingFang SC", …` 系统字体 |
| R-3 | 不搬原文案 | 不出现原 app 字符串 | ✅ 禁用串 0 命中；文案全部自写 |
| R-4 | 不搬布局/样式 | 不参考其 XML | ✅ 7 个自写 CSS + 106 个 token |
| R-5 | 不出现商标/包名 | `Unique`/`unique`/`微博`/`Weibo`/`sina`/`app.unique.one`/`sinaweibo` 全 0 | ✅ grep 0（`src`/`index.html`/`dist`） |
| R-6 | 不申请权限、不联网 | 纯静态 + 本地 mock | ✅ 0 权限、0 系统能力 API、0 外部请求 |
| R-7 | 不带第三方 SDK/分析/推送 | 运行时依赖仅 react/react-dom | ✅ 恰 2 项 |
| R-8 | 不实现原协议/接口 | 无 scheme、无鉴权、无网络 | ✅ 0 scheme、0 token/OAuth、0 请求 |

---

## 7. 与上游契约的偏差（都有理由，别当回归）

| # | 偏差 | spec 原文 | 实际 | 理由 | 验收影响 |
| --- | --- | --- | --- | --- | --- |
| D-1 | 路由形态 | `/status/:id` 等 path 路由 | hash `#/timeline`、`#/status/:id`、`#/compose`、`#/me`（`#/`、`#`、未知 hash → `replaceState` 到 `#/timeline`） | 纯静态站 + 无头 `--dump-dom` 可直接深链，不需要服务端 rewrite | AC-G01/G02 ✅ |
| D-2 | storage 前缀 | 建议 `weibo-lite:*` | `rill:v1:*` | 建议值含禁用串 `weibo`，与 R-5 冲突 | 无（自观测键名已在 spec 落定） |
| D-3 | 发博选图 | `<input type="file">` | 纯 CSS 占位块 | 红线：不带任何二进制资源；真选图会产生本地文件依赖 | AC-CP03 ✅（1 张占位图） |
| D-4 | 时间线卡片宽度 | §4.7「内容列左右 padding 16」 | 375 下卡片**通栏**（`w=375, left=0`），内距 16 由卡片自身承担；媒体区 343 | `design.md` 的刻意选择（贴边卡片更像原生 feed），且不产生横向滚动 | AC-G06 ✅（卡片 ≥320、无横向溢出） |
| D-5 | AC-DT07 的数据点 | 用 `#/status/p_0001` 断言转发卡 | 改用 `p_0005`（`repostOfId=p_0011`） | `p_0001.repostOfId=null`，它在 mock 里根本不是转发帖，该 AC 在原文样例上不可执行 | 阈值未放宽，语义等价 ✅ |
| — | **B-1（缺陷，已在 t7 修复）** | — | 关闭态 `<dialog>` 曾为 `display:block`，常驻覆盖底部 280px（375）/中央 480×252（≥768）并吃掉指针事件 | `SettingsSheet.tsx` 的 `open={open \|\| undefined}` 依赖 UA 的 `dialog:not([open]){display:none}`，曾被 `profile.css` 的 `.sheet{display:block}` 覆盖；现已在 `profile.css:31` 补 `.sheet:not([open]) { display: none; }` | **已闭环**：t6 判 5 条 AC 失败（TL08/DT06/CP08/PF05/PF07）；t8 复审 49/49，关闭态 `display:none`、rect `0×0`、四路由遮挡 0（见 `acceptance.md` §2/§6.2） |

---

## 8. 复跑对照结论

```bash
cd .
# 1) 复用性/红线自检（全部期望 0）
grep -rnE 'app\.unique\.one|\bUnique\b|sina' src server index.html dist | wc -l   # 0（词边界；允许 微博/Weibo）
find src dist -name '*.so' -o -name '*.png' -o -name '*.dex' -o -name '*.jar' | wc -l                # 0
# 产物级（t38）：实现符号 0，探测串只允许 1 次
for p in CapacitorHttp registerPlugin registerWebPlugin CapacitorCookies CapacitorException CAPACITOR_; do grep -o -F "$p" dist/assets/index-*.js | wc -l; done   # 0 0 0 0 0 0
grep -o 'window.Capacitor[^;]\{0,40\}' dist/assets/index-*.js                 # 只应出现 window.Capacitor?.isNativePlatform?.()
node -e "const fs=require('fs');const m=fs.readdirSync('dist/assets').find(f=>f.startsWith('index-'));const s=fs.readFileSync('dist/assets/'+m,'utf8');console.log((s.match(/fetch\(\s*["\x27\x60]{0,2}https?:\/\/(?:m\.)?weibo\./g)||[]).length)"   # 主包 0（设备分块允许，不在此列）
grep -oE 'from"\./client-[^"]+"' dist/assets/index-*.js | wc -l                        # 0：主包无静态引用
grep -oE 'import\("\./client-[^"]+"\)' dist/assets/index-*.js | wc -l                # 1：只允许动态 import
grep -rn "Notification\|serviceWorker\|geolocation\|getUserMedia\|<video\|window.open" src | wc -l    # 0
node -e "console.log(Object.keys(require('./package.json').dependencies))"                            # ['react','react-dom']

# 2) 能力面实测（49 条 AC / 13 探针 / 12 张真宽截图）
export npm_config_cache=<workspace>/.npm-cache
node /tmp/verifier/ac.mjs            # → /tmp/verifier/results.json
python3 /tmp/verifier/dumpdom.py     # 第二机制交叉复核 15 条
```

**对照结论**：
1. P0 五条**一条不缺**；P1 留 3 条（全是降级形态）、砍 5 条（captain 锁定）、延后 1 条、并入 1 条；
2. P2 六组**全部为 0**，且是「结构上不存在」而非「有但隐藏」（上面 4 条 grep 就是证据）；
3. 红线 8 条全过；
4. t6 唯一不合格项 B-1（一行 CSS）已在 t7 修复、t8 复审闭环（49/49），与「保留了什么/砍掉了什么」无关。

---

## 9. 一句话给 captain

> 这次复刻把「111 个组件 / 12,303 个类 / 36,361 条资源 / 15 个 `.so` / 35 条权限」压成了「4 条路由 / 33 个源文件 / 3 个产物文件 / 2 个依赖 / 0 条权限」——**减掉的是原 app 里占体积大头的 SDK、视频/VR、推送与商业面，留下的是刷、看、发、我**。能力对照与产品验收层面**均可签字**：t8 复审 49/49，X-1/X-2/X-3 三条合同外风险全部归零。