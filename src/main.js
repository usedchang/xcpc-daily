import { createApp } from "vue";
import { createRouter, createWebHashHistory } from "vue-router";
import App from "./App.vue";
import Root from "./Root.vue";
import "./style.css";

// 使用 hash 路由：GitHub Pages 是纯静态托管，无法为 /year/2026 这种
// 路径配置 SPA fallback；hash 形式的 #/?year=... 刷新后仍能正确工作，
// 且不要求服务器任何额外配置。
const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    { path: "/", component: App },
    // 每日打卡 + 排行榜合并为一个子页面；旧排行榜地址兼容到同一页
    { path: "/checkin", component: () => import("./pages/CheckinPage.vue") },
    { path: "/leaderboard", redirect: "/checkin" },
    // 随机一题独立成子页面，并按需加载：不进主页面首屏包
    { path: "/random", component: () => import("./pages/RandomPage.vue") },
    { path: "/:pathMatch(.*)*", redirect: "/" },
  ],
});

createApp(Root).use(router).mount("#app");
