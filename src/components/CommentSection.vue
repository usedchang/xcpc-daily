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

/**
 * 加载状态机：idle -> loading -> ready | failed。
 *
 * giscus 的加载方式是「往容器里插一个 <script>，由脚本自己再插 iframe」，失败时页面
 * 不报任何错，只留一段空白。常见失败原因是 giscus.app 被广告拦截 / 隐私插件拦掉
 * （该域名在若干过滤列表里），或网络、网关故障。没有这个状态机，读者只会看到一片
 * 空白，既不知道发生了什么，也找不到别的入口去评论。
 *
 * 判定「真的起来了」只以「容器里出现了 iframe」为准：
 *   - iframe 的 load 事件在跨域场景下不可靠（contentDocument 受跨域策略保护，
 *     连 readyState 都读不到，也不能假定 load 一定触发）；
 *   - giscus 的 postMessage 可能比监听器更早发出，同样不能单独依赖。
 * 于是超时只兜一种情况：什么都没插进来（被拦截 / 断网）；脚本自身的 error 事件
 * 则让它立刻失败，不用等满超时。
 */
const state = ref("idle");
const IFRAME_TIMEOUT = 8000;

let iframeTimer = 0;
let observer = null;

function setState(next) {
  state.value = next;
}

function markReady() {
  window.clearTimeout(iframeTimer);
  setState("ready");
}

function fail() {
  window.clearTimeout(iframeTimer);
  setState("failed");
}

function stopWatching() {
  observer?.disconnect();
  observer = null;
}

/**
 * 清掉页面上不属于本容器的 giscus 容器（`.giscus`）。
 *
 * client.js 找挂载点用的是 document.querySelector(".giscus") —— 全文档**第一个**，
 * 而不是它自己那个 `<script>` 的父节点（源码：`d = document.querySelector(".giscus")`，
 * 之后 `d.appendChild(iframe)` 或 `m.insertAdjacentElement("afterend", d)`）。
 * 于是页面上只要还留着上一份容器 —— 另一个 CommentSection，或者正在跑退场动画、
 * 还没卸载的那份 —— 新 iframe 就会被插进旧容器里：旧的那份显示成这一题的讨论，
 * 自己的容器永远空着，8 秒后还会误报「评论区加载失败」（看着像被广告拦截）。
 *
 * 挂载前先扫一遍：谁最后挂载谁拿到容器，不再依赖两份组件谁先谁后的运气。
 * 代价是「同页最多一个 CommentSection」——这条由调用方保证（见 App.vue 的
 * bottomProblem：弹窗打开时页面底部那份整个让位）；违反它会把别处的 iframe 拆掉。
 */
function dropForeignContainers(el) {
  document.querySelectorAll(".giscus").forEach((node) => {
    if (!el.contains(node)) node.remove();
  });
}

/**
 * 挂载 giscus。
 *
 * 三个必须注意的点：
 *  1. 站点是 hash 路由，题目没有独立 pathname，所以 mapping 用 specific + term=problem-<date>；
 *  2. giscus 不支持动态改 term，换题目时必须整块重建脚本（清空容器再插 script），
 *     这也是这里不用 v-html/模板写死 script 标签的原因；
 *  3. 挂载点是 client.js 自己在全文档里挑的，不一定是我们的容器（见 dropForeignContainers）。
 */
function mount() {
  window.clearTimeout(iframeTimer);
  stopWatching();

  const el = container.value;
  // 题目数据还没到（页面底部那份初始就是这种情况）：别留下上一题的加载态
  if (!el || !ready.value) {
    setState("idle");
    return;
  }

  el.innerHTML = "";
  setState("loading");
  dropForeignContainers(el);

  observer = new MutationObserver(() => {
    if (el.querySelector("iframe")) {
      markReady();
      return;
    }
    // iframe 又被摘走了（容器被别处抢走 / 被清理）：状态机不能停在 ready，
    // 否则页面上留下的是一块没有任何提示的空白 —— 正是这个状态机要消灭的东西。
    if (state.value === "ready") fail();
  });
  observer.observe(el, { childList: true, subtree: true });

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
  // 脚本本身就没拿到（被拦截 / 断网）：不必等满超时
  s.addEventListener("error", () => {
    if (el.contains(s)) fail();
  });
  el.appendChild(s);

  iframeTimer = window.setTimeout(() => {
    if (!el.querySelector("iframe")) fail();
  }, IFRAME_TIMEOUT);
}

/** 主题切换：giscus 在 iframe 里，只能 postMessage 通知它改主题。 */
function syncTheme() {
  const iframe = container.value?.querySelector("iframe.giscus-frame");
  iframe?.contentWindow?.postMessage(
    { giscus: { setConfig: { theme: dark.value ? "dark" : "light" } } },
    "https://giscus.app"
  );
}

/** 重试：拦截插件临时关掉后不用刷新页面，清空容器再整块重建一次。 */
function retry() {
  nextTick(mount);
}

// 两种「没就绪」的含义完全不同，提示文案也完全不同：
//   configured=false  —— giscus 还没接线，要给出配置指引
//   ready=false       —— 配置没问题，只是题目数据还在路上（页面底部那份初始就会遇到）
const configured = computed(() => isGiscusReady());
const ready = computed(() => configured.value && Boolean(props.problem?.date));

/**
 * 讨论区下方的状态提示：不需要时返回空串。
 *
 * 这里刻意用「一个计算属性 + 一个 <p v-if="hint">」而不是 v-if / v-else-if 分支链：
 * 分支链一旦有一条写成无条件 v-else，就会出现「giscus 已经渲染好了、下面却还挂着
 * 一句加载提示」的鬼状态，而且极难从渲染结果反推是哪条分支赢了。
 */
const hint = computed(() => {
  if (!configured.value) return "unconfigured";
  if (!ready.value) return "pending"; // 题目数据还没到
  if (state.value === "failed") return "failed";
  if (state.value === "ready") return ""; // iframe 起来了，不用再提示
  return "loading";
});
const discussionUrl = computed(() =>
  ready.value ? `${discussionsUrl()}/${discussionTerm(props.problem)}` : discussionsUrl()
);

onMounted(() => {
  nextTick(mount);
});
onBeforeUnmount(() => {
  window.clearTimeout(iframeTimer);
  stopWatching();
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

    <!-- 容器始终留在 DOM 里：giscus 要往它里面插 iframe，失败时也只有它是「真」的挂载点 -->
    <div v-if="ready" ref="container" class="giscus-host"></div>

    <p v-if="hint === 'unconfigured'" class="muted community-hint">
      评论区尚未配置。在 <code>src/config/community.js</code> 里填入 giscus 的
      <code>repoId</code> 与 <code>categoryId</code>（于
      <a href="https://giscus.app" target="_blank" rel="noopener">giscus.app</a>
      选择本仓库后生成）即可启用；前置条件：仓库 public、已开启 Discussions、
      已安装 giscus App（需勾选 <code>discussions:write</code> 以便自动建帖）。
    </p>

    <p v-else-if="hint === 'pending'" class="muted community-hint">正在加载题目信息…</p>

    <p v-else-if="hint === 'loading'" class="muted community-hint">评论区加载中…</p>

    <p v-else-if="hint === 'failed'" class="muted community-hint">
      评论区加载失败，通常是 <code>giscus.app</code> 被广告拦截 / 隐私插件挡掉了（该域名在若干过滤列表里），
      也可能是网络暂时不通。
      <button type="button" class="community-retry" @click="retry">重试</button>
      <a :href="discussionUrl" target="_blank" rel="noopener">在 GitHub 上打开本页讨论 ↗</a>
    </p>
  </section>
</template>
