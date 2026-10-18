<script setup>
/**
 * 路由根组件：只负责渲染当前路由页面。
 *
 * 之前 createApp(App) 直接把每日一题页当成了根组件，路由加多少条都不会
 * 真正切换页面；拆出 RouterView 后，/ 与 /random 才是真正的两个页面。
 */
</script>

<template>
  <router-view />
</template>
