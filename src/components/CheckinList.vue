<script setup>
/**
 * 打卡记录列表。
 *
 * 每条记录对应「某天的每日一题 + 一份 AC 提交 + 完整题解」；
 * 不再展示 AC/尝试结果，因为打卡默认就是 AC。
 *
 * 默认只展示最近 8 条；从热力图点某一天进来时，只显示那一天的记录。
 */
import { computed, ref } from "vue";
import { formatCnDate, monthDay, weekdayOf } from "../utils/date.js";

const props = defineProps({
  records: { type: Array, default: () => [] },
  total: { type: Number, default: 0 },
  selectedDate: { type: String, default: "" },
});

const emit = defineEmits(["clear-date", "remove"]);

const expanded = ref(false);
const pendingDelete = ref("");
let pendingTimer = 0;

const shown = computed(() => {
  if (props.selectedDate || expanded.value) return props.records;
  return props.records.slice(0, 8);
});

const hiddenCount = computed(() => Math.max(0, props.records.length - shown.value.length));

const heading = computed(() => {
  if (props.selectedDate) return `${formatCnDate(props.selectedDate)} 的记录`;
  return "最近的提交";
});

const countText = computed(() => {
  if (props.selectedDate) return `${props.records.length} 条`;
  return props.total ? `共 ${props.total} 条` : "";
});

function weekday(date) {
  const index = weekdayOf(date);
  return index < 0 ? "" : `周${"日一二三四五六"[index]}`;
}

function solutionPreview(text) {
  return text.length > 160 ? `${text.slice(0, 160)}…` : text;
}

function confirmRemove(id) {
  window.clearTimeout(pendingTimer);
  if (pendingDelete.value === id) {
    pendingDelete.value = "";
    emit("remove", id);
    return;
  }
  pendingDelete.value = id;
  pendingTimer = window.setTimeout(() => {
    pendingDelete.value = "";
  }, 3000);
}
</script>

<template>
  <div class="ck-list">
    <div class="ck-list-head">
      <h3 class="ck-list-title">{{ heading }}</h3>
      <span v-if="countText" class="ck-list-count">{{ countText }}</span>
      <button
        v-if="selectedDate"
        type="button"
        class="ck-text-btn ck-list-clear"
        @click="emit('clear-date')"
      >清除筛选</button>
    </div>

    <p v-if="!records.length" class="ck-empty">
      <template v-if="selectedDate">这一天没有提交记录。</template>
      <template v-else>还没有打卡记录。完成今天的题，点上面的「打卡」点亮第一格。</template>
    </p>

    <ul v-else class="ck-items">
      <li v-for="r in shown" :key="r.id" class="ck-item">
        <div class="ck-item-main">
          <span class="ck-item-date" :title="formatCnDate(r.date)">
            {{ monthDay(r.date) }}<small>{{ weekday(r.date) }}</small>
          </span>
          <a
            v-if="r.link"
            class="ck-item-title"
            :href="r.link"
            target="_blank"
            rel="noopener"
            :title="r.title"
          >{{ r.title }}</a>
          <span v-else class="ck-item-title" :title="r.title">{{ r.title }}</span>
          <span
            v-if="r.problemDate"
            class="ck-item-badge"
            :title="`对应 ${r.problemDate} 的每日一题`"
          >每日一题</span>
          <button
            type="button"
            class="ck-text-btn ck-item-del"
            :class="{ pending: pendingDelete === r.id }"
            :title="pendingDelete === r.id ? '再点一次确认删除' : '删除这条记录'"
            @click="confirmRemove(r.id)"
          >{{ pendingDelete === r.id ? "确认删除" : "删除" }}</button>
        </div>

        <div class="ck-item-sub">
          <a v-if="r.submission" :href="r.submission" target="_blank" rel="noopener">
            提交记录 ↗
          </a>
          <span v-if="r.solution" class="ck-item-solution">{{ solutionPreview(r.solution) }}</span>
          <span v-else class="ck-item-solution muted">还没有写完整题解</span>
        </div>

        <details v-if="r.solution" class="ck-item-details">
          <summary>展开完整题解</summary>
          <pre class="ck-item-solution-full">{{ r.solution }}</pre>
        </details>
      </li>
    </ul>

    <button
      v-if="hiddenCount"
      type="button"
      class="ck-text-btn ck-list-more"
      @click="expanded = true"
    >查看全部 {{ props.records.length }} 条（还有 {{ hiddenCount }} 条）</button>
  </div>
</template>
