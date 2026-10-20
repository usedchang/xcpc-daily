<script setup>
/**
 * 打卡区的 GitHub 身份入口。
 *
 * 两条登录路径：
 *   1. Device Flow（推荐）：点按钮 → 页面给出 8 位代码 → 用户在 GitHub 输入并授权
 *      → 本页自动拿到令牌。全程不需要 client_secret，静态站点可以直接用。
 *   2. 个人访问令牌（PAT）：没有部署 OAuth 代理时的备用方案，粘贴一个只有 gist
 *      权限的令牌即可。令牌只保存在本浏览器的 localStorage。
 *
 * 退出登录只删本机令牌；要彻底撤销授权得去 GitHub → Settings → Applications。
 */
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { CHECKIN, hasGithubOAuth } from "../config/checkin.js";
import { useGithubAuth } from "../composables/useGithubAuth.js";
import { copyText } from "../utils/copy.js";

const props = defineProps({
  sync: { type: Object, default: null },
});

const {
  viewer,
  session,
  loginPhase,
  loginError,
  loginNotice,
  device,
  startDeviceLogin,
  cancelDeviceLogin,
  loginWithPat,
  logout,
} = useGithubAuth();

const oauthReady = hasGithubOAuth();
const showPat = ref(false);
const pat = ref("");
const copyState = ref("");
let copyTimer = 0;
onBeforeUnmount(() => window.clearTimeout(copyTimer));

const syncText = computed(() => {
  const state = props.sync?.state || "local";
  return {
    saved: "已同步",
    saving: "同步中",
    pending: "待同步",
    syncing: "读取中",
    error: "同步失败",
    empty: "等待首次同步",
    local: "仅本机",
  }[state] || "仅本机";
});

const syncTone = computed(() => {
  const state = props.sync?.state || "local";
  if (state === "saved") return "ok";
  if (state === "saving" || state === "pending" || state === "syncing") return "busy";
  if (state === "error") return "bad";
  return "idle";
});

const gistUrl = computed(() =>
  session.value?.gistId
    ? `https://gist.github.com/${encodeURIComponent(session.value.gistId)}`
    : ""
);

async function copyCode() {
  const ok = await copyText(device.value?.userCode || "");
  copyState.value = ok ? "已复制" : "复制失败";
  window.clearTimeout(copyTimer);
  copyTimer = window.setTimeout(() => {
    copyState.value = "";
  }, 1600);
}

function submitPat() {
  if (!pat.value.trim() || loginPhase.value === "starting") return;
  loginWithPat(pat.value);
}

// 令牌登录成功后收起表单、清空输入框（失败的令牌不会留在页面上）
watch(viewer, (value) => {
  if (value) {
    showPat.value = false;
    pat.value = "";
  }
});
</script>

<template>
  <div class="ck-login">
    <!-- 已登录：头像 + 账号 + 同步状态 -->
    <div v-if="viewer" class="ck-user">
      <img
        class="ck-avatar"
        :src="viewer.avatar"
        :alt="`${viewer.login} 的头像`"
        width="30"
        height="30"
        loading="lazy"
        referrerpolicy="no-referrer"
      />
      <div class="ck-user-id">
        <strong>{{ viewer.name }}</strong>
        <a :href="viewer.htmlUrl" target="_blank" rel="noopener">@{{ viewer.login }}</a>
      </div>
      <span class="ck-sync" :class="syncTone" :title="sync?.message || ''">
        <i aria-hidden="true"></i>{{ syncText }}
      </span>
      <a
        v-if="gistUrl"
        class="ck-gist-link"
        :href="gistUrl"
        target="_blank"
        rel="noopener"
        title="打开保存打卡记录的私有 Gist"
      >Gist ↗</a>
      <button type="button" class="ck-text-btn" @click="logout">退出</button>
    </div>

    <!-- 未登录 -->
    <div v-else class="ck-login-idle">
      <template v-if="loginPhase === 'waiting' && device">
        <div class="ck-device">
          <div class="ck-device-code-row">
            <span class="ck-device-label">在 GitHub 输入代码</span>
            <code class="ck-device-code">{{ device.userCode }}</code>
            <button type="button" class="ck-text-btn" @click="copyCode">
              {{ copyState || "复制" }}
            </button>
          </div>
          <div class="ck-device-actions">
            <a
              class="btn ck-login-btn"
              :href="device.verificationUriComplete || device.verificationUri"
              target="_blank"
              rel="noopener"
            >
              <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"
                />
              </svg>
              打开 GitHub 授权页 ↗
            </a>
            <button type="button" class="ck-text-btn" @click="cancelDeviceLogin">取消</button>
          </div>
          <p class="ck-device-hint">
            授权后本页会自动完成登录；代码约 15 分钟内有效。
          </p>
        </div>
      </template>

      <template v-else>
        <template v-if="oauthReady">
          <button
            type="button"
            class="btn ck-login-btn"
            :disabled="loginPhase === 'starting'"
            @click="startDeviceLogin"
          >
            <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
              <path
                fill="currentColor"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.012 8.012 0 0 0 16 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
            {{ loginPhase === "starting" ? "连接 GitHub…" : "使用 GitHub 登录" }}
          </button>
          <span class="ck-login-tip">登录后记录同步到你的私有 Gist</span>
        </template>

        <template v-else>
          <span class="ck-login-note">GitHub 登录未配置 · 当前为本机体验模式</span>
          <a class="ck-text-btn" :href="CHECKIN.docsUrl" target="_blank" rel="noopener">
            配置说明 ↗
          </a>
        </template>

        <button
          v-if="!showPat"
          type="button"
          class="ck-text-btn ck-pat-toggle"
          @click="showPat = true"
        >用令牌登录</button>

        <form v-else class="ck-pat" @submit.prevent="submitPat">
          <input
            v-model="pat"
            type="password"
            class="ck-pat-input"
            placeholder="ghp_… 或 github_pat_…"
            autocomplete="new-password"
            spellcheck="false"
            aria-label="GitHub 个人访问令牌"
          />
          <button type="submit" class="btn ghost" :disabled="!pat.trim() || loginPhase === 'starting'">
            登录
          </button>
          <button
            type="button"
            class="ck-text-btn"
            @click="showPat = false; pat = ''"
          >取消</button>
          <p class="ck-pat-hint">
            没部署 OAuth 代理时的备用方式：在
            <a :href="CHECKIN.patUrl" target="_blank" rel="noopener">GitHub 创建令牌</a>
            时只勾选 <code>gist</code>。令牌只保存在本机浏览器。
          </p>
        </form>
      </template>

      <p v-if="loginError" class="ck-login-error" role="alert">{{ loginError }}</p>
      <p v-if="loginNotice" class="ck-login-ok" role="status">{{ loginNotice }}</p>
    </div>
  </div>
</template>
