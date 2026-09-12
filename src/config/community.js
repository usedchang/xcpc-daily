/**
 * 社区功能（评论 / 投稿）的接线点配置。
 *
 * 本仓库的「社区」不走自建后端，而是把 GitHub 当作后端：
 *   - 评论   -> GitHub Discussions（由 giscus 承载）
 *   - 投稿   -> Pull Request，合并进 solutions/community/ 即视为审核通过
 *   - 审核   -> PR review + merge 权限（见 .github/workflows/review-solution.yml）
 *
 * 所以这里只需要填「仓库」和「giscus 的两个 id」，没有服务端要部署。
 */

export const COMMUNITY = {
  /** 仓库全名，用于生成 GitHub 链接。 */
  repo: "usedchang/xcpc-daily",
  repoUrl: "https://github.com/usedchang/xcpc-daily",
  /** 站点部署所在的分支（GitHub 网页编辑器新建文件时用）。 */
  defaultBranch: "main",
  /** 社区投稿题解的目录（仓库根目录起算，不带首尾斜杠）。 */
  submissionsDir: "solutions/community",

  /**
   * 投稿题解功能开关。
   *
   * 置 false 只隐藏「投稿入口」（页面顶部的按钮、社区题解区的「我也来写一篇」），
   * 已经合并进 solutions/community/ 的题解仍照常展示——所以这是可逆的暂时隐藏，不是下架功能。
   * 想重新开放，把它改回 true 即可。
   */
  submitEnabled: false,

  giscus: {
    /** 总开关：想临时关掉评论区时改成 false。 */
    enabled: true,
    repo: "usedchang/xcpc-daily",
    /**
     * 下面两个 id 在 https://giscus.app 配置页生成（选好仓库与分类后页面会给出）。
     * 留空时评论区会显示一段配置指引，而不是报错。
     */
    repoId: "R_kgDOURdPgw", // 仓库 node_id（已核对 github.com/usedchang/xcpc-daily 的 node_id 一致）
    category: "题解讨论",
    categoryId: "DIC_kwDOURdPg84DFcsx", // 分类「题解讨论」的 node_id（giscus.app 生成）
    /** 每题一个讨论帖，用 specific + 自定义 term，见 discussionTerm()。 */
    mapping: "specific",
    reactionsEnabled: "1",
    inputPosition: "top",
    lang: "zh-CN",
  },
};

/** giscus 是否已配置完成（填了 id 才会真正渲染 iframe）。 */
export function isGiscusReady() {
  const g = COMMUNITY.giscus;
  return Boolean(g.enabled && g.repoId && g.categoryId);
}

/**
 * giscus 的讨论帖标识：一道题一个帖子。
 * 站点是 hash 路由（#/?year=...），题目没有独立 pathname，
 * 所以不能用 mapping="pathname"，必须用 mapping="specific" + 稳定的 term。
 * 用 date 作 key，与 data.json 一一对应。
 */
export function discussionTerm(problem) {
  return `problem-${String(problem?.date || "").trim()}`;
}

/** 「新建投稿」直达 GitHub 网页编辑器的 URL（会自动 fork + 建分支）。 */
export function newSubmissionUrl(filename) {
  const base = `${COMMUNITY.repoUrl}/new/${COMMUNITY.defaultBranch}/${COMMUNITY.submissionsDir}`;
  return filename ? `${base}?filename=${encodeURIComponent(filename)}` : base;
}

/** 某道题在 GitHub 上的讨论区（giscus 创建的讨论帖会落在这里）。 */
export function discussionsUrl() {
  return `${COMMUNITY.repoUrl}/discussions`;
}
