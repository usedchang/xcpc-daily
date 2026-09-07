import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import "./style.css";

// 使用 hash 路由：GitHub Pages 是纯静态托管，无法为 /year/2026 这种
// 路径配置 SPA fallback；hash 形式的 #/?year=... 刷新后仍能正确工作，
// 且不要求服务器任何额外配置。
const router = createRouter({
  history: createWebHashHistory(),
  routes: [{ path: "/", component: App }],
});

createApp(App).use(router).mount("#app");
