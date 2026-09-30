/**
 * 题解加载层（按月分目录版）。
 *
 * 目录约定：题解 markdown 与标程 cpp 放在 `solutions/<YYYY-MM>/` 下，同一个月的放在一起，
 * 文件名默认与题目 `date` 相同（例如 `solutions/2026-09/2026-09-08.md`，
 * 配套标程 `solutions/2026-09/2026-09-08.cpp`）。
 *
 *   - 也可以在 data/<年-月>.json 的题目里用 `"solution": "2026-09-08-xor-is-add.md"` 显式指定
 *     文件名（只写文件名，目录由 date 的月份决定；`.md` 可省略）。
 *   - 以 `_` 开头或名为 `README` 的 md 会被忽略，可用于放模板/说明文件。
 *   - 兼容历史布局：直接放在 `solutions/` 根下的 `2026-09-08.md` 也能被找到。
 *
 * 两条通道，顺序与题解数据层（problems.js）保持一致 —— **先 fetch，后内联**：
 *   1. 运行时 fetch `solutions/<月>/<name>.md`：构建时这些 md 会被拷进部署目录
 *      （scripts/data-index.mjs 的 copySolutionFiles），于是「改完 md 直接覆盖部署目录里的
 *      文件」无需重新构建即可生效，与 data/<年-月>.json 的玩法完全一致；
 *   2. 内联兜底：dev / build 时用 import.meta.glob 把 md 打进产物，
 *      离线、本地直开 dist、或部署目录里缺文件时都还能正常显示。
 *
 * 为什么不像以前那样先读内联、只把 fetch 当兜底：那样「部署目录里改了 md」永远不会被看到，
 * 而 README 一直承诺这条路可用。顺序反过来后两条承诺同时成立。
 */
// 只认「一层的月份目录」：`solutions/community/` 这类特殊目录由 splitKey 过滤掉。
const mdModules = import.meta.glob("../../solutions/*/*.md", {
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

/**
 * 判断拿到的响应是不是「一整个 HTML 页面」而不是题解正文。
 *
 * 为什么需要这道防线：dev server（以及部分静态托管）对不存在的路径会回退返回
 * `index.html`，状态码还是 200。若直接把这段文本当题解渲染，整页 HTML 就会出现在弹窗里。
 * 正规题解是 Markdown，不会以 `<!doctype` / `<html` 开头（正文里出现 HTML 标签没问题）。
 *
 * 这也是原先 `solutions/index.json` 清单想解决的问题；一个响应体嗅探就够了，
 * 而清单还有个副作用：新丢进部署目录的 md 不在清单里，就永远读不到。
 */
function looksLikeHtmlPage(text, contentType = "") {
  if (/^\s*text\/html/i.test(String(contentType))) return true;
  const head = String(text || "").replace(/^\uFEFF/, "").trimStart().slice(0, 80).toLowerCase();
  return head.startsWith("<!doctype") || head.startsWith("<html");
}

/** 从部署目录读一篇题解；读不到（404 / 离线 / 拿到的是页面 HTML）返回 null。 */
async function fetchDeployed(month, name) {
  const candidates = [];
  if (month) candidates.push(`./solutions/${month}/${name}.md`);
  candidates.push(`./solutions/${name}.md`); // 旧布局

  for (const url of candidates) {
    try {
      // no-store：与 data/<年-月>.json 同理，Pages 给它 10 分钟缓存，
      // 缓存住就等于「改了 md 也要等十分钟」。
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) continue;
      const body = await res.text();
      if (looksLikeHtmlPage(body, res.headers?.get?.("content-type") || "")) {
        console.warn("题解回退拿到的是页面 HTML，已忽略：", url);
        continue;
      }
      return body;
    } catch {
      // 离线 / file:// 直开产物：静默走内联兜底
    }
  }
  return null;
}

/**
 * 加载并返回题解的原始 markdown 文本；没有题解时返回 null。
 * 加载失败不会抛异常，返回 null 由组件展示占位信息。
 */
export async function loadSolutionText(problem) {
  const name = solutionFileName(problem).toLowerCase();
  if (isIgnored(name)) return null;

  const month = solutionMonth(problem);
  let text = await fetchDeployed(month, name);

  if (text == null) {
    const moduleKey = (month && bundledByMonth.get(`${month}/${name}`)) || bundledFlat.get(name);
    if (moduleKey) {
      try {
        text = await mdModules[moduleKey]();
      } catch (err) {
        console.warn("加载内联题解失败", name, err);
      }
    }
  }

  return text;
}
