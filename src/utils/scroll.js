/**
 * 页内滚动到元素，尊重系统的「减少动态效果」偏好。
 * 主页面区块导航和每日打卡页内 tab 共用这一份行为。
 */
export function scrollToElement(el) {
  if (!el) return;
  const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}
