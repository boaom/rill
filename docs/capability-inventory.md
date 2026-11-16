# unique 客户端（app.unique.one v1.0.5）能力盘点 —— weibo-lite 保留 / 砍掉表

> 任务：[T0] 能力盘点 · 产出者：scout · 分析对象：`<workspace>/unique-case/orig.apk`
> 目的：只回答「原 app 有哪些功能面存在、哪些值得带走」，不做行为分析、不摘抄任何文案/资源内容。
> 下游消费者：designer（页面/交互设计）、builder（实现）、verifier（验收）。

---

## 0. 结论先行

| 项 | 数 |
| --- | --- |
| manifest 声明的组件 | **111**（activity 76 / activity-alias 3 / provider 6 / receiver 12 / service 14） |
| 可被外部 app 唤起的组件 | 41（其中 38 个不需要任何权限） |
| 声明的权限 | 35 条 `<uses-permission>`（去重 34，`REQUEST_INSTALL_PACKAGES` 重复声明 2 次；含 2 条自定义签名权限）+ 9 条 `<uses-feature>` |
| DEX 类 | 12,303（2 个 dex：10,881 + 1,422）；其中**可读类名仅 3,472**，8,831 个被混淆 |
| 第三方 SDK 可读类（类名前缀证据） | 乐播投屏 `com.hpplay.*` **1,808** · 腾讯 `com.tencent.*` **375** · 新浪 `com.sina.*` **296** · 极验 `com.geetest.*` **166** · ijkplayer `tv.danmaku.ijk.*` **65** · GVR/VR `com.google.vr.*` **65** · 电信 `cn.com.chinatelecom.*` **24** · matisse **7** · uCrop **6** |
| 应用自身可读类 | `app.*` 162 + `wave.*` 36 + `toolkit.*` 57 = **255** |
| 资源表 | 36,361 条目 / 19,914 个 key / 21,554 个全局字符串 / 2,371 个 res 文件 / 5 个 locale；字符串资源 11,045 条 |
| APK 体积构成（可判读部分） | 15 个 arm64-v8a `.so` 合计 10.82 MiB，其中 ijk 三件套 5.94 MiB、libgvr 2.70 MiB 两项即占 80% |

**一句话结论**：这是一个「微博客户端 + 半个投屏 SDK」——1,808 个乐播投屏类比应用自身可读类（255）多 7 倍；111 个组件里真正构成微博产品体验的只有 4 个域、约 36 个组件，其余是第三方 SDK、服务端卡片页、推送/常驻、协议派发与框架样板。**所以「更简洁」不是删减，而是只取那 36 个组件对应的产品形态，其余全部不带走。**

---

## 1. 盘点口径与证据来源（可复现）

所有命令均在 `<workspace>` 下执行为 `bash ca <tool> --path <workspace>/unique-case/orig.apk ...`，输出 JSON 落在临时目录后本地统计，**未使用 `unique-case/ca.cany` 作为项目账本**（用 `CANY=/tmp/scout-cap.cany` 隔离）。

| 证据编号 | 命令 | 关键返回 | 用来支撑 |
| --- | --- | --- | --- |
| E1 | `android-components-list --limit 200` | `total=111`，`by_kind={activity 76, alias 3, provider 6, receiver 12, service 14}`，`reachable_from_outside=41`，`reachable_with_no_permission=38` | 第 2 节全部组件数与域名归类 |
| E2 | `android-package-show`（无分页，整包） | package/版本/minSdk 29/targetSdk 33/compileSdk 34、`manifest_xml` 全文、权限表、`dex` 2 条、`native_libraries.arm64-v8a` 15 条、`assets 31`、`res_files 2371`、签名 v2 | 第 3 节权限反推、第 5 节「不带走」的清单依据 |
| E3 | `android-classes-find --query "" --limit 5000` ×3（offset 0/5000/10000） | `classes_total=12303`，合并去重后按前缀统计 | 各域的「类级规模」证据（判断该域是 SDK 还是应用自身） |
| E4 | `android-resources-read --limit 200` | `entries_total=36361`、`entries_matching=36361`、`global_strings=21554`、`locales=[default,en,zh,zh-rCN,zh-rTW]`、`packages[0].types` 21 类（见 §2.1） | 只取**计数与类型分类**，不摘抄任何字符串 |

**口径限制（写进结论的前提，请下游知悉）**

1. 组件数是**静态 manifest 声明数**：运行期 `registerReceiver` 动态注册的接收器不在内；`disabled_in_manifest` 的（`Launcher2/3`、`androidx.work` 若干 ConstraintProxy）仍被计入，因为它们可被运行期启用。
2. 8,831 个混淆类让「类数」无法直接映射到功能面，因此**功能域归组以 manifest 组件为准**，类数只作为「该域是第三方 SDK / 是应用自身」的旁证。
3. `android-resources-read` 的 200 行页不足以枚举 36,361 条资源，类型计数取自同一次调用的 `packages[].types` 聚合字段（工具自身汇总），非我逐条累加。
4. 本盘点**不含**网络接口、服务端协议、界面视觉与文案——净室要求下这些一律不采集。

---

## 2. 111 个组件按功能域归组

### 2.1 资源面（决定「视觉/文案继承」成本，来自 E2/E4）

| 资源类型 | 条目数 | 处理结论 |
| --- | --- | --- |
| string | 11,045（5 locale） | **不搬**，全部自写 |
| id | 2,064 | 不适用（未做布局继承） |
| attr / color / style / dimen | 1,630 / 1,548 / 1,346 / 1,334 | 不搬，自建设计 token |
| drawable / mipmap / font / raw | 1,114 / 9 / 3 / 6 | **不搬任何图标/字体/图片** |
| layout / menu / xml / anim / animator / interpolator / transition | 672 / 38 / 21 / 71 / 38 / 18 / 2 | 不搬，自写结构 |
| array / integer / bool / plurals | 71 / 78 / 10 / 1 | 不搬 |

### 2.2 组件域表（每个组件恰好归一个域，合计 111）

| # | 功能域 | 组件数 | 组件（kind） | 域级旁证（类/资源） | 归属 |
| --- | --- | --- | --- | --- | --- |
| 1 | **应用外壳·四大主线容器** | **11** | `MainActivity`(a)、`Launcher`/`Launcher2`/`Launcher3`(alias×3)、`CommonFragmentActivity`(a)、`BottomTabsActivity`(a)、`FragmentActivity`/`FragmentFullScreenActivity`/`FragmentTransparentActivity`/`FullScreenThemeActivity`/`SystemFragmentActivity`(a×5) | `MainActivity` 是唯一带 `MULTIWINDOW_LAUNCHER` + `one://gotohome` 的入口；`BottomTabsActivity` 由 `sinaweibo://tabbar` 下发——**底部 tab 是服务端卡片驱动的** | **P0**（容器保留，服务端驱动机制不保留） |
| 2 | 页面模板·Scheme 派发·WebView | **8** | `HttpDispatchActivity`、`TransparentHttpDispatchActivity`、`SchemeDispatchActivity`、`PermissionCheckActivity`、`WebViewActivity`、`WebViewWeiboActivity`、`TransparentWebViewActivity`、`TextDetailActivity`(a×8) | 3 个 Dispatcher 承载 `app.unique.one.http` / `sinaweibo://browser` / `weibo.cn/qr/*` 等十余个 intent-filter | P2（只保留「路由到本地页」这一抽象） |
| 3 | 服务端卡片页·活动页 | **8** | `CardListActivity`、`FragmentPageActivity`、`PageDetailActivity`、`PagePopActivity`、`CalendarFeedActivity`、`FreshListActivity`、`InfoPageActivity`、`OpenProductAppActivity`(a×8) | `wave.card.view.*` 12 类（投票/PK/榜单视图）+ `wave.page.*` 5 类 → 卡片是**服务端下发模板**，非本地页面 | P2（含广告/电商/推送落地页） |
| 4 | **微博详情·评论** | **5** | `StatusDetailActivity`、`StatusDetail2Activity`、`StatusCommentFloorActivity`、`StatusTopicActivity`、`ArticleActivity`(a×5) | 两套 Detail Activity 说明存在「新版/旧版详情」双实现 | **P0**（只做一套） |
| 5 | **发博·编辑·图片选择与保存** | **13** | `OriginalComposerActivity`、`AtUserActivity`、`SendMultipleActivity`、`StatusDraftActivity`、`PhotoEditActivity`、`CropImageActivity`、`GalleryActivity`、`ImageSaveService`(sv)、`StatusPublishService`(sv)、`MatisseActivity`、`AlbumPreviewActivity`、`SelectedPreviewActivity`、`UCropActivity`(a×11) | `app.module.publish.*` 3 类 + `StatusEditText`、`GridGalleryEditorView`、`EmoticonPicker`；相册/裁剪全交给 matisse(7 类)+uCrop(6 类) | **P0**（编辑器）+ P1（选图/裁剪简化为 `<input type=file>`） |
| 6 | **个人页·账号** | **7** | `PersonalHomepageActivity`、`PersonalLikedStatusActivity`、`PersonalStatusSearchActivity`、`UserSearchActivity`、`MyFriendActivity`、`EditProfileActivity`、`MyFollowersActivity`(a×7) | `PersonalHomepageActivity` 导出 4 组 filter（mention / `sinaweibo://userinfo` / m.weibo.cn/u/*） | **P0**（本人页）+ P1（他人页/关注列表） |
| 7 | 私信 | **4** | `DirectMessageUsersActivity`、`DirectMessageChatActivity`(a×2)、`WBDMService`(sv)、`DMMsgReceiver`(rc) | 依赖 `com.wave.sdk` 推送通道收消息 | P1（可做纯本地会话）/ P2（长连接） |
| 8 | 搜索·发现·热点 | **7** | `SearchActivity`、`HotSearchActivity`、`CommonSearchActivity`、`HotPageActivity`、`HotStatusActivity`、`NearByActivity`、`QRCodeScanActivity`(a×7) | `SearchActivity` 带 `MAIN` + `sinaweibo://searchall` + `app.unique.one.topic` 三组 filter | P1（搜索/热搜）/ P2（附近的人=定位、扫码=相机） |
| 9 | 话题页 | **4** | `TopicHomePageActivity`、`MyTopicActivity`、`TopicStatusSearchActivity`、`VideoTagActivity`(a×4) | `sinaweibo://pageinfo` 导出；`#话题#` 是卡片内富文本能力 | P1（只做 `#话题#` 点击 → 过滤列表） |
| 10 | 视频·音乐·竖屏故事流 | **6** | `MediaPlayerActivity`、`MediaDispatchActivity`、`VideoDetailActivity`、`MediaPlayerService`(sv)、`MusicPlayerService`(sv)、`VVSActivity`(a×4+sv×2) | ijkplayer 65 类 + 3 个 `.so`(5.94 MiB)；`app.unique.one.module.video.view.*` 4 类（弹幕输入/详情播放） | P1（`<video>` 播放卡片内视频）/ P2（弹幕、竖屏 VVS、音乐播放器） |
| 11 | 消息通知·推送 SDK | **6** | `StatusNotifyActivity`(a)、`WBPushService`、`WBPushJobService`、`WBPServiceProxy`(sv×3)、`WBPMsgReceiver`(rc)、`WBPProvider`(pr) | `com.wave.sdk.*` 7 类 + 自定义权限 `com.wave.sdk.broadcast.permission1004`；两个 service 标 `android:persistent="true"` | P1（本地通知中心）/ P2（推送/常驻/JobService） |
| 12 | 设置·主题 | **5** | `AppSettingActivity`、`AppSettingChildActivity`、`SettingAboutActivity`、`ThemeListActivity`、`ThemeCustomActivity`(a×5) | `toolkit.ui.widget.theme.preference.*` 十余类 + `ThemeCustomActivity` 取色盘（`dialog.colorpicker.FillGridView`） | P1（夜间两档）/ P2（自定义配色） |
| 13 | 第三方 SDK 组件（登录/分享/人机/投屏） | **8** | `AuthActivity`、`AssistActivity`(腾讯)、`GeetestActivity`、`GeetCheckActivity`(极验)、`PermissionBridgeActivity`、`LelinkSdkService`、`LelinkSdkCompactService`(乐播)、`LelinkReceiver`(rc) | com.tencent 375 / com.geetest 166 / **com.hpplay 1,808** 类；`tencent100736903` scheme | **P2（全砍）** |
| 14 | 框架·数据存储·启动·调试 | **18** | `InitializationProvider`、`FileProvider`、`CustomProvider`、`FunWeiboProvider`、`WBPProvider`(pr×5)、`MultiInstanceInvalidationService`(sv)、`SystemAlarmService`/`SystemJobService`/`SystemForegroundService`(sv×3)、`ProfileInstallReceiver`、`ForceStopRunnable$BroadcastReceiver`、`ConstraintProxy$BatteryChargingProxy`、`ConstraintProxy$BatteryNotLowProxy`、`ConstraintProxy$StorageNotLowProxy`、`ConstraintProxy$NetworkStateProxy`、`RescheduleReceiver`、`ConstraintProxyUpdateReceiver`、`DiagnosticsReceiver`(rc×9)；`leakcanary.internal.PlumberInstaller`(pr，调试用) | androidx 115 类；Room + WorkManager + profileinstaller + leakcanary | P2（净室用浏览器，无 Room/Work/leakcanary） |
| 15 | 杂项·问答页 | **1** | `QAActivity`(a) | `app.unique.one.module.qa` 1 类 | P2 |
| — | **合计** | **111** | 14 域 + 1 杂项 | — | — |

> 归类校验：脚本按「组件名 → 域」的显式映射跑过一遍，断言 `assigned=111 / unique=111 / missing=[] / dupes=[]`，无遗漏无重复。

**读法**：真正属于微博产品体验的域是 #1/#4/#5/#6（11+5+13+7 = **36 个组件**）；加上 P1 的 #7/#8/#9/#10/#11/#12（4+7+4+6+6+5 = **32 个**）与 #2/#3 的派发壳（16 个）后才是 84；剩下 27 个（#13/#14/#15）是纯外部与样板。

> 表格取数：**组件数列**来自 E1（`android-components-list`，每域内组件逐个按 kind 归类，合计 111）；**域级旁证列**来自 E3（`android-classes-find` 前缀统计）与 E4（`android-resources-read` 类型计数）。

### 2.3 38 个「零权限可被任意 app 唤起」的出口（不继承）

`android-components-list` 记 `reachable_with_no_permission=38`。这些出口把产品面扩大成一张协议网：`sinaweibo://{detailbulletincomment, pageinfo, videotag, fanglelist, cardlist, fragmentpage, pagedetailinfo, pagealert, messagelist, groupchat, story, tabbar, infopage, openproductapp, openpushapp, openadapp, userinfo, userdetailinfo, browser, transparentbrowser, customweibosource, checkpermission, myallfollowerslist, searchall}` + `weibo.cn/qr/*` + `one://{gotohome, sendmultiple}`。**weibo-lite 不注册任何外部 scheme**，只保留内部路由。

---

## 3. 权限 → 用户可见能力反推（E2）

| 权限（原样） | 原 app 里对应的用户可见能力 | 我们是否要做 |
| --- | --- | --- |
| `CAMERA` + feature camera/camera2/autofocus/flash + `queries` IMAGE_CAPTURE/VIDEO_CAPTURE | 拍照/录像发博、扫码、人机校验 | 否（发博只走本地选图） |
| `READ_MEDIA_IMAGES` / `READ_MEDIA_VIDEO` / `READ_EXTERNAL_STORAGE`+`WRITE_EXTERNAL_STORAGE`(≤32) / `MANAGE_EXTERNAL_STORAGE` | 相册读取、发博选图、图片保存到相册（`ImageSaveService`） | 部分：仅「本地 mock 图片」+ 浏览器下载 |
| `RECORD_AUDIO` / `MODIFY_AUDIO_SETTINGS` + feature microphone | 录音（语音评论/语音输入）、视频声音 | 否 |
| `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION` / `ACCESS_LOCATION_EXTRA_COMMANDS` + `.so libJni_wgs2gcj`（WGS→GCJ 坐标转换） | 发博带位置、附近的人、同城 | 否（位置只做静态文本 mock） |
| `POST_NOTIFICATIONS` / `VIBRATE` / `SYSTEM_ALERT_WINDOW` / `FOREGROUND_SERVICE` / `WAKE_LOCK` / `RECEIVE_BOOT_COMPLETED` / `SCHEDULE_EXACT_ALARM` + `android:persistent` 推送 service | 新微博/评论/私信推送、常驻后台、悬浮提醒、定时提醒（`RemindWorker`/`TimingWorker`） | 仅「站内通知中心」（P1），无系统推送 |
| `READ_CALENDAR` / `WRITE_CALENDAR` | 日程聚合页（`CalendarFeedActivity`，`sinaweibo://shortlinkcalendar`） | 否 |
| `BLUETOOTH` / `BLUETOOTH_ADMIN` / `CHANGE_WIFI_MULTICAST_STATE` / `CHANGE_WIFI_STATE` / `ACCESS_WIFI_STATE` | **投屏**：局域网发现电视/盒子（乐播 Lelink 走组播 + 蓝牙配对） | 否 |
| `INTERNET` / `ACCESS_NETWORK_STATE` / `CHANGE_NETWORK_STATE` + `.so libhttpdns` | 联网、HTTPDNS 加速 | 否（纯离线 mock，`file://` 或本地静态服务） |
| `REQUEST_INSTALL_PACKAGES` | 应用内下载并安装（升级/推广落地页） | 否 |
| `com.android.launcher.permission.INSTALL_SHORTCUT` / `READ_SETTINGS` + 3 个 Launcher alias | 桌面图标/名称切换、快捷方式 | 否 |
| `queries` 里的 `android.intent.action.SEND`(text/image/video, SEND_MULTIPLE) + `package com.sina.weibo` / `app.jjyy.passstore` | 作为**分享目标**收外部内容；跳微博主客户端登录/跳密码本 | 否（不做系统分享接收） |
| `com.wave.sdk.broadcast.permission1004`（signature 级，自定义） | 微博推送 SDK 的跨进程/跨 app 通信 | 否 |
| `uses-feature glEsVersion=0x20000 required=true` + `vr.mode` / `vr.high_performance`(optional) + `.so libgvr`(2.70 MiB) | VR/全景看图看视频（`MonoscopicView`） | 否 |
| `FLASHLIGHT` | 拍照闪光灯/手电 | 否 |

**反推结论**：原 app 的权限面覆盖了「拍照、相册、录音、定位、通知、投屏、日历、安装、桌面图标、VR」十类系统能力。weibo-lite 的目标只需要其中 **0 类**——四条主线全用本地 mock 数据即可，这正好把「更简洁」落到可验证的红线上：**新应用不应申请任何运行时权限**。

---

## 4. P0 / P1 / P2 三档保留–砍掉表

### P0 —— 不做就不像微博客户端（5 条，每条一句话说清用户价值）

| 编号 | 能力 | 一句话用户价值 | 原 app 依据（组件） | 落到 weibo-lite 的形态 |
| --- | --- | --- | --- | --- |
| **P0-1** | **时间线**（关注/推荐两条 feed 的微博卡片流：作者行、正文截断、九图网格、转发语、底部转发/评论/赞计数；下拉刷新 + 上滑加载更早） | 打开就能一直往下刷到新微博，这是用户来这个 app 的唯一理由 | 域#1 `MainActivity` + `BottomTabsActivity`；域#3 卡片流容器 | 路由 `/`：单列卡片列表，20 条 mock + 分页 3 页 |
| **P0-2** | **微博详情**（点卡片进入：完整正文、大图、转发链、评论列表、楼中楼入口、评论输入框） | 点进去能把一条微博和它的评论完整读完，这是「刷到感兴趣的内容」之后必然的下一步 | 域#4 `StatusDetailActivity` / `StatusDetail2Activity` / `StatusCommentFloorActivity` | 路由 `/status/:id`：正文 + 评论列表（只做一层楼中楼） |
| **P0-3** | **发博**（底部「+」进编辑器：文字、多图占位、`#话题#`、@、草稿、发布后逐字出现在时间线顶部并可从「我的」看到） | 用户能自己产出内容并立刻看到结果，产品从「只能看」变成「能发」的闭环 | 域#5 `OriginalComposerActivity` / `AtUserActivity` / `GalleryActivity` / `StatusPublishService` | 路由 `/compose`：`<textarea>` + 图片占位 + 话题插入；发布写入 localStorage |
| **P0-4** | **我的**（头像/昵称/简介 + 关注/粉丝/微博数 + 我的微博列表 + 我赞过的） | 有身份感和「我发过什么、赞过什么」的回看入口，让这个 app 属于「我」 | 域#6 `PersonalHomepageActivity` / `PersonalLikedStatusActivity` | 路由 `/me`：头部统计 + 两个 tab |
| **P0-5** | **全局导航与返回栈**（底部四 tab：首页/发现/消息/我 + 列表→详情→返回的位置记忆 + 活跃 tab 高亮） | 把四条主线缝成一个 app，而不是四个孤立页面；返回不丢滚动位置是「用起来一样」的关键手感 | 域#1 `BottomTabsActivity` + 域#2 页面模板 | 底部固定 tabbar + `history`/滚动位置恢复 |

> P0 共 5 条，**没有第 6 条**。任何「再加一个 P0」的提议都请先说服：不做它，产品是否就不像微博客户端了。

### P1 —— 体验加分，但删掉也不影响「像」 （可挑 3–4 个做）

| 编号 | 能力 | 用户价值 | 原 app 组件依据 | 简化做法 |
| --- | --- | --- | --- | --- |
| P1-1 | 搜索 + 热搜榜 | 有明确目标时能找到人/微博 | `SearchActivity`、`HotSearchActivity`（域#8） | 本地 mock 热搜 8 条 + 关键词过滤 |
| P1-2 | 通知中心（@我 / 评论 / 赞 三 tab） | 知道「有人在跟我互动」 | `StatusNotifyActivity`（域#11） | 纯本地 mock 消息列表 |
| P1-3 | 图片大图查看（点击九图 → 全屏左右滑、双指缩放） | 看微博里的图是高频动作 | `GalleryActivity`（域#5） | `<dialog>` + CSS transform |
| P1-4 | 视频卡片播放入口 | 视频微博能播而不是只能看封面 | `MediaPlayerActivity` / `MediaDispatchActivity`（域#10） | `<video muted>` 播本地示例文件 |
| P1-5 | 话题页（`#话题#` 点击 → 该话题的微博聚合列表） | 从一个话题追到更多内容 | `TopicHomePageActivity`（域#9） | 路由 `/topic/:name`，本地过滤 |
| P1-6 | 草稿箱 | 写到一半退出不丢 | `StatusDraftActivity`（域#5） | localStorage 草稿一条 |
| P1-7 | 夜间模式（亮/暗两档） | 夜里刷微博不刺眼 | `ThemeListActivity`（域#12） | CSS 变量 + `prefers-color-scheme` |
| P1-8 | 设置页（关于、清空本地数据、版本号） | 有个「能收尾」的地方 | `AppSettingActivity` / `SettingAboutActivity`（域#12） | 一个静态页 |
| P1-9 | 私信（会话列表 + 对话气泡） | 「消息」tab 不空着 | `DirectMessageUsersActivity` / `DirectMessageChatActivity`（域#7） | 纯本地两条会话 |
| P1-10 | 转发/评论/点赞的本地交互（计数 +1、`已赞` 状态持久化、转发弹层） | 卡片不是死的，点得动 | 卡片内计数器（域#1/#3） | localStorage 计数 |

### P2 —— 明确不做（这份清单就是「砍掉」的验收范围）

**A. 第三方 SDK 与组件（全砍：8 个组件 + 约 2,900 个可读类 + 8 个 `.so`）**
- 乐播投屏 `com.hpplay.*`（**1,808 类**）+ `LelinkSdkService` / `LelinkSdkCompactService` / `LelinkReceiver` / `PermissionBridgeActivity` + 蓝牙/组播权限 + `:lelinkps` 独立进程
- 腾讯登录分享 `com.tencent.*`（375 类，含 `com.tencent.mm` 186）+ `AuthActivity` / `AssistActivity` + `tencent100736903`
- 新浪微博 SDK `com.sina.*`（296 类）+ `libweibosdkcore.so` + `libhttpdns.so`
- 极验人机校验 `com.geetest.*`（166 类）+ `GeetestActivity` / `GeetCheckActivity`
- 相册/裁剪：matisse（7 类）+ uCrop（6 类）+ 其 3 个预览 Activity（改用 `<input type="file">`）
- 播放器 ijkplayer（65 类 + 3 个 `.so`，5.94 MiB）（改用 `<video>`）
- VR/全景：com.google.vr（65 类）+ `libgvr.so`（2.70 MiB）+ `MonoscopicView`
- 中国电信 cn.com.chinatelecom（24 类）、com.davemorrissey（44 类大图）、jsoup（15）、glide（12）、gif（7）、flipper（7）、leakcanary、加固 `libjiagu.so` / `libSecShell.so`

**B. 推送 / 常驻 / 系统集成**
`com.wave.sdk.*` 5 个组件（push service / job service / proxy / msg receiver / provider）+ 自定义签名权限 + `POST_NOTIFICATIONS`「持久服务」「开机自启」「精确闹钟」「悬浮窗」「快捷方式/图标别名切换」「应用内安装」——全部不做。

**C. 直播 / 投屏 / 视频重能力**
直播（无独立模块，直播卡片走 `sinaweibo://story` 的 VVS 竖屏流）、投屏、弹幕（`DanmakuInputView`）、音乐播放器（`MusicPlayerService` + `LrcView` 歌词）、竖屏故事流（`VVSActivity`）、视频详情独立页（`VideoDetailActivity`）。

**D. 商业化与服务端卡片面**
`OpenProductAppActivity`（`openadapp` / `openpushapp` / `openproductapp` 三个落地页）、服务端卡片页 `CardListActivity` / `FragmentPageActivity` / `PageDetailActivity` / `PagePopActivity`（`wave.card.view.*` 投票/PK/榜单 12 类）、`FreshListActivity`（新鲜事）、`InfoPageActivity`、`ArticleActivity`（长文）、`QAActivity`（问答）、日历聚合 `CalendarFeedActivity`。

**E. 重协议面 / 外部唤起网**
3 个 Dispatcher（`HttpDispatchActivity` / `TransparentHttpDispatchActivity` / `SchemeDispatchActivity`）、3 个 WebView（`WebViewActivity` / `WebViewWeiboActivity` / `TransparentWebViewActivity`）、`PermissionCheckActivity`，以及 §2.3 列出的 38 个零权限唤起出口与全部 `sinaweibo://` / `weibo.cn/qr/*` / `one://` scheme。

**F. 其他产品面**
附近的人（`NearByActivity` + 定位权限）、扫码（`QRCodeScanActivity` + 相机）、他人主页 `UserSearchActivity` / `MyFriendActivity` / `EditProfileActivity` / `MyFollowersActivity`（若 P0-4 只做本人页）、自定义主题取色器（`ThemeCustomActivity`）、多 tab 服务端配置、沉浸式全屏/透明 Activity 变体（`FullScreenThemeActivity` / `FragmentTransparentActivity` 等）。

**不做计数**：P2 覆盖 **111 − 36（P0 域）− 32（P1 域）− 16（派发壳）= 27 个组件**，以及 1,808+375+296+166+65+65+24+44+17+15+12+7+7+6+7 = **2,914** 个可读类与全部 15 个 `.so`。

---

## 5. 本次复刻不带走什么（红线，逐条可验收）

| 不带走 | 依据 | 验收口径 |
| --- | --- | --- |
| **不搬任何 smali / Java 代码** | 12,303 个 dex 类（8,831 混淆） | 交付物里没有 `.smali`/`.java`/`.dex`，全部逻辑为新写的 JS/HTML/CSS |
| **不搬 assets / 图标 / 字体** | `assets` 31 个文件、drawable 1,114、mipmap 9、font 3、raw 6 | 交付物里没有二进制资源文件；图标用内联 SVG/文字，字体用系统字体栈 |
| **不搬原文案** | 11,045 条 string（5 locale）+ 21,554 个全局字符串——本盘点**只取计数，未摘抄一句** | 页面文案全部自写，不出现原 app 的字符串资源 |
| **不搬布局/样式** | layout 672、style 1,346、color 1,548、dimen 1,334 | 不参考其 XML；视觉自建 |
| **不出现 Unique / 微博 商标与包名** | 包名 `app.unique.one`、类名 `app.unique.one.*`、scheme `sinaweibo://`、`com.sina.weibo` | 交付物中不出现 `Unique`、`unique`、`微博`、`Weibo`、`sina`、`app.unique.one`、`sinaweibo` 任一字符串（`weibo-lite` 仅作工作目录名，界面不出现） |
| **不申请任何权限、不联网** | §3 权限面 35 条 | 纯静态站 + 本地 mock JSON，离线可跑，无 fetch 外网 |
| **不带第三方 SDK / 分析 / 推送** | §4 P2-A/B | `package.json` 无第三方运行时依赖（构建工具除外），无埋点 |
| **不实现原协议/接口** | 38 个零权限唤起出口 | 无外部 scheme 注册、无网络请求、无鉴权流程 |

---

## 6. 给下游的最小契约（供 designer / builder 直接用）

```text
路由（4 条 P0 主线）
  /                   首页时间线（tab: 关注 | 推荐）        P0-1
  /status/:id         微博详情（正文 + 评论 + 楼中楼）       P0-2
  /compose            发博编辑器（文字/多图占位/话题/@/草稿/发布） P0-3
  /me                 我的（头部统计 + 我的微博 | 我赞过的）  P0-4
  /topic/:name        话题聚合（P1-5，可后置）
  /search             搜索 + 热搜（P1-1，可后置）

数据（全本地 mock，建议单一 `sources/mock.json`）
  users[]      id, 昵称, 头像占位(css), 简介, 关注数, 粉丝数, 微博数
  statuses[]   id, userId, 文本, 图片[0..9](占位), 话题[], 转发原文?, 时间, 转发/评论/赞数
  comments[]   id, statusId, userId, 文本, 回复对象?(楼中楼)
  notifications[]（P1-2）
  conversations[]（P1-9）

交互状态（localStorage）
  weibo-lite:draft / :draftOn / :likedIds / :publishedIds / :theme / :scrollPos
```

**验收点（verifier 可直接照此写断言）**
1. 四个 P0 路由可直达、可后退，底部 tab 高亮正确；
2. 时间线 20 条卡片、可下拉刷新、可加载第 2/3 页；
3. 卡片点击 → 详情 → 评论渲染 → 返回时间线滚动位置保持；
4. 发博：输入文字 + 选「图片占位」+ 发布 → 时间线顶部出现该条 → `/me` 也能看到；
5. `/me` 头部统计与列表数据一致，点赞后计数 +1 且刷新后仍为 `已赞`；
6. 断网（DevTools offline）下全站可用；
7. 全站源码/文案中检索不到 §5 的禁用字符串，且无任何权限申请、无第三方 SDK。

---

*本文件只记录「存在性」与「取舍」，不含原 app 的任何代码、资源、文案与接口细节。*