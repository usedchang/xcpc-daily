/**
 * 每日一题的「按月数据」索引层（Node 侧，dev / build / 手动脚本共用）。
 *
 * 数据布局约定：
 *   data/<YYYY-MM>.json   一个自然月一个文件，内容是当月题目的数组（按 date 升序）
 *   data/index.json       由本模块生成的清单（月份列表），**不入库**（见 .gitignore）
 *   data/README.md        目录说明，扫描时忽略
 *
 * index.json 存在的意义：站点除了内联打包的月文件，还保留了「构建后直接往部署目录
 * 丢 json 即时生效」的旧工作流（fetch 回退）。运行时需要一个清单才知道有哪些月文件
 * 可以 fetch，这个清单就是在 buildStart 时扫盘生成、并写进 dist/data/ 的那份。
 *
 * 用法：
 *   node scripts/data-index.mjs           # 手动重新生成 data/index.json
 *   vite.config.js 里用 dataIndexPlugin() # dev 中间件 + build 生成 dist/data/index.json
 *
 * 顺带承担的构建收尾工作（都在 closeBundle，见 dataIndexPlugin 内注释）：
 * 把 data/<年-月>.json 与 solutions/<年-月>/*.md 拷进产物目录、
 * 给产物 index.html 的入口资源打上内容版本号。
 *
 * 说明：这里是 Node 侧，读的是磁盘上的文件，和浏览器里 `import.meta.glob` 的形状无关。
 * （glob 的 eager 结果在不同构建环境下可能是数组、也可能是 `{default:[...]}` 模块对象，
 *  这个差异由 src/data/problems.js 的 toItems 兜住。）
 */
import { readFileSync, writeFileSync, readdirSync, statSync, mkdirSync, copyFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(HERE, "..");

/** 月文件名：YYYY-MM.json（index.json / README.md 等一律忽略）。 */
const MONTH_FILE_RE = /^(\d{4})-(\d{2})\.json$/;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function fail(file, msg) {
  throw new Error(`[data] ${file}：${msg}`);
}

/**
 * 校验一个月文件的内容，返回规范化后的题目数组（按 date 升序）。
 * 这里故意把错误说得具体：发题时字段写错，dev server 一启动就会报出来，
 * 而不是等到页面上少一道题才发现。
 */
function normalizeMonth(file, raw) {
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (err) {
    fail(file, `不是合法 JSON（${err.message}）`);
  }
  if (!Array.isArray(parsed)) fail(file, "顶层必须是数组");

  const seen = new Set();
  const items = parsed.map((item, i) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      fail(file, `第 ${i + 1} 项不是对象`);
    }
    for (const key of ["date", "source", "title", "link"]) {
      const v = item[key];
      if (typeof v !== "string" || !v.trim()) {
        fail(file, `第 ${i + 1} 项缺少必填字段 ${key}`);
      }
    }
    if (!DATE_RE.test(item.date)) {
      fail(file, `第 ${i + 1} 项 date="${item.date}" 不是 YYYY-MM-DD`);
    }
    if (item.tags !== undefined && !Array.isArray(item.tags)) {
      fail(file, `第 ${i + 1} 项 tags 必须是数组`);
    }
    if (item.hints !== undefined && !Array.isArray(item.hints)) {
      fail(file, `第 ${i + 1} 项 hints 必须是数组`);
    }
    if (seen.has(item.date)) fail(file, `date=${item.date} 重复`);
    seen.add(item.date);
    return item;
  });

  items.sort((a, b) => a.date.localeCompare(b.date));
  return items;
}

/** 检查「文件名的月份」与「条目的月份」是否一致——发题时最容易犯的错就是放错文件。 */
function checkMonthMatches(file, month, items) {
  const wrong = items.filter((it) => it.date.slice(0, 7) !== month);
  if (wrong.length) {
    fail(
      file,
      `月份不匹配：文件名是 ${month}，但条目 ${wrong
        .map((it) => it.date)
        .join("、")} 属于别的月份`
    );
  }
}

/**
 * 扫描 data/ 目录，读回全部月文件。
 * @returns {{months: string[], byMonth: Map<string, object[]>}}
 */
export function scanDataDir(dataDir = join(PROJECT_ROOT, "data")) {
  let names;
  try {
    names = readdirSync(dataDir);
  } catch (err) {
    throw new Error(`[data] 读不到数据目录 ${dataDir}：${err.message}`);
  }

  const months = [];
  const byMonth = new Map();

  for (const name of names.sort()) {
    const m = MONTH_FILE_RE.exec(name);
    if (!m) continue;
    const full = join(dataDir, name);
    if (!statSync(full).isFile()) continue;
    const month = `${m[1]}-${m[2]}`;
    const raw = readFileSync(full, "utf8");
    const items = normalizeMonth(`data/${name}`, raw);
    checkMonthMatches(`data/${name}`, month, items);
    months.push(month);
    byMonth.set(month, items);
  }

  if (months.length === 0) {
    throw new Error(`[data] ${dataDir} 下没有找到任何 YYYY-MM.json`);
  }
  months.sort();

  // 跨月重复 date 也拦一下：同一个日期出现在两个月文件里，页面会显示两道「今日题目」。
  const owner = new Map();
  for (const month of months) {
    for (const it of byMonth.get(month)) {
      if (owner.has(it.date)) {
        fail(
          `data/${month}.json`,
          `date=${it.date} 已在 data/${owner.get(it.date)}.json 里出现，日期不能跨月文件重复`
        );
      }
      owner.set(it.date, month);
    }
  }

  return { months, byMonth };
}

/** 生成 index.json 的文本（末尾带换行，方便 git / diff 友好）。 */
export function buildIndexText(dataDir) {
  const { months, byMonth } = scanDataDir(dataDir);
  const payload = {
    generated: true,
    note: "由 scripts/data-index.mjs 自动生成，请勿手动编辑，也不要提交到 git。",
    count: months.reduce((n, m) => n + byMonth.get(m).length, 0),
    months: months.map((month) => ({
      month,
      file: `${month}.json`,
      count: byMonth.get(month).length,
    })),
  };
  return JSON.stringify(payload, null, 2) + "\n";
}

const SOLUTION_MONTH_DIR_RE = /^(\d{4}-\d{2})$/;

/**
 * 扫描 `solutions/<年-月>/*.md`，用于 dev 下打印「有哪些题解」。
 *
 * 题解本身由 src/data/solutions.js 在构建时 import.meta.glob 内联，**不需要清单**：
 * 页面找不到内联内容时会直接 fetch 部署目录里的 md，并靠响应体嗅探
 * （looksLikeHtmlPage）挡掉 SPA 回退返回的 index.html。
 * 早先那份 solutions/index.json 清单是多余的，而且它还有个副作用：
 * 后来才丢进部署目录的 md 不在清单里，就永远读不到。
 *
 * @returns {Record<string, string[]>} 月份 -> 题解文件名（不含 .md）
 */
export function scanSolutionDir(solutionsDir = join(PROJECT_ROOT, "solutions")) {
  const byMonth = {};
  let entries;
  try {
    entries = readdirSync(solutionsDir, { withFileTypes: true });
  } catch {
    return byMonth;
  }

  for (const entry of entries) {
    if (!entry.isDirectory() || !SOLUTION_MONTH_DIR_RE.test(entry.name)) continue;
    const month = entry.name;
    const names = readdirSync(join(solutionsDir, month))
      .filter((n) => /\.md$/i.test(n))
      .map((n) => n.replace(/\.md$/i, ""))
      .filter((n) => n && !n.startsWith("_") && n.toLowerCase() !== "readme")
      .sort();
    if (names.length) byMonth[month] = names;
  }
  return byMonth;
}

/** dev 下的题解概览日志。 */
function formatSolutionSummary(solutionsDir) {
  return (
    Object.entries(scanSolutionDir(solutionsDir))
      .map(([m, list]) => `${m}:${list.length}`)
      .join(" ") || "（空）"
  );
}

/**
 * Vite 插件：
 *   - dev：启动时校验月文件、生成 data/index.json，之后监听 data/*.json 重新生成，
 *     并在 solutions/<月>/*.md 变动时打印题解概览；
 *   - build：buildStart 时重新扫描校验，closeBundle 时把月份清单、月文件、
 *     题解 md 写进部署目录，并给入口资源打上内容版本号。
 */
export function dataIndexPlugin() {
  const dataDir = join(PROJECT_ROOT, "data");
  const solutionsDir = join(PROJECT_ROOT, "solutions");
  const indexPath = join(dataDir, "index.json");

  let outDir = "dist";
  let building = false;

  /** 把生成的清单写盘；内容没变就不动文件（避免 dev 下反复触发 watcher）。 */
  function writeIfChanged(file, text) {
    let changed = true;
    try {
      changed = readFileSync(file, "utf8") !== text;
    } catch {
      changed = true;
    }
    if (changed) writeFileSync(file, text, "utf8");
    return changed;
  }

  function writeIndex(log = false) {
    const text = buildIndexText(dataDir);
    const changed = writeIfChanged(indexPath, text);
    if (log) {
      const { months, byMonth } = scanDataDir(dataDir);
      const total = months.reduce((n, m) => n + byMonth.get(m).length, 0);
      console.log(
        `[data] ${months.length} 个月文件 / ${total} 题（${months.join(", ")}）${
          changed ? "，已更新 data/index.json" : ""
        }`
      );
    }
    return { changed, text };
  }

  function logSolutions() {
    console.log(`[solutions] 题解 ${formatSolutionSummary(solutionsDir)}`);
  }

  /**
   * 把月份清单写进部署目录。运行时 fetch 的是 `./data/index.json`，
   * 产物里必须有一份，否则「改完 json 直接丢到部署目录」的回退会失效。
   * 手写文件而不是 emitFile：dist 是普通静态目录，不需要参与 rollup 的 hash 命名。
   */
  function writeDeployedIndex() {
    try {
      const text = writeIndex(false).text;
      const target = resolve(PROJECT_ROOT, outDir, "data");
      mkdirSync(target, { recursive: true });
      writeFileSync(join(target, "index.json"), text, "utf8");
      console.log(`[data] 已写入 ${outDir}/data/index.json`);
    } catch (err) {
      console.warn(`[data] 写入 ${outDir}/data/index.json 失败：${err.message}`);
    }
  }

  /**
   * 把 `data/<年-月>.json` 一起拷进部署目录。
   *
   * 页面运行时是按 `data/index.json` 去 fetch 每个月文件的（no-store），
   * 这条路要成立，产物里就必须真的有这些文件——否则每次打开都会白跑几个 404。
   * 顺带保留了「改完 json 直接覆盖部署目录即可生效、无需重新构建」的能力。
   */
  function copyMonthFiles() {
    const target = resolve(PROJECT_ROOT, outDir, "data");
    let copied = 0;
    try {
      mkdirSync(target, { recursive: true });
      for (const name of readdirSync(dataDir)) {
        if (!MONTH_FILE_RE.test(name)) continue;
        copyFileSync(join(dataDir, name), join(target, name));
        copied += 1;
      }
      console.log(`[data] 已拷入 ${outDir}/data/ 共 ${copied} 个月份文件`);
    } catch (err) {
      console.warn(`[data] 拷贝月份文件失败：${err.message}`);
    }
  }

  /**
   * 把 `solutions/<年-月>/*.md` 一起拷进部署目录。
   *
   * 少这一步，src/data/solutions.js 的运行时通道就整条是死的：
   * 那行 `fetch("./solutions/<月>/<name>.md")` 在线上永远 404，
   * 于是「改完题解 md 直接覆盖部署目录」只在 README 里成立。
   * 标程 .cpp 页面不读，就不必跟着进产物。
   */
  function copySolutionFiles() {
    const src = solutionsDir;
    const target = resolve(PROJECT_ROOT, outDir, "solutions");
    let copied = 0;
    try {
      for (const entry of readdirSync(src, { withFileTypes: true })) {
        if (!entry.isDirectory() || !SOLUTION_MONTH_DIR_RE.test(entry.name)) continue;
        const from = join(src, entry.name);
        const to = join(target, entry.name);
        const names = readdirSync(from).filter(
          (n) => /\.md$/i.test(n) && !n.startsWith("_") && n.toLowerCase() !== "readme.md"
        );
        if (!names.length) continue;
        mkdirSync(to, { recursive: true });
        for (const name of names) {
          copyFileSync(join(from, name), join(to, name));
          copied += 1;
        }
      }
      console.log(`[data] 已拷入 ${outDir}/solutions/ 共 ${copied} 篇题解 md`);
    } catch (err) {
      console.warn(`[data] 拷贝题解文件失败：${err.message}`);
    }
  }

  /**
   * 给产物里的入口 JS/CSS 打上「入口产物内容」的版本号（`?v=<hash>`）。
   *
   * 为什么需要：GitHub Pages 给 index.html 的响应头是 `Cache-Control: max-age=600`，
   * 浏览器在 10 分钟内可能连请求都不发。入口文件名是固定的，
   * 若版本号也固定（早先写的是文件名 `index.js`，等于常量），
   * 浏览器就会一直用自己缓存里的那份旧 JS —— 注释承诺的
   * 「HTML 一刷新就必然指向当次构建的产物」根本没发生。
   * 改成内容哈希后，只要产物变了 URL 就变，缓存不可能再顶掉新版本。
   */
  function stampEntryAssets() {
    const htmlPath = resolve(PROJECT_ROOT, outDir, "index.html");
    const assetDir = resolve(PROJECT_ROOT, outDir, "assets");
    try {
      const hash = createHash("sha256");
      let hashed = 0;
      for (const name of ["index.js", "index.css"]) {
        try {
          hash.update(readFileSync(join(assetDir, name)));
          hashed += 1;
        } catch {
          // 某一类产物不存在（例如没有 CSS）时跳过，用剩下的算
        }
      }
      if (!hashed) return;
      const version = hash.digest("hex").slice(0, 10);

      const html = readFileSync(htmlPath, "utf8");
      // 允许重复执行：已经带过 ?v= 的资源会被重新写成本次的版本号
      const stamped = html.replace(
        /(src|href)="\.\/(assets\/[^"?]+\.(?:js|css))(?:\?[^"]*)?"/g,
        (_m, attr, file) => `${attr}="./${file}?v=${version}"`
      );
      if (stamped !== html) {
        writeFileSync(htmlPath, stamped, "utf8");
        console.log(`[data] 已给 ${outDir}/index.html 的入口资源打上版本号 ?v=${version}`);
      }
    } catch (err) {
      console.warn(`[data] 处理 ${outDir}/index.html 失败：${err.message}`);
    }
  }

  return {
    name: "xcpc-daily:data-index",

    configResolved(config) {
      building = config.command === "build";
      outDir = config.build.outDir || "dist";
    },

    buildStart() {
      // 提前校验一遍：月份文件名与条目日期不匹配这类错误在构建一开始就报出来
      writeIndex(true);
      logSolutions();
    },

    closeBundle() {
      // closeBundle 在 rollup 全部产物写盘之后触发，此时 dist/ 已经存在
      if (building) {
        writeDeployedIndex();
        copyMonthFiles();
        copySolutionFiles();
        stampEntryAssets();
      }
    },

    configureServer(server) {
      writeIndex(true);
      logSolutions();
      server.watcher.add(dataDir);
      server.watcher.add(solutionsDir);

      const onFsEvent = (file) => {
        const p = String(file);
        try {
          if (/[/\\]data[/\\][^/\\]*\.json$/.test(p) && !/[/\\]index\.json$/.test(p)) {
            writeIndex(true);
          } else if (/[/\\]solutions[/\\][^/\\]+[/\\][^/\\]+\.md$/i.test(p)) {
            // solutions/<年-月>/xxx.md 新增/改动/删除：题解是 import.meta.glob 内联的，
            // Vite 自己会热更新；这里只把概览打出来，方便确认文件真的被认到了
            logSolutions();
          }
        } catch (err) {
          // 写错了就在终端报出来，别让 dev server 挂掉
          server.config.logger.error(String(err.message || err));
        }
      };
      server.watcher.on("add", onFsEvent);
      server.watcher.on("change", onFsEvent);
      server.watcher.on("unlink", onFsEvent);
    },
  };
}

/** CLI 入口：node scripts/data-index.mjs */
function writeIndexFromCli() {
  const dataText = buildIndexText(join(PROJECT_ROOT, "data"));
  writeFileSync(join(PROJECT_ROOT, "data", "index.json"), dataText, "utf8");
  const info = JSON.parse(dataText);
  console.log(
    `[data] 已生成 data/index.json：${info.months.length} 个月文件 / ${info.count} 题`
  );
}

export { writeIndexFromCli };

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  writeIndexFromCli();
}
