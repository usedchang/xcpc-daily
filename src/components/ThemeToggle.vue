<script setup>
import { useTheme } from "../composables/useState.js";

const { dark, toggle } = useTheme();
</script>

<template>
  <button class="theme-toggle" type="button" @click="toggle"
    :aria-label="dark ? '切换到护眼主题' : '切换到暗色主题'">
    {{ dark ? "🌞 切换到护眼" : "🌙 切换到暗色" }}
  </button>
</template>
