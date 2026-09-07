<script setup>
import { esc } from "../utils.js";

const props = defineProps({
  problems: { type: Array, default: () => [] },
});

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
        <tr v-for="p in problems" :key="p.date + '-' + p.title">
          <td class="muted">{{ p.date }}</td>
          <td>{{ p.source }}</td>
          <td class="pro">
            <a :href="p.link" target="_blank" rel="noopener">{{ p.title }}</a>
            <span v-if="p.difficulty || (p.tags && p.tags.length)" class="badges" v-html="badges(p)"></span>
          </td>
          <td><a :href="p.link" target="_blank" rel="noopener">{{ p.link }}</a></td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
