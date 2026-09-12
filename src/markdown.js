import MarkdownIt from "markdown-it";
import DOMPurify from "dompurify";
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

// ---------- MathJax ----------
// RegisterHTMLHandler 是全局注册，重复调用会注册多个 handler；LiteAdaptor 本身无状态，
// 所以只注册一次，之后所有渲染实例共享它（实例之间只隔开 TeX 宏包与 document）。
const adaptor = new LiteAdaptor();
RegisterHTMLHandler(adaptor);

// \tag{n} 在纯 SVG 序列化下拿不到右侧编号，转成公式尾部空格 + (n) 文本。
const tagRe = /\\tag\s*\{([^}]*)\}/g;
function preprocessTex(tex) {
  return String(tex).replace(tagRe, (_m, label) => `\\qquad(${label})`);
}

/**
 * 用给定的 TeX 宏包集合造一个 `renderTex(tex, display) -> svg outerHTML`。
 *
 * 官方题解与社区题解各持一个实例，区别只在宏包集合：
 * 社区用受限集合（见 COMMUNITY_TEX_PACKAGES），这是 UGC 安全的第一道闸——
 * `\href` / `\class` / `\style` 这些能产出 HTML 属性的命令全部来自 `html` 宏包。
 */
function createTexEngine(packages) {
  const inputJax = new TeX({ packages, tags: "none" });
  const outputJax = new SVG({ fontCache: "local" });
  const doc = mathjax.document("", { InputJax: inputJax, OutputJax: outputJax });
  return (tex, display) => {
    const node = doc.convert(preprocessTex(tex), { display });
    return adaptor.outerHTML(node);
  };
}

// ---------- markdown-it：自定义 $...$ 与 $$...$$ 规则（不依赖 CommonJS 的 texmath） ----------

// 行内 $...$：与 markdown-it-katex 一致，$ 后不能紧跟空白，$ 前不能是空白。
function mathInlineRule(state, silent) {
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
}

// 块级 $$...$$：匹配以 $$ 起止的段落
function mathDisplayRule(state, startLine, endLine, silent) {
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
}

// ---------- C++ 代码块：默认折叠，点击 summary 展开（与 hint 一致） ----------
const cppLangs = new Set(["cpp", "c", "cc", "cxx", "h", "hpp"]);

// ---------- Obsidian 风格 callout：> [!question] 标题 ----------
// markdown-it 不认 callout 语法，首行为 [!question] 的引用块默认会被当成普通引用
// 原样输出 "[!question] ..."。这里把它转成带图标与标题的块。
const CALLOUT_HEAD_RE = /^\[!question\][+-]?[ \t]*(.*?)[ \t]*(?:\n|$)/;

const QUESTION_ICON =
  '<svg class="callout-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"' +
  ' stroke-width="1.8" stroke-linecap="round" aria-hidden="true">' +
  '<circle cx="12" cy="12" r="9.2"></circle>' +
  '<path d="M9.7 9.4a2.4 2.4 0 1 1 3.1 2.3c-.6.2-.9.7-.9 1.3v.5"></path>' +
  '<circle cx="12" cy="16.7" r="1.05" fill="currentColor" stroke="none"></circle>' +
  "</svg>";

function htmlBlockToken(state, html) {
  const token = new state.Token("html_block", "", 0);
  token.content = html;
  token.block = true;
  token.map = null;
  return token;
}

function calloutRule(state) {
  const tokens = state.tokens;
  // core ruler 的 state 上有 md 引用，用它取 utils（工厂化后不能再闭包捕获实例）
  const md = state.md;

  for (let i = 0; i < tokens.length; i++) {
    if (tokens[i].type !== "blockquote_open") continue;

    const paraOpen = tokens[i + 1];
    const inline = tokens[i + 2];
    if (!paraOpen || paraOpen.type !== "paragraph_open") continue;
    if (!inline || inline.type !== "inline") continue;

    const head = inline.children && inline.children[0];
    if (!head || head.type !== "text") continue;
    const m = CALLOUT_HEAD_RE.exec(head.content);
    if (!m) continue;

    // 标题自带行内语法（公式/链接…）时会被切成多个子节点，这里不去误伤，降级为普通引用；
    // 标题与正文之间的软换行是独立 softbreak 节点，属于正常情况
    const rest = head.content.slice(m[0].length);
    const nextChild = inline.children[1];
    if (!rest && nextChild && nextChild.type !== "softbreak") continue;

    // 找配对的 blockquote_close（考虑嵌套）
    let depth = 0;
    let close = -1;
    for (let j = i; j < tokens.length; j++) {
      if (tokens[j].type === "blockquote_open") depth++;
      else if (tokens[j].type === "blockquote_close" && --depth === 0) {
        close = j;
        break;
      }
    }
    if (close < 0) continue;

    // 从首个子节点剥掉 "[!question] 标题"，剩下的即正文
    const title = m[1].trim();
    if (rest) {
      head.content = rest;
    } else {
      inline.children.shift();
      // 标题与正文之间的软换行单独成节点，去掉以免段落多出前导空白
      const body = inline.children[0];
      if (body && body.type === "softbreak") inline.children.shift();
      else if (body && body.type === "text") body.content = body.content.replace(/^\n/, "");
    }

    const titleHtml =
      '<div class="callout-title">' +
      QUESTION_ICON +
      md.utils.escapeHtml(title) +
      "</div>";

    // 标题单独成行；原段落被掏空时整段替换为标题，否则插到段落之前
    let closeIdx;
    if (inline.children.length === 0) {
      tokens.splice(i + 1, 3, htmlBlockToken(state, titleHtml));
      closeIdx = close - 2;
    } else {
      tokens.splice(i + 1, 0, htmlBlockToken(state, titleHtml));
      closeIdx = close + 1;
    }

    const openTok = tokens[i];
    openTok.type = "html_block";
    openTok.tag = "";
    openTok.nesting = 0;
    openTok.markup = "";
    openTok.content = '<div class="callout callout-question">';
    openTok.children = null;

    const closeTok = tokens[closeIdx];
    closeTok.type = "html_block";
    closeTok.tag = "";
    closeTok.nesting = 0;
    closeTok.markup = "";
    closeTok.content = "</div>";
    closeTok.children = null;
  }
}

/**
 * 造一个 markdown-it 实例。全部自定义渲染规则都在这里注册，与 TeX 引擎解耦：
 * 官方题解和社区题解共用同一套规则，只换 TeX 宏包集合。
 */
function createRenderer(renderTex) {
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

  md.inline.ruler.before("escape", "math_inline", mathInlineRule);
  md.renderer.rules.math_inline = (tokens, idx) => renderTex(tokens[idx].content, false);

  md.block.ruler.before("fence", "math_display", mathDisplayRule);
  md.renderer.rules.math_display = (tokens, idx) => renderTex(tokens[idx].content, true);

  const defaultFence = md.renderer.rules.fence;
  md.renderer.rules.fence = (tokens, idx, options, env, slf) => {
    const rendered = defaultFence(tokens, idx, options, env, slf);
    const info = String(tokens[idx].info || "").trim();
    const lang = info.split(/\s+/)[0].toLowerCase();
    if (!cppLangs.has(lang)) return rendered;

    const label = lang === "c" ? "C 代码" : "C++ 代码";
    return `<details class="code-details"><summary>${label}</summary>${rendered}</details>`;
  };

  md.core.ruler.push("callout_question", calloutRule);

  return md;
}

// ---------- 官方题解渲染器（可信内容，不做 sanitize） ----------
const officialMd = createRenderer(createTexEngine(AllPackages));

/**
 * 渲染 markdown 为 HTML 字符串。
 * 支持：$...$ / $$...$$ 行内与块级 LaTeX（MathJax，含 \tag \bmod \pmod \frac \dfrac），
 * ```lang 代码块着色（highlight.js）+ copy 按钮，> [!question] callout。
 * 供官方题解正文与 hint 使用；内容来自本仓库，视为可信，因此不 sanitize。
 */
export function renderMarkdown(text) {
  return officialMd.render(String(text ?? ""));
}

// ---------- 社区投稿渲染器（外部内容，强制 sanitize） ----------

/**
 * 受限 TeX 宏包：相对 AllPackages 去掉了
 *   - `html`：提供 \href \class \style \cssId —— 能在公式里产出带任意 href 的 <a>，
 *     是 UGC 场景下 MathJax 侧真正的注入面；
 *   - `require` / `autoload`：运行时动态加载任意扩展；
 *   - `action` / `verb` 等与题解无关的命令。
 */
const COMMUNITY_TEX_PACKAGES = [
  "base",
  "ams",
  "mathtext",
  "newcommand",
  "noundefined",
  "color",
  "boldsymbol",
  "textmacros",
];

const communityMd = createRenderer(createTexEngine(COMMUNITY_TEX_PACKAGES));

/**
 * DOMPurify 配置。
 *
 * 关键点：MathJax 的 SVG 用 `<use xlink:href="#MJX-...">` 引用字形，
 * 而 DOMPurify 3.x 即使不给任何白名单也会把 `<use>` 整个移除（实测：不显式加回时，
 * 公式 SVG 里的 use / xlink:href 会全部消失，公式变成一片空白）。
 * 所以必须用 ADD_TAGS / ADD_ATTR 把这两个补回来。
 *
 * 安全性不受影响：xlink:href 属于 URI 属性，DOMPurify 仍会校验它的值（javascript: 等会被清掉）；
 * 而且社区正文里的裸 HTML 在 markdown-it 层（html: false）就已经进不来了。
 *
 * 其余沿用 DOMPurify 的默认安全语义（移除 <script>、on* 事件属性、危险协议 URL），
 * 再额外禁掉几个题解里毫无正当用途的标签。
 */
const PURIFY_CONFIG = {
  USE_PROFILES: { html: true, svg: true, svgFilters: true, mathMl: true },
  ADD_TAGS: ["use"],
  ADD_ATTR: ["xlink:href"],
  FORBID_TAGS: [
    "style",
    "iframe",
    "frame",
    "frameset",
    "object",
    "embed",
    "link",
    "meta",
    "base",
  ],
};

/**
 * 渲染社区投稿题解的 markdown：与官方同一条管线，但用受限 TeX 宏包并强制 sanitize。
 * 社区内容是外部输入，即便已经人工 review 过，也不该假设「一定审到位了」。
 */
export function renderUserMarkdown(text) {
  return DOMPurify.sanitize(communityMd.render(String(text ?? "")), PURIFY_CONFIG);
}
