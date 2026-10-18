<script setup>
/**
 * 「随机一题」独立子页面（#/random）。
 *
 * 从主页面拆出来，是为了让抽题、CF 账号绑定和过滤器有完整的横向空间；
 * 主页面只保留今日题目 / 打卡 / 排行榜 / 往期题目。
 */
import { onBeforeUnmount, onMounted, ref } from "vue";
import { loadProblems } from "../data/problems.js";
import { cfKeyFromLink } from "../data/cfProblems.js";
import ThemeToggle from "../components/ThemeToggle.vue";
import GithubCorner from "../components/GithubCorner.vue";
import CfAccountPanel from "../components/CfAccountPanel.vue";
import RandomProblem from "../components/RandomProblem.vue";

const archiveIndex = ref(new Map());
const PAGE_TITLE = "随机一题 · XCPC 每日一题";
const SITE_TITLE = "XCPC 每日一题";

onMounted(async () => {
  document.title = PAGE_TITLE;
  try {
    const list = await loadProblems();
    const map = new Map();
    for (const p of list) {
      const key = cfKeyFromLink(p.link);
      if (key && !map.has(key)) map.set(key, p);
    }
    archiveIndex.value = map;
  } catch {
    // 站内数据加载失败不影响抽题
  }
});

onBeforeUnmount(() => {
  document.title = SITE_TITLE;
});
</script>

<template>
  <div class="wrap random-page">
    <GithubCorner />
    <header class="random-page-head">
      <ThemeToggle />
      <h1><span class="brand">XCPC</span> 随机一题</h1>
      <p class="site-sub">
        从 Codeforces 题库随机抽题 · 绑定账号后自动避开你已 AC 的题
      </p>
      <nav class="site-nav" aria-label="页面导航">
        <router-link to="/">← 返回每日一题</router-link>
        <router-link to="/checkin">🟩 每日打卡</router-link>
      </nav>
    </header>

    <CfAccountPanel />
    <RandomProblem :archive-index="archiveIndex" />

    <footer>
      题库来自 Codeforces 公开 API · 随机抽题不会重复 · 绑定只用于过滤已 AC 题目
    </footer>
  </div>
</template>
