<script setup>
import { ref, onMounted, onBeforeUnmount } from "vue";
import DateFilter from "./DateFilter.vue";
import TagFilter from "./TagFilter.vue";

const props = defineProps({
  dates: { type: Array, default: () => [] },
  tags: { type: Array, default: () => [] },
  filters: { type: Object, required: true },
  resultInfo: { type: String, default: "" },
});

const emit = defineEmits([
  "update:search",
  "update:year",
  "update:month",
  "update:day",
  "update:selectedTags",
  "clear",
]);

// 哪个下拉面板打开："" | "date" | "tag"
const openPanel = ref("");
const dateBtn = ref(null);
const tagBtn = ref(null);
const datePanel = ref(null);
const tagPanel = ref(null);

function togglePanel(name) {
  openPanel.value = openPanel.value === name ? "" : name;
}
function close() {
  openPanel.value = "";
}

// 点击面板外区域关闭
function onDocClick(e) {
  const el = e.target;
  if (!(el instanceof Element)) return;
  const inDate =
    datePanel.value?.contains(el) || dateBtn.value?.contains(el);
  const inTag =
    tagPanel.value?.contains(el) || tagBtn.value?.contains(el);
  if (!inDate && !inTag) close();
}
function onKeydown(e) {
  if (e.key === "Escape") close();
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
});

const hasDateFilter = () =>
  !!(props.filters.year || props.filters.month || props.filters.day);
const hasTagFilter = () => (props.filters.tags || []).length > 0;
</script>

<template>
  <div class="filter-panel">
    <div class="toolbar">
      <input class="grow" type="search"
        :value="filters.q"
        placeholder="搜索题目名 / 来源…"
        aria-label="搜索题目名或来源"
        autocomplete="off"
        @input="emit('update:search', $event.target.value)" />

      <div class="dropdown">
        <button ref="dateBtn" type="button"
          :class="['dropdown-trigger', { active: openPanel === 'date', lit: hasDateFilter() }]"
          aria-haspopup="true" :aria-expanded="openPanel === 'date'"
          @click="togglePanel('date')">
          📅 日期<span v-if="hasDateFilter()" class="dot"></span>
        </button>
        <div v-if="openPanel === 'date'" ref="datePanel" class="dropdown-panel">
          <DateFilter
            :dates="dates"
            :year="filters.year"
            :month="filters.month"
            :day="filters.day"
            @update:year="(v) => emit('update:year', v)"
            @update:month="(v) => emit('update:month', v)"
            @update:day="(v) => emit('update:day', v)"
            @clear="emit('clear')"
          />
        </div>
      </div>

      <div class="dropdown">
        <button ref="tagBtn" type="button"
          :class="['dropdown-trigger', { active: openPanel === 'tag', lit: hasTagFilter() }]"
          aria-haspopup="true" :aria-expanded="openPanel === 'tag'"
          @click="togglePanel('tag')">
          🏷️ 标签<span v-if="hasTagFilter()" class="dot"></span>
        </button>
        <div v-if="openPanel === 'tag'" ref="tagPanel" class="dropdown-panel">
          <TagFilter
            :tags="tags"
            :selected="filters.tags"
            @update:selected="(v) => emit('update:selectedTags', v)"
          />
        </div>
      </div>

      <button type="button" @click="emit('clear')">清除</button>
    </div>

    <div class="result-info">{{ resultInfo }}</div>
  </div>
</template>
