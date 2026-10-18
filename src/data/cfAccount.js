/**
 * Codeforces 账号绑定：校验 handle、读取已 AC 题目、本地持久化。
 *
 * 只用于「随机一题」的过滤：绑定后从候选池里剔除该账号已经 AC 的题。
 * 不涉及 Codeforces 登录，也不验证这个 handle 真的属于当前用户 ——
 * 它就是本机的一个过滤偏好，填别人的 handle 只会让你少抽到别人做过的题。
 *
 * Codeforces API 的公开限制是 1 次 / 2 秒，所以请求串行化并保留间隔；
 * user.status 单页最多取 2000 条（10000 条会明显变慢），一页页翻到没有更多为止。
 */

import { problemKey } from "./cfRandom.js";
import { safeStorage } from "./cfProblems.js";

export const CF_API_BASE = "https://codeforces.com/api";
export const CF_PROFILE_BASE = "https://codeforces.com/profile";
export const CF_STATUS_PAGE = 2000;
export const CF_STATUS_MAX_PAGES = 10;
export const CF_BINDING_KEY_PREFIX = "xcpc-cf-binding-v1:";
export const CF_SOLVED_TTL = 6 * 60 * 60 * 1000;

const HANDLE_RE = /^[A-Za-z0-9_.-]{1,24}$/;

let lastRequestAt = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 去掉 @、首尾空格；不合法返回空串。 */
export function normalizeCfHandle(value) {
  const handle = String(value ?? "").trim().replace(/^@+/, "");
  return HANDLE_RE.test(handle) ? handle : "";
}

async function waitForSlot(minInterval) {
  if (!minInterval) return;
  const wait = Math.max(0, minInterval - (Date.now() - lastRequestAt));
  if (wait > 0) await sleep(wait);
  lastRequestAt = Date.now();
}

async function cfRequest(url, { fetchImpl, minInterval = 2100 } = {}) {
  const impl = fetchImpl || globalThis.fetch;
  if (typeof impl !== "function") throw new Error("当前环境不支持网络请求");

  await waitForSlot(minInterval);
  let res;
  try {
    res = await impl(url, { cache: "no-store" });
  } catch (err) {
    throw new Error(`无法连接 Codeforces（${err?.message || "网络错误"}）`);
  }
  if (!res || !res.ok) throw new Error(`Codeforces API 返回 HTTP ${res ? res.status : "?"}`);

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("Codeforces API 返回的不是合法 JSON");
  }
  if (json?.status !== "OK") {
    throw new Error(json?.comment || "Codeforces API 报错");
  }
  return json.result;
}

/** 查询用户资料，顺便验证 handle 是否存在。 */
export async function fetchCfUser(handle, opts = {}) {
  const clean = normalizeCfHandle(handle);
  if (!clean) throw new Error("Codeforces handle 格式不合法");

  const result = await cfRequest(
    `${CF_API_BASE}/user.info?handles=${encodeURIComponent(clean)}`,
    opts
  );
  const user = Array.isArray(result) ? result[0] : null;
  if (!user || !user.handle) throw new Error("Codeforces 上没有这个用户");

  return {
    handle: String(user.handle),
    rating: typeof user.rating === "number" ? user.rating : null,
    maxRating: typeof user.maxRating === "number" ? user.maxRating : null,
    rank: String(user.rank || ""),
    avatar: /^https:\/\//i.test(String(user.avatar || "")) ? String(user.avatar) : "",
  };
}

/**
 * 拉取用户全部提交，提取 AC 题目的 key（`<contestId><index>`）。
 * 分页请求，页间自动等 2 秒；onProgress 用来更新「已读取 N 条」。
 *
 * @returns {Promise<{keys:string[], submissions:number, pages:number}>}
 */
export async function fetchCfSolved(handle, opts = {}) {
  const clean = normalizeCfHandle(handle);
  if (!clean) throw new Error("Codeforces handle 格式不合法");

  const pageSize = Math.max(1, Math.min(10000, Number(opts.pageSize) || CF_STATUS_PAGE));
  const maxPages = Math.max(1, Number(opts.maxPages) || CF_STATUS_MAX_PAGES);
  const fetchImpl = opts.fetchImpl;
  const minInterval = opts.minInterval === undefined ? 2100 : opts.minInterval;
  const onProgress = typeof opts.onProgress === "function" ? opts.onProgress : null;

  const keys = new Set();
  let submissions = 0;
  let pages = 0;

  for (let page = 0; page < maxPages; page += 1) {
    const from = page * pageSize + 1;
    const url =
      `${CF_API_BASE}/user.status?handle=${encodeURIComponent(clean)}` +
      `&from=${from}&count=${pageSize}`;
    const result = await cfRequest(url, { fetchImpl, minInterval });
    const list = Array.isArray(result) ? result : [];
    pages += 1;

    for (const submission of list) {
      submissions += 1;
      if (submission?.verdict !== "OK") continue;
      const problem = submission?.problem;
      const key = problemKey({
        contestId: problem?.contestId,
        index: problem?.index,
      });
      if (key) keys.add(key);
    }

    onProgress?.({ pages, submissions, solved: keys.size });
    if (list.length < pageSize) break;
  }

  return { keys: [...keys], submissions, pages };
}

/* ------------------------------------------------------------------ *
 * 本地绑定与 AC 列表缓存
 * ------------------------------------------------------------------ */

export function bindingStorageKey(account) {
  return `${CF_BINDING_KEY_PREFIX}${account || "guest"}`;
}

function normalizeKeys(raw) {
  if (!Array.isArray(raw)) return [];
  const out = [];
  const seen = new Set();
  for (const item of raw) {
    const key = String(item || "").trim().toUpperCase();
    if (!/^[A-Za-z0-9]+$/.test(key) || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
    if (out.length >= 30000) break;
  }
  return out;
}

export function normalizeBinding(raw) {
  if (!raw || typeof raw !== "object") return null;
  const handle = normalizeCfHandle(raw.handle);
  if (!handle) return null;
  return {
    handle,
    rating: typeof raw.rating === "number" ? raw.rating : null,
    maxRating: typeof raw.maxRating === "number" ? raw.maxRating : null,
    rank: String(raw.rank || ""),
    avatar: /^https:\/\//i.test(String(raw.avatar || "")) ? String(raw.avatar) : "",
    solvedKeys: normalizeKeys(raw.solvedKeys),
    solvedAt: Number(raw.solvedAt) || 0,
    savedAt: Number(raw.savedAt) || 0,
  };
}

export function readCfBinding(account, storage = safeStorage()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(bindingStorageKey(account));
    if (!raw) return null;
    return normalizeBinding(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function writeCfBinding(account, binding, storage = safeStorage()) {
  if (!storage) return false;
  const normalized = normalizeBinding({ ...binding, savedAt: Date.now() });
  if (!normalized) return false;
  try {
    storage.setItem(bindingStorageKey(account), JSON.stringify(normalized));
    return true;
  } catch {
    // 配额满：绑定仍留在内存里，只是刷新后要重新绑定
    return false;
  }
}

export function clearCfBinding(account, storage = safeStorage()) {
  if (!storage) return;
  try {
    storage.removeItem(bindingStorageKey(account));
  } catch {
    // 忽略
  }
}

/** 判断 AC 缓存是否过期（过期仍可用，只是界面上提示可刷新）。 */
export function isCfSolvedStale(binding, now = Date.now()) {
  return !binding?.solvedAt || now - binding.solvedAt > CF_SOLVED_TTL;
}
