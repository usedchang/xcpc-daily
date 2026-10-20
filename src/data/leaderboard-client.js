/**
 * 排行榜的浏览器端加载层。
 *
 * 成员来源 = 静态 registry + 仓库里的登记 Issue（open 才有效）。
 * 每个成员指向一个 public Gist，里面只有统计快照。
 *
 * 缓存策略：
 *   - localStorage 缓存 10 分钟，避免每次进页面都打 GitHub API；
 *   - 未登录时 GitHub API 是 60 次/小时，成员多时会不够用；
 *     已登录用户会用 token（5000 次/小时）拉取公开 Gist。
 *
 * 这里故意不做任何写操作：排行榜只读。
 */

import { getPublicGist, gistFileContent } from "../auth/github.js";
import { CHECKIN } from "../config/checkin.js";
import { safeStorage } from "../utils/storage.js";
import {
  mergeRegistrations,
  normalizeRegistry,
  normalizeSnapshot,
  parseRegistrationIssue,
  rankLeaderboard,
} from "./leaderboard-core.js";

const CACHE_KEY = "xcpc-leaderboard-cache-v1";

function readCache() {
  const storage = safeStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || !Array.isArray(data.entries)) return null;
    if (!Number.isFinite(data.at)) return null;
    if (Date.now() - data.at > CHECKIN.leaderboard.cacheMs) return null;
    return data;
  } catch {
    return null;
  }
}

function writeCache(entries, failed) {
  const storage = safeStorage();
  if (!storage) return;
  try {
    storage.setItem(
      CACHE_KEY,
      JSON.stringify({ at: Date.now(), entries, failed: Array.isArray(failed) ? failed : [] })
    );
  } catch {
    // 配额满时只走内存/网络
  }
}

async function loadStaticRegistry() {
  try {
    const res = await fetch(CHECKIN.leaderboard.registryUrl, { cache: "no-store" });
    if (!res.ok) {
      if (res.status === 404) return [];
      throw new Error(`registry HTTP ${res.status}`);
    }
    return normalizeRegistry(await res.json());
  } catch (err) {
    if (err?.message?.includes("404")) return [];
    throw err;
  }
}

/** 拉仓库里带登记 marker 的 open issue（最多 3 页，够小社区用）。 */
async function loadIssueRegistrations(token) {
  const repo = String(CHECKIN.leaderboard.repo || "");
  if (!repo.includes("/")) return [];

  const headers = { Accept: "application/vnd.github+json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const out = [];
  for (let page = 1; page <= 3; page += 1) {
    const url = `https://api.github.com/repos/${repo}/issues?state=open&per_page=100&page=${page}`;
    let res;
    try {
      res = await fetch(url, { headers, cache: "no-store" });
    } catch {
      throw new Error("无法连接 GitHub Issues API");
    }
    if (!res.ok) {
      if ((res.status === 401 || res.status === 403) && token) {
        return loadIssueRegistrations("");
      }
      if (res.status === 403 || res.status === 429) {
        throw new Error("GitHub API 速率限制，请稍后再试，或登录后查看排行榜");
      }
      throw new Error(`GitHub Issues API HTTP ${res.status}`);
    }
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;
    for (const issue of data) {
      const entry = parseRegistrationIssue(issue);
      if (entry) out.push(entry);
    }
    if (data.length < 100) break;
  }
  return out;
}

async function loadSnapshot(member, token) {
  try {
    const gist = await getPublicGist(member.gistId, token);
    const content = gistFileContent(gist, CHECKIN.leaderboard.snapshotFile);
    if (content == null) return { error: "快照文件为空" };
    try {
      // 主动下架的用户：快照会被标成 inactive，排行榜静默忽略，不显示为失败
      if (JSON.parse(content)?.inactive === true) return { ignored: true };
    } catch {
      // 交给下面的 normalizeSnapshot 报格式错误
    }
    const snapshot = normalizeSnapshot(content, member.login);
    if (!snapshot) return { error: "快照格式不合法或登录名不匹配" };
    return { entry: { ...snapshot, gistId: member.gistId } };
  } catch (err) {
    // token 过期/权限不足时别把整个排行榜判死：公开 Gist 匿名也能读，退回匿名再试一次
    if (token && (err?.status === 401 || err?.status === 403)) {
      return loadSnapshot(member, "");
    }
    return { error: err?.status === 404 ? "Gist 不存在或不是公开的" : err?.message || "加载失败" };
  }
}

async function loadAllSnapshots(members, token) {
  const entries = [];
  const failed = [];
  let cursor = 0;

  async function worker() {
    while (cursor < members.length) {
      const index = cursor;
      cursor += 1;
      const member = members[index];
      const result = await loadSnapshot(member, token);
      if (result.entry) entries.push(result.entry);
      else if (!result.ignored) {
        failed.push({ login: member.login, error: result.error || "加载失败" });
      }
    }
  }

  const workers = Array.from({ length: Math.min(4, members.length) }, () => worker());
  await Promise.all(workers);
  return { entries, failed };
}

/**
 * 加载并排序排行榜。
 * @param {{token?:string, force?:boolean}} options
 * @returns {Promise<{entries:Array, at:number, fromCache:boolean, failed:Array, errors:string[]}>}
 */
export async function loadLeaderboard({ token = "", force = false } = {}) {
  if (!CHECKIN.leaderboard.enabled) {
    return { entries: [], at: 0, fromCache: false, failed: [], errors: [] };
  }

  if (!force) {
    const cached = readCache();
    if (cached) {
      return {
        entries: rankLeaderboard(cached.entries),
        at: cached.at,
        fromCache: true,
        failed: cached.failed || [],
        errors: [],
      };
    }
  }

  const errors = [];
  let registry = [];
  let issues = [];

  const [registryResult, issueResult] = await Promise.allSettled([
    loadStaticRegistry(),
    loadIssueRegistrations(token),
  ]);

  if (registryResult.status === "fulfilled") registry = registryResult.value;
  else errors.push(`成员表加载失败：${registryResult.reason?.message || registryResult.reason}`);

  if (issueResult.status === "fulfilled") issues = issueResult.value;
  else errors.push(`Issue 登记加载失败：${issueResult.reason?.message || issueResult.reason}`);

  const members = mergeRegistrations(registry, issues).slice(
    0,
    Math.max(1, Number(CHECKIN.leaderboard.maxParticipants) || 100)
  );

  if (!members.length) {
    const at = Date.now();
    // 网络/API 出错时不缓存空结果，否则 10 分钟内都看不到新上榜的人
    if (!errors.length) writeCache([], []);
    return { entries: [], at, fromCache: false, failed: [], errors };
  }

  const { entries, failed } = await loadAllSnapshots(members, token);
  const ranked = rankLeaderboard(entries);
  const at = Date.now();
  writeCache(ranked, failed);
  return { entries: ranked, at, fromCache: false, failed, errors };
}

export function clearLeaderboardCache() {
  try {
    safeStorage()?.removeItem(CACHE_KEY);
  } catch {
    // 忽略
  }
}
