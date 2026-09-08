<script setup>
import { esc } from "../utils.js";
import { hasEditorial } from "../data/solutions.js";
import { useSolutionModal } from "../composables/useSolutionModal.js";

defineProps({
  problems: { type: Array, default: () => [] },
});

const { show } = useSolutionModal();

function rowKey(p) {
  return `${p.date}'|'${p.title}`;
}

function has(p) {
  return hasEditorial(p);
}

function badges(p) {
  const parts = [];
  if (p.difficulty) parts.push(`<span class="badge diff">${esc(p.difficulty)}</span>`);
  (p.tags || []).forEach((t) => parts.push(`<span class="badge">${esc(t)}</span>`));
  return parts.length ? parts.join(" ") : "";
}
</script>

<template>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>日期</th>
          <th>来源</th>
          <th>题目</th>
          <th>链接</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="problems.length === 0">
          <td colspan="4" class="muted">没有匹配的题目。</td>
        </tr>
        <tr v-for="p in problems" :key="rowKey(p)">
          <td class="muted">{{ p.date }}</td>
          <td>{{ p.source }}</td>
          <td class="pro">
            <a :href="p.link" target="_blank" rel="noopener">{{ p.title }}</a>
            <span v-if="p.difficulty || (p.tags && p.tags.length)" class="badges" v-html="badges(p)"></span>
          </td>
          <td>
            <a :href="p.link" target="_blank" rel="noopener">{{ p.link }}</a>
            <button
              v-if="has(p)"
              type="button"
              class="solution-toggle"
              @click="show(p)"
            >
              题解 ▾
            </button>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
