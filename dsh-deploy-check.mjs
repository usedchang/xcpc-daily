import { execFileSync } from "node:child_process";

function token() {
  try {
    const o = execFileSync("git", ["credential", "fill"], {
      input: "protocol=https\nhost=github.com\n\n",
      encoding: "utf8",
      timeout: 20000,
      stdio: ["pipe", "pipe", "ignore"],
    });
    const m = /^password=(.+)$/m.exec(o);
    return m ? m[1].trim() : "";
  } catch {
    return "";
  }
}
const T = token();
const H = { authorization: `Bearer ${T}`, "user-agent": "diag", accept: "application/vnd.github+json" };
const api = async (p, opts = {}) => {
  const r = await fetch(`https://api.github.com${p}`, { headers: H, ...opts });
  return { status: r.status, json: await r.json().catch(() => null) };
};

const runs = await api("/repos/usedchang/xcpc-daily/actions/runs?per_page=3");
console.log("== 最近 3 次 workflow ==");
for (const r of runs.json?.workflow_runs || []) {
  console.log(`run#${r.run_number} ${r.head_sha.slice(0, 7)} ${r.status}/${r.conclusion} | ${r.display_title.slice(0, 36)} | updated ${r.updated_at}`);
}

const deps = await api("/repos/usedchang/xcpc-daily/deployments?per_page=3");
console.log("\n== 最近部署 ==");
for (const d of deps.json || []) {
  const st = await api(`/repos/usedchang/xcpc-daily/deployments/${d.id}/statuses`);
  const s = (st.json || [])[0];
  console.log(`deployment ${d.id} sha=${d.sha.slice(0, 7)} env=${d.environment} status=${s?.state} updated=${s?.updated_at}`);
}

// 最近一次 Pages artifact 的创建时间，判断是否真的产生了新产物
const latest = (runs.json?.workflow_runs || [])[0];
if (latest) {
  const arts = await api(`/repos/usedchang/xcpc-daily/actions/runs/${latest.id}/artifacts`);
  console.log("\n== 最新 run 的产物 ==");
  for (const a of arts.json?.artifacts || []) {
    console.log(`  ${a.name} ${a.size_in_bytes}B created=${a.created_at} expired=${a.expired}`);
  }
}
