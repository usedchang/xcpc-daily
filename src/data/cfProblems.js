/**
 * Codeforces 题库数据层：拉取、缓存、筛选。
 *
 * 数据来源是官方公开 API（CORS 为 `*`，纯前端可以直接调）：
 *   GET https://codeforces.com/api/problemset.problems
 *   -> { status: "OK", result: { problems: [ { contestId, index, name, rating, tags } ] } }
 * 实测 1.1 万题、原始 JSON 约 1.7 MB，所以：
 *   - 只在用户真的点了「随机一题」时才请求，不拖慢首页首屏；
 *   - 拉回来压成紧凑数组塞进 localStorage（约 500 KB），下次打开秒进。
 *
 * 与 `cfRandom.js` 同样保持「零依赖、零 DOM」：Node 测试脚本要直接 import 本文件，
 * 所以 localStorage 也是能缺就缺（storage 参数可注入，见 loadProblemSet）。
 */
import { problemKey } from "./cfRandom.js";

export const CF_PROBLEMS_API = "https://codeforces.com/api/problemset.problems";
export const CF_PROBLEM_BASE = "https://codeforces.com/problemset/problem";

/** 缓存键与版本：编码格式一变就升版本，旧缓存自然失效。 */
const CACHE_KEY = "xcpc-cf-problemset-v1";
/** 缓存有效期 24h：新题一周才加一场，但 rating 会随比赛结算变动。 */
const CACHE_TTL = 24 * 60 * 60 * 1000;

/** Codeforces 的分数区间（实测题库最小值/最大值，作为滑杆的初始范围）。 */
export const RATING_FLOOR = 800;
export const RATING_CEIL = 3500;
export const RATING_STEP = 100;

/**
 * 题目页地址。
 *
 * 普通比赛走 `/problemset/problem/...`；gym 在 Codeforces 上是另一条路径
 * （`/gym/<id>/problem/<index>`），用错路径会 404。题库 API 目前只返回非 gym 题目
 * （实测 contestId 全部 < 100000，gym 从 100000 起编号），但站内确实收录过 gym 题，
 * 留着这个分支以后不会踩坑。
 */
export function problemUrl(p) {
  if (!p || p.contestId == null || p.index == null) return "";
  if (p.contestId >= 100000) {
    return `https://codeforces.com/gym/${p.contestId}/problem/${p.index}`;
  }
  return `${CF_PROBLEM_BASE}/${p.contestId}/${p.index}`;
}

/**
 * 从站内任意链接里认出「这是哪道 CF 题」，返回与 problemKey 同格式的 key。
 *
 * 覆盖三种 Codeforces 链接写法（题解文件、data/*.json 里的 link 字段都出现过）：
 *   /problemset/problem/2269/B、/contest/2269/problem/B、/gym/100000/problem/A
 * 认不出来（Luogu / QOJ / 本地题）返回空串。
 */
export function cfKeyFromLink(link) {
  const m = /\/(?:problemset\/problem|contest|gym)\/(\d+)\/(?:problem\/)?([A-Za-z]\d*)\b/.exec(
    String(link || "")
  );
  return m ? `${m[1]}${m[2].toUpperCase()}` : "";
}

/** 把 API 返回的原始题目列表规整成内部结构（丢掉不认识的字段，rating 缺失记 null）。 */
export function normalizeProblems(rawList) {
  if (!Array.isArray(rawList)) return [];
  const out = [];
  for (const raw of rawList) {
    if (!raw || raw.contestId == null || raw.index == null || !raw.name) continue;
    out.push({
      contestId: raw.contestId,
      index: String(raw.index),
      name: String(raw.name),
      rating: typeof raw.rating === "number" ? raw.rating : null,
      tags: Array.isArray(raw.tags) ? raw.tags.filter((t) => typeof t === "string" && t) : [],
    });
  }
  return out;
}

/** 给每道题补上 `key`（`<contestId><index>`），供列表 :key 与站内匹配使用。 */
function withKeys(problems) {
  return problems.map((p) => ({ ...p, key: problemKey(p) }));
}

/** 出现过的全部标签 + 题量，按题量倒序（和站内 TagFilter 的数据形状一致）。 */
export function collectTags(problems) {
  const count = new Map();
  for (const p of problems) {
    for (const t of p.tags) count.set(t, (count.get(t) || 0) + 1);
  }
  return [...count.entries()]
    .map(([name, n]) => ({ name, count: n }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
}

/** 有 rating 的题目所占的分数区间；题库为空时退回 CF 的固定范围。 */
export function ratingBounds(problems) {
  let min = Infinity;
  let max = -Infinity;
  for (const p of problems) {
    if (typeof p.rating !== "number") continue;
    if (p.rating < min) min = p.rating;
    if (p.rating > max) max = p.rating;
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: RATING_FLOOR, max: RATING_CEIL };
  }
  return { min, max };
}

/**
 * 按「标签多选 + 分数区间」筛出候选池。
 *
 * 标签语义可选（对应 CF 题库页的两种用法）：
 *   - `all`（默认）：所选标签必须**全部**命中 —— 「我要一道又贪心又二分的题」
 *   - `any`：命中**任一**即可 —— 「贪心或二分都行」
 * 未评级题目（题库里 273 道，没有 rating 字段）默认排除：区间滑杆对它无意义，
 * 混进来会让「按分数随机」名不副实；想抽它们得显式勾选 includeUnrated。
 */
export function filterProblems(problems, options = {}) {
  const tags = Array.isArray(options.tags) ? options.tags : [];
  const mode = options.tagMode === "any" ? "any" : "all";
  const min = typeof options.minRating === "number" ? options.minRating : null;
  const max = typeof options.maxRating === "number" ? options.maxRating : null;
  const includeUnrated = Boolean(options.includeUnrated);
  const list = Array.isArray(problems) ? problems : [];

  if (!tags.length && min == null && max == null && includeUnrated) return list.slice();

  return list.filter((p) => {
    if (typeof p.rating === "number") {
      if (min != null && p.rating < min) return false;
      if (max != null && p.rating > max) return false;
    } else if (!includeUnrated) {
      return false;
    }

    if (tags.length) {
      const own = p.tags || [];
      if (mode === "all") {
        if (!tags.every((t) => own.includes(t))) return false;
      } else if (!tags.some((t) => own.includes(t))) {
        return false;
      }
    }
    return true;
  });
}

/* ------------------------------------------------------------------ *
 * 本地缓存：紧凑编码
 * 原始结构 1.7 MB 塞不进 localStorage（多数浏览器上限 5 MB，且是字符串计长）。
 * 压成「标签字典 + 数组行」后约 500 KB：标签只存下标，字段名全省掉。
 * ------------------------------------------------------------------ */

/** 题目数组 -> 可 JSON 化的紧凑结构。 */
export function encodeCache(problems) {
  const dict = [];
  const tagIndex = new Map();
  const rows = problems.map((p) => {
    const idx = [];
    for (const t of p.tags) {
      let i = tagIndex.get(t);
      if (i === undefined) {
        i = dict.length;
        dict.push(t);
        tagIndex.set(t, i);
      }
      idx.push(i);
    }
    return [p.contestId, p.index, p.name, p.rating, idx];
  });
  return { v: 1, tags: dict, rows };
}

/** 紧凑结构 -> 题目数组；结构不合法时返回 null（调用方当作没有缓存）。 */
export function decodeCache(data) {
  if (!data || data.v !== 1 || !Array.isArray(data.tags) || !Array.isArray(data.rows)) return null;
  const dict = data.tags;
  const out = [];
  for (const row of data.rows) {
    if (!Array.isArray(row) || row.length < 5) continue;
    const [contestId, index, name, rating, tagIdx] = row;
    if (contestId == null || index == null || !name) continue;
    const tags = [];
    for (const i of Array.isArray(tagIdx) ? tagIdx : []) {
      const t = dict[i];
      if (typeof t === "string") tags.push(t);
    }
    out.push({
      contestId,
      index: String(index),
      name: String(name),
      rating: typeof rating === "number" ? rating : null,
      tags,
    });
  }
  return out.length ? out : null;
}

/** 拿到可用的 localStorage；隐私模式 / Node 环境下返回 null。 */
export function safeStorage() {
  try {
    const s = globalThis.localStorage;
    if (!s) return null;
    // Safari 隐私模式下 localStorage 存在但写入即抛，这里先探一次
    const probe = "__xcpc_probe__";
    s.setItem(probe, "1");
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

/** 读缓存；过期 / 损坏 / 不可用都返回 null。 */
export function readCache(storage = safeStorage(), now = Date.now()) {
  if (!storage) return null;
  try {
    const raw = storage.getItem(CACHE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data?.t !== "number" || now - data.t > CACHE_TTL) return null;
    const problems = decodeCache(data.d);
    if (!problems) return null;
    return { problems: withKeys(problems), fetchedAt: data.t };
  } catch {
    return null;
  }
}

/**
 * 写缓存。失败一律静默：配额满（QuotaExceededError）、隐私模式都不该影响抽题，
 * 大不了下次重新拉一遍。
 */
export function writeCache(problems, storage = safeStorage(), now = Date.now()) {
  if (!storage) return false;
  try {
    storage.setItem(CACHE_KEY, JSON.stringify({ t: now, d: encodeCache(problems) }));
    return true;
  } catch {
    try {
      storage.removeItem(CACHE_KEY);
    } catch {
      /* 清不掉就算了 */
    }
    return false;
  }
}

/**
 * 取题库：优先缓存，否则打 API 并回写缓存。
 *
 * @param {object}   [opts]
 * @param {Function} [opts.fetchImpl] 注入 fetch（测试用）
 * @param {object}   [opts.storage]  注入存储；传 null 表示禁用缓存
 * @param {boolean}  [opts.force]    true = 忽略缓存强制刷新
 * @returns {Promise<{problems: Array, fromCache: boolean, fetchedAt: number}>}
 */
export async function loadProblemSet(opts = {}) {
  const fetchImpl = opts.fetchImpl || globalThis.fetch;
  const storage = opts.storage === undefined ? safeStorage() : opts.storage;

  if (!opts.force) {
    const cached = readCache(storage);
    if (cached) return { ...cached, fromCache: true };
  }

  if (typeof fetchImpl !== "function") {
    throw new Error("当前环境不支持 fetch，无法加载 Codeforces 题库");
  }

  let res;
  try {
    // no-store：CF 的响应本身不带强缓存，但中间层可能缓存，刷新时希望拿到最新题库
    res = await fetchImpl(CF_PROBLEMS_API, { cache: "no-store" });
  } catch (err) {
    throw new Error(`无法连接 codeforces.com（${err?.message || "网络错误"}）`);
  }
  if (!res || !res.ok) throw new Error(`Codeforces API 返回 HTTP ${res ? res.status : "?"}`);

  let json;
  try {
    json = await res.json();
  } catch {
    throw new Error("Codeforces API 返回的不是合法 JSON");
  }
  if (json?.status !== "OK") {
    throw new Error(`Codeforces API 报错：${json?.comment || json?.status || "未知原因"}`);
  }

  const problems = normalizeProblems(json?.result?.problems);
  if (!problems.length) throw new Error("Codeforces API 没有返回任何题目");

  writeCache(problems, storage);
  return { problems: withKeys(problems), fromCache: false, fetchedAt: Date.now() };
}
