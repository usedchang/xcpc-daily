/**
 * 极简 YAML front matter 解析器。
 *
 * 只支持扁平的 `key: value`（值为字符串 / 数字 / 布尔 / [a, b] 数组），
 * 不引入 js-yaml：投稿模板只用得到 author / date / title 这几个字段，
 * 解析器越简单越不容易出错，也避免为社区功能拉进一个完整的 YAML 依赖。
 */

// 允许文件开头的 BOM；`---` 后到下一个 `---` 之间是元信息，其余是正文。
const FM_RE = /^\uFEFF?---[ \t]*\r?\n([\s\S]*?)\r?\n---[ \t]*(?:\r?\n|$)/;

function stripQuotes(s) {
  const t = s.trim();
  const first = t[0];
  const last = t[t.length - 1];
  if (t.length >= 2 && ((first === '"' && last === '"') || (first === "'" && last === "'"))) {
    return t.slice(1, -1);
  }
  return t;
}

function coerce(raw) {
  const t = String(raw).trim();
  if (t.startsWith("[") && t.endsWith("]")) {
    const inner = t.slice(1, -1).trim();
    if (!inner) return [];
    return inner.split(",").map((x) => stripQuotes(x)).filter((x) => x !== "");
  }
  if (t === "true") return true;
  if (t === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return stripQuotes(t);
}

/**
 * 拆出 front matter 与正文。
 * @returns {{ data: Record<string, unknown>, body: string }}
 *   没有 front matter 时 data 为空对象、body 为原文。
 */
export function parseFrontMatter(raw) {
  const text = String(raw ?? "");
  const m = FM_RE.exec(text);
  if (!m) return { data: {}, body: text };

  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    const s = line.trim();
    if (!s || s.startsWith("#")) continue;
    const i = s.indexOf(":");
    if (i <= 0) continue;
    const key = s.slice(0, i).trim();
    if (!key) continue;
    data[key] = coerce(s.slice(i + 1));
  }
  return { data, body: text.slice(m[0].length) };
}
