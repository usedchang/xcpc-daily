/**
 * 题解加载层。
 *
 * 约定：题解 markdown 放在根目录 `solutions/` 下，文件名默认与题目 `date` 相同
 * （例如 `solutions/2026-09-08.md`），也可以在 data.json 的题目里用
 * `"solution": "2026-09-08-xor-is-add.md"` 显式指定文件名（不带路径，可省略 .md）。
 *
 * 以 `_` 开头或名为 `README` 的 md 会被忽略，可用于放模板/说明文件。
 *
 * dev / build 时用 import.meta.glob 把所有 md 内联进产物；
 * 同时保留 fetch 回退：build 后仍然可以往部署目录的 `solutions/` 里
 * 新放/覆盖 md，页面运行时也能读取（与 data.json 的旧工作流一致）。
 */
const mdModules = import.meta.glob("../../solutions/*.md", {
  query: "?raw",
  import: "default",
});

function normalizeKey(key) {
  const base = String(key).split("/").pop() || "";
  return base.replace(/\.md$/i, "").toLowerCase();
}

function isIgnored(name) {
  return !name || name === "readme" || name.startsWith("_");
}

const bundledNames = Object.keys(mdModules)
  .map(normalizeKey)
  .filter((n) => !isIgnored(n));

/** 题目对应的题解文件名（不含目录、不含 .md 后缀）。 */
export function solutionFileName(problem) {
  const explicit = String(problem?.solution || "").trim();
  if (explicit) {
    const base = explicit.split("/").pop() || explicit;
    return base.replace(/\.md$/i, "");
  }
  return String(problem?.date || "");
}

/** 该题是否配置了题解（显式指定、有 hint、或存在日期同名 md）。 */
export function hasEditorial(problem) {
  if (!problem) return false;
  if (problem.solution) return true;
  if (Array.isArray(problem.hints) && problem.hints.length > 0) return true;
  const name = solutionFileName(problem).toLowerCase();
  return bundledNames.includes(name);
}

const textCache = new Map();

/**
 * 加载并返回题解的原始 markdown 文本；没有题解时返回 null。
 * 加载失败不会抛异常，返回 null 由组件展示占位信息。
 */
export async function loadSolutionText(problem) {
  const name = solutionFileName(problem).toLowerCase();
  if (isIgnored(name)) return null;
  if (textCache.has(name)) return textCache.get(name);

  const entry = Object.entries(mdModules).find(
    ([key]) => normalizeKey(key) === name
  );

  let text = null;
  if (entry) {
    try {
      text = await entry[1]();
    } catch (err) {
      console.warn("加载内联题解失败", name, err);
    }
  } else {
    // 回退：运行时读取部署目录的 solutions/<name>.md
    try {
      const res = await fetch(`./solutions/${name}.md`);
      if (res.ok) text = await res.text();
    } catch (err) {
      console.warn("fetch 题解失败", name, err);
    }
  }

  if (text != null) textCache.set(name, text);
  return text;
}
