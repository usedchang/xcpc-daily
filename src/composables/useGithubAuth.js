import { computed, ref } from "vue";
import { CHECKIN, hasGithubOAuth } from "../config/checkin.js";
import {
  clearStoredSession,
  fetchViewer,
  loadStoredSession,
  loginWithToken,
  pollDeviceToken,
  requestDeviceCode,
  saveStoredSession,
} from "../auth/github.js";

/**
 * GitHub 登录状态（模块级单例）。
 *
 * 状态机：
 *   idle → starting → waiting → idle（成功）
 *                    ↘ error（可重试）
 *
 * 组件只读 session / viewer / loginPhase；令牌本身不往模板里传，
 * 免得哪天不小心被渲染进 DOM。
 */
const session = ref(loadStoredSession());
const loginPhase = ref("idle"); // idle | starting | waiting | error
const loginError = ref("");
const loginNotice = ref("");
const device = ref(null); // { userCode, verificationUri, expiresAt, ... }

const viewer = computed(() =>
  session.value
    ? {
        login: session.value.login,
        name: session.value.name || session.value.login,
        avatar:
          session.value.avatar ||
          `https://github.com/${encodeURIComponent(session.value.login)}.png`,
        htmlUrl: `https://github.com/${encodeURIComponent(session.value.login)}`,
      }
    : null
);

const oauthReady = hasGithubOAuth();
let pollController = null;
let restoreStarted = false;
let noticeTimer = 0;

function setNotice(message) {
  loginNotice.value = message;
  window.clearTimeout(noticeTimer);
  if (message) {
    noticeTimer = window.setTimeout(() => {
      loginNotice.value = "";
    }, 6000);
  }
}

function messageOf(err) {
  if (err?.name === "AbortError") return "";
  return String(err?.message || err || "登录失败，请稍后再试");
}

function persist(next) {
  session.value = next;
  if (next) saveStoredSession(next);
  else clearStoredSession();
}

/** 更新会话里的附加字段（主要是 Gist id），不改变登录态。 */
export function updateSession(patch) {
  if (!session.value) return;
  const next = { ...session.value, ...patch };
  session.value = next;
  saveStoredSession(next);
}

/** 登录失效时由同步层调用：清掉本地会话，但保留该账号在本机的打卡数据。 */
export function expireSession(message = "GitHub 登录已失效，请重新登录") {
  if (!session.value) return;
  persist(null);
  loginPhase.value = "error";
  loginError.value = message;
}

/**
 * 用设备码登录。调用后 UI 展示 device.userCode，函数在后台轮询直到成功/取消。
 * 故意不 throw：错误都写进 loginError，按钮不需要包 try/catch。
 */
export async function startDeviceLogin() {
  if (loginPhase.value === "waiting" || loginPhase.value === "starting") return;
  loginError.value = "";
  loginNotice.value = "";

  if (!oauthReady) {
    loginPhase.value = "error";
    loginError.value = "GitHub 登录还没有配置，请先看 README 的「GitHub 登录与每日打卡」。";
    return;
  }

  loginPhase.value = "starting";
  try {
    const code = await requestDeviceCode({
      authProxy: CHECKIN.authProxy,
      clientId: CHECKIN.clientId,
      scope: CHECKIN.scope,
    });
    device.value = { ...code, expiresAt: Date.now() + code.expiresIn * 1000 };
    loginPhase.value = "waiting";

    pollController = new AbortController();
    const result = await pollDeviceToken({
      authProxy: CHECKIN.authProxy,
      clientId: CHECKIN.clientId,
      deviceCode: code.deviceCode,
      interval: code.interval,
      expiresIn: code.expiresIn,
      signal: pollController.signal,
    });

    await finishLogin(result.token, result.scope);
  } catch (err) {
    if (err?.name === "AbortError") {
      loginPhase.value = "idle";
    } else {
      loginPhase.value = "error";
      loginError.value = messageOf(err);
    }
  } finally {
    device.value = null;
    pollController = null;
  }
}

/** 取消正在等待的授权（只影响本页，不影响 GitHub 上已授权的内容）。 */
export function cancelDeviceLogin() {
  pollController?.abort();
  pollController = null;
  device.value = null;
  loginPhase.value = "idle";
  loginError.value = "";
}

async function finishLogin(token, scope) {
  const info = await fetchViewer(token);
  const previous = session.value;
  const next = {
    token,
    login: info.login,
    name: info.name,
    avatar: info.avatar,
    scope: scope || info.scopes.join(","),
    // 换了账号就别沿用旧账号的 gistId，否则会把数据写进别人的 Gist
    gistId: previous?.login === info.login ? previous.gistId || "" : "",
    leaderboardPublic:
      previous?.login === info.login ? previous.leaderboardPublic === true : false,
    leaderboardGistId:
      previous?.login === info.login ? previous.leaderboardGistId || "" : "",
  };
  persist(next);
  loginPhase.value = "idle";
  loginError.value = "";
  setNotice(`已登录 @${info.login}`);
}

/** 备用登录：粘贴 GitHub 个人访问令牌（需要 gist 权限）。 */
export async function loginWithPat(rawToken) {
  loginError.value = "";
  loginNotice.value = "";
  loginPhase.value = "starting";
  try {
    const next = await loginWithToken(rawToken);
    const previous = session.value;
    persist({
      ...next,
      gistId: previous?.login === next.login ? previous.gistId || "" : "",
      leaderboardPublic:
        previous?.login === next.login ? previous.leaderboardPublic === true : false,
      leaderboardGistId:
        previous?.login === next.login ? previous.leaderboardGistId || "" : "",
    });
    loginPhase.value = "idle";
    setNotice(`已登录 @${next.login}`);
  } catch (err) {
    loginPhase.value = "error";
    loginError.value = messageOf(err);
  }
}

export function logout() {
  pollController?.abort();
  pollController = null;
  device.value = null;
  loginPhase.value = "idle";
  loginError.value = "";
  setNotice("");
  persist(null);
}

/**
 * 页面加载时校验一次本地令牌：401 才算失效；网络错误保留会话，
 * 让用户至少还能看本机缓存（离线时也能打卡，联网后自动补同步）。
 */
async function restoreSession() {
  if (!session.value) return;
  const tokenAtStart = session.value.token;
  try {
    const info = await fetchViewer(tokenAtStart);
    const current = session.value;
    // 校验期间用户可能退出或换了账号：旧令牌的结果不能盖掉新会话
    if (!current || current.token !== tokenAtStart) return;
    if (current.login !== info.login) {
      // 令牌被换绑到另一个账号：以 GitHub 返回的为准
      persist({
        token: current.token,
        login: info.login,
        name: info.name,
        avatar: info.avatar,
        scope: info.scopes.join(",") || current.scope,
        gistId: "",
      });
      return;
    }
    updateSession({
      login: info.login,
      name: info.name,
      avatar: info.avatar,
      scope: info.scopes.join(",") || current.scope,
    });
  } catch (err) {
    if (err?.status === 401) {
      expireSession();
    }
    // 网络错误 / 速率限制：保留会话，同步层会在稍后重试
  }
}

/** 单例初始化：第一次被组件调用时恢复会话。 */
export function useGithubAuth() {
  if (!restoreStarted) {
    restoreStarted = true;
    restoreSession();
  }

  return {
    session,
    viewer,
    token: computed(() => session.value?.token || ""),
    loginPhase,
    loginError,
    loginNotice,
    device,
    oauthReady,
    startDeviceLogin,
    cancelDeviceLogin,
    loginWithPat,
    logout,
  };
}
