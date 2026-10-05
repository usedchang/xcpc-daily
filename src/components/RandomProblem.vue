<script setup>
/**
 * 「随机一题」面板。
 *
 * 与「每日一题」并列的第二个入口：不走站内 data/*.json，而是直接调 Codeforces
 * 公开 API 的题库随机抽题，支持按算法标签多选 + 分数区间筛选。
 *
 * 随机性由 useCfRandom 保证（不放回抽取：一轮之内绝不重复），本组件只负责展示
 * 「抽了什么」和「本轮抽到第几题了」——把这个计数摆在明面上，用户才能确认
 * 「每次点击都不同」不是口头承诺。
 */
import { computed, onMounted, onBeforeUnmount, ref } from "vue";
import { useCfRandom } from "../composables/useCfRandom.js";
import { useSolutionModal } from "../composables/useSolutionModal.js";
import { problemUrl } from "../data/cfProblems.js";
import { copyText } from "../utils/copy.js";
import RatingRange from "./RatingRange.vue";
import TagFilter from "./TagFilter.vue";

const props = defineProps({
  /**
   * 站内已收录题目的索引：CF 题 key（`<contestId><index>`）-> 每日一题条目。
   * 用来在抽到「本站发过」的题时标一下，并直接给一个看题解的入口。
   */
  archiveIndex: { type: Map, default: () => new Map() },
});

const {
  problems, tags, status, error, fromCache, bounds, filters,
  current, drawnInCycle, poolSize, ready, loading, hasTags,
  ratingStep, draw, ensureLoaded, autoLoad, resetCycle, clearFilters, toggleTag,
} = useCfRandom();

const { show: showSolution } = useSolutionModal();

const tagOpen = ref(false);
const copyState = ref(""); // "" | "done" | "fail"
let copyTimer = 0;

const nf = new Intl.NumberFormat("zh-CN");

const unratedCount = computed(() => problems.value.filter((p) => p.rating == null).length);

const poolText = computed(() =>
  ready.value ? `候选 ${nf.format(poolSize.value)} 题` : "题库未加载"
);

const tagSummary = computed(() => {
  const n = filters.tags.length;
  if (!n) return "全部标签";
  if (n <= 2) return filters.tags.join(" · ");
  return `已选 ${n} 个标签`;
});

/** 抽中的题目在站内发过没有（App.vue 传进来的索引）。 */
const archived = computed(() => (current.value ? props.archiveIndex.get(current.value.key) || null : null));

// 标签最多平铺 4 个，其余收成「+N」：CF 有题目带 6 个以上标签，
// 全铺开会折成两三行，结果卡的高度就跟着题目飘，整块面板忽高忽低。
const MAX_TAGS = 4;
const shownTags = computed(() => (current.value?.tags || []).slice(0, MAX_TAGS));
const restTags = computed(() => (current.value?.tags || []).slice(MAX_TAGS));
const extraTags = computed(() => restTags.value.length);

/** 抽中的题是否还落在当前筛选条件内：改完筛选没换题时提示一下，避免误读。 */
const currentInPool = computed(() =>
  current.value ? problems.value.length > 0 && poolSize.value > 0 && inPool(current.value) : true
);
function inPool(p) {
  if (filters.tags.length) {
    const own = p.tags || [];
    const hit = filters.tagMode === "any"
      ? filters.tags.some((t) => own.includes(t))
      : filters.tags.every((t) => own.includes(t));
    if (!hit) return false;
  }
  if (typeof p.rating === "number") {
    return p.rating >= filters.minRating && p.rating <= filters.maxRating;
  }
  return filters.includeUnrated;
}

const drawLabel = computed(() => {
  if (loading.value) return "正在加载题库…";
  if (status.value === "error") return "重试";
  if (current.value) return "换一题";
  return "随机一题";
});

const canDraw = computed(() => !loading.value && (status.value !== "ready" || poolSize.value > 0));

const resultUrl = computed(() => problemUrl(current.value));

async function onDraw() {
  tagOpen.value = false;
  copyState.value = "";
  await draw();
}

async function onRetry() {
  await ensureLoaded(true);
  if (status.value === "ready") await draw();
}

async function copyLink() {
  const ok = await copyText(resultUrl.value);
  copyState.value = ok ? "done" : "fail";
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyState.value = "";
  }, 1800);
}

function onTags(selected) {
  filters.tags = selected;
}

/** 重置筛选并重开一轮（筛选变了池子就变了，计数也从 0 起算）。 */
function resetAll() {
  clearFilters();
  resetCycle();
}

// 进页面就在空闲时把题库备好：本地有新鲜缓存直接可用，没有就后台拉一次。
// 放在 requestIdleCallback 里是为了不跟首屏渲染抢主线程（缓存解析要几十毫秒，
// 首次没有缓存时要下 1.7 MB）。
let idleHandle = 0;
onMounted(() => {
  const run = () => autoLoad();
  if (typeof window.requestIdleCallback === "function") {
    idleHandle = window.requestIdleCallback(run, { timeout: 1200 });
  } else {
    idleHandle = window.setTimeout(run, 200);
  }
});
onBeforeUnmount(() => {
  if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idleHandle);
  else window.clearTimeout(idleHandle);
  window.clearTimeout(copyTimer);
});
</script>

<template>
  <section class="cf-random">
    <!-- 标题右侧直接跟一句说明：原来它单独占一行，白白撑高了整块卡片，
         而下面那张「今日题目」比它矮一大截，视觉主次就反了。 -->
    <div class="cf-random-head">
      <h2 class="cf-random-title"><span aria-hidden="true">🎲</span> 随机一题</h2>
      <span class="cf-random-sub">Codeforces 全站题库 · 按标签与分数随机 · 同一轮内不会重复</span>
      <span class="cf-pool" :class="{ live: ready }">
        {{ poolText }}
        <em v-if="fromCache" class="cf-cache" title="来自本地缓存，最多 24 小时后自动刷新">缓存</em>
      </span>
    </div>

    <div class="cf-random-main">
      <!-- 左列：筛选条件 -->
      <div class="cf-filters">
        <div class="cf-field">
          <span class="cf-field-label">分数区间</span>
          <!-- 双滑块 + 数字输入框都由 RatingRange 提供：
               拖滑块是「大概哪个分段」，输入框是「精确要多少分」。 -->
          <RatingRange
            v-model:min="filters.minRating"
            v-model:max="filters.maxRating"
            :floor="bounds.min"
            :ceil="bounds.max"
            :step="ratingStep"
          />
        </div>

        <div class="cf-field">
          <!-- 标签名、选择器、匹配方式挤在同一行：原来「算法标签 + 匹配方式」
               单独占一行标题，白多出 30px 高度。 -->
          <div class="cf-tag-row">
            <span class="cf-field-label">算法标签</span>
            <button
              type="button" class="cf-tag-trigger" :class="{ lit: hasTags }"
              :aria-expanded="tagOpen" aria-controls="cf-tag-panel"
              @click="tagOpen = !tagOpen"
            >
              <span aria-hidden="true">🏷️</span>
              <span class="cf-tag-summary">{{ tagSummary }}</span>
              <span class="cf-caret" :class="{ open: tagOpen }" aria-hidden="true">▾</span>
            </button>
            <div class="cf-mode" role="group" aria-label="标签匹配方式">
              <button
                type="button" :class="{ active: filters.tagMode === 'all' }"
                :disabled="!hasTags" title="题目必须同时带有所有选中的标签"
                @click="filters.tagMode = 'all'"
              >全部满足</button>
              <button
                type="button" :class="{ active: filters.tagMode === 'any' }"
                :disabled="!hasTags" title="题目带有任意一个选中的标签即可"
                @click="filters.tagMode = 'any'"
              >任一满足</button>
            </div>
          </div>
          <div v-if="tagOpen" id="cf-tag-panel" class="cf-tag-panel">
            <TagFilter
              :tags="tags"
              :selected="filters.tags"
              hint="（多选 · 抽题池取交集或并集）"
              empty-text="题库还没加载，标签暂时是空的"
              @update:selected="onTags"
            />
          </div>
        </div>

        <div class="cf-foot-row">
          <label class="cf-check" title="未评级题目没有分数，勾选后不受分数区间限制">
            <input v-model="filters.includeUnrated" type="checkbox" />
            <span>包含未评级题目<em v-if="ready">（{{ nf.format(unratedCount) }}）</em></span>
          </label>
          <button type="button" class="cf-reset" @click="resetAll">重置筛选</button>
        </div>
      </div>

      <!-- 右列：抽取结果 -->
      <div class="cf-result" aria-live="polite">
        <article v-if="current" class="cf-card">
          <div class="cf-card-top">
            <span class="cf-card-id">{{ current.key }}</span>
            <span v-if="current.rating != null" class="badge diff">{{ current.rating }}</span>
            <span v-else class="badge">未评级</span>
            <span v-if="archived" class="badge archived" :title="`本站 ${archived.date} 的每日一题`">
              本站已收录
            </span>
            <!-- 抽取进度直接挂在卡片标题行右侧：单独占一行会把整块面板撑高，
                 而它只是个计数器，没必要占那么大地方 -->
            <span class="cf-cycle" :title="`本轮已抽 ${drawnInCycle} / ${nf.format(poolSize)} 题，抽完前不会重复`">
              本轮 <strong>{{ drawnInCycle }}</strong> / {{ nf.format(poolSize) }}
            </span>
          </div>

          <h3 class="cf-card-title">
            <a :href="resultUrl" target="_blank" rel="noopener">{{ current.name }}</a>
          </h3>

          <div class="badges cf-card-tags">
            <span v-for="t in shownTags" :key="t" class="badge">{{ t }}</span>
            <span v-if="extraTags" class="badge more" :title="restTags.join('、')">+{{ extraTags }}</span>
            <span v-if="!current.tags.length" class="muted">（这道题没有算法标签）</span>
          </div>

          <div class="cf-card-foot">
            <a class="btn" :href="resultUrl" target="_blank" rel="noopener">打开题目 ↗</a>
            <button type="button" class="btn ghost" @click="copyLink">
              {{ copyState === "done" ? "✓ 已复制" : copyState === "fail" ? "复制失败" : "复制链接" }}
            </button>
            <button v-if="archived" type="button" class="btn ghost" @click="showSolution(archived)">
              查看站内题解
            </button>
          </div>

          <p v-if="!currentInPool" class="cf-note">
            这题已不在当前筛选范围内，点「换一题」按新条件重抽。
          </p>
        </article>

        <!-- idle 也算「正在加载」：题库是进页面后自动备好的，用户不需要先点一下 -->
        <div v-else-if="loading || status === 'idle'" class="cf-placeholder">
          <span class="cf-spinner" aria-hidden="true"></span>
          正在加载 Codeforces 题库…<br />
          <small>约 1.1 万题、1.7 MB，只需拉一次，之后走本地缓存</small>
        </div>

        <div v-else-if="status === 'error'" class="cf-placeholder error">
          <strong>题库加载失败</strong>
          <small>{{ error }}</small>
          <small class="muted">需要能访问 codeforces.com；地区网络受限时可以稍后再试。</small>
        </div>

        <div v-else-if="ready && poolSize === 0" class="cf-placeholder">
          <strong>当前条件下一道题都没有</strong>
          <small>放宽分数区间，或把标签匹配改成「任一满足」。</small>
        </div>

        <div v-else class="cf-placeholder">
          <span class="cf-die" aria-hidden="true">🎲</span>
          <strong>题库已就绪</strong>
          <small>点下面的按钮，从 {{ nf.format(poolSize) }} 道候选里随机抽一题。</small>
        </div>

        <button
          type="button" class="btn cf-draw" :disabled="!canDraw"
          @click="status === 'error' ? onRetry() : onDraw()"
        >
          <span aria-hidden="true">🎲</span> {{ drawLabel }}
        </button>
      </div>
    </div>
  </section>
</template>
