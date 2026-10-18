/**
 * 纯日期工具（不依赖 Vue，Node 里可直接测试）。
 *
 * 全站只有一套「今天是哪天」的口径：**北京时间（Asia/Shanghai）**。
 * 每日一题的发布判断、打卡日期、连续天数都走这里，不能一半用浏览器本地时区、
 * 一半用 UTC —— 那样在跨零点的几个小时里，题目和打卡会各算各的。
 *
 * 日期一律用 `YYYY-MM-DD` 字符串在业务层流转，只在需要加减/比较时临时转成
 * UTC 时间戳：用 Date.UTC 而不是 new Date(y, m, d)，后者的「本地时区」在
 * 夏令时地区会出现 23/25 小时的一天，`+1 天` 可能跨过去或停在原地。
 */

export const BEIJING_TZ = "Asia/Shanghai";

export const WEEKDAY_CN = ["日", "一", "二", "三", "四", "五", "六"];

/** 北京时间的今天，`YYYY-MM-DD`。 */
export function todayInBeijing(now = new Date()) {
  // 用 IANA 时区名换算，比手算 +8 偏移可靠：手算在本地时区恰好是 UTC+8
  // 或 UTC+0 时会退化，跨天时可能差一天。
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: BEIJING_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/**
 * 严格解析 `YYYY-MM-DD`。
 * 2026-02-30、2026-13-01 这类「格式对、日子不存在」的输入返回 null。
 * @returns {{y:number,m:number,d:number,date:string}|null}
 */
export function parseDateParts(value) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!m) return null;

  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;

  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) {
    return null;
  }
  return { y, m: mo, d, date: `${m[1]}-${m[2]}-${m[3]}` };
}

export function isDateString(value) {
  return parseDateParts(value) !== null;
}

/** 把 UTC 毫秒时间戳格式化成 `YYYY-MM-DD`。 */
function formatUtcDate(dt) {
  const y = dt.getUTCFullYear();
  const m = String(dt.getUTCMonth() + 1).padStart(2, "0");
  const d = String(dt.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 日期加减天数；非法输入返回空串（调用方按「没有这一天」处理）。 */
export function addDays(dateStr, delta) {
  const p = parseDateParts(dateStr);
  if (!p) return "";
  const n = Number(delta);
  if (!Number.isFinite(n)) return "";
  const dt = new Date(Date.UTC(p.y, p.m - 1, p.d + Math.trunc(n)));
  return formatUtcDate(dt);
}

/** 星期几：0 = 周日 … 6 = 周六。 */
export function weekdayOf(dateStr) {
  const p = parseDateParts(dateStr);
  if (!p) return -1;
  return new Date(Date.UTC(p.y, p.m - 1, p.d)).getUTCDay();
}

/** 所在周的周日（GitHub 热力图的列是「周日到周六」）。 */
export function startOfWeek(dateStr) {
  const w = weekdayOf(dateStr);
  return w < 0 ? "" : addDays(dateStr, -w);
}

/** 两个日期相差的天数（b - a）；非法输入返回 NaN。 */
export function daysBetween(a, b) {
  const pa = parseDateParts(a);
  const pb = parseDateParts(b);
  if (!pa || !pb) return NaN;
  const ta = Date.UTC(pa.y, pa.m - 1, pa.d);
  const tb = Date.UTC(pb.y, pb.m - 1, pb.d);
  return Math.round((tb - ta) / 86400000);
}

/** `2026-10-18` -> `10-18`。 */
export function monthDay(dateStr) {
  const p = parseDateParts(dateStr);
  return p ? `${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : "";
}

/** 中文可读日期：`2026年10月18日 · 周日`。 */
export function formatCnDate(dateStr) {
  const p = parseDateParts(dateStr);
  if (!p) return "";
  const w = weekdayOf(dateStr);
  return `${p.y}年${p.m}月${p.d}日 · 周${WEEKDAY_CN[w]}`;
}

/** 热力图顶部的区间说明：`2025.10.12 – 2026.10.18`。 */
export function formatRange(start, end) {
  const a = parseDateParts(start);
  const b = parseDateParts(end);
  if (!a || !b) return "";
  const left = `${a.y}.${String(a.m).padStart(2, "0")}.${String(a.d).padStart(2, "0")}`;
  const right = `${b.y}.${String(b.m).padStart(2, "0")}.${String(b.d).padStart(2, "0")}`;
  return `${left} – ${right}`;
}
