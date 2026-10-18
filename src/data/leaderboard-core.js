/**
 * 打卡排行榜的纯逻辑层：快照格式、登记解析、排名。
 *
 * 隐私边界：
 *   - 打卡记录（完整题解、提交链接）仍然只进私有 Gist；
 *   - 排行榜只使用一份**公开快照**，里面只有统计数字，没有题目、题解、提交链接；
 *   - 排行榜成员的定位方式有两种：静态 registry（站长/PR 维护）+ GitHub Issue 自助登记。
 *
 * 这样静态站不需要后端，也能有一个可更新的排行榜。
 */

import { daysBetween, isDateString, todayInBeijing } from "../utils/date.js";
import { computeStats } from "./checkin-core.js";

export const LEADERBOARD_APP = "xcpc-daily-leaderboard";
export const LEADERBOARD_VERSION = 1;
export const LEADERBOARD_FILE = "xcpc-daily-leaderboard.json";
export const REGISTRATION_MARKER = "<!-- xcpc-leaderboard-register -->";

const LOGIN_RE = /^[A-Za-z0-9-]{1,39}$/;
const GIST_ID_RE = /^[A-Za-z0-9]{5,64}$/;

export function isGithubLogin(value) {
  return LOGIN_RE.test(String(value || ""));
}

export function isGistId(value) {
  return GIST_ID_RE.test(String(value || ""));
}

function int(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : 0;
}

/**
 * 生成公开快照。只放统计数字；不碰 title/link/submission/solution。
 */
export function buildLeaderboardSnapshot({ login, records, today, now = Date.now() }) {
  if (!isGithubLogin(login)) return null;
  const stats = computeStats(records, today);
  return {
    app: LEADERBOARD_APP,
    version: LEADERBOARD_VERSION,
    login,
    updatedAt: Number(now) || Date.now(),
    stats: {
      currentStreak: stats.currentStreak,
      longestStreak: stats.longestStreak,
      activeDays: stats.activeDays,
      total: stats.total,
      last30Days: stats.last30Days,
      todayCount: stats.todayCount,
      lastDate: isDateString(stats.lastDate) ? stats.lastDate : "",
    },
  };
}

export function snapshotText(snapshot) {
  return `${JSON.stringify(snapshot, null, 2)}\n`;
}

/** 关闭公开但删不掉 Gist 时的兜底：把快照标成 inactive，排行榜会忽略它。 */
export function inactiveSnapshotText(login) {
  return `${JSON.stringify(
    {
      app: LEADERBOARD_APP,
      version: LEADERBOARD_VERSION,
      login,
      inactive: true,
      updatedAt: Date.now(),
    },
    null,
    2
  )}\n`;
}

/**
 * 校验并规整一份公开快照。
 * @param {string|object} raw
 * @param {string} expectedLogin 期望的 GitHub 用户名（来自登记信息）
 * @returns {null|{login:string,updatedAt:number,stats:object}}
 */
export function normalizeSnapshot(raw, expectedLogin = "") {
  let data = raw;
  if (typeof raw === "string") {
    try {
      data = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) return null;
  if (data.inactive === true) return null;
  if (data.app && data.app !== LEADERBOARD_APP) return null;

  const login = String(data.login || "").trim();
  if (!isGithubLogin(login)) return null;
  if (expectedLogin && login.toLowerCase() !== String(expectedLogin).toLowerCase()) return null;

  const stats = data.stats && typeof data.stats === "object" ? data.stats : null;
  if (!stats) return null;

  return {
    login,
    updatedAt: int(data.updatedAt),
    stats: {
      currentStreak: int(stats.currentStreak),
      longestStreak: int(stats.longestStreak),
      activeDays: int(stats.activeDays),
      total: int(stats.total),
      last30Days: int(stats.last30Days),
      todayCount: int(stats.todayCount),
      lastDate: isDateString(stats.lastDate) ? String(stats.lastDate) : "",
    },
  };
}

/** 静态 registry：支持数组，或 `{ members: [...] }`。 */
export function normalizeRegistry(raw) {
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.members) ? raw.members : [];
  const seen = new Set();
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const login = String(item.login || "").trim();
    const gistId = String(item.gistId || "").trim();
    if (!isGithubLogin(login) || !isGistId(gistId)) continue;
    const key = login.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ login, gistId });
  }
  return out;
}

/**
 * 从一条 GitHub Issue 里解析排行榜登记信息。
 * 约定正文带 marker + 一个 JSON 代码块；issue 作者必须是快照里的 login。
 * 只认 open 的 issue：关掉 issue 就等于从排行榜下架。
 */
export function parseRegistrationIssue(issue) {
  if (!issue || typeof issue !== "object") return null;
  if (issue.state && issue.state !== "open") return null;
  const body = String(issue.body || "");
  if (!body.includes(REGISTRATION_MARKER)) return null;

  const after = body.slice(body.indexOf(REGISTRATION_MARKER) + REGISTRATION_MARKER.length);
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(after);
  const start = after.indexOf("{");
  const end = after.lastIndexOf("}");
  const raw = fenced ? fenced[1] : start >= 0 && end > start ? after.slice(start, end + 1) : "";
  if (!raw.trim()) return null;

  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!data || typeof data !== "object") return null;

  const login = String(data.login || "").trim();
  const gistId = String(data.gistId || "").trim();
  const author = String(issue.user?.login || "").trim();
  if (!isGithubLogin(login) || !isGistId(gistId)) return null;
  if (!author || author.toLowerCase() !== login.toLowerCase()) return null;

  return {
    login,
    gistId,
    author,
    number: Number(issue.number) || 0,
    url: String(issue.html_url || ""),
    createdAt: String(issue.created_at || ""),
  };
}

/** 合并静态 registry 与 Issue 登记；同名时静态 registry 优先（站长可覆盖）。 */
export function mergeRegistrations(registry, issues) {
  const out = [];
  const seen = new Set();
  for (const item of [...normalizeRegistry(registry), ...(issues || [])]) {
    const login = String(item?.login || "").trim();
    const gistId = String(item?.gistId || "").trim();
    if (!isGithubLogin(login) || !isGistId(gistId)) continue;
    const key = login.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ login, gistId });
  }
  return out;
}

/**
 * 快照里的 currentStreak 是「生成快照那天」的值。排行榜隔几天再看时，
 * 如果 lastDate 已经不是今天/昨天，连续天数应当归零，不能一直显示旧数字。
 */
export function effectiveCurrentStreak(stats, today = todayInBeijing()) {
  const last = stats?.lastDate;
  if (!isDateString(last) || !isDateString(today)) return 0;
  const gap = daysBetween(last, today);
  return gap === 0 || gap === 1 ? int(stats?.currentStreak) : 0;
}

/** 排名：当前连续 → 累计打卡天数 → 累计提交 → 最近 30 天 → 更新时间。 */
export function rankLeaderboard(entries, today = todayInBeijing()) {
  const list = (entries || []).filter(Boolean).map((entry) => ({
    ...entry,
    stats: {
      ...entry.stats,
      currentStreak: effectiveCurrentStreak(entry.stats, today),
    },
  }));
  list.sort((a, b) => {
    const sa = a.stats || {};
    const sb = b.stats || {};
    return (
      sb.currentStreak - sa.currentStreak ||
      sb.activeDays - sa.activeDays ||
      sb.total - sa.total ||
      sb.last30Days - sa.last30Days ||
      (b.updatedAt || 0) - (a.updatedAt || 0) ||
      a.login.localeCompare(b.login)
    );
  });
  return list.map((entry, index) => ({ ...entry, rank: index + 1 }));
}

/** 生成「登记到排行榜」的 GitHub Issue 链接。 */
export function buildRegistrationIssueUrl({ repo, login, gistId }) {
  if (!repo || !isGithubLogin(login) || !isGistId(gistId)) return "";
  const body = [
    REGISTRATION_MARKER,
    "",
    "```json",
    JSON.stringify({ login, gistId }, null, 2),
    "```",
    "",
    "打卡排行榜登记：请保持这个 issue 为 open；关闭即从排行榜下架。",
    "（由 XCPC 每日一题自动生成）",
  ].join("\n");
  const params = new URLSearchParams({
    title: `[leaderboard] ${login}`,
    body,
  });
  return `https://github.com/${repo}/issues/new?${params.toString()}`;
}
