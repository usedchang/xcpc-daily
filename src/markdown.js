import MarkdownIt from "markdown-it";
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

// ---------- MathJax：完整支持 \tag \bmod \pmod \frac \dfrac 等 ----------
const adaptor = new LiteAdaptor();
RegisterHTMLHandler(adaptor);

const texInput = new TeX({ packages: AllPackages, tags: "none" });
const svgOutput = new SVG({ fontCache: "local" });
const mjDoc = mathjax.document("", { InputJax: texInput, OutputJax: svgOutput });

// \tag{n} 在纯 SVG 序列化下拿不到右侧编号，转成公式尾部空格 + (n) 文本。
const tagRe = /\\tag\s*\{([^}]*)\}/g;
function preprocessTex(tex) {
  return String(tex).replace(tagRe, (_m, label) => `\\qquad(${label})`);
}

function renderTex(tex, display) {
  const node = mjDoc.convert(preprocessTex(tex), { display });
  return adaptor.outerHTML(node);
}

// ---------- markdown-it：自定义 $...$ 与 $$...$$ 规则（不依赖 CommonJS 的 texmath） ----------
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

// 行内 $...$：与 markdown-it-katex 一致，$ 后不能紧跟空白，$ 前不能是空白。
md.inline.ruler.before("escape", "math_inline", (state, silent) => {
  const src = state.src;
  if (src[state.pos] !== "$") return false;
  if (src[state.pos + 1] === "$") return false; // 交给 display

  // 开 $ 后不能是空白
  const next = src.charCodeAt(state.pos + 1);
  if (next === 0x20 || next === 0x09) return false;

  // 找闭合 $
  let end = state.pos + 1;
  while ((end = src.indexOf("$", end)) !== -1) {
    // 闭 $ 前不能是空白；且闭 $ 后不能紧跟数字（避免 $5 误判）
    const prev = src.charCodeAt(end - 1);
    const after = src.charCodeAt(end + 1);
    if (prev !== 0x20 && prev !== 0x09 && !(after >= 0x30 && after <= 0x39)) {
      const content = src.slice(state.pos + 1, end);
      const token = state.push("math_inline", "math", 0);
      token.content = content;
      if (!silent) state.pos = end + 1;
      return true;
    }
    end += 1;
  }
  return false;
});

md.renderer.rules.math_inline = (tokens, idx) => renderTex(tokens[idx].content, false);

// 块级 $$...$$：匹配以 $$ 起止的段落
md.block.ruler.before("fence", "math_display", (state, startLine, endLine, silent) => {
  let pos = state.bMarks[startLine] + state.tShift[startLine];
  let max = state.eMarks[startLine];
  const line = state.src.slice(pos, max);

  if (!line.startsWith("$$")) return false;

  let nextLine = startLine;
  let haveEnd = false;

  if (line.trim() !== "$$" && line.trim().endsWith("$$")) {
    haveEnd = true;
  } else {
    for (let l = startLine + 1; l <= endLine; l++) {
      const p2 = state.bMarks[l] + state.tShift[l];
      const m2 = state.eMarks[l];
      if (state.src.slice(p2, m2).trim() === "$$") {
        nextLine = l;
        haveEnd = true;
        break;
      }
    }
  }

  if (!haveEnd) return false;

  let content;
  if (nextLine === startLine) {
    content = line.slice(2, -2).trim();
  } else {
    content = [];
    for (let l = startLine; l <= nextLine; l++) {
      const p3 = state.bMarks[l] + state.tShift[l];
      const m3 = state.eMarks[l];
      const s = state.src.slice(p3, m3);
      if (l === startLine) content.push(s.slice(2));
      else if (l === nextLine) content.push(s.slice(0, -2));
      else content.push(s);
    }
    content = content.join("\n").trim();
  }

  if (!silent) {
    const token = state.push("math_display", "math", 0);
    token.content = content;
    token.map = [startLine, nextLine + 1];
    state.line = nextLine + 1;
  }
  return true;
});

md.renderer.rules.math_display = (tokens, idx) => renderTex(tokens[idx].content, true);

// ---------- C++ 代码块：默认折叠，点击 summary 展开（与 hint 一致） ----------
const cppLangs = new Set(["cpp", "c", "cc", "cxx", "h", "hpp"]);
const defaultFence = md.renderer.rules.fence;

md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
  const rendered = defaultFence(tokens, idx, options, env, slf);
  const info = String(tokens[idx].info || "").trim();
  const lang = info.split(/\s+/)[0].toLowerCase();
  if (!cppLangs.has(lang)) return rendered;

  const label = lang === "c" ? "C 代码" : "C++ 代码";
  return `<details class="code-details"><summary>${label}</summary>${rendered}</details>`;
};

/**
 * 渲染 markdown 为 HTML 字符串。
 * 支持：$...$ / $$...$$ 行内与块级 LaTeX（MathJax，含 \tag \bmod \pmod \frac \dfrac），
 * ```lang 代码块着色（highlight.js）+ copy 按钮。
 * 供题解正文与 hint 使用；结果只放进 SolutionPanel 的 v-html。
 */
export function renderMarkdown(text) {
  return md.render(String(text ?? ""));
}
