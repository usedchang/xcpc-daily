// 轮询线上 index.html，直到它引用的 bundle 可用（Pages 换版本会有短暂错配窗口）
const S = "https://usedchang.github.io/xcpc-daily/";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function probe() {
  const r = await fetch(`${S}index.html?nocache=${Date.now()}`, {
    headers: { "user-agent": "Mozilla/5.0 diag", "cache-control": "no-cache" },
  });
  const html = await r.text();
  const m = /src="\.\/(assets\/index-[^"?]+\.js)(\?v=[^"]*)?"/.exec(html);
  if (!m) return { ok: false, ref: "(未找到)", status: r.status };
  const js = await fetch(new URL(`assets/${m[1]}${m[2] || ""}`, S) + `&probe=${Date.now()}`, {
    headers: { "user-agent": "Mozilla/5.0 diag" },
  });
  return { ok: js.status === 200, ref: m[1], status: js.status, len: (await js.text()).length, lm: r.headers.get("last-modified") };
}

for (let i = 1; i <= 12; i++) {
  try {
    const p = await probe();
    const stamp = new Date().toISOString().slice(11, 19);
    console.log(`[${stamp}] #${i} bundle=${p.ref} status=${p.status} len=${p.len ?? "-"} lm=${p.lm ?? "-"} ${p.ok ? "=> OK 可用" : "=> 仍错配"}`);
    if (p.ok) break;
  } catch (e) {
    console.log(`#${i} 请求异常: ${e.message}`);
  }
  await sleep(15000);
}
