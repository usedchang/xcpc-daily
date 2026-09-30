/**
 * `markdown.js` 的按需加载外壳。
 *
 * `markdown.js` 会把 MathJax（含全部 TeX 宏包）、markdown-it、highlight.js、DOMPurify
 * 一起拉进依赖图，压缩后仍有 ~2 MB —— 而这些只在「打开某道题的题解弹窗」时才会用到。
 * 入口静态 import 它，等于让每个访客（哪怕只看一眼题表）先下载这 2 MB。
 *
 * 这里用动态 import 把它切成独立 chunk：首屏只剩 Vue 与页面本身；
 * chunk 名字由 vite.config.js 固定成 `assets/markdown.js`（不带内容哈希），
 * 于是「旧 HTML + CDN 尚未更新的新产物」也不会拿到 404。
 *
 * 加载失败时把 promise 清掉：只失败一次就永久失败会更难排查（例如临时断网）。
 */
let modPromise = null;

export function loadMarkdown() {
  if (!modPromise) {
    modPromise = import("./markdown.js").catch((err) => {
      modPromise = null;
      throw err;
    });
  }
  return modPromise;
}

/** 官方题解渲染（可信内容，不 sanitize）。 */
export async function renderMarkdownAsync(text) {
  const mod = await loadMarkdown();
  return mod.renderMarkdown(text);
}

/** 社区投稿渲染（外部内容，强制 sanitize）。 */
export async function renderUserMarkdownAsync(text) {
  const mod = await loadMarkdown();
  return mod.renderUserMarkdown(text);
}
