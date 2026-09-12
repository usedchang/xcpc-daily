#!/usr/bin/env node
/**
 * 校验社区投稿题解是否符合仓库约定。
 *
 * 本地用法（自己投稿前先跑一遍）：
 *   node scripts/validate-submission.mjs solutions/community/2026-09-08-Alice.md
 *
 * CI 用法见 .github/workflows/review-solution.yml：传入 PR 的所有改动文件，
 * 并带上 `--author <login>`，用于校验文件名里的 handle 与 PR 作者一致（防冒名）。
 *
 * 约定（与 src/data/community.js 保持同步）：
 *   - 投稿只能放在 solutions/community/ 下，文件名 `YYYY-MM-DD-<handle>.md`
 *   - 顶部 front matter 必须能解析，且 date 必须是 data.json 里已存在的题目
 *   - 不得顺手改动 data.json / 官方题解 / src / .github
 */
import { readFileSync, statSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFrontMatter } from "../src/utils/frontmatter.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, "..");

const SUBMISSIONS_DIR = "solutions/community/";
const MAX_BYTES = 256 * 1024;
const FILE_RE = /^(\d{4}-\d{2}-\d{2})-(.+)\.md$/;

// 投稿 PR 里不该出现的改动
const PROTECTED = [
  { test: (p) => p === "data.json", why: "不要修改 data.json（题目数据由维护者维护）" },
  { test: (p) => /^solutions\/[^/]+\.md$/i.test(p), why: "不要修改官方题解（solutions/ 根目录下的 md）" },
  { test: (p) => p.startsWith("src/"), why: "不要修改前端源码（src/）" },
  { test: (p) => p.startsWith(".github/"), why: "不要修改 CI 配置（.github/）" },
];

// 正文里的危险标记：前端渲染还会 sanitize 一遍，这里先拦一道，
// 让投稿者在 PR 阶段就收到明确反馈，而不是静默被清洗。
const FORBIDDEN = [
  { re: /<script\b/i, why: "正文不能包含 <script>" },
  { re: /<iframe\b/i, why: "正文不能包含 <iframe>" },
  { re: /\son[a-z]+\s*=/i, why: "正文不能包含内联事件属性（如 onclick=）" },
  { re: /javascript:/i, why: "正文不能包含 javascript: 链接" },
];

function todayInBeijing() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const get = (t) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function normalize(p) {
  return String(p).replace(/\\/g, "/").replace(/^\.\//, "").trim();
}

function main() {
  const argv = process.argv.slice(2);
  let author = "";
  const files = [];

  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--author") {
      author = String(argv[++i] || "").trim().toLowerCase();
    } else if (argv[i]) {
      files.push(normalize(argv[i]));
    }
  }

  const errors = [];
  const notes = [];

  // ---- 1. 受保护的路径 ----
  for (const f of files) {
    for (const rule of PROTECTED) {
      if (rule.test(f)) errors.push(`${f}：${rule.why}`);
    }
  }

  // ---- 2. 投稿文件本身 ----
  const submissions = files.filter((f) => f.toLowerCase().endsWith(".md") && f.startsWith(SUBMISSIONS_DIR));

  for (const f of files) {
    if (f.toLowerCase().endsWith(".md") && !f.startsWith(SUBMISSIONS_DIR)) {
      notes.push(`${f}：这不是 solutions/community/ 下的投稿，跳过格式校验`);
    }
  }

  if (submissions.length === 0) {
    if (errors.length === 0) {
      notes.push("本次改动没有新的社区投稿文件，跳过投稿格式校验");
    }
  }

  // data.json 里的题目日期（date 必须真实存在，避免给不存在的题投稿）
  let knownDates = new Set();
  try {
    const raw = JSON.parse(readFileSync(resolve(ROOT, "data.json"), "utf8"));
    const arr = Array.isArray(raw) ? raw : raw.problems || [];
    knownDates = new Set(arr.map((it) => String(it.date || "")));
  } catch (err) {
    errors.push(`无法读取 data.json：${err.message}`);
  }

  const today = todayInBeijing();

  for (const f of submissions) {
    const abs = resolve(ROOT, f);
    const base = f.slice(SUBMISSIONS_DIR.length);

    // 模板 / 说明文件不参与校验
    if (base.startsWith("_") || base.toLowerCase() === "readme.md") {
      notes.push(`${f}：以 _ 开头或名为 README，按约定忽略`);
      continue;
    }

    // 2.1 文件名
    const m = FILE_RE.exec(base);
    if (!m) {
      errors.push(`${f}：文件名必须是 YYYY-MM-DD-<handle>.md`);
      continue;
    }
    const [, fileDate, handle] = m;

    // 2.2 文件名里的 handle 必须与 PR 作者一致（防冒名；展示名走 front matter 的 author）
    if (author && handle.toLowerCase() !== author) {
      errors.push(
        `${f}：文件名里的 handle「${handle}」与 PR 作者「${author}」不一致。` +
          `请把文件重命名为 ${fileDate}-${author}.md（想用别的展示名，请写 front matter 的 author）`
      );
    }

    // 2.3 体积
    let size = 0;
    try {
      size = statSync(abs).size;
    } catch (err) {
      errors.push(`${f}：无法读取文件（${err.message}）`);
      continue;
    }
    if (size > MAX_BYTES) {
      errors.push(`${f}：文件过大（${(size / 1024).toFixed(0)} KB），上限 ${MAX_BYTES / 1024} KB`);
    }
    if (size === 0) {
      errors.push(`${f}：文件是空的`);
      continue;
    }

    const text = readFileSync(abs, "utf8");

    // 2.4 front matter
    const { data, body } = parseFrontMatter(text);
    if (!Object.keys(data).length && !/^---/m.test(text.split("\n")[0] || "")) {
      errors.push(`${f}：缺少 front matter（文件开头需要 --- author/date --- 元信息块）`);
    }
    if (!String(data.author || "").trim()) {
      errors.push(`${f}：front matter 缺少 author（展示名）`);
    }

    const date = String(data.date || fileDate);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      errors.push(`${f}：date「${date}」不是 YYYY-MM-DD 格式`);
    } else {
      if (!knownDates.has(date)) {
        errors.push(`${f}：date「${date}」在 data.json 里不存在，请确认题目日期`);
      }
      if (date > today) {
        errors.push(`${f}：date「${date}」晚于今天（${today}，北京时间），尚未发布的题目不能投稿`);
      }
      if (date !== fileDate) {
        errors.push(`${f}：文件名日期「${fileDate}」与 front matter 的 date「${date}」不一致`);
      }
    }

    // 2.5 正文
    if (!body.trim()) {
      errors.push(`${f}：front matter 之后没有正文`);
    }
    for (const rule of FORBIDDEN) {
      if (rule.re.test(body)) errors.push(`${f}：${rule.why}`);
    }
  }

  // ---- 输出 ----
  for (const n of notes) console.log(`· ${n}`);

  if (errors.length) {
    console.error("\n❌ 投稿校验未通过：\n");
    for (const e of errors) console.error(`   - ${e}`);
    console.error("\n修正后重新提交即可。约定详见 CONTRIBUTING.md。\n");
    process.exit(1);
  }

  console.log("✅ 投稿校验通过");
}

main();
