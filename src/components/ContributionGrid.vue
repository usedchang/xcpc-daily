<script setup>
/**
 * GitHub 同款贡献热力图。
 *
 * 只负责画：日历数据由 useCheckin 的 buildCalendar 算好传进来。
 * 结构是「53 个周列 × 7 行」，列从周日开始、最后一列是本周，
 * 与 GitHub 个人主页的贡献图一致。
 *
 * 交互：点有记录（或今天）的格子，把下方列表筛成那一天；
 * 空白天不可点（没有内容可看），未来日期更不可点。
 */
import { nextTick, onMounted, ref } from "vue";
import { formatCnDate, weekdayOf } from "../utils/date.js";

const props = defineProps({
  calendar: { type: Object, required: true },
  selected: { type: String, default: "" },
});

const emit = defineEmits(["select"]);

const scroller = ref(null);

// 行 = 周日..周六；只标周一/三/五，和 GitHub 一样（否则 7 个标签太挤）
const WEEKDAY_LABELS = ["", "一", "", "三", "", "五", ""];
const LEVELS = [0, 1, 2, 3, 4];

function titleOf(cell) {
  if (cell.future) return `${cell.date} · 还没到`;
  const weekday = ["日", "一", "二", "三", "四", "五", "六"][weekdayOf(cell.date)];
  if (!cell.count) return `${formatCnDate(cell.date)} · 没有提交`;
  return `${formatCnDate(cell.date)} · ${cell.count} 次提交`;
}

function onClick(cell) {
  if (cell.future || (!cell.count && !cell.isToday)) return;
  emit("select", cell.date);
}

/** 默认滚到今天（最右列）；宽屏下不会出现滚动条，这一步没有副作用。 */
onMounted(() => {
  nextTick(() => {
    const el = scroller.value;
    if (el) el.scrollLeft = el.scrollWidth;
  });
});
</script>

<template>
  <div class="ck-grid-block">
    <div ref="scroller" class="ck-grid-scroll">
      <div
        class="ck-grid"
        role="grid"
        :aria-label="`过去一年打卡热力图：${calendar.range}，${calendar.activeDays} 天有提交`"
      >
        <div class="ck-weekdays" aria-hidden="true">
          <span v-for="(label, i) in WEEKDAY_LABELS" :key="i" class="ck-weekday">{{ label }}</span>
        </div>

        <div class="ck-weeks">
          <div v-for="week in calendar.weeks" :key="week.start" class="ck-week">
            <span v-if="week.label" class="ck-month">{{ week.label }}</span>
            <div class="ck-week-cells" role="row">
              <div
                v-for="cell in week.days"
                :key="cell.date"
                class="ck-cell"
                :class="[
                  `l${cell.level}`,
                  {
                    future: cell.future,
                    today: cell.isToday,
                    selected: cell.date === selected,
                    active: cell.count > 0 || cell.isToday,
                  },
                ]"
                role="gridcell"
                :aria-label="titleOf(cell)"
                :aria-selected="cell.date === selected"
                :tabindex="cell.count || cell.isToday ? 0 : -1"
                :title="titleOf(cell)"
                @click="onClick(cell)"
                @keydown.enter.prevent="onClick(cell)"
                @keydown.space.prevent="onClick(cell)"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="ck-legend">
      <span>少</span>
      <i v-for="level in LEVELS" :key="level" class="ck-cell" :class="`l${level}`"></i>
      <span>多</span>
      <span class="ck-legend-note">每格一天 · 颜色越深当天提交越多</span>
    </div>
  </div>
</template>
