/**
 * 数据加载层。
 *
 * 实时维护（npm run dev，Vite 热更新）时用静态 import 导入 data.json，
 * 编辑 data.json 会即时生效；build 时也会被打包进产物。
 *
 * 同时保留 fetch 回退：如果打包后有人继续用旧的「直接编辑 data.json 后
 * 部署 GitHub Pages」工作流，页面也能在运行时读取根目录的 data.json。
 */
import bundledData from "../../data.json";

async function fetchData() {
  try {
    const res = await fetch("./data.json");
    if (!res.ok) throw new Error("HTTP " + res.status);
    const data = await res.json();
    return Array.isArray(data) ? data : data.problems || [];
  } catch (err) {
    // 回退：dev/build 内联的数据
    return bundledData;
  }
}

export async function loadProblems() {
  return fetchData();
}
