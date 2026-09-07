import { ref, watch } from "vue";
import { useRouter } from "vue-router";

const THEME_KEY = "xcpc-theme";

// 模块级单例：无论哪个组件调用 useTheme，都共享同一份状态。
// 主题变量定义在 :root.dark，因此切换的是 documentElement 的 .dark 类。
const dark = ref(false);

function applyTheme(v) {
  dark.value = !!v;
  document.documentElement.classList.toggle("dark", dark.value);
}

// 页面加载时立即恢复本地记忆（不依赖组件 onMounted，避免闪烁）。
try {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === "dark");
} catch (e) {
  // localStorage 不可用时忽略
}

export function useTheme() {
  function toggle() {
    applyTheme(!dark.value);
    try {
      localStorage.setItem(THEME_KEY, dark.value ? "dark" : "light");
    } catch (e) {
      // 隐私模式等 localStorage 不可用时忽略
    }
  }

  return { dark, toggle };
}

/**
 * 把筛选状态同步到 URL 查询参数（可分享/收藏/刷新恢复）。
 * 使用 Vue Router 的 router.replace({ query })，而不是直接改写 location.hash：
 * 直接写 hash 会被 hash 路由截断（出现 #/ 后查询参数丢失），
 * router.replace 在 hash 模式下会正确写出 #/?year=...&q=... 并触发路由更新。
 */
export function useUrlState(state) {
  const router = useRouter();

  function read() {
    const sp = new URLSearchParams(
      location.hash.includes("?") ? location.hash.split("?")[1] : ""
    );
    state.q = sp.get("q") || "";
    state.year = sp.get("year") || "";
    state.month = sp.get("month") ? String(sp.get("month")).padStart(2, "0") : "";
    state.day = sp.get("day") ? String(sp.get("day")).padStart(2, "0") : "";
    state.tags = (sp.get("tags") || "").split(",").map((t) => t.trim()).filter(Boolean);
  }

  function write() {
    const query = {};
    if (state.q.trim()) query.q = state.q.trim();
    if (state.year) query.year = state.year;
    if (state.month) query.month = state.month;
    if (state.day) query.day = state.day;
    if (state.tags.length) query.tags = state.tags.join(",");
    // replace 而非 push：筛选变化不应在历史里堆栈
    router.replace({ path: "/", query }).catch(() => {});
  }

  watch(state, write, { deep: true });

  return { read, write };
}
