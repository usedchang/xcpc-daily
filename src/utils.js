/**
 * 题目列表用到的小工具。
 *
 * 这里曾经有个 `esc()`（HTML 转义）给 v-html 拼字符串用：难度/标签徽章原本是拼成
 * HTML 再塞进 v-html 的，现在改成普通模板渲染，转义交给 Vue，函数随之删掉。
 */

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
 * 取题目链接的站点名（`qoj.ac` / `codeforces.com` / `www.luogu.com.cn`）。
 *
 * 列表里不再单独占一列打印完整 URL（它和题名指向同一个地址，纯属重复），
 * 改成在来源下方标一个站点名：一眼能看出这题在哪个 OJ，又不占宽度。
 */
export function linkHost(link) {
  try {
    return new URL(String(link)).host.replace(/^www\./, "");
  } catch {
    return "";
  }
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
