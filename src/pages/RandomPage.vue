<script setup>
/**
 * 「随机一题」独立子页面（#/random）。
 *
 * 从主页面拆出来，是为了让抽题、CF 账号绑定和过滤器有完整的横向空间；
 * 主页面只保留今日题目和往期题目。
 */
import { computed } from "vue";
import { cfKeyFromLink } from "../data/cfProblems.js";
import { usePublishedProblems } from "../composables/usePublishedProblems.js";
import SubpageShell from "../components/SubpageShell.vue";
import CfAccountPanel from "../components/CfAccountPanel.vue";
import RandomProblem from "../components/RandomProblem.vue";

const { published } = usePublishedProblems();

// 抽到的 CF 题如果就是往期「每日一题」，标「本站已收录」并给题解入口
const archiveIndex = computed(() => {
  const map = new Map();
  for (const p of published.value) {
    const key = cfKeyFromLink(p.link);
    if (key && !map.has(key)) map.set(key, p);
  }
  return map;
});
</script>

<template>
  <SubpageShell
    title="随机一题"
    subtitle="从 Codeforces 题库随机抽题 · 绑定账号后自动避开你已 AC 的题"
    footer="题库来自 Codeforces 公开 API · 随机抽题不会重复 · 绑定只用于过滤已 AC 题目"
    other-to="/checkin"
    other-label="🟩 每日打卡"
    page-class="random-page"
  >
    <CfAccountPanel />
    <RandomProblem :archive-index="archiveIndex" />
  </SubpageShell>
</template>
