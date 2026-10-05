/**
 * 「随机一题」的状态机（组件里只留模板，逻辑全在这里）。
 *
 * 关键约束：**每次点击必须给出不同的题**。做法不是「随机后和上一题比对」——
 * 那样连点两次仍可能撞上第三题，也无法保证第 m 次一定不重复；而是把候选池当成
 * 一副牌不放回地抽（见 cfRandom.js 的 createDrawEngine）：
 * 池子里有 m 道题，连续点 m 次必然是 m 道互不相同的题，跨轮也不会连出同一题。
 *
 * 候选池 = 题库 ∩ 当前筛选条件。筛选条件一变池子就换了一副牌，因此这里用
 * 「池子数组的引用」判断要不要重建 engine（computed 的返回值在依赖不变时引用稳定）。
 */
import { computed, reactive, ref, shallowRef, watch } from "vue";
import {
  RATING_CEIL,
  RATING_FLOOR,
  RATING_STEP,
  collectTags,
  filterProblems,
  loadProblemSet,
  ratingBounds,
  readCache,
} from "../data/cfProblems.js";
import { createDrawEngine } from "../data/cfRandom.js";

export function useCfRandom() {
  /** 全量题库（1.1 万条，不需要深层响应式，用 shallowRef 省开销）。 */
  const problems = shallowRef([]);
  const tags = shallowRef([]);
  /** idle（还没拉）| loading | ready | error */
  const status = ref("idle");
  const error = ref("");
  /** 本次数据来自本地缓存（页面上给个「缓存」字样，避免用户以为 rating 一定最新） */
  const fromCache = ref(false);

  /** 滑杆边界：优先用真实数据算出来的区间，拉取前先用 CF 的固定范围顶着。 */
  const bounds = ref({ min: RATING_FLOOR, max: RATING_CEIL });

  const filters = reactive({
    tags: [],
    /** all = 所选标签全部命中；any = 命中任一 */
    tagMode: "all",
    minRating: RATING_FLOOR,
    maxRating: RATING_CEIL,
    includeUnrated: false,
  });

  /** 当前抽中的题。 */
  const current = shallowRef(null);
  /** 本轮已抽次数，用于向用户展示「抽完前不会重复」。 */
  const drawnInCycle = ref(0);

  const pool = computed(() => filterProblems(problems.value, filters));
  const poolSize = computed(() => pool.value.length);
  const ready = computed(() => status.value === "ready");
  const loading = computed(() => status.value === "loading");
  const hasTags = computed(() => filters.tags.length > 0);

  let engine = null;
  let enginePool = null;
  let inflight = null;

  /** 池子换了就换一副新牌；否则沿用同一副，保证「不重复」的语义是连续的。 */
  function engineFor() {
    const p = pool.value;
    if (enginePool !== p) {
      engine = createDrawEngine(p);
      enginePool = p;
      drawnInCycle.value = 0;
    }
    return engine;
  }

  // 筛选条件变化时把计数显示归零（真正的牌堆在 engineFor 里按引用重建）
  watch(pool, () => {
    drawnInCycle.value = 0;
  });

  /** 把一份题库应用到状态里，并把分数滑杆对齐到真实区间。 */
  function applyProblems(list) {
    const prev = { ...bounds.value };
    const next = ratingBounds(list);
    problems.value = list;
    tags.value = collectTags(list);
    bounds.value = next;

    // 用户没动过滑杆（还是上一份数据的整段区间）就直接对齐；
    // 动过就只做钳制，免得用户选的区间被悄悄改掉。
    const untouched = filters.minRating === prev.min && filters.maxRating === prev.max;
    filters.minRating = untouched ? next.min : Math.min(Math.max(filters.minRating, next.min), next.max);
    filters.maxRating = untouched ? next.max : Math.min(Math.max(filters.maxRating, next.min), next.max);
  }

  /**
   * 拉题库（失败不抛，把错误留在 error 里给页面显示）。
   * @returns {Promise<boolean>} 是否可用
   */
  function ensureLoaded(force = false) {
    if (inflight) return inflight;
    if (!force && problems.value.length) return Promise.resolve(true);

    status.value = "loading";
    error.value = "";
    inflight = (async () => {
      try {
        const res = await loadProblemSet({ force });
        applyProblems(res.problems);
        fromCache.value = res.fromCache;
        status.value = "ready";
        return true;
      } catch (err) {
        error.value = err?.message || String(err);
        status.value = "error";
        return false;
      } finally {
        inflight = null;
      }
    })();
    return inflight;
  }

  /**
   * 进入页面后自动准备题库（由组件在首屏空闲时调用）。
   *
   * 有新鲜缓存就直接可用，一次网络请求都不发；没有缓存就**在后台拉一次** ——
   * 不再要求用户先点一下「随机一题」：面板一进页面就该是可用状态。
   * 放在空闲回调里跑，所以这 1.7 MB 不会去抢首屏（每日一题）的带宽与主线程。
   */
  function autoLoad() {
    if (problems.value.length) return false;
    if (warmFromCache()) return true;
    ensureLoaded();
    return false;
  }

  /** 只读缓存（不触发网络）：命中就进入可用状态。 */
  function warmFromCache() {
    if (problems.value.length) return false;
    const cached = readCache();
    if (!cached) return false;
    applyProblems(cached.problems);
    fromCache.value = true;
    status.value = "ready";
    return true;
  }

  /** 抽下一题；题库还没准备好时会先等一次加载。返回抽中的题目（失败/池空返回 null）。 */
  async function draw() {
    if (status.value === "loading") return null;
    if (status.value !== "ready") {
      const ok = await ensureLoaded();
      if (!ok) return null;
    }
    const eng = engineFor();
    const picked = eng.next();
    if (!picked) return null;
    current.value = picked;
    drawnInCycle.value = eng.drawnInCycle;
    return picked;
  }

  function resetCycle() {
    engineFor().reset();
    drawnInCycle.value = 0;
  }

  function clearFilters() {
    filters.tags = [];
    filters.tagMode = "all";
    filters.minRating = bounds.value.min;
    filters.maxRating = bounds.value.max;
    filters.includeUnrated = false;
  }

  function toggleTag(name) {
    const set = new Set(filters.tags);
    if (set.has(name)) set.delete(name);
    else set.add(name);
    filters.tags = [...set];
  }

  return {
    // 数据
    problems,
    tags,
    status,
    error,
    fromCache,
    bounds,
    filters,
    current,
    drawnInCycle,
    poolSize,
    ready,
    loading,
    hasTags,
    ratingStep: RATING_STEP,
    // 动作
    draw,
    ensureLoaded,
    autoLoad,
    warmFromCache,
    resetCycle,
    clearFilters,
    toggleTag,
  };
}
