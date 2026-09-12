<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import { COMMUNITY, newSubmissionUrl } from "../config/community.js";
import { useSubmitModal } from "../composables/useSubmitModal.js";

const { problem, open, close } = useSubmitModal();

const handle = ref("");
const author = ref("");
const title = ref("");
const body = ref("");
const copyState = ref("");

const date = computed(() => String(problem.value?.date || "").trim());
const problemTitle = computed(() => String(problem.value?.title || "").trim());

// 文件名必须满足仓库约定 `YYYY-MM-DD-<handle>.md`，
// handle 只保留 GitHub 用户名允许的字符，顺便挡掉路径穿越
const safeHandle = computed(() => handle.value.trim().replace(/[^A-Za-z0-9_-]/g, ""));
const fileName = computed(() =>
  date.value && safeHandle.value ? `${date.value}-${safeHandle.value}.md` : ""
);

const content = computed(() => {
  const lines = ["---"];
  lines.push(`author: ${author.value.trim() || safeHandle.value || "YOUR_NAME"}`);
  lines.push(`date: ${date.value || "YYYY-MM-DD"}`);
  if (title.value.trim()) lines.push(`title: ${title.value.trim()}`);
  lines.push("---", "");
  lines.push(body.value.trim());
  return `${lines.join("\n")}\n`;
});

const ready = computed(() => Boolean(fileName.value && body.value.trim()));
const targetUrl = computed(() => newSubmissionUrl(fileName.value));

async function copyContent() {
  try {
    await navigator.clipboard.writeText(content.value);
    copyState.value = "已复制";
  } catch (e) {
    copyState.value = "复制失败，请手动全选";
  }
  window.setTimeout(() => {
    copyState.value = "";
  }, 1800);
}

function onKeydown(e) {
  if (e.key === "Escape") close();
}

onMounted(() => document.addEventListener("keydown", onKeydown));
onBeforeUnmount(() => document.removeEventListener("keydown", onKeydown));

// 每次打开都重置表单，避免上一题的残留
watch(open, (v) => {
  if (v) {
    handle.value = "";
    author.value = "";
    title.value = "";
    body.value = "";
    copyState.value = "";
  }
});
</script>

<template>
  <Teleport to="body">
    <Transition name="solution-modal">
      <div v-if="open" class="solution-modal submit-modal" @click.self="close">
        <div class="solution-modal-dialog" role="dialog" aria-modal="true" aria-label="投稿题解">
          <header class="solution-modal-head">
            <div class="solution-modal-title">
              <span class="solution-modal-date">{{ date || "投稿" }}</span>
              <span>{{ problemTitle || "投稿一篇题解" }}</span>
            </div>
            <button type="button" class="solution-modal-close" @click="close" aria-label="关闭">✕</button>
          </header>

          <div class="solution-modal-body">
            <p class="submit-lead">
              投稿走 <strong>Pull Request</strong>：填好下面的表单，复制生成的内容，
              在 GitHub 新建文件时粘贴提交即可。合并后会自动出现在题目下方，作者信息取自 front matter。
            </p>

            <div class="submit-grid">
              <label class="submit-field">
                <span class="submit-label">GitHub 用户名 <em>必填</em></span>
                <input v-model="handle" type="text" placeholder="例如 Alice" spellcheck="false" />
                <span class="submit-tip">用于文件名与头像：<code>{{ fileName || "YYYY-MM-DD-<handle>.md" }}</code></span>
              </label>

              <label class="submit-field">
                <span class="submit-label">展示名 <em>可选</em></span>
                <input v-model="author" type="text" placeholder="默认与用户名相同" />
              </label>
            </div>

            <label class="submit-field">
              <span class="submit-label">标题 <em>可选</em></span>
              <input v-model="title" type="text" placeholder="例如 按位考虑的另一种做法" />
            </label>

            <label class="submit-field">
              <span class="submit-label">正文（Markdown，支持 $公式$ 与代码块） <em>必填</em></span>
              <textarea v-model="body" rows="10" spellcheck="false"
                placeholder="在这里写题解正文……"></textarea>
            </label>

            <details class="submit-preview">
              <summary>预览将写入文件的内容</summary>
              <pre class="submit-pre"><code>{{ content }}</code></pre>
            </details>

            <div class="submit-actions">
              <button type="button" class="btn ghost" :disabled="!ready" @click="copyContent">
                {{ copyState || "复制内容" }}
              </button>
              <a v-if="ready" class="btn" :href="targetUrl" target="_blank" rel="noopener">
                在 GitHub 打开并粘贴 ↗
              </a>
              <span v-else class="muted submit-wait">填好用户名和正文后即可跳转</span>
            </div>

            <p class="submit-tip submit-foot">
              说明：文件必须放在 <code>{{ COMMUNITY.submissionsDir }}/</code> 下，且文件名与上面的
              <code>{{ fileName || "YYYY-MM-DD-<handle>.md" }}</code> 一致，否则 CI 会校验失败。
              审核记录都在 PR 里：<a :href="`${COMMUNITY.repoUrl}/pulls`" target="_blank" rel="noopener">Pull requests</a>。
            </p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
