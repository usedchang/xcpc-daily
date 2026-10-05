<script setup>
const props = defineProps({
  // 全部出现过的 tag：{ name, count }
  tags: { type: Array, default: () => [] },
  // 当前选中的 tag 名数组
  selected: { type: Array, default: () => [] },
  // 标题与副标题：站内筛选与「随机一题」的标签池语义不同（并集 vs 交集），
  // 文案由调用方给，免得同一个组件在两处说两套话。
  label: { type: String, default: "算法标签" },
  hint: { type: String, default: "（多选 · 命中任一所选即显示）" },
  emptyText: { type: String, default: "暂无标签数据" },
});

const emit = defineEmits(["update:selected"]);

function toggle(t) {
  const cur = new Set(props.selected);
  if (cur.has(t)) cur.delete(t);
  else cur.add(t);
  emit("update:selected", [...cur]);
}
</script>

<template>
  <div class="tag-filter">
    <div class="df-row-label">
      {{ label }}
      <span v-if="hint" class="muted">{{ hint }}</span>
    </div>
    <div class="tag-scroll" role="listbox" aria-label="算法标签筛选">
      <label v-for="t in tags" :key="t.name"
        :class="['tag-option', { active: selected.includes(t.name) }]">
        <input type="checkbox"
          :checked="selected.includes(t.name)"
          @change="toggle(t.name)" />
        <span class="tag-name">{{ t.name }}</span>
        <span class="tag-count">{{ t.count }}</span>
      </label>
      <div v-if="tags.length === 0" class="muted">{{ emptyText }}</div>
    </div>
  </div>
</template>
