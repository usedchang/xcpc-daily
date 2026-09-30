<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { loadSolutionText, solutionPath } from "../data/solutions.js";
import { renderMarkdownAsync } from "../markdown-lazy.js";
import { onCopyClick } from "../utils/copy.js";

const props = defineProps({
  problem: { type: Object, default: null },
});

const solutionHtml = ref("");
const hints = ref([]);
const loading = ref(false);
const loadError = ref("");
const panelRef = ref(null);

// 题解按月份分目录：solutions/<YYYY-MM>/<date>.md（例如 solutions/2026-09/2026-09-08.md）
const fallbackFile = computed(() => solutionPath(props.problem));
// 题目数据也是按月一个文件，hints 要写在对应月份里
const dataFile = computed(() => {
  const m = /^(\d{4}-\d{2})/.exec(String(props.problem?.date || ""));
  return m ? `data/${m[1]}.json` : "data/<年-月>.json";
});

/** 代码块右上角的 copy 按钮（与社区题解共用 utils/copy.js 的实现）。 */
function onClick(e) {
  onCopyClick(e, panelRef.value);
}

onMounted(() => document.addEventListener("click", onClick));
onBeforeUnmount(() => document.removeEventListener("click", onClick));

// 连点两道题时，先发的那次可能后返回：用递增的 token 丢弃过期结果。
let token = 0;

async function load() {
  const problem = props.problem;
  const mine = ++token;

  solutionHtml.value = "";
  hints.value = [];
  loadError.value = "";

  if (!problem) {
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    // hint 通常很短，先渲染出来，读者不必等正文（正文可能要先下载 markdown chunk）。
    const hintList = (problem.hints || []).map((h, i) => ({ title: `Hint ${i + 1}`, raw: h }));
    if (hintList.length) {
      const rendered = await Promise.all(hintList.map((h) => renderMarkdownAsync(h.raw)));
      if (mine !== token) return;
      hints.value = rendered.map((html, i) => ({ title: hintList[i].title, html }));
    }

    const text = (await loadSolutionText(problem)) || "";
    const html = text ? await renderMarkdownAsync(text) : "";
    if (mine !== token) return;
    solutionHtml.value = html;
  } catch (err) {
    if (mine !== token) return;
    loadError.value = err?.message || String(err);
  } finally {
    if (mine === token) loading.value = false;
  }
}

watch(() => props.problem, load, { immediate: true });
</script>

<template>
  <div ref="panelRef" class="solution-panel">
    <div v-if="hints.length" class="hints">
      <details v-for="h in hints" :key="h.title" class="hint">
        <summary>{{ h.title }}</summary>
        <div class="markdown-body hint-body" v-html="h.html"></div>
      </details>
    </div>

    <div v-if="loading" class="muted solution-loading">题解加载中…</div>
    <div v-else-if="loadError" class="muted">题解加载失败：{{ loadError }}</div>
    <div v-else-if="solutionHtml" class="markdown-body" v-html="solutionHtml"></div>
    <div v-else-if="!hints.length" class="muted">
      暂无题解内容：请在 <code>{{ fallbackFile }}</code> 添加题解，
      或在 <code>{{ dataFile }}</code> 中为该题添加 <code>hints</code>。
    </div>
  </div>
</template>
