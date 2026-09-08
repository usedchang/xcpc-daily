import MarkdownIt from "markdown-it";
import markdownItKatex from "markdown-it-katex";
import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import plaintext from "highlight.js/lib/languages/plaintext";
import "highlight.js/styles/github.css";
// KaTeX 需要引入其 CSS：不引的话 .katex-mathml（MathML 回退）不会隐藏，
// 会与 .katex-html 的可视渲染同时显示，表现就是“公式渲染结果后面/下面又多出原文”。
import "katex/dist/katex.min.css";

// 只按需注册常用语言，避免 highlight.js 全量打包（约 1MB）。
hljs.registerLanguage("cpp", cpp);
hljs.registerLanguage("c", cpp);
hljs.registerLanguage("cc", cpp);
hljs.registerLanguage("cxx", cpp);
hljs.registerLanguage("python", python);
hljs.registerLanguage("py", python);
hljs.registerLanguage("java", java);
hljs.registerLanguage("javascript", javascript);
hljs.registerLanguage("js", javascript);
hljs.registerLanguage("bash", bash);
hljs.registerLanguage("shell", bash);
hljs.registerLanguage("sh", bash);
hljs.registerLanguage("plaintext", plaintext);
hljs.registerLanguage("text", plaintext);
hljs.registerLanguage("txt", plaintext);

// 本站样式里通过 .dark 用 CSS 变量重映射高亮配色，
// 所以这里引入浅色主题的静态色值作为基础，暗色下覆盖即可。

// html: false —— 原始 HTML 会被转义，避免 v-html 注入；链接自动识别。
const md = new MarkdownIt({
  html: false,
  linkify: true,
  breaks: false,
  highlight(str, lang) {
    const code =
      lang && hljs.getLanguage(lang)
        ? hljs.highlight(str, { language: lang }).value
        : hljs.highlightAuto(str).value;
    const langName = lang || "";
    // copy 按钮放在 pre 右上角；文本用 textContent 读取，code 内容已在 highlight 中转义。
    const btn = '<button type="button" class="code-copy">copy</button>';
    return `<pre class="hljs">${btn}<code class="language-${langName}">${code}</code></pre>`;
  },
})
  .use(markdownItKatex, {
    throwOnError: false,
    errorColor: "#d9534f",
    strict: false,
  });

/**
 * 渲染 markdown 为 HTML 字符串。
 * 支持：$...$ / $$...$$ 行内与块级 LaTeX（KaTeX）、```lang 代码块着色（highlight.js）。
 * 供题解正文与 hint 使用；结果只放进 SolutionPanel 的 v-html。
 */
export function renderMarkdown(text) {
  return md.render(String(text ?? ""));
}

