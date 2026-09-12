<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { COMMUNITY, isGiscusReady, discussionTerm, discussionsUrl } from "../config/community.js";
import { useTheme } from "../composables/useState.js";

const props = defineProps({
  problem: { type: Object, default: null },
  /** 区块标题。弹窗里用默认的「讨论」；页面底部那份传「今日题目讨论」。 */
  heading: { type: String, default: "讨论" },
  /** 是否在标题旁标出对应题目。底部那份需要，弹窗里标题已经写了题目。 */
  showProblem: { type: Boolean, default: false },
  /** 是否在标题右侧放「全部讨论」外链。底部那份需要，弹窗里没必要。 */
  allDiscussionsLink: { type: Boolean, default: false },
});

const { dark } = useTheme();
const container = ref(null);

// 两种「没就绪」的含义完全不同，不能混为一谈：
//   configured=false  —— giscus 还没接线，要给出配置指引
//   ready=false       —— 配置没问题，只是题目数据还在路上（页面底部那份初始就会遇到）
const configured = computed(() => isGiscusReady());
const ready = computed(() => configured.value && Boolean(props.problem?.date));

/**
 * 挂载 giscus。
 *
 * 两个必须注意的点：
 *  1. 站点是 hash 路由，题目没有独立 pathname，所以 mapping 用 specific + term=problem-<date>；
 *  2. giscus 不支持动态改 term，换题目时必须整块重建脚本（清空容器再插 script），
 *     这也是这里不用 v-html/模板写死 script 标签的原因。
 */
function mount() {
  const el = container.value;
  if (!el || !ready.value) return;

  el.innerHTML = "";

  const g = COMMUNITY.giscus;
  const cfg = {
    repo: g.repo,
    "repo-id": g.repoId,
    category: g.category,
    "category-id": g.categoryId,
    mapping: g.mapping,
    term: discussionTerm(props.problem),
    "reactions-enabled": g.reactionsEnabled,
    "input-position": g.inputPosition,
    theme: dark.value ? "dark" : "light",
    lang: g.lang,
    loading: "lazy",
  };

  const s = document.createElement("script");
  s.src = "https://giscus.app/client.js";
  Object.entries(cfg).forEach(([k, v]) => {
    if (v !== "" && v != null) s.setAttribute(`data-${k}`, String(v));
  });
  s.async = true;
  s.crossOrigin = "anonymous";
  el.appendChild(s);
}

/** 主题切换：giscus 在 iframe 里，只能 postMessage 通知它改主题。 */
function syncTheme() {
  const iframe = container.value?.querySelector("iframe.giscus-frame");
  iframe?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme: dark.value ? "dark" : "light" } } },
    "https://giscus.app"
  );
}

onMounted(() => nextTick(mount));
onBeforeUnmount(() => {
  if (container.value) container.value.innerHTML = "";
});

// term 由 problem.date 决定，日期变了才需要重建整块 iframe
watch(() => props.problem?.date, () => nextTick(mount));
watch(dark, () => nextTick(syncTheme));
</script>

<template>
  <section class="community-block community-comments">
    <div class="community-head">
      <span>{{ heading }}</span>
      <span v-if="showProblem && problem && problem.date" class="community-sub">
        {{ problem.date }} · {{ problem.title }}
      </span>
      <!-- 只在 giscus 配置完成后才给这个外链：仓库没开 Discussions 时该路径是 404 -->
      <a
        v-if="allDiscussionsLink && configured"
        class="community-head-link"
        :href="discussionsUrl()"
        target="_blank"
        rel="noopener"
      >
        全部讨论 ↗
      </a>
    </div>

    <div v-if="ready" ref="container" class="giscus-host"></div>

    <p v-else-if="configured" class="muted community-hint">正在加载题目信息…</p>

    <p v-else class="muted community-hint">
      评论区尚未配置。在 <code>src/config/community.js</code> 里填入 giscus 的
      <code>repoId</code> 与 <code>categoryId</code>（于
      <a href="https://giscus.app" target="_blank" rel="noopener">giscus.app</a>
      选择本仓库后生成）即可启用；前置条件：仓库 public、已开启 Discussions、
      已安装 giscus App（需勾选 <code>discussions:write</code> 以便自动建帖）。
    </p>
  </section>
</template>
