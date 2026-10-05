<script setup>
import { computed } from "vue";
import { hasEditorial } from "../data/solutions.js";
import { useSolutionModal } from "../composables/useSolutionModal.js";

const props = defineProps({
  problem: { type: Object, default: null },
  /** 北京时间的今天（`YYYY-MM-DD`）：用来判断这张卡到底是「今日」还是「最近一题」。 */
  today: { type: String, default: "" },
  /** 上一道已发布的题：卡片底部的「上一题」快捷入口。 */
  previous: { type: Object, default: null },
  /** 站内已收录题目总数。 */
  total: { type: Number, default: 0 },
});

const hasSolution = computed(() => hasEditorial(props.problem));
const isToday = computed(() => Boolean(props.problem) && props.problem.date === props.today);

// 今天没发题（或维护者提前预置了未来的题）时不能再写 TODAY：
// 卡片显示的是最近一道**已发布**的题，标签必须说实话。
const label = computed(() =>
  isToday.value ? "TODAY · 今日题目" : `最近一题 · ${props.problem?.date || ""}`
);

const { show } = useSolutionModal();
</script>

<template>
  <section v-if="problem" class="latest">
    <div class="latest-head">
      <div class="label">{{ label }}</div>
      <!-- 期号 = 已发布题数（第 1 期是最早那题）：给「每日一题」这个连续企划一个刻度 -->
      <span v-if="total" class="latest-issue">第 {{ total }} 期</span>
    </div>
    <div class="title">{{ problem.title }}</div>
    <div class="meta">
      <span class="meta-date">{{ problem.date }}</span> · {{ problem.source }}
      <span v-if="problem.difficulty || (problem.tags && problem.tags.length)" class="badges">
        <span v-if="problem.difficulty" class="badge diff">{{ problem.difficulty }}</span>
        <span v-for="t in problem.tags || []" :key="t" class="badge">{{ t }}</span>
      </span>
    </div>
    <div class="latest-actions">
      <a class="btn" :href="problem.link" target="_blank" rel="noopener">打开题目 ↗</a>
      <button type="button" class="btn ghost" @click="show(problem)">
        {{ hasSolution ? "查看题解" : "讨论 / 投稿" }}
      </button>
    </div>

    <!-- 卡片底部：上一题的快捷入口 + 收录总数。
         「今日题目」是本站的主体，这张卡不能比下面的工具面板还单薄，
         所以在这里补一行真正有用的信息，而不是靠留白把卡片撑高。 -->
    <div class="latest-foot">
      <a
        v-if="previous"
        class="latest-prev"
        :href="previous.link"
        target="_blank"
        rel="noopener"
        :title="`上一题：${previous.title}`"
      >
        <span class="latest-prev-label">上一题</span>
        <span class="latest-prev-date">{{ previous.date }}</span>
        <span class="latest-prev-title">{{ previous.title }}</span>
        <span class="latest-prev-arrow" aria-hidden="true">↗</span>
      </a>
      <span v-else class="latest-prev-empty">这是收录的第一题</span>

      <span v-if="total" class="latest-total">共收录 <strong>{{ total }}</strong> 题</span>
    </div>
  </section>
</template>
