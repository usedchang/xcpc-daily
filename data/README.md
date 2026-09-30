# 题目数据目录

一天一道题，**一个自然月一个文件**：`data/<YYYY-MM>.json`。

```
data/2026-09.json     2026 年 9 月的全部题目
data/2026-10.json     2026 年 10 月
data/index.json       自动生成的月份清单（不入库，勿手改）
solutions/index.json  自动生成的题解清单，同属这一套清单（勿手改）
```

## 文件格式

每个文件是一个数组，按 `date` 升序；一天一条：

```json
[
  {
    "date": "2026-09-30",
    "source": "The 2nd Universal Cup. Stage 16: Run Twice",
    "title": "Bracket-and-bar Sequences",
    "link": "https://qoj.ac/contest/1465/problem/4824",
    "difficulty": "2100",
    "tags": ["run twice"]
  }
]
```

- 必填：`date`（`YYYY-MM-DD`）、`source`、`title`、`link`
- 可选：`difficulty`、`tags`（字符串数组）、`hints`（字符串数组，页面上折叠显示）、
  `solution`（题解文件名，不含目录、`.md` 可省略）

## 发新题

1. 打开**当月**文件；进入新的一个月就新建 `data/2026-11.json`（写 `[]` 起步即可）。
2. 在数组里加一条记录，`date` 与文件名的月份必须一致。
3. commit + push。页面在运行时 fetch 这些 json，推送后自动生效。

> 改错了不用慌：`npm run dev` 启动时（以及 `npm run build` 开始时）会自动校验——
> 必填字段缺失、日期格式不对、条目放错月份文件、同一日期重复，都会直接报错并指出是哪一行。

## index.json

`data/index.json` 是 `scripts/data-index.mjs` 生成的月份清单，页面靠它在运行时找到可 fetch 的月文件。
同一个脚本还会生成 `solutions/index.json`（列出真实存在的题解 md），避免页面去 fetch 不存在的文件
——dev server 对缺失路径会返回 `index.html`，那会被当成题解渲染。

两份清单都已被 `.gitignore` 忽略，**不要手动编辑、也不要提交**；需要单独刷新时跑：

```powershell
npm run data:index
```
