<script setup>
/**
 * 打卡表单里的日期选择器。
 *
 * 只列出「站内有每日一题」的日期：打卡必须对应某天的题目，所以不存在
 * 选了一个空白日期、再去手填题目的情况。外观是输入框 + 下拉月历，
 * 替代原生 <input type="date"> —— 原生控件无法禁用没有题目的日期，样式也不统一。
 *
 * 月份用 ‹ › 在「有题目的月份」之间跳，不显示没有数据的空月份。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { isDateString, parseDateParts, weekdayOf } from "../utils/date.js";

const props = defineProps({
  modelValue: { type: String, default: "" },
  /** 可选日期数组（`YYYY-MM-DD`）。调用方已过滤成「有每日一题」的日期。 */
  dates: { type: Array, default: () => [] },
  today: { type: String, default: "" },
});

const emit = defineEmits(["update:modelValue"]);

const root = ref(null);
const open = ref(false);
const view = ref({ y: 0, m: 0 });

const available = computed(() => new Set((props.dates || []).filter((d) => isDateString(d))));

/** 有数据的月份（升序），用来限制 ‹ › 只在这些月份之间跳。 */
const months = computed(() => {
  const map = new Map();
  for (const date of available.value) {
    const p = parseDateParts(date);
    if (!p) continue;
    map.set(`${p.y}-${String(p.m).padStart(2, "0")}`, { y: p.y, m: p.m });
  }
  return [...map.values()].sort((a, b) => a.y - b.y || a.m - b.m);
});

const selected = computed(() => (isDateString(props.modelValue) ? props.modelValue : ""));

const viewIndex = computed(() =>
  months.value.findIndex((item) => item.y === view.value.y && item.m === view.value.m)
);

const monthLabel = computed(() =>
  view.value.y ? `${view.value.y} 年 ${view.value.m} 月` : "选择日期"
);

const daysInMonth = computed(() => {
  if (!view.value.y) return 0;
  return new Date(Date.UTC(view.value.y, view.value.m, 0)).getUTCDate();
});

const firstWeekday = computed(() => {
  if (!view.value.y) return 0;
  return new Date(Date.UTC(view.value.y, view.value.m - 1, 1)).getUTCDay();
});

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

const triggerText = computed(() => {
  if (!available.value.size) return "暂无可打卡日期";
  if (!selected.value) return "选择日期";
  const p = parseDateParts(selected.value);
  const w = weekdayOf(selected.value);
  return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")} · 周${WEEKDAYS[w]}`;
});

const todayAvailable = computed(() => available.value.has(props.today));

function dayDate(day) {
  return `${view.value.y}-${String(view.value.m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function syncView() {
  const target = parseDateParts(selected.value);
  if (target && months.value.some((item) => item.y === target.y && item.m === target.m)) {
    view.value = { y: target.y, m: target.m };
    return;
  }
  const latest = months.value[months.value.length - 1];
  view.value = latest ? { ...latest } : { y: 0, m: 0 };
}

function openPanel() {
  if (!available.value.size) return;
  syncView();
  open.value = true;
}

function closePanel() {
  open.value = false;
}

function toggle() {
  if (open.value) closePanel();
  else openPanel();
}

function select(date) {
  if (!available.value.has(date)) return;
  emit("update:modelValue", date);
  open.value = false;
}

function selectToday() {
  if (todayAvailable.value) select(props.today);
}

function goMonth(delta) {
  const index = viewIndex.value;
  if (index < 0) return;
  const next = months.value[index + delta];
  if (!next) return;
  view.value = { ...next };
}

function isSelected(date) {
  return date === selected.value;
}

function isToday(date) {
  return date === props.today;
}

function onDocClick(event) {
  const target = event.target;
  if (!(target instanceof Element)) return;
  if (root.value?.contains(target)) return;
  closePanel();
}

function onKeydown(event) {
  if (event.key === "Escape") closePanel();
}

onMounted(() => {
  document.addEventListener("click", onDocClick);
  document.addEventListener("keydown", onKeydown);
  syncView();
});

onBeforeUnmount(() => {
  document.removeEventListener("click", onDocClick);
  document.removeEventListener("keydown", onKeydown);
});

watch(
  () => props.modelValue,
  () => {
    if (!open.value) syncView();
  }
);
watch(
  () => props.dates,
  () => {
    if (!open.value) syncView();
  }
);
</script>

<template>
  <div ref="root" class="ck-datepick">
    <button
      type="button"
      class="ck-datepick-trigger"
      :class="{ open, empty: !available.size }"
      :disabled="!available.size"
      aria-haspopup="dialog"
      :aria-expanded="open"
      :aria-label="triggerText"
      :title="triggerText"
      @click="toggle"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path
          fill="currentColor"
          d="M4.75 0a.75.75 0 0 1 .75.75V2h5V.75a.75.75 0 0 1 1.5 0V2h1.25c.966 0 1.75.784 1.75 1.75v10.5A1.75 1.75 0 0 1 13.25 16H2.75A1.75 1.75 0 0 1 1 14.25V3.75C1 2.784 1.784 2 2.75 2H4V.75A.75.75 0 0 1 4.75 0ZM2.5 6.5v7.75c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25V6.5h-11Zm0-1.5h11v-1.25a.25.25 0 0 0-.25-.25H2.75a.25.25 0 0 0-.25.25V5Z"
        />
      </svg>
      <span class="ck-datepick-text">{{ triggerText }}</span>
      <span class="ck-datepick-caret" :class="{ open }" aria-hidden="true">▾</span>
    </button>

    <div v-if="open" class="ck-datepick-panel" role="dialog" aria-label="选择打卡日期">
      <div class="ck-datepick-head">
        <button
          type="button"
          class="ck-datepick-nav"
          :disabled="viewIndex <= 0"
          aria-label="上一个月"
          @click="goMonth(-1)"
        >‹</button>
        <span class="ck-datepick-month">{{ monthLabel }}</span>
        <button
          type="button"
          class="ck-datepick-nav"
          :disabled="viewIndex < 0 || viewIndex >= months.length - 1"
          aria-label="下一个月"
          @click="goMonth(1)"
        >›</button>
      </div>

      <div class="ck-datepick-calendar">
        <span v-for="(w, i) in WEEKDAYS" :key="'w' + i" class="ck-datepick-week">{{ w }}</span>
        <span v-for="i in firstWeekday" :key="'b' + i" class="ck-datepick-blank"></span>
        <button
          v-for="d in daysInMonth"
          :key="d"
          type="button"
          class="ck-datepick-day"
          :class="{
            on: available.has(dayDate(d)),
            active: isSelected(dayDate(d)),
            today: isToday(dayDate(d)),
          }"
          :disabled="!available.has(dayDate(d))"
          :aria-label="`${view.y} 年 ${view.m} 月 ${d} 日`"
          @click="select(dayDate(d))"
        >{{ d }}</button>
      </div>

      <div class="ck-datepick-foot">
        <span v-if="todayAvailable" class="ck-datepick-hint">有题目的日期才可选</span>
        <span v-else class="ck-datepick-hint">今天还没有发题</span>
        <button
          v-if="todayAvailable"
          type="button"
          class="ck-text-btn"
          @click="selectToday"
        >跳到今天</button>
      </div>
    </div>
  </div>
</template>
