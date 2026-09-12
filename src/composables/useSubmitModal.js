import { ref, computed } from "vue";

// 模块级单例：投稿生成器是全局唯一的一个模态框，
// 可以从「题解弹窗里的社区区块」或页面顶部入口打开，两种入口共享同一份状态。
const problem = ref(null);

export function useSubmitModal() {
  const open = computed(() => problem.value !== null);

  /** 打开投稿生成器；传入题目对象可自动带入日期，不传则让用户自己选。 */
  function show(p) {
    problem.value = p || {};
  }

  function close() {
    problem.value = null;
  }

  return { problem, open, show, close };
}
