<script setup>
import { onMounted, onBeforeUnmount } from "vue";
import { useSolutionModal } from "../composables/useSolutionModal.js";
import SolutionPanel from "./SolutionPanel.vue";
import CommunitySolutions from "./CommunitySolutions.vue";
import CommentSection from "./CommentSection.vue";

const { problem, open, close } = useSolutionModal();

function onKeydown(e) {
  if (e.key === "Escape") close();
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));
</script>

<template>
  <Teleport to="body">
    <Transition name="solution-modal">
      <div v-if="open" class="solution-modal" @click.self="close">
        <div class="solution-modal-dialog" role="dialog" aria-modal="true">
          <header class="solution-modal-head">
            <div class="solution-modal-title">
              <span class="solution-modal-date">{{ problem.date }}</span>
              <span>{{ problem.title }}</span>
            </div>
            <button type="button" class="solution-modal-close" @click="close" aria-label="关闭">✕</button>
          </header>
          <div class="solution-modal-body">
            <SolutionPanel :problem="problem" />
            <CommunitySolutions :problem="problem" />
            <!-- giscus 的 specific + term 只在脚本首次初始化时读取。
                 按日期重建组件，避免连续点击不同题解时复用旧 iframe。 -->
            <CommentSection :key="problem.date" :problem="problem" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
