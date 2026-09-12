# 参与指南

本仓库的「社区」部分不依赖自建后端，而是**把 GitHub 当作后端**：

| 能力 | 实现方式 | 谁来把关 |
|---|---|---|
| 评论（按题目分） | GitHub Discussions（页面上的评论区由 giscus 承载） | 维护者可在 Discussion 里隐藏违规评论 |
| 投稿题解 | Pull Request 往 `solutions/community/` 加文件 | 维护者 review + merge |
| 审核记录 | PR 时间线（谁在什么时候 approve / request changes） | — |
| 发布 | merge 到 `main` → GitHub Actions 自动构建部署 | — |

因此有一条**核心不变式**：

> `solutions/community/` 目录里存在的文件 == 已审核通过的投稿。

审核中 / 被驳回的稿件只活在 PR 分支上，不会进仓库。这也意味着这里没有 `status` 字段，
状态就是「PR 开着 / 已合并 / 已关闭」。

## 评论

- 需要 GitHub 账号登录（giscus 会引导授权）。
- 每道题对应一个 Discussion 帖（term 为 `problem-<date>`），首次有人评论时自动创建。
- 帖子本身只有维护者能编辑，评论人人可发；违规评论由维护者在 Discussion 里隐藏。

> **维护者前置条件**（没做完这些，页面上的评论区只会显示一段配置指引，而不是评论框）：
> 1. 仓库 **Settings → General → Features** 勾选 **Discussions**。
>    没启用时 `https://github.com/<owner>/<repo>/discussions` 会直接 **404**——这个路径在未启用时并不存在，
>    所以站点上「💬 全部讨论」入口在配置完成前也不会显示。
> 2. 在 Discussions 里新建一个分类（例如「题解讨论」，类型选 Announcement）。
> 3. 安装 [giscus App](https://github.com/apps/giscus) 并授予 `discussions:write` 权限（否则无法自动建帖）。
> 4. 到 [giscus.app](https://giscus.app) 选择本仓库与上面那个分类，把生成的 `repoId` / `categoryId`
>    填进 `src/config/community.js`。

## 投稿题解

### 1. 生成内容

页面上点「✍️ 投稿题解」（或在某道题的弹窗里点「我也来写一篇」），填好表单后：

- 「复制内容」得到带 front matter 的完整 Markdown；
- 「在 GitHub 打开并粘贴」直接跳到 GitHub 网页编辑器（会自动 fork 并建分支）。

### 2. 命名与目录（硬性要求）

- 目录：`solutions/community/`
- 文件名：`YYYY-MM-DD-<你的GitHub用户名>.md`
  - 日期必须是 `data.json` 里已存在、且不晚于今天的题目；
  - **文件名里的用户名必须与提交 PR 的 GitHub 账号一致**（防止冒名顶替）；想用别的展示名，写在 front matter 的 `author` 里。

模板见 [`solutions/community/_TEMPLATE.md`](solutions/community/_TEMPLATE.md)（以 `_` 开头，不会被站点加载）。

### 3. front matter

```markdown
---
author: 展示名
date: 2026-09-08
title: 可选，一句话概括
---
```

正文就是普通 Markdown，支持行内 `$公式$`、块级 `$$公式$$`、带语言名的代码块（C++ 代码块会自动折叠），
以及 `> [!question] 标题` 提问块。

### 4. 本地先自查

```bash
node scripts/validate-submission.mjs solutions/community/2026-09-08-你的用户名.md
```

CI（`.github/workflows/review-solution.yml`）会跑同一份脚本，额外校验「文件名 handle == PR 作者」。

### 5. 审核

- 维护者 review 后 Approve + Merge，约 1 分钟后题解出现在页面上；
- 需要修改时会用 Request changes 说明；
- 驳回或不再推进的会直接关闭 PR，你仍可以改好后重新提。

## 不要做什么

- 不要修改 `data.json`（题目数据由维护者维护）；
- 不要修改 `solutions/` 根目录下的官方题解；
- 不要修改 `src/`、`.github/`；
- 不要在正文里塞 `<script>`、`<iframe>`、`onclick=` 之类的内容——CI 会拦，前端渲染也会 sanitize。
