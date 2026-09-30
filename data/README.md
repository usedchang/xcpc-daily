# 题目数据目录

一天一道题，**一个自然月一个文件**：`data/<YYYY-MM>.json`。

```
data/2026-09.json     2026 年 9 月的全部题目
data/2026-10.json     2026 年 10 月
data/index.json       自动生成的月份清单（不入库，勿手改）
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
它已被 `.gitignore` 忽略，**不要手动编辑、也不要提交**；需要单独刷新时跑：

```powershell
npm run data:index
```

构建时同一个脚本还会把月文件拷进产物目录（`dist/data/`），并给 `dist/index.html` 的入口资源
打上内容版本号，所以「改完 json 直接覆盖部署目录里的文件」也能立刻生效，不必重新构建。

> 题解 md 没有对应的清单：`solutions/index.json` 曾经存在，但它挡不住任何真实问题
> （SPA 回退返回 index.html 的情况由响应体嗅探处理），反而让「后来才丢进部署目录的 md」
> 永远读不到，因此已删除。
