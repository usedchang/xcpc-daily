/** HTML 转义，所有插到 v-html 的内容必须经过它处理。 */
export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c]));
}

/** 题目的发布日（`YYYY-MM-DD`）；拿不到时返回空串。 */
export function problemDate(problem) {
  const d = String(problem?.date || "").trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(d) ? d : "";
}

/** `2026-09-30` -> `20260930`（分享文本里的日期写法）。 */
export function compactDate(dateStr) {
  return String(dateStr || "").replace(/-/g, "");
}

/**
 * `YYYY-MM-DD` 的前一天。
 *
 * 用 UTC 构造再回读，避免夏令时切换日（当地 00:00 可能不存在）导致差一天；
 * 输入不合法时返回空串。
 */
export function previousDate(dateStr) {
  const d = problemDate({ date: dateStr });
  if (!d) return "";
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, day));
  if (Number.isNaN(t.getTime())) return "";
  t.setUTCDate(t.getUTCDate() - 1);
  const pad = (n) => String(n).padStart(2, "0");
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}
