<script setup>
/**
 * 「每日打卡」区块。
 *
 * 结构：身份/同步状态 → 今天打卡入口 → 表单 → 统计 → 绿色热力图 → 提交列表。
 * 所有数据与持久化逻辑在 useCheckin，这里只负责把状态拼成页面。
 */
import { computed, onBeforeUnmount, ref } from "vue";
import { useCheckin } from "../composables/useCheckin.js";
import { todayInBeijing } from "../utils/date.js";
import { CHECKIN } from "../config/checkin.js";
import { REGISTRATION_MARKER, buildRegistrationIssueUrl } from "../data/leaderboard-core.js";
import { copyText } from "../utils/copy.js";
import GithubLogin from "./GithubLogin.vue";
import ContributionGrid from "./ContributionGrid.vue";
import CheckinForm from "./CheckinForm.vue";
import CheckinList from "./CheckinList.vue";

const props = defineProps({
  today: { type: String, default: "" },
  /** 最近一道已发布的每日一题：用来显示「今日 / 最近一题」。 */
  problem: { type: Object, default: null },
  /** 全部已发布的每日一题：打卡表单的日期与题目都从这里选。 */
  problems: { type: Array, default: () => [] },
});

const {
  today,
  selectedDate,
  formOpen,
  formSeed,
  notice,
  noticeKind,
  storageError,
  sync,
  calendar,
  stats,
  todayCount,
  visibleRecords,
  addCheckin,
  removeCheckin,
  openForm,
  closeForm,
  selectDate,
  clearSelectedDate,
  syncNow,
  viewer,
  leaderboard,
  leaderboardPublic,
  leaderboardGistId,
  setLeaderboardPublic,
  syncLeaderboardSnapshot,
} = useCheckin(() => props.today || todayInBeijing());

const formErrors = ref({});
const formError = ref("");
const leaderboardBusy = ref(false);
const publishError = ref("");
const copyState = ref("");
let copyTimer = 0;
onBeforeUnmount(() => window.clearTimeout(copyTimer));

const registrationUrl = computed(() =>
  buildRegistrationIssueUrl({
    repo: CHECKIN.leaderboard.repo,
    login: viewer.value?.login || "",
    gistId: leaderboardGistId.value,
  })
);

const registrationText = computed(() => {
  const login = viewer.value?.login || "";
  const gistId = leaderboardGistId.value;
  if (!login || !gistId) return "";
  return `${REGISTRATION_MARKER}\n\n\`\`\`json\n${JSON.stringify(
    { login, gistId },
    null,
    2
  )}\n\`\`\``;
});

async function onToggleLeaderboard(event) {
  if (leaderboardBusy.value) return;
  const desired = Boolean(event.target.checked);
  publishError.value = "";
  leaderboardBusy.value = true;
  try {
    const result = await setLeaderboardPublic(desired);
    if (!result.ok) {
      publishError.value = result.error || leaderboard.message || "操作失败";
      event.target.checked = leaderboardPublic.value;
    }
  } finally {
    leaderboardBusy.value = false;
  }
}

async function retryLeaderboard() {
  leaderboardBusy.value = true;
  publishError.value = "";
  try {
    const ok = await syncLeaderboardSnapshot();
    if (!ok) publishError.value = leaderboard.message || "公开快照更新失败";
  } finally {
    leaderboardBusy.value = false;
  }
}

async function copyRegistration() {
  const ok = await copyText(registrationText.value);
  copyState.value = ok ? "已复制" : "复制失败";
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyState.value = "";
  }, 1800);
}

const todayProblem = computed(
  () => props.problems.find((p) => p.date === today.value) || null
);

/** 补卡默认打开「最近一个已经发过的过去日期」，没发题的日子不参与。 */
const pastProblems = computed(() =>
  props.problems
    .filter((p) => p.date < today.value)
    .sort((a, b) => b.date.localeCompare(a.date))
);

const focusProblem = computed(() => todayProblem.value || props.problem || null);

const problemLabel = computed(() => {
  if (!focusProblem.value) return "";
  return todayProblem.value
    ? "今日题目"
    : `最近一题 · ${focusProblem.value.date}`;
});

function resetFormErrors() {
  formErrors.value = {};
  formError.value = "";
}

function openToday() {
  if (!todayProblem.value) return;
  resetFormErrors();
  openForm({ date: today.value, problem: todayProblem.value });
}

function openBackfill() {
  const target = pastProblems.value[0];
  if (!target) return;
  resetFormErrors();
  openForm({ date: target.date, problem: target });
}

function cancelForm() {
  resetFormErrors();
  closeForm();
}

function onSubmit(payload) {
  const result = addCheckin(payload);
  if (!result.ok) {
    formErrors.value = result.errors || {};
    formError.value = result.error || "";
    return;
  }
  resetFormErrors();
}

function onFormChange() {
  if (Object.keys(formErrors.value).length || formError.value) resetFormErrors();
}
</script>

<template>
  <section class="ck-panel" aria-labelledby="ck-title">
    <header class="ck-head">
      <div class="ck-head-text">
        <h2 id="ck-title" class="ck-title">
          <span class="ck-logo" aria-hidden="true">
            <i v-for="n in 9" :key="n" :class="`c${n}`"></i>
          </span>
          打卡记录
        </h2>
        <p class="ck-sub">把每天的提交记下来 · 用 Green Squares 看自己坚持了多久</p>
      </div>
      <GithubLogin :sync="sync" />
    </header>

    <!-- 公开到排行榜：只发布统计数字，完整题解始终留在私有 Gist -->
    <div v-if="viewer && CHECKIN.leaderboard.enabled" class="ck-publish">
      <label class="ck-publish-toggle">
        <input
          type="checkbox"
          :checked="leaderboardPublic"
          :disabled="leaderboardBusy || leaderboard.state === 'saving'"
          @change="onToggleLeaderboard"
        />
        <span class="ck-switch" aria-hidden="true"><i></i></span>
        <span>公开到排行榜</span>
      </label>
      <span class="ck-publish-hint">
        {{ leaderboardPublic
          ? "只公开连续天数 / 打卡天数 / 累计提交，不公开题解"
          : "只发布统计快照；题解和提交链接保持私有" }}
      </span>

      <template v-if="leaderboardPublic">
        <a
          v-if="registrationUrl"
          class="ck-text-btn"
          :href="registrationUrl"
          target="_blank"
          rel="noopener"
        >登记到排行榜 ↗</a>
        <button
          v-if="registrationText"
          type="button"
          class="ck-text-btn"
          @click="copyRegistration"
        >{{ copyState || "复制登记信息" }}</button>
      </template>

      <span v-if="leaderboard.state === 'saving'" class="ck-publish-state">更新中…</span>
      <span v-else-if="leaderboard.state === 'saved'" class="ck-publish-state ok">已公开统计</span>
      <button
        v-else-if="leaderboard.state === 'error'"
        type="button"
        class="ck-text-btn"
        :disabled="leaderboardBusy"
        @click="retryLeaderboard"
      >更新失败，重试</button>

      <span v-if="publishError" class="ck-publish-error">{{ publishError }}</span>
    </div>

    <div v-if="sync.state === 'error'" class="ck-alert" role="alert">
      <span>{{ sync.message }}</span>
      <button type="button" class="ck-text-btn" @click="syncNow">重试同步</button>
    </div>

    <div class="ck-hero">
      <div class="ck-hero-main">
        <span class="ck-hero-kicker">
          <i class="ck-dot" :class="{ on: todayCount > 0 }" aria-hidden="true"></i>
          {{ todayCount > 0 ? "今天已打卡" : "今天还没打卡" }} · {{ today }}
        </span>
        <div v-if="focusProblem" class="ck-hero-problem">
          <span class="ck-hero-label">{{ problemLabel }}</span>
          <a :href="focusProblem.link" target="_blank" rel="noopener">{{ focusProblem.title }}</a>
          <span class="ck-hero-source">{{ focusProblem.source }}</span>
        </div>
        <p v-else class="ck-hero-problem muted">站内还没有题目，先发一道题吧。</p>
        <p v-if="focusProblem && !todayProblem" class="ck-hero-wait">
          今天还没有发题，打卡要等今天的题目发布。
        </p>
      </div>

      <div class="ck-hero-actions">
        <span v-if="todayCount" class="ck-done">今日 {{ todayCount }} 次提交</span>
        <button
          v-if="todayProblem"
          type="button"
          class="btn"
          @click="openToday"
        >{{ todayCount ? "再记一次" : "打卡" }}</button>
        <button
          type="button"
          class="btn ghost"
          :disabled="!pastProblems.length"
          :title="pastProblems.length ? '' : '还没有可补的往期题目'"
          @click="openBackfill"
        >补卡</button>
      </div>
    </div>

    <CheckinForm
      v-if="formOpen"
      :today="today"
      :problems="problems"
      :seed="formSeed"
      :errors="formErrors"
      :error="formError"
      @submit="onSubmit"
      @cancel="cancelForm"
      @change="onFormChange"
    />

    <div class="ck-stats" aria-label="打卡统计">
      <div class="ck-stat" title="今天有记录就从今天往前算；今天还没打卡则从昨天往前算">
        <strong>{{ stats.currentStreak }}</strong>
        <span>当前连续 <em>天</em></span>
      </div>
      <div class="ck-stat">
        <strong>{{ stats.longestStreak }}</strong>
        <span>最长连续 <em>天</em></span>
      </div>
      <div class="ck-stat">
        <strong>{{ stats.activeDays }}</strong>
        <span>打卡天数</span>
      </div>
      <div class="ck-stat">
        <strong>{{ stats.total }}</strong>
        <span>累计提交</span>
      </div>
    </div>

    <div class="ck-grid-card">
      <div class="ck-grid-head">
        <span class="ck-grid-title">过去一年</span>
        <span class="ck-grid-range">{{ calendar.range }}</span>
        <span class="ck-grid-summary">
          {{ calendar.activeDays }} 天有提交 · {{ calendar.submissions }} 次
        </span>
        <button
          v-if="selectedDate"
          type="button"
          class="ck-text-btn ck-grid-clear"
          @click="clearSelectedDate"
        >清除 {{ selectedDate }}</button>
      </div>
      <ContributionGrid :calendar="calendar" :selected="selectedDate" @select="selectDate" />
      <p class="ck-grid-swipe">左右滑动查看更早的月份</p>
    </div>

    <CheckinList
      :records="visibleRecords"
      :total="stats.total"
      :selected-date="selectedDate"
      @clear-date="clearSelectedDate"
      @remove="removeCheckin"
    />

    <p v-if="storageError" class="ck-alert warn" role="alert">{{ storageError }}</p>
  </section>

  <Transition name="ck-toast">
    <div v-if="notice" class="ck-toast" :class="noticeKind" role="status">{{ notice }}</div>
  </Transition>
</template>
