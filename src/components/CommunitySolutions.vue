<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { communityEntriesFor, loadCommunitySolution } from "../data/community.js";
import { renderUserMarkdownAsync } from "../markdown-lazy.js";
import { onCopyClick } from "../utils/copy.js";
import { useSubmitModal } from "../composables/useSubmitModal.js";
import { COMMUNITY } from "../config/community.js";

const props = defineProps({
  problem: { type: Object, default: null },
});

const { show: showSubmit } = useSubmitModal();

// entries 是构建期就能确定的元信息（文件名 → 日期/handle），可同步显示计数；
// items 才需要异步读取正文。
const entries = computed(() => communityEntriesFor(props.problem?.date));
const items = ref([]);
const loading = ref(false);
const expanded = ref("");
const rootEl = ref(null);

// 社区正文里也有代码块 copy 按钮，事件委托与官方题解一致
function onClick(e) {
  onCopyClick(e, rootEl.value);
}
onMounted(() => document.addEventListener("click", onClick));
onBeforeUnmount(() => document.removeEventListener("click", onClick));

// 连续切换题目时丢弃过期结果（与 SolutionPanel 同理）
let token = 0;

async function load() {
  const list = entries.value;
  const mine = ++token;

  if (!list.length) {
    items.value = [];
    loading.value = false;
    return;
  }

  loading.value = true;
  try {
    const loaded = await Promise.all(list.map((e) => loadCommunitySolution(e)));
    // sanitize 与渲染都在 markdown chunk 里，等它加载完再一起处理
    const rendered = await Promise.all(
      loaded.filter(Boolean).map(async (it) => ({ ...it, html: await renderUserMarkdownAsync(it.body) }))
    );
    if (mine !== token) return;
    items.value = rendered;
  } catch (err) {
    if (mine !== token) return;
    console.warn("加载社区题解失败", err);
    items.value = [];
  } finally {
    if (mine === token) loading.value = false;
  }
}

watch(
  () => props.problem?.date,
  () => {
    expanded.value = "";
    load();
  },
  { immediate: true }
);

function toggle(key) {
  expanded.value = expanded.value === key ? "" : key;
}

function onAvatarError(e) {
  // 头像走 github.com/<handle>.png，网络不通时隐藏而不是留一个破图
  e.target.style.visibility = "hidden";
}
</script>

<template>
  <section v-if="entries.length" ref="rootEl" class="community-block">
    <div class="community-head">
      <span>社区题解</span>
      <span class="community-count">{{ entries.length }}</span>
      <button
        v-if="COMMUNITY.submitEnabled"
        type="button"
        class="community-submit-link"
        @click="showSubmit(problem)"
      >
        我也来写一篇
      </button>
    </div>

    <p v-if="loading" class="muted">加载中…</p>

    <div v-else class="community-list">
      <article v-for="it in items" :key="it.key" class="community-item">
        <button type="button" class="community-item-head" @click="toggle(it.key)">
          <img
            class="community-avatar"
            :src="it.avatar"
            :alt="it.author"
            width="22"
            height="22"
            loading="lazy"
            @error="onAvatarError"
          />
          <span class="community-author">{{ it.author }}</span>
          <span v-if="it.title" class="community-title">{{ it.title }}</span>
          <span class="community-caret">{{ expanded === it.key ? "收起" : "展开" }}</span>
        </button>

        <div v-if="expanded === it.key" class="community-item-body">
          <div class="markdown-body" v-html="it.html"></div>
          <div class="community-item-foot">
            <a :href="it.url" target="_blank" rel="noopener">在 GitHub 查看 / 改进这篇 ↗</a>
          </div>
        </div>
      </article>
    </div>
  </section>
</template>
