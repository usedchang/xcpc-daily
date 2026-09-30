import { execFileSync } from "node:child_process";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";

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
const H = { authorization: `Bearer ${T}`, "user-agent": "diag" };

const runs = await (await fetch("https://api.github.com/repos/usedchang/xcpc-daily/actions/runs?per_page=1", { headers: H })).json();
const run = runs.workflow_runs[0];
const arts = await (await fetch(run.artifacts_url, { headers: H })).json();
const art = arts.artifacts[0];
console.log(`run#${run.run_number} sha=${run.head_sha.slice(0, 7)} artifact=${art.id} (${art.size_in_bytes}B)`);

const zres = await fetch(art.archive_download_url, { headers: H, redirect: "follow" });
console.log("zip:", zres.status);
const buf = Buffer.from(await zres.arrayBuffer());
mkdirSync(".tmp/art", { recursive: true });
const zip = ".tmp/art/a.zip";
writeFileSync(zip, buf);
console.log("zip 写入:", buf.length, "字节");
