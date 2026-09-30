/**
 * 复制到剪贴板的共享实现。
 *
 * 官方题解（SolutionPanel）、社区题解（CommunitySolutions）、分享按钮（ShareDaily）
 * 各自需要不同粒度的入口，但底层只有这一份实现。
 */

function fallbackCopy(text, done) {
  // 非安全上下文（http / file）下 navigator.clipboard 不可用时的兜底
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand("copy");
    ta.remove();
    done(Boolean(ok));
  } catch (e) {
    done(false);
  }
}

/**
 * 复制任意文本，两种通道都失败时返回 false（调用方据此提示「请手动复制」）。
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyText(text) {
  const value = String(text ?? "");
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch (e) {
      // 继续走 execCommand 兜底
    }
  }
  return new Promise((resolve) => fallbackCopy(value, resolve));
}

/** 复制按钮所在的 <pre> 里的代码，并给按钮 1.2s 的 "copied" 反馈。 */
export function copyFromButton(btn) {
  const pre = btn.closest("pre");
  if (!pre) return;
  const text = pre.querySelector("code")?.innerText ?? "";

  const done = (ok) => {
    btn.textContent = ok ? "copied" : "failed";
    btn.classList.toggle("copied", ok);
    if (!ok) btn.classList.add("copy-failed");
    window.setTimeout(() => {
      btn.textContent = "copy";
      btn.classList.remove("copied", "copy-failed");
    }, 1200);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => done(true)).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

/** document 级点击委托：命中 .code-copy 且落在 root 内才处理。 */
export function onCopyClick(e, root) {
  const btn = e.target.closest?.(".code-copy");
  if (btn && root?.contains(btn)) copyFromButton(btn);
}
