# Rill server（零依赖后端）

这是 Rill 的在线能力后端：`node:http` 提供 JSON API，`node:sqlite` 保存会话，`node:crypto` 做 AES-256-GCM 加密。**没有任何 npm 运行时依赖**（没有 express / hono / better-sqlite3 / cookie-parser）。

> 在线只读链路的首次联调（拿到真实 cookie 后 15 分钟）：见 [`../docs/weibo-verify-15min.md`](../docs/weibo-verify-15min.md)。Cookie 只粘进你自己的实例，不要发到聊天/截图。

## 运行时要求

- Node **26+**（`node:sqlite` 的稳定用法；Dockerfile 固定 `node:26-alpine`）
- 生产静态站点需要先 `pnpm build` 生成 `dist/`

## 环境变量

| 变量 | 必填 | 默认 | 说明 |
| --- | --- | --- | --- |
| `RILL_SECRET` | 是 | — | 32 字节密钥，base64 或 64 位 hex；缺失/长度不对立即启动失败并打印生成命令 |
| `RILL_HOST` | 否 | `127.0.0.1` | 监听地址；容器内用 `0.0.0.0` |
| `RILL_PORT` | 否 | `8787` | 监听端口 |
| `RILL_DB` | 否 | `data/rill.sqlite` | SQLite 文件；`:memory:` 可用于临时测试 |
| `RILL_PROVIDER` | 否 | `mock` | `mock`（离线数据）或 `weibo`（在线；需先在页面粘贴 Cookie，读写能力见 `/api/provider`） |
| `RILL_WEIBO_BASE` | 否 | `https://m.weibo.cn` | 微博 provider base URL（测试假上游时可覆盖） |
| `RILL_TRUST_PROXY` | 否 | 关（空） | 设为 `1` 才采信 `X-Forwarded-For` 的**最后一跳**；直连不要开，只有前面确实有你自己控制的反代时才开 |
| `NODE_ENV` | 否 | `development` | `production` 时 session cookie 加 `Secure` |

生成密钥（**不要把它提交到仓库或写进日志**）：

```bash
export RILL_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
```

## 启动

```bash
# 只起 API / 生产静态服务
RILL_SECRET=... pnpm run server

# 开发：Vite（5179）+ API server（8787），Vite 把 /api 代理到 8787
RILL_SECRET=... pnpm run dev:full

# 生产：先构建前端，再用 server 同源服务 dist/
pnpm build
NODE_ENV=production RILL_SECRET=... pnpm run server
```

默认地址 `http://127.0.0.1:8787`。开发时页面是 `http://127.0.0.1:5179`，通过 Vite proxy 调 API；生产时页面和 API 同源（无 CORS）。

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| GET | `/api/health` | `{ok:true, version, provider, mode}` |
| GET | `/api/config` | `{auth:{cookieLogin:true, oauth:false}, provider, offlineFallback:true}` |
| GET | `/api/provider` | `{name, capabilities:{read:true, write:true, images:false}}`；写端点仍属【待实测】，真实 cookie 证伪时按契约降级 |
| POST | `/api/session/cookie` | 请求体 `{cookies:[{name,value}]}`；白名单过滤、加密入库、201 + `Set-Cookie: rill_sid=…` |
| GET | `/api/session` | `{authenticated, hasSession, provider, mode, user?:{uid,screenName,avatarUrl}}`；响应头 `X-Rill-CSRF`。服务端按 30 天 TTL 校验 `last_seen`；过期会删除 sessions 行 + `kv:csrf:<sid>` 并返回 `authenticated:false`。`/api/config` 不返回 uid，服务端会按 config → `/api/account/get_uid` → `uid:null` 兜底；uid 为空也不判未登录。 |
| DELETE | `/api/session` | 清库 + 清 cookie；204 |
| GET | `/api/timeline?tab=friends`（或 `recommend`）`&cursor=` | 在线只读时间线；`{items, next, hasMore, users}` |
| GET | `/api/status/:id` | 单条详情；`{post, users}` |
| GET | `/api/comments/:id?cursor=` | 评论 + 楼中楼一层；`{items, next, hasMore, users}` |
| GET | `/api/user/:uid` | 用户资料；`{user}` |
| GET | `/api/user/:uid/posts?cursor=` | 用户博文；`{items, next, hasMore, users}` |
| GET | `/api/search?q=&kind=statuses`（或 `users`/`topics`）`&cursor=` | 在线只读搜索；`{items, next, hasMore, users}` |

读接口在 `RILL_PROVIDER=weibo` 时要求会话 cookie；`AUTH_EXPIRED`/`AUTH_REQUIRED` 401、`RATE_LIMITED` 429、`RISK_CONTROL` 403、`NOT_FOUND` 404、`UPSTREAM` 502。provider 对 429/432 最多重试 2 次（指数退避），单请求 10 秒超时，响应在进程内 LRU 缓存 45 秒（键含账号指纹 + 接口 + 参数）。

`POST /api/session/cookie` 每次尝试走内存令牌桶，同时按 **IP** 与 **sid+IP** 两个 key 计数（新会话尚未签发 sid，单按 sid 会被每次 Set-Cookie 绕开），**每分钟最多 5 次**，第 6 次返回 429 + `Retry-After: 60`。

## Cookie 安全约定

- 只接受白名单：`SUB`、`SUBP`、`_T_WM`、`XSRF-TOKEN`、`M_WEIBOCN_PARAMS`、`WEIBOCN_FROM`；其他 cookie 直接丢弃。
- 会话 cookie 先 JSON 序列化，再 AES-256-GCM 加密为 `cookies_enc` BLOB，`iv` / `tag` 分列存储；密钥只在内存中来自 `RILL_SECRET`。
- **日志只允许出现 cookie 名与长度**（`session.cookie {"cookies":[{"name":"SUB","length":120}]}`），绝不打印值、请求体或完整 Cookie header。
- `rill_sid` 为 HttpOnly + SameSite=Lax + Path=/；`NODE_ENV=production` 时加 Secure。
- CSRF 基线：所有非 GET 的 `/api/*` 必须有与自身 Host 匹配的 `Origin`，或 `X-Rill-CSRF` 与会话绑定的随机 token 匹配。唯一例外是无会话、无 Origin 的 cookie 登录 bootstrap；带了不匹配 Origin 仍 403。
- `GET /api/session` 在响应头返回当前会话的 `X-Rill-CSRF`，客户端删除/写入时带上即可；不要把它写进 URL。
- 会话 TTL 为 30 天（`SESSION_TTL_MS`），只在 `GET /api/session` 时刷新 `last_seen`；读/写接口不续期，避免“有流量就永不过期”。过期会同时删 `sessions` 与 `kv:csrf:<sid>`。
- `RILL_TRUST_PROXY=1` 时 `clientIp` 取 `X-Forwarded-For` 最后一跳；默认关闭。**直连不要开**；只有前面确实有你自己控制的反代时才开，否则限流键可被伪造头影响。

## SQLite schema

```sql
sessions(sid TEXT PRIMARY KEY, created_at INTEGER, last_seen INTEGER,
         cookies_enc BLOB, iv BLOB, tag BLOB, provider TEXT)
kv(k TEXT PRIMARY KEY, v TEXT)
```

`openDb()` 使用 `CREATE TABLE IF NOT EXISTS`；默认文件 `data/rill.sqlite`，WAL 模式。`*.sqlite*` 与 `data/` 已在 `.gitignore` 中。

## Providers

- `providers/mock.mjs`：只读复用 `src/data/mock.json`，方法与前端选择器对齐：`getTimeline({tab,limit,offset})`、`getStatus(id)`、`getComments(postId)`、`getUser(uid)`、`getUserPosts(uid)`、`search(query)`。关注流规则与 `src/store.ts` 一致（排除本人和 `u_10/u_11/u_12`）。
- `providers/weibo.mjs`：按 `docs/weibo-api.md` §5.2 实现 6 个只读方法（`getTimeline/getStatus/getComments/getUser/getUserPosts/search`）+ `validateSession/getConfig`；统一注入 Cookie、`MWeibo-Pwa`、`X-Requested-With`、`Referer` 与移动 UA，10 秒超时、429/432 重试、错误五分类、字段映射到 `src/types.ts`、长文二次请求 `/statuses/extend`、45 秒 LRU 缓存。写方法（like/repost/comment/publish）已在 t19 接通；`capabilities.write` 如实为 `true`，但 m 站写端点仍属【待实测】，真实 cookie 证伪时按 §8 降级。不实现游客票据兜底。
- `source`/`from`（微博返回 HTML）与 `verified`/`verified_type` 已在 provider 映射；`source` 去标签/解实体/截 24 码点，缺省不伪造；`verified` 只在明确为 true（或 `verified_type >= 0`）时输出。呈现层负责 `来自 ` 前缀与空值不渲染。

## Docker

```bash
export RILL_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
docker compose up --build
curl -s http://127.0.0.1:8787/api/health
```

- 多阶段：`node:26-alpine` 构建前端 → 运行时只拷 `dist`、`server`、`src/data/mock.json`、`package.json`。
- 非 root 用户 `node`；`EXPOSE 8787`；`HEALTHCHECK` 用 Node 内置 `fetch` 打 `/api/health`。
- `docker-compose.yml` 挂 `rill-data` volume 到 `/app/data`；`RILL_SECRET` 必须显式传入，不提供弱默认值。

没有 Docker 的机器上验证 Dockerfile 的方式（CI 有 Docker 时）：

```bash
docker build -t rill:ci .
docker run --rm -e RILL_SECRET="$RILL_SECRET" -p 8787:8787 rill:ci
curl -fsS http://127.0.0.1:8787/api/health
```

## 为什么零依赖

服务只需要 HTTP 路由、SQLite 和加密：Node 26 已经内置 `node:http`、`node:sqlite`、`node:crypto` 和 `fetch`。用内置模块能避免供应链、native binding 和多版本 Node 兼容问题；前端依赖（React/Vite）只在构建阶段需要，不进入运行时镜像。

## 快速自检

```bash
for f in server/*.mjs server/routes/*.mjs server/providers/*.mjs; do node --check "$f" || exit 1; done

RILL_SECRET=... RILL_DB=:memory: node server/index.mjs &
curl -s http://127.0.0.1:8787/api/health
curl -s http://127.0.0.1:8787/api/config
curl -s -X POST http://127.0.0.1:8787/api/session/cookie \
  -H 'content-type: application/json' \
  -d '{"cookies":[{"name":"SUB","value":"fake"}]}'
```