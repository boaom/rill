# 微博联调清单（15 分钟，给用户本人）

> 目的：你**第一次登录后**，用约 20 条 curl 把"在线模式"的每个环节亲手指一遍。跑完这份清单，你就知道自己的 Cookie 能用哪些能力、哪些不能。
> 前置：已在你自己的实例里打开 `#/login` 并把 Cookie 粘进去（粘进**你自己的实例**，不要发给任何人、不要贴进任何聊天窗口或截图）。
> 时间预算：A 组 2 分钟 · B 组 5 分钟 · C 组 8 分钟。**C 组共 7 次请求（6 次写 + 1 次传图），跑完就停，别反复试**（见 C 组规则）。

---

## 0. 准备（1 分钟）

**① 拿 Cookie**（在你**已登录**微博的浏览器里）：
开发者工具 → Network → 随便点一个 `m.weibo.cn` 的请求 → Request Headers → 整条 `Cookie` 复制出来。它应该长这样（值被省略）：

```
SUB=…; SUBP=…; _T_WM=…; WEIBOCN_FROM=1110003030; MLOGIN=1
```

**② 在你的终端里设两个变量**（**不要**写进任何文件、不要 echo 出来）：

```bash
export CK='把你的 Cookie 整条粘在这里'
UA='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1'
```
> 下文的 `curl` 都假设这两个变量已设好。
> 用 `python3 -m json.tool` 只是为了好看，没有它也能跑。

**③ 记住三个判读口径**（后面每一步都靠它）

| 你看到 | 含义 |
| --- | --- |
| **302**（`location: passport.weibo.com/sso/signin?…`） | **登录态问题**：Cookie 没带全 / 已失效 → 回 `#/login` 重粘 |
| **432**（空 body） | **反爬，不是登录问题**：别重登，等 10 分钟、换网络再试 |
| **HTTP 200 + `"ok":1`** | 成功 |
| **HTTP 200 + `"ok":0`** | 请求到了，但业务/风控没通过 → **记录 `errno` 和 `msg`**（这两个值不含 Cookie，可以放心记录） |
| **`python3` 报 `JSONDecodeError`** | **上一条 curl 没拿到 JSON**（空 body 或返回了 HTML）→ 回去看那一步打印的状态码，按 302/432 处理 |

---

## A 组 · 验身份（2 分钟）

### A1 登录态还在吗？（20 秒）

```bash
curl -sS 'https://m.weibo.cn/api/config' -A "$UA" -H "Cookie: $CK" | python3 -m json.tool | head -8
```

**预期**：HTTP 200；`"login": true`；`"st": "…"` 非空；`"user_token"` 非空字符串。

- 看到 `"login": false` → Cookie 不完整（最常见是**只粘了 SUB、漏了 SUBP**）或已失效 → 回 `#/login` 重新复制整条。
- 看到 302 → 同上。
- 看到 432 → **不是登录问题**，是反爬。停 10 分钟再跑这一步。
- 看到 `"user_token": ""` 而 `login: true` → 页面缓存状态，重复一次；仍为空就先做 A3。

### A2 我的 uid 是多少？（30 秒）

`/api/config` **不返回 uid**（这是已知的空白），按顺序试，**任一条给出数字 uid 就停**：

```bash
# ① 最稳：浏览器打开自己的主页，地址栏 https://m.weibo.cn/u/1234567890 里的数字就是 uid
# ② API 候选
curl -sS 'https://m.weibo.cn/api/profile/me' -A "$UA" -H "Cookie: $CK" -H 'MWeibo-Pwa: 1' | head -c 400; echo
curl -sS 'https://m.weibo.cn/api/container/getIndex?type=uid&value=0' -A "$UA" -H "Cookie: $CK" | head -c 200; echo
# ③ 在自己浏览器里看 Cookie 里的 M_WEIBOCN_PARAMS（URL 解码后常带 uid）
```

**预期**：出现一个 8–10 位纯数字，且与你自己主页地址里的一致。把它记下来：

```bash
export UID_MINE='1234567890'
```

- 三条都拿不到 → **用 ①**（浏览器地址栏）即可，不需要 API。这不是故障。
- ② 返回 404/空/HTML → 该候选不存在，不代表登录有问题。

### A3 区分「登录失效」和「被反爬」（30 秒）

```bash
curl -sS -o /dev/null -w 'first=%{http_code}\n' \
  'https://m.weibo.cn/api/container/getIndex?containerid=102803' -A "$UA" -H "Cookie: $CK"
curl -sS -o /dev/null -w 'page2=%{http_code}\n' \
  'https://m.weibo.cn/api/container/getIndex?containerid=102803&page=2' -A "$UA" -H "Cookie: $CK" \
  -H 'Referer: https://m.weibo.cn/' -H 'MWeibo-Pwa: 1' -H 'X-Requested-With: XMLHttpRequest'
```

**预期**：`first=200`，`page2=200`。

- `first=302` → 登录态（回 A1）。
- `first=200` 但 `page2=432` → **反爬**（`page≥2` 更容易触发）。解决：等 10 分钟、把间隔放到 ≥1.5 秒、别并发放；**不要重登**。
- 两个都是 432 → 本机 IP 被临时盯上，等 10 分钟或换网络。

---

## B 组 · 验读（5 分钟）

### B1 关注流能不能拉？（40 秒）

```bash
curl -sS 'https://m.weibo.cn/api/container/getIndex?containerid=231093_-_selffollowed&page=1' \
  -A "$UA" -H "Cookie: $CK" -H 'MWeibo-Pwa: 1' -o /tmp/b1.json -w '%{http_code}\n'
python3 -c "import json;d=json.load(open('/tmp/b1.json'));print('ok=',d.get('ok'));c=d.get('data',{}).get('cards',[]);print('cards=',len(c));print('total=',d.get('data',{}).get('cardlistInfo',{}).get('total'))"
```

**预期**：`200`，`ok= 1`，`cards= 10`（或 8–20 之间），`total` 是一个数字。

- `cards= 0` 且 `ok= 1` → **containerid 猜错了**（不是登录问题）。去修：浏览器打开 m.weibo.cn 首页 → Network → 找那条 `getIndex` → 抄它 URL 里的 `containerid`，用它替换本例里的值重跑。
- 302 → 登录态。432 → 反爬（停 10 分钟）。
- `ok= 0` → 记录 `errno`/`msg`。

### B2 推荐流能不能拉？（30 秒）

```bash
curl -sS 'https://m.weibo.cn/api/container/getIndex?containerid=102803&page=1' \
  -A "$UA" -H "Cookie: $CK" -H 'MWeibo-Pwa: 1' -o /tmp/b2.json -w '%{http_code}\n'
python3 -c "import json;d=json.load(open('/tmp/b2.json'));c=d.get('data',{}).get('cards',[]);print('ok=',d.get('ok'),'cards=',len(c));m=[x['mblog'] for x in c if x.get('mblog')];print('首条 idstr=',m[0].get('idstr') if m else None);open('/tmp/one_id','w').write(str(m[0].get('idstr')) if m else '')"
```
**预期**：`ok= 1`，`cards> 0`，并打印出一个 `idstr`（B3 要用）。

- 432 → 反爬；换 `102803` 的其它入口或等 10 分钟。
- `card_type` 若不是 9 → 该卡的正文在别的字段里；记录卡号，属于"接口形状变了"（R6）。

### B3 单条详情字段对不对？（45 秒）

```bash
ID=$(cat /tmp/one_id)
curl -sS "https://m.weibo.cn/statuses/show?id=$ID" -A "$UA" -H "Cookie: $CK" -H 'MWeibo-Pwa: 1' -o /tmp/b3.json -w '%{http_code}\n'
python3 - <<'PY'
import json
d=json.load(open('/tmp/b3.json'))['data']
for k in ('id','idstr','mid','bid','created_at','text','isLongText','attitudes_count','comments_count','reposts_count'):
    v=d.get(k); v=(v[:40]+'…') if isinstance(v,str) and len(v)>40 else v
    print(f'{k:16}', v)
print('user.screen_name', (d.get('user') or {}).get('screen_name'))
print('pics', len(d.get('pics') or []), '| retweeted_status', bool(d.get('retweeted_status')))
PY
```

**预期**：`id`、`mid`、`bid`、`created_at`、`text` 非空；`created_at` 形如 `Fri Jun 14 20:39:20 +0800 2019`（**+0800，别当 UTC**）；`user.screen_name` 是中文昵称；有图时 `pics` > 0；转发那条 `retweeted_status` 为 `True`。
**注意**：`idstr` **可能打印出 `None`** —— 公开抓包里 `statuses/show` 的返回就常缺 `idstr`（卡片流里有）。`idstr` 为空时用 `id`（两者数值相同，只是类型不同），不算故障。

- `data` 为空 / `null` → id 用错（本清单用 `idstr`）或该条已删；换 B1 的另一条 id 重试。
- 404/空 body → 端点名可能不同，改试 `https://m.weibo.cn/api/statuses/show?id=$ID`，把结果记下来（这是我们唯一没核实路径的一条）。

### B4 长文要不要走 extend？（30 秒，仅当 `isLongText: true`）

```bash
curl -sS "https://m.weibo.cn/statuses/extend?id=$ID" -A "$UA" -H "Cookie: $CK" | python3 -c "import sys,json;d=json.load(sys.stdin)['data'];print('ok=',d.get('ok'));print('longTextContent 前 80 字:',(d.get('longTextContent') or '')[:80])"
```
**预期**：`ok= 1`，`longTextContent` 比 B3 的 `text` 长。

- `longTextContent` 为空 → 该条不是长文，跳过即可。
- 432/302 → 同前面口径。

### B5 评论首屏 + 楼中楼（45 秒）

```bash
MID=$(python3 -c "import json;print(json.load(open('/tmp/b3.json'))['data'].get('mid'))")
curl -sS "https://m.weibo.cn/comments/hotflow?id=$ID&mid=$MID&max_id_type=0" \
  -A "$UA" -H "Cookie: $CK" -H 'MWeibo-Pwa: 1' -o /tmp/b5.json -w '%{http_code}\n'
python3 - <<'PY'
import json
j=json.load(open('/tmp/b5.json')); d=j.get('data') or {}
print('ok=', j.get('ok'), '| 条数=', len(d.get('data') or []), '| total_number=', d.get('total_number'))
c0=(d.get('data') or [{}])[0]
print('首条:', c0.get('id'), '| rootid=', c0.get('rootid'), '| floor=', c0.get('floor_number'), '| 作者=', (c0.get('user') or {}).get('screen_name'))
sub=c0.get('comments'); print('楼中楼:', 'false(无子楼)' if sub in (False,None) else f'{len(sub)} 条, 子楼 rootid={[x.get("rootid") for x in sub][:2]}')
PY
```

**预期**：`ok= 1`，条数 15–20，`total_number` 是数字；首条 `rootid == id`；有子楼时 `comments` 是数组且**子楼 `rootid` 等于主楼 id**。

- `comments` 全是 `false` → 这条没有楼中楼，换一条热门微博试（不是故障）。
- 楼中楼子项的 `rootid` 不等于主楼 id → **新增了一层结构**，请记录（我们的数据模型只支持一层）。
- `ok= 0`/空 → 换 `https://m.weibo.cn/api/comments/show?id=$ID&page=1`（时间序）试试。

### B6 评论翻页（30 秒）

```bash
NEXT=$(python3 -c "import json;d=json.load(open('/tmp/b5.json'))['data'];print(d.get('max_id'), d.get('max_id_type'))")
set -- $NEXT; MAXID=$1; MAXTYPE=$2
curl -sS "https://m.weibo.cn/comments/hotflow?id=$ID&mid=$MID&max_id=$MAXID&max_id_type=$MAXTYPE" \
  -A "$UA" -H "Cookie: $CK" -H 'MWeibo-Pwa: 1' -o /tmp/b6.json -w '%{http_code}\n'
python3 -c "import json;a={c['id'] for c in json.load(open('/tmp/b5.json'))['data']['data']};b={c['id'] for c in json.load(open('/tmp/b6.json'))['data']['data']};print('第二页条数=',len(b),'| 与第一页重复=',len(a&b))"
```

**预期**：第二页有数据、**与第一页重复 = 0**；`max_id` 为 0 表示已到底（此时第二页可能是空，属正常）。

- 重复很多 → 分页参数没生效（把 `max_id`/`max_id_type` 都带上，别只带一个）。
- 302/432 → 同前面口径。

### B7 用户资料 + 他的博文（45 秒）

```bash
curl -sS "https://m.weibo.cn/api/container/getIndex?type=uid&value=$UID_MINE" -A "$UA" -H "Cookie: $CK" -o /tmp/b7.json -w '%{http_code}\n'
python3 -c "import json;u=json.load(open('/tmp/b7.json'))['data']['userInfo'];print({k:u.get(k) for k in ('id','screen_name','followers_count','follow_count','statuses_count','verified')})"
curl -sS "https://m.weibo.cn/api/container/getIndex?containerid=107603$UID_MINE&page=1" -A "$UA" -H "Cookie: $CK" -o /tmp/b7b.json -w '%{http_code}\n'
python3 -c "import json;d=json.load(open('/tmp/b7b.json'))['data'];m=[x['mblog'] for x in d.get('cards',[]) if x.get('mblog')];print('我的博文 cards=',len(m),'| 首条=',(m[0].get('idstr') if m else None))"
```

**预期**：`userInfo.id == $UID_MINE`；`screen_name` 是你的昵称；`followers_count` 数字；`107603+uid` 能列出你自己的博文。

- `userInfo` 为空 → uid 抄错（A2 ①）。
- 博文 0 条 → 你可能确实没发过，或该账号被限制；看 `ok` 值区分。

---

## C 组 · 验写（8 分钟，6 次写 + 1 次传图）

> **顺序建议**：C1/C2（点赞/取消赞）的端点名是全清单唯一没核实过的。如果你想让"请求头 + `st` 是否写对"这件事**先有确定答案**，可以先跳到最后跑 **C5（纯文本发博）**——它是最有公开实现依据的写接口；C5 成功即证明 HH/`st` 全对，之后 C1–C4 的失败就只可能是端点名/风控，判读不再歧义。
> **规则**：每步之间至少间隔 **3 秒**；这一整组只有 **6 次写 + 1 次传图**，跑完就停，别反复试。写操作都带同一个 `st`，先取它：

```bash
export ST=$(curl -sS 'https://m.weibo.cn/api/config' -A "$UA" -H "Cookie: $CK" | python3 -c "import sys,json;print(json.load(sys.stdin)['data']['st'])")
HH=(-H "Cookie: $CK" -H "X-XSRF-TOKEN: $ST" -H 'X-Requested-With: XMLHttpRequest' -H 'MWeibo-Pwa: 1' -H 'Origin: https://m.weibo.cn')
echo "st 长度=${#ST}"   # 只打印长度，不打印值
```

### C1 点赞（本清单里**唯一"端点名未核实"**的一步）

```bash
curl -sS 'https://m.weibo.cn/api/attitudes/like' -X POST "${HH[@]}" \
  -H 'Referer: https://m.weibo.cn/' --data "id=$ID&st=$ST" | head -c 300; echo
```
**预期**：`"ok":1`（或 `ok:1` + 新的点赞数），微博页面上的赞亮起。

- **404 / 空 body / HTML**：**端点名猜错了**——这是已知未验证项。修法：在浏览器里对一条微博点一次赞，Network 里看真实请求的 URL 和方法，抄下来替换上面的路径，再跑一次。
- `"ok":0` → 记 `errno`；若提示需要验证 → 停，本轮不要继续测试点赞。

### C2 取消赞（点赞成功后隔 3 秒跑）

```bash
sleep 3
curl -sS 'https://m.weibo.cn/api/attitudes/unlike' -X POST "${HH[@]}" \
  -H 'Referer: https://m.weibo.cn/' --data "id=$ID&st=$ST" | head -c 300; echo
```
**预期**：`"ok":1`，赞灭掉、计数回落 1。
- 与 C1 同一个错误 → 两条端点名都要更正（同法从浏览器抄）。
- `ok:0` + "未点赞" → 说明 C1 其实没成功。

### C3 发一条评论

```bash
sleep 3
curl -sS 'https://m.weibo.cn/api/comments/create' -X POST "${HH[@]}" \
  -H 'Referer: https://m.weibo.cn/' \
  --data "id=$ID&mid=$MID&content=$(python3 -c "import urllib.parse;print(urllib.parse.quote('联调测试 请忽略'))")&st=$ST" | head -c 400; echo
```
**预期**：`"ok":1`，返回里带新评论 `id`；B5 再拉一次能在列表里看到它。
- `ok:0` + "需验证" → 停写操作 10 分钟（R5）。
- 若报缺 `cid`/`uid` 类参数 → 记下缺哪个字段名（这是契约需要更新的地方）。

### C4 转发一条（**不可撤销**，记得删）

```bash
sleep 3
curl -sS 'https://m.weibo.cn/api/statuses/repost' -X POST "${HH[@]}" \
  -H 'Referer: https://m.weibo.cn/compose/' --data "id=$ID&mid=$MID&content=$(python3 -c "import urllib.parse;print(urllib.parse.quote('转发测试'))")&st=$ST" | head -c 400; echo
```
**预期**：`"ok":1`，返回新微博（`id`/`idstr`）；主页可见。
- 注意：**转发不可撤销**（微博没有取消转发接口），跑完请手动删除。

### C5 发一条纯文本微博

```bash
curl -sS 'https://m.weibo.cn/api/statuses/update' -X POST "${HH[@]}" \
  -H 'Referer: https://m.weibo.cn/compose/' -H 'Content-Type: application/x-www-form-urlencoded' \
  --data "content=$(python3 -c "import urllib.parse;print(urllib.parse.quote('联调测试 请忽略'))")&st=$ST" | head -c 500; echo
```
**预期**：`"ok":1`，并在你的微博主页看到这条。
- `"ok":0` → 记 `errno`/`msg`（常见："频繁"=R4、"安全/验证"=R5）。**不要连续重发**。
- 302 / HTML 登录页 → 登录态掉了（回 A1）。
- 发布成功但只有你能看到 → 该账号可能被限流（R8）。

### C6 发博带图（两步：先传图拿 `pic_id`，再发博带 `picId`）

```bash
# 第 1 步：上传（把 /tmp/t.jpg 换成你自己的小图，<5MB）
curl -sS 'https://m.weibo.cn/api/statuses/uploadPic' -X POST "${HH[@]}" \
  -H 'Referer: https://m.weibo.cn/compose/' \
  -F 'type=json' -F "st=$ST" -F 'pic=@/tmp/t.jpg;type=image/jpeg' -o /tmp/c6.json -w '%{http_code}\n'
python3 -c "import json;d=json.load(open('/tmp/c6.json'));print('pic_id=',d.get('pic_id'))"
```
**预期**：`pic_id` 是非空字符串（形如 `006…`）。
- 无 `pic_id` 字段 → 记下返回体的键名（契约里的字段名需要更新）。
- 图片 >5MB → 先压缩（客户端会压；手工测时换小图）。

```bash
# 第 2 步：带图发博（PIC=$(上一步的 pic_id)）
export PIC='上一步打印出来的 pic_id'
sleep 3
curl -sS 'https://m.weibo.cn/api/statuses/update' -X POST "${HH[@]}" \
  -H 'Referer: https://m.weibo.cn/compose/' -H 'Content-Type: application/x-www-form-urlencoded' \
  --data "content=$(python3 -c "import urllib.parse;print(urllib.parse.quote('带图联调测试'))")&picId=$PIC&st=$ST" | head -c 400; echo
```
**预期**：`"ok":1`，主页看到带 1 张图的微博。
- 报"图片不存在/参数错" → `picId` 字段名或逗号分隔格式与契约不同，记录实际可用的写法。

---

## 收尾：把结果填在这里（30 秒）

只记 ✅/❌ 与 **`errno`/`msg`**（这两个值不含 Cookie，可以直接记下来）。**不要**截图或复制 Cookie 头。

| 步骤 | 能力 | 结果 | 若失败：`errno`/`msg` |
| --- | --- | --- | --- |
| A1 | 登录态 `login:true` | | |
| A2 | 拿到 uid | | |
| A3 | 302/432 分离 | | |
| B1 | 关注流 | | |
| B2 | 推荐流 | | |
| B3 | 详情字段 | | |
| B4 | 长文 extend | | |
| B5 | 评论 + 楼中楼 | | |
| B6 | 评论翻页 | | |
| B7 | 用户 + 他的博文 | | |
| C1 | 点赞（端点未核实） | | |
| C2 | 取消赞 | | |
| C3 | 评论 | | |
| C4 | 转发 | | |
| C5 | 发博纯文本 | | |
| C6 | 发博带图 | | |

## 结论：按结果决定「在线模式」开放到哪一步

| 你的结果 | 结论 |
| --- | --- |
| A 组全过 | 登录可用。可以开在线模式。 |
| A 过、B 全过 | **只读可用**：时间线/详情/评论/用户/搜索都能上。写操作保持关闭或只做灰度。 |
| A 过、B 过、C1–C5 过 | **读写可用**；C6 未过则只关"带图发博"这一个入口。 |
| C1/C2 失败（端点名不对） | 点赞按"暂不可用"处理，或切到官方 OAuth 轨（`2/attitudes/create` 已验证存在）；**不要**让 UI 显示"点赞成功"。 |
| C3/C4 失败（`ok:0`+验证） | 触发写风控：本轮停止写操作 10 分钟，之后把频率降到"每小时 ≤6 次"。 |
| B2/B3 空或 `ok:0` | 接口形状变了：把返回体（去掉 Cookie）留一份，属于需要更新契约的信号。 |

---

**说明**：本清单不要求你把 Cookie 交给任何人，也不在任何地方保存它——`$CK` 只活在你这个终端会话里，关掉就没了。文档里所有"未核实"的步骤（C1/C2 的端点名、B3 的端点路径、A2 的 uid 来源）都按"猜错也不影响其它步骤"的方式排列，你只要照上面那张结果表记 ❌ 就行。