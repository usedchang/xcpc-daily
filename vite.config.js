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
    build: {
      rollupOptions: {
        output: {
          /**
           * 入口 JS/CSS 用固定文件名（index.js / index.css），不加内容哈希。
           *
           * 原因：GitHub Pages 的 CDN 是多节点、且对同一路径可能同时返回 200 与 404
           * （实测同一秒内两个请求结果相反）。内容哈希意味着每次部署都会让旧文件名
           * 永久消失，节点只要滞后一点，index.html 引用的文件就 404，整页白屏；
           * 连续几次部署会把这个窗口放大。
           *
           * 固定文件名后，新旧产物路径完全相同：节点滞后最多是"还是上一版"，
           * 不会再出现"HTML 引用的文件不存在"。题解等懒加载分块仍保留哈希
           * （它们只在点击时按需加载，且不做入口）。
           *
           * 内容更新靠：index.html 每次都会被重新拉取（同 URL 改名配合
           * closeBundle 里的 ?v= 版本号），数据文件本身是 no-store。
           */
          entryFileNames: "assets/index.js",
          assetFileNames: (info) => {
            const name = info.names?.[0] || info.name || "";
            if (/\.css$/i.test(name)) return "assets/index.css";
            return "assets/[name]-[hash][extname]";
          },
          chunkFileNames: "assets/[name]-[hash].js",
        },
      },
    },
    define: {
      // mathjax-full 的 version.js 在浏览器里会 eval('require') 拿版本号，
      // 这里直接注入 PACKAGE_VERSION 绕过那段 node-only 代码。
      PACKAGE_VERSION: JSON.stringify(mjVersion),
    },
  };
});
