<script setup>
/**
 * 「每日打卡」独立子页面（#/checkin）。
 *
 * 打卡记录和排行榜合并在这一个页面里：
 *   打卡面板（登录 / 热力图 / 提交列表 / 公开设置）+ 打卡排行榜。
 *
 * 题目数据仍来自每日一题的 data/，只取已发布的部分；页面跨过北京时间零点时
 * 会自动更新「今天」，和主页面保持同一个判断。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { loadProblems } from "../data/problems.js";
import { todayInBeijing } from "../utils/date.js";
import { CHECKIN } from "../config/checkin.js";
import ThemeToggle from "../components/ThemeToggle.vue";
import GithubCorner from "../components/GithubCorner.vue";
import CheckinPanel from "../components/CheckinPanel.vue";
import CheckinLeaderboard from "../components/CheckinLeaderboard.vue";

const PAGE_TITLE = "每日打卡 · XCPC 每日一题";
const SITE_TITLE = "XCPC 每日一题";

const allData = ref([]);
const todayStr = ref(todayInBeijing());
const loading = ref(true);
const loadError = ref("");
const activeTab = ref("record");
let todayTimer = 0;

function jumpToSection(target) {
  activeTab.value = target;
  const id = target === "rank" ? "checkin-rank" : "checkin-record";
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

/** 滚动时让页内 tab 跟随当前区块；空榜 CTA 跳回打卡面板时也能同步。 */
function syncActiveFromScroll() {
  const rank = document.getElementById("checkin-rank");
  if (!rank) return;
  // 页面很短时排行榜无法滚到视口 38% 的位置；滑到底也应算切到排行榜。
  const atBottom =
    window.scrollY > 0 &&
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12;
  const threshold = window.innerHeight * 0.38;
  activeTab.value = atBottom || rank.getBoundingClientRect().top <= threshold ? "rank" : "record";
}

function refreshToday() {
  const now = todayInBeijing();
  if (now !== todayStr.value) todayStr.value = now;
}

// 已发布题目倒序；打卡表单只允许选有题目的日期
const published = computed(() =>
  [...allData.value]
    .filter((it) => String(it.date || "") <= todayStr.value)
    .sort((a, b) => String(b.date).localeCompare(String(a.date)))
);
const latest = computed(() => published.value[0] || null);

onMounted(async () => {
  document.title = PAGE_TITLE;
  document.addEventListener("visibilitychange", refreshToday);
  window.addEventListener("scroll", syncActiveFromScroll, { passive: true });
  window.requestAnimationFrame(syncActiveFromScroll);
  todayTimer = window.setInterval(refreshToday, 5 * 60 * 1000);
  try {
    allData.value = await loadProblems();
  } catch (err) {
    loadError.value = String(err?.message || err || "题目数据加载失败");
  } finally {
    loading.value = false;
  }
});

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", refreshToday);
  window.removeEventListener("scroll", syncActiveFromScroll);
  window.clearInterval(todayTimer);
  document.title = SITE_TITLE;
});
</script>

<template>
  <div class="wrap checkin-page">
    <GithubCorner />
    <header class="checkin-page-head">
      <ThemeToggle />
      <h1><span class="brand">XCPC</span> 每日打卡</h1>
      <p class="site-sub">
        GitHub 登录 · 记录每天的 AC · 绿色热力图 · 打卡排行榜
      </p>
      <nav class="site-nav" aria-label="页面导航">
        <router-link to="/">← 返回每日一题</router-link>
        <router-link to="/random">🎲 随机一题</router-link>
      </nav>
    </header>

    <p v-if="loading" class="checkin-page-note" role="status">正在读取题目数据…</p>
    <p v-else-if="loadError" class="checkin-page-note error" role="alert">
      题目数据加载失败：{{ loadError }}。打卡记录仍可查看，但补卡日期可能不完整。
    </p>

    <nav
      v-if="CHECKIN.leaderboard.enabled"
      class="checkin-page-tabs"
      aria-label="每日打卡页内导航"
    >
      <button
        type="button"
        :class="{ active: activeTab === 'record' }"
        :aria-pressed="activeTab === 'record'"
        @click="jumpToSection('record')"
      >打卡记录</button>
      <button
        type="button"
        :class="{ active: activeTab === 'rank' }"
        :aria-pressed="activeTab === 'rank'"
        @click="jumpToSection('rank')"
      >排行榜</button>
    </nav>

    <div class="checkin-page-stack">
      <div id="checkin-record">
        <CheckinPanel :today="todayStr" :problem="latest" :problems="published" />
      </div>
      <div v-if="CHECKIN.leaderboard.enabled" id="checkin-rank">
        <CheckinLeaderboard />
      </div>
    </div>

    <footer>
      打卡记录默认只保存在你的私有 Gist（未登录时仅本机）· 排行榜只读取公开统计快照
    </footer>
  </div>
</template>
