<script setup>
import { computed } from "vue";
import { esc } from "../utils.js";

const props = defineProps({
  problem: { type: Object, default: null },
});

const meta = computed(() => {
  if (!props.problem) return "";
  const p = props.problem;
  return `${esc(p.date)} · ${esc(p.source)}`;
});
</script>

<template>
  <section v-if="problem" class="latest">
    <div class="label">TODAY · 今日题目</div>
    <div class="title">{{ problem.title }}</div>
    <div class="meta">
      {{ meta }}
      <span v-if="problem.difficulty || (problem.tags && problem.tags.length)"
        class="badges">
        <span v-if="problem.difficulty" class="badge diff">{{ problem.difficulty }}</span>
        <span v-for="t in problem.tags" :key="t" class="badge">{{ t }}</span>
      </span>
    </div>
    <a class="btn" :href="problem.link" target="_blank" rel="noopener">打开题目 ↗</a>
  </section>
</template>
