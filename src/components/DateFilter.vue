<script setup>
import { computed } from "vue";

const props = defineProps({
  // 题目日期集合：{ y, m, d } 的数组，仅含数据中真实存在的日期
  dates: { type: Array, default: () => [] },
  // 选定状态
  year: { type: String, default: "" },
  month: { type: String, default: "" },
  day: { type: String, default: "" },
});

const emit = defineEmits(["update:year", "update:month", "update:day", "clear", "picked"]);

// 所有出现过的年份（降序）
const years = computed(() =>
  [...new Set(props.dates.map((d) => d.y))].sort().reverse()
);

// 当前选中年份（默认取最新一年）
const activeYear = computed(() =>
  props.year && years.value.includes(props.year) ? props.year : years.value[0] || ""
);

// 该年份下出现过的月份（升序）
const months = computed(() =>
  [...new Set(props.dates.filter((d) => d.y === activeYear.value).map((d) => d.m))]
    .sort()
);

// 当前选中月份（默认取该年最新一月）
const activeMonth = computed(
  () => props.month && months.value.includes(props.month)
    ? props.month
    : months.value[months.value.length - 1] || ""
);

// 该年该月出现过的日期集合（去重）
const activeDays = computed(() => {
  const set = new Set();
  props.dates
    .filter((d) => d.y === activeYear.value && d.m === activeMonth.value)
    .forEach((d) => set.add(d.d));
  return set;
});

// 选中月份的天数
const daysInMonth = computed(() =>
  activeYear.value && activeMonth.value
    ? new Date(Number(activeYear.value), Number(activeMonth.value), 0).getDate()
    : 0
);

// 该月 1 号是周几（0=周日）→ 前置空格数
const firstWeekday = computed(() =>
  activeYear.value && activeMonth.value
    ? new Date(Number(activeYear.value), Number(activeMonth.value) - 1, 1).getDay()
    : 0
);

const WEEKDAYS = ["日", "一", "二", "三", "四", "五", "六"];

/** 数据里最新的一天，给「最新一天」快捷键用。 */
const latestDate = computed(() => {
  const sorted = [...props.dates].sort(
    (a, b) =>
      a.y.localeCompare(b.y) || a.m.localeCompare(b.m) || a.d.localeCompare(b.d)
  );
  return sorted[sorted.length - 1] || null;
});

function pickYear(y) {
  emit("update:year", y);
  emit("update:month", "");
  emit("update:day", "");
}
function pickMonth(m) {
  // 面板默认展示最新年份时 year 还没写进 filters，只 emit month 会变成
  // 「所有年份的这个月」；先把当前展示的年份一起写进去。
  emit("update:year", activeYear.value);
  emit("update:month", m);
  emit("update:day", "");
}
function pickDay(d) {
  // 再点一次选中的日期 → 取消
  const value = props.day === d ? "" : d;
  // 关键：面板默认展示「最新年/月」时，year/month 并没有真正写进 filters。
  // 只 emit day 会变成「18 日」这种跨月份筛选（9 月 18、10 月 18 都会命中）。
  if (value) {
    emit("update:year", activeYear.value);
    emit("update:month", activeMonth.value);
  }
  emit("update:day", value);
  emit("picked");
}

// 重置当前面板的日期筛选
function clearDate() {
  emit("update:year", "");
  emit("update:month", "");
  emit("update:day", "");
}

/** 直接跳到数据里最新的一天；比「年 → 月 → 日」点三次更适合日常使用。 */
function pickLatest() {
  if (!latestDate.value) return;
  emit("update:year", latestDate.value.y);
  emit("update:month", latestDate.value.m);
  emit("update:day", latestDate.value.d);
  emit("picked");
}
</script>

<template>
  <div class="date-filter">
    <div class="df-row-label">年份</div>
    <div class="df-chip-row">
      <button v-for="y in years" :key="y" type="button"
        :class="['chip', { active: activeYear === y }]"
        @click="pickYear(y)">{{ y }}</button>
    </div>

    <div class="df-row-label">月份</div>
    <div class="df-chip-row">
      <button v-for="m in months" :key="m" type="button"
        :class="['chip', { active: activeMonth === m }]"
        @click="pickMonth(m)">{{ Number(m) }} 月</button>
    </div>

    <!-- 日历：标题行 + 星期行 + 日期行 必须同一 7 列网格宽度 -->
    <div class="df-cal-head">
      <span>{{ activeYear }} 年 {{ Number(activeMonth) }} 月</span>
      <span class="df-cal-actions">
        <button
          v-if="latestDate"
          type="button"
          class="df-clear-link"
          :title="`跳到 ${latestDate.y}-${latestDate.m}-${latestDate.d}`"
          @click="pickLatest"
        >最新一天</button>
        <button type="button" class="df-clear-link" @click="clearDate">重置日期</button>
      </span>
    </div>
    <div class="df-calendar">
      <template v-for="(w, i) in WEEKDAYS" :key="'w' + i">
        <span class="df-week">{{ w }}</span>
      </template>
      <template v-for="i in firstWeekday" :key="'b' + i">
        <span class="df-empty"></span>
      </template>
      <template v-for="d in daysInMonth" :key="d">
        <button type="button"
          :class="['df-day', {
            on: activeDays.has(String(d).padStart(2, '0')),
            active: day === String(d).padStart(2, '0'),
          }]"
          :disabled="!activeDays.has(String(d).padStart(2, '0'))"
          :aria-label="`${Number(d)} 日`"
          @click="pickDay(String(d).padStart(2, '0'))">{{ d }}</button>
      </template>
    </div>
  </div>
</template>
