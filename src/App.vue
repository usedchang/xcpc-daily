<script setup>
import { ref, reactive, computed, onMounted } from "vue";
import { loadProblems } from "./data/problems.js";
import ThemeToggle from "./components/ThemeToggle.vue";
import LatestCard from "./components/LatestCard.vue";
import FilterBar from "./components/FilterBar.vue";
import ProblemTable from "./components/ProblemTable.vue";
import { useUrlState } from "./composables/useState.js";

const allData = ref([]);
const filters = reactive({ q: "", year: "", month: "", day: "", tags: [] });
const loadError = ref("");

const parseDate = (dateStr) => {
  const [y, m, d] = String(dateStr || "").split("-");
  return { y: y || "", m: m || "", d: d || "" };
};

// 北京时间（UTC+8）的今天，格式 YYYY-MM-DD。
// 用于只展示「已发布」的题目（date <= 今天），未来的预置题目不泄露。
function todayInBeijing() {
  const now = new Date();
  const bj = new Date(now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000);
  return [
    bj.getUTCFullYear(),
    String(bj.getUTCMonth() + 1).padStart(2, "0"),
    String(bj.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

const todayStr = todayInBeijing();

// 已发布的题目：date <= 今天（北京时间），倒序
const publishedData = computed(() =>
  [...allData.value]
    .filter((it) => String(it.date || "") <= todayStr)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
);

const latest = computed(() => publishedData.value[0] || null);

// ------- 日历筛选数据：仅已发布日期 -------
const dates = computed(() =>
  publishedData.value
    .map((it) => parseDate(it.date))
    .filter((d) => d.y && d.m && d.d)
);

// ------- tag 数据：仅统计已发布题目 -------
const tags = computed(() => {
  const count = new Map();
  publishedData.value.forEach((it) => {
    (it.tags || []).forEach((t) => count.set(t, (count.get(t) || 0) + 1));
  });
  return [...count.entries()]
    .map(([name, n]) => ({ name, count: n }))
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
});

// ------- 匹配 + 过滤 -------
function matches(item) {
  const d = parseDate(item.date);
  if (filters.year && d.y !== filters.year) return false;
  if (filters.month && d.m !== filters.month) return false;
  if (filters.day && d.d !== filters.day) return false;

  if (filters.tags.length > 0) {
    const itemTags = item.tags || [];
    if (!filters.tags.some((t) => itemTags.includes(t))) return false;
  }

  const q = filters.q.trim().toLowerCase();
  if (q) {
    const hay = `${item.title} ${item.source}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }
  return true;
}

const filtered = computed(() => publishedData.value.filter(matches));

const hasActiveFilter = computed(
  () => !!(filters.q.trim() || filters.year || filters.month || filters.day || filters.tags.length)
);

const resultInfo = computed(() =>
  hasActiveFilter.value
    ? `筛选结果：${filtered.value.length} / ${publishedData.value.length} 题`
    : `共 ${publishedData.value.length} 题`
);

// ------- 控件事件 -------
function setSearch(v) { filters.q = v; }
function setYear(v) { filters.year = v; filters.month = ""; filters.day = ""; }
function setMonth(v) { filters.month = v; filters.day = ""; }
function setDay(v) { filters.day = v; }
function setTags(v) { filters.tags = v; }
function clearFilters() {
  filters.q = "";
  filters.year = "";
  filters.month = "";
  filters.day = "";
  filters.tags = [];
}

// URL 参数 → 初始状态：hash 形式的 #/?year=...&month=...&q=...
const urlState = useUrlState(filters);

onMounted(async () => {
  urlState.read();
  try {
    allData.value = await loadProblems();
  } catch (err) {
    loadError.value = err.message;
  }
});
</script>

<template>
  <div class="wrap">
    <header>
      <ThemeToggle />
      <h1>XCPC 每日一题</h1>
      <p>每天一道算法竞赛题目 · 只记录「来源 · 题目 · 链接」</p>
    </header>

    <LatestCard :problem="latest" />

    <FilterBar
      :dates="dates"
      :tags="tags"
      :filters="filters"
      :result-info="resultInfo"
      @update:search="setSearch"
      @update:year="setYear"
      @update:month="setMonth"
      @update:day="setDay"
      @update:selectedTags="setTags"
      @clear="clearFilters"
    />

    <ProblemTable v-if="!loadError" :problems="filtered" />
    <p v-else class="muted">加载 data.json 失败：{{ loadError }}。请通过 dev server 或 GitHub Pages 访问。</p>

    <footer>
      交流 QQ 群号：<code>1036787694</code> · 数据文件 <code>data.json</code> · 部署由 GitHub Actions 自动构建
    </footer>
  </div>
</template>
