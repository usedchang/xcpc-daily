<script setup>
/**
 * 一条打卡记录的录入表单。
 *
 * 打卡只对应站内当天的「每日一题」：
 *   - 日期只能从有题目的日子里选（CheckinDatePicker 负责）；
 *   - 题目只能从该日期的每日一题里选，不再手填题目名/题目链接；
 *   - 打卡默认就是 AC，所以没有「结果」字段；
 *   - 「备注」改成「完整题解」，存放思路、推导、复杂度和参考代码。
 */
import { computed, reactive, ref, watch } from "vue";
import { MAX_SOLUTION, validateCheckin } from "../data/checkin-core.js";
import { isDateString } from "../utils/date.js";
import CheckinDatePicker from "./CheckinDatePicker.vue";

const props = defineProps({
  today: { type: String, required: true },
  /** 站内已发布的全部每日一题（App.vue 的 publishedData）。 */
  problems: { type: Array, default: () => [] },
  /** 打开表单时的预置参数：{ date, problem }。 */
  seed: { type: Object, default: null },
  /** 父组件（addCheckin）返回的字段错误。 */
  errors: { type: Object, default: () => ({}) },
  /** 父组件返回的整体错误（比如一分钟内重复提交）。 */
  error: { type: String, default: "" },
});

const emit = defineEmits(["submit", "cancel", "change"]);

/** 只保留有日期、有标题的题目，按日期升序；同一天只取第一条。 */
const allProblems = computed(() => {
  const list = (props.problems || [])
    .filter((p) => p && isDateString(p.date) && String(p.title || "").trim())
    .sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const seen = new Set();
  return list.filter((p) => {
    if (seen.has(p.date)) return false;
    seen.add(p.date);
    return true;
  });
});

const byDate = computed(() => new Map(allProblems.value.map((p) => [p.date, p])));
const availableDates = computed(() => allProblems.value.map((p) => p.date));

const problemOptions = computed(() =>
  allProblems.value.filter((p) => p.date === form.date)
);

/**
 * 初始日期：seed.date → seed.problem.date → 今天 → 最近一天。
 * 表单只接受有每日一题的日期，所以这里要跳过没有题目的日期。
 */
function initialDate() {
  const candidates = [props.seed?.date, props.seed?.problem?.date, props.today];
  for (const date of candidates) {
    if (byDate.value.has(date)) return date;
  }
  return availableDates.value[availableDates.value.length - 1] || props.today || "";
}

const initialProblem = byDate.value.get(initialDate()) || null;

const form = reactive({
  date: initialDate(),
  problemDate: initialProblem?.date || "",
  title: initialProblem?.title || "",
  link: initialProblem?.link || "",
  submission: "",
  solution: "",
});

const localErrors = ref({});
const mergedErrors = computed(() => ({ ...localErrors.value, ...(props.errors || {}) }));

const selectedProblem = computed(
  () => problemOptions.value.find((p) => p.date === form.problemDate) || problemOptions.value[0] || null
);

const canSubmit = computed(
  () => Boolean(form.date && form.problemDate && form.title && problemOptions.value.length)
);

const dateHint = computed(() => {
  if (!form.date) return "";
  return form.date === props.today ? "今天" : `补卡 ${form.date} `;
});

function clearError(key) {
  if (localErrors.value[key]) {
    const next = { ...localErrors.value };
    delete next[key];
    localErrors.value = next;
  }
  emit("change", key);
}

/** 换日期后自动选中当天那题（每天只有一题，所以用户不用再点一次选择框）。 */
function onDateChange(date) {
  if (!isDateString(date)) return;
  form.date = date;
  const first = byDate.value.get(date) || null;
  form.problemDate = first?.date || "";
  form.title = first?.title || "";
  form.link = first?.link || "";
  clearError("date");
  clearError("problemDate");
  clearError("title");
}

function onProblemChange() {
  const problem = selectedProblem.value;
  form.problemDate = problem?.date || "";
  form.title = problem?.title || "";
  form.link = problem?.link || "";
  clearError("problemDate");
  clearError("title");
}

// 题目数据是异步加载的：如果表单先于数据打开，等数据到了再补一次默认选中，
// 否则用户会看到一个空的选择框。
watch(availableDates, (dates) => {
  if (form.problemDate || !dates.length) return;
  const date = dates.includes(props.today) ? props.today : dates[dates.length - 1];
  onDateChange(date);
});

function onSubmit() {
  const payload = {
    date: form.date,
    problemDate: form.problemDate,
    title: form.title,
    link: form.link,
    submission: form.submission,
    solution: form.solution,
  };
  const errors = validateCheckin(payload, props.today);
  if (Object.keys(errors).length) {
    localErrors.value = errors;
    return;
  }
  localErrors.value = {};
  emit("submit", payload);
}
</script>

<template>
  <form class="ck-form" novalidate @submit.prevent="onSubmit">
    <div class="ck-form-head">
      <strong>{{ dateHint }}的打卡</strong>
      <button type="button" class="ck-text-btn" @click="emit('cancel')">取消</button>
    </div>

    <div v-if="!availableDates.length" class="ck-form-empty">
      站内还没有可打卡的每日一题。
    </div>

    <div v-else class="ck-form-grid ck-form-grid-2">
      <div class="ck-field">
        <span class="ck-label">打卡日期 <em>只列出有题目的日子</em></span>
        <CheckinDatePicker
          :model-value="form.date"
          :dates="availableDates"
          :today="today"
          @update:model-value="onDateChange"
        />
        <span v-if="mergedErrors.date" class="ck-field-error">{{ mergedErrors.date }}</span>
      </div>

      <label class="ck-field">
        <span class="ck-label">当天题目</span>
        <select
          v-model="form.problemDate"
          :disabled="!problemOptions.length"
          @change="onProblemChange"
        >
          <option v-if="!problemOptions.length" value="">这一天没有每日一题</option>
          <option v-for="p in problemOptions" :key="p.date + p.title" :value="p.date">
            {{ p.title }}
          </option>
        </select>
        <span v-if="mergedErrors.problemDate" class="ck-field-error">
          {{ mergedErrors.problemDate }}
        </span>
        <span v-if="mergedErrors.title" class="ck-field-error">{{ mergedErrors.title }}</span>
        <span v-if="mergedErrors.link" class="ck-field-error">{{ mergedErrors.link }}</span>
      </label>
    </div>

    <template v-if="availableDates.length">
      <label class="ck-field">
        <span class="ck-label">OJ 提交链接 <em>可选，填 AC 提交记录</em></span>
        <input
          v-model="form.submission"
          type="url"
          placeholder="https://codeforces.com/contest/..."
          @input="clearError('submission')"
        />
        <span v-if="mergedErrors.submission" class="ck-field-error">
          {{ mergedErrors.submission }}
        </span>
      </label>

      <label class="ck-field">
        <span class="ck-label">完整题解 <em>思路 / 推导 / 复杂度 / 参考代码 · 可选</em></span>
        <textarea
          v-model="form.solution"
          rows="9"
          :maxlength="MAX_SOLUTION"
          placeholder="先写核心观察，再写推导和复杂度，最后贴参考代码……"
          @input="clearError('solution')"
        ></textarea>
        <span class="ck-field-foot">
          <span v-if="mergedErrors.solution" class="ck-field-error">{{ mergedErrors.solution }}</span>
          <span class="ck-counter">{{ form.solution.length }} / {{ MAX_SOLUTION }}</span>
        </span>
      </label>
    </template>

    <p v-if="error" class="ck-form-error" role="alert">{{ error }}</p>

    <div class="ck-form-actions">
      <button type="submit" class="btn" :disabled="!canSubmit">保存打卡</button>
      <span class="ck-form-tip">
        打卡默认视为 AC；完整题解会同步到私有 Gist
      </span>
    </div>
  </form>
</template>
