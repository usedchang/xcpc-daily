/**
 * Cloudflare Worker 入口：把 core.mjs 的转发逻辑接到 fetch 上。
 *
 * 部署：
 *   cd server/oauth-proxy
 *   npx wrangler deploy
 *
 * 需要先在 wrangler.toml 里填 GITHUB_CLIENT_ID（OAuth App 的 Client ID），
 * 并把站点 Origin 加进 ALLOWED_ORIGINS。
 */
import { handleRequest } from "./core.mjs";

const MAX_BODY = 16 * 1024;

function json(status, body, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

async function readBody(request) {
  const type = request.headers.get("content-type") || "";
  const raw = await request.text();
  if (raw.length > MAX_BODY) throw new Error("body too large");
  if (!raw) return {};
  if (type.includes("application/json")) {
    const data = JSON.parse(raw);
    return data && typeof data === "object" ? data : {};
  }
  // 也兼容 form-urlencoded：curl / 手工调试时更方便
  return Object.fromEntries(new URLSearchParams(raw).entries());
}

export default {
  async fetch(request, env = {}) {
    const url = new URL(request.url);

    let body = {};
    if (request.method === "POST") {
      try {
        body = await readBody(request);
      } catch {
        return json(400, { error: "invalid_body", error_description: "请求体不是合法 JSON" });
      }
    }

    const result = await handleRequest(
      {
        method: request.method,
        path: url.pathname,
        origin: request.headers.get("origin") || "",
        body,
      },
      env
    );

    if (result.status === 204 || result.body === null) {
      return new Response(null, { status: result.status, headers: result.headers });
    }
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: result.headers,
    });
  },
};
