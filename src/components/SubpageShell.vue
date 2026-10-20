<script setup>
/**
 * 子页面外壳：主题按钮 / GitHub 角标 / 标题 / 返回导航 / footer。
 *
 * 每日打卡和随机一题之前各自复制了一套 header + footer + document.title
 * 生命周期；差异只有标题、副标题、另一个子页面链接和页脚，抽到这里。
 */
import { computed, onBeforeUnmount, onMounted } from "vue";
import ThemeToggle from "./ThemeToggle.vue";
import GithubCorner from "./GithubCorner.vue";

const props = defineProps({
  title: { type: String, required: true },
  subtitle: { type: String, default: "" },
  footer: { type: String, default: "" },
  /** 另一个子页面的链接，例如 /random 或 /checkin */
  otherTo: { type: String, required: true },
  otherLabel: { type: String, required: true },
  /** 页面级 class，用于保留 checkin-page / random-page 语义 */
  pageClass: { type: String, default: "" },
});

const SITE_TITLE = "XCPC 每日一题";
const documentTitle = computed(() => `${props.title} · ${SITE_TITLE}`);

onMounted(() => {
  document.title = documentTitle.value;
});

onBeforeUnmount(() => {
  document.title = SITE_TITLE;
});
</script>

<template>
  <div class="wrap subpage" :class="pageClass">
    <GithubCorner />
    <header class="subpage-head">
      <ThemeToggle />
      <h1><span class="brand">XCPC</span> {{ title }}</h1>
      <p class="site-sub">{{ subtitle }}</p>
      <nav class="site-nav" aria-label="页面导航">
        <router-link to="/">← 返回每日一题</router-link>
        <router-link :to="otherTo">{{ otherLabel }}</router-link>
      </nav>
    </header>

    <slot />

    <footer v-if="footer">{{ footer }}</footer>
  </div>
</template>
