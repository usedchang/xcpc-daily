import { ref, computed } from "vue";

// 模块级单例：页面任意入口（今日卡片 / 表格行）点击“题解”，
// 都在屏幕正中央弹出同一个模态框展示内容。
const problem = ref(null);

export function useSolutionModal() {
  const open = computed(() => problem.value !== null);

  function show(p) {
    problem.value = p;
  }

  function close() {
    problem.value = null;
  }

  return { problem, open, show, close };
}
