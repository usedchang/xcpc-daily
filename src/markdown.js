import MarkdownIt from "markdown-it";

// html: false —— 原始 HTML 会被转义，避免 v-html 注入；链接自动识别。
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
});

/**
 * 渲染 markdown 为 HTML 字符串。
 * 供题解正文与 hint 使用；结果只放进 SolutionPanel 的 v-html。
 */
export function renderMarkdown(text) {
  return md.render(String(text ?? ""));
}
