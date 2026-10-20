/**
 * 已发布每日一题的共享数据源。
 *
 * 主页面、每日打卡页、随机一题页都需要「今天 + 已发布题目」：
 *   - 主页面拿它做今日卡/筛选；
 *   - 打卡页拿它做打卡日期和当天题目；
 *   - 随机页拿它给「本站已收录」建立 Codeforces 题号索引。
 *
 * 之前三处各写了一份 loadProblems + 跨天刷新 + 过滤排序，逻辑容易漂移；
 * 这里统一成一份，页面只消费 published / latest / today / loading / error。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { loadProblems } from "../data/problems.js";
import { todayInBeijing } from "../utils/date.js";

export function usePublishedProblems() {
  const allData = ref([]);
  const today = ref(todayInBeijing());
  const loading = ref(true);
  const error = ref("");
  let todayTimer = 0;

  function refreshToday() {
    const now = todayInBeijing();
    if (now !== today.value) today.value = now;
  }

  // 只展示已发布题目；倒序，和原主页面/打卡页的行为一致
  const published = computed(() =>
    [...allData.value]
      .filter((it) => String(it.date || "") <= today.value)
      .sort((a, b) => String(b.date).localeCompare(String(a.date)))
  );
  const latest = computed(() => published.value[0] || null);

  async function reload() {
    loading.value = true;
    error.value = "";
    try {
      allData.value = await loadProblems();
    } catch (err) {
      error.value = String(err?.message || err || "题目数据加载失败");
    } finally {
      loading.value = false;
    }
  }

  onMounted(() => {
    document.addEventListener("visibilitychange", refreshToday);
    todayTimer = window.setInterval(refreshToday, 5 * 60 * 1000);
    reload();
  });

  onBeforeUnmount(() => {
    document.removeEventListener("visibilitychange", refreshToday);
    window.clearInterval(todayTimer);
  });

  return { published, latest, today, loading, error };
}
