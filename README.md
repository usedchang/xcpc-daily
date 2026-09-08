# XCPC 每日一题

每天一道算法竞赛题，只记录「来源 · 题目 · 链接」，可选难度和算法标签。

- 在线：https://usedchang.github.io/xcpc-daily/
- 技术栈：Vue 3 + Vite，GitHub Actions 自动部署到 Pages
- 交流 QQ 群：1036787694

## 本地开发

```powershell
npm install     # 首次
npm run dev     # http://localhost:5173，改代码/data.json 自动热更新
```

## 每天发题

1. 编辑 `data.json`，在数组最前面加一条：

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

> 字段说明：`date`/`source`/`title`/`link` 必填（`date` 格式 `YYYY-MM-DD`）；`difficulty`、`tags` 可选。
> 新增字段：`solution`（本地题解文件名，可选，见下文）、`hints`（字符串数组，可选，见下文）。

## 本地题解（Markdown）

在仓库根目录创建 `solutions/` 目录（已有一个 `solutions/README.md` 说明约定），把题解写成 Markdown 文件：

- **默认文件名**：与题目 `date` 相同，例如 `solutions/2026-09-08.md`。
- **显式指定**：在 `data.json` 该题里加 `"solution": "2026-09-08-xor-is-add"`（不带目录，`.md` 可省略）。
- 文件被忽略的规则：以 `_` 开头、或名为 `README` 的 md（`solutions/README.md` 是说明文档，不会被当作题解）。

### 题解内容即标准 Markdown

支持标题、加粗、行内代码、代码块（三个反引号 + 语言名）、列表、表格、引用、图片、链接等。页面会渲染为格式化内容，而不是纯文本。

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

1. 新建 `solutions/2026-XX-XX.md` 写题解（或用 `solution` 字段指向其它文件名）。
2. 如需 hint，在 `data.json` 对应题目里加 `hints` 数组。
3. commit + push，自动构建部署。

> 说明：`npm run dev` 或 `npm run build` 会把 `solutions/*.md` 内联打包。页面仍保留 fetch 回退，因此对**已打包**的题解文件，改内容重新部署构建产物即可覆盖显示（无需发新版）；但**新增**题解文件（或新日期）需要重新 `npm run build` 才会被识别。想不重建就让新文件生效，可在 `data.json` 里显式加 `"solution": "文件名"` 或 `hints`，这样按钮一定会出现并能读取到文件。

## 页面功能

- 搜索框：按题目名/来源即时筛选
- 日期、标签下拉筛选
- 护眼/暗色主题（右上角切换）
- 筛选状态同步到 URL，可分享：`#/?year=2026&q=atcoder`

## 部署

仓库 **Settings → Pages → Source** 选择 **GitHub Actions**（已配置好 `.github/workflows/deploy.yml`，之后只靠 push 自动部署）。
