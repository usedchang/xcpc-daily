/**
 * 数据加载层（按月拆分版）。
 *
 * 数据布局：一个自然月一个文件 `data/<YYYY-MM>.json`，内容是当月题目数组。
 *   - dev / build：`import.meta.glob` 把 data/ 下所有月文件内联进产物，
 *     编辑任意月文件（或加一个月文件）都会即时热更新。
 *   - 运行时回退：依然保留旧的「改完 json 直接丢到部署目录就生效」工作流。
 *     页面会 fetch `data/index.json`（构建时由 scripts/data-index.mjs 生成），
 *     按清单把每个月文件拉一遍；`fetch` 失败或清单过期都不会报错，用内联数据兜底。
 *   - 兼容：如果部署目录里还留着老的根目录 `data.json`，也会一并读取。
 *
 * 合并规则：以 `date` 为键，后读到的（运行时 fetch 的）覆盖内联打包的，
 * 于是「不发版、只改部署目录里的月文件」也能生效。
 *
 * 路径深度提醒：本文件在 `src/data/` 下，`../data/*.json` 会指向
 * `src/data/*.json`（不存在），回仓库根目录必须写 `../../data/*.json`
 * （与原来 `import ... from "../../data.json"` 一致）。
 *
 * 用普通 JSON 导入即可（不要加 `query: "?raw"`）：普通 JSON 导入由 vite:json 处理，
 * 构建期就变成对象字面量，可靠；`toItems` 同时兼容数组与 `{problems:[...]}` 两种形状。
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

function mergeByDate(base, extra) {
  const map = new Map();
  for (const it of base) if (isValidItem(it)) map.set(it.date, it);
  for (const it of extra) if (isValidItem(it)) map.set(it.date, it);
  return [...map.values()];
}

async function fetchJson(url, label) {
  // no-store：见 fetchIndexMonths 的说明——月文件也要绕过 10 分钟浏览器缓存
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return toItems(safeParseJson(await res.text(), label), label);
}

/**
 * 清单里的月份。清单不存在（例如没跑过 build 的老部署）时返回空数组，
 * 调用方会退回「只读老 data.json」。
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

  try {
    const months = await fetchIndexMonths();
    const fetched = [];
    for (const month of months) {
      try {
        const items = await fetchJson(`./data/${month}.json`, `data/${month}.json`);
        fetched.push(...items);
      } catch {
        // 单个月文件拉不到不算失败：内联数据里通常已经有这个月
      }
    }
    if (fetched.length) return mergeByDate(base, fetched);
  } catch {
    // 忽略，走下面的老 data.json 回退
  }

  // 兼容老部署：根目录还留着整份 data.json
  try {
    const legacy = await fetch("./data.json");
    if (legacy.ok) {
      const items = toItems(safeParseJson(await legacy.text(), "data.json"), "data.json");
      if (items.length) return mergeByDate(base, items);
    }
  } catch {
    // 正常情况：data.json 已删除，fetch 404/失败都无所谓
  }

  return base;
}
