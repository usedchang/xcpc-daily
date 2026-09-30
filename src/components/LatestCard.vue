<script setup>
import { computed } from "vue";
import { hasEditorial } from "../data/solutions.js";
import { useSolutionModal } from "../composables/useSolutionModal.js";

const props = defineProps({
  problem: { type: Object, default: null },
  /** 北京时间的今天（`YYYY-MM-DD`）：用来判断这张卡到底是「今日」还是「最近一题」。 */
  today: { type: String, default: "" },
});

const hasSolution = computed(() => hasEditorial(props.problem));
const isToday = computed(() => Boolean(props.problem) && props.problem.date === props.today);

// 今天没发题（或维护者提前预置了未来的题）时不能再写 TODAY：
// 卡片显示的是最近一道**已发布**的题，标签必须说实话。
const label = computed(() =>
  isToday.value ? "TODAY · 今日题目" : `最近一题 · ${props.problem?.date || ""}`
);

const { show } = useSolutionModal();
</script>

<template>
  <section v-if="problem" class="latest">
    <div class="label">{{ label }}</div>
    <div class="title">{{ problem.title }}</div>
    <div class="meta">
      <span class="meta-date">{{ problem.date }}</span> · {{ problem.source }}
      <span v-if="problem.difficulty || (problem.tags && problem.tags.length)" class="badges">
        <span v-if="problem.difficulty" class="badge diff">{{ problem.difficulty }}</span>
        <span v-for="t in problem.tags || []" :key="t" class="badge">{{ t }}</span>
      </span>
    </div>
    <div class="latest-actions">
      <a class="btn" :href="problem.link" target="_blank" rel="noopener">打开题目 ↗</a>
      <button type="button" class="btn ghost" @click="show(problem)">
        {{ hasSolution ? "查看题解" : "讨论 / 投稿" }}
      </button>
    </div>
  </section>
</template>
