<script setup>
/**
 * Codeforces 账号绑定面板。
 *
 * 绑定只是本机偏好：用公开 API 校验 handle、读取 AC 列表，不涉及 CF 登录，
 * 也不证明这个 handle 属于你。随机抽题时会自动剔除这些已 AC 的题。
 */
import { computed, ref } from "vue";
import { useCfBinding } from "../composables/useCfBinding.js";

const {
  binding,
  status,
  error,
  progress,
  solvedCount,
  stale,
  profileUrl,
  bind,
  refresh,
  unbind,
} = useCfBinding();

const handle = ref("");
const busy = computed(() => status.value === "binding" || status.value === "refreshing");

const solvedAtText = computed(() => {
  const at = Number(binding.value?.solvedAt) || 0;
  if (!at) return "";
  return new Date(at).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
});

const ratingText = computed(() => {
  const rating = binding.value?.rating;
  return typeof rating === "number" ? `${rating}` : "未定级";
});

function onAvatarError(event) {
  // Codeforces 头像偶尔会 404；直接移除，避免 alt 文本/破图标撑乱面板
  event.target.remove();
}

async function onBind() {
  const ok = await bind(handle.value);
  if (ok) handle.value = "";
}

function onRefresh() {
  if (status.value === "binding" || status.value === "refreshing") return;
  refresh();
}

function onUnbind() {
  if (status.value === "binding" || status.value === "refreshing") return;
  unbind();
}
</script>

<template>
  <section class="cf-account" aria-labelledby="cf-account-title">
    <div class="cf-account-head">
      <h2 id="cf-account-title" class="cf-account-title">
        <span aria-hidden="true">🟦</span> Codeforces 账号
      </h2>
      <span class="cf-account-hint">
        绑定后，随机抽题会自动排除你已 AC 的题
      </span>
    </div>

    <div v-if="binding" class="cf-account-bound">
      <img
        v-if="binding.avatar"
        class="cf-account-avatar"
        :src="binding.avatar"
        alt=""
        aria-hidden="true"
        width="38"
        height="38"
        loading="lazy"
        referrerpolicy="no-referrer"
        @error="onAvatarError"
      />
      <div class="cf-account-id">
        <a :href="profileUrl" target="_blank" rel="noopener">@{{ binding.handle }}</a>
        <span class="cf-account-meta">
          <span class="cf-rating">{{ ratingText }}</span>
          <span>已读取 <strong>{{ solvedCount }}</strong> 道 AC</span>
          <span v-if="solvedAtText">· {{ solvedAtText }}</span>
        </span>
      </div>
      <div class="cf-account-actions">
        <button type="button" class="btn ghost" :disabled="busy" @click="onRefresh">
          {{ status === "refreshing" ? "刷新中…" : "刷新 AC" }}
        </button>
        <button type="button" class="ck-text-btn" :disabled="busy" @click="onUnbind">解绑</button>
      </div>
      <p v-if="stale && !busy" class="cf-account-stale">
        AC 列表已超过 6 小时，可能漏掉新做的题，建议刷新。
      </p>
    </div>

    <form v-else class="cf-account-form" @submit.prevent="onBind">
      <input
        v-model="handle"
        type="text"
        class="cf-account-input"
        placeholder="Codeforces handle，例如 tourist"
        autocomplete="off"
        spellcheck="false"
        aria-label="Codeforces handle"
        :disabled="busy"
      />
      <button type="submit" class="btn" :disabled="busy || !handle.trim()">
        {{ status === "binding" ? "绑定中…" : "绑定账号" }}
      </button>
      <span class="cf-account-form-hint">
        只保存在本机；不验证 handle 归属，只用于过滤已 AC 题目
      </span>
    </form>

    <p v-if="progress" class="cf-account-progress">{{ progress }}</p>
    <p v-if="error" class="cf-account-error" role="alert">{{ error }}</p>
  </section>
</template>
