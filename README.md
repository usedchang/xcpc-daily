# XCPC 每日一题（Vue 3 + Vite）

一个只做一件事的静态网页：**每天发布一道 XCPC（ICPC/CCPC）真题**，只包含：

- 题目来源
- 题目名
- 题目链接

可选附加：难度、算法标签。

在线效果：`https://usedchang.github.io/xcpc-daily/`

技术栈：**Vue 3 + Vite + Vue Router**，源码分文件维护，`npm run dev` 本地实时热更新，`npm run build` 产出静态文件部署到 GitHub Pages。

---

## 文件结构

```text
.
├── index.html                 # Vite 入口 HTML
├── package.json               # 依赖与脚本
├── vite.config.js             # base: "./" 相对路径，适配 GitHub Pages 子目录
├── data.json                  # 题库数据，每天加一条（dev 时编辑即热更新）
├── .github/workflows/deploy.yml  # 推 main 自动构建并部署 Pages
└── src/
    ├── main.js                # 挂载 Vue + hash 路由
    ├── App.vue                # 页面主组件：加载数据、筛选状态与布局
    ├── style.css              # 全局样式（护眼/暗色主题变量、表格、滚动条）
    ├── utils.js               # esc 等工具
    ├── composables/useState.js  # 主题切换 + URL 状态同步
    ├── data/problems.js       # 数据加载层（import data.json + fetch 回退）
    └── components/
        ├── ThemeToggle.vue    # 右上角主题切换按钮
        ├── LatestCard.vue     # 「今日题目」卡片
        ├── FilterBar.vue      # 搜索框 + 年/月/日筛选
        └── ProblemTable.vue   # 题目表格（含滚动容器）
```

## 本地开发（实时维护）

```powershell
cd xcpc-daily
npm install        # 首次
npm run dev        # 启动 Vite 开发服务器，默认 http://localhost:5173
```

- 编辑 `src/**` 或 `data.json` 后浏览器**自动热更新**。
- `data.json` 通过静态 import 进入 dev 环境：改完保存立即可见。

## 构建与预览

```powershell
npm run build      # 产出 dist/
npm run preview    # 本地预览构建产物
```

## 每天怎么发题

1. 在 GitHub 打开本仓库的 `data.json`。
2. 点右上角铅笔图标编辑。
3. 在数组最前面加一条：

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

4. 点 **Commit changes** 保存。
5. GitHub Actions 自动构建并部署，等约 1 分钟生效。

页面自动按 `date` 倒序展示，最新一条就是「今日题目」。

## 筛选与搜索

页面上方提供搜索框和年 / 月 / 日三个下拉框：

- **搜索框**：输入题目名或来源，自动匹配筛选（不区分大小写）。
- **年 / 月 / 日下拉框**：按日期筛选，选项只显示数据中实际存在的日期。
- **清除按钮**：一键重置所有筛选条件。

筛选条件同步到 URL（hash 形式，兼容 GitHub Pages 静态托管），可直接收藏或分享：

```text
https://<你的用户名>.github.io/xcpc-daily/#/?year=2026&month=09
https://<你的用户名>.github.io/xcpc-daily/#/?q=atcoder
https://<你的用户名>.github.io/xcpc-daily/#/?year=2026&month=09&day=08
https://<你的用户名>.github.io/xcpc-daily/#/?year=2026&month=09&q=xor
```

参数说明：

| 参数 | 说明 |
| --- | --- |
| `year` | 年份，如 `2026` |
| `month` | 月份，如 `09`（`9` 也会被自动补成 `09`） |
| `day` | 日期，如 `08` |
| `q` | 搜索关键词，匹配题目名或来源 |

## 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `date` | ✅ | 日期，格式 `YYYY-MM-DD` |
| `source` | ✅ | 题目来源（比赛全称） |
| `title` | ✅ | 题目名，如 `A. Crystalfly` |
| `link` | ✅ | 题目链接（Gym / QOJ / Hydro 等） |
| `difficulty` | ❌ | 难度档位，如 `铜牌题` / `银牌题` / `金牌题` |
| `tags` | ❌ | 算法标签数组，如 `["dp", "graph"]` |

## 部署到 GitHub Pages

### 方式一：GitHub Actions 自动部署（推荐，已配置）

1. 把本目录推到 GitHub 仓库（仓库名建议 `xcpc-daily`，分支 `main`）。
2. 打开仓库 **Settings → Pages**。
3. **Source** 选 **GitHub Actions**。
4. 之后每次 push 到 `main`，`.github/workflows/deploy.yml` 会自动 `npm run build` 并部署。

> 首次使用需确认 Pages 的 Source 已切换到 GitHub Actions；不要再用旧的「Deploy from a branch」。

### 方式二：手动构建部署

```powershell
npm run build
# 把 dist/ 的内容推到 gh-pages 分支即可
```

## 常见问题

- **为什么 URL 里是 `#/?year=...`？** GitHub Pages 是纯静态托管，无法为路径式路由配置 SPA fallback，因此用 Vue Router 的 hash 模式，刷新后筛选状态仍能正确恢复，且无需服务器配置。
- **直接双击 index.html 能用吗？** 不能。Vite 项目需要 dev server 或构建后的静态服务器。请用 `npm run dev`。
