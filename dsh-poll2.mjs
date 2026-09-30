// 轮询线上站点，直到「index.html 引用的 bundle」稳定返回 200（Pages CDN 收敛）
const S = "https://usedchang.github.io/xcpc-daily/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function once() {
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
    len: body.length,
  };
}

for (let i = 1; i <= 20; i++) {
  let p;
  try {
    p = await once();
  } catch (e) {
    p = { ok: false, ref: "(请求异常)", status: e.message };
  }
  const t = new Date().toISOString().slice(11, 19);
  console.log(`[${t}] #${String(i).padStart(2)} bundle=${p.ref} status=${p.status} len=${p.len ?? "-"} ${p.ok ? "=> 可用" : "=> 还不可用"}`);
  if (p.ok) break;
  await sleep(15000);
}
