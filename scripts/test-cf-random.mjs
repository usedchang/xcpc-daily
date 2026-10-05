#!/usr/bin/env node
/**
 * 「随机一题」的随机性测试。
 *
 *   node scripts/test-cf-random.mjs          # 离线：合成题库，覆盖全部逻辑分支
 *   node scripts/test-cf-random.mjs --live   # 额外拉一次真实 Codeforces 题库做验收
 *
 * 要回答的问题只有一个：**每点一次，抽到的题是不是真的和之前不一样？**
 * 因此断言分三层：
 *   1. 结构性：一轮之内绝不重复、每 m 次恰好覆盖整个池子、相邻两次绝不相同
 *      （池子只剩 1 题时物理上无解，单独放行）；
 *   2. 分布：用真·随机源（crypto）跑大样本卡方检验，确认不是「反复抽同几道题」
 *      这种「看着不重复、其实不均匀」的假随机；
 *   3. 端到端：筛选条件 → 候选池 → 抽取结果，抽中的题必须条条满足筛选条件。
 *
 * 结构性与分布性分开用两个随机源：结构断言两种随机源都跑一遍（伪随机那个
 * 可复现，出问题能直接照着种子复算）；分布断言只认真实随机源。
 * 全程不 import Vue，跑的就是页面上那份 src/data/*.js。
 */
import assert from "node:assert/strict";
import { createDrawEngine, problemKey, randomBelow } from "../src/data/cfRandom.js";
import {
  cfKeyFromLink,
  collectTags,
  decodeCache,
  encodeCache,
  filterProblems,
  normalizeProblems,
  problemUrl,
  ratingBounds,
} from "../src/data/cfProblems.js";

/* ------------------------------------------------------------------ *
 * 迷你测试框架
 * ------------------------------------------------------------------ */
let passed = 0;
const failures = [];
let currentGroup = "";

function group(name) {
  currentGroup = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failures.push({ group: currentGroup, name, err });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`      ${String(err.message).split("\n").join("\n      ")}`);
  }
}

/* ------------------------------------------------------------------ *
 * 两个随机源
 * ------------------------------------------------------------------ */

/** 真·随机源（页面默认走的那条路）。 */
const cryptoRand = (n) => randomBelow(n);

/** 可复现的伪随机源：出问题时按种子复算即可重现同一串抽取。 */
function seededRandBelow(seed) {
  let s = seed >>> 0;
  const next = () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return (n) => Math.floor(next() * n);
}

const SOURCES = [
  ["crypto 随机源", cryptoRand],
  ["伪随机源(种子 20261004)", seededRandBelow(20261004)],
];

/* ------------------------------------------------------------------ *
 * 统计工具：卡方检验
 * ------------------------------------------------------------------ */
/**
 * 卡方统计量。
 * @param {number[]} observed 每档观测次数
 * @param {number} expected 每档期望次数（各档相同）
 */
function chiSquare(observed, expected) {
  let x2 = 0;
  for (const o of observed) {
    const d = o - expected;
    x2 += (d * d) / expected;
  }
  return x2;
}

/**
 * 卡方检验临界值表（右侧 α 分位点）。不引第三方库，小自由度直接查表；
 * 真实题库那几条测试的自由度能到上千，查表不现实，改用正态近似（见下）。
 */
const CHI2_CRITICAL = {
  // df: [α=0.001, α=1e-5]
  6: [22.458, 32.0],
  9: [27.877, 37.7],
  49: [86.661, 105.0],
};

/** 上侧 α 对应的标准正态分位点（只用到这两个）。 */
const Z = { 0.001: 3.0902, 0.00001: 4.2649 };

/**
 * 自由度 df、上侧概率 α 的卡方临界值。
 * df > 100 时 χ²(df) 已经非常接近 N(df, 2df)（偏度 ~1/√df 可以忽略），
 * 用正态近似比硬编码一张大表更实在。
 */
function chi2Critical(df, alpha = 1e-5) {
  const tab = CHI2_CRITICAL[df];
  if (tab) return alpha >= 0.001 ? tab[0] : tab[1];
  return df + Z[alpha] * Math.sqrt(2 * df);
}

function assertUniform(observed, expected, df, label) {
  const crit = chi2Critical(df);
  const x2 = chiSquare(observed, expected);
  assert.ok(
    x2 <= crit,
    `${label}: 卡方统计量 ${x2.toFixed(2)} 超过临界值 ${crit.toFixed(1)}（df=${df}, α=1e-5），分布不像均匀的`
  );
  return x2;
}

/* ------------------------------------------------------------------ *
 * 合成题库
 * ------------------------------------------------------------------ */
const ALL_TAGS = ["dp", "greedy", "math", "graphs", "trees", "binary search", "strings", "geometry"];

/**
 * 造一张 `n` 道题的合成题库：分数 800..3500 循环，标签 1~4 个（用固定种子的
 * 伪随机挑，保证标签组合像真实题库那样有交集 —— 早先按固定顺序取连续标签，
 * 会造出「dp 和 binary search 永不同现」的假数据，筛选测试就失去意义了）。
 */
function makePool(n, { withUnrated = 0, seed = 20261004 } = {}) {
  const rand = seededRandBelow(seed);
  const out = [];
  for (let i = 0; i < n; i += 1) {
    const tagCount = 1 + rand(4);
    const tags = [];
    let guard = 0;
    while (tags.length < tagCount && guard < 50) {
      const t = ALL_TAGS[rand(ALL_TAGS.length)];
      if (!tags.includes(t)) tags.push(t);
      guard += 1;
    }
    out.push({
      contestId: 1000 + Math.floor(i / 10),
      index: String.fromCharCode(65 + (i % 10)),
      name: `Problem ${i}`,
      rating: 800 + (i % 28) * 100,
      tags,
    });
  }
  for (let i = 0; i < withUnrated; i += 1) {
    out.push({
      contestId: 9000 + i,
      index: "A",
      name: `Unrated ${i}`,
      rating: null,
      tags: [ALL_TAGS[i % ALL_TAGS.length]],
    });
  }
  return out;
}

const keysOf = (list) => list.map((p) => problemKey(p));

/* ================================================================== *
 * 1. randomBelow：随机源本身
 * ================================================================== */
group("1. randomBelow —— 均匀随机整数");

test("非法入参直接抛错（0 / 负数 / 小数 / 超过 2^32）", () => {
  for (const bad of [0, -1, -100, 1.5, NaN, Infinity, 2 ** 32 + 1]) {
    assert.throws(() => randomBelow(bad), RangeError, `n=${bad} 应该抛 RangeError`);
  }
});

test("n = 1 时返回 0（不进入采样循环）", () => {
  assert.equal(randomBelow(1), 0);
});

test("取值恒在 [0, n) 内", () => {
  for (let i = 0; i < 20000; i += 1) {
    const v = randomBelow(1000);
    assert.ok(Number.isInteger(v) && v >= 0 && v < 1000, `越界：${v}`);
  }
});

test("分布均匀：n = 7（非 2 的幂）10 万次采样卡方检验", () => {
  const n = 7;
  const rounds = 100000;
  const hits = new Array(n).fill(0);
  for (let i = 0; i < rounds; i += 1) hits[randomBelow(n)] += 1;
  const x2 = assertUniform(hits, rounds / n, 6, "n=7");
  console.log(`      χ² = ${x2.toFixed(2)}（df=6，临界值 32.0）`);
});

test("分布均匀：n = 1000 分 10 档，10 万次采样卡方检验", () => {
  const rounds = 100000;
  const bins = new Array(10).fill(0);
  for (let i = 0; i < rounds; i += 1) bins[Math.floor(randomBelow(1000) / 100)] += 1;
  const x2 = assertUniform(bins, rounds / 10, 9, "n=1000");
  console.log(`      χ² = ${x2.toFixed(2)}（df=9，临界值 37.7）`);
});

test("拒绝采样真的在拒绝：被拒的样本不会进入结果", () => {
  // n = 3 时 limit = floor(2^32 / 3) * 3 = 4294967295，
  // 因此 4294967295 必须被丢掉、4294967294 必须被接受（4294967294 % 3 === 2）。
  const values = [4294967295, 4294967294];
  let calls = 0;
  const fakeFill = (buf) => {
    buf[0] = values[Math.min(calls, values.length - 1)];
    calls += 1;
  };
  assert.equal(randomBelow(3, fakeFill), 2, "应当拒绝 4294967295 后接受 4294967294");
  assert.equal(calls, 2, "第一次采样应当被判定为拒绝");
});

test("注入自定义随机源时按注入的实现取值", () => {
  const fill = (buf) => {
    buf[0] = 12345;
  };
  assert.equal(randomBelow(10, fill), 12345 % 10);
});

/* ================================================================== *
 * 2. createDrawEngine：不放回抽取（「每次都不一样」的核心保证）
 * ================================================================== */
group("2. createDrawEngine —— 一轮内绝不重复");

for (const [srcName, rand] of SOURCES) {
  test(`[${srcName}] 池子 1000 题抽 1000 次：1000 个结果互不相同`, () => {
    const pool = makePool(1000);
    const eng = createDrawEngine(pool, rand);
    const drawn = [];
    for (let i = 0; i < pool.length; i += 1) drawn.push(problemKey(eng.next()));
    assert.equal(new Set(drawn).size, pool.length, "同一轮内出现了重复题目");
    assert.deepEqual([...drawn].sort(), keysOf(pool).sort(), "一轮没有恰好覆盖整个池子");
    assert.equal(eng.drawnInCycle, pool.length);
    assert.equal(eng.remainingInCycle, 0);
  });

  test(`[${srcName}] 抽 5 轮（5 × 300 次）：任意相邻两次都不同`, () => {
    const pool = makePool(300);
    const eng = createDrawEngine(pool, rand);
    let prev = null;
    for (let i = 0; i < pool.length * 5; i += 1) {
      const cur = problemKey(eng.next());
      if (prev !== null) {
        assert.notEqual(cur, prev, `第 ${i + 1} 次抽到了和上一次相同的题 ${cur}`);
      }
      prev = cur;
    }
  });

  test(`[${srcName}] 每连续 37 次构成一个完整排列（块内无重复）`, () => {
    const size = 37;
    const pool = makePool(size);
    const eng = createDrawEngine(pool, rand);
    for (let cycle = 0; cycle < 20; cycle += 1) {
      const block = [];
      for (let i = 0; i < size; i += 1) block.push(problemKey(eng.next()));
      assert.equal(new Set(block).size, size, `第 ${cycle + 1} 轮块内出现重复`);
    }
  });

  test(`[${srcName}] 池子 1..8 全部枚举：相邻不重复 + 每一整轮无重复`, () => {
    for (let size = 1; size <= 8; size += 1) {
      const pool = makePool(size);
      const eng = createDrawEngine(pool, rand);
      const drawn = [];
      for (let i = 0; i < size * 30; i += 1) drawn.push(problemKey(eng.next()));

      for (let i = 1; i < drawn.length; i += 1) {
        if (size === 1) break; // 只有一道题时必然重复，物理上无解
        assert.notEqual(drawn[i], drawn[i - 1], `池大小 ${size}：第 ${i + 1} 次与上一次相同`);
      }
      if (size > 1) {
        // 「不重复」的窗口必须与轮次对齐：第 k 轮 = [k·m, (k+1)·m)。
        // 错位的滑动窗口（如 [1, m+1)）横跨两轮，而跨轮时只保证「不与上一轮最后一题
        // 相同」，第 1 题完全可能等于上一轮的第 2 题 —— 这是不放回抽样的固有边界，
        // 想连错位窗口都不重复，就必须牺牲均匀性（等价于禁用近 m 次出现过的题）。
        for (let start = 0; start + size <= drawn.length; start += size) {
          const win = drawn.slice(start, start + size);
          assert.equal(new Set(win).size, size, `池大小 ${size}：第 ${start / size + 1} 轮内有重复`);
        }
      }
    }
  });

  test(`[${srcName}] 池子只有 2 题时严格交替（a,b,a,b,…）`, () => {
    const pool = makePool(2);
    const eng = createDrawEngine(pool, rand);
    const seq = [];
    for (let i = 0; i < 20; i += 1) seq.push(problemKey(eng.next()));
    for (let i = 2; i < seq.length; i += 1) {
      assert.equal(seq[i], seq[i - 2], "两题池应当严格交替");
    }
  });
}

test("池子只有 1 题：反复返回同一题，不抛错也不死循环", () => {
  const pool = makePool(1);
  const eng = createDrawEngine(pool, cryptoRand);
  for (let i = 0; i < 50; i += 1) {
    assert.equal(problemKey(eng.next()), problemKey(pool[0]));
  }
  assert.equal(eng.poolSize, 1);
  assert.equal(eng.drawn, 50);
});

test("空池：next() 返回 null，计数保持 0", () => {
  const eng = createDrawEngine([], cryptoRand);
  assert.equal(eng.next(), null);
  assert.equal(eng.poolSize, 0);
  assert.equal(eng.drawn, 0);
  assert.equal(eng.drawnInCycle, 0);
});

test("非数组入参按空池处理（不炸）", () => {
  for (const bad of [null, undefined, 42, "abc", {}]) {
    assert.equal(createDrawEngine(bad, cryptoRand).next(), null);
  }
});

test("reset() 之后重新开一轮，计数归零", () => {
  const pool = makePool(50);
  const eng = createDrawEngine(pool, cryptoRand);
  for (let i = 0; i < 21; i += 1) eng.next();
  assert.equal(eng.drawnInCycle, 21);
  eng.reset();
  assert.equal(eng.drawnInCycle, 0);
  assert.equal(eng.drawn, 0);
  assert.equal(eng.remainingInCycle, 50);
  const block = [];
  for (let i = 0; i < 50; i += 1) block.push(problemKey(eng.next()));
  assert.equal(new Set(block).size, 50, "reset 后的一轮仍然覆盖整个池子");
});

test("本轮进度计数与实际抽取次数一致（UI 上那一行「本轮已抽 x / y」）", () => {
  const pool = makePool(120);
  const eng = createDrawEngine(pool, cryptoRand);
  for (let i = 1; i <= 400; i += 1) {
    eng.next();
    const inCycle = ((i - 1) % 120) + 1;
    assert.equal(eng.drawnInCycle, inCycle, `第 ${i} 次后 drawnInCycle 应为 ${inCycle}`);
    assert.equal(eng.remainingInCycle, 120 - inCycle);
  }
});

/* ------------------------------------------------------------------ *
 * 2b. 分布均匀性：不是「反复抽同几道题」的假随机
 * ------------------------------------------------------------------ */
group("3. 抽取结果分布 —— 大样本卡方检验（真实随机源）");

test("池子 50 题、整 1000 轮：每题出现次数**完全相等**（每轮都是全排列）", () => {
  const size = 50;
  const pool = makePool(size);
  const eng = createDrawEngine(pool, cryptoRand);
  const hits = new Map(keysOf(pool).map((k) => [k, 0]));
  for (let i = 0; i < size * 1000; i += 1) {
    const k = problemKey(eng.next());
    hits.set(k, hits.get(k) + 1);
  }
  const observed = [...hits.values()];
  assert.deepEqual(
    [...new Set(observed)],
    [1000],
    `整轮抽样时每题次数必须严格相等，实测区间 [${Math.min(...observed)}, ${Math.max(...observed)}]`
  );
});

test("池子 50 题、抽 1000 轮 + 13 次（非整轮）：卡方检验仍然均匀", () => {
  const size = 50;
  const pool = makePool(size);
  const eng = createDrawEngine(pool, cryptoRand);
  const rounds = size * 1000 + 13; // 故意不取整轮：否则次数被排列结构锁死，检验不到分布
  const hits = new Map(keysOf(pool).map((k) => [k, 0]));
  for (let i = 0; i < rounds; i += 1) {
    const k = problemKey(eng.next());
    hits.set(k, hits.get(k) + 1);
  }
  const observed = [...hits.values()];
  const expected = rounds / size;
  const x2 = assertUniform(observed, expected, size - 1, "池 50");
  console.log(
    `      每档期望 ${expected.toFixed(1)}，实测区间 [${Math.min(...observed)}, ${Math.max(...observed)}]，χ² = ${x2.toFixed(2)}（df=49，临界值 105.0）`
  );
});

test("抽 2 万次后仍无相邻重复（长跑不退化）", () => {
  const pool = makePool(500);
  const eng = createDrawEngine(pool, cryptoRand);
  let prev = problemKey(eng.next());
  for (let i = 1; i < 20000; i += 1) {
    const cur = problemKey(eng.next());
    assert.notEqual(cur, prev, `第 ${i + 1} 次与上一次重复`);
    prev = cur;
  }
});

/* ================================================================== *
 * 4. filterProblems：候选池筛选
 * ================================================================== */
group("4. filterProblems —— 候选池筛选");

test("分数区间是闭区间（上下界都算命中）", () => {
  const pool = makePool(200);
  const hit = filterProblems(pool, { minRating: 1200, maxRating: 1600, includeUnrated: false });
  assert.ok(hit.length > 0);
  for (const p of hit) {
    assert.ok(p.rating >= 1200 && p.rating <= 1600, `${p.name} 分数 ${p.rating} 越界`);
  }
  const hasEdge = hit.some((p) => p.rating === 1200) || hit.some((p) => p.rating === 1600);
  assert.ok(hasEdge, "上下界应当被包含进来");
});

test("未评级题目：默认排除，勾选后包含且不受分数区间限制", () => {
  const pool = makePool(60, { withUnrated: 5 });
  const withoutUnrated = filterProblems(pool, { minRating: 800, maxRating: 3500 });
  assert.equal(withoutUnrated.length, 60);
  const withUnrated = filterProblems(pool, { minRating: 800, maxRating: 3500, includeUnrated: true });
  assert.equal(withUnrated.length, 65);
  assert.equal(withUnrated.filter((p) => p.rating === null).length, 5);
});

test("标签「全部满足」：所选标签必须全部命中", () => {
  const pool = makePool(200);
  const hit = filterProblems(pool, { tags: ["dp", "greedy"], tagMode: "all" });
  assert.ok(hit.length > 0);
  for (const p of hit) {
    assert.ok(p.tags.includes("dp") && p.tags.includes("greedy"), `${p.name} 缺少所选标签`);
  }
});

test("标签「任一满足」：命中一个即可，且是「全部满足」的超集", () => {
  const pool = makePool(200);
  const any = filterProblems(pool, { tags: ["dp", "greedy"], tagMode: "any" });
  const all = filterProblems(pool, { tags: ["dp", "greedy"], tagMode: "all" });
  assert.ok(any.length > all.length, "并集应当严格大于交集");
  for (const p of any) {
    assert.ok(p.tags.includes("dp") || p.tags.includes("greedy"));
  }
});

test("条件叠加：分数 + 标签 + 未评级一起生效", () => {
  const pool = makePool(400, { withUnrated: 8 });
  const hit = filterProblems(pool, {
    tags: ["math"],
    tagMode: "all",
    minRating: 1000,
    maxRating: 2000,
    includeUnrated: false,
  });
  for (const p of hit) {
    assert.ok(p.tags.includes("math"));
    assert.ok(p.rating >= 1000 && p.rating <= 2000);
  }
});

test("无筛选条件时返回副本（长度一致、但不是同一个数组引用）", () => {
  const pool = makePool(30);
  const out = filterProblems(pool, {});
  assert.equal(out.length, pool.length);
  assert.notEqual(out, pool);
});

test("筛选不出题目时返回空数组（页面据此禁用按钮）", () => {
  const pool = makePool(50);
  assert.deepEqual(filterProblems(pool, { minRating: 3499, maxRating: 3500, tags: ["不存在的标签"] }), []);
  assert.deepEqual(filterProblems([], { tags: ["dp"] }), []);
  assert.deepEqual(filterProblems(null, {}), []);
});

/* ================================================================== *
 * 5. 端到端：筛选 → 抽题
 * ================================================================== */
group("5. 端到端 —— 筛选条件与抽取结果必须自洽");

test("抽中的题条条满足筛选条件；抽满一轮互不重复", () => {
  // 4000 题里同时带 dp+binary search 且落在 1200-2400 分的，合成数据里约 8%×46%，
  // 真实题库（1.1 万题）上这个组合能筛出几百道，量级一致
  const pool = makePool(4000, { withUnrated: 12 });
  const opts = {
    tags: ["dp", "binary search"],
    tagMode: "all",
    minRating: 1200,
    maxRating: 2400,
    includeUnrated: false,
  };
  const candidates = filterProblems(pool, opts);
  console.log(`      候选池 ${candidates.length} 题（原始 ${pool.length} 题）`);
  assert.ok(candidates.length >= 100, `候选池太小（${candidates.length}），测试没有意义`);

  // 抽满一整轮 + 再抽 50 次（跨轮），全程校验条件合规
  const eng = createDrawEngine(candidates, cryptoRand);
  const seen = new Set();
  const rounds = candidates.length + 50;
  for (let i = 0; i < rounds; i += 1) {
    const p = eng.next();
    assert.ok(p.tags.includes("dp") && p.tags.includes("binary search"), `${p.name} 标签不符`);
    assert.ok(p.rating >= 1200 && p.rating <= 2400, `${p.name} 分数不符`);
    const k = problemKey(p);
    if (i < candidates.length) {
      assert.ok(!seen.has(k), `第 ${i + 1} 次重复抽到 ${k}`);
      seen.add(k);
    }
  }
  assert.equal(seen.size, candidates.length, "第一轮应当恰好覆盖整个候选池");
});

test("模拟连点：同一个 engine 连续点击，抽到的题互不相同", () => {
  // 与 useCfRandom.draw() 的用法一致：候选池变了才重建 engine，点击只调 next()
  const candidates = filterProblems(makePool(1500), { minRating: 1600, maxRating: 2000 });
  assert.ok(candidates.length > 0);
  const eng = createDrawEngine(candidates, cryptoRand);

  const clicks = candidates.length + 40; // 故意越过一轮，检验跨轮行为
  const firstCycle = [];
  const all = [];
  for (let i = 0; i < clicks; i += 1) {
    const p = eng.next();
    assert.ok(p, "候选池非空时不应返回 null");
    const k = problemKey(p);
    all.push(k);
    if (i < candidates.length) firstCycle.push(k);
  }

  assert.equal(
    new Set(firstCycle).size,
    candidates.length,
    `前 ${candidates.length} 次点击只得到 ${new Set(firstCycle).size} 道不同的题`
  );
  for (let i = 1; i < all.length; i += 1) {
    assert.notEqual(all[i], all[i - 1], `第 ${i + 1} 次点击抽到了和上一次相同的题`);
  }
  // 跨轮之后总数会回落：m 道题的池子连点 m+40 次，最多只能有 m 种结果
  assert.equal(new Set(all).size, candidates.length, "长期结果不应超出候选池范围");
  console.log(`      候选 ${candidates.length} 题，连点 ${clicks} 次：第一轮 ${candidates.length} 题全不重复，全程无相邻重复`);
});

/* ================================================================== *
 * 6. cfProblems 工具函数
 * ================================================================== */
group("6. cfProblems —— 题号 / 链接 / 序列化");

test("problemKey 与 problemUrl（gym 走 /gym/ 路径）", () => {
  const p = { contestId: 2269, index: "B" };
  assert.equal(problemKey(p), "2269B");
  assert.equal(problemUrl(p), "https://codeforces.com/problemset/problem/2269/B");
  assert.equal(
    problemUrl({ contestId: 103306, index: "K" }),
    "https://codeforces.com/gym/103306/problem/K",
    "gym 题目用 problemset 路径会 404"
  );
  assert.equal(problemKey({}), "");
  assert.equal(problemUrl(null), "");
});

test("cfKeyFromLink 认得三种链接写法，认不出的返回空串", () => {
  assert.equal(cfKeyFromLink("https://codeforces.com/problemset/problem/2269/B"), "2269B");
  assert.equal(cfKeyFromLink("https://codeforces.com/contest/2269/problem/B"), "2269B");
  assert.equal(cfKeyFromLink("https://codeforces.com/gym/100000/problem/A1"), "100000A1");
  assert.equal(cfKeyFromLink("https://www.luogu.com.cn/problem/P8819"), "");
  assert.equal(cfKeyFromLink(""), "");
  assert.equal(cfKeyFromLink(null), "");
});

test("normalizeProblems 丢掉残缺项并规整字段", () => {
  const raw = [
    { contestId: 1, index: "A", name: "Good", rating: 800, tags: ["dp", 42, ""] },
    { contestId: 1, index: "B", name: "NoRating", tags: [] },
    { contestId: 1, name: "NoIndex" },
    { index: "C", name: "NoContest" },
    null,
    { contestId: 2, index: "D", name: "NoTags" },
  ];
  const out = normalizeProblems(raw);
  assert.deepEqual(out.map((p) => p.index), ["A", "B", "D"]);
  assert.deepEqual(out[0].tags, ["dp"]);
  assert.equal(out[1].rating, null);
  assert.deepEqual(out[2].tags, []);
  assert.deepEqual(normalizeProblems("nope"), []);
});

test("collectTags 计数并倒序", () => {
  const list = normalizeProblems([
    { contestId: 1, index: "A", name: "a", tags: ["dp", "math"] },
    { contestId: 1, index: "B", name: "b", tags: ["dp"] },
  ]);
  assert.deepEqual(collectTags(list), [
    { name: "dp", count: 2 },
    { name: "math", count: 1 },
  ]);
  assert.deepEqual(collectTags([]), []);
});

test("ratingBounds 取真实区间，空数据回退 CF 固定范围", () => {
  const list = normalizeProblems([
    { contestId: 1, index: "A", name: "a", rating: 1100, tags: [] },
    { contestId: 1, index: "B", name: "b", rating: 3000, tags: [] },
    { contestId: 1, index: "C", name: "c", tags: [] },
  ]);
  assert.deepEqual(ratingBounds(list), { min: 1100, max: 3000 });
  assert.deepEqual(ratingBounds([]), { min: 800, max: 3500 });
});

test("缓存编解码往返一致（含中文题名、空标签、null 分数）", () => {
  const list = normalizeProblems([
    { contestId: 2269, index: "B", name: "KiaKio and Squared Numbers", rating: 1000, tags: ["brute force", "implementation"] },
    { contestId: 207, index: "D10", name: "海狸的问题 - 3", tags: [] },
    { contestId: 100, index: "A", name: "无标签无分", tags: [] },
  ]);
  const restored = decodeCache(JSON.parse(JSON.stringify(encodeCache(list))));
  assert.deepEqual(restored, list);
});

test("缓存解码对损坏输入返回 null（页面据此当作没有缓存）", () => {
  assert.equal(decodeCache(null), null);
  assert.equal(decodeCache({}), null);
  assert.equal(decodeCache({ v: 2, tags: [], rows: [] }), null);
  assert.equal(decodeCache({ v: 1, tags: [], rows: [] }), null);
});

/* ================================================================== *
 * 7. 真实题库验收（--live）
 * ================================================================== */
async function liveSuite() {
  group("7. 真实 Codeforces 题库验收（--live）");

  let problems;
  try {
    const res = await fetch("https://codeforces.com/api/problemset.problems", { cache: "no-store" });
    assert.equal(res.status, 200);
    const json = await res.json();
    assert.equal(json.status, "OK");
    problems = normalizeProblems(json.result.problems);
  } catch (err) {
    console.log(`  \x1b[33m!\x1b[0m 跳过：无法访问 Codeforces API（${err.message}）`);
    return;
  }

  const tags = collectTags(problems);
  const bounds = ratingBounds(problems);
  console.log(
    `      题库 ${problems.length} 题 · 标签 ${tags.length} 个 · 分数 ${bounds.min}-${bounds.max}`
  );

  test("真实题库：抽 2000 次，同一轮内零重复", () => {
    const eng = createDrawEngine(problems, cryptoRand);
    const seen = new Set();
    for (let i = 0; i < 2000; i += 1) {
      const k = problemKey(eng.next());
      assert.ok(!seen.has(k), `第 ${i + 1} 次重复：${k}`);
      seen.add(k);
    }
    assert.equal(seen.size, 2000);
  });

  test("真实题库：抽 20000 次，任意相邻两次都不同", () => {
    const eng = createDrawEngine(problems, cryptoRand);
    let prev = problemKey(eng.next());
    for (let i = 1; i < 20000; i += 1) {
      const cur = problemKey(eng.next());
      assert.notEqual(cur, prev, `第 ${i + 1} 次与上一次重复`);
      prev = cur;
    }
  });

  test("真实题库 + 真实筛选：dp+graphs、1400-1800 分，抽 300 次全不重复且全部合规", () => {
    const pool = filterProblems(problems, {
      tags: ["dp", "graphs"],
      tagMode: "all",
      minRating: 1400,
      maxRating: 1800,
    });
    console.log(`      该条件下候选 ${pool.length} 题`);
    assert.ok(pool.length >= 50, `候选只有 ${pool.length} 题，样本太少`);

    const eng = createDrawEngine(pool, cryptoRand);
    const seen = new Set();
    const n = Math.min(300, pool.length);
    for (let i = 0; i < n; i += 1) {
      const p = eng.next();
      assert.ok(p.tags.includes("dp") && p.tags.includes("graphs"), `${p.name} 标签不符`);
      assert.ok(p.rating >= 1400 && p.rating <= 1800, `${p.name} 分数不符`);
      const k = problemKey(p);
      assert.ok(!seen.has(k), `重复抽到 ${k}`);
      seen.add(k);
    }
    assert.equal(seen.size, n);
  });

  test("真实题库：分布均匀（抽 5000 次，每题出现次数落在合理区间）", () => {
    const pool = filterProblems(problems, { minRating: 2000, maxRating: 2100 });
    assert.ok(pool.length >= 100, `候选只有 ${pool.length} 题`);
    const eng = createDrawEngine(pool, cryptoRand);
    // +13 同样是为了避开「整轮次数被排列结构锁死」，让卡方真正检验分布
    const rounds = pool.length * 20 + 13;
    const hits = new Map(keysOf(pool).map((k) => [k, 0]));
    for (let i = 0; i < rounds; i += 1) {
      const k = problemKey(eng.next());
      hits.set(k, hits.get(k) + 1);
    }
    const expected = rounds / pool.length;
    const x2 = assertUniform([...hits.values()], expected, pool.length - 1, "真实池");
    console.log(
      `      候选 ${pool.length} 题 × 20 轮，每档期望 ${expected.toFixed(1)}，χ² = ${x2.toFixed(2)}（df=${pool.length - 1}）`
    );
  });
}

/* ------------------------------------------------------------------ *
 * 收尾
 * ------------------------------------------------------------------ */
const live = process.argv.includes("--live");
if (live) await liveSuite();

console.log("\n" + "─".repeat(60));
if (failures.length) {
  console.log(`\x1b[31m失败 ${failures.length} 项\x1b[0m，通过 ${passed} 项`);
  for (const f of failures) {
    console.log(`  · [${f.group}] ${f.name}`);
  }
  process.exit(1);
}
console.log(`\x1b[32m全部通过：${passed} 项\x1b[0m${live ? "（含真实题库验收）" : "（离线；加 --live 可跑真实题库验收）"}`);
