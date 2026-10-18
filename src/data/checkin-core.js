/**
 * 打卡系统的纯逻辑层：不碰 Vue、不碰 localStorage、不发网络请求。
 *
 * 这样拆是为了能直接在 Node 里跑测试（scripts/test-checkin.mjs）。页面上的
 * 日历、连续天数、Gist 合并都在这里算，组件只负责画。
 *
 * 记录（record）的形状：
 *   {
 *     id:         "uuid",            // 合并时的唯一键
 *     date:       "2026-10-18",      // 打卡日期（北京时间）
 *     problemDate:"2026-10-18",      // 对应哪天的每日一题（打卡从当天题目里选）
 *     title:      "A. Many Many Heads", // 从题目数据快照下来，历史记录不怕题目被改
 *     link:       "https://...",     // 题目链接快照（表单不再手填）
 *     submission: "https://...",     // OJ 提交记录链接（可选）
 *     solution:   "完整题解……",       // 完整题解（旧数据里的 note 会自动迁移）
 *     createdAt:  1792330000000,
 *     updatedAt:  1792330000000
 *   }
 *
 * 多份数据（本机 + Gist）合并靠 updatedAt + 删除墓碑（deleted），
 * 不用「谁后写入算谁的」——两台设备各自离线打卡后再上线，两边的记录都要保住。
 */

import {
  addDays,
  formatRange,
  isDateString,
  parseDateParts,
  startOfWeek,
} from "../utils/date.js";

export const CHECKIN_DOC_VERSION = 1;

export const MAX_RECORDS = 5000;
export const MAX_TITLE = 160;
/** 完整题解可以比原来的「备注」长得多：思路 + 推导 + 复杂度 + 参考代码。 */
export const MAX_SOLUTION = 12000;
export const MAX_URL = 600;

/** Gist 里的文件名：固定，换设备时靠它认出「这是打卡数据」。 */
export const DEFAULT_GIST_FILE = "xcpc-daily-checkins.json";

/** 0 = 没有提交；1~4 是绿格子的四档深度（GitHub 同款）。 */
export function levelOf(count) {
  const n = Number(count) || 0;
  if (n <= 0) return 0;
  if (n === 1) return 1;
  if (n === 2) return 2;
  if (n <= 4) return 3;
  return 4;
}

/** 只接受 http(s)；不合法的一律当没填，避免 `javascript:` 之类的链接进到 <a href>。 */
export function safeHttpUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw || raw.length > MAX_URL) return "";
  try {
    const url = new URL(raw);
    if (url.protocol !== "http:" && url.protocol !== "https:") return "";
    return url.href;
  } catch {
    return "";
  }
}

function oneLine(value, max) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeText(value, max) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
}

function hostOf(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

function makeId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const ID_RE = /^[A-Za-z0-9_-]{1,80}$/;
// 这些键名会碰到 Object 原型链；允许它们进 deleted / records 的 id 没有好处
const RESERVED_IDS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeId(value) {
  const id = String(value || "");
  return ID_RE.test(id) && !RESERVED_IDS.has(id);
}

/** 老数据没有 id 时的确定性兜底：同样的内容每次算出的 id 相同，不会重复合并。 */
function fallbackId(raw, date, createdAt) {
  const seed = `${date}|${createdAt}|${raw.title || ""}|${raw.link || ""}|${raw.submission || ""}|${
    raw.solution ?? raw.note ?? ""
  }`;
  let h = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    h = ((h << 5) + h) ^ seed.charCodeAt(i);
  }
  return `auto-${(h >>> 0).toString(36)}`;
}

/**
 * 把任意来源的一条记录规整成内部形状；没有日期或没有题目信息的返回 null。
 * 这是所有外部数据（localStorage / Gist / 表单）进入系统的唯一入口。
 */
export function normalizeRecord(raw, fallbackNow = Date.now()) {
  if (!raw || typeof raw !== "object") return null;

  const date = isDateString(raw.date) ? String(raw.date).trim() : "";
  if (!date) return null;

  const link = safeHttpUrl(raw.link);
  const title = oneLine(raw.title, MAX_TITLE) || hostOf(link);
  if (!title && !link) return null;

  const submission = safeHttpUrl(raw.submission);
  // 旧版本字段叫 note；新版本叫 solution。优先认新字段，读旧数据时自动迁移。
  const solution = safeText(raw.solution ?? raw.note, MAX_SOLUTION);
  const problemDate = isDateString(raw.problemDate) ? String(raw.problemDate).trim() : "";

  const createdRaw = Number(raw.createdAt);
  const createdOk = Number.isFinite(createdRaw) && createdRaw > 0;
  const createdAt = Math.trunc(createdOk ? createdRaw : fallbackNow);
  const updatedRaw = Number(raw.updatedAt);
  const updatedAt = Math.max(
    createdAt,
    Number.isFinite(updatedRaw) && updatedRaw > 0 ? Math.trunc(updatedRaw) : createdAt
  );

  // 没有 createdAt 的老数据不能把「当前时间」掺进 id，否则每次加载都会生成新 id、
  // 合并时同一条记录会越变越多。时间缺失就按 0 算，id 只由内容决定。
  const id = isSafeId(raw.id)
    ? String(raw.id)
    : fallbackId(raw, date, createdOk ? createdAt : 0);

  return {
    id,
    date,
    problemDate,
    title,
    link,
    submission,
    solution,
    createdAt,
    updatedAt,
  };
}

/** 表单校验：返回逐字段错误，空对象表示通过。 */
export function validateCheckin(input, today) {
  const errors = {};
  const date = String(input?.date || "").trim();
  const problemDate = String(input?.problemDate || "").trim();
  const rawTitle = String(input?.title ?? "").replace(/\s+/g, " ").trim();
  const title = oneLine(input?.title, MAX_TITLE);
  const linkRaw = String(input?.link || "").trim();
  const submissionRaw = String(input?.submission || "").trim();
  const solution = String(input?.solution ?? input?.note ?? "");

  if (!isDateString(date)) errors.date = "请选择打卡日期";
  else if (today && date > today) errors.date = "不能给未来日期打卡";

  if (!isDateString(problemDate)) errors.problemDate = "请选择当天的每日一题";
  else if (today && problemDate > today) errors.problemDate = "不能选择未来的题目";

  if (!title) errors.title = "请选择当天的每日一题";
  else if (rawTitle.length > MAX_TITLE) errors.title = `题目名称最多 ${MAX_TITLE} 个字符`;

  if (linkRaw && !safeHttpUrl(linkRaw)) errors.link = "题目链接格式不合法";
  if (submissionRaw && !safeHttpUrl(submissionRaw)) {
    errors.submission = "提交链接必须是 http(s) 地址";
  }
  if (solution.length > MAX_SOLUTION) {
    errors.solution = `完整题解最多 ${MAX_SOLUTION} 个字符`;
  }

  return errors;
}

/**
 * 新建一条记录。日期/标题由调用方先校验；这里再兜一层（normalizeRecord 会丢弃坏日期）。
 */
export function makeRecord(input, now = Date.now()) {
  const date = isDateString(input?.date) ? input.date : "";
  if (!date) return null;
  return normalizeRecord(
    {
      ...input,
      id: isSafeId(input?.id) ? input.id : makeId(),
      date,
      createdAt: now,
      updatedAt: now,
    },
    now
  );
}

/** 同一天多次提交 = 多个 record；“有提交的天数”按日期去重。 */
export function countByDate(records) {
  const map = new Map();
  for (const r of records || []) {
    if (!isDateString(r?.date)) continue;
    map.set(r.date, (map.get(r.date) || 0) + 1);
  }
  return map;
}

/**
 * 生成 GitHub 风格热力图（列 = 周，行 = 周日到周六）。
 * 固定 53 列 = 371 天：最后一列是本周，今天之后的日子标为 future（不画绿）。
 */
export function buildCalendar(records, today, weeks = 53) {
  const safeToday = isDateString(today) ? today : "";
  const counts = countByDate(records);
  // 120 周（约两年半）已经远超 UI 的 53 周；设上限只是防止配置写错时一次生成几十万个格子
  const span = Math.min(120, Math.max(1, Math.trunc(Number(weeks) || 53)));

  if (!safeToday) {
    return { start: "", end: "", today: "", range: "", weeks: [], activeDays: 0, submissions: 0 };
  }

  const end = addDays(startOfWeek(safeToday), 6);
  const start = addDays(end, -(span * 7 - 1));

  const out = [];
  let previousMonth = -1;
  let activeDays = 0;
  let submissions = 0;

  for (let w = 0; w < span; w += 1) {
    const days = [];
    for (let d = 0; d < 7; d += 1) {
      const date = addDays(start, w * 7 + d);
      const p = parseDateParts(date);
      const count = counts.get(date) || 0;
      const future = date > safeToday;
      if (!future && count > 0) {
        activeDays += 1;
        submissions += count;
      }
      days.push({
        date,
        count,
        level: future ? 0 : levelOf(count),
        future,
        isToday: date === safeToday,
        weekday: d,
        month: p?.m || 0,
        day: p?.d || 0,
      });
    }

    const first = days[0];
    // 月份标签放在「这一列的第一天属于新月份」的那一列；只有跨月才写，
    // 不是每一列都写（否则 53 个「10月」会把图挤爆）。
    const label = first.month !== previousMonth ? `${first.month}月` : "";
    if (first.month !== previousMonth) previousMonth = first.month;

    out.push({ start: first.date, label, days });
  }

  return {
    start,
    end,
    today: safeToday,
    range: formatRange(start, safeToday),
    weeks: out,
    activeDays,
    submissions,
  };
}

/**
 * 连续天数 / 累计统计。
 *
 * 当前连续：今天有记录就从今天往前数；今天还没打卡就从昨天往前数
 * （GitHub 也这么算，不然每天零点一过连续记录就归零了，体验很怪）。
 */
export function computeStats(records, today) {
  const all = (records || []).filter((r) => isDateString(r?.date));
  const counts = countByDate(all);
  const dates = [...counts.keys()].sort();

  let longest = 0;
  let run = 0;
  let prev = "";
  for (const date of dates) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = date;
  }

  let current = 0;
  if (isDateString(today)) {
    let cursor = counts.has(today) ? today : addDays(today, -1);
    while (cursor && counts.has(cursor)) {
      current += 1;
      cursor = addDays(cursor, -1);
    }
  }

  const month = String(today || "").slice(0, 7);
  const thisMonthDays = month ? dates.filter((d) => d.startsWith(month)).length : 0;
  const last30Start = isDateString(today) ? addDays(today, -29) : "";
  const last30Days = last30Start ? dates.filter((d) => d >= last30Start && d <= today).length : 0;

  return {
    total: all.length,
    activeDays: dates.length,
    currentStreak: current,
    longestStreak: longest,
    thisMonthDays,
    last30Days,
    todayCount: isDateString(today) ? counts.get(today) || 0 : 0,
    firstDate: dates[0] || "",
    lastDate: dates[dates.length - 1] || "",
  };
}

export function createEmptyDoc() {
  return { version: CHECKIN_DOC_VERSION, updatedAt: 0, records: [], deleted: {} };
}

function readTombstones(raw) {
  const out = {};
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return out;
  for (const [id, ts] of Object.entries(raw)) {
    const t = Number(ts);
    if (!isSafeId(id) || !Number.isFinite(t) || t <= 0) continue;
    out[id] = Math.trunc(t);
  }
  return out;
}

/**
 * 墓碑只保留 400 天：超过这个窗口的记录本来也不会再从旧设备冒出来，
 * 而无限增长会让这份 json 越来越肥。
 *
 * 注意顺序：必须先用**完整**墓碑过滤记录，再裁剪输出。反过来的话，
 * 一条 400 天前的删除标记会先被裁掉，它删掉的旧记录就会「复活」。
 */
function pruneTombstones(deleted, now) {
  const out = {};
  for (const [id, ts] of Object.entries(deleted)) {
    if (now - ts > 400 * 86400000) continue;
    out[id] = ts;
  }
  return out;
}

/**
 * 把 localStorage / Gist 里的任意形状规整成统一文档。
 * 兼容三种历史形状：数组、`{records:[...]}`、`{checkins:[...]}`。
 */
export function normalizeDoc(raw, now = Date.now()) {
  const empty = createEmptyDoc();
  if (!raw) return empty;

  const list = Array.isArray(raw)
    ? raw
    : Array.isArray(raw.records)
      ? raw.records
      : Array.isArray(raw.checkins)
        ? raw.checkins
        : [];

  const byId = new Map();
  for (const item of list) {
    const record = normalizeRecord(item, now);
    if (!record) continue;
    const exist = byId.get(record.id);
    if (!exist || record.updatedAt > exist.updatedAt) byId.set(record.id, record);
  }

  const allDeleted = readTombstones(raw.deleted);
  let records = [...byId.values()].filter((r) => !(allDeleted[r.id] >= r.updatedAt));
  const deleted = pruneTombstones(allDeleted, now);

  // 极端情况（被塞了超大文件）只保留最近的若干条，避免 Gist 写不进去。
  if (records.length > MAX_RECORDS) {
    records = records
      .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt)
      .slice(-MAX_RECORDS);
  }

  const updatedAt = Number(raw.updatedAt);
  return {
    version: CHECKIN_DOC_VERSION,
    updatedAt: Number.isFinite(updatedAt) && updatedAt > 0 ? Math.trunc(updatedAt) : 0,
    records,
    deleted,
  };
}

/**
 * 合并两份文档（本机 + 云端）。
 *
 * 规则：
 *   1. 同一个 id 取 updatedAt 更大的那份；
 *   2. 删除墓碑比记录新，记录就不复活；
 *   3. 其余记录取并集 —— 两台设备各自离线打卡，联网后两条都在。
 */
export function mergeDocs(localRaw, remoteRaw, now = Date.now()) {
  const local = normalizeDoc(localRaw, now);
  const remote = normalizeDoc(remoteRaw, now);

  const deleted = {};
  for (const src of [remote.deleted, local.deleted]) {
    for (const [id, ts] of Object.entries(src)) {
      deleted[id] = Math.max(deleted[id] || 0, ts);
    }
  }

  const byId = new Map();
  for (const record of [...remote.records, ...local.records]) {
    const exist = byId.get(record.id);
    if (!exist || record.updatedAt > exist.updatedAt) byId.set(record.id, record);
  }

  const records = [...byId.values()]
    .filter((r) => !(deleted[r.id] >= r.updatedAt))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

  return {
    version: CHECKIN_DOC_VERSION,
    updatedAt: Math.max(local.updatedAt, remote.updatedAt),
    records,
    deleted,
  };
}

/**
 * 文档的内容签名（忽略 updatedAt / 排版，只看记录与墓碑）。
 * 用来回答「云端和本机是不是已经一致」，避免每次打开页面都重写一遍 Gist。
 */
export function docSignature(doc) {
  const normalized = normalizeDoc(doc);
  const records = [...normalized.records]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((r) => [
      r.id,
      r.date,
      r.problemDate,
      r.title,
      r.link,
      r.submission,
      r.solution,
      r.createdAt,
      r.updatedAt,
    ]);
  const deleted = Object.entries(normalized.deleted).sort(([a], [b]) => a.localeCompare(b));
  return JSON.stringify({ records, deleted });
}

/** 写进 Gist 的文本：带缩进，出问题时用 GitHub 网页也能直接读。 */
export function serializeDoc(doc) {
  const normalized = normalizeDoc(doc);
  return `${JSON.stringify(
    {
      app: "xcpc-daily",
      version: CHECKIN_DOC_VERSION,
      updatedAt: Date.now(),
      records: normalized.records,
      deleted: normalized.deleted,
    },
    null,
    2
  )}\n`;
}

/** 读 Gist / localStorage 的文本；空文本视为空文档，坏 JSON 抛错由调用方提示。 */
export function parseDoc(text) {
  const raw = String(text ?? "").trim();
  if (!raw) return createEmptyDoc();
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("打卡数据不是合法的 JSON");
  }
  return normalizeDoc(data);
}

/** 文档是否有实际内容（决定要不要写 Gist / 是否显示空状态）。 */
export function docHasData(doc) {
  return Boolean(doc && (doc.records?.length || Object.keys(doc.deleted || {}).length));
}

/** 按日期倒序（同一天最新的在前），列表展示用。 */
export function sortRecordsDesc(records) {
  return [...(records || [])].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
  );
}
