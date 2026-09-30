const S = "https://usedchang.github.io/xcpc-daily/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe() {
  const r = await fetch(`${S}index.html?t=${Date.now()}`, {
    headers: { "user-agent": "Mozilla/5.0 diag", "cache-control": "no-cache" },
  });
  const html = await r.text();
  const m = /src="\.\/(assets\/index-[^"?]+\.js)(\?v=[^"]*)?"/.exec(html);
  if (!m) return { ok: false, ref: "?" };
  const j = await fetch(`${S}assets/${m[1]}${m[2] || ""}`, { headers: { "user-agent": "Mozilla/5.0 diag" } });
  const body = await j.text();
  return {
    ok: j.status === 200 && body.includes("Bracket-and-bar Sequences"),
    ref: m[1],
    status: j.status,
    hasData: body.includes("Bracket-and-bar Sequences"),
    hasFix: body.includes(".default"),
    len: body.length,
  };
}

for (let i = 1; i <= 16; i++) {
  let p;
  try {
    p = await probe();
  } catch (e) {
    p = { ok: false, ref: "(异常)", status: e.message };
  }
  const t = new Date().toISOString().slice(11, 19);
  console.log(
    `[${t}] #${String(i).padStart(2)} bundle=${p.ref} status=${p.status} 含数据=${p.hasData ?? "-"} 含修复=${p.hasFix ?? "-"} ${p.ok ? "=> 正常" : ""}`
  );
  if (p.ok) {
    // 再确认运行时数据文件也可用
    for (const path of ["data/index.json", "solutions/index.json"]) {
      try {
        const x = await fetch(new URL(path, S));
        console.log(`   ${path}: ${x.status}`);
      } catch (e) {
        console.log(`   ${path}: ERR ${e.message}`);
      }
    }
    break;
  }
  await sleep(15000);
}
