/**
 * 随机抽题的纯逻辑层。
 *
 * 这里刻意不 import Vue、不碰 DOM、不读 localStorage：同一份代码既跑在页面上，
 * 也被 `scripts/test-cf-random.mjs` 直接 import 做随机性测试。任何浏览器专属的
 * 东西加进来都会让测试脚本无法运行，所以随机源也自己实现（见 randomBelow）。
 *
 * 抽题要保证的两件事：
 *   1. 随机性来自均匀分布 —— 用 crypto.getRandomValues + 拒绝采样，
 *      而不是 Math.random() * n 再取整（取模会引入偏差，n 不是 2 的幂时更明显）。
 *   2. 一轮之内绝不重复 —— 见 createDrawEngine 的「洗牌池」实现。
 */

/** 2^32：Uint32 随机数的取值个数，拒绝采样的上界。 */
const UINT32_SPAN = 0x100000000;

/**
 * 用随机数填满一个 Uint32Array。
 *
 * 优先 crypto.getRandomValues（浏览器与 Node 18+ 都有；非 HTTPS 环境下它也可用，
 * 受限的是 crypto.subtle 而不是它）。只有在完全没有 crypto 的老环境里才退回
 * Math.random —— 那时随机性变弱，但功能不至于直接挂掉。
 */
function fillRandom(buf) {
  const c = globalThis.crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(buf);
    return;
  }
  for (let i = 0; i < buf.length; i += 1) {
    buf[i] = Math.floor(Math.random() * UINT32_SPAN);
  }
}

/**
 * 返回 [0, n) 上的均匀随机整数。
 *
 * 拒绝采样：2^32 通常不是 n 的整数倍，直接 `x % n` 会让前 (2^32 mod n) 个数
 * 多出现一次。这里把落在尾部的样本整段丢掉重抽，保证每个取值概率严格相等
 * （期望重抽次数 < 2，代价可以忽略）。
 */
export function randomBelow(n, fill = fillRandom) {
  if (!Number.isInteger(n) || n <= 0) {
    throw new RangeError(`randomBelow 需要正整数，收到 ${n}`);
  }
  if (n > UINT32_SPAN) {
    throw new RangeError(`randomBelow 不支持超过 2^32 的范围，收到 ${n}`);
  }
  if (n === 1) return 0;

  const limit = Math.floor(UINT32_SPAN / n) * n;
  const buf = new Uint32Array(1);
  for (;;) {
    fill(buf);
    if (buf[0] < limit) return buf[0] % n;
  }
}

/** 题目的唯一 key：`<contestId><index>`，与 Codeforces 题目 URL 一一对应。 */
export function problemKey(p) {
  if (!p || p.contestId == null || p.index == null) return "";
  return `${p.contestId}${String(p.index).toUpperCase()}`;
}

/**
 * 「不放回」抽题器：把一个候选池当成一副牌，抽过的牌不塞回去。
 *
 * 于是 —— 只要候选池里有 m 道题，连续点 m 次必然得到 m 道**互不相同**的题；
 * 池子抽空后自动开新一轮，并且新一轮的第一题会避开上一轮的最后一题
 * （所以「每次点击都不同」在跨轮的那一刻也成立，池子只剩 1 题时除外，那无解）。
 *
 * 实现用「索引数组 + 交换删除」，每次抽取是 O(1)；池子 1 万多题也不会卡。
 *
 * @param {Array} pool 候选题目
 * @param {(n: number) => number} randBelow 随机源，默认使用 crypto 版；
 *        测试里注入可复现的伪随机函数
 */
export function createDrawEngine(pool, randBelow = randomBelow) {
  const items = Array.isArray(pool) ? pool : [];

  /** 本轮还没抽到的题目下标（顺序无所谓，抽取时当场交换删除）。 */
  let remaining = [];
  /** 新一轮开始时被暂时排除、要在抽完第一题后补回池子的下标（= 上一轮最后一题）。 */
  let pendingAdd = -1;
  /** 上一次抽中的下标，-1 表示还没抽过。 */
  let lastIdx = -1;
  /** 本轮从第几次抽取开始（用于告诉 UI「本轮已抽 x/y」）。 */
  let cycleStart = 0;
  let total = 0;

  function refill(exclude) {
    remaining = [];
    for (let i = 0; i < items.length; i += 1) {
      if (i !== exclude) remaining.push(i);
    }
  }

  refill(-1);

  return {
    /** 候选池大小。 */
    get poolSize() {
      return items.length;
    },
    /** 累计抽取次数（跨轮累加）。 */
    get drawn() {
      return total;
    },
    /** 本轮已抽次数。 */
    get drawnInCycle() {
      return total - cycleStart;
    },
    /** 本轮还能抽多少次不重复。 */
    get remainingInCycle() {
      return remaining.length;
    },
    /** 本轮总共能抽多少次（= 池子大小）。 */
    get cycleSize() {
      return items.length;
    },

    /** 抽下一题；候选池为空时返回 null。 */
    next() {
      if (!items.length) return null;

      if (!remaining.length) {
        // 新一轮：把上一轮最后一题排除在起始牌之外，保证跨轮也不出现「连点两次同一题」
        const canExclude = items.length > 1 && lastIdx >= 0;
        refill(canExclude ? lastIdx : -1);
        cycleStart = total;
        // 抽完这一轮的第一题后立刻把它补回池子，本轮依然是完整的 m 次
        pendingAdd = canExclude ? lastIdx : -1;
      }

      const j = randBelow(remaining.length);
      const idx = remaining[j];
      // 交换删除：把末尾元素填到空位上，避免 splice 的 O(n) 搬移
      remaining[j] = remaining[remaining.length - 1];
      remaining.pop();

      if (pendingAdd >= 0) {
        remaining.push(pendingAdd);
        pendingAdd = -1;
      }

      lastIdx = idx;
      total += 1;
      return items[idx];
    },

    /** 重置成「一副新牌」，并清空计数。候选池变了必须调用（或直接换一个 engine）。 */
    reset() {
      refill(-1);
      pendingAdd = -1;
      lastIdx = -1;
      cycleStart = 0;
      total = 0;
    },
  };
}
