import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

// base: "./" 让构建产物用相对路径，
// 这样既能部署到 https://<user>.github.io/xcpc-daily/ 也能放在任意子目录。
export default defineConfig({
  plugins: [vue()],
  base: "./",
});
