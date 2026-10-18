/**
 * Codeforces 账号绑定（模块级单例）。
 *
 * 绑定的作用域跟 GitHub 账号走：
 *   - 已登录：xcpc-cf-binding-v1:<github login>
 *   - 未登录：xcpc-cf-binding-v1:guest
 * 未登录时绑定后，再登录 GitHub 会把 guest 绑定迁移到账号下（如果没有已有绑定）。
 *
 * 验证 / 拉 AC 列表都走 Codeforces 公开 API，不需要 CF 密码，也不涉及 OAuth。
 */
import { computed, ref, watch } from "vue";
import {
  CF_PROFILE_BASE,
  clearCfBinding,
  fetchCfSolved,
  fetchCfUser,
  isCfSolvedStale,
  normalizeCfHandle,
  readCfBinding,
  writeCfBinding,
} from "../data/cfAccount.js";
import { useGithubAuth } from "./useGithubAuth.js";

const binding = ref(null);
/** idle | binding | refreshing | ready | error */
const status = ref("idle");
const error = ref("");
const progress = ref("");

const solvedKeys = computed(() => new Set(binding.value?.solvedKeys || []));
const solvedCount = computed(() => binding.value?.solvedKeys?.length || 0);
const stale = computed(() => isCfSolvedStale(binding.value));
const profileUrl = computed(() =>
  binding.value ? `${CF_PROFILE_BASE}/${encodeURIComponent(binding.value.handle)}` : ""
);

let auth = null;
let initialized = false;
let currentKey = "";
let seq = 0;

function accountKey() {
  return String(auth?.session?.value?.login || "guest").toLowerCase();
}

function loadForAccount(key) {
  seq += 1;
  currentKey = key;
  error.value = "";
  progress.value = "";
  status.value = "idle";

  let saved = readCfBinding(key);
  if (!saved && key !== "guest") {
    // 未登录时先绑过 CF：登录 GitHub 后自动搬到账号名下
    const guest = readCfBinding("guest");
    if (guest) {
      saved = guest;
      writeCfBinding(key, guest);
      clearCfBinding("guest");
    }
  }
  binding.value = saved;
  status.value = saved ? "ready" : "idle";
}

function init() {
  if (initialized) return;
  initialized = true;
  auth = useGithubAuth();
  watch(
    () => String(auth.session.value?.login || "guest").toLowerCase(),
    (key) => loadForAccount(key),
    { immediate: true }
  );
}

/**
 * 绑定 handle：先 user.info 验证，再分页拉 user.status 提取 AC。
 */
async function bind(handle) {
  init();
  const clean = normalizeCfHandle(handle);
  if (!clean) {
    status.value = "error";
    error.value = "Codeforces handle 格式不合法";
    return false;
  }

  const keyAtStart = currentKey || accountKey();
  const mySeq = ++seq;
  status.value = "binding";
  error.value = "";
  progress.value = "正在验证 Codeforces 账号…";

  try {
    const user = await fetchCfUser(clean);
    progress.value = "正在读取 AC 记录…";
    const solved = await fetchCfSolved(user.handle, {
      onProgress: ({ submissions, solved: n }) => {
        if (mySeq !== seq) return;
        progress.value = `已读取 ${submissions} 条提交，找到 ${n} 道 AC…`;
      },
    });

    if (mySeq !== seq || keyAtStart !== accountKey()) return false;

    const next = {
      ...user,
      solvedKeys: solved.keys,
      solvedAt: Date.now(),
      savedAt: Date.now(),
    };
    binding.value = next;
    writeCfBinding(keyAtStart, next);
    status.value = "ready";
    progress.value = "";
    return true;
  } catch (err) {
    if (mySeq !== seq) return false;
    status.value = "error";
    error.value = String(err?.message || err || "绑定失败");
    progress.value = "";
    return false;
  }
}

/** 只刷新 AC 列表，不重新验证用户资料。 */
async function refresh() {
  init();
  if (!binding.value) return false;

  const keyAtStart = currentKey || accountKey();
  const mySeq = ++seq;
  status.value = "refreshing";
  error.value = "";
  progress.value = "正在读取最新 AC 记录…";

  try {
    const solved = await fetchCfSolved(binding.value.handle, {
      onProgress: ({ submissions, solved: n }) => {
        if (mySeq !== seq) return;
        progress.value = `已读取 ${submissions} 条提交，找到 ${n} 道 AC…`;
      },
    });
    if (mySeq !== seq || keyAtStart !== accountKey()) return false;

    const next = {
      ...binding.value,
      solvedKeys: solved.keys,
      solvedAt: Date.now(),
      savedAt: Date.now(),
    };
    binding.value = next;
    writeCfBinding(keyAtStart, next);
    status.value = "ready";
    progress.value = "";
    return true;
  } catch (err) {
    if (mySeq !== seq) return false;
    status.value = "error";
    error.value = String(err?.message || err || "刷新 AC 列表失败");
    progress.value = "";
    return false;
  }
}

function unbind() {
  init();
  seq += 1;
  const key = currentKey || accountKey();
  clearCfBinding(key);
  binding.value = null;
  status.value = "idle";
  error.value = "";
  progress.value = "";
}

export function useCfBinding() {
  init();
  return {
    binding,
    status,
    error,
    progress,
    solvedKeys,
    solvedCount,
    stale,
    profileUrl,
    bind,
    refresh,
    unbind,
  };
}
