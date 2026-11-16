# 部署与使用说明（离线 / 在线两种跑法）

这份文档是写给**没参与开发的人**的：照它能在自己机器或自己服务器上把溪流跑起来、登录你自己的微博、出问题时知道看哪一段。
命令都可以直接复制执行；路径用 `weibo-lite/` 表示仓库根目录，换成你自己的目录即可。

> **三条先说清楚**（后文 §11 有完整版）：
> 1. **Cookie 等同于你的账号凭证**：只粘进**你自己跑起来的那个实例**。不要发给任何人（包括开发者）、不要贴进 issue/聊天/截图、不要提交进仓库。
> 2. **用 Cookie 直连微博接口违反微博服务条款**，账号有被限流/风控的风险，**责任在使用者**。建议小号先试。
> 3. **真实 Cookie 的全链路我们一次都没在真站跑过**（我们手上没有你的凭证）。所以"能登录"目前是**代码级 + 假上游级**验证，**不是**线上验证 —— 第一次真跑的人是你。

---

## 1. 先选路：你要的是哪一种

| | 路线 A · 离线（默认） | 路线 B · 在线（登录微博） |
| --- | --- | --- |
| 一句话 | 一个纯本地的演示应用，数据是随包 mock | 同一个界面，数据来自你自己的微博账号 |
| 需要凭证 | **不需要** | 需要你自己的微博 Cookie（§5） |
| 会不会连外网 | **不会**（只加载本地静态资源） | 会：本机 server 代理请求 `m.weibo.cn` |
| 数据存哪 | 浏览器 localStorage + 随包 `src/data/mock.json` | 会话加密存本机 SQLite（§10），内容不落盘 |
| 启动命令 | `pnpm build && pnpm run preview` | `RILL_SECRET=… RILL_PROVIDER=weibo pnpm run server` |
| 地址 | `http://127.0.0.1:4179` | `http://127.0.0.1:8787` |
| 能做什么 | 四条主线全部可点、可发博（本机）、可点赞 | 只读（时间线/详情/评论/用户/搜索）+ 写（点赞/评论/转发/发博，见 §11 备注） |
| 适合谁 | 只想看产品形态 / 内部验收 / 无账号 | 想看自己真实关注流的人 |

两条路**用的是同一份前端代码**：在线与否由服务端 `RILL_PROVIDER` 决定，前端启动时会读 `/api/config`，读不到就退回离线（`src/data/api.ts` 里 `config.provider === 'weibo'` 才判 online）。

---

## 2. 前置条件

| 项 | 要求 | 说明 |
| --- | --- | --- |
| Node.js | **26 或更高（推荐）** | 服务端用内置 `node:sqlite`：**26 起才是稳定接口**，CI 与 Dockerfile 都固定 26。低于 26 启动只打一条警告、不会崩（本机在 Node 24.21 上实测登录/会话/限流都能跑通），但不保证长期可用 |
| pnpm | 11.x | `pnpm install` 用；也可以 `npm install`（仓库有 `pnpm-lock.yaml`，pnpm 更稳） |
| Docker | 可选 | 只有走 §6 才需要 |
| 浏览器 | Chrome / Edge / Safari 新版 | 需要能开 DevTools（取 Cookie 用） |

```bash
cd weibo-lite
pnpm install --frozen-lockfile
```

---

## 3. 路线 A · 离线模式（不需要任何凭证）

```bash
cd weibo-lite
pnpm install --frozen-lockfile
pnpm build            # 内含 check:mock + tsc --noEmit + vite build
pnpm run preview      # 静态预览服务，端口 4179
```

然后浏览器打开 **http://127.0.0.1:4179**。

- 数据全部来自 `src/data/mock.json`（12 作者 / 30 动态 / 60 回复），**不发任何外部请求**。
- 点赞、发博、改主题都会写 localStorage（`rill:v1:*`），刷新还在；底部导航第 4 项 **「设置」** 里有「清空本地数据 → 确认清空」，一键还原。
- 离线模式下打开 `#/login` 没意义：页面会提示 **「连接本地服务失败，请确认 server 已启动。」** —— 离线本来就没有 server，属正常现象。
- 想边改代码边看：`pnpm dev`（端口 5179，纯前端）。

> 注意：`pnpm run preview` 只服务已构建的 `dist/`。改了代码要先重新 `pnpm build`。

---

## 4. 路线 B · 在线模式（登录你自己的微博）

### 4.1 先生成一个 `RILL_SECRET`

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

把输出（32 字节的 base64；64 位 hex 也支持）存到一个**只有你能读到的地方**：shell 里 `export`、服务器上的 systemd `Environment=`，或项目根目录的 `.env`。

> ⚠️ **`.env` 目前还没有写进 `weibo-lite/.gitignore`**（`*.sqlite`、`data/` 已忽略，`.env` 没忽略）。你要用文件存密钥的话，先自己往 `.gitignore` 加一行 `.env`，或者干脆只 `export`、不落文件。**无论哪种方式，都不要把密钥提交进仓库。**

- **丢了会怎样**：已存会话的 Cookie 是用它派生的密钥加密的，解不开 → 服务端会把那条会话直接删掉并清 cookie（`server/routes/session.mjs` 的解密失败分支），你**需要重新登录一次**。其他数据不受影响。
- **它不等同于 Cookie**：泄露 `RILL_SECRET` 的人能解开本机 SQLite 里的会话，所以它也是敏感值，别进仓库、别进群。
- 缺失或长度不对时服务**直接启动失败**并打印生成命令（`server/crypto.mjs` 的 `loadSecret`）。

### 4.2 启动

```bash
cd weibo-lite
pnpm install --frozen-lockfile
pnpm build                       # 必须先构建：server 同源服务 dist/

RILL_SECRET="<你刚生成的那串>" \
RILL_PROVIDER=weibo \
pnpm run server
```

- 打开 **http://127.0.0.1:8787**（页面和 API 同源，没有 CORS）。
- **本机 http 访问时不要设 `NODE_ENV=production`**：它会给会话 cookie 加 `Secure`，纯 HTTP 下浏览器可能直接不回传 → 表现成"登录了又没登录"。`NODE_ENV=production` 只在**上了 HTTPS 之后**（§7）才加。
- 启动日志会打印 `[rill] listening on http://127.0.0.1:8787 provider=weibo mode=online` 和 `[rill] db=data/rill.sqlite`。
- 只想本机用就别改 `RILL_HOST`（默认 `127.0.0.1`，外部访问不到 —— **这是刻意的**）。

自检：

```bash
curl -s http://127.0.0.1:8787/api/health     # {"ok":true,...,"provider":"weibo","mode":"online"}
curl -s http://127.0.0.1:8787/api/config     # {"auth":{"cookieLogin":true,"oauth":false},...}
```

### 4.3 登录

1. 浏览器打开 http://127.0.0.1:8787 ，地址栏补上 `#/login`（或点顶栏右侧账号区：未登录时写着「登录」）。
2. 按 §5 取得 Cookie 文本，粘贴进输入框（支持 `SUB=…; SUBP=…` 一整行，也支持每行一个 `name=value`）。
3. 点「保存 Cookie 并连接」。看到 **「Cookie 已保存」** 就是会话已建立并校验通过；看到 **「Cookie 已保存，微博校验待确认」** 表示会话存下了但这次没校验出身份（常见于刚被风控或 Cookie 不全），先按 §8 联调、必要时重登。
4. 页面 2 秒后自动回时间线。

### 4.4 开发模式（改前端时用）

```bash
RILL_SECRET="<密钥>" RILL_PROVIDER=weibo pnpm run dev:full
```

同时起 Vite（5179）和 API（8787），页面 `http://127.0.0.1:5179`，`/api` 由 Vite 代理到 8787。

### 4.5 环境变量总表（以 `server/` 代码为准）

| 变量 | 必填 | 默认 | 作用 |
| --- | --- | --- | --- |
| `RILL_SECRET` | **是** | — | 32 字节密钥（base64 或 64 位 hex） |
| `RILL_PROVIDER` | 否 | `mock` | `mock` = 离线数据；`weibo` = 在线只读 + 写 |
| `RILL_HOST` | 否 | `127.0.0.1` | 监听地址；容器内用 `0.0.0.0` |
| `RILL_PORT` | 否 | `8787` | 监听端口 |
| `RILL_DB` | 否 | `data/rill.sqlite` | SQLite 文件；`:memory:` 用于临时测试 |
| `RILL_WEIBO_BASE` | 否 | `https://m.weibo.cn` | 上游 base URL（一般不用改） |
| `NODE_ENV` | 否 | `development` | `production` 时 session cookie 加 `Secure`（**用 HTTPS 才设**，见 §7） |
| `RILL_WEIBO_FRIENDS_CONTAINER` / `RILL_WEIBO_RECOMMEND_CONTAINER` | 否 | `231093_-_selffollowed` / `102803` | 关注流 / 推荐流的栏目 container id；只有上游改版时才需要动 |

> `RILL_TRUST_PROXY` 目前**不存在**（计划中的 t26）。限流一律按 TCP 直连 IP 计算，见 §7。

---

## 5. Cookie 怎么拿（给非工程师）

### 5.1 五步

1. 用**桌面浏览器**打开 https://m.weibo.cn 并登录（扫码/账号都行，登录时可能要二次验证 —— 这是微博对"新设备"的要求）。
2. 登录成功后按 `F12` 打开 DevTools。
3. 选 **Application（应用）** → 左侧 **Storage → Cookies** → 点 `https://m.weibo.cn`。
4. 在表格里找到 `SUB`、`SUBP`（必要时加 `_T_WM`）三行，把 **Value** 复制出来，拼成一行：
   ```
   SUB=<值>; SUBP=<值>; _T_WM=<值>
   ```
   （也可以把每条单独一行粘进登录框，页面里写的是 `name=value` 每行一个也支持。）
5. 粘进**你自己实例**的 `#/login` 输入框 → 保存。

> 不想一条条抄：DevTools 的 **Network** 面板里点任意一个 `m.weibo.cn` 请求 → **Request Headers → Cookie**，整行复制即可。登录框会自动丢弃白名单外的 cookie，跳过条数会显示在输入框下方（「识别到 3 条，跳过 12 条」）。

### 5.2 哪些必需、哪些可缺（对齐 `docs/weibo-api.md` §2.1）

| cookie | 是否必需 | 说明 |
| --- | --- | --- |
| `SUB` | **必需** | 登录态主票据（`_2A` 开头的是**游客票**，不是登录票） |
| `SUBP` | **必需** | SUB 的伴随票，只有 SUB 通常不够 |
| `_T_WM` | 建议 | 设备/风控指纹票；缺了更容易吃 `432` |
| `XSRF-TOKEN` | 可选 | 真正的 XSRF token 走 `/api/config` 的 `data.st`，本服务自己取 |
| `M_WEIBOCN_PARAMS` | 可选 | 前端路由态，接口层非必需 |
| `WEIBOCN_FROM` | 可选 | 渠道标记，服务端每次下发 `1110003030` |

本实例的服务端**只接受这 6 个名字**（白名单），其余一律丢弃（`server/routes/session.mjs` 的 `pickCookies`）。

### 5.3 本实例怎么处理你的 Cookie

- 会话 Cookie 整体 JSON 序列化 → **AES-256-GCM** 加密（密钥由 `RILL_SECRET` 派生，只存在内存里），密文、iv、tag 分列写入本机 SQLite。
- 发给浏览器的会话 cookie 名是 `rill_sid`：**HttpOnly** + `SameSite=Lax` + `Path=/`，`NODE_ENV=production` 时再加 `Secure`。也就是说它不会出现在 `localStorage`，JS 读不到。
- **日志只记录 cookie 名称与长度**（形如 `session.cookie {"cookies":[{"name":"SUB","length":120}]}`），不打印值、不打印请求体、不打印完整 Cookie 头。
- 所有非 GET 的 `/api/*` 要求同源 `Origin`，或带与会话绑定的 `X-Rill-CSRF` token（防止别的网页偷偷调你本机的服务）。

> ⚠️ 别人只要能访问你这个服务（比如你把端口暴露到公网、或开了 `RILL_HOST=0.0.0.0` 又没做访问控制），就能用你的登录态去读微博。**默认只听 127.0.0.1 正是因为这一点**；要暴露到公网必须先看 §7。

---

## 6. Docker 方式

### 6.1 构建 + 运行

```bash
cd weibo-lite
export RILL_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
docker build -t rill .

docker run -d --name rill \
  -p 8787:8787 \
  -e RILL_SECRET="$RILL_SECRET" \
  -e RILL_PROVIDER=weibo \
  -v rill-data:/app/data \
  rill
```

- `-v rill-data:/app/data` **必须挂**：镜像里 `RILL_DB=/app/data/rill.sqlite`，不挂卷的话容器一重建，**你的会话（登录态）就没了**，得重新粘 Cookie。
- `RILL_SECRET` **必须显式传**，镜像不提供弱默认值；不传 → 容器启动即退出并在日志里打印生成命令。
- 非 root 用户 `node` 运行；`EXPOSE 8787`；镜像内置 `HEALTHCHECK`（每 30 秒打一次 `/api/health`）。

### 6.2 用 compose（推荐，省去手写 run）

```bash
cd weibo-lite
export RILL_SECRET="$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")"
export RILL_PROVIDER=weibo          # 不写这行：compose 默认回退成 mock（离线数据）
docker compose up -d --build
```

`docker-compose.yml` 已经配好端口映射、`rill-data` 卷、`restart: unless-stopped`。**没设 `RILL_SECRET` 时 compose 会直接报错退出**（`${RILL_SECRET:?…}`），这是故意的。

### 6.3 看健康状态

```bash
docker inspect --format '{{.State.Health.Status}}' rill    # healthy / starting / unhealthy
docker logs -f rill                                        # 服务日志（只有 cookie 名与长度）
```

`healthy` 之后访问 http://127.0.0.1:8787 ，然后按 §4.3 登录。

> **未验证**：本机没有 Docker，`docker build` / 容器启动我们**没有实测**；CI 里有独立的 docker job（`.github/workflows/ci.yml`）负责这条，但我们在本地无法替它打包票。遇到构建失败请看 `docker build --progress=plain` 的层输出。
>
> 顺带说明：`ci.yml` 里那条「Dockerfile 的 build 阶段没有 `COPY server`、所以 docker job 会红」的注释**已过时** —— 现在的 `Dockerfile` build 阶段有 `COPY server ./server`，运行时阶段的 `COPY --from=build /app/server ./server` 有源可拷。以 `Dockerfile` 本文件为准。

---

## 7. 反向代理（要把服务放到公网/局域网时）

**HTTPS 是必须的**：你要在页面里粘贴 Cookie，明文 HTTP 等于把凭证暴露在链路上；同时 `NODE_ENV=production` 会给 `rill_sid` 加 `Secure`，纯 HTTP 下浏览器不会回传这个 cookie，登录看起来就"没生效"。

### 7.1 限流与来源 IP（重要）

登录接口是 **5 次/分钟**（按 IP + 会话各算一次），写操作 **6 次/分钟**（按会话）。这两个桶用的是 **TCP 直连 IP**（`server/http.mjs` 的 `clientIp()` 直接读 `req.socket.remoteAddress`）。

> **`RILL_TRUST_PROXY` 尚未实现（计划中，见 t26；以 `server/README.md` 为准）。** 也就是说：**放在 nginx/Caddy 后面时，所有请求看起来都来自代理的 IP** —— 登录限流会变成"全局 5 次/分钟"，写限流按会话算不受影响。自己一个人用没问题；**多人共用一个实例会互相挤**。在 `RILL_TRUST_PROXY` 落地前，不要把它当成多用户服务。

### 7.2 nginx 最小片段

```nginx
server {
  listen 443 ssl;
  server_name rill.example.com;

  ssl_certificate     /etc/letsencrypt/live/rill.example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/rill.example.com/privkey.pem;

  location / {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host              $host;     # 必须与应用自身 Host 一致，否则 CSRF Origin 校验会 403
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-For   $proxy_add_x_forwarded_for;  # 目前仅记录，限流还不读
  }
}
```

### 7.3 Caddy 最小片段

```caddyfile
rill.example.com {
  reverse_proxy 127.0.0.1:8787 {
    header_up Host {host}      # 同上：Host 必须透传成外部域名
  }
}
```

> 因为 CSRF 校验比对的是"请求自带 `Origin` 的 host"与"`Host` 头"，反代**一定要把 Host 透传成用户访问的域名**，否则所有写操作都会 `403 csrf_origin_mismatch`。
> **未验证**：我们没有在生产 HTTPS 环境跑过这套反代组合。

---

## 8. 首次联调（拿到 Cookie 后，约 15 分钟）

完整 16 步在 **[`docs/weibo-verify-15min.md`](weibo-verify-15min.md)**，那里每一行都写了"应该看到什么 / 不符合说明什么"。**这一步只能你自己做 —— 因为只有你有你的 Cookie，我们不要、也不该拿到它。**

推荐顺序（先只读、再写，出问题更容易定位）：

1. **A 组 · 验身份**（3 步）：确认 `data.login === true`、记下你的 uid。
2. **B 组 · 验读**（7 步）：先只看**关注流**能不能拉（B1），再看推荐流、单条详情、长文 `extend`、评论、翻页、用户资料。
3. **C 组 · 验写**（6 步）：先 **点赞**（C1/C2，可撤销），再 **评论**（C3），最后才 **发博**（C5 纯文本 → C6 带图）。转发 C4 不可撤销，记得删。

建议先拿**小号**跑 A/B 两组；确认稳定后再对主号试写。

---

## 9. 故障排查表（按症状查）

| 症状 | 多半是什么 | 怎么办 |
| --- | --- | --- |
| 接口返回 **432** / **418** | 微博风控（常见于 Cookie 太新、换了 IP、短时间多次登录） | **等 10 分钟**，或换回登录时用的网络，再试一次。**不要反复重登** —— 重登会让风控更严。 |
| 请求被 **302** 跳到 `passport.weibo.cn` / `signin` | Cookie 已过期，或被站点判为游客（`SUB` 是 `_2A` 开头的游客票） | 回浏览器重新登录 → 重新取 `SUB`/`SUBP` → 在 `#/login` 重新粘贴。 |
| **401** `AUTH_EXPIRED` / `AUTH_REQUIRED` | 会话里没有可用的凭证，或加密会话解不开 | 先看服务日志有没有 `session.cookie`；重新登录一次。若刚改过 `RILL_SECRET`，那必然要重登。 |
| **403** `RISK_CONTROL` | 上游判定为风险请求（写操作尤其容易） | 停手，等十几分钟；确认请求来自你登录时的网络；不要用脚本高频重试。 |
| **429** | 触发本服务自己的限流：登录 **5 次/分钟**、写操作 **6 次/分钟**（响应带 `Retry-After: 60`） | 等 60 秒。放反代后面时登录限流是全局的（§7.1）。 |
| 登录页显示 **「连接本地服务失败，请确认 server 已启动。」** | 前端连不到 `/api/config` | 你八成是在**离线模式**（`pnpm preview` 4179）打开 `#/login`；或者在线模式下 server 没起来 / 端口不对。 |
| 登录页显示 **「Cookie 格式不被服务接受，请检查粘贴内容。」** | 粘贴内容里没有白名单内的 `name=value`（比如只粘了值、或粘了别的站点的 cookie） | 重新按 §5.1 复制 `SUB=…; SUBP=…`。 |
| 登录页显示 **「尝试太频繁，请等一分钟再试。」** | 命中登录限流 | 等 60 秒；**别用脚本循环重试**。 |
| 登录页显示 **「会话未能建立，请重新粘贴完整 Cookie。」** | 服务端拿到 cookie 但校验失败（`AUTH_EXPIRED`/`AUTH_REQUIRED`） | Cookie 不全（缺 `SUBP`）或已过期；重新登录微博再取一次。 |
| 登录成功但页面显示 **「Cookie 已保存，微博校验待确认」** | 会话已加密入库，但这次没校验出身份（风控 / 上游 302 / uid 拿不到） | 先回时间线看点不点得开；持续这样按 `432` 处理。 |
| `#/search` 显示 **「搜索只在线可用」** | 离线模式 | 正常：离线只搜索本机 mock（`Search.tsx` 的文案）。 |
| 启动报 **`EADDRINUSE`** | 端口被占（8787 或 4179） | 换端口：`RILL_PORT=8878 pnpm run server`；或 `lsof -ti tcp:8787 \| xargs kill` 收掉旧的。 |
| 启动直接退出，日志里有 **「RILL_SECRET 未设置…」** | 没传密钥或长度不对 | 按日志里的 `node -e` 命令重新生成，再带上环境变量启动。 |
| Docker 重启后要重新登录 | `/app/data` 没挂卷，SQLite 跟着容器一起没了 | 按 §6.1 加 `-v rill-data:/app/data`；compose 已内置。 |
| 日志里出现 Node 版本警告 | Node < 26 | 建议换 Node 26+（稳定接口）；24 上实测可用，但别指望长期兼容。 |

---

## 10. 数据与清理

- **会话数据**：SQLite 文件，默认 `weibo-lite/data/rill.sqlite`（可用 `RILL_DB` 改；容器里是 `/app/data/rill.sqlite`）。`data/`、`*.sqlite*` 都在 `.gitignore` 里。
  表结构：`sessions(sid, created_at, last_seen, cookies_enc, iv, tag, provider)` + `kv(k, v)`（存每个会话的 CSRF token）。
- **退出登录 = `DELETE /api/session`**（在线时点顶栏账号名旁的「退出」就是这个）：
  删除该 `sid` 的会话行 **并且** 连带删除 `kv` 里的 `csrf:<sid>`，同时下发一个过期空 cookie（`204`）。之后刷新页面就是未登录状态。
- **彻底清掉本地数据**：
  ```bash
  # 本机模式
  rm -f weibo-lite/data/rill.sqlite weibo-lite/data/rill.sqlite-wal weibo-lite/data/rill.sqlite-shm
  # Docker 模式（连卷一起删）；compose 的卷名带项目前缀，先确认再删
  docker rm -f rill && docker volume ls --format '{{.Name}}' | grep rill-data | xargs -r docker volume rm
  ```
  再清一下浏览器里 `rill:v1:*` 的 localStorage（底部「设置」→「清空」→ 确认），以及 `rill_sid` cookie。
- **微博账号侧**：如果担心凭证残留，去微博「账号设置 → 安全中心」把该设备的登录踢掉（Cookie 随即失效）。

---

## 11. 合规与风险声明（请照原样理解，别当免责套话）

1. **用 Cookie 直连微博网页接口，违反微博服务条款。** 你的账号有被**限流、风控、甚至封禁**的风险；后果由使用者承担，本项目不提供任何绕过、也不承诺账号安全。**建议用小号先试。**
2. **官方开放平台（OAuth）那条路我们没走通**，原因在 [`docs/weibo-api.md`](weibo-api.md) 里逐条核过，简言之三道门：
   - **接口权限 + 审核**：要申请到"读关注流 / 发博"这类权限得过应用审核；
   - **频次限制**：单用户读 100 次/天、发博 30 次/小时 —— 产品形态直接被限死；
   - **未过审只能 15 个测试账号**：无法对你开放。
   所以这里走的是"你自己贴自己的 Cookie、本机代理"的路子，不是官方集成。
3. **真实 Cookie 全链路一次都没在真站跑过。** 我们手上没有凭证，因此"能登录、能拉流、能发博"这些结论来自**代码级验证 + 假上游（mock upstream）单测**（`server/test/write-ops.mjs`、`scripts/check-online-writes.mjs`），**不是线上验证**。第一次真实运行的人是你；出问题请按 §9 自查，我们无法替你复现。
4. **代码现状备注（以代码为准）**：
   - `/api/provider` 的 `capabilities.write` 现在返回 `true`（mock 与 weibo 一致；mock 的写是客户端本地 store 行为），写路由（`server/routes/write.mjs`）与 provider 的 `like/repost/comment/publish` 都已实现；m 站真实写端点仍属待实测，证伪时按契约降级。
   - 在线发博**没有真实图片文件输入**：图片只做占位，上游图片上传失败会自动降级为纯文本发布，并在返回里 `notice` 说明（`server/providers/weibo.mjs`）。
   - 写请求带 `Idempotency-Key` 头时，5 分钟内**同一个 key + 同一个目标**只发一次（键里含会话与目标 id，不含正文）；写失败**不会自动重发**（避免重复发博）。
5. **没有实测过的部分**（都标了"未验证"）：Docker 构建/容器启动（本机无 Docker）、生产 HTTPS 与反代组合、真实账号的读写全链路。