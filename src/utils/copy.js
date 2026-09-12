/**
 * 代码块右上角 copy 按钮的共享处理。
 *
 * 说明：SolutionPanel.vue 里原本内联了一份等价实现，这里抽出来给社区题解复用。
 * SolutionPanel 暂未改动（避免为社区功能引入回归），后续可一并切换到这个模块。
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
    document.execCommand("copy");
    ta.remove();
    done();
  } catch (e) {
    done();
  }
}

/** 复制按钮所在的 <pre> 里的代码，并给按钮 1.2s 的 "copied" 反馈。 */
export function copyFromButton(btn) {
  const pre = btn.closest("pre");
  if (!pre) return;
  const text = pre.querySelector("code")?.innerText ?? "";

  const done = () => {
    btn.textContent = "copied";
    btn.classList.add("copied");
    window.setTimeout(() => {
      btn.textContent = "copy";
      btn.classList.remove("copied");
    }, 1200);
  };

  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => fallbackCopy(text, done));
  } else {
    fallbackCopy(text, done);
  }
}

/** document 级点击委托：命中 .code-copy 且落在 root 内才处理。 */
export function onCopyClick(e, root) {
  const btn = e.target.closest?.(".code-copy");
  if (btn && root?.contains(btn)) copyFromButton(btn);
}
