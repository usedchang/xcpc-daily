/**
 * 题解加载层（按月分目录版）。
 *
 * 目录约定：题解 markdown 与标程 cpp 放在 `solutions/<YYYY-MM>/` 下，同一个月的放在一起，
 * 文件名默认与题目 `date` 相同（例如 `solutions/2026-09/2026-09-08.md`，
 * 配套标程 `solutions/2026-09/2026-09-08.cpp`）。
 *
 *   - 也可以在 data.json 的题目里用 `"solution": "2026-09-08-xor-is-add.md"` 显式指定文件名
 *     （只写文件名，目录由 date 的月份决定；`.md` 可省略）。
 *   - 以 `_` 开头或名为 `README` 的 md 会被忽略，可用于放模板/说明文件。
 *   - 兼容历史布局：直接放在 `solutions/` 根下的 `2026-09-08.md` 也能被找到（旧文件名与新文件名一致）。
 *
 * 查找顺序：`solutions/<date 的月份>/<name>.md` → `solutions/<name>.md`（旧布局）。
 *
 * dev / build 时用 import.meta.glob 把所有 md 内联进产物；
 * 同时保留 fetch 回退：build 后仍然可以往部署目录的 `solutions/<月份>/` 里
 * 新放/覆盖 md，页面运行时也能读取（与按月 json 的旧工作流一致）。
 */
// 只认「一层的月份目录」：`solutions/community/` 这类特殊目录由 splitKey 过滤掉。
// 排除 solutions/index.json：它是给运行时 fetch 用的清单，不是题解（负向模式见 problems.js 的说明）。
const mdModules = import.meta.glob(["../../solutions/*/*.md", "!../../solutions/index.json"], {
  query: "?raw",
  import: "default",
});

/** 允许的月份目录名：四位年-两位月。只认这种目录，避免把 community/ 等特殊目录混进来。 */
const MONTH_DIR_RE = /^(\d{4})-(\d{2})$/;

/** `../../solutions/2026-09/2026-09-08.md` -> { month, name }（month 为空表示旧布局/不认的目录）。 */
function splitKey(key) {
  const parts = String(key).split("/");
  const base = parts.pop() || "";
  const dir = parts.pop() || "";
  const name = base.replace(/\.md$/i, "").toLowerCase();
  return { month: MONTH_DIR_RE.test(dir) ? dir : "", name };
}

function isIgnored(name) {
  return !name || name === "readme" || name.startsWith("_");
}

/** 已内联的题解：`month/name` 与 `name` 两种键都能查到 glob key。 */
const bundledByMonth = new Map();
const bundledFlat = new Map();

for (const key of Object.keys(mdModules)) {
  const { month, name } = splitKey(key);
  if (isIgnored(name) || !name) continue;
  if (month) {
    const mapKey = `${month}/${name}`;
    if (!bundledByMonth.has(mapKey)) bundledByMonth.set(mapKey, key);
  } else if (!bundledFlat.has(name)) {
    bundledFlat.set(name, key);
  }
}

/** 题目对应的题解文件名（不含目录、不含 .md 后缀）。 */
export function solutionFileName(problem) {
  const explicit = String(problem?.solution || "").trim();
  if (explicit) {
    const base = explicit.split("/").pop() || explicit;
    return base.replace(/\.md$/i, "");
  }
  return String(problem?.date || "");
}

/** 题解所在的月份目录：优先按 `date` 的月份，其次（date 缺失时）按文件名前缀。 */
export function solutionMonth(problem) {
  const m = /^(\d{4}-\d{2})/.exec(String(problem?.date || "").trim());
  if (m) return m[1];
  const n = /^(\d{4}-\d{2})/.exec(solutionFileName(problem));
  return n ? n[1] : "";
}

/** 题解在仓库里的路径（用于界面提示，例如 `solutions/2026-09/2026-09-08.md`）。 */
export function solutionPath(problem, ext = "md") {
  const month = solutionMonth(problem);
  const name = solutionFileName(problem) || "YYYY-MM-DD";
  return month ? `solutions/${month}/${name}.${ext}` : `solutions/${name}.${ext}`;
}

/** 该题是否配置了题解（显式指定、有 hint、或存在同月/旧布局的同名 md）。 */
export function hasEditorial(problem) {
  if (!problem) return false;
  if (problem.solution) return true;
  if (Array.isArray(problem.hints) && problem.hints.length > 0) return true;
  const name = solutionFileName(problem).toLowerCase();
  if (isIgnored(name)) return false;
  const month = solutionMonth(problem);
  if (month && bundledByMonth.has(`${month}/${name}`)) return true;
  return bundledFlat.has(name);
}

const textCache = new Map();

/**
 * 判断拿到的响应是不是「一整个 HTML 页面」而不是题解正文。
 *
 * 为什么需要这道防线：dev server（以及部分静态托管）对不存在的路径会回退返回
 * `index.html`，状态码还是 200。若直接把这段文本当题解渲染，整页 HTML 就会出现在弹窗里。
 * 正规题解是 Markdown，不会以 `<!doctype` / `<html` 开头（正文里出现 HTML 标签没问题）。
 */
function looksLikeHtmlPage(text, contentType = "") {
  if (/^\s*text\/html/i.test(String(contentType))) return true;
  const head = String(text || "").replace(/^\uFEFF/, "").trimStart().slice(0, 80).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

/**
 * 部署目录里真实存在的题解清单（`solutions/index.json`，构建时生成）。
 * 拿到清单后就只 fetch 清单里有的文件，从根上避开 SPA 回退；
 * 清单本身 404（很老的部署）时返回 null，调用方按旧行为处理。
 */
let solutionIndexPromise = null;
function loadSolutionIndex() {
  if (!solutionIndexPromise) {
    solutionIndexPromise = (async () => {
      try {
        // no-store：GitHub Pages 对这些 json 是 max-age=600，缓存住清单会让
        // 「新加的题解」十分钟内不被发现（与 problems.js 里的说明一致）
        const res = await fetch("./solutions/index.json", { cache: "no-store" });
        if (!res.ok) return null;
        const data = await res.json();
        return data && typeof data.months === "object" ? data.months : null;
      } catch {
        return null;
      }
    })();
  }
  return solutionIndexPromise;
}

/**
 * 加载并返回题解的原始 markdown 文本；没有题解时返回 null。
 * 加载失败不会抛异常，返回 null 由组件展示占位信息。
 */
export async function loadSolutionText(problem) {
  const name = solutionFileName(problem).toLowerCase();
  if (isIgnored(name)) return null;
  if (textCache.has(name)) return textCache.get(name);

  const month = solutionMonth(problem);
  const moduleKey =
    (month && bundledByMonth.get(`${month}/${name}`)) || bundledFlat.get(name);

  let text = null;
  if (moduleKey) {
    try {
      text = await mdModules[moduleKey]();
    } catch (err) {
      console.warn("加载内联题解失败", name, err);
    }
  }

  if (text == null) {
    // 回退：运行时读取部署目录的 md。
    // 若清单可用，先确认这个文件确实在；否则（拿不到清单的老部署）才盲试，
    // 并且对每个响应都过一遍 looksLikeHtmlPage，避免把 index.html 当题解。
    const index = await loadSolutionIndex();
    const candidates = [];
    const listed = (m) => Array.isArray(index?.[m]) && index[m].some((n) => String(n).toLowerCase() === name);
    if (index) {
      if (month && listed(month)) candidates.push(`./solutions/${month}/${name}.md`);
      if (listed("")) candidates.push(`./solutions/${name}.md`);
    } else {
      if (month) candidates.push(`./solutions/${month}/${name}.md`);
      candidates.push(`./solutions/${name}.md`);
    }

    for (const url of candidates) {
      try {
        const res = await fetch(url, { cache: "no-store" });
        if (!res.ok) continue;
        const body = await res.text();
        if (looksLikeHtmlPage(body, res.headers?.get?.("content-type") || "")) {
          console.warn("题解回退拿到的是页面 HTML，已忽略：", url);
          continue;
        }
        text = body;
        break;
      } catch (err) {
        console.warn("fetch 题解失败", url, err);
      }
    }
  }

  if (text != null) textCache.set(name, text);
  return text;
}
