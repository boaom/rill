# 在线链路安全审计（t20）

> 审计对象：t17–t19 落地的「在线 + 登录 + 微博读写」链路（`server/` + `src/data/api.ts` + `#/login` / `#/search`）。
> 理由：这是项目里**第一次出现他人的账号凭证**，所以安全项优先于功能项，任一安全项失败即判失败，不因功能跑通而放行。
> 审计人：verifier｜时间：2026-11-16｜环境：macOS + Node 26.10.0 + 手写 CDP（Chrome 无头，`--no-sandbox --user-data-dir=/tmp/...`），**无 docker**（Docker 项只能在 CI runner 上验证，见 §7）。
> 复跑脚本：`/tmp/verifier/t20/{audit2,audit3,audit4}.mjs、shots-online.mjs、shots-login-429.mjs、verify-online-ui.mjs、crypto.test.mjs`、`crypto.test.mjs`（均为一次性审计脚本，不入仓库）。

## 0. 结论

| 项 | 结果 |
| --- | --- |
| A1 凭证不出库 | **通过** |
| A2 日志脱敏 | **通过** |
| A3 会话安全 | **通过**（2 个设计项待修：M1 无服务端过期、L1 bootstrap 例外） |
| A4 CSRF | **通过** |
| A5 限流 | **通过**（含"不触达上游"的上游计数证明） |
| A6 加密实现 | **通过**（10/10 node:test） |
| A7 供应链 | **通过** |
| B 功能验收 | **通过**：offline 无回归（build / typecheck / check-hit / 46 条 AC），online 假 cookie 全链路可用 |
| C CI 扩展 | **已落地且首跑绿**：D1 已由 captain 修掉（`e27174e`），docker job 在 run `43828855776` 上**全绿**（详见 §7.1；日志匿名不可读，结论依据是 step 级结论+时序+产物） |
| 真实 cookie 联调 | **未验证**：我手上没有真实凭证，**不要当成已验证**；清单在 `server/test/real-cookie-checklist.md` |

**整体判定：安全项全通过；Docker 构建项曾因 D1 失败，修复后由 CI 首跑证实转绿（§7.1）；真实账号联调仍未验证。** D1 是本次审计发现的真实缺陷（不是 CI 配置问题），它的价值在"没被脚本吞掉"。

## 1. A1 凭证不出库

命令与输出（全部在 `weibo-lite/` 下执行）：

```bash
# ① 关键字出现位置（按文件计数，排除 node_modules）
for pat in 'SUB=' 'SUBP=' 'XSRF' 'RILL_SECRET'; do
  grep -rIl --exclude-dir=node_modules --exclude-dir=dist -e "$pat" . \
  | while read f; do printf '%-52s %s\n' "$f" "$(grep -c -e "$pat" "$f")"; done
done
```

| 文件 | 命中 | 判定 |
| --- | --- | --- |
| `docs/weibo-api.md` | `SUB=`×3、`SUBP=`×3、`XSRF`×6 | 文档里的**占位符**（`SUB=…; SUBP=…`）与 header 名，无值 → 通过 |
| `docs/weibo-verify-15min.md` | `SUB=`×1、`SUBP=`×1 | 同上（`<CK>` 占位） → 通过 |
| `server/test/real-cookie-checklist.md` | `SUB=`×1、`XSRF`×2 | 联调清单文本，且文件内**明确要求不要提交 cookie** → 通过 |
| `src/auth/LoginPage.tsx` | `SUB=`×1、`SUBP=`×1 | 输入框 `placeholder={'SUB=...; SUBP=...'}` → 通过 |
| `server/providers/weibo.mjs` | `XSRF`×6 | 读取 `cookies['XSRF-TOKEN']` 并作为 header 发出，不落盘 → 通过 |
| `server/routes/session.mjs` | `XSRF`×1 | 白名单常量数组 → 通过 |
| `server/crypto.mjs` / `server/README.md` / `docker-compose.yml` / `server/dev-full.mjs` / `scripts/check-online-writes.mjs` | `RILL_SECRET` | 全是**变量名/说明/生成命令**，没有密钥值 → 通过 |

```bash
# ② 仓库内是否已有真实 cookie / 落盘密钥（git 全量）
git ls-files | xargs grep -l 'RILL_SECRET'                    # → 空
git ls-files | xargs grep -lE 'SUB=[A-Za-z0-9]{20,}'          # → 空
git ls-files | grep -Ei '\.env|secret|credential'             # → 空
grep -rIn -E "RILL_SECRET\s*[:=]\s*['\"]?[A-Za-z0-9+/=]{16,}" . | head   # → 空
ls -a | grep -Ei '\.env'                                      # → 工作区无 .env
```

```bash
# ③ 运行时落库形态（启动服务 → 假 cookie 登录 → 直接读 sqlite 文件字节）
# 结果：sessions.cookies_enc = BLOB(103B)，iv=12B，tag=16B；
#       sqlite 文件原始字节里 FAKEMARK_<random> 与 'SUB=' 均 0 命中。
```

> 唯一需要解释的一处：`dist/assets/index-*.js` 里有 `SUB=` 字样 —— 那是登录页 placeholder 被 vite 打进产物；`dist/` 未入 git（`.gitignore` 有 `dist/`），且内容是占位符，不构成泄漏。**但它提醒一件事**：如果将来把 `dist/` 提交，产物里的示例串也会被 grep 门抓到，属于预期，不是问题。

## 2. A2 日志脱敏

```bash
# 假 cookie 值带唯一标记 FAKEMARK_<random>，登录 → 读时间线 → 写点赞，抓 stdout+stderr
```

| 断言 | 结果 |
| --- | --- |
| 日志含 cookie 值 `FAKEMARK_…` | **0** 次 |
| 日志含被丢弃的非法名字 `DROP_FAKEMARK_…` | **0** 次 |
| 日志含 CSRF token 明文（32 字符） | **0** 次 |
| 实际日志形态 | `[rill] session.cookie {"provider":"mock","cookies":[{"name":"SUB","length":21},{"name":"XSRF-TOKEN","length":22}]}` —— 只有**名字与长度** |

对应实现：`server/index.mjs` 的 `ctx.log()` 只放行 `provider/mode/sid/error` 四个字段与 `cookies→{name,length}`；`server/routes/session.mjs` 发的就是这个形状。

## 3. A3 会话安全

| 断言 | dev（默认） | production（`NODE_ENV=production`） |
| --- | --- | --- |
| `Set-Cookie` | `rill_sid=…; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000` | 同上 **+ `Secure`** |
| HttpOnly | ✔ | ✔ |
| SameSite | ✔ Lax | ✔ Lax |
| 有效期 | 30 天（2592000s） | 30 天 |
| `last_seen` 刷新 | ✔ `…639 → …305`（每次 GET 都 touch） | 同 |
| `DELETE /api/session`（带 CSRF） | 204，`Set-Cookie: rill_sid=; …; Max-Age=0`；**旧 sid 立刻失效**（`authenticated:false`，`sessions` 行删除，`kv:csrf:<sid>` 同时清除） | 同 |
| 会话固定 | 每次登录 `newSid()`（43 字符 base64url），两次登录 sid 不同；旧 sid 仍是独立会话（多会话并存，非固定漏洞） | 同 |

风险项：

| ID | 风险 | 等级 | 证据 | 修复建议 |
| --- | --- | --- | --- | --- |
| **M1** | **会话没有服务端过期**：`getSession()` 不看 `last_seen`/`created_at`，也没有清扫任务；把 `last_seen` 改成 400 天前后再 `GET /api/session` 仍返回 `authenticated:true` | 中（凭证明文虽然加密，但永不过期；DB/`kv` 行无限增长） | `store.getSession` 只 `WHERE sid=?`；`db.mjs` 无 TTL/无 sweep | 读会话时判 `now - last_seen > SESSION_TTL`（如 30 天）→ 视为无会话并删除；启动时清一次过期行 |
| **L1** | `POST /api/session/cookie` 在「无 sid 且 无 Origin」时被放行（bootstrap 例外）；因此"无 Origin 的非 GET 一律 403"**不成立** | 低（浏览器一定带 Origin，跨站会被 `originMatchesHost` 拦下；实测 evil Origin → 403） | `server/index.mjs` `allowMutation()` 末行 | 若要做到绝对，改为要求 `Content-Type: application/json` + 首次登录带一次性 boot-token；或至少在文档里写明这条例外 |

## 4. A4 CSRF

| 场景 | 状态 | 说明 |
| --- | --- | --- |
| 有会话、**无 Origin**、无 token | **403** | `{"error":"csrf_origin_mismatch"}` |
| 异源 `Origin: https://evil.example` | **403** | 同上 |
| `Origin: null` | **403** | 同上 |
| 同源 `Origin: <本服务>` | **200** | 正确放行（mock like → `{liked:true,count:6}`） |
| 无 Origin + 正确 `X-Rill-CSRF` | **200** | 与同源等价 |
| 无 Origin + 错误 token | **403** | 对比 token 用 `timingSafeEqual` |
| `DELETE /api/session` 无 token 无 Origin | **403** | 因此"登出"必须带 CSRF（前端已带） |

## 5. A5 限流（含"不触达上游"证明）

```
登录：201,201,201,201,201,429,429   retry-after: 60
写入：200,200,200,200,200,200,429,429   code=RATE_LIMITED「写操作太频繁，请稍后再试」
```

**不触达上游的上游计数证明**：把 `RILL_WEIBO_BASE` 指向本地假上游并统计命中。

| 阶段 | 上游请求数 | 明细 |
| --- | --- | --- |
| 登录 + 校验 | 1 | `GET /api/config` |
| 6 次写（全部 200） | +12 | 每次 `GET /api/config` + `POST /api/attitudes/like` |
| 第 7、8 次写（429） | **+0** | 上游计数不变 → 被限流的请求**没有打到微博** |

备注（性能、非安全）：每次写都会额外打一次 `/api/config` 做会话校验，写 6 次 = 12 次上游请求。把 identity 缓存进会话（TTL 几分钟）可以减半。

## 6. A6 加密实现（AES-256-GCM）

`node --test /tmp/verifier/t20/crypto.test.mjs` → **10/10 pass**：

1. 往返：加密→解密还原（含中文）
2. `iv` 每次随机（12B）、`tag` 16B；同一明文两次加密，iv/密文/tag 全不同
3. **篡改密文 → 解密失败**（`unable to authenticate`）
4. 篡改 `tag` → 失败
5. 篡改 `iv` → 失败
6. 错误密钥 → 失败
7. `tag` 长度不足 → 直接拒绝（不进解密）
8. 密钥装载：空值/16 字节短密钥报错，**错误信息不回显密钥内容**
9. `sid` 43 字符 / `csrf` 32 字符 base64url，100 次无重复
10. `safeEqual` 等长同值 true，长短/异值 false

> **范围说明**：本次任务只允许写 `docs/` 与 `.github/workflows/ci.yml`，所以这份测试放在 `/tmp`，**没有**进仓库。建议 builder 把它收成 `server/test/crypto.test.mjs`（内容可直接搬），这样 CI 的 `node --test server/test/*.mjs` 会自动带上它。

## 7. A7 供应链 + Docker 项

```bash
node -e "const p=require('./package.json');console.log(p.dependencies)"   # {"react":"^18.3.1","react-dom":"^18.3.1"}
ls server/package.json                                                    # 不存在
grep -rn "from '" server --include='*.mjs' | grep -v "from 'node:" | grep -v "from '\.\{1,2\}/"   # → 空
```

`server/` 的 import 只有 `node:url|path|fs|http|crypto|child_process|sqlite|test|assert/strict|timers/promises` 与相对路径 → **零第三方依赖成立**；前端运行时依赖仍只有 `react`/`react-dom`。

**D1（blocker，Docker 构建）**：本机 `docker` 不存在（`command not found`），所以我没有"本地假装构建过"，而是做了静态核对 + 构建上下文模拟：

```
Dockerfile:26   COPY --from=build /app/server ./server
```

而 build 阶段只 `COPY` 了 `package.json pnpm-lock.yaml pnpm-workspace.yaml tsconfig.json vite.config.ts index.html scripts src`，**没有 `COPY server ./server`**。我把这些路径复制到一个空目录模拟 build 阶段产物：

```
index.html package.json pnpm-lock.yaml pnpm-workspace.yaml scripts src tsconfig.json vite.config.ts
→ ✗ 没有 server/  →  第 26 行必然以 "not found" 失败
```

修复（一行）：build 阶段补 `COPY server ./server`（或运行时阶段直接从构建上下文 `COPY server ./server`，不经过 build 阶段）。
**影响**：新增的 `docker` job 会红，直到这行修好；这是**如实失败**，不是 CI 配置写错。
**已修**：captain 在 `e27174e` 的 build 阶段补了 `COPY server ./server`（第 15 行）；我在该提交上重跑了"逐条 COPY 源存在性"检查（9/9 存在）与"build 阶段目录复现"（`server/` 已在内），确认根因消失。见 §7.1 的 CI 实证。
### 7.1 CI 首跑实证（D1 修复后，run 43828855776）

我在 `e27174e` 的 run 上**独立读 GitHub API 判定**（不是转述 captain 的结论）。可匿名读到的证据与判定：

| 证据 | 值 | 说明 |
| --- | --- | --- |
| run | `43828855776`，head_sha `e27174e…`，event `push`，conclusion **success** | 确实是修复提交触发的那一次 |
| job `build + checks` | success，12 个 step 全 success（08:08:25→08:09:07） | 与改动前 run `43820835316` 的 step 集合对比，多了我新加的 `Server unit tests` 与 `Server smoke` |
| job `docker build + container smoke` | **success**，`docker version` / `docker build` / `Container smoke` / `Upload` / `Cleanup` 全 success | 本 job 是该仓库**第一次**出现在 CI 里（上一版只有 1 个 job） |
| `Container smoke` 用时 | **2s**（08:08:41→08:08:43） | 我的脚本在 `ok != 1` 时 `exit 1`；2 秒内通过 ⇒ `docker run` 成功且容器内 `/api/health` **真的**回了 200（若镜像不存在/容器没起来，会先空转 30 秒再失败） |
| `docker build` 用时 | 13s（08:08:28→08:08:41） | 与同 run 的 `Build`(2s)、`Install`(2s) 量级一致；含 `pull node:26-alpine`(~63MB) + `npm i -g pnpm` + `pnpm install` + `vite build`，13s 在 fast runner 上合理 |
| 产物 | `docker-artifacts` 2670 B（08:08:44 创建，含 `docker-build.log` + `container-health.json`） | 上传 step 真有文件可传 |
| `node:26-alpine` 标签 | Docker Hub 上 **存在**（amd64 `sha256:a90bda29…`，62.9MB，`tag_status: active`） | "标签不存在"这个假设**排除**，且这条是独立于 CI 查的 |

**读不到的（如实说）**：`GET /runs/{id}/logs` → **403 "Must have admin rights"**；artifact `archive_download_url` → **401 "Requires authentication"**（匿名无权限）。所以我**没有**逐层读到 build 输出，无法断言"哪一层走了缓存""镜像体积多少"。我的结论强度是「step 级结论 + 时序一致性 + 产物存在 + 独立查到的标签存在」，不是「我看见构建日志说 OK」。

### 7.2 这次绿**没有**覆盖的三件事（别把绿读大）

1. **镜像自带的 `HEALTHCHECK` 指令**：CI 的 smoke 用宿主机 `curl` 断言 `/api/health`，没有等 30s 后读 `docker inspect` 的 `State.Health.Status` ⇒ 镜像里那条 `HEALTHCHECK` 是否真的转 healthy 未被断言。
2. **`RILL_SECRET` 缺失时的行为**：smoke 显式传了 `-e RILL_SECRET=…`；裸 `docker run rill:ci` 会因无密钥 `exit 1`（属设计，但没被 CI 断言）。
3. **`docker compose up` 路径**：`docker-compose.yml` 在 CI 里完全没跑过（compose 与 Dockerfile 是两条路）。

建议（下一轮 CI 改动，逐条可加）：`docker run -d` 后 `sleep 35` 再 `docker inspect --format '{{.State.Health.Status}}'` 断言 `healthy`；单独加一条"无 `RILL_SECRET` 时容器必须退出非 0 且日志含 `RILL_SECRET`"的反向断言；compose 用 `docker compose config` 做静态校验（不起服务，省时间）。

另注：镜像运行时 `RILL_SECRET` 没有默认值（`server` 无密钥会 `exit 1`），所以 `docker run` 必须传 `-e RILL_SECRET=…`（CI 的容器 smoke 已传）；`docker-compose.yml` 已用 `${RILL_SECRET:?}` 强制。

### 7.3 这个绿**不等于**"仓库里的应用被验过"（独立复核发现）

在核对 D1 修复时我顺手查了"新 clone 能不能 build 出交付的那个应用"，结论是**不能**：

```bash
git ls-tree -r --name-only e27174e | grep -c '^src/'        # 33
find src -type f | wc -l                                    # 44
git status --porcelain --untracked-files=all | grep -c '^??' # 11
git status --porcelain | grep -c '^ M'                       # 17
git cat-file -e e27174e:src/data/api.ts                      # fatal: exists on disk, but not in 'e27174e'
```

未跟踪的 11 个文件正好是**在线链路的前端全部**：

```
src/auth/LoginPage.tsx  src/data/api.ts        src/pages/OnlineTimeline.tsx
src/pages/OnlineDetail.tsx  src/pages/OnlineProfile.tsx  src/pages/Search.tsx
src/components/AccountChip.tsx  src/components/VerifiedMark.tsx  src/components/WriteSheet.tsx
src/styles/auth.css  src/styles/daily.css
```

（`.gitignore` 的 `data/` → `/data/` 已修好，`git check-ignore` 对这 11 个文件现在全部为空、`git add -n` 预演可加入 ⇒ **规则不再是障碍，只是没人 `git add`**。）

**后果（很重要）**：

1. `clone` 出来的仓库 = **纯离线版**（提交版 `src/App.tsx` 里没有 login/auth/api 引用，实测 `git show e27174e:src/App.tsx | grep -n "api\|Auth\|Login"` 为空）→ `#/login`、`#/search`、在线时间线、发博在线态在新 clone 里**都不存在**。
2. 因此 CI 的绿（含 docker job）证明的是「**离线前端 + server + 镜像装配**」这条链，**不能**用来给在线链路背书；run `43828855776` 的 checkout 里根本没有那 11 个文件。
3. `server/` 已入库（15 个文件），`src/data/mock.json` 也已在 ⇒ 服务能起、`/api/health` 能 200（这也解释了 docker smoke 为什么能绿：镜像跑的是 mock 模式的 server，不依赖前端）。

**建议的处置**（顺序执行，缺一不可）：

```bash
git add -A src/          # 或逐个 add 上面 11 个 + 17 个改动
git commit -m "feat(online): 把在线链路的前端与 api 客户端入库"
```

并在 CI 里加一条「交付物存在性」护栏，防止"绿得虚"再次发生。**护栏已做变异反证（证明它不是恒真）**，实测矩阵（一次性 clone，不碰工作树）：

| 场景 | 护栏结果 | 期望 |
| --- | --- | --- |
| A 纯净 clone（提交树、无 `dist`） | FAIL | FAIL ✓ |
| B 有 `dist`（含 `login-input`），但 `src/data/api.ts` 未提交 | FAIL | FAIL ✓ —— 证明产物在位**不能**掩盖源码缺失 |
| C 在线前端已提交 + `dist` 在位 | PASS | PASS ✓ |
| D 变异：删掉 `src/data/api.ts` | FAIL | FAIL ✓ |
| E 恢复 | PASS | PASS ✓ |
| F 变异：`git rm --cached`（文件仍在磁盘） | **PASS** | —— **这是护栏的真实缺口** |

F 说明 captain 采纳的写法 `test -f …` 只查磁盘，抓不到"不在索引里"的情况（CI 的干净 checkout 里不会发生，但在本地/脏树上会）。**建议护栏加一行索引态断言**，两边都成立：

```yaml
- name: Guard - 在线路由必须真的在仓库里（必须在 Build 之后，因为要 grep dist）
  run: |
    git ls-files --error-unmatch src/auth/LoginPage.tsx src/data/api.ts   # 索引态：比 test -f 更强
    grep -q 'login-input' dist/assets/*.js
```

谓词有效性已核：当前 `dist/assets/*.js` 里 `login-input` / `login-privacy-note` / `search-offline` 各命中 1 次（构建产物保留 testid 字面量）。




## 8. 我额外查的四项（captain 指定"别只复核我验过的"）

| 项 | 结果 |
| --- | --- |
| 静态服务路径穿越 | 7 种变体（`/../../../../etc/passwd`、`/%2e%2e/%2e%2e/etc/passwd`、`/..%2f..%2f..%2fetc%2fpasswd`、`//etc/passwd`、`/assets/..%2f..%2fpackage.json`、`/../package.json`）全部 **200 + 1305B**，内容是 `dist/index.html`（SPA 回退），**无 `/etc/passwd`、无 package.json 泄漏**；`resolveInside()` 的前缀校验生效 |
| 畸形 URL 编码 | `GET /%zz` → **500**（`decodeURIComponent` 抛 URIError 被兜底成 500）；服务未崩（随后 `/api/health` 仍 200）→ **L2（低）**，建议在 `serveStatic` 里 try/catch 解编码并返回 400 |
| `kv` 里 CSRF token 生命周期 | 写入：登录/GET 时 `setKv('csrf:<sid>')`；读取：`GET /api/session` 回 `x-rill-csrf` 头；**删除**：`DELETE /api/session` 时随会话一起删（实测 `rowGone=true`、`kvGone=true`）；**过期**：不清（并入 M1） |
| 未登录 / 伪造会话（weibo 模式） | `feed / like / comment / publish / search` 全部 **401 AUTH_REQUIRED**；伪 `rill_sid=AAAA…` → 401。**但 mock 模式**下未登录写返回 200（离线无账号概念，属设计），需在文档里写明，避免被误读成漏洞（**L4**） |
| 客户端 IP 取法 | `clientIp()` 只读 `socket.remoteAddress`，**不信任 `X-Forwarded-For`** → 无法用头绕过限流；代价是反向代理后所有用户共享同一 IP，登录/写限流会互相误伤（**L3，部署注意**：反代要按真实来源改写或改代码取信任头） |

## 9. B 功能验收（offline 不回归 + online 假 cookie）

### 9.1 offline

| 项 | 命令 | 结果 |
| --- | --- | --- |
| 构建 | `pnpm build`（= `check:mock` + `tsc --noEmit` + `vite build`） | ✅ 68 modules；`dist/assets/index-B1_Ifusu.css` 31.03 kB、`index-DeOvflmW.js` 232.45 kB；mock 元数据 `verified:2, sources:12, longPost:243` |
| 坐标点击自证 | `node scripts/check-hit.mjs` | ✅ **ALL PASS**（39 条断言；含 375/768/1440 三档、tabbar 4 项、sheet 关闭态、compose 发布） |
| 49 条 AC 重跑 | `node /tmp/verifier/ac.mjs`（自建 preview :4179） | ✅ **46 条 AC / 218 断言全通过**，`failedIds=[]`，`externalRequests=[]` |

> AC 计数口径说明：本轮 suite 输出 46 行（t8 记的是 49 行）；差异来自 suite 版本（`shotsBad` 等 3 项在 t15 之后合并进截图断言），不是产品失败。**0 条失败**是事实。

**新增路由的离线行为**（不在原 46 条 AC 内，我补验）：

| 路由 | 离线表现 |
| --- | --- |
| `#/login` | 正常渲染登录页（`data-online=false`，右上角「本机」），文案含「Cookie 只保存在本实例的加密会话里（HttpOnly），不写入 localStorage，不落日志」 |
| `#/search` | 渲染 `search-offline` 空态：「搜索只在线可用 / 离线模式继续用随包 mock 时间线；登录微博后这里会读真实搜索」+「去登录」按钮 |

### 9.2 online（假 cookie + 本地假上游，绝不触真实微博）

| 场景 | 断言 | 结果 |
| --- | --- | --- |
| 登录提交 | `POST /api/session/cookie` → 201 → `GET /api/session` `authenticated:true` | ✅ |
| 登录失败态（限流） | 预打空 IP 桶后第 6 次提交 → 页面停在 `#/login`，`login-error`=「尝试太频繁，请等一分钟再试。」，输入内容保留、按钮恢复可点 | ✅ 截图 `docs/shots/online-login-error-375.png` |
| `AUTH_EXPIRED` 分支 | 上游 401 → 时间线 `auth-error`：「需要重新登录 / Cookie 可能已过期或被吊销；重新粘贴后继续。」+「去登录」 | ✅ |
| `RISK_CONTROL` 分支 | 上游 403 → `error-state`：「触发了风控 / 微博要求人工验证；稍后再试，或换网络。」+「重试」 | ✅ |
| 在线时间线（假数据） | `data-online="true"`、`data-post-count="2"`、首条正文来自假上游 | ✅ 截图 `docs/shots/online-timeline-375.png` |
| 发博失败态 | 上游 500 → `publish-error`=「服务暂时不可用，请稍后再试（不会自动重发）」，正文保留、路由仍在 `#/compose` | ✅ 截图 `docs/shots/online-compose-error-375.png` |
| 登录页（含隐私文案） | `login-privacy-note` 文本以「Cookie 只保存在本实例的加密会话里（HttpOnly）」开头 | ✅ 截图 `docs/shots/online-login-375.png` |

**M2（中，UX）**：上游 `/api/config` 返回 `login:false`（凭证无效）时，登录页**不会报错**，而是显示成功态「Cookie 已保存，微博校验待确认」。文案本身是诚实的（"待确认"），但用户容易误以为登录成功；建议在 `GET /api/session` 返回 `authenticated:false` 时把登录页切成「已保存但校验未通过」的显式失败态。

### 9.3 未验证（不能写成已验证）

- **真实 cookie 全链路**：我手上没有真实凭证，like → unlike → comment → repost → text publish → image publish 一次都没在真站跑过。清单在 `server/test/real-cookie-checklist.md`，**需用户首次登录后按清单联调**。
- **Docker 镜像**：本机无 docker，只能由 CI runner 证明 —— D1 修复后首跑已绿（§7.1）；但镜像**自带的 HEALTHCHECK 指令**、`RILL_SECRET` 缺失时的启动行为（除 compose 外）、`docker compose up` 仍未在 CI 中被断言（见 §7.2 缺口）。

## 10. 风险清单汇总

| ID | 项 | 等级 | 状态 | 归属 |
| --- | --- | --- | --- | --- |
| D1 | Dockerfile build 阶段缺 `COPY server` → `docker build` 必失败 | **blocker**（交付物） | **已修**（`e27174e`）并经 CI 首跑证实 | t17 交付物 |
| M1 | 会话无服务端过期 + 过期行/`kv` 行不清理 | 中 | 待修 | server |
| M2 | 上游校验失败时登录页不报错（显示"待确认"成功态） | 中 | 待修（UX） | src/auth |
| L1 | bootstrap「无 sid + 无 Origin」放行 | 低（设计性） | 文档化 | server/routes |
| L2 | 畸形 URL 编码 → 500（应 400） | 低 | 待修 | server/http |
| L3 | 反代后限流按同一 IP 计 | 低（部署） | 文档化 | 部署 |
| L4 | mock 模式未登录可写（离线语义） | 低（设计性） | 文档化 | server/routes |
| L5 | 每次写多打一次 `/api/config` | 低（性能） | 可选优化 | server/providers |
| **F1** | 在线模式**丢弃上游 `source`**：`_postFromMblog` 返回对象里没有 `source` 键 ⇒ 真实数据下尾巴永远回落「来自 溪流」，mock 里做的 12 种来源在线全看不到 | 中（功能缺失；mock↔online 不对称） | 待修（建议并入 t26） | `server/providers/weibo.mjs` `_postFromMblog` |
| **F2** | 在线模式**丢弃 `verified`**：`authorFromUser` 返回对象里没有 `verified` 键 ⇒ 在线永不显示 V 认证徽章（`src/types.ts:25` 已声明该字段并注明"在线适配层可能缺省"） | 中（功能缺失） | 待修（建议并入 t26） | `server/providers/weibo.mjs` `authorFromUser` |

## 11. 复跑命令

```bash
cd weibo-lite

# A1 / A7（纯 grep）
for pat in 'SUB=' 'SUBP=' 'XSRF' 'RILL_SECRET'; do grep -rIl --exclude-dir=node_modules --exclude-dir=dist -e "$pat" .; done
git ls-files | xargs grep -lE 'SUB=[A-Za-z0-9]{20,}'   # 期望空

# A2–A5（起服务 → 断言；脚本自管进程/端口，跑完自动杀）
node /tmp/verifier/t20/audit2.mjs   # 会话/cookie 属性/CSRF/DELETE/日志/限流/上游计数
node /tmp/verifier/t20/audit3.mjs   # CSRF 正例 200、错误 token 403、会话固定
node /tmp/verifier/t20/audit4.mjs   # weibo 模式未登录全部 401

# A6
node --test /tmp/verifier/t20/crypto.test.mjs   # 10/10

# B
pnpm build && node scripts/check-hit.mjs
./node_modules/.bin/vite preview --port 4179 --strictPort &
node /tmp/verifier/ac.mjs
node /tmp/verifier/t20/shots-online.mjs        # 3 张在线截图
node /tmp/verifier/t20/shots-login-429.mjs     # 登录失败态截图
node /tmp/verifier/t20/verify-online-ui.mjs    # AUTH_EXPIRED / RISK_CONTROL 文案
```