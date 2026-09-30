<script setup>
import { linkHost } from "../utils.js";
import { hasEditorial } from "../data/solutions.js";
import { useSolutionModal } from "../composables/useSolutionModal.js";

defineProps({
  problems: { type: Array, default: () => [] },
});

const { show } = useSolutionModal();

/** 每题的日期唯一（数据层已校验），直接拿来当 key。 */
function rowKey(p) {
  return p.date;
}

function has(p) {
  return hasEditorial(p);
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th class="cell-date">日期</th>
          <th>来源</th>
          <th>题目</th>
          <th class="cell-solution">题解</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="problems.length === 0">
          <td colspan="4" class="muted">没有匹配的题目。</td>
        </tr>
        <tr v-for="p in problems" :key="rowKey(p)">
          <td class="cell-date muted">{{ p.date }}</td>
          <td class="cell-source">
            {{ p.source }}
            <span v-if="linkHost(p.link)" class="src-host">{{ linkHost(p.link) }}</span>
          </td>
          <td class="pro">
            <!-- 整行只有这一个外链：链接列原本打印的完整 URL 与它同址，是重复信息。
                 窄屏下日期列会被隐藏（见 style.css 的 690px 断点），所以日期也放进 title。 -->
            <a :href="p.link" target="_blank" rel="noopener" :title="`${p.date} · ${p.link}`">{{ p.title }}</a>
            <span v-if="p.difficulty || (p.tags && p.tags.length)" class="badges">
              <span v-if="p.difficulty" class="badge diff">{{ p.difficulty }}</span>
              <span v-for="t in p.tags || []" :key="t" class="badge">{{ t }}</span>
            </span>
          </td>
          <td class="cell-solution">
            <!-- 每道题都可进弹窗：没有官方题解时这一栏就是「讨论 / 投稿」的入口，
                 否则评论区只能用在少数有官方题解的题上 -->
            <button type="button" class="solution-toggle" :aria-label="`${has(p) ? '查看题解' : '打开讨论'}：${p.title}`" @click="show(p)">
              {{ has(p) ? "题解" : "讨论" }}
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
