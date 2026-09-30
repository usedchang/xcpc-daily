const S = "https://usedchang.github.io/xcpc-daily/";
const get = async (p) => {
  const r = await fetch(new URL(p, S), { headers: { "user-agent": "Mozilla/5.0 diag", "cache-control": "no-cache" } });
  return { status: r.status, type: r.headers.get("content-type"), lm: r.headers.get("last-modified"), body: await r.text() };
};

const idx = await get(`index.html?t=${Date.now()}`);
console.log("== index.html ==", idx.status, "| last-modified:", idx.lm);
console.log(idx.body.replace(/\s+/g, " ").trim());

const m = /src="\.\/(assets\/index-[^"?]+\.js)(\?v=[^"]*)?"/.exec(idx.body);
if (m) {
  const bare = await get(`assets/${m[1]}?t=${Date.now()}`);
  const withV = await get(`assets/${m[1]}${m[2] || ""}&t=${Date.now()}`);
  console.log(`\n== ${m[1]} ==`);
  console.log("  裸 URL:", bare.status);
  console.log("  带 ?v=:", withV.status, withV.status === 200 ? `长度 ${withV.body.length} 含数据=${withV.body.includes("Bracket-and-bar Sequences")}` : "");
}

// 探测若干常见资源，判断站点整体是否可用
for (const p of ["", "data/index.json", "solutions/index.json", "assets/index-Bz2dkL3Z.css"]) {
  const r = await get(p + (p.includes("?") ? "&" : "?") + `t=${Date.now()}`);
  console.log(`\n${p || "(根)"}: ${r.status} ${r.type} 长度 ${r.body.length}`);
}
