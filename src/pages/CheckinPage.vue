<script setup>
/**
 * 「每日打卡」独立子页面（#/checkin）。
 *
 * 打卡记录和排行榜合并在这一个页面里：
 *   打卡面板（登录 / 热力图 / 提交列表 / 公开设置）+ 打卡排行榜。
 *
 * 题目数据来自共享的 usePublishedProblems；打卡面板只消费今日题和已发布列表。
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { CHECKIN } from "../config/checkin.js";
import { usePublishedProblems } from "../composables/usePublishedProblems.js";
import { scrollToElement } from "../utils/scroll.js";
import SubpageShell from "../components/SubpageShell.vue";
import CheckinPanel from "../components/CheckinPanel.vue";
import CheckinLeaderboard from "../components/CheckinLeaderboard.vue";

const {
  published,
  latest,
  today: todayStr,
  loading,
  error: loadError,
} = usePublishedProblems();

const activeTab = ref("record");
const recordRef = ref(null);
const rankRef = ref(null);

function jumpToSection(target) {
  activeTab.value = target;
  const el = target === "rank" ? rankRef.value : recordRef.value;
  scrollToElement(el);
}

/** 滚动时让页内 tab 跟随当前区块；空榜 CTA 跳回打卡面板时也能同步。 */
function syncActiveFromScroll() {
  const rank = rankRef.value;
  if (!rank) return;
  // 页面很短时排行榜无法滚到视口 38% 的位置；滑到底也应算切到排行榜。
  const atBottom =
    window.scrollY > 0 &&
    window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 12;
  const threshold = window.innerHeight * 0.38;
  activeTab.value = atBottom || rank.getBoundingClientRect().top <= threshold ? "rank" : "record";
}

onMounted(() => {
  window.addEventListener("scroll", syncActiveFromScroll, { passive: true });
  window.requestAnimationFrame(syncActiveFromScroll);
});

onBeforeUnmount(() => {
  window.removeEventListener("scroll", syncActiveFromScroll);
});
</script>

<template>
  <SubpageShell
    title="每日打卡"
    subtitle="GitHub 登录 · 记录每天的 AC · 绿色热力图 · 打卡排行榜"
    footer="打卡记录默认只保存在你的私有 Gist（未登录时仅本机）· 排行榜只读取公开统计快照"
    other-to="/random"
    other-label="🎲 随机一题"
    page-class="checkin-page"
  >
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
      <div ref="recordRef">
        <CheckinPanel :today="todayStr" :problem="latest" :problems="published" />
      </div>
      <div v-if="CHECKIN.leaderboard.enabled" ref="rankRef">
        <CheckinLeaderboard @go-checkin="jumpToSection('record')" />
      </div>
    </div>
  </SubpageShell>
</template>
