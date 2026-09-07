# XCPC 每日一题（极简 URL 版）

一个只做一件事的静态网页：**每天发布一道 XCPC（ICPC/CCPC）真题**，只包含：

- 题目来源
- 题目名
- 题目链接

可选附加：难度、算法标签。

在线效果：`https://usedchang.github.io/xcpc-daily/`

---

## 文件说明

```text
.
├── index.html   # 页面，读取 data.json 渲染
└── data.json    # 题库数据，每天加一条
```

## 每天怎么发题（30 秒）

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

页面会自动按 `date` 倒序展示，最新一条就是「今日题目」。

## 字段说明

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `date` | ✅ | 日期，格式 `YYYY-MM-DD` |
| `source` | ✅ | 题目来源（比赛全称） |
| `title` | ✅ | 题目名，如 `A. Crystalfly` |
| `link` | ✅ | 题目链接（Gym / QOJ / Hydro 等） |
| `difficulty` | ❌ | 难度档位，如 `铜牌题` / `银牌题` / `金牌题` |
| `tags` | ❌ | 算法标签数组，如 `["dp", "graph"]` |

## 首次部署（GitHub Pages）

1. 把本目录推到 GitHub 新仓库（仓库名建议 `xcpc-daily`）。
2. 打开仓库 **Settings → Pages**。
3. **Source** 选择 `Deploy from a branch`。
4. **Branch** 选择 `main`，目录选择 `/ (root)`，保存。
5. 等 1 分钟，访问 `https://<你的用户名>.github.io/xcpc-daily/`。

## 本地预览

直接双击 `index.html` 时浏览器可能因 `file://` 限制无法读取 `data.json`，任选其一：

```powershell
# 方式一：Python 本地服务器
cd xcpc-daily
python -m http.server 8000
# 然后访问 http://localhost:8000

# 方式二：npx 本地服务器
npx serve .
```


