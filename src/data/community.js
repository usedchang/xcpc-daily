/**
 * 社区题解加载层（甲方案：以 GitHub 为后端）。
 *
 * 约定：用户投稿的题解放在 `solutions/community/` 下，命名为 `YYYY-MM-DD-<handle>.md`，
 * 正文顶部可带 YAML front matter（`author` 为展示名，缺省用文件名里的 handle）。
 *
 * 关键性质：这个目录里**只可能存在已合并的投稿**——审核中 / 被拒的稿件只活在 PR 分支上。
 * 因此这里没有 status 字段，也不需要审核过滤：进了这个目录就等于审核通过。
 *
 * 与官方题解的边界：
 *   - 官方 `solutions/*.md` 是可信任内容，走 renderMarkdown（不 sanitize）
 *   - 社区在这里，是外部内容，渲染时必须走 renderUserMarkdown（sanitize）
 *
 * 另一处与官方题解的区别：**不做 fetch 回退**。官方题解允许 build 后往部署目录丢 md
 * 即时生效；社区题解故意不保留这个后门，否则就绕过了「合并 = 已审核」这条保证。
 */
import { parseFrontMatter } from "../utils/frontmatter.js";
import { COMMUNITY } from "../config/community.js";

const modules = import.meta.glob("../../solutions/community/*.md", {
  query: "?raw",
  import: "default",
});

// 文件名约定：日期 + handle。不符合的文件一律忽略，避免投稿目录被塞进无关内容。
const FILE_RE = /^(\d{4}-\d{2}-\d{2})-(.+)$/;

function isIgnored(name) {
  const n = String(name || "").toLowerCase();
  return !n || n === "readme" || n.startsWith("_");
}

/** 从 glob key 解析出的轻量条目（只有元信息，不含正文），构建时即可确定。 */
function parseKey(key) {
  const base = String(key).split("/").pop() || "";
  const name = base.replace(/\.md$/i, "");
  if (isIgnored(name)) return null;

  const m = FILE_RE.exec(name);
  if (!m) return null;

  return {
    key,
    date: m[1],
    handle: m[2],
    file: name,
    path: `${COMMUNITY.submissionsDir}/${base}`,
    url: `${COMMUNITY.repoUrl}/blob/${COMMUNITY.defaultBranch}/${COMMUNITY.submissionsDir}/${base}`,
  };
}

/** 全部已合并的社区题解条目，按日期、handle 排序。 */
export const communityEntries = Object.keys(modules)
  .map(parseKey)
  .filter(Boolean)
  .sort((a, b) => a.date.localeCompare(b.date) || a.handle.localeCompare(b.handle));

const byDate = new Map();
for (const entry of communityEntries) {
  if (!byDate.has(entry.date)) byDate.set(entry.date, []);
  byDate.get(entry.date).push(entry);
}

/** 某题已合并的社区题解条目（同步，可直接用于显示计数）。 */
export function communityEntriesFor(date) {
  return byDate.get(String(date || "").trim()) || [];
}

/** 某题有没有社区题解（同步）。 */
export function hasCommunitySolutions(problem) {
  return communityEntriesFor(problem?.date).length > 0;
}

const contentCache = new Map();

/**
 * 加载单条社区题解的正文与元信息。
 * @returns {Promise<null | {date,handle,author,title,avatar,body,url,path,file}>}
 */
export async function loadCommunitySolution(entry) {
  if (!entry) return null;
  if (contentCache.has(entry.key)) return contentCache.get(entry.key);

  let raw = "";
  try {
    raw = await modules[entry.key]();
  } catch (err) {
    console.warn("加载社区题解失败", entry.file, err);
    return null;
  }

  const { data, body } = parseFrontMatter(raw);
  const result = {
    ...entry,
    author: String(data.author || entry.handle),
    title: String(data.title || "").trim(),
    avatar: `https://github.com/${encodeURIComponent(entry.handle)}.png`,
    body,
  };

  contentCache.set(entry.key, result);
  return result;
}
