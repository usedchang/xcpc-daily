<script setup>
const props = defineProps({
  // 全部出现过的 tag：{ name, count }
  tags: { type: Array, default: () => [] },
  // 当前选中的 tag 名数组
  selected: { type: Array, default: () => [] },
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
      算法标签
      <span class="muted">（多选 · 命中任一所选即显示）</span>
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
      <div v-if="tags.length === 0" class="muted">暂无标签数据</div>
    </div>
  </div>
</template>
