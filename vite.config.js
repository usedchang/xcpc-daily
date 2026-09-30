import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mjVersion = JSON.parse(
  readFileSync(resolve(here, "node_modules/mathjax-full/package.json"), "utf8")
).version;

/**
 * 加载 scripts/data-index.mjs 里的 dataIndexPlugin 插件工厂。
 *
 * 这里不用顶层 await / 静态 import：Vite 会把本配置文件先打成 CJS 再 require
 * （`type: "module"` 的判定在某些 Node 版本下会走 CJS 分支），顶层 await 会直接让
 * 构建报 "Top-level await is currently not supported with the cjs output format"。
 * 两条路都试一遍，任一条成功即可；都失败也照样能构建，只是不会自动生成
 * dist/data/index.json（可手动跑 node scripts/data-index.mjs 补上）。
 */
function loadDataIndexPlugin() {
  const useRequire = () => {
    try {
      const require = createRequire(import.meta.url);
      return require("./scripts/data-index.mjs").dataIndexPlugin();
    } catch (err) {
      return null;
    }
  };

  // 同步分支优先：打包成 CJS 时 Vite 会把它编译成 require，天然可用
  const viaRequire = useRequire();
  if (viaRequire) return viaRequire;

  // 原生 ESM 分支：不 await，交给 defineConfig 支持返回 Promise 的能力
  return import("./scripts/data-index.mjs")
    .then((mod) => (typeof mod?.dataIndexPlugin === "function" ? mod.dataIndexPlugin() : null))
    .catch(() => null);
}

const dataIndex = loadDataIndexPlugin();

// base: "./" 让构建产物用相对路径，
// 这样既能部署到 https://<user>.github.io/xcpc-daily/ 也能放在任意子目录。
export default defineConfig(async () => {
  const indexPlugin = await dataIndex;
  return {
    // dataIndexPlugin：校验 data/<YYYY-MM>.json、生成 data/index.json，
    // dev 下监听月文件改动并在终端提示，build 时把 index.json 带进 dist。
    plugins: [vue(), ...(indexPlugin ? [indexPlugin] : [])],
    base: "./",
    define: {
      // mathjax-full 的 version.js 在浏览器里会 eval('require') 拿版本号，
      // 这里直接注入 PACKAGE_VERSION 绕过那段 node-only 代码。
      PACKAGE_VERSION: JSON.stringify(mjVersion),
    },
  };
});
