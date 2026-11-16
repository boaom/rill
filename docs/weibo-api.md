# 微博移动端接口契约（Rill provider 规格）

> 任务 t16 · 产出者 scout · 面向：builder（实现 provider）+ verifier（验收）
> 双轨认证：① cookie 直连 `m.weibo.cn`（先做）；② 官方 OAuth `api.weibo.com/2/*`（留接口位）。
> **本机没有用户 cookie。** 带 cookie 才成立的结论全部来自公开实现/官方文档，逐条标等级；能实测的只有端点存在性与匿名响应。

**取证等级**：`〔实测〕` 本会话 curl 打过（命令与状态码见 §1）；`〔官方〕` open.weibo.com 文档页逐字抄录；`〔公开实现〕` 可查的第三方开源实现/公开抓包（附 raw URL）；`〔待实测〕` 无证据，**不当契约用**，每条都给了核对命令。


## 1. 实测记录

2026-11-16 14:45–14:52（Asia/Shanghai）。UA = iPhone Safari 17，无任何 cookie（除非注明）。

| 时间 | 方法 | 端点 | 码 | 关键响应 | 结论 |
| --- | --- | --- | --- | --- | --- |
| 14:45:35 | GET | `m.weibo.cn/` | **302** | `location: visitor.passport.weibo.cn/visitor/visitor?...&_rand=...`；`set-cookie: WEIBOCN_FROM=1110003030` | 匿名被导向**游客系统** |
| 14:45:35 | GET | `m.weibo.cn/api/config` | **200** | `{"data":{"login":false,"st":"7d7f19","user_token":"","loginUrl":"…/sso/signin?…"},"ok":1}` | **匿名可拿 st（XSRF）**；`login:false` |
| 14:45:35 | GET | `…/getIndex?containerid=102803` | 302 | 同上去游客系统 | 无 cookie 取不到流 |
| 14:45:36 | GET | `…/getIndex?containerid=102803&page=2` | **432** | 空 body | **带 page 更易吃 432** |
| 14:46:44 | GET | `m.weibo.cn/`（带游客 SUB/SUBP） | 200 | `set-cookie: SUB=deleted; SUBP=deleted; MLOGIN=0` | **站点主动清游客票** |
| 14:46:45 | GET | `…/getIndex?containerid=102803`（同票） | **302** | `location: passport.weibo.com/sso/signin?…url=…getIndex…` | 游客票**不认**，要求登录 |
| 14:46:52 | GET | `…/getIndex?containerid=231093_-_selffollowed&page=1` | 302 | 同上→signin | 打到登录门（语义未验证，§3.1） |
| 14:45:56 | POST | `passport.weibo.com/visitor/genvisitor` | **200** | `visitor_gray_callback({"retcode":20000000,"data":{"tid":"01AYE…","confidence":90}})` | 游客票据**本机可领**（无验证码） |
| 14:46:31 | GET | `passport.weibo.com/visitor/visitor?a=incarnate&t=<tid>` | 200 | `{"retcode":20000000,"data":{"sub":"_2A…（94 字符）","subp":"…（56 字符）"}}` | sub 94 / subp 56 字符 |
| 14:51:31 | GET | `api.weibo.com/2/statuses/public_timeline.json` | **400** | `{"error":"source paramter(appkey) is missing","error_code":10006}` | 端点存在；缺 client_id |
| 14:51:31 | GET | `/2/statuses/friends_timeline.json`、`/2/comments/show.json?id=1` | **403** | `{"error":"auth by Null spi!","error_code":21301}` | 端点存在；**缺 access_token** |
| 14:51:31 | GET | `/2/statuses/show.json`、`/2/users/show.json`、`/2/search/topics.json` | 400 | `error_code:10006` | 同上（缺 client_id） |
| 14:51:31 | GET | `/2/statuses/update`、`/2/statuses/upload`、`/2/comments/create`、`/2/statuses/repost`、`/oauth2/access_token` | **405** | `{"error":"HTTP METHOD is not suported for this request!","error_code":10021}` | 端点存在，**仅接受 POST** |
| 14:51:31 | GET | `api.weibo.com/oauth2/authorize` | **200** | HTML 授权页 | 授权页存在 |
| 14:52:0x | GET | `picupload.weibo.com/interface/pic_upload.php` | 200 | HTML（缺参数） | 图床端点存在 |
| 14:45:56 | GET | `passport.weibo.com/sso/signin?entry=wapsso&…` | 200 | `set-cookie: X-CSRF-TOKEN=CK-YcoI…` | 登录页存在并下发 CSRF cookie |

**两条方法论结论（builder 别踩）**
1. **`m.weibo.cn` 是 catch-all**：不存在的 `/api/zzzz-nonexistent-xyz` 也返回 **302**（GET/POST 都是）。→ **不能用状态码判断 m 站端点是否存在**。任何"该端点存在"必须来自〔公开实现〕或〔实测〕带 cookie。
2. **432 与 302 是两种拒绝**：302 是"去登录/去领游客票"的业务跳转；**432 是反爬层直拒**（空 body、`server: SHANHAI-SERVER`），由 `page=2` 触发（3 次里 2 次 432、1 次 302 → 服务端有状态/抽样，**不可依赖**）。


## 2. 认证与凭证（cookie 轨）

### 2.1 需要哪些 cookie

| cookie | 必需 | 作用 | 依据 |
| --- | --- | --- | --- |
| `SUB` | **必需** | 登录态主票据（`_2A` 开头是游客票，登录票不同）；缺 → 302→signin 或 432 | 〔实测〕游客 SUB 被回写 `deleted` 并跳登录 |
| `SUBP` | **必需** | SUB 的加密伴随票，服务端校验；单独有 SUB 通常不够 | 〔实测〕两者一起被清 |
| `_T_WM` | 建议 | 设备/风控指纹票（登录后由 `.weibo.cn` 下发）；缺更容易吃 432 | 〔待实测〕§8 A2/A3 |
| `XSRF-TOKEN` | 可选 | 写操作的 XSRF；**实际被读的是 `/api/config` 的 `data.st`**（§4.1） | 〔实测〕+〔公开实现〕 |
| `M_WEIBOCN_PARAMS` | 可选 | 前端路由态（containerid/luicode 编码在内），接口层非必需；**可作为 uid 来源之一** | 〔待实测〕§8 A4 |
| `WEIBOCN_FROM` | 可选 | 渠道标记；服务端每次都下发 `1110003030`，照抄 | 〔实测〕 |
| `MLOGIN` | 可选 | 登录态缓存标记（`Max-Age=3600`），不参与鉴权 | 〔实测〕 |

**接入方式（对我们最省事）**：**不实现账号密码登录**（新设备登录强制二次验证，短信每天有次数上限〔公开实现 S7〕），只支持**用户从已登录浏览器复制 Cookie 头**，我们解析上表并只存本地。Rill 现状是 mock provider，不接真站；若将来接，存 `SUB`/`SUBP`/`_T_WM` 到 `localStorage['rill:v1:auth']`。

### 2.2 `/api/config` 返回什么〔实测，全文〕

```json
{"preferQuickapp":0,"data":{"login":false,"st":"7d7f19","user_token":"",
 "loginUrl":"https://passport.weibo.com/sso/signin?entry=wapsso&source=wapssowb&url=https%3A%2F%2Fm.weibo.cn%2Fapi%2Fconfig",
 "wx_callback":"https://passport.weibo.com/othersitebind/authorize?entry=h53rdlanding&site=qq&callback=",
 "wx_authorize":"https://passport.weibo.com/othersitebind/authorize?site=weixin&entry=sinawap&type=normal&callback=",
 "passport_login_url":"https://passport.weibo.com/sso/signin?entry=wapsso&source=wapssowb&url="},"ok":1}
```

| 字段 | 用途 |
| --- | --- |
| `data.login` | **登录态探针**：一次 GET 就知道 cookie 是否还有效 |
| `data.st` | **XSRF token**：写操作必须带（header + body，§4.1） |
| `data.user_token` | 登录后非空（未登录 `""`），二次确认 |
| `data.loginUrl` / `passport_login_url` | 失效时给用户"去登录"的链接 |
| `ok` | 1 = 成功 |

> **注意**：`login:false` 时 `st` 仍有值（本机 `"7d7f19"`）→ **st 只防跨站，不是凭证**；真凭证是 SUB/SUBP。**uid 不由 `/api/config` 返回**〔实测〕——这是本契约唯一的"uid 来源"空白，见 §8 A4。

### 2.3 visitor / genvisitor 能否替代登录？——**不能**（实测）

机制本身**能跑通**：`genvisitor` 给 `tid`（confidence 90，无验证码）→ `incarnate` 换 `sub`/`subp`。但把这两个值当 `SUB`/`SUBP` 发回 `m.weibo.cn`：**站点回写 `SUB=deleted; SUBP=deleted; MLOGIN=0`**，再请求直接 **302→signin**。
→ 游客票只能用于 `visitor.passport.weibo.cn` 自身页面与少数公开页；**container/评论接口不接受游客票**，**"匿名拉流"这条路不存在**。

**432 成因（判断，非定论）**：432 出现在**无有效登录 cookie 且带 `page` 参数**的 container 请求上，同 URL 不带 page 时是 302；与游客票**无因果**（带票也不解除）。最合理解释：反爬层对"像脚本分页抓取"的请求直接拒。验证见 §8 A3。

### 2.4 有效期与失效表现

| 事项 | 数值/表现 | 等级 |
| --- | --- | --- |
| `SUB` 有效期 | 常见 7–30 天（"记住登录"更久）；**服务端可随时吊销** | 〔待实测〕只能靠 `login` 探针 |
| `MLOGIN` | 1 小时滚动刷新（`Max-Age=3600`） | 〔实测〕 |
| 失效（读） | **302 → `passport.weibo.com/sso/signin?…url=<原URL>`**；偶发 **432** 空 body | 〔实测〕 |
| 失效（探针） | `/api/config` → `login:false`、`user_token:""` | 〔实测〕 |
| 失效（写） | HTTP 200 但 `{"ok":0,"errno":…}`，或混入 HTML 登录页 | 〔待实测〕§4.5 |

**工程结论**：把 `/api/config` 当**启动 + 每次写操作前**的探针（1 次请求，代价极低），不要靠猜。


## 3. 读接口（cookie 轨，`m.weibo.cn`）

通用请求头〔公开实现〕：`MWeibo-Pwa: 1`、`X-Requested-With: XMLHttpRequest`、`Referer: https://m.weibo.cn/`（写用 `…/compose/`）、`Origin: https://m.weibo.cn`（写必需）、手机 UA、`Cookie: SUB…; SUBP…; _T_WM…`。

### 3.1 关注流 / 推荐流

| 项 | 内容 |
| --- | --- |
| URL | `GET https://m.weibo.cn/api/container/getIndex?containerid=<cid>&page=<n>` |
| containerid | **用户博文：`107603`+uid**（例 `1076031669879400`）〔公开实现 S5〕；**推荐/热门：`102803`**〔任务背景 + 实测该值能打到容器接口，语义未验证〕；**关注流候选：`231093_-_selffollowed`**〔实测→302 登录门，语义**未验证**〕 |
| 分页 | 参数 `page`（1 起）；响应 `data.cardlistInfo.page` 回显、`data.cardlistInfo.total` 总条数〔公开抓包：`{"containerid":"1076031669879400","total":1012,"page":2}`〕 |
| 关键路径 | `data.cards[]`（每卡 `card_type`，正文卡为 **9**）→ 卡内 `.mblog`；`data.cardlistInfo` |
| 常见错误 | 302→signin（未登录/失效）、**432**（`page>1` 更易）、`ok:0`（业务失败，§4.5） |

**uid 变化怎么取 cid**：`107603`+uid 是**拼接**，不是映射表；拿到 uid 直接拼。关注流 cid 若与候选不同，用 §8 B1 浏览器法 5 分钟确定。

**`mblog` 字段**〔公开实现 S5，2019-06 抓包样本〕：`id, idstr, mid, bid, created_at, text, raw_text(部分), source, pics[]{pid,url,geo{width,height},large{url}}, pic_ids, pic_types, thumbnail_pic, bmiddle_pic, original_pic, reposts_count, comments_count, attitudes_count, isLongText, textLength, user{}, retweeted_status{}, visible, darwin_tags, buttons, status_title`。

### 3.2 单条详情 + 长文

| 项 | 内容 |
| --- | --- |
| URL | `GET https://m.weibo.cn/statuses/show?id=<mblogid 或数字 id>`〔公开实现 S5 的示例用 mblogid，如 `HyZVegYAP`〕。`/api/statuses/show` 变体在社区出现过但**本机无法区分**（catch-all 全 302）→〔待实测〕 |
| 长文 | `isLongText: true` 时 `text` 被截断；另请求 `GET https://m.weibo.cn/statuses/extend?id=<id>` → `data.longTextContent`（完整 HTML）+ 三个计数〔公开抓包〕 |
| 转发链 | `data.retweeted_status{}`，结构同 `mblog`；**只一层**（微博本身不允许多层引用，与 Rill `spec` 的"只一层"一致） |
| 其它 | `raw_text`、`status_title`（如"转发微博"）、`buttons[]`（点赞/转发按钮态） |

### 3.3 评论列表（含楼中楼）

| 项 | 热门流（主路径） | 时间序（备用） |
| --- | --- | --- |
| URL | `GET https://m.weibo.cn/comments/hotflow?id=<id>&mid=<mid>&max_id_type=0` | `GET https://m.weibo.cn/api/comments/show?id=<id>&page=<n>` |
| 分页 | `max_id`+`max_id_type`；响应 `data.max_id`、`data.max_id_type`、`data.total_number`（`max_id` 回传即下一页，0 到底） | `page`；响应 `data.total_number`、`data.max` |
| 顶层 | `{ok:1,data:{data:[…],total_number,status:{comment_manage_info},max_id,max,max_id_type}}` | `{ok,msg,data:{data:[…],total_number,max,hot_data:[…],hot_total_number}}` |
| 主楼字段 | `id,mid,rootid,created_at,text,floor_number,like_count,liked,disable_reply,user{},comments[],pic{},bid,source,more_info_type,more_info_users[],isLikedByMblogAuthor` | `id,created_at,text,user{},like_counts,liked,source` |
| **楼中楼** | `comments[]`：**`comments:false` = 无子楼**；有则元素含 `id,rootid,text,created_at,user{},reply_original_text,shouldShowColon,bid`（**子项无 parent id**，层级靠 `rootid`） | 无楼中楼（`hot_data` 是热门评论） |

**映射到 `Reply.replyToReplyId`**（只允许一层）：主楼 `rootid == id` → `null`；子楼 `rootid != id` → `rootid`。这套映射**正好落在 Rill 的一层模型**里，`types.ts` 不用改。

### 3.4 用户资料 + 用户博文

| 项 | 内容 |
| --- | --- |
| 资料 | `GET https://m.weibo.cn/api/container/getIndex?type=uid&value=<uid>` → `data.userInfo{}`〔公开实现 S5〕 |
| `userInfo` | `id, screen_name, profile_image_url, avatar_hd, cover_image_phone, description, gender, followers_count, follow_count, statuses_count, verified, verified_type, verified_reason, mbrank, urank, follow_me, following, like, like_me, profile_url`〔公开抓包〕 |
| 博文 | `GET …/getIndex?containerid=107603<uid>&page=<n>`（同 §3.1） |

### 3.5 搜索（三种 kind）

| kind | URL | 依据 |
| --- | --- | --- |
| 综合/博文 | `…/getIndex?containerid=100103type%3D1%26q%3D<urlencode(q)>&page=<n>` | **containerid 里编码了查询**（`type=1&q=`）〔待实测〕§8 B2 |
| 用户 | 同上 `type=2` | 返回 `cards[].user`〔待实测〕 |
| 话题 | 同上 `type=3`，或 `containerid=100808<话题mid>` | 话题卡形状与正文卡不同〔待实测〕 |
| 官方轨替代 | `GET /2/search/statuses.json`、`/2/search/topics.json` | 〔官方〕参数见 §6.3 |

> 真站还有一个前置条件：**未登录/低权重账号搜索常返回空 cards（不是错误码）**——未实测，仅作"别把空列表当 bug"的提醒。


## 4. 写接口（cookie 轨）

### 4.1 XSRF：怎么拿、放哪

1. `GET https://m.weibo.cn/api/config` → `data.st`〔实测〕，且 `data.login` 必须 `true`；
2. 每个写请求**三处同时满足**：header `X-XSRF-TOKEN: <st>`；header `X-Requested-With: XMLHttpRequest` + `MWeibo-Pwa: 1` + `Origin: https://m.weibo.cn` + `Referer: https://m.weibo.cn/compose/`；**body 里再带 `st=<st>`**〔公开实现 S6：`data = {'content': content, 'st': self.__st}`〕；
3. **st 与会话绑定、有时效**：每个写操作前重取一次，缓存不超过 5 分钟。

### 4.2 发博（纯文本）〔公开实现 S6〕

| 项 | 内容 |
| --- | --- |
| URL | `POST https://m.weibo.cn/api/statuses/update` |
| Content-Type | `application/x-www-form-urlencoded` |
| body | `content=<urlencode 正文>&st=<st>` |
| 成功 | HTTP 200 且 **`json.ok === 1`**（实现里 `if rsp_data['ok'] == 1`），响应带新微博对象 |
| 失败 | `ok === 0`（`errno`/`msg`/`url`）、302（登录失效）、432/418（风控） |
| 限制 | 正文 ≤140 汉字（官方口径；m 站是否放宽〔待实测〕） |

### 4.3 转发〔公开实现 S6〕

`POST https://m.weibo.cn/api/statuses/repost`，body `id=<原微博id>&mid=<原微博mid>&content=<urlencode 转发语>&st=<st>`（`id` 与 `mid` **都传**），成功 `ok === 1`。

### 4.4 点赞 / 取消赞 / 评论（**端点名未验证，标〔待实测〕**）

| 动作 | 候选端点与 body | 依据 | 状态 |
| --- | --- | --- | --- |
| 点赞 | `POST …/api/attitudes/like`，`id=<id>&st=<st>` | 社区惯用名；**未找到可核对的公开实现**，catch-all 无法证伪 | 〔待实测〕§8 C1 |
| 取消赞 | `POST …/api/attitudes/unlike`，同上 | 同上 | 〔待实测〕§8 C1 |
| 评论 | `POST …/api/comments/create`，`id=<id>&mid=<mid>&content=<urlencode>&st=<st>` | 同名官方端点是 `/2/comments/create.json`（字段 `id/comment/comment_ori`，**名字不同别混用**） | 〔待实测〕§8 C2 |
| 回复评论（楼中楼） | 同上 + `cid=<父评论id>` | 官方同类 `/2/comments/reply.json` 用 `cid`；m 站字段名未验证 | 〔待实测〕§8 C2 |

**保险**：若 C1/C2 证伪，这两件事**改走 OAuth 轨**（`2/attitudes/create`、`2/comments/create` 是**官方已核实**的），代价是多一次授权。provider 把它们放独立实现类，正是为单点切换（§5.3）。

### 4.5 风控特征（写）

- **HTTP 200 ≠ 成功**：必须看 body。`{"ok":0,"errno":<n>,"msg":"…","url":"…"}` 是典型风控/业务失败形态〔待实测，基于官方错误码体系与 `ok` 约定〕。
- 会出现的形态：`errno` 非 0；`ok:0` + `msg` 含"频繁/验证/安全"；响应变 **HTML 登录页**（被踢）；HTTP **418**（风控常用）〔社区常见，未实测〕；HTTP **432**（反爬，§2.3）。
- **扣验证码**：通常不返回 JSON，而是 `url` 指到验证页〔待实测〕。provider 一律按"写失败 + `RISK_CONTROL`"处理并把 `msg`/`url` 透传给 UI，**绝不自动重试**。

### 4.6 发博带图（图片上传）

| 项 | 内容 |
| --- | --- |
| 端点 | `POST https://m.weibo.cn/api/statuses/uploadPic`〔公开实现 S6 常量〕；图床 `picupload.weibo.com/interface/pic_upload.php` 也存在〔实测 200〕，但第三方实现走 m 站这条 |
| 形态 | `multipart/form-data`，boundary 用毫秒时间戳（实现 `hex(int(time.time()*1000))`） |
| 字段名 | `type=json`、`st=<st>`、**`pic`**（文件字段，filename 也是 `pic`）〔S6：`[('type','json'),('st',st),('pic',('pic',fp,ctype))]`〕 |
| 返回 | JSON 含 **`pic_id`**（`if 'pic_id' not in rsp_data: raise`） |
| 再发博 | `POST …/api/statuses/update`，body 追加 `picId=<id1>,<id2>…`（**逗号分隔、字段名大小写 `picId`**）〔S6：`data['picId'] = ','.join(pic_ids)`〕 |
| 限制 | 单图 <5MB（超了客户端先压缩，见 S6）；张数 ≤9（m 站〔待实测〕） |

> **Rill 现状**：`spec.md` 的"发博"只有纯文本、九图是 CSS 占位、**没有 file input**（D-3）。所以本节是"给未来的"：契约先写清，`publish(text, pics?)` 的 `pics` 先保留、默认 `undefined`。


## 5. provider 规格（给 builder 直接用）

> 任务写"8 个方法"但列了 **10 个名字**；下面按 **10 个**实现——少一个 UI 就缺能力。

### 5.1 错误分类

```ts
export type WeiboErrorCode =
  | 'AUTH_EXPIRED'  // 302→signin / config.login=false / HTML 登录页
  | 'RATE_LIMITED'  // 418 / 429 / msg 含"频繁"
  | 'RISK_CONTROL'  // 432 / 验证码 / 需人工验证的 url
  | 'NOT_FOUND'     // 目标微博/用户不存在（ok:0 且 errno 语义为不存在）
  | 'UPSTREAM'      // 5xx、超时、JSON 解析失败、其它未知
export class WeiboError extends Error {
  constructor(public code: WeiboErrorCode, public detail?: unknown) { super(code) }
}
```

| 分类 | 信号 | 可重试 | 退避 | UI 动作 |
| --- | --- | --- | --- | --- |
| `AUTH_EXPIRED` | 302/登录页/`login:false` | ❌ | —— | 顶部横幅"登录已过期，请重新粘贴 Cookie"，其余请求暂停 |
| `RATE_LIMITED` | 418/429/`errno` 频繁类 | 读可、写不 | 1s→4s→15s（≤3 次） | toast"操作太快了"，写按钮禁用 15s |
| `RISK_CONTROL` | 432/验证页/`msg` 含安全 | ❌ | **全站冷却** 1→2→4→8min（上限 8min） | 切只读；提示"触发风控，稍后再试" |
| `NOT_FOUND` | `ok:0` + 明确不存在 | ❌ | —— | 空态"内容已删除或不可见" |
| `UPSTREAM` | 5xx/超时/非 JSON | 读 3 次 | 500ms→1.2s→3s | 卡片内"加载失败，重试" |

**限速（自设，比官方保守一个数量级）**：读 **串行 ≤1 req/s**（同 container 分页间隔 ≥1.5s）；写 **≤1 req/3s**、发博 **≤6 次/小时**（官方 30/小时〔官方〕）；单用户总量 **≤60 次/小时**（官方 100 次/天，留余量）。全部请求走**一个串行队列**，不并发打。

### 5.2 接口签名（10 个方法）

```ts
// 建议新增 weibo-lite/src/providers/types.ts（本任务只给签名，不写 src）
import type { Author, MediaRef, Post, Reply } from '../types'

export type Cursor = string | null   // 不透明游标：cookie 轨里是 `page` 或 `max_id|max_id_type`
export type Page<T> = { items: T[]; next: Cursor; hasMore: boolean }

export interface WeiboProvider {
  getTimeline(kind: 'following' | 'recommend', cursor?: Cursor): Promise<Page<Post>>
  getStatus(id: string): Promise<Post>
  getComments(id: string, cursor?: Cursor): Promise<Page<Reply>>
  getUser(uid: string): Promise<Author>
  getUserPosts(uid: string, cursor?: Cursor): Promise<Page<Post>>
  search(q: string, kind: 'statuses' | 'users' | 'topics', cursor?: Cursor): Promise<Page<Post | Author>>
  like(id: string, on: boolean): Promise<{ liked: boolean; count: number }>  // 幂等
  repost(id: string, text?: string): Promise<Post>                           // 非幂等
  comment(id: string, text: string, replyTo?: string): Promise<Reply>        // 非幂等
  publish(text: string, pics?: MediaRef[]): Promise<Post>                    // 非幂等
}
```

**字段映射（`types.ts` 现有 7 接口，一个都不改）**

| 目标 | 来源 | 规则 |
| --- | --- | --- |
| `Author.id` / `nickname` / `bio` / 三个计数 | `user.id` / `screen_name` / `description` / `follow_count,followers_count,statuses_count` | 直取；`id` 转 `String` |
| `Author.handle` | **无对应**（微博没有 handle） | **派生** `u${user.id}`（确定性、可逆） |
| `Author.avatarText` / `avatarHue` | `screen_name` / 无 | 首字 1–2 字；`hash(id) % 360`（确定性） |
| `Author.isCurrentUser` | 无 | `user.id === auth.uid` |
| `Post.id` | `mblog.idstr`（**不要用 `bid`**，那是短链码） | `String(idstr ?? id)` |
| `Post.authorId` | `mblog.user.id` | `String` |
| `Post.text` | `mblog.text`（**HTML**） | 去标签、保留文字；`<img alt="[表情]">` → `[表情]`；`<a .../k/…>` → `#词#` |
| `Post.media[]` | `mblog.pics[]` / `pic_ids` | `id=pics[i].pid`；`hue=hash(pid)%360`；`ratio` 由 `geo.width/height`（≈1→square，>1.2→wide，<0.8→tall）；`alt="图片 N"` |
| `Post.topics` | `text` 的 `#词#` / `page_info.page_title` | 去 `#` |
| `Post.repostOfId` | `mblog.retweeted_status.idstr` | 无则 `null`（只一层） |
| `Post.createdAt` | `mblog.created_at`（`"Fri Jun 14 20:39:20 +0800 2019"`） | 解析为 epoch ms，**注意 +0800，别当 UTC** |
| `Counts` | `reposts_count` / `comments_count` / `attitudes_count` | `likes = attitudes_count` |
| `Reply.id` / `postId` / `authorId` / `text` | `comment.id` / 请求参数 / `comment.user.id` / `comment.text` | 同 `Post.text` 清洗 |
| `Reply.replyToReplyId` | `rootid`（§3.3） | `rootid == id ? null : String(rootid)` |
| `MockData` / `AppState` | 不映射 | 真 provider 只产出 `Page<Post>` 等，`AppState` 仍是 reducer 单一真源 |

### 5.3 两实现共用一套接口

```ts
class CookieProvider implements WeiboProvider {}  // m.weibo.cn，§2–§4
class OAuthProvider  implements WeiboProvider {}  // api.weibo.com/2，§6
// 上层只依赖 WeiboProvider；切换在工厂：createProvider({ track: 'cookie' | 'oauth' })
```


## 6. OAuth 轨（官方 `api.weibo.com/2/*`）

### 6.1 **scope 事实（纠偏）**

任务假设需要 `friends_timeline` / `statuses/update` 等 scope——**微博没有这些 scope**。`wiki/Scope` 全表只有 5 个值〔官方，已抓取〕：`all`（下列全部）、`email`（联系邮箱）、`invitation_write`（邀请发送）、`follow_app_official_microblog`（关注官方账号，不对应接口）、`live_create`（直播推流，需单独开通）。

**真正的门有三道**〔官方〕：① 每个接口页写"访问级别：普通/高级/商业接口"，要应用审核或商务开通；② **频次限制**（单授权用户 100 次/天、发微博 30 次/小时、单 IP 15000 次/小时）；③ 未过审应用只能授权 **15 个测试账号**，且测试账号发的微博**只有测试账号可见**。→ 对第三方客户端，OAuth 轨的前提是"应用过审 + 开通对应接口权限"，**这比 scope 重要得多**。

### 6.2 授权码流程三步〔官方〕

1. `GET https://api.weibo.com/oauth2/authorize?client_id=<APPKEY>&redirect_uri=<回调>&scope=<可省>&state=<随机>` → 回调带 `code`；
2. `POST https://api.weibo.com/oauth2/access_token`，表单 `client_id, client_secret, grant_type=authorization_code, code, redirect_uri` → `access_token, expires_in, uid`；
3. 每次请求带 `access_token`；官方要求**用 `oauth2/get_token_info` 校验 token 并比对 APPKEY**，**不能只凭返回的 `uid` 认人**。refresh 支持情况〔待实测〕。

### 6.3 方法映射（参数逐条来自文档页）

| provider 方法 | 官方端点 | 必需参数 | 关键返回 |
| --- | --- | --- | --- |
| `getTimeline('following')` | `GET /2/statuses/friends_timeline.json` | `access_token`；可选 `since_id,max_id,count(≤100,默认20),page,feature,trim_user` | `statuses[]`（`created_at,id,mid,idstr,text,source,thumbnail_pic/bmiddle_pic/original_pic,user,retweeted_status,reposts_count,comments_count,attitudes_count,pic_ids,visible`） |
| `getTimeline('recommend')` | `GET /2/statuses/public_timeline.json`〔实测 400=存在〕 | `access_token` | 同上 |
| `getStatus(id)` | `GET /2/statuses/show.json` | `access_token`, `id` | 单条微博对象 |
| `getComments(id)` | `GET /2/comments/show.json` | `access_token`, `id`；可选 `since_id,max_id,count(默认50),page,filter_by_author` | `comments[]`；**`reply_comment` 对象 = 对另一评论的回复（即楼中楼一层）**〔官方返回字段已核〕 |
| `getUser(uid)` | `GET /2/users/show.json` | `access_token` + (`uid` 或 `screen_name`) | 用户对象 |
| `getUserPosts(uid)` | `GET /2/statuses/user_timeline.json` | 同上 + 分页 | `statuses[]` |
| `search(q,'statuses')` | `GET /2/search/statuses.json` | `access_token`,`q`；可选 `filter_ori,filter_pic,fuid,province,city,starttime,endtime,count(≤50),page` | 微博列表 |
| `search(q,'topics')` | `GET /2/search/topics.json` | `access_token`,`q`,`count(≤50,默认10)`,`page` | 话题列表 |
| `like(id,true/false)` | `POST /2/attitudes/create.json` / `POST /2/attitudes/destroy.json` | `access_token`,`id`（destroy 可选 `attid`） | 表态结果 |
| `repost(id,text)` | `POST /2/statuses/repost.json` | `access_token`,`id`；`status`(≤140)、`is_comment`、**`rip` 必填（操作用户真实 IP）** | 新微博对象 |
| `comment(id,text)` | `POST /2/comments/create.json` | `access_token`,`id`,`comment`(≤140)、`pic_ids`、`comment_ori`、**`rip` 必填** | 新评论对象 |
| `comment(id,text,cid)` | `POST /2/comments/reply.json` | `access_token`,`cid`,`id`,`comment`、`without_mention`、**`rip` 必填** | 新评论对象 |
| `publish(text)` | `POST /2/statuses/update.json` | `access_token`,`status`(≤140,URLencode)、`visible`、`is_longtext`、**`rip` 必填** | 新微博对象 |
| `publish(text,pics)` | `POST /2/statuses/upload.json` | `access_token`,`status`、**`pic`(binary,JPEG/GIF/PNG <5M)** | 新微博对象（**一次请求同时传文与图**） |

> 三个易踩点：① `rip` 是**必填**（服务端上报用户真实 IP），缺了会失败；② 官方**没有** handle，只有 `uid`/`screen_name`；③ 官方**不支持**多层转发。


## 7. 风险矩阵

| # | 失效模式 | 可观测信号（谁先变） | 影响面 | 降级动作 |
| --- | --- | --- | --- | --- |
| R1 | **Cookie 过期/被吊销** | `/api/config`→`login:false`；读接口 **302→signin** | 全线不可用 | 切只读 + 横幅"重新粘贴 Cookie"；**不自动重登**（重登需二次验证，见 R2） |
| R2 | **新设备登录需二次验证** | 登录页要短信/私信验证；短信每日有次数上限 | 用户无法自助登录 | **不实现账密登录**，只支持"浏览器复制 Cookie"，文案写清原因〔S7〕 |
| R3 | **反爬 432** | 空 body + `server: SHANHAI-SERVER`；`page>1` 更易 | 翻页断流 | 停 1min 后指数退避（×2，上限 8min）；降为"只加载第一页"；降并发 |
| R4 | **418/403 风控** | 418/403；`ok:0`+`msg` 含"频繁/安全/验证" | 写操作全禁 | 全站冷却；写按钮禁显倒计时；**禁自动重试** |
| R5 | **写操作扣验证码** | 返回 `url` 指验证页 / HTML 验证页 | 单次写失败 | 透传 `url` 让用户手动完成；完成后**重取 `st`** |
| R6 | **接口变更（m 站是私有 API）** | 字段缺失（`cardlistInfo` 消失）、`card_type` 新值、JSON→HTML | 解析崩 | provider 做**字段存在性断言**，缺字段 `??` 兜底并报 `UPSTREAM`；不因单字段崩整页 |
| R7 | **IP 限流** | 换 IP 恢复；同 IP 多账号都 302/418 | 全设备不可用 | 提示"网络出口被限"；**不做代理池**（合规红线） |
| R8 | **账号被限（禁言/封号）** | 写持续 `ok:0` + 特定 `errno`；`login` 仍 `true` | 只能读 | 只读 + 明确文案"当前账号无发布权限" |
| R9 | **OAuth 应用被拒/权限不足** | `10014 Insufficient app permissions` / `21301 auth by Null spi!` | OAuth 轨整体不可用 | 回退 cookie 轨（**双轨存在的意义**） |
| R10 | **频次超限** | `errno` 频次类；发博 30/小时触顶 | 有配额上限 | 本地记账（小时窗口）：80% 警告、100% 禁写 |
| R11 | **楼中楼结构变化** | `comments` 由 `false` 变数组/`null` | 评论渲染错乱 | 三态兜底：`false` 或 `undefined`→无子楼，`Array`→渲染，其它→忽略并上报 |

**可观测面板（verifier 验收点）**：错误分类命中数、302 次数、432 次数、`ok:0` 的 `errno` 直方图、发博小时配额使用率；全部打进 `console` + `window.__weibo_telemetry`，**便于无头 Chrome 断言**。


## 8. 待实测清单（拿到 cookie 后 5 分钟核对）

> 把 `<CK>` 换成 `SUB=…; SUBP=…; _T_WM=…`。**先确认 `data.login === true`**，否则后面全是 302。

**A. 登录态与 uid**
```bash
# A1 登录态 + st
curl -sS 'https://m.weibo.cn/api/config' -H "Cookie: <CK>" -H 'MWeibo-Pwa: 1' | python3 -m json.tool | head -12
# A2/A3 判定 432 成因：同 URL 分别换 UA/Referer/带头，看 302/432 是否变化
curl -sS -o /dev/null -w '%{http_code}\n' 'https://m.weibo.cn/api/container/getIndex?containerid=102803&page=2' \
  -H "Cookie: <CK>" -H 'Referer: https://m.weibo.cn/' -H 'MWeibo-Pwa: 1' -H 'X-Requested-With: XMLHttpRequest'
# A4 uid 从哪来（候选三条，看哪条有值）
curl -sS 'https://m.weibo.cn/api/profile/me' -H "Cookie: <CK>" | head -c 300
curl -sS 'https://m.weibo.cn/api/container/getIndex?type=uid&value=0' -H "Cookie: <CK>" | head -c 300
```

**B. 读接口语义**
```bash
# B1 关注流 cid：浏览器开 m.weibo.cn 首页 → DevTools Network → 抄 getIndex 那条的 containerid（候选 231093_-_selffollowed / 102803）
# B2 搜索 cid：站内搜一次，抄 getIndex 的 containerid（应形如 100103type%3D1%26q%3D…）
# B3 楼中楼：确认 comments 是数组且元素含 rootid
curl -sS 'https://m.weibo.cn/comments/hotflow?id=<id>&mid=<id>&max_id_type=0' -H "Cookie: <CK>" \
 | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print([(c['id'],bool(c.get('comments')),[x.get('rootid') for x in (c.get('comments') or [])][:2]) for c in d['data'][:5]])"
```

**C. 写接口（每条都要 st，先取 st 再打）**
```bash
ST=$(curl -sS 'https://m.weibo.cn/api/config' -H "Cookie: <CK>" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['st'])")
H=(-H "Cookie: <CK>" -H "X-XSRF-TOKEN: $ST" -H 'X-Requested-With: XMLHttpRequest' -H 'MWeibo-Pwa: 1' \
   -H 'Origin: https://m.weibo.cn' -H 'Referer: https://m.weibo.cn/')
# C1 点赞 / 取消赞（契约里唯一未验证的两条）
curl -sS 'https://m.weibo.cn/api/attitudes/like'   -X POST "${H[@]}" --data "id=<微博id>&st=$ST"
curl -sS 'https://m.weibo.cn/api/attitudes/unlike' -X POST "${H[@]}" --data "id=<微博id>&st=$ST"
# C2 评论 / 回复评论
curl -sS 'https://m.weibo.cn/api/comments/create'  -X POST "${H[@]}" --data "id=<微博id>&mid=<mid>&content=<urlencode>&st=$ST"
curl -sS 'https://m.weibo.cn/api/comments/create'  -X POST "${H[@]}" --data "id=<微博id>&mid=<mid>&cid=<父评论id>&content=<urlencode>&st=$ST"
# C3 发博（对照公开实现的字段名）
curl -sS 'https://m.weibo.cn/api/statuses/update' -X POST "${H[@]}" -H 'Referer: https://m.weibo.cn/compose/' \
  --data "content=<urlencode 测试内容>&st=$ST"
```

**判定表**：`ok:1` → 端点确认；`ok:0`+`errno` → 端点存在但参数/权限不对（记 `errno`）；HTML 登录页 → 认证问题；432/418 → 风控；404/空 → **端点名猜错，换候选**。


## 9. 来源

| # | 内容 | URL | 等级 |
| --- | --- | --- | --- |
| S1 | 官方接口文档（friends_timeline / public_timeline / show / comments/show / comments/create / comments/reply / update / upload / repost / attitudes/create / attitudes/destroy / users/show / user_timeline / search/statuses / search/topics） | `https://open.weibo.com/wiki/2/…` | 〔官方〕 |
| S2 | 官方 Scope 表（5 个值） | `https://open.weibo.com/wiki/Scope` | 〔官方〕 |
| S3 | 官方频次限制（100/天/用户、15000/小时/IP、发博 30/小时、未过审 15 测试账号） | `https://open.weibo.com/wiki/Rate-limiting` | 〔官方〕 |
| S4 | 官方 OAuth 授权 / 换 token 参数表 | `https://open.weibo.com/wiki/Oauth2/authorize`、`…/Oauth2/access_token` | 〔官方〕 |
| S5 | m 站端点收集 + 真实响应抓包（`docs/index.md`；抓包文件 `old/response.js`，样本时间 2019-06） | `https://raw.githubusercontent.com/upupming/weiboAPI/master/docs/index.md`、`…/old/response.js` | 〔公开实现〕 |
| S6 | m 站写接口实现（`st` 取法、header、form、`ok==1`、uploadPic 的 `pic_id` / `picId`、5MB 压缩） | `https://raw.githubusercontent.com/wdwind/weibo_api/master/weibo_api/weibo_cn_api/weibo_cn_api.py` + `…_constants.py` | 〔公开实现〕 |
| S7 | 新设备登录需二次验证、短信次数限制、建议复用会话 | `https://raw.githubusercontent.com/wdwind/weibo_api/master/README.md` | 〔公开实现〕 |
| S8 | 本次全部 curl 实测 | §1（2026-11-16 14:45–14:52） | 〔实测〕 |

**边界声明**：本文不含真实 cookie、不含原 app 代码。`〔待实测〕` 条目在拿到用户 cookie 前**不得**被当成已实现能力写进 README 或 UI 文案。