/**
 * GitHub 登录 / Gist 同步的纯客户端。
 *
 * 为什么是 Device Flow 而不是普通 OAuth 回调：
 *   GitHub 的 `/login/oauth/access_token` 不返回 CORS 头，静态站点拿不到令牌；
 *   Device Flow 只需要 client_id（没有 client_secret 可泄露），代价是要经过一个
 *   很小的代理转发（见 server/oauth-proxy）。代理只做转发，不存令牌。
 *
 * 本文件不 import Vue，Node 里也能单独测；localStorage 不可用时静默降级。
 */

const API_BASE = "https://api.github.com";
const SESSION_KEY = "xcpc-github-session-v1";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";

export class GithubError extends Error {
  constructor(message, { status = 0, code = "" } = {}) {
    super(message);
    this.name = "GithubError";
    this.status = status;
    this.code = code;
  }
}

/* ------------------------------------------------------------------ *
 * 会话存储
 * ------------------------------------------------------------------ */
function safeStorage() {
  try {
    return typeof localStorage !== "undefined" ? localStorage : null;
  } catch {
    return null; // Safari 隐私模式等场景访问 localStorage 本身就会抛
  }
}

export function loadStoredSession() {
  const store = safeStorage();
  if (!store) return null;
  try {
    const raw = store.getItem(SESSION_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.token !== "string" || !data.token) return null;
    if (typeof data.login !== "string" || !data.login) return null;
    return {
      token: data.token,
      login: data.login,
      name: String(data.name || data.login),
      avatar: String(data.avatar || ""),
      scope: String(data.scope || ""),
      gistId: String(data.gistId || ""),
      leaderboardPublic: data.leaderboardPublic === true,
      leaderboardGistId: String(data.leaderboardGistId || ""),
      savedAt: Number(data.savedAt) || 0,
    };
  } catch {
    return null;
  }
}

export function saveStoredSession(session) {
  const store = safeStorage();
  if (!store) return;
  try {
    store.setItem(SESSION_KEY, JSON.stringify({ ...session, savedAt: Date.now() }));
  } catch {
    // 配额满 / 隐私模式：令牌只活在当前内存里，刷新后要重新登录
  }
}

export function clearStoredSession() {
  const store = safeStorage();
  if (!store) return;
  try {
    store.removeItem(SESSION_KEY);
  } catch {
    // 忽略
  }
}

/* ------------------------------------------------------------------ *
 * GitHub REST API
 * ------------------------------------------------------------------ */
export function parseScopes(value) {
  return String(value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 只放行 https 链接：GitHub 返回的链接会直接进 <a href>，不能让代理注入 javascript:。 */
function safeHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "https:" ? url.href : "";
  } catch {
    return "";
  }
}

function rateLimited(response) {
  const remaining = response.headers.get("x-ratelimit-remaining");
  return response.status === 429 || (response.status === 403 && remaining === "0");
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function apiErrorMessage(status, data, { gist = false } = {}) {
  if (status === 401) return "GitHub 登录已失效，请重新登录";
  if (status === 403) {
    return gist
      ? "令牌没有读写 Gist 的权限，请重新授权（需要 gist）"
      : "GitHub 拒绝了这个请求，请检查令牌权限";
  }
  if (status === 404) {
    return gist ? "GitHub 上找不到这个 Gist（可能已被删除）" : "GitHub 上找不到这个资源";
  }
  if (status === 422) return data?.message || "GitHub 认为提交的数据不合法";
  if (status >= 500) return "GitHub 服务暂时不可用，请稍后再试";
  return data?.message || `GitHub 请求失败（HTTP ${status}）`;
}

/**
 * 调 GitHub REST API，统一处理鉴权头、错误和 CORS 预检。
 * @returns {Promise<{data:any,response:Response,scopes:string[]}>}
 */
async function githubFetch(path, { token, method = "GET", body, gist = false } = {}) {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new GithubError("无法连接 GitHub API，请检查网络或代理", { code: "network" });
  }

  const scopes = parseScopes(response.headers.get("x-oauth-scopes"));
  const data = await parseJsonResponse(response);

  if (!response.ok) {
    if (rateLimited(response)) {
      const reset = Number(response.headers.get("x-ratelimit-reset")) * 1000;
      const when = reset > Date.now()
        ? `（约 ${new Date(reset).toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })} 恢复）`
        : "";
      throw new GithubError(`GitHub API 调用次数用完了，请稍后再试${when}`, {
        status: response.status,
        code: "rate_limit",
      });
    }
    throw new GithubError(apiErrorMessage(response.status, data, { gist }), {
      status: response.status,
      code: data?.message || "",
    });
  }

  return { data, response, scopes };
}

/** 当前令牌对应的用户资料。 */
export async function fetchViewer(token) {
  const { data, scopes } = await githubFetch("/user", { token });
  const login = String(data?.login || "");
  if (!login) throw new GithubError("GitHub 没有返回用户名，登录失败", { code: "no_login" });
  return {
    login,
    name: String(data.name || login),
    avatar:
      safeHttpsUrl(data.avatar_url) ||
      `https://github.com/${encodeURIComponent(login)}.png`,
    htmlUrl: safeHttpsUrl(data.html_url) || `https://github.com/${encodeURIComponent(login)}`,
    scopes,
  };
}

/** 用个人访问令牌（PAT）验证并换取会话；作为没有部署 OAuth 代理时的备用登录。 */
export async function loginWithToken(rawToken) {
  const token = String(rawToken || "").trim();
  if (!token) throw new GithubError("请先粘贴 GitHub 令牌", { code: "empty_token" });
  if (/\s/.test(token)) throw new GithubError("令牌里不能有空格或换行", { code: "bad_token" });
  const viewer = await fetchViewer(token);
  return {
    token,
    login: viewer.login,
    name: viewer.name,
    avatar: viewer.avatar,
    scope: viewer.scopes.join(","),
    gistId: "",
  };
}

/* ------------------------------------------------------------------ *
 * Device Flow（经代理）
 * ------------------------------------------------------------------ */
function abortError() {
  const err = new Error("已取消 GitHub 登录");
  err.name = "AbortError";
  return err;
}

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError());
      return;
    }
    const timer = setTimeout(() => {
      cleanup();
      resolve();
    }, ms);
    const onAbort = () => {
      cleanup();
      reject(abortError());
    };
    function cleanup() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

const DEVICE_ERRORS = {
  device_flow_disabled:
    "这个 OAuth App 没有启用 Device Flow。请到 GitHub → Settings → Developer settings → OAuth Apps 勾选 Enable Device Flow。",
  incorrect_client_credentials: "Client ID 不正确，请检查 VITE_GITHUB_CLIENT_ID。",
  unauthorized_client: "这个 OAuth App 不允许使用设备码登录。",
  access_denied: "你取消了 GitHub 授权。",
  expired_token: "授权码已过期，请重新发起登录。",
  unsupported_grant_type: "OAuth 代理返回了不支持的授权类型。",
};

function deviceError(data, status = 0) {
  const code = String(data?.error || "");
  const message = DEVICE_ERRORS[code] || data?.error_description || `GitHub 登录失败（HTTP ${status || "?"}）`;
  return new GithubError(message, { status, code });
}

function proxyUrl(base, path) {
  return `${String(base || "").replace(/\/+$/, "")}${path}`;
}

async function proxyPost(base, path, body) {
  if (!base) throw new GithubError("还没有配置 OAuth 代理地址", { code: "no_proxy" });
  let response;
  try {
    response = await fetch(proxyUrl(base, path), {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch {
    throw new GithubError("连不上 OAuth 登录服务，请检查网络或 VITE_GITHUB_AUTH_PROXY", {
      code: "network",
    });
  }

  const data = await parseJsonResponse(response);
  if (!response.ok) {
    if (response.status === 403 && data?.error === "origin_not_allowed") {
      throw new GithubError("当前站点不在 OAuth 代理的白名单里，请检查 ALLOWED_ORIGINS。", {
        status: 403,
        code: "origin_not_allowed",
      });
    }
    throw deviceError(data, response.status);
  }
  if (data?.error) throw deviceError(data, response.status);
  return data || {};
}

/**
 * 申请设备码。返回的 user_code 是要让用户抄到 GitHub 的短码，
 * device_code 只用于后台轮询，不要展示。
 */
export async function requestDeviceCode({ authProxy, clientId, scope = "read:user gist" }) {
  const data = await proxyPost(authProxy, "/device/code", { client_id: clientId, scope });
  if (!data.device_code || !data.user_code) {
    throw new GithubError("OAuth 代理没有返回设备码，请检查代理配置", { code: "no_device_code" });
  }
  const baseUri = safeHttpsUrl(data.verification_uri);
  const verificationUri = baseUri.startsWith("https://github.com/")
    ? baseUri
    : "https://github.com/login/device";
  // 只接受 github.com 的完整授权链接；其它 https 地址也不直接跳到 <a href>
  const complete = safeHttpsUrl(data.verification_uri_complete);
  return {
    deviceCode: String(data.device_code),
    userCode: String(data.user_code),
    verificationUri,
    verificationUriComplete: complete.startsWith("https://github.com/") ? complete : "",
    expiresIn: Math.max(60, Number(data.expires_in) || 900),
    interval: Math.max(5, Number(data.interval) || 5),
  };
}

/**
 * 轮询设备码对应的令牌，直到用户授权 / 过期 / 取消。
 *
 * GitHub 的约定：
 *   - authorization_pending：用户还没点授权，继续等；
 *   - slow_down：请求太快，把间隔 +5 秒（RFC 8628 要求）；
 *   - 网络抖动：最多连续重试 3 次，不立刻把登录判死。
 *
 * @returns {Promise<{token:string, scope:string}>}
 */
export async function pollDeviceToken({
  authProxy,
  clientId,
  deviceCode,
  interval = 5,
  expiresIn = 900,
  signal,
  onPending,
}) {
  const deadline = Date.now() + Math.max(60, Number(expiresIn) || 900) * 1000;
  let waitMs = Math.max(5, Number(interval) || 5) * 1000;
  let networkRetries = 0;

  while (Date.now() < deadline) {
    await sleep(waitMs, signal);

    let data;
    try {
      data = await proxyPost(authProxy, "/device/token", {
        client_id: clientId,
        device_code: deviceCode,
        grant_type: DEVICE_GRANT,
      });
      networkRetries = 0;
    } catch (err) {
      if (err.name === "AbortError") throw err;
      if (err.code === "slow_down") {
        waitMs += 5000;
        continue;
      }
      if (err.code === "authorization_pending") {
        onPending?.();
        continue;
      }
      if ((err.code === "network" || err.status >= 500) && networkRetries < 3) {
        networkRetries += 1;
        continue;
      }
      throw err;
    }

    if (data.access_token) {
      return {
        token: String(data.access_token),
        scope: String(data.scope || ""),
        tokenType: String(data.token_type || "bearer"),
      };
    }

    // 代理如果把 GitHub 的 OAuth 错误原样透传成 200，这里再兜一层
    const code = String(data.error || "");
    if (code === "authorization_pending") {
      onPending?.();
      continue;
    }
    if (code === "slow_down") {
      waitMs += 5000;
      continue;
    }
    if (code) throw deviceError(data, 200);
  }

  throw new GithubError("授权码已过期，请重新发起登录。", { code: "expired_token" });
}

/* ------------------------------------------------------------------ *
 * Gist（打卡数据的云端副本）
 * ------------------------------------------------------------------ */
export function gistFileContent(gist, fileName) {
  const file = gist?.files?.[fileName];
  if (!file) return null;
  if (typeof file.content === "string" && !file.truncated) return file.content;
  return null;
}

export async function listGists(token, { pages = 3, perPage = 100 } = {}) {
  const out = [];
  for (let page = 1; page <= pages; page += 1) {
    const { data } = await githubFetch(`/gists?per_page=${perPage}&page=${page}`, {
      token,
      gist: true,
    });
    if (!Array.isArray(data) || data.length === 0) break;
    out.push(...data);
    if (data.length < perPage) break;
  }
  return out;
}

export async function getGist(token, gistId) {
  const { data } = await githubFetch(`/gists/${encodeURIComponent(gistId)}`, {
    token,
    gist: true,
  });
  return data;
}

/** 读公开 Gist：匿名也能读（GitHub API 有 CORS），带 token 时额度更高。 */
export async function getPublicGist(gistId, token = "") {
  const { data } = await githubFetch(`/gists/${encodeURIComponent(gistId)}`, {
    token: token || "",
    gist: true,
  });
  return data;
}

/**
 * 找自己的打卡 Gist：优先用上次记住的 id（换设备时没有 id，就翻列表）。
 * 找不到返回 null；网络/权限错误照常抛。
 */
export async function findCheckinGist(token, { gistId = "", fileName }) {
  if (gistId) {
    try {
      const gist = await getGist(token, gistId);
      if (gist?.files?.[fileName]) return gist;
    } catch (err) {
      if (err.status !== 404) throw err;
      // 404 说明 gist 被删了，继续走列表查找
    }
  }

  const gists = await listGists(token);
  const candidate = gists.find((g) => g?.files?.[fileName]);
  if (!candidate) return null;

  // 关键：列表接口只返回文件元信息（filename / size / raw_url），**不带 content**。
  // 直接用列表里的对象去读正文会永远拿到空内容，所以必须再 GET 一次单个 Gist。
  return getGist(token, candidate.id);
}

export async function createGist(token, { fileName, description, content, public: isPublic = false }) {
  const { data } = await githubFetch("/gists", {
    token,
    method: "POST",
    gist: true,
    body: {
      description,
      public: Boolean(isPublic),
      files: { [fileName]: { content } },
    },
  });
  return data;
}

export async function updateGistFile(token, gistId, { fileName, content, description }) {
  const body = { files: { [fileName]: { content } } };
  if (description !== undefined) body.description = description;
  const { data } = await githubFetch(`/gists/${encodeURIComponent(gistId)}`, {
    token,
    method: "PATCH",
    gist: true,
    body,
  });
  return data;
}

/** 删除 Gist（用于关闭「公开到排行榜」时清掉公开快照）。 */
export async function deleteGist(token, gistId) {
  await githubFetch(`/gists/${encodeURIComponent(gistId)}`, {
    token,
    method: "DELETE",
    gist: true,
  });
  return true;
}

/**
 * 在自己的 Gist 里按文件名找一个（可选只找 public 的）。
 * 换设备后 session 里没有公开快照 id 时，用它避免重复创建。
 */
export async function findOwnGistByFileName(token, fileName, { publicOnly = false } = {}) {
  const gists = await listGists(token);
  const candidate = gists.find(
    (gist) => gist?.files?.[fileName] && (!publicOnly || gist.public === true)
  );
  if (!candidate) return null;
  return getGist(token, candidate.id);
}

export async function createCheckinGist(token, { fileName, description, content }) {
  return createGist(token, { fileName, description, content, public: false });
}

export async function updateCheckinGist(token, gistId, { fileName, content }) {
  return updateGistFile(token, gistId, { fileName, content });
}
