# t19 真实 Cookie 写操作检查清单

> 只在本地、用一次性测试账号执行；不要提交 Cookie、Cookie 片段或 `set-cookie` 输出。仓库里的自动化测试只使用 `SUB=test-fake` 假 Cookie。

## 0. 前置

```bash
pnpm build
RILL_PROVIDER=weibo RILL_PORT=8787 RILL_DB=data/rill.sqlite \
RILL_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")" \
pnpm server
```

1. 通过 `#/login` 粘贴 Cookie（或本地 `POST /api/session/cookie`），确认 `GET /api/session` 返回 `authenticated:true`、`hasSession:true`、`mode:"online"`，页面时间线来自真实微博。
2. 选一条**自己刚发的**微博 id；不要把别人的微博当测试对象。发博测试用唯一标记，例如 `Rill 写操作验证 2026-11-16`，便于事后删除。
3. 打开 DevTools Network，重点看：`Idempotency-Key`、`X-XSRF-TOKEN`、`X-Rill-CSRF`（本地服务）、响应状态与 `{error:{code}}`。

## 1. 顺序与预期

严格按此顺序，避免点赞数/评论数互相干扰。

### ① 点赞 like

- UI：时间线首卡 `like-btn`。
- 请求：`POST /api/status/<id>/like`，body `{"on":true}`。
- 期望：本地 200，`{liked:true,count:<真实计数>}`；UI 立即 +1 并保留；微博侧态度数 +1。
- 若失败：UI 回滚计数，提示错误；不要连点重试。

### ② 取消赞 unlike

- UI：同一卡片再次点击 `like-btn`。
- 请求：`POST /api/status/<id>/like`，body `{"on":false}`。
- 期望：本地 200，`{liked:false,count:<回落计数>}`；UI 计数回落。

### ③ 评论 comment

- UI：首卡 `reply-btn` → 弹层输入 → “发送”。
- 请求：`POST /api/status/<id>/comment`，body `{"text":"..."}`。
- 期望：本地 200，`{reply:{id,postId,text,...}}`；弹层关闭、时间线评论数 +1；详情页能看到该回复。
- 失败：弹层不关、文字保留、显示原因；修正后手动再发，不自动重试。

### ④ 转发 repost

- UI：首卡 `repost-btn` → 弹层（可空文案）→ “转发”。
- 请求：`POST /api/status/<id>/repost`，body `{"text":"..."}`。
- 期望：本地 200，`{post:{id,...}}`；弹层关闭、转发数 +1；若微博未返回 id，前端只标“待同步”，不伪造真实 id。
- 失败：弹层文字保留，手动重试。

### ⑤ 纯文本发博 publish

- UI：`#/compose` 输入 → `publish-btn`。
- 请求：`POST /api/status/publish`，body `{"text":"...","pics":[]}`，带一次 `Idempotency-Key`。
- 期望：本地 200，`{post:{id:<真实 id>}}`；回到时间线，新内容置顶，id 不是 `pending_*`。
- 重复提交：同一输入在按钮恢复前只能发一次；若网络中断后用**同一**幂等键手动重试，服务端应返回第一次结果，而不是再发一条。
- 失败：留在发博页、文字/图片占位保留、显示原因、按钮恢复可点；**绝不自动重发**。`AUTH_EXPIRED` 先重新登录，再手动重试；`RISK_CONTROL` 停止操作，不要连续试。

### ⑥ 图片发博（可选，真实文件）

- 先用真实 JPG（≤5 MB，待实测上限）走 provider 的 `POST /api/statuses/uploadPic`：multipart `type=json`、`st`、`pic`；期望返回 `pic_id`。
- 再发博时带 `picId`（逗号分隔，大写 I）；期望返回真实帖子 id，详情图片可加载。
- 如果当前前端只有占位图（没有真实文件输入），服务端会**显式降级为纯文本**并返回 `notice`；UI 必须显示“已按纯文本发布”，不得声称图片已上传。
- 上传失败/超时：文本仍可发；若返回 `AUTH_EXPIRED`/`RISK_CONTROL`/`RATE_LIMITED`，停止并按下方矩阵处理。

## 2. 六类错误响应

| HTTP | code | 含义与动作 |
| --- | --- | --- |
| 401 | `AUTH_EXPIRED` / `AUTH_REQUIRED` | Cookie 过期/缺失：重新登录后**手动**重试；不要连发。 |
| 403 | `RISK_CONTROL` | 微博风控/验证：停止写操作，换网络或人工验证。 |
| 429 | `RATE_LIMITED` | 本地每账号 6 次/分钟或微博限流：等待至少 60 秒；第 7 次本地请求不触上游。 |
| 422 | `CONTENT_REJECTED` | 内容为空/超长/敏感/被审核：保留草稿，修改文字后手动重试。 |
| 404 | `NOT_FOUND` | 原微博删除/不可见：刷新后换目标。 |
| 502 | `UPSTREAM` | 微博 5xx/非 JSON/超时：**不自动重试**；检查网络后手动重试。 |

## 3. 红线

- 本清单和网络面板里的 Cookie 值不写进报告、仓库或日志。
- 写失败不自动重发；只有 XSRF 失效时 provider 会重取一次 token，`publish` 连这次重取都不做，避免重复发帖。
- 同一 `Idempotency-Key` 5 分钟内返回同一结果；服务端只缓存成功结果。
