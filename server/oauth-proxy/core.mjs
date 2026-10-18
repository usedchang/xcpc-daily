/**
 * GitHub OAuth Device Flow 的最小转发核心。
 *
 * 为什么需要它：GitHub 的 `github.com/login/device/code` 与
 * `github.com/login/oauth/access_token` 不带 CORS 头，浏览器里的静态页面
 * 读不到响应。这个代理只做两件事：
 *
 *   POST /device/code   转发 client_id + scope，拿回设备码；
 *   POST /device/token  转发 device_code，轮询访问令牌。
 *
 * 它**不保存任何数据**，也**不需要 client_secret**（Device Flow 的设计就是
 * 给无法保守秘密的客户端用的）。真正要保护的只有两样：
 *   - GITHUB_CLIENT_ID：只允许给这一个 OAuth App 发设备码；
 *   - ALLOWED_ORIGINS：只允许自己的站点跨域调用。
 *
 * 同时被 Cloudflare Worker（worker.mjs）和本地 Node 代理（scripts/oauth-proxy.mjs）
 * 复用；这里只用标准 Request/Response 无关的普通对象，两个运行时都能跑。
 */

const DEVICE_CODE_URL = "https://github.com/login/device/code";
const ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const DEVICE_GRANT = "urn:ietf:params:oauth:grant-type:device_code";
const DEFAULT_SCOPES = "read:user gist";

function splitList(value) {
  return String(value || "")
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** 允许的 Origin：`*` 或逗号分隔白名单；没带 Origin 的请求（curl/本地脚本）放行。 */
export function allowedOrigin(origin, env = {}) {
  if (!origin) return "";
  const list = splitList(env.ALLOWED_ORIGINS || "*").map((item) => item.replace(/\/+$/, ""));
  if (list.includes("*")) return "*";
  const clean = String(origin).replace(/\/+$/, "");
  return list.includes(clean) ? clean : "";
}

function jsonResponse(status, body, { origin = "", env = {}, extra = {} } = {}) {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
    vary: "Origin",
    ...extra,
  };

  const allow = allowedOrigin(origin, env);
  if (allow) {
    headers["access-control-allow-origin"] = allow;
    headers["access-control-allow-methods"] = "GET, POST, OPTIONS";
    headers["access-control-allow-headers"] = "content-type, accept";
    headers["access-control-max-age"] = "86400";
  }

  return { status, headers, body: body === undefined ? null : body };
}

function pick(source, keys) {
  const out = {};
  for (const key of keys) {
    if (source && source[key] !== undefined) out[key] = source[key];
  }
  return out;
}

/** 只把 GitHub 返回的白名单字段透传给浏览器，避免把整包响应（含未知字段）带出去。 */
const DEVICE_FIELDS = [
  "device_code",
  "user_code",
  "verification_uri",
  "verification_uri_complete",
  "expires_in",
  "interval",
];
const TOKEN_FIELDS = [
  "access_token",
  "token_type",
  "scope",
  "error",
  "error_description",
  "interval",
];

/**
 * 转发一次表单 POST 到 GitHub。
 * GitHub 的错误经常是 HTTP 200 + `{error}`，所以不能只看 res.ok。
 */
async function githubPost(url, params) {
  const init = {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params,
  };

  // 15 秒超时：GitHub 卡住时别让浏览器的轮询一起挂死。
  if (typeof AbortSignal !== "undefined" && typeof AbortSignal.timeout === "function") {
    init.signal = AbortSignal.timeout(15_000);
  }

  let response;
  try {
    response = await fetch(url, init);
  } catch (err) {
    return {
      error: "github_unreachable",
      error_description: `连不上 GitHub：${err?.message || err}`,
      _status: 502,
    };
  }

  const text = await response.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return {
      error: "github_bad_response",
      error_description: `GitHub 返回了非 JSON 响应（HTTP ${response.status}）`,
      _status: 502,
    };
  }

  if (!response.ok && !data?.error) {
    return {
      error: "github_error",
      error_description: data?.message || `GitHub 返回 HTTP ${response.status}`,
      _status: 502,
    };
  }
  return data || {};
}

function resolveClientId(body, env) {
  const configured = String(env.GITHUB_CLIENT_ID || "").trim();
  const sent = String(body?.client_id || "").trim();
  if (!configured) {
    return {
      errorStatus: 500,
      errorBody: {
        error: "proxy_not_configured",
        error_description:
          "OAuth 代理没有配置 GITHUB_CLIENT_ID。本地开发请写进 .env.local，部署时写进 wrangler.toml。",
      },
    };
  }
  if (sent && sent !== configured) {
    return {
      errorStatus: 403,
      errorBody: {
        error: "client_id_mismatch",
        error_description: "这个代理只服务于配置里的那个 OAuth App。",
      },
    };
  }
  return { clientId: configured };
}

async function deviceCode(body, context) {
  const { env, origin } = context;
  const id = resolveClientId(body, env);
  if (id.errorStatus) return jsonResponse(id.errorStatus, id.errorBody, { env, origin });

  const scopes = splitList(body.scope || DEFAULT_SCOPES);
  const allowed = new Set(splitList(env.ALLOWED_SCOPES || DEFAULT_SCOPES));
  const bad = scopes.filter((scope) => !allowed.has(scope));
  if (bad.length) {
    return jsonResponse(
      400,
      {
        error: "scope_not_allowed",
        error_description: `代理不允许申请这些权限：${bad.join(", ")}`,
      },
      { env, origin }
    );
  }

  const params = new URLSearchParams({
    client_id: id.clientId,
    scope: scopes.join(" "),
  });
  const data = await githubPost(DEVICE_CODE_URL, params);
  const status = data._status || 200;
  return jsonResponse(status, pick(data, data.error ? ["error", "error_description", ...DEVICE_FIELDS] : DEVICE_FIELDS), {
    env,
    origin,
  });
}

async function deviceToken(body, context) {
  const { env, origin } = context;
  const id = resolveClientId(body, env);
  if (id.errorStatus) return jsonResponse(id.errorStatus, id.errorBody, { env, origin });

  const deviceCodeValue = String(body.device_code || "").trim();
  if (!deviceCodeValue || deviceCodeValue.length > 512) {
    return jsonResponse(
      400,
      { error: "invalid_request", error_description: "缺少或非法的 device_code" },
      { env, origin }
    );
  }

  const params = new URLSearchParams({
    client_id: id.clientId,
    device_code: deviceCodeValue,
    grant_type: DEVICE_GRANT,
  });
  const data = await githubPost(ACCESS_TOKEN_URL, params);
  const status = data._status || 200;
  return jsonResponse(status, pick(data, TOKEN_FIELDS), { env, origin });
}

/**
 * 适配器入口。body 已由适配器解析成普通对象。
 * @param {{method:string,path:string,origin?:string,body?:object}} request
 * @param {Record<string,string>} env
 * @returns {Promise<{status:number,headers:Record<string,string>,body:any}>}
 */
export async function handleRequest(request, env = {}) {
  const method = String(request?.method || "GET").toUpperCase();
  const path = String(request?.path || "/").replace(/\/+$/, "") || "/";
  const origin = String(request?.origin || "");
  const body = request?.body && typeof request.body === "object" ? request.body : {};

  if (method === "OPTIONS") {
    return jsonResponse(204, null, { env, origin });
  }

  // 浏览器跨域请求一定带 Origin；带了但不在白名单里，直接拒掉（响应里也没有 ACAO）。
  if (origin && !allowedOrigin(origin, env)) {
    return jsonResponse(
      403,
      { error: "origin_not_allowed", error_description: "这个站点不在 OAuth 代理的白名单里。" },
      { env, origin }
    );
  }

  if (path === "/health" || path === "/") {
    if (method !== "GET") {
      return jsonResponse(405, { error: "method_not_allowed" }, { env, origin });
    }
    return jsonResponse(
      200,
      {
        ok: true,
        configured: Boolean(String(env.GITHUB_CLIENT_ID || "").trim()),
        scopes: splitList(env.ALLOWED_SCOPES || DEFAULT_SCOPES),
      },
      { env, origin }
    );
  }

  if (path === "/device/code") {
    if (method !== "POST") return jsonResponse(405, { error: "method_not_allowed" }, { env, origin });
    return deviceCode(body, { env, origin });
  }

  if (path === "/device/token") {
    if (method !== "POST") return jsonResponse(405, { error: "method_not_allowed" }, { env, origin });
    return deviceToken(body, { env, origin });
  }

  return jsonResponse(404, { error: "not_found" }, { env, origin });
}
