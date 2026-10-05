<script setup>
/**
 * 分数区间选择器：双滑块 + 两个数字输入框。
 *
 * 滑块负责快速拖动（想知道「1500 分左右」大概在哪），输入框负责精确指定
 * （「就要 1500 分」）。两者共用同一份 min/max 契约，互相联动。
 *
 * 滑块部分：浏览器原生 `<input type="range">` 只有一枚滑块，这里把**两个** range
 * 完全重叠地摞在一起：轨道与滑轨都透明，只让滑块本身接收指针事件
 * （`pointer-events` 的 none/auto 组合，见 style.css 的 .rr-input）。原生元素因此
 * 保留了键盘操作（Tab 聚焦 + 左右方向键）和 aria 语义，比手写 pointerdown 更稳。
 *
 * 钳制规则集中在本组件：下限不许越过上限、两头都不许跑出题库的真实区间
 * （floor/ceil），输入框失焦时统一收敛一次。
 */
import { computed, ref, watch } from "vue";

const props = defineProps({
  min: { type: Number, required: true },
  max: { type: Number, required: true },
  /** 滑杆两端（= 题库里真实存在的最低/最高分） */
  floor: { type: Number, required: true },
  ceil: { type: Number, required: true },
  step: { type: Number, default: 100 },
  disabled: { type: Boolean, default: false },
});

const emit = defineEmits(["update:min", "update:max"]);

/* ---------------- 滑块 ---------------- */
const span = computed(() => Math.max(props.step, props.ceil - props.floor));

const pct = (v) => Math.min(100, Math.max(0, ((v - props.floor) / span.value) * 100));
const lowPct = computed(() => pct(props.min));
const highPct = computed(() => pct(props.max));

/**
 * 两枚滑块重合时（min === max）能拖到的是 z-index 更高的那枚。
 * 若固定让上限在上层，重合后只能把上限往右拉、下限再也拉不回来。
 * 因此按位置换层：区间贴右端时把下限抬到上层，贴左端时保留下限在下层。
 */
const lowOnTop = computed(() => props.min > (props.floor + props.ceil) / 2);

// 下限不许越过上限（反之亦然）：允许重合，得到一个「就这个分数」的精确筛选
function onLow(e) {
  emit("update:min", Math.min(Number(e.target.value), props.max));
}
function onHigh(e) {
  emit("update:max", Math.max(Number(e.target.value), props.min));
}

/* ---------------- 数字输入框 ----------------
 * 输入框里放的是「草稿文本」，而不是 props 的直接映射。原因：用户敲 "1500" 的
 * 过程中会经过 "1"、"15"、"150" 这些中间态，如果每次 input 都把 props 回写进
 * 输入框，打到一半就会被钳成 800，根本没法输入。
 * 规则：值合法且在区间内就实时生效；空 / 非数字 / 越界先放着不动，
 * 等失焦（或回车）时再统一收敛 —— 非法或空就退回当前值。
 */
const draftMin = ref(String(props.min));
const draftMax = ref(String(props.max));
const minEl = ref(null);
const maxEl = ref(null);

/**
 * 只在「这个输入框当前没被聚焦」时才用 props 覆盖草稿文本。
 * 判据直接用 DOM 的 activeElement，而不是自己维护一个 editing 标志：
 * 标志一旦因为某种原因没被清掉（元素没走 blur 就失去焦点），输入框会永远
 * 停在旧值上；直接问 DOM 则不会出现这种卡死。
 */
function syncDrafts() {
  if (minEl.value && document.activeElement !== minEl.value) draftMin.value = String(props.min);
  if (maxEl.value && document.activeElement !== maxEl.value) draftMax.value = String(props.max);
}
watch(() => [props.min, props.max], syncDrafts);

const clampMin = (n) => Math.min(Math.max(n, props.floor), props.max);
const clampMax = (n) => Math.max(Math.min(n, props.ceil), props.min);

function onNumberInput(which, e) {
  const raw = e.target.value;
  if (which === "min") draftMin.value = raw;
  else draftMax.value = raw;

  const n = Number(raw);
  if (raw.trim() === "" || !Number.isFinite(n)) return;
  if (n < props.floor || n > props.ceil) return;

  if (which === "min") emit("update:min", clampMin(Math.round(n)));
  else emit("update:max", clampMax(Math.round(n)));
}

/** 失焦 / 回车：把草稿收敛成一个合法值，并把输入框文本同步回去。 */
function commit(which) {
  const draft = which === "min" ? draftMin : draftMax;
  const raw = draft.value;
  const current = which === "min" ? props.min : props.max;
  const n = Math.round(Number(raw));
  const valid = raw.trim() !== "" && Number.isFinite(n);
  const final = valid ? (which === "min" ? clampMin(n) : clampMax(n)) : current;

  draft.value = String(final);
  if (which === "min") emit("update:min", final);
  else emit("update:max", final);
}
</script>

<template>
  <div class="rating-range" :class="{ disabled }">
    <div class="rr-slider">
      <div class="rr-track" aria-hidden="true">
        <div class="rr-fill" :style="{ left: `${lowPct}%`, right: `${100 - highPct}%` }"></div>
      </div>

      <input
        class="rr-input rr-low"
        type="range"
        :min="floor" :max="ceil" :step="step" :value="min" :disabled="disabled"
        :style="{ zIndex: lowOnTop ? 4 : 3 }"
        aria-label="最低分数"
        :aria-valuetext="`${min} 分`"
        @input="onLow"
      />
      <input
        class="rr-input rr-high"
        type="range"
        :min="floor" :max="ceil" :step="step" :value="max" :disabled="disabled"
        :style="{ zIndex: lowOnTop ? 3 : 4 }"
        aria-label="最高分数"
        :aria-valuetext="`${max} 分`"
        @input="onHigh"
      />
    </div>

    <!-- 精确指定：直接敲分数，和滑块双向联动 -->
    <div class="rr-numbers">
      <input
        ref="minEl"
        class="rr-num"
        type="number"
        inputmode="numeric"
        :min="floor" :max="ceil" :step="step" :disabled="disabled"
        :value="draftMin"
        :placeholder="String(floor)"
        aria-label="最低分数（可直接输入）"
        @input="onNumberInput('min', $event)"
        @change="commit('min')"
        @blur="commit('min')"
        @keydown.enter.prevent="$event.target.blur()"
      />
      <span class="rr-dash" aria-hidden="true">–</span>
      <input
        ref="maxEl"
        class="rr-num"
        type="number"
        inputmode="numeric"
        :min="floor" :max="ceil" :step="step" :disabled="disabled"
        :value="draftMax"
        :placeholder="String(ceil)"
        aria-label="最高分数（可直接输入）"
        @input="onNumberInput('max', $event)"
        @change="commit('max')"
        @blur="commit('max')"
        @keydown.enter.prevent="$event.target.blur()"
      />
      <span class="rr-hint">分</span>
    </div>
  </div>
</template>
