import { execFileSync } from "node:child_process";

function token() {
  const o = execFileSync("git", ["credential", "fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    timeout: 20000,
    stdio: ["pipe", "pipe", "ignore"],
  });
  const m = /^password=(.+)$/m.exec(o);
  return m ? m[1].trim() : "";
}
const T = token();
const H = { authorization: `Bearer ${T}`, "user-agent": "diag", accept: "application/vnd.github+json" };

// 1) 重新跑最近一次成功的部署 workflow（deploy.yml 带 workflow_dispatch）
const disp = await fetch("https://api.github.com/repos/usedchang/xcpc-daily/actions/workflows/deploy.yml/dispatches", {
  method: "POST",
  headers: { ...H, "content-type": "application/json" },
  body: JSON.stringify({ ref: "main" }),
});
console.log("workflow_dispatch:", disp.status, disp.status === 204 ? "(已触发)" : await disp.text());

// 2) 顺便确认线上那个文件现在到底什么状态
const S = "https://usedchang.github.io/xcpc-daily/";
for (const p of ["assets/index-DR18AaMd.js", "assets/index-DR18AaMd.js?v=x", "assets/index-Bz2dkL3Z.css", "data/index.json"]) {
  try {
    const r = await fetch(new URL(p, S) + `&t=${Date.now()}`, { headers: { "user-agent": "Mozilla/5.0", "cache-control": "no-cache" } });
    console.log(`  ${p}: ${r.status} ${r.headers.get("content-type")}`);
  } catch (e) {
    console.log(`  ${p}: ERR ${e.message}`);
  }
}
