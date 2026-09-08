<script setup>
import { ref, computed, watch } from "vue";
import { loadSolutionText } from "../data/solutions.js";
import { renderMarkdown } from "../markdown.js";

const props = defineProps({
  problem: { type: Object, default: null },
});

const solution = ref("");
const loading = ref(false);
const loadError = ref("");

const solutionHtml = computed(() =>
  solution.value ? renderMarkdown(solution.value) : ""
);

const hints = computed(() =>
  (props.problem?.hints || [])
    .map((h, i) => ({ title: `Hint ${i + 1}`, html: renderMarkdown(h) }))
);

const fallbackFile = computed(() => `solutions/${props.problem?.date || "YYYY-MM-DD"}.md`);

async function load() {
  if (!props.problem) {
    solution.value = "";
    loadError.value = "";
    return;
  }
  loading.value = true;
  loadError.value = "";
  try {
    solution.value = (await loadSolutionText(props.problem)) || "";
  } catch (err) {
    loadError.value = err.message;
    solution.value = "";
  } finally {
    loading.value = false;
  }
}

watch(() => props.problem, load, { immediate: true });
</script>

<template>
  <div class="solution-panel">
    <div v-if="loading" class="muted">题解加载中…</div>

    <template v-else>
      <div v-if="loadError" class="muted">题解加载失败：{{ loadError }}</div>

      <div v-if="solutionHtml" class="markdown-body" v-html="solutionHtml"></div>

      <div v-if="hints.length" class="hints">
        <details v-for="h in hints" :key="h.title" class="hint">
          <summary>{{ h.title }}</summary>
          <div class="markdown-body hint-body" v-html="h.html"></div>
        </details>
      </div>

      <div v-if="!solutionHtml && !hints.length" class="muted">
        暂无题解内容：请在 <code>{{ fallbackFile }}</code> 添加题解，
        或在 <code>data.json</code> 中为该题添加 <code>hints</code>。
      </div>
    </template>
  </div>
</template>
