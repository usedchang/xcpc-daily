import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const mjVersion = JSON.parse(
  readFileSync(resolve(here, "node_modules/mathjax-full/package.json"), "utf8")
).version;

// base: "./" 让构建产物用相对路径，
// 这样既能部署到 https://<user>.github.io/xcpc-daily/ 也能放在任意子目录。
export default defineConfig({
  plugins: [vue()],
  base: "./",
  define: {
    // mathjax-full 的 version.js 在浏览器里会 eval('require') 拿版本号，
    // 这里直接注入 PACKAGE_VERSION 绕过那段 node-only 代码。
    PACKAGE_VERSION: JSON.stringify(mjVersion),
  },
});
