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
public/                  直接拷贝进产物的静态资源（如图片）
src/                     页面源码（Vue 3）
scripts/                 构建辅助脚本
```

`data/index.json` 由 `scripts/data-index.mjs` 在 dev / build 时自动生成并写入产物目录，
页面运行时靠它找到「有哪些月文件可以 fetch」。同一脚本还会生成 `solutions/index.json`
（哪些题解 md 真实存在）。两份清单都已被 `.gitignore` 忽略，
**不要手动编辑，也不要提交**；想单独刷新可以跑：

```powershell
npm run data:index
```

> 这个脚本同时会校验数据：必填字段、`YYYY-MM-DD` 格式、日期是否放错了月份文件、
> 同一个 date 是否重复。写错了 dev server 一启动（或 `npm run build` 一开始）就会报错。
>
> 题解清单的作用：dev server 对**不存在**的路径会回退返回 `index.html`（状态码还是 200）。
> 有了清单，页面只 fetch 确实存在的 md，就不会把整页 HTML 当成题解渲染出来。

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

一个题可以有多个 hint，写在 `data.json` 里，与正文独立，**默认折叠，点击 `Hint N` 标题才展开**（类似 codeforces 的 Hint）：

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

> 说明：`npm run dev` 或 `npm run build` 会把 `solutions/<年-月>/*.md` 内联打包。页面仍保留 fetch 回退，因此对**已打包**的题解文件，改内容重新部署构建产物即可覆盖显示（无需发新版）；但**新增**题解文件（或新日期）需要重新 `npm run build` 才会被识别。想不重建就让新文件生效，可在对应月份 json 里显式加 `"solution": "文件名"` 或 `hints`，这样按钮一定会出现并能读取到文件。
>
> 题目数据（`data/<年-月>.json`）与旧版 `data.json` 一样是**运行时 fetch** 的，
> 改完直接覆盖部署目录里的月文件即可生效，不必重新构建。

## 页面功能

- 搜索框：按题目名/来源即时筛选
- 日期、标签下拉筛选
- 护眼/暗色主题（右上角切换）
- 筛选状态同步到 URL，可分享：`#/?year=2026&q=atcoder`
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
