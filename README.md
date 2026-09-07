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

## 页面功能

- 搜索框：按题目名/来源即时筛选
- 日期、标签下拉筛选
- 护眼/暗色主题（右上角切换）
- 筛选状态同步到 URL，可分享：`#/?year=2026&q=atcoder`

## 部署

仓库 **Settings → Pages → Source** 选择 **GitHub Actions**（已配置好 `.github/workflows/deploy.yml`，之后只靠 push 自动部署）。
