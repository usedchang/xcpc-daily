// 一次性验证（不进仓库）：确认 toItems 同时吃「数组」与「模块命名空间」两种形状。
// 背景：CI 那台机器上 import.meta.glob 的 eager 值是 {default:[...],__esModule:true}，
// 本地却可能是真数组——这正是线上 24 题被全部丢掉的原因。
import { readFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = process.cwd();
const TMP = join(ROOT, ".tmp", "shape-test");
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

// 把 problems.js 复制成可在 Node 里跑的版本：glob -> shim，shim 用「模块对象」形状
const src = readFileSync(join(ROOT, "src/data/problems.js"), "utf8");
const patched = src
  .replace(/import\.meta\.glob\([^;]*?\);/s, "__bundled()")
  .replace(/^/, `import { makeBundled } from "./shim.mjs";\nfunction __bundled() { return makeBundled(); }\n`);
writeFileSync(join(TMP, "problems.mjs"), patched, "utf8");

// shim 产出「模块命名空间」形状（模拟 CI）
writeFileSync(
  join(TMP, "shim.mjs"),
  `import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
export function makeBundled() {
  const out = {};
  for (const f of readdirSync(join(${JSON.stringify(ROOT)}, "data"))) {
    if (!/^\\d{4}-\\d{2}\\.json$/.test(f)) continue;
    const arr = JSON.parse(readFileSync(join(${JSON.stringify(ROOT)}, "data", f), "utf8"));
    // 关键：包成模块命名空间对象（与 CI 上的表现一致）
    out["../../data/" + f] = { __esModule: true, default: arr };
  }
  return out;
}
`,
  "utf8"
);

globalThis.fetch = async () => ({ ok: false, status: 404, headers: { get: () => "text/html" }, text: async () => "", json: async () => ({}) });

const { loadProblems } = await import(pathToFileURL(join(TMP, "problems.mjs")).href);
const items = await loadProblems();
console.log("模块对象形状 -> 题目数:", items.length);
console.log("  首条:", items[0] ? `${items[0].date} ${items[0].title}` : "(空)");
console.log(items.length === 24 ? "PASS 修复生效（24 题全部读回）" : "FAIL 仍然丢数据");
rmSync(TMP, { recursive: true, force: true });
process.exitCode = items.length === 24 ? 0 : 1;
