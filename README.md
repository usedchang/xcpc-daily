# XCPC 每日一题

每天一道算法竞赛题，只记录「来源 · 题目 · 链接」，可选难度和算法标签。

- 在线：https://usedchang.github.io/xcpc-daily/
- 技术栈：Vue 3 + Vite，GitHub Actions 自动部署到 Pages
- 交流 QQ 群：1036787694

## 本地开发

```powershell
npm install     # 首次
npm run dev     # http://localhost:5173，改代码/任意月份 json 自动热更新
```

Windows 上可以直接双击仓库根目录的 **`xcpc.bat`**（不带参数弹菜单），或者：

```powershell
xcpc.bat dev            # 启动开发服务器
xcpc.bat check          # 全量检查：数据校验 + 生产构建 + 离线随机性测试
xcpc.bat check live     # 全量检查 + 真实 Codeforces 题库验收（需联网）
xcpc.bat help
```

非 Windows 环境用等价的 npm 脚本：

```powershell
npm run check           # 等价于 xcpc.bat check
npm run check:live      # 等价于 xcpc.bat check live
```

全量检查会按顺序跑：`npm run build`（顺带校验 `data/` 里的每个字段）、
41 项随机性测试、以及 `dist/` 关键产物的存在性；任何一项失败就以退出码 1 结束，
方便接在别的脚本或 CI 后面。

> **`xcpc.bat` 为什么这么短、而且全是英文注释**：`cmd.exe` 是按**控制台代码页**
> 解析 `.bat` 的，含多字节 UTF-8 中文的批处理会被从字符中间截断 —— 实测会把注释
> 碎片当命令执行，甚至原地死循环。所以 `.bat` 只做 ASCII 的环境准备（设置
> `chcp 65001`、把 TEMP/TMP 指到 `.tmp\`），所有中文提示都放在
> `scripts/tool.mjs` 里由 Node 输出。另外 `.bat` 必须保持 CRLF 行尾
> （`.gitattributes` 已经钉死），LF 行尾会让 cmd 把多行当成一行。

## 目录结构

```
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
src/                     页面源码（Vue 3）
scripts/                 构建辅助脚本 + 本地工具 + 随机性测试
  data-index.mjs           校验数据、生成月份清单、构建收尾
  tool.mjs                 xcpc.bat 的本体：菜单 / dev / 全量检查
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

## 随机一题（Codeforces 题库）

页面第二块是「随机一题」：**不占用 `data/` 的每日一题题源**，而是直接调 Codeforces
公开 API 的题库随机抽题（`https://codeforces.com/api/problemset.problems`，约 1.1 万题，
CORS 为 `*`，纯前端可直接请求）。

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
npm run test:cf-random         # 离线：合成题库，40+ 项断言
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
  入口 JS 因此只有 ~170 KB（gzip ~64 KB，含「随机一题」的筛选与抽取逻辑；
  CF 题库本身是运行时按需 fetch 的，不占打包体积）。
- **JS/CSS 文件名固定**：入口是 `assets/index.js` / `assets/index.css`，懒加载分块在
  `assets/chunks/` 下同样不带内容哈希。原因见 `vite.config.js` 的注释（GitHub Pages CDN
  多节点滞后会导致「HTML 引用的文件不存在」→ 白屏）。缓存更新靠 `dist/index.html` 里
  入口资源的 `?v=<内容哈希>`。

## 页面功能

页面自上而下分三块：**今日题目 → 随机一题 → 往期题目**，顶部有一组跳转胶囊
（用 `scrollIntoView` 而不是 `#锚点`：本站跑在 hash 路由上，直接改 hash 会让
vue-router 去解析一个不存在的路径）。

- 「随机一题」：见上一节（标签多选 + 分数区间，从 Codeforces 题库随机抽题）
- 搜索框：按题目名/来源即时筛选
- 日期、标签下拉筛选（筛选结果计数与「清除」同在一行，窄屏自动折行）
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

### 本地构建报 `spawn EPERM` / `Access is denied`

某些受限或加固环境里，系统临时目录带有 `Deny DeleteSubdirectoriesAndFiles` 之类的 ACE，
esbuild 清不掉自己的临时文件，构建会失败。把 TEMP 指到仓库内的 `.tmp/` 即可（详见 `.tmp/README.md`）：

```powershell
$env:TEMP = "$PWD\.tmp"; $env:TMP = "$PWD\.tmp"
npm run build
```
