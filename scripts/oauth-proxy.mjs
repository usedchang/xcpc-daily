#!/usr/bin/env node
/**
 * 本地开发用的 OAuth Device Flow 代理（零依赖，Node 18+）。
 *
 *   npm run auth:proxy
 *
 * 作用与 server/oauth-proxy/worker.mjs 相同，只是跑在本机：
 * 浏览器里的 GitHub 登录请求打到 http://127.0.0.1:8787，由它转发给 GitHub，
 * 再补上 CORS 头。它不落盘、不记录设备码或令牌。
 *
 * Client ID 读取顺序：
 *   1. 环境变量 GITHUB_CLIENT_ID
 *   2. .env.local / .env 里的 VITE_GITHUB_CLIENT_ID
 *
 * 同时需要在前端 .env.local 里写：
 *   VITE_GITHUB_CLIENT_ID=...
 *   VITE_GITHUB_AUTH_PROXY=http://127.0.0.1:8787
 */
import { createServer } from "node:http";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { handleRequest } from "../server/oauth-proxy/core.mjs";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MAX_BODY = 16 * 1024;

/** 极简 .env 读取：不引 dotenv，也不覆盖已经存在的环境变量。 */
function loadEnvFiles() {
  for (const file of [".env.local", ".env"]) {
    const path = resolve(ROOT, file);
    if (!existsSync(path)) continue;
    let text = "";
    try {
      // 记事本另存为 UTF-8 时可能带 BOM，不去掉的话第一行的 VITE_ 变量会匹配不到
      text = readFileSync(path, "utf8").replace(/^\uFEFF/, "");
    } catch {
      continue;
    }
    for (const line of text.split(/\r?\n/)) {
      const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
      if (!m) continue;
      const key = m[1];
      let value = m[2].trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  }
}

loadEnvFiles();

const clientId = String(
  process.env.GITHUB_CLIENT_ID || process.env.VITE_GITHUB_CLIENT_ID || ""
).trim();
const port = Number(process.env.PORT) || 8787;

const env = {
  GITHUB_CLIENT_ID: clientId,
  // 本地只服务自己的 Vite；开 * 也安全，因为 Client ID 是固定的
  ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || "*",
  ALLOWED_SCOPES: process.env.ALLOWED_SCOPES || "read:user gist",
};

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY) {
        reject(new Error("body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) {
        resolveBody({});
        return;
      }
      const type = String(req.headers["content-type"] || "");
      try {
        if (type.includes("application/x-www-form-urlencoded")) {
          resolveBody(Object.fromEntries(new URLSearchParams(raw).entries()));
          return;
        }
        const data = JSON.parse(raw);
        resolveBody(data && typeof data === "object" ? data : {});
      } catch {
        reject(new Error("invalid body"));
      }
    });
    req.on("error", reject);
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
  let body = {};

  if (req.method === "POST") {
    try {
      body = await readBody(req);
    } catch {
      res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
      res.end(JSON.stringify({ error: "invalid_body" }));
      return;
    }
  }

  let result;
  try {
    result = await handleRequest(
      {
        method: req.method || "GET",
        path: url.pathname,
        origin: String(req.headers.origin || ""),
        body,
      },
      env
    );
  } catch (err) {
    result = {
      status: 500,
      headers: { "content-type": "application/json; charset=utf-8" },
      body: { error: "proxy_error", error_description: String(err?.message || err) },
    };
  }

  res.writeHead(result.status, result.headers);
  if (result.status === 204 || result.body === null) {
    res.end();
    return;
  }
  res.end(JSON.stringify(result.body));
});

server.listen(port, "127.0.0.1", () => {
  console.log("");
  console.log("  GitHub OAuth Device Flow 代理已启动");
  console.log(`  地址：http://127.0.0.1:${port}`);
  console.log(`  Client ID：${clientId ? `${clientId.slice(0, 6)}…（已读取）` : "未配置"}`);
  if (!clientId) {
    console.log("");
    console.log("  缺少 GITHUB_CLIENT_ID：在仓库根目录的 .env.local 里写");
    console.log("    VITE_GITHUB_CLIENT_ID=你的 OAuth App Client ID");
    console.log("    VITE_GITHUB_AUTH_PROXY=http://127.0.0.1:8787");
  }
  console.log("");
  console.log("  这个进程只转发设备码请求，不保存令牌；Ctrl+C 停止。");
  console.log("");
});
