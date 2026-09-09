<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { loadSolutionText } from "../data/solutions.js";
import { renderMarkdown } from "../markdown.js";

const props = defineProps({
  problem: { type: Object, default: null },
});

const solution = ref("");
const loading = ref(false);
const loadError = ref("");
const panelRef = ref(null);

const solutionHtml = computed(() =>
  solution.value ? renderMarkdown(solution.value) : ""
);

const hints = computed(() =>
  (props.problem?.hints || [])
    .map((h, i) => ({ title: `Hint ${i + 1}`, html: renderMarkdown(h) }))
);

const fallbackFile = computed(() => `solutions/${props.problem?.date || "YYYY-MM-DD"}.md`);

function copyCode(btn) {
  const pre = btn.closest("pre");
  if (!pre) return;
  const text = pre.querySelector("code")?.innerText ?? "";

  // 优先用异步剪贴板，失败时回退到 execCommand（兼容非安全上下文）
  const done = () => {
    btn.textContent = "copied";
    btn.classList.add("copied");
    window.setTimeout(() => {
      btn.textContent = "copy";
      btn.classList.remove("copied");
    }, 1200);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

function fallbackCopy(text, done) {
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    document.execCommand("copy");
    ta.remove();
    done();
  } catch (e) {
    done();
  }
}

// 点击事件委托：代码块右上角的 copy 按钮
function onClick(e) {
  const btn = e.target.closest(".code-copy");
  if (btn && panelRef.value?.contains(btn)) copyCode(btn);
}

onMounted(() => document.addEventListener("click", onClick));
onBeforeUnmount(() => document.removeEventListener("click", onClick));

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
  <div ref="panelRef" class="solution-panel">
    <div v-if="loading" class="muted">题解加载中…</div>

    <template v-else>
      <div v-if="loadError" class="muted">题解加载失败：{{ loadError }}</div>

      <div v-if="hints.length" class="hints">
        <details v-for="h in hints" :key="h.title" class="hint">
          <summary>{{ h.title }}</summary>
          <div class="markdown-body hint-body" v-html="h.html"></div>
        </details>
      </div>

      <div v-if="solutionHtml" class="markdown-body" v-html="solutionHtml"></div>

      <div v-if="!solutionHtml && !hints.length" class="muted">
        暂无题解内容：请在 <code>{{ fallbackFile }}</code> 添加题解，
        或在 <code>data.json</code> 中为该题添加 <code>hints</code>。
      </div>
    </template>
  </div>
</template>
