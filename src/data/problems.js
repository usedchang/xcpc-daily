/**
 * 数据加载层（按月拆分版）。
 *
 * 数据布局：一个自然月一个文件 `data/<YYYY-MM>.json`，内容是当月题目数组。
 *   - dev / build：`import.meta.glob` 把 data/ 下所有月文件内联进产物，
 *     编辑任意月文件（或加一个月文件）都会即时热更新。
 *   - 运行时覆盖：构建插件会把月文件和清单一起拷进 `dist/data/`，
 *     页面再按 `data/index.json` 把每个月拉一遍（`cache: "no-store"`），
 *     于是「改完 json 直接丢到部署目录」也能立刻生效，不必重新构建。
 *     清单/月文件缺失（离线、本地直开 dist）时静默回落内联数据。
 *
 * 合并规则：运行时成功拉到的月份以它为准，未成功拉到的月份才使用内联兜底。
 *
 * 路径深度提醒：本文件在 `src/data/` 下，`../data/*.json` 会指向
 * `src/data/*.json`（不存在），回仓库根目录必须写 `../../data/*.json`。
 *
 * 用普通 JSON 导入即可（不要加 `query: "?raw"`）：普通 JSON 导入由 vite:json 处理，
 * 构建期就变成对象字面量，可靠；`toItems` 兼容数组 / `{problems:[...]}` / 模块命名空间三种形状。
 *
 * 排除 index.json：它是给运行时 fetch 用的清单，本身不是题目数据，
 * 内联进来只会白白占体积（`!` 开头的负向模式由 Vite 的 glob 支持）。
 */
const bundledMonths = import.meta.glob(["../../data/*.json", "!../../data/index.json"], {
  eager: true,
});

/** `../../data/2026-09.json` -> `2026-09`；index.json 之类的非月文件返回空串。 */
function monthFromKey(key) {
  const base = String(key).split("/").pop() || "";
  const m = /^(\d{4}-\d{2})\.json$/i.exec(base);
  return m ? m[1] : "";
}

/** 把一份数据规整成题目数组（容忍数组 / {problems:[...]} / 模块命名空间 三种形状）。 */
function toItems(data, label) {
  if (Array.isArray(data)) return data;
  // ESM 模块命名空间：`import.meta.glob` 的 eager 结果在不同构建环境下，
  // 有的是真数组，有的是 `{default: [...], __esModule: true}` 这样的模块对象。
  // 不拆这一层，线上会静默丢掉全部月份数据（本地却可能恰好是数组，极难复现）。
  if (data && !Array.isArray(data) && Array.isArray(data.default)) return data.default;
  if (data && Array.isArray(data.problems)) return data.problems;
  console.warn(`[data] ${label} 顶层不是数组，已忽略`);
  return [];
}

/** 内联打包的题目（构建时确定）。 */
function bundledProblems() {
  const out = [];
  for (const [key, mod] of Object.entries(bundledMonths)) {
    if (!monthFromKey(key)) continue;
    // 普通 JSON 导入给的是对象/数组；万一拿到的仍是字符串（旧写法），就按文本解析
    const data = typeof mod === "string" ? safeParseJson(mod, key) : mod;
    out.push(...toItems(data, key));
  }
  if (!out.length) {
    console.warn(
      "[data] 没有内联到任何月份数据：检查 data/<YYYY-MM>.json 是否存在且内容合法，或重新运行 npm run build"
    );
  }
  return out;
}

/** 文本 -> JSON；解析失败返回 null（调用方按空数据继续）。 */
function safeParseJson(text, label) {
  try {
    return JSON.parse(text);
  } catch (err) {
    console.warn(`[data] ${label} 解析失败`, err);
    return null;
  }
}

function isValidItem(it) {
  return it && typeof it === "object" && typeof it.date === "string" && it.date;
}

function mergeByMonth(base, fetched, loadedMonths) {
  const result = base.filter((it) => {
    const month = String(it?.date || "").slice(0, 7);
    return !loadedMonths.has(month);
  });
  return [...result, ...fetched.filter(isValidItem)];
}

async function fetchJson(url, label) {
  // no-store：见 fetchIndexMonths 的说明——月文件也要绕过 10 分钟浏览器缓存
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return toItems(safeParseJson(await res.text(), label), label);
}

/**
 * 清单里的月份。清单不存在（例如没跑过 build 的旧部署、或直开 dist）时返回空数组，
 * 调用方会退回「只用内联打包的月文件」。
 *
 * `cache: "no-store"` 是必须的：GitHub Pages 给这些 json 的响应头是
 * `Cache-Control: max-age=600`，浏览器会缓存 10 分钟。清单一旦被缓存，
 * 「push 完刷新即生效」就会退化成「等十分钟才生效」，页面还会拿着旧清单去
 * fetch 已经不存在的月文件。数据文件同样走 no-store（见 fetchJson）。
 */
async function fetchIndexMonths() {
  try {
    const res = await fetch("./data/index.json", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const months = Array.isArray(data?.months) ? data.months : [];
    return months
      .map((m) => (typeof m === "string" ? m : m?.month || m?.file || ""))
      .map((m) => String(m).replace(/\.json$/i, "").trim())
      .filter((m) => /^\d{4}-\d{2}$/.test(m));
  } catch {
    return [];
  }
}

export async function loadProblems() {
  const base = bundledProblems();

  // 运行时覆盖通道：清单只有部署目录里真的有月文件时才会用到（构建插件会把
  // data/<年-月>.json 一起拷进 dist/data/）。拿不到清单或清单里的文件不存在，
  // 就直接用内联数据，不会在控制台刷 404——这也是离线/本地直开 dist 时的正常路径。
  try {
    const months = await fetchIndexMonths();
    const fetched = [];
    const loadedMonths = new Set();
    for (const month of months) {
      try {
        const items = await fetchJson(`./data/${month}.json`, `data/${month}.json`);
        fetched.push(...items);
        loadedMonths.add(month);
      } catch {
        // 该月文件不在部署目录（或网络失败）：内联数据里已经有这个月
      }
    }
    // 空月份也是有效结果：它代表该月目前没有题目，不能被旧内联数据重新填回来。
    if (loadedMonths.size) return mergeByMonth(base, fetched, loadedMonths);
  } catch {
    // 清单不可用：照旧用内联数据
  }

  return base;
}
