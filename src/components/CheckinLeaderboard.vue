<script setup>
/**
 * 打卡排行榜。
 *
 * 成员 = 静态 registry + 仓库里带 marker 的 open Issue；
 * 数据 = 每个成员自己的 public Gist 快照（只有统计数字）。
 *
 * 页面只读 GitHub，不写任何东西；缓存 10 分钟，避免每次进页面都打 API。
 */
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { CHECKIN } from "../config/checkin.js";
import { useGithubAuth } from "../composables/useGithubAuth.js";
import { clearLeaderboardCache, loadLeaderboard } from "../data/leaderboard-client.js";

const { viewer, token } = useGithubAuth();

const entries = ref([]);
const loading = ref(false);
const loadedAt = ref(0);
const fromCache = ref(false);
const failed = ref([]);
const errors = ref([]);
const loadError = ref("");
const expanded = ref(false);

const visible = computed(() => (expanded.value ? entries.value : entries.value.slice(0, 20)));
const hiddenCount = computed(() => Math.max(0, entries.value.length - visible.value.length));
const myLogin = computed(() => viewer.value?.login || "");

const updatedText = computed(() => {
  if (!loadedAt.value) return "";
  return new Date(loadedAt.value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
});

function avatarOf(login) {
  return `https://github.com/${encodeURIComponent(login)}.png?size=80`;
}

function profileUrl(login) {
  return `https://github.com/${encodeURIComponent(login)}`;
}

function entryTime(entry) {
  if (!entry.updatedAt) return "—";
  return new Date(entry.updatedAt).toLocaleDateString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
  });
}

async function load(force = false) {
  if (loading.value) return;
  loading.value = true;
  loadError.value = "";
  if (force) clearLeaderboardCache();
  try {
    const result = await loadLeaderboard({ token: token.value || "", force });
    entries.value = result.entries;
    loadedAt.value = result.at;
    fromCache.value = result.fromCache;
    failed.value = result.failed || [];
    errors.value = result.errors || [];
  } catch (err) {
    loadError.value = String(err?.message || err || "排行榜加载失败");
  } finally {
    loading.value = false;
  }
}

function onExternalRefresh() {
  load(true);
}

/** 空榜时给一个回到上方打卡面板的快捷入口。 */
function goToCheckinPanel() {
  document.getElementById("checkin-record")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

onMounted(() => {
  const run = () => load(false);
  if (typeof window.requestIdleCallback === "function") {
    window.requestIdleCallback(run, { timeout: 1500 });
  } else {
    window.setTimeout(run, 300);
  }
  window.addEventListener("xcpc-leaderboard:refresh", onExternalRefresh);
});

onBeforeUnmount(() => {
  window.removeEventListener("xcpc-leaderboard:refresh", onExternalRefresh);
});
</script>

<template>
  <section v-if="CHECKIN.leaderboard.enabled" class="ck-lb" aria-labelledby="ck-lb-title">
    <header class="ck-lb-head">
      <div class="ck-lb-head-text">
        <h2 id="ck-lb-title" class="ck-lb-title"><span aria-hidden="true">🏆</span> 打卡排行榜</h2>
        <p class="ck-lb-sub">
          社区自报 · 只读取公开统计快照，不读取题解和提交链接
        </p>
      </div>
      <div class="ck-lb-actions">
        <span v-if="loadedAt" class="ck-lb-stamp">
          {{ fromCache ? "缓存" : "已更新" }} · {{ updatedText }}
        </span>
        <button type="button" class="btn ghost ck-lb-refresh" :disabled="loading" @click="load(true)">
          {{ loading ? "加载中…" : "刷新" }}
        </button>
      </div>
    </header>

    <div v-if="loadError" class="ck-alert" role="alert">
      <span>{{ loadError }}</span>
      <button type="button" class="ck-text-btn" @click="load(true)">重试</button>
    </div>
    <div v-else-if="errors.length" class="ck-lb-note">
      {{ errors.join("；") }}
    </div>

    <div v-if="loading && !entries.length" class="ck-lb-loading">
      <span class="cf-spinner" aria-hidden="true"></span>
      正在读取公开快照…
    </div>

    <div v-else-if="!entries.length" class="ck-lb-empty">
      <strong>{{ failed.length ? "成员快照加载失败" : "还没有人上榜" }}</strong>
      <p v-if="failed.length">
        已登记 {{ failed.length }} 位成员，但公开快照读取失败；请确认快照 Gist 仍然存在且为 public。
      </p>
      <p v-else>
        登录 GitHub → 在上方打卡面板打开「公开到排行榜」→ 点「登记到排行榜」发一条 Issue，
        保持 issue 为 open 即可。
      </p>
      <p class="muted">排行榜只公开连续天数、打卡天数、累计提交等统计，不公开题解。</p>
      <button
        v-if="!failed.length"
        type="button"
        class="btn ghost ck-lb-empty-btn"
        @click="goToCheckinPanel"
      >↑ 去上方打卡面板</button>
    </div>

    <div v-else class="ck-lb-table-wrap">
      <table class="ck-lb-table">
        <thead>
          <tr>
            <th class="ck-lb-rank-col">#</th>
            <th>用户</th>
            <th class="ck-lb-num">当前连续</th>
            <th class="ck-lb-num">打卡天数</th>
            <th class="ck-lb-num">累计提交</th>
            <th class="ck-lb-num ck-lb-optional">最近 30 天</th>
            <th class="ck-lb-num ck-lb-optional">更新</th>
          </tr>
        </thead>
        <tbody>
          <tr
            v-for="entry in visible"
            :key="entry.login"
            :class="{ me: myLogin && entry.login.toLowerCase() === myLogin.toLowerCase() }"
          >
            <td class="ck-lb-rank">
              <span v-if="entry.rank <= 3" class="ck-lb-medal" :class="`m${entry.rank}`">
                {{ entry.rank === 1 ? "🥇" : entry.rank === 2 ? "🥈" : "🥉" }}
              </span>
              <span v-else>{{ entry.rank }}</span>
            </td>
            <td class="ck-lb-user">
              <a :href="profileUrl(entry.login)" target="_blank" rel="noopener">
                <img
                  class="ck-lb-avatar"
                  :src="avatarOf(entry.login)"
                  :alt="`${entry.login} 的头像`"
                  width="24"
                  height="24"
                  loading="lazy"
                  referrerpolicy="no-referrer"
                />
                <span>@{{ entry.login }}</span>
              </a>
              <span v-if="myLogin && entry.login.toLowerCase() === myLogin.toLowerCase()" class="ck-lb-me">
                你
              </span>
            </td>
            <td class="ck-lb-num ck-lb-streak">{{ entry.stats.currentStreak }} 天</td>
            <td class="ck-lb-num">{{ entry.stats.activeDays }}</td>
            <td class="ck-lb-num">{{ entry.stats.total }}</td>
            <td class="ck-lb-num ck-lb-optional">{{ entry.stats.last30Days }}</td>
            <td class="ck-lb-num ck-lb-optional">{{ entryTime(entry) }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <button
      v-if="hiddenCount"
      type="button"
      class="ck-text-btn ck-lb-more"
      @click="expanded = true"
    >查看全部 {{ entries.length }} 人</button>

    <p v-if="failed.length" class="ck-lb-failed">
      {{ failed.length }} 位成员快照加载失败（可能 Gist 已删除或未公开）：
      {{ failed.map((f) => f.login).join("、") }}
    </p>

    <details class="ck-lb-how">
      <summary>怎么上榜？</summary>
      <ol>
        <li>用 GitHub 登录，打开上方打卡面板的「公开到排行榜」开关；</li>
        <li>系统会创建一个<strong>公开快照 Gist</strong>，里面只有统计数字，没有题解；</li>
        <li>点「登记到排行榜」发一条 Issue，保持 open；关闭 Issue 即下架；</li>
        <li>排行榜每 10 分钟重新读取一次公开快照，排名规则：当前连续 → 打卡天数 → 累计提交。</li>
      </ol>
      <p class="muted">
        数据是社区自报的，未与 OJ 提交做自动核验；只放自己愿意公开的统计。
      </p>
    </details>
  </section>
</template>
