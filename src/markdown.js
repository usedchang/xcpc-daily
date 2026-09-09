import MarkdownIt from "markdown-it";
import texmath from "markdown-it-texmath";
import hljs from "highlight.js/lib/core";
import cpp from "highlight.js/lib/languages/cpp";
import python from "highlight.js/lib/languages/python";
import java from "highlight.js/lib/languages/java";
import javascript from "highlight.js/lib/languages/javascript";
import bash from "highlight.js/lib/languages/bash";
import plaintext from "highlight.js/lib/languages/plaintext";
import "highlight.js/styles/github.css";

import { mathjax } from "mathjax-full/js/mathjax.js";
import { TeX } from "mathjax-full/js/input/tex.js";
import { SVG } from "mathjax-full/js/output/svg.js";
import { LiteAdaptor } from "mathjax-full/js/adaptors/liteAdaptor.js";
import { RegisterHTMLHandler } from "mathjax-full/js/handlers/html.js";
import { AllPackages } from "mathjax-full/js/input/tex/AllPackages.js";

// ---------- 代码高亮：按需注册常用语言 ----------
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

// ---------- MathJax（替代 KaTeX）：完整支持 \tag \bmod \pmod \frac \dfrac 等 ----------
const adaptor = new LiteAdaptor();
RegisterHTMLHandler(adaptor);

const texInput = new TeX({ packages: AllPackages, tags: "none" });
const svgOutput = new SVG({ fontCache: "local" });
const mjDoc = mathjax.document("", { InputJax: texInput, OutputJax: svgOutput });

// \tag{n} 在 SVG 序列化下拿不到右侧编号，这里转成公式尾部空格 + (n) 文本，
// 与“由 (1),(2) 式得出 (3)”这类引用保持一致。
const tagRe = /\\tag\s*\{([^}]*)\}/g;
function preprocessTex(tex) {
  return String(tex).replace(tagRe, (_m, label) => `\\qquad(${label})`);
}

const mathjaxEngine = {
  // markdown-it-texmath 的 engine 接口
  renderToString(tex, options) {
    const display = !!(options && options.displayMode);
    const node = mjDoc.convert(preprocessTex(tex), { display });
    return adaptor.outerHTML(node);
  },
};

// ---------- markdown-it：方程式在 escape 之前处理，保住反斜杠命令 ----------
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
    const btn = '<button type="button" class="code-copy">copy</button>';
    return `<pre class="hljs">${btn}<code class="language-${langName}">${code}</code></pre>`;
  },
});

md.use(texmath, {
  engine: mathjaxEngine,
  delimiters: "dollars",
  katexOptions: { throwOnError: false },
});

/**
 * 渲染 markdown 为 HTML 字符串。
 * 支持：$...$ / $$...$$ 行内与块级 LaTeX（MathJax，含 \tag \bmod \pmod \frac \dfrac），
 * ```lang 代码块着色（highlight.js）+ copy 按钮。
 * 供题解正文与 hint 使用；结果只放进 SolutionPanel 的 v-html。
 */
export function renderMarkdown(text) {
  return md.render(String(text ?? ""));
}
