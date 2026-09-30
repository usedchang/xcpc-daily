<script setup>
/**
 * 右下角「分享每日一题」悬浮按钮。
 *
 * 点击后把最近的题目一键复制成一段可直接粘到 QQ 群 / 微信群 / 博客的文本：
 *
 *   每日一题：
 *   (20260930) :https://...
 *   (20260929) :https://...
 *   往期每日一题访问链接：https://usedchang.github.io/xcpc-daily/#/
 *
 * 「最近」的取法：北京时间今天 + 昨天（今天没有题目时自动往前顺延，见 shareProblems）。
 */
import { computed, ref, watch } from "vue";
import { SITE } from "../config/site.js";
import { copyText } from "../utils/copy.js";
import { compactDate, previousDate, problemDate } from "../utils.js";

const props = defineProps({
  /** 已发布题目列表（date <= 今天），顺序不限，这里会自己排序过滤。 */
  problems: { type: Array, default: () => [] },
  /** 北京时间的今天（`YYYY-MM-DD`），由 App.vue 统一计算后传入。 */
  today: { type: String, default: "" },
});

/** 只考虑今天与昨天这两个日期。 */
const wantedDates = computed(() => {
  const today = problemDate({ date: props.today });
  if (!today) return new Set();
  const yesterday = previousDate(today);
  return new Set([today, yesterday].filter(Boolean));
});

/**
 * 分享里要列出的题目：今天 + 昨天各取最新一条，按日期倒序。
 * 某一天没有题目（例如漏发）就只列另一天，不会空着一行。
 */
const shareProblems = computed(() =>
  props.problems
    .filter((p) => wantedDates.value.has(problemDate(p)))
    .sort((a, b) => problemDate(b).localeCompare(problemDate(a)))
);

/** 复制到剪贴板的完整文本。 */
const shareText = computed(() => {
  const lines = ["每日一题："];
  for (const p of shareProblems.value) {
    lines.push(`(${compactDate(p.date)}) :${String(p.link || "").trim()}`);
  }
  lines.push(`往期每日一题访问链接：${SITE.homepage}`);
  return lines.join("\n");
});

const state = ref(""); // "" | "done" | "fail"
let timer = 0;

// 文案随日期/题目变化时，把上一次的复制反馈收回来
watch(shareText, () => {
  state.value = "";
  window.clearTimeout(timer);
});

async function share() {
  const ok = await copyText(shareText.value);
  state.value = ok ? "done" : "fail";
  window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    state.value = "";
  }, 2200);
}
</script>

<template>
  <div v-if="shareProblems.length" class="share-daily">
    <span class="share-tip" role="status" aria-live="polite">
      <template v-if="state === 'done'">✓ 已复制，去粘贴吧</template>
      <template v-else-if="state === 'fail'">复制失败，请手动复制</template>
      <template v-else>复制「每日一题」分享文本</template>
    </span>
    <button
      type="button"
      class="share-btn"
      :class="state"
      :aria-label="`复制${SITE.name}分享文本`"
      :title="`复制最近两天的题目链接（${shareProblems.length} 条）`"
      @click="share"
    >
      <svg class="share-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path
          d="M18 16.1a3 3 0 0 0-2.1.9l-7.1-4.1a3.3 3.3 0 0 0 0-1.8l7-4.1a3 3 0 1 0-1-2.2c0 .3 0 .6.1.9L7.8 9.7a3 3 0 1 0 0 4.6l7.1 4.1c-.1.3-.1.6-.1.9A3 3 0 1 0 18 16.1Z"
        />
      </svg>
      <span class="share-label">share</span>
    </button>
  </div>
</template>
