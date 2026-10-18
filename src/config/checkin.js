/**
 * 打卡系统的接线点。
 *
 * 登录走 GitHub OAuth **Device Flow**（设备码流程）：
 *   - 只需要 OAuth App 的 client_id，**不需要 client_secret** —— 静态站点也能安全使用；
 *   - 浏览器把「申请设备码 / 轮询令牌」两件事发给一个小代理（server/oauth-proxy），
 *     由代理转发给 GitHub 并补上 CORS 头。代理不保存任何数据，也不接触 client_secret。
 *
 * 两个构建期变量（Vite 只会把 VITE_ 前缀注入前端）：
 *   VITE_GITHUB_CLIENT_ID     OAuth App 的 Client ID（公开信息，可以入库）
 *   VITE_GITHUB_AUTH_PROXY    OAuth 代理地址，例如 https://xcpc-daily-auth.xxx.workers.dev
 *
 * 没配置时不会白屏：页面进入「本机体验模式」，打卡记录只写 localStorage，
 * 登录入口会显示一句配置说明。配置步骤见 README 的「GitHub 登录与每日打卡」。
 */

import { DEFAULT_GIST_FILE } from "../data/checkin-core.js";
import { LEADERBOARD_FILE } from "../data/leaderboard-core.js";

const env = (typeof import.meta !== "undefined" && import.meta.env) || {};
const isDev = Boolean(env.DEV);

const clientId = String(env.VITE_GITHUB_CLIENT_ID || "").trim();
const authProxy = String(
  env.VITE_GITHUB_AUTH_PROXY || (isDev ? "http://127.0.0.1:8787" : "")
)
  .trim()
  .replace(/\/+$/, "");

export const CHECKIN = {
  /** 总开关：想整块隐藏打卡区时改成 false（数据与代码都保留）。 */
  enabled: true,

  /** GitHub OAuth App 的 Client ID（公开，不是 secret）。 */
  clientId,
  /** OAuth Device Flow 代理地址（末尾斜杠会被去掉）。 */
  authProxy,
  /** 登录时申请的权限：读资料 + 私有 Gist（存打卡记录）。 */
  scope: "read:user gist",

  /** 记录同步到哪个 Gist 文件。 */
  gistFileName: DEFAULT_GIST_FILE,
  gistDescription: "XCPC 每日一题 · 打卡记录（由网站自动同步）",

  /** 未登录时也允许打卡：数据先落在本机，登录后自动并入账号。 */
  allowGuest: true,

  /** 热力图展示多少周（GitHub 是 53 列 = 约一年）。 */
  calendarWeeks: 53,

  /**
   * 打卡排行榜。
   *
   * 数据源 = 静态 registry + GitHub Issue 自助登记；每个成员指向自己的公开快照
   * Gist（只含统计数字，不含题解）。静态站不建数据库。
   */
  leaderboard: {
    enabled: true,
    /** 登记 Issue 所在的仓库（与站点同仓库即可）。 */
    repo: "usedchang/xcpc-daily",
    /** 静态成员表，路径相对站点根目录。 */
    registryUrl: "./leaderboard/registry.json",
    /** 公开快照的 Gist 文件名。 */
    snapshotFile: LEADERBOARD_FILE,
    snapshotDescription: "XCPC 每日一题 · 排行榜公开统计（不含题解）",
    /** 前端缓存多久再重新拉 GitHub。 */
    cacheMs: 10 * 60 * 1000,
    /** 一次最多拉多少个成员，防止 registry 被塞爆。 */
    maxParticipants: 100,
  },

  /** 配置文档 / 令牌创建入口。 */
  docsUrl: "https://github.com/usedchang/xcpc-daily#github-登录与每日打卡",
  patUrl: "https://github.com/settings/tokens/new?scopes=gist&description=XCPC%20%E6%AF%8F%E6%97%A5%E4%B8%80%E9%A2%98%20%E6%89%93%E5%8D%A1",
};

/** OAuth 代理 + Client ID 都配好时，才显示「一键 GitHub 登录」。 */
export function hasGithubOAuth() {
  return Boolean(CHECKIN.clientId && CHECKIN.authProxy);
}
