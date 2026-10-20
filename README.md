# XCPC 每日一题

每天一道算法竞赛题，记录「来源 · 题目 · 链接」（可选难度和算法标签）；
登录后还能记录自己的提交，用 GitHub 风格的绿色热力图看坚持。

- 在线：https://usedchang.github.io/xcpc-daily/
- 技术栈：Vue 3 + Vite，GitHub Actions 自动部署到 Pages
- 每日打卡 + 排行榜：合并为一个独立子页面 `#/checkin`；GitHub OAuth Device Flow（无需 client_secret）+ 私有 Gist 同步
- 打卡排行榜：公开统计快照 + 静态 registry / GitHub Issue 自助登记，不需要后端
- 随机一题独立子页面 `#/random`：Codeforces 题库随机抽题，可绑定 CF 账号自动排除已 AC 的题
- 交流 QQ 群：1036787694

## 本地开发

```powershell
npm install     # 首次
npm run dev     # http://localhost:5173，改代码/任意月份 json 自动热更新

# 想在本地点通「使用 GitHub 登录」时，另开一个终端：
npm run auth:proxy
```

> 不配置 OAuth 也能开发：每日打卡页会进入「本机体验模式」，记录只写 localStorage。
> 完整配置步骤见下文「GitHub 登录与每日打卡」。

Windows 上可以直接双击仓库根目录的 **`xcpc.bat`**（不带参数弹菜单），或者：

```powershell
xcpc.bat dev            # 启动开发服务器
xcpc.bat check          # 全量检查：数据校验 + 生产构建 + 打卡/排行榜/CF 绑定逻辑 + 离线随机性测试
xcpc.bat check live     # 全量检查 + 真实 Codeforces 题库验收（需联网）
xcpc.bat help
```

非 Windows 环境用等价的 npm 脚本：

```powershell
npm run check           # 等价于 xcpc.bat check
npm run check:live      # 等价于 xcpc.bat check live
```

全量检查会按顺序跑：`npm run build`（顺带校验 `data/` 里的每个字段）、
57 项打卡/排行榜/CF 绑定/代理逻辑测试、42 项随机性测试、以及 `dist/` 关键产物的存在性；任何一项失败就以退出码 1 结束，
方便接在别的脚本或 CI 后面。

> **`xcpc.bat` 为什么这么短、而且全是英文注释**：`cmd.exe` 是按**控制台代码页**
> 解析 `.bat` 的，含多字节 UTF-8 中文的批处理会被从字符中间截断 —— 实测会把注释
> 碎片当命令执行，甚至原地死循环。所以 `.bat` 只做 ASCII 的环境准备（设置
> `chcp 65001`、把 TEMP/TMP 指到 `.tmp\`），所有中文提示都放在
> `scripts/tool.mjs` 里由 Node 输出。另外 `.bat` 必须保持 CRLF 行尾
> （`.gitattributes` 已经钉死），LF 行尾会让 cmd 把多行当成一行。

## 目录结构

```
.env.example             打卡 OAuth 的本地环境变量模板（复制成 .env.local）
data/                    每日一题的数据，按月一个文件
  2026-09.json             2026 年 9 月的全部题目（数组，按 date 升序）
  2026-10.json             10 月……
  index.json               自动生成的月份清单（不入库，见下）
solutions/               题解 markdown + 标程 cpp，同样按月一个目录
  2026-09/
    2026-09-08.md            与题目 date 同名的题解
    2026-09-08.cpp           同名标程（可选，只作留档，页面不读取）
  community/               社区投稿（约定不变）
public/                  直接拷贝进产物的静态资源（如图片、favicon）
  leaderboard/registry.json 排行榜静态成员表（也可以走 Issue 自助登记）
server/oauth-proxy/      GitHub Device Flow 的转发代理（Cloudflare Worker + 本地 Node 共用 core）
  core.mjs                 转发逻辑：只做设备码/令牌两个请求，无 secret、不落盘
  worker.mjs               Cloudflare Worker 入口
  wrangler.toml            Worker 配置（Client ID / 允许的 Origin）
src/                     页面源码（Vue 3）
  Root.vue                 路由根组件（RouterView），/ 与子页面的入口
  pages/CheckinPage.vue    每日打卡 + 排行榜合并子页面（按需加载）
  pages/RandomPage.vue     随机一题独立子页面（按需加载）
  auth/github.js           GitHub 设备码登录 / Gist API 客户端
  config/checkin.js        打卡接线点（Client ID、代理地址、排行榜配置）
  data/checkin-core.js     打卡纯逻辑：日历 / 连续天数 / 多端合并
  data/cfAccount.js        Codeforces 绑定 / AC 列表拉取 / 本地缓存
  data/leaderboard-core.js 排行榜快照 / 登记解析 / 排名
  data/leaderboard-client.js 排行榜只读加载与缓存
  components/SubpageShell.vue 子页面共用外壳（标题 / 导航 / footer / document.title）
  components/CfAccountPanel.vue CF 账号绑定面板
  composables/usePublishedProblems.js 已发布题目共享数据源（跨天刷新）
  composables/useCheckin.js 打卡状态、localStorage、私有 Gist、公开快照
  composables/useCfBinding.js CF 绑定状态与已 AC key 集合
  utils/storage.js         localStorage 可用性探测（GitHub / CF 共用）
  utils/scroll.js         页内滚动 + prefers-reduced-motion
scripts/                 构建辅助脚本 + 本地工具 + 测试
  data-index.mjs           校验数据、生成月份清单、构建收尾
  tool.mjs                 xcpc.bat 的本体：菜单 / dev / 全量检查
  oauth-proxy.mjs          本地 OAuth 代理（npm run auth:proxy）
  test-checkin.mjs         打卡 / 排行榜 / CF 绑定 / 代理 CORS 逻辑测试（见下文）
  test-cf-random.mjs       「随机一题」的随机性测试（见下文）
  validate-submission.mjs  校验社区投稿的题解格式
```

`data/index.json` 由 `scripts/data-index.mjs` 在 dev / build 时自动生成：dev 下写在
`data/` 里，build 时同时写一份进产物目录。页面运行时靠它找到「有哪些月文件可以 fetch」。
它已被 `.gitignore` 忽略，**不要手动编辑，也不要提交**；想单独刷新可以跑：

```powershell
npm run data:index
```

> 这个脚本同时会校验数据：必填字段、`YYYY-MM-DD` 格式、日期是否放错了月份文件、
> 同一个 date 是否重复。写错了 dev server 一启动（或 `npm run build` 一开始）就会报错。
>
> 构建收尾也在这个脚本里（`closeBundle`）：把 `data/<年-月>.json` 与
> `solutions/<年-月>/*.md` 拷进产物目录，并给产物 `index.html` 的入口资源打上内容版本号。

## 每天发题

1. 打开**当月**的数据文件（例如 2026 年 10 月 4 日 → `data/2026-10.json`），在数组末尾加一条：

```json
{
  "date": "2026-10-04",
  "source": "The 2023 ICPC Asia Jinan Regional Contest",
  "title": "A. Many Many Heads",
  "link": "https://codeforces.com/gym/104901/problem/A",
  "difficulty": "铜牌题",
  "tags": ["greedy"]
}
```

2. commit + `git push origin main`，GitHub Actions 自动构建部署，约 1 分钟生效。

> 进入新的一个月时，直接新建 `data/2026-11.json`（内容写 `[]` 再往里加也行）——
> 构建时会自动扫到，无需改任何代码。
> 字段说明：`date`/`source`/`title`/`link` 必填（`date` 格式 `YYYY-MM-DD`）；`difficulty`、`tags` 可选。
> 新增字段：`solution`（本地题解文件名，可选，见下文）、`hints`（字符串数组，可选，见下文）。

## GitHub 登录与每日打卡

「每日打卡」是独立子页面 `#/checkin`（`src/pages/CheckinPage.vue`），打卡记录和
打卡排行榜合并在同一页。用 GitHub 账号登录后，把当天 AC 的提交（当天题目、
OJ 提交链接、完整题解）记成一条记录；下面的绿色热力图按天汇总最近 53 周，另外给出
当前连续、最长连续、打卡天数与累计提交；排行榜紧跟在打卡面板下面。

### 登录方式

推荐 **OAuth Device Flow**（设备码流程）：

- 只需要 OAuth App 的 **Client ID**，**不需要 client_secret** —— 静态站点不会把任何密钥打进前端；
- GitHub 的 `/login/device/code` 与 `/login/oauth/access_token` 不返回 CORS 头，浏览器不能直接调用。
  仓库里带了一个很小的转发代理（`server/oauth-proxy`），只转发这两个请求，不保存数据、不接触 secret；
- 代理可以部署到 Cloudflare Workers（免费额度足够），本地开发也有等价的 Node 版本。

没有配置 OAuth 时页面不会报错：自动进入「本机体验模式」，打卡记录只写 localStorage，
登录入口会显示配置说明。另有一条**个人访问令牌（PAT）**备用登录路径，适合不想部署代理的人。

### 一次性配置（OAuth，推荐）

1. **创建 OAuth App**：GitHub → Settings → Developer settings → OAuth Apps → New OAuth App。
   - Homepage URL 填站点地址（如 `https://usedchang.github.io/xcpc-daily/`）；
   - Authorization callback URL 填同一个站点地址即可（Device Flow 不使用回调）；
   - 建好后进入应用设置，勾选 **Enable Device Flow**，复制 **Client ID**。
2. **部署代理**：编辑 `server/oauth-proxy/wrangler.toml`，填上 `GITHUB_CLIENT_ID`
   和 `ALLOWED_ORIGINS`，然后：
   ```powershell
   cd server/oauth-proxy
   npx wrangler deploy
   ```
   得到形如 `https://xcpc-daily-auth.<subdomain>.workers.dev` 的地址；
   访问它的 `/health` 应返回 `{"ok":true,"configured":true}`。
3. **配置站点**：
   - 本地：在仓库根目录新建 `.env.local`（已在 `.gitignore` 里，可复制 `.env.example`）：
     ```dotenv
     VITE_GITHUB_CLIENT_ID=你的 Client ID
     VITE_GITHUB_AUTH_PROXY=http://127.0.0.1:8787
     ```
   - 线上：仓库 Settings → Secrets and variables → Actions → **Variables**，添加
     `VITE_GITHUB_CLIENT_ID` 与 `VITE_GITHUB_AUTH_PROXY`（值填 Worker 地址）。
     `deploy.yml` 已经把这两个变量传给 `npm run build`；没配置时构建仍然成功，页面走本机体验模式。
4. **本地调试**：
   ```powershell
   npm run auth:proxy   # 终端 A：OAuth 转发代理
   npm run dev          # 终端 B：Vite
   ```
   `auth:proxy` 会读取 `.env.local` 里的 `VITE_GITHUB_CLIENT_ID`；dev 下如果只配了
   Client ID、没配代理地址，前端默认连 `http://127.0.0.1:8787`。
5. 重新构建 / push 后，每日打卡页右上角会出现「使用 GitHub 登录」。

> 代理的 `ALLOWED_ORIGINS` 默认包含 `https://usedchang.github.io` 和两个本地地址；
> 换域名或自定义域后要同步修改，否则浏览器会报 CORS。`ALLOWED_SCOPES` 固定为
> `read:user gist`，代理会拒绝其它 scope。

### 用个人访问令牌登录（无需代理）

点登录区右下角的「用令牌登录」，粘贴一个只有 **gist** 权限的令牌：

- 经典令牌：<https://github.com/settings/tokens/new?scopes=gist>（创建时只勾 `gist`）；
- Fine-grained token：账号设置 → Developer settings → Fine-grained tokens，
  勾选 **Gists: Read and write**。

令牌只保存在当前浏览器的 localStorage，不会上传到本站（本站没有后端）；但它仍是敏感凭证，
只建议在个人设备上使用。**退出登录只会删除本机保存的令牌**；要彻底撤销授权，请到
GitHub → Settings → Applications 操作。

### 数据与同步

- 每条记录：打卡日期、当天每日一题（题目名和链接自动从站内数据带入）、OJ 提交链接、完整题解。
- 打卡默认就是 AC，所以没有「结果 / AC / 尝试」字段；题目也不能手填或另填链接。
- 打卡日期只能从「站内有每日一题」的日子中选（表单里的月历会禁用空白日期），
  选完日期后题目选择框只列出那一天的每日一题。
- 旧数据里的 `note` 会按完整题解 `solution` 读出，`verdict` 字段直接忽略；
  下一次写入 Gist 时自动换成新字段。
- 未登录：`localStorage["xcpc-checkins-v1:guest"]`。
- 登录后：`localStorage["xcpc-checkins-v1:<login>"]`，并同步到**私有 Gist**
  `xcpc-daily-checkins.json`（secret gist 不在 Gist 列表公开，但拿到链接的人可读）。
- 登录时会把 guest 记录并入账号并清空 guest；换账号互不影响，退出登录不会删账号记录。
- 同步不是「云端覆盖本机」：打开页面先拉 Gist，按记录 id + `updatedAt` 取并集，
  删除用墓碑（`deleted`）标记 —— 两台设备各自离线打卡，联网后都不会丢。
- Gist 单文件上限 1 MB；记录过多时界面会明确报错，不会静默截断。
- 同步失败（断网、令牌过期、没有 gist 权限）时记录仍然写本机，界面上有「重试同步」。

### 常见问题

| 现象 | 原因 / 处理 |
| --- | --- |
| 点登录提示 `device_flow_disabled` | OAuth App 没勾 **Enable Device Flow** |
| `client_id_mismatch` / `incorrect_client_credentials` | 前端 `VITE_GITHUB_CLIENT_ID` 与代理里的 `GITHUB_CLIENT_ID` 不一致 |
| `origin_not_allowed` | 当前站点 Origin 不在代理的 `ALLOWED_ORIGINS` 里 |
| `proxy_not_configured` | Worker / 本地代理没有读到 `GITHUB_CLIENT_ID` |
| 登录成功但显示「同步失败」 | 授权时没给 `gist`，重新授权；或 PAT 没勾 Gists 读写 |
| 很久没打开后 401 | 令牌失效，重新登录即可，本机记录不会丢 |

### 测试

```powershell
npm run test:checkin   # 日期 / 热力图 / 连续天数 / 多端合并 / 排行榜 / CF 绑定 / 代理 CORS，57 项断言
```

`npm run check` 会把它接在构建之后一起跑。

## 打卡排行榜（在「每日打卡」子页面）

排行榜和打卡合并显示在 `#/checkin` 同一页，位于打卡记录下方；没有单独的排行榜路由。

排行榜是**只读、无后端**的：网站不收集任何人的完整打卡数据，只读取成员主动公开的统计快照。

### 数据链路

```
私有 Gist（完整题解/提交链接，永远不公开）
        │
        └─ 用户打开「公开到排行榜」
              │
              ├─ 创建 public Gist：xcpc-daily-leaderboard.json
              │     只有 login / 当前连续 / 最长连续 / 打卡天数 /
              │     累计提交 / 最近 30 天 / 更新时间
              │
              ├─ 静态成员：public/leaderboard/registry.json
              └─ 自助登记：一条带 marker 的 open GitHub Issue

排行榜区块 = 读取成员列表 → 逐个读取公开快照 → 本地排序
```

### 怎么上榜

1. 用 GitHub 登录；
2. 在每日打卡页打开 **「公开到排行榜」** 开关；
   - 只会创建/更新公开统计快照，题解和提交链接仍然留在私有 Gist；
3. 点 **「登记到排行榜」**，会打开一条预填好的 GitHub Issue；
   - 点提交即可，**保持 Issue 为 open**；
   - 关闭 Issue 就相当于从排行榜下架；
4. 在每日打卡页下方的排行榜点「刷新」，或等 10 分钟缓存过期。

也可以由站长直接把成员写进 `public/leaderboard/registry.json`：

```json
{
  "members": [
    { "login": "alice", "gistId": "0123456789abcdef" }
  ]
}
```

静态 registry 与 Issue 登记会合并；同一个 login 同时存在时，**静态 registry 优先**。

### 排名规则

```text
当前连续天数 ↓
累计打卡天数 ↓
累计提交数 ↓
最近 30 天活跃天数 ↓
快照更新时间 ↓
```

页面只展示前 20 名，可展开全部；自己的行会高亮。

### 隐私与关闭

- 公开快照只含统计数字，不含题目、题解、提交链接；
- 关闭「公开到排行榜」会把公开快照写成 `inactive`，排行榜立即忽略；
- 登记 Issue 不会被自动关闭；想彻底下架可以关闭自己的 Issue，或者到 GitHub 手动删除公开 Gist；
- **退出登录不会自动下架**公开快照，公开是账号级别的手动选择。

### 缓存 / 限流

- 前端缓存 10 分钟，页面上的「刷新」会强制绕过缓存；
- 未登录访问 GitHub API 是 60 次/小时；登录后使用自己的 token（5000 次/小时）；
- 成员很多时优先使用静态 registry，避免每次刷新打太多 Gist API；
- 某个成员快照读取失败（Gist 删除、改成私有、格式错误）会在页面底部列出，不影响其他人。

### 配置

在 [`src/config/checkin.js`](src/config/checkin.js) 的 `CHECKIN.leaderboard` 里改：

- `repo`：登记 Issue 所在的仓库（默认本站仓库）；
- `registryUrl`：静态成员表路径；
- `snapshotFile`：公开快照的 Gist 文件名；
- `cacheMs`：排行榜缓存时长；
- `maxParticipants`：一次最多读取多少成员；
- `enabled: false`：隐藏每日打卡页里的排行榜和「公开到排行榜」开关。

> 排行榜数据是**社区自报**的，没有自动核验 OJ 提交；当前规则适合朋友之间互相监督，
> 不适合当成正式比赛排名。要做防作弊，需要再接 Codeforces 公开 API 核对 AC 记录。

## 本地题解（Markdown）

题解放在**与题目同月**的目录里，文件名默认与题目的 `date` 相同：

- **默认**：`solutions/2026-09/2026-09-08.md`（8 月 9 月的题就分别进 `2026-08/`、`2026-09/`）。
- **显式指定**：在 `data/2026-09.json` 该题里加 `"solution": "2026-09-08-xor-is-add"`（只写文件名，目录按 `date` 的月份自动补；`.md` 可省略）。
- **标程**：`solutions/2026-09/2026-09-08.cpp` 与题解同名即可，只是留档（页面不读它）。
- 旧布局（直接放在 `solutions/` 根下）依然能识别，方便渐进迁移。
- 文件被忽略的规则：以 `_` 开头、或名为 `README` 的 md（`solutions/README.md` 是说明文档，不会被当作题解）。


### 题解内容即标准 Markdown

支持标题、加粗、行内代码、代码块（三个反引号 + 语言名）、列表、表格、引用、图片、链接等。页面会渲染为格式化内容，而不是纯文本。

### Callout（提问块）

引用块首行写成 `[!question] 标题`，会渲染为带图标的高亮提问块，正文写在后续引用行里：

```markdown
> [!question] 如何写 check
> 二分答案时统计 $H \le mid$ 的个数即可。
```

目前只识别 `question` 一种类型，其他 `[!note]` 之类的写法按普通引用原样显示（标题里带行内公式时会降级为普通引用）。

### Hint（提示）

一个题可以有多个 hint，写在**对应月份**的数据文件里（`data/<年-月>.json`），与正文独立，
**默认折叠，点击 `Hint N` 标题才展开**（类似 codeforces 的 Hint）：

```json
{
  "date": "2026-09-08",
  "source": "…",
  "title": "…",
  "link": "…",
  "hints": [
    "第一个提示：可以按位考虑。",
    "第二个提示：用 `trie` 维护。"
  ]
}
```

每个字符串是一个 hint，按顺序显示为 `Hint 1`、`Hint 2`…… 内容同样走 Markdown 渲染。

### 维护工作流

1. 新建 `solutions/<年-月>/2026-XX-XX.md` 写题解（或用 `solution` 字段指向其它文件名），标程 `2026-XX-XX.cpp` 放同一个目录。
2. 如需 hint，在 `data/<年-月>.json` 对应题目里加 `hints` 数组。
3. commit + push，自动构建部署。

> 说明：`npm run dev` 或 `npm run build` 会把 `solutions/<年-月>/*.md` 内联打包，
> **同时**把同一批 md 拷进产物目录（`dist/solutions/<年-月>/`）。
> 页面读取时**先 fetch**（`cache: "no-store"`），拿不到才用内联的那份：
> 所以「改完 md 直接覆盖部署目录里的同名文件」立刻生效，不必重新构建；
> 新加的题解文件重建一次即可（`import.meta.glob` 是构建期扫描的）。
>
> 题目数据（`data/<年-月>.json`）同理：产物里带着月文件，改完直接覆盖部署目录里的 json 就生效。
>
> 兜底也齐全：md 不存在、离线、或托管方对未知路径回退返回 `index.html`（状态码还是 200）时，
> 页面靠响应体嗅探认出「这是整页 HTML 而不是题解」，转而使用内联的那份。

## 随机一题（独立子页面 `#/random`）

「随机一题」已经从主页面拆成独立子页面，导航栏的「🎲 随机一题」会跳到 `#/random`，
页面代码按需加载（`src/pages/RandomPage.vue`），不进主页面首屏包。

**不占用 `data/` 的每日一题题源**，而是直接调 Codeforces 公开 API 的题库随机抽题
（`https://codeforces.com/api/problemset.problems`，约 1.1 万题，CORS 为 `*`，
纯前端可直接请求）。

- **筛选**：算法标签多选（`全部满足` = 交集 / `任一满足` = 并集）、分数区间
  （双滑块拖范围 + 两个数字输入框精确指定，如「就要 1500 分」；输入越界或下限
  越过上限时会自动收敛回合法值）、可选是否包含未评级题目（273 道，没有 rating 字段）。
- **加载策略**：进页面后**自动加载**，不需要先点一下按钮 —— 但走的是首屏空闲回调
  （`requestIdleCallback`），所以这 1.7 MB 不会去抢「今日题目」的首屏渲染。
  拉回来压成紧凑数组写进 localStorage（约 500 KB，24h 有效），之后再打开页面
  直接从缓存进入可用状态，一次网络请求都不发（面板上会标「缓存」）。
  自动加载只负责「备好题库」，不会擅自替你抽题。
- **与每日一题打通**：抽到的题如果就是往期某天的「每日一题」，会标「本站已收录」，
  并直接给一个「查看站内题解」入口（靠链接里的题号匹配，见 `cfKeyFromLink`）。

### Codeforces 账号绑定与自动排除已 AC

子页面顶部可以绑定一个 Codeforces handle：

- 用 `user.info` 校验 handle 是否存在，并显示 rating / 头像；
- 用 `user.status` 分页读取提交（每页 2000 条，最多 10 页 / 2 万条），
  只收集 `verdict = OK` 的题目 key（`<contestId><index>`）；
- 绑定后随机池会自动剔除这些 key，面板上显示「已排除 N 道 AC」；
- Codeforces API 限制 1 次 / 2 秒，所以请求串行化，页面会显示「已读取 N 条提交」进度；
- AC 列表缓存在本机 6 小时，面板上可手动「刷新 AC」；超过 6 小时会提示过期；
- 绑定按 **GitHub 账号** 分作用域（未登录时存在 guest 下，登录后自动迁移），
  只保存在本机，不验证 handle 归属，也不涉及 Codeforces 登录；
- 解绑后立即恢复完整候选池。

### 「每次点击都不一样」是怎么保证的

不是「随机完和上一题比一下」——那样连点两次仍可能撞上第三题，也没法保证第 m 次不重复。
这里把候选池当成一副**不放回**的牌（`src/data/cfRandom.js` 的 `createDrawEngine`）：

- 池子里有 m 道题，**连续点 m 次必然是 m 道互不相同的题**，第 m+1 次才开新一轮；
- 新一轮的第一题会避开上一轮的最后一题，所以「连点两次同一题」在跨轮那一刻也不会发生
  （池子只剩 1 题时物理上无解，此时不做保证）；
- 随机源是 `crypto.getRandomValues` + **拒绝采样**（`randomBelow`），
  不是 `Math.random() * n` 取整 —— 后者在 n 不是 2 的幂时会有可测的取模偏差；
- 「本轮已抽 x / y 题」直接写在按钮下面，保证是可见、可核对的。

### 随机性测试

```powershell
npm run test:cf-random         # 离线：合成题库，42 项断言
npm run test:cf-random:live    # 额外拉一次真实 CF 题库做验收
```

覆盖三层：**结构性**（抽满一轮零重复、每轮恰好是一个全排列、跨轮不连出同一题、
池大小 1–8 全枚举）、**分布**（大样本卡方检验，确认不是「反复抽同几道题」的假随机）、
**端到端**（筛选条件 → 候选池 → 抽取结果，抽中的题必须条条满足筛选条件）。
结构断言同时跑真实随机源与固定种子的伪随机源，后者便于复现。

`--live` 那组会连真实 API，验证「1.1 万题的池子抽 2 万次、任意相邻两次都不同」。

## 性能上的两点约定

- **markdown 渲染链按需加载**：MathJax（含全部 TeX 宏包）+ markdown-it + highlight.js + DOMPurify
  压缩后约 2 MB，只在打开题解弹窗时才会下载（`src/markdown-lazy.js` 里动态 import）。
  主入口 JS 因此只有 ~175 KB（gzip ~65 KB，只含今日题目、往期题目与基础登录状态）；
  「每日打卡 + 排行榜」是独立懒加载 chunk（~51 KB / gzip ~18 KB），
  「随机一题」是独立懒加载 chunk（~28 KB / gzip ~11 KB）；CF 题库本身是运行时按需 fetch 的，
  不占打包体积。
- **JS/CSS 文件名固定**：入口是 `assets/index.js` / `assets/index.css`，懒加载分块在
  `assets/chunks/` 下同样不带内容哈希。原因见 `vite.config.js` 的注释（GitHub Pages CDN
  多节点滞后会导致「HTML 引用的文件不存在」→ 白屏）。缓存更新靠 `dist/index.html` 里
  入口资源的 `?v=<内容哈希>`。

## 页面功能

主页面只保留两块：**今日题目 → 往期题目**；「每日打卡 + 排行榜」和「随机一题」
都是独立子页面（`#/checkin`、`#/random`）。主页面的区块跳转用 `scrollIntoView` 而不是
`#锚点`（本站跑在 hash 路由上，直接改 hash 会让 vue-router 去解析一个不存在的路径），
两个子页面则用真正的 `router-link`。

- 「每日打卡」（`#/checkin`）：GitHub 登录（Device Flow，或备用 PAT）→ 选日期和当天题目 →
  记 OJ 提交链接 + 完整题解（默认 AC）→ 最近 53 周的绿色热力图 + 连续天数统计；
  页面顶部提供「打卡记录 / 排行榜」页内切换；记录同步到私有 Gist（详见上文
  「GitHub 登录与每日打卡」）；未配置 OAuth 时自动降级为本机体验模式
- 「打卡排行榜」（同一页下方）：只读取成员自己选择公开的统计快照；成员通过静态 registry 或
  open 的登记 Issue 上榜；按当前连续 → 打卡天数 → 累计提交排名（详见上文）
- 「随机一题」（`#/random`）：标签多选 + 分数区间 + CF 账号绑定，自动排除已 AC 的题
- 搜索框：按题目名/来源即时筛选
- 日期、标签下拉筛选（筛选结果计数与「清除」同在一行，窄屏自动折行）。
  日期筛选的触发按钮直接显示已选日期，选完某一天会自动收起，面板里还有「最新一天」快捷键
- 护眼/暗色主题（左上角切换，选择记在 localStorage；首屏由 `index.html` 里的内联脚本
  提前定好主题，暗色用户不会看到一闪的白底）
- 筛选状态同步到 URL，可分享：`#/?year=2026&q=atcoder`
- 题表：日期 / 来源（下方标注站点名，如 `qoj.ac`）/ 题目（标题即外链，下方是难度与标签）/ 题解按钮。
  每题都能点开弹窗，没有官方题解时那一栏是「讨论 / 投稿」入口
- 「今日题目」卡片：标题栏写 `TODAY · 今日题目`；若今天还没发题，会写成
  `最近一题 · <日期>`，不会把昨天的题冒充成今天的
- 右下角悬浮的 **share** 按钮：一键复制最近两天（北京时间今天 + 昨天）的题目链接，
  形如：

  ```
  每日一题：
  (20260930) :https://qoj.ac/contest/1465/problem/4824
  (20260929) :https://qoj.ac/contest/1247/problem/6516/statement/zh_cn
  往期每日一题访问链接：https://usedchang.github.io/xcpc-daily/#/
  ```

  平时是半透明的（不挡正文），鼠标移上去变清晰；某天没发题就只列另一天。
  站点地址等常量在 `src/config/site.js` 里改。

## 部署

仓库 **Settings → Pages → Source** 选择 **GitHub Actions**（已配置好 `.github/workflows/deploy.yml`，之后只靠 push 自动部署）。

如果启用了 GitHub 登录，还要在 **Settings → Secrets and variables → Actions → Variables**
里配置 `VITE_GITHUB_CLIENT_ID` 和 `VITE_GITHUB_AUTH_PROXY`（见「GitHub 登录与每日打卡」）；
不配置时部署照常成功，只是每日打卡页走本机体验模式。

### 本地构建报 `spawn EPERM` / `Access is denied`

某些受限或加固环境里，系统临时目录带有 `Deny DeleteSubdirectoriesAndFiles` 之类的 ACE，
esbuild 清不掉自己的临时文件，构建会失败。把 TEMP 指到仓库内的 `.tmp/` 即可（详见 `.tmp/README.md`）：

```powershell
$env:TEMP = "$PWD\.tmp"; $env:TMP = "$PWD\.tmp"
npm run build
```
