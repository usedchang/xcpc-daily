#!/usr/bin/env node
/**
 * 打卡系统的逻辑测试（离线，不连 GitHub）。
 *
 *   node scripts/test-checkin.mjs
 *
 * 覆盖最容易悄悄算错的东西：
 *   1. 日期：北京时间跨天、闰年、跨年、周起始（热力图是周日开头）；
 *   2. 日历 / 连续天数：绿格子的档位、未来日期、今天还没打卡时连续天数怎么算；
 *   3. 多端合并：本机 + Gist 两份数据并集、同 id 取新、删除墓碑不复活；
 *   4. 排行榜：公开快照格式、Issue 登记解析、排名规则；
 *   5. OAuth 代理：CORS 白名单 / Client ID / scope 校验（不联网）。
 *
 * 不 import Vue、不碰 localStorage，跑的就是 src/data 下的纯逻辑。
 */
import assert from "node:assert/strict";
import {
  CHECKIN_DOC_VERSION,
  DEFAULT_GIST_FILE,
  MAX_SOLUTION,
  MAX_TITLE,
  buildCalendar,
  computeStats,
  createEmptyDoc,
  docSignature,
  levelOf,
  makeRecord,
  mergeDocs,
  normalizeDoc,
  normalizeRecord,
  parseDoc,
  serializeDoc,
  sortRecordsDesc,
  validateCheckin,
} from "../src/data/checkin-core.js";
import {
  addDays,
  daysBetween,
  formatCnDate,
  isDateString,
  monthDay,
  startOfWeek,
  todayInBeijing,
  weekdayOf,
} from "../src/utils/date.js";
import { findCheckinGist, gistFileContent, parseScopes } from "../src/auth/github.js";
import {
  clearCfBinding,
  fetchCfSolved,
  fetchCfUser,
  isCfSolvedStale,
  normalizeBinding,
  normalizeCfHandle,
  readCfBinding,
  writeCfBinding,
} from "../src/data/cfAccount.js";
import {
  REGISTRATION_MARKER,
  buildLeaderboardSnapshot,
  buildRegistrationIssueUrl,
  mergeRegistrations,
  effectiveCurrentStreak,
  normalizeRegistry,
  normalizeSnapshot,
  parseRegistrationIssue,
  rankLeaderboard,
} from "../src/data/leaderboard-core.js";
import { allowedOrigin, handleRequest } from "../server/oauth-proxy/core.mjs";

/* ------------------------------------------------------------------ *
 * 迷你测试框架
 * ------------------------------------------------------------------ */
let passed = 0;
const failures = [];
let groupName = "";

function group(name) {
  groupName = name;
  console.log(`\n\x1b[1m${name}\x1b[0m`);
}

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failures.push({ group: groupName, name, err });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`      ${String(err.message).split("\n").join("\n      ")}`);
  }
}

/** 给代理这类 async 逻辑用的版本；同步测试不用改。 */
async function testAsync(name, fn) {
  try {
    await fn();
    passed += 1;
    console.log(`  \x1b[32m✓\x1b[0m ${name}`);
  } catch (err) {
    failures.push({ group: groupName, name, err });
    console.log(`  \x1b[31m✗\x1b[0m ${name}`);
    console.log(`      ${String(err.message).split("\n").join("\n      ")}`);
  }
}

/** 造一条最小可用记录。 */
function record(date, extra = {}) {
  return normalizeRecord({
    id: extra.id,
    date,
    title: extra.title || `题目 ${date}`,
    link: extra.link || "https://example.com/p",
    createdAt: extra.createdAt,
    updatedAt: extra.updatedAt,
    ...extra,
  });
}

const TODAY = "2026-10-18"; // 周日，跨年/跨月测试都方便

/* ------------------------------------------------------------------ *
 * 1. 日期
 * ------------------------------------------------------------------ */
group("日期工具（北京时间 / 加减 / 周起始）");

test("todayInBeijing：UTC 15:59 仍是北京当天，16:00 进入次日", () => {
  assert.equal(todayInBeijing(new Date("2026-10-18T15:59:59Z")), "2026-10-18");
  assert.equal(todayInBeijing(new Date("2026-10-18T16:00:00Z")), "2026-10-19");
});

test("addDays：闰年 2 月与跨年", () => {
  assert.equal(addDays("2024-02-28", 1), "2024-02-29");
  assert.equal(addDays("2024-02-29", 1), "2024-03-01");
  assert.equal(addDays("2023-02-28", 1), "2023-03-01");
  assert.equal(addDays("2025-12-31", 1), "2026-01-01");
  assert.equal(addDays("2026-01-01", -1), "2025-12-31");
  assert.equal(addDays("2026-10-18", -371), "2025-10-12");
});

test("addDays：非法输入返回空串，不抛异常", () => {
  assert.equal(addDays("", 1), "");
  assert.equal(addDays("2026-02-30", 1), "");
  assert.equal(addDays("2026-10-18", NaN), "");
});

test("isDateString / parseDateParts：拒绝不存在的日期", () => {
  assert.equal(isDateString("2026-10-18"), true);
  assert.equal(isDateString("2024-02-29"), true);
  assert.equal(isDateString("2026-02-29"), false);
  assert.equal(isDateString("2026-2-9"), false);
  assert.equal(isDateString("2026-13-01"), false);
  assert.equal(isDateString(null), false);
});

test("weekdayOf / startOfWeek：热力图从周日开始", () => {
  assert.equal(weekdayOf("2026-10-18"), 0);
  assert.equal(weekdayOf("2026-10-19"), 1);
  assert.equal(startOfWeek("2026-10-18"), "2026-10-18");
  assert.equal(startOfWeek("2026-10-24"), "2026-10-18");
  assert.equal(startOfWeek("2026-10-25"), "2026-10-25");
});

test("daysBetween / 格式化工具", () => {
  assert.equal(daysBetween("2025-10-18", "2026-10-18"), 365);
  assert.equal(daysBetween("2024-02-28", "2024-03-01"), 2);
  assert.equal(monthDay("2026-10-08"), "10-08");
  assert.equal(formatCnDate("2026-10-18"), "2026年10月18日 · 周日");
});

/* ------------------------------------------------------------------ *
 * 2. 记录规整 / 表单校验
 * ------------------------------------------------------------------ */
group("记录规整与表单校验");

test("normalizeRecord：字段清洗、URL 白名单、标题回退到域名", () => {
  const r = normalizeRecord({
    date: " 2026-10-18 ",
    title: "  A.   Many   Heads ",
    link: "https://codeforces.com/gym/104901/problem/A",
    solution: "  按位考虑  ",
    createdAt: 1000,
    updatedAt: 2000,
  });
  assert.equal(r.date, "2026-10-18");
  assert.equal(r.title, "A. Many Heads");
  assert.equal(r.solution, "按位考虑");
  assert.equal("verdict" in r, false);
  assert.equal(r.createdAt, 1000);
  assert.equal(r.updatedAt, 2000);

  const noTitle = normalizeRecord({
    date: "2026-10-18",
    link: "https://www.qoj.ac/contest/1465/problem/4824",
  });
  assert.equal(noTitle.title, "qoj.ac");
});

test("normalizeRecord：javascript: 链接被清空；没有题目信息则丢弃", () => {
  const r = normalizeRecord({ date: "2026-10-18", title: "x", link: "javascript:alert(1)" });
  assert.equal(r.link, "");
  assert.equal(normalizeRecord({ date: "2026-10-18" }), null);
  assert.equal(normalizeRecord({ date: "2026-99-99", title: "x" }), null);
  assert.equal(normalizeRecord(null), null);
});

test("normalizeRecord：缺 id 时生成确定性 id（同内容不会重复合并）", () => {
  const raw = { date: "2026-10-18", title: "x", link: "https://a.com", createdAt: 1000 };
  const a = normalizeRecord(raw);
  const b = normalizeRecord(raw);
  assert.equal(a.id, b.id);
  assert.match(a.id, /^auto-[a-z0-9]+$/);

  // 连 createdAt 都没有的老数据：id 不能随「当前时间」变化
  const bare = { date: "2026-10-18", title: "x", link: "https://a.com" };
  assert.equal(normalizeRecord(bare).id, normalizeRecord(bare, 123).id);
});

test("normalizeRecord：完整题解长度上限，合法 id 原样保留", () => {
  const r = normalizeRecord({
    id: "abc-123_x",
    date: "2026-10-18",
    title: "x",
    solution: "字".repeat(MAX_SOLUTION + 100),
  });
  assert.equal(r.id, "abc-123_x");
  assert.equal(r.solution.length, MAX_SOLUTION);
});

test("normalizeRecord：旧数据 note 自动迁移为 solution", () => {
  const r = normalizeRecord({
    date: "2026-10-18",
    title: "x",
    note: "旧备注",
  });
  assert.equal(r.solution, "旧备注");
  assert.equal("note" in r, false);
});

test("validateCheckin：日期 / 当天题目 / 链接 / 完整题解", () => {
  const base = {
    date: TODAY,
    problemDate: TODAY,
    title: "A",
    link: "",
    submission: "",
    solution: "",
  };
  assert.deepEqual(validateCheckin(base, TODAY), {});

  assert.ok(validateCheckin({ ...base, date: "2026-10-19" }, TODAY).date);
  assert.ok(validateCheckin({ ...base, date: "2026-10-32" }, TODAY).date);
  assert.ok(validateCheckin({ ...base, problemDate: "" }, TODAY).problemDate);
  assert.ok(validateCheckin({ ...base, title: "" }, TODAY).title);
  assert.ok(validateCheckin({ ...base, title: "x".repeat(MAX_TITLE + 1) }, TODAY).title);
  assert.ok(validateCheckin({ ...base, link: "ftp://x" }, TODAY).link);
  assert.ok(validateCheckin({ ...base, submission: "not a url" }, TODAY).submission);
  assert.ok(validateCheckin({ ...base, solution: "x".repeat(MAX_SOLUTION + 1) }, TODAY).solution);
});

test("makeRecord：生成唯一 id，坏日期返回 null", () => {
  const a = makeRecord({ date: TODAY, problemDate: TODAY, title: "A" }, 1000);
  const b = makeRecord({ date: TODAY, problemDate: TODAY, title: "A" }, 1000);
  assert.notEqual(a.id, b.id);
  assert.equal(a.createdAt, 1000);
  assert.equal(a.problemDate, TODAY);
  assert.equal(makeRecord({ date: "bad", title: "A" }), null);
});

/* ------------------------------------------------------------------ *
 * 3. 热力图
 * ------------------------------------------------------------------ */
group("绿色热力图（53 周 / 档位 / 未来日期）");

test("buildCalendar：53 列 × 7 行，从周日开始，最后一列包含今天", () => {
  const cal = buildCalendar([], TODAY);
  assert.equal(cal.weeks.length, 53);
  assert.equal(cal.weeks.flatMap((w) => w.days).length, 371);
  assert.equal(weekdayOf(cal.weeks[0].days[0].date), 0);
  assert.equal(weekdayOf(cal.weeks[52].days[6].date), 6);
  assert.equal(cal.weeks[52].days[0].date, "2026-10-18");
  assert.equal(cal.start, "2025-10-19");
  assert.equal(cal.range, "2025.10.19 – 2026.10.18");
});

test("buildCalendar：今天之后是 future，不能画绿", () => {
  const cal = buildCalendar([{ date: "2026-10-19" }], TODAY);
  const cells = cal.weeks.flatMap((w) => w.days);
  const tomorrow = cells.find((c) => c.date === "2026-10-19");
  assert.equal(tomorrow.future, true);
  assert.equal(tomorrow.level, 0);
  assert.equal(tomorrow.count, 1);
});

test("buildCalendar：档位 1 / 2 / 3-4 / 5+，today 标记正确", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 9].map(levelOf), [0, 1, 2, 3, 3, 4, 4]);

  const records = [
    { date: "2026-10-12" },
    { date: "2026-10-13" },
    { date: "2026-10-13" },
    { date: "2026-10-14" },
    { date: "2026-10-14" },
    { date: "2026-10-14" },
    { date: "2026-10-15" },
    { date: "2026-10-15" },
    { date: "2026-10-15" },
    { date: "2026-10-15" },
    { date: "2026-10-16" },
    { date: "2026-10-16" },
    { date: "2026-10-16" },
    { date: "2026-10-16" },
    { date: "2026-10-16" },
  ];
  const cal = buildCalendar(records, TODAY);
  const byDate = new Map(cal.weeks.flatMap((w) => w.days).map((c) => [c.date, c]));
  assert.equal(byDate.get("2026-10-12").level, 1);
  assert.equal(byDate.get("2026-10-13").level, 2);
  assert.equal(byDate.get("2026-10-14").level, 3);
  assert.equal(byDate.get("2026-10-16").level, 4);
  assert.equal(byDate.get(TODAY).isToday, true);
  assert.equal(byDate.get("2026-10-17").isToday, false);
  assert.equal(cal.activeDays, 5);
  assert.equal(cal.submissions, 15);
});

test("buildCalendar：月份标签只在跨月那列出现，且首列有标签", () => {
  const cal = buildCalendar([], TODAY);
  assert.equal(cal.weeks[0].label, "10月");
  const labels = cal.weeks.filter((w) => w.label);
  assert.ok(labels.length >= 12 && labels.length <= 14, `月份标签数量异常：${labels.length}`);
  // 标签必须逐月递增；跨年时 12月 -> 1月 也要成立（不能简单比较数字大小）
  const nums = labels.map((w) => Number(w.label.replace("月", "")));
  const expectedMonths = nums.map((_, i) => ((nums[0] - 1 + i) % 12) + 1);
  assert.deepEqual(nums, expectedMonths, `月份标签不连续：${labels.map((w) => w.label).join(",")}`);
});

test("buildCalendar：非法 today 返回空日历而不是抛错", () => {
  const cal = buildCalendar([], "");
  assert.deepEqual(cal.weeks, []);
  assert.equal(cal.activeDays, 0);
});

/* ------------------------------------------------------------------ *
 * 4. 连续天数 / 统计
 * ------------------------------------------------------------------ */
group("连续天数与统计");

test("computeStats：空数据", () => {
  const s = computeStats([], TODAY);
  assert.equal(s.total, 0);
  assert.equal(s.currentStreak, 0);
  assert.equal(s.longestStreak, 0);
  assert.equal(s.todayCount, 0);
});

test("computeStats：今天有记录，连续 3 天", () => {
  const s = computeStats(
    [{ date: "2026-10-18" }, { date: "2026-10-17" }, { date: "2026-10-16" }, { date: "2026-10-14" }],
    TODAY
  );
  assert.equal(s.currentStreak, 3);
  assert.equal(s.longestStreak, 3);
  assert.equal(s.activeDays, 4);
});

test("computeStats：今天还没打卡，从昨天往前数", () => {
  const s = computeStats([{ date: "2026-10-17" }, { date: "2026-10-16" }], TODAY);
  assert.equal(s.currentStreak, 2);
});

test("computeStats：今天和昨天都没有，连续归零", () => {
  const s = computeStats([{ date: "2026-10-15" }, { date: "2026-10-16" }], TODAY);
  assert.equal(s.currentStreak, 0);
  assert.equal(s.longestStreak, 2);
});

test("computeStats：一天多次提交只算一天，但总提交数按条数", () => {
  const s = computeStats(
    [
      { date: "2026-10-18" },
      { date: "2026-10-18" },
      { date: "2026-10-18" },
      { date: "2026-10-17" },
    ],
    TODAY
  );
  assert.equal(s.activeDays, 2);
  assert.equal(s.total, 4);
  assert.equal(s.todayCount, 3);
  assert.equal(s.currentStreak, 2);
});

test("computeStats：跨月 / 跨年的最长连续", () => {
  const s = computeStats(
    [
      { date: "2025-12-30" },
      { date: "2025-12-31" },
      { date: "2026-01-01" },
      { date: "2026-01-02" },
      { date: "2026-01-04" },
    ],
    TODAY
  );
  assert.equal(s.longestStreak, 4);
});

test("computeStats：本月与最近 30 天", () => {
  const s = computeStats(
    [{ date: "2026-10-01" }, { date: "2026-10-02" }, { date: "2026-09-30" }, { date: "2026-10-18" }],
    TODAY
  );
  assert.equal(s.thisMonthDays, 3);
  assert.equal(s.last30Days, 4);
  assert.equal(s.firstDate, "2026-09-30");
  assert.equal(s.lastDate, "2026-10-18");
});

/* ------------------------------------------------------------------ *
 * 5. 排行榜快照 / 登记 / 排名
 * ------------------------------------------------------------------ */
group("排行榜（公开快照 / 登记 / 排名）");

test("buildLeaderboardSnapshot：只输出统计数字，不泄露题解和提交链接", () => {
  const records = [
    { date: "2026-10-18", title: "题目 A", solution: "很长的题解", submission: "https://x" },
    { date: "2026-10-17", title: "题目 A" },
  ];
  const snap = buildLeaderboardSnapshot({
    login: "alice",
    records,
    today: TODAY,
    now: 1792330000000,
  });
  assert.equal(snap.login, "alice");
  assert.equal(snap.stats.currentStreak, 2);
  assert.equal(snap.stats.activeDays, 2);
  assert.equal(snap.stats.total, 2);
  assert.equal(JSON.stringify(snap).includes("很长的题解"), false);
  assert.equal(JSON.stringify(snap).includes("题目 A"), false);
});

test("normalizeSnapshot：校验登录名、stats、inactive 与坏 JSON", () => {
  const base = {
    app: "xcpc-daily-leaderboard",
    login: "alice",
    updatedAt: 1792330000000,
    stats: { currentStreak: 3, activeDays: 5, total: 8 },
  };
  const ok = normalizeSnapshot(JSON.stringify(base), "alice");
  assert.equal(ok.stats.currentStreak, 3);
  assert.equal(ok.stats.total, 8);
  assert.equal(normalizeSnapshot(base, "bob"), null);
  assert.equal(normalizeSnapshot({ ...base, inactive: true }), null);
  assert.equal(normalizeSnapshot("{oops"), null);
  assert.equal(normalizeSnapshot({ ...base, login: "__proto__" }), null);
});

test("normalizeRegistry / mergeRegistrations：数组、members、去重与静态优先", () => {
  const a = { login: "alice", gistId: "abc123" };
  const b = { login: "bob", gistId: "def456" };
  assert.deepEqual(normalizeRegistry([a, b, a]), [a, b]);
  assert.deepEqual(normalizeRegistry({ members: [a] }), [a]);
  assert.deepEqual(normalizeRegistry([{ login: "__proto__", gistId: "x" }]), []);

  const merged = mergeRegistrations([a], [{ login: "alice", gistId: "other" }, b]);
  assert.deepEqual(merged, [a, b]);
});

test("parseRegistrationIssue：marker + JSON + 作者校验 + 关闭即下架", () => {
  const body = `${REGISTRATION_MARKER}\n\n\`\`\`json\n{"login":"alice","gistId":"abc123"}\n\`\`\`\n`;
  const open = {
    state: "open",
    body,
    user: { login: "alice" },
    number: 7,
    html_url: "https://github.com/o/r/issues/7",
    created_at: "2026-10-18T00:00:00Z",
  };
  assert.equal(parseRegistrationIssue(open).gistId, "abc123");
  assert.equal(parseRegistrationIssue({ ...open, user: { login: "bob" } }), null);
  assert.equal(parseRegistrationIssue({ ...open, state: "closed" }), null);
  assert.equal(parseRegistrationIssue({ ...open, body: "no marker" }), null);
});

test("buildRegistrationIssueUrl：带上 marker 和 JSON 登记信息", () => {
  const url = buildRegistrationIssueUrl({
    repo: "usedchang/xcpc-daily",
    login: "alice",
    gistId: "abc123",
  });
  assert.match(url, /issues\/new\?/);
  const body = new URL(url).searchParams.get("body") || "";
  assert.equal(body.includes(REGISTRATION_MARKER), true);
  assert.equal(body.includes('"gistId": "abc123"'), true);
  assert.equal(buildRegistrationIssueUrl({ repo: "", login: "alice", gistId: "abc123" }), "");
});

test("rankLeaderboard：连续 → 天数 → 提交 → 最近 30 天 → 更新时间", () => {
  const ranked = rankLeaderboard([
    { login: "a", updatedAt: 1, stats: { currentStreak: 3, activeDays: 10, total: 20, last30Days: 5, lastDate: TODAY } },
    { login: "b", updatedAt: 2, stats: { currentStreak: 5, activeDays: 8, total: 9, last30Days: 4, lastDate: TODAY } },
    { login: "c", updatedAt: 3, stats: { currentStreak: 3, activeDays: 10, total: 20, last30Days: 6, lastDate: TODAY } },
  ], TODAY);
  assert.deepEqual(ranked.map((x) => x.login), ["b", "c", "a"]);
  assert.deepEqual(ranked.map((x) => x.rank), [1, 2, 3]);
});

test("effectiveCurrentStreak：快照放几天后连续天数会归零", () => {
  const stats = { currentStreak: 7, lastDate: "2026-10-18" };
  assert.equal(effectiveCurrentStreak(stats, "2026-10-18"), 7);
  assert.equal(effectiveCurrentStreak(stats, "2026-10-19"), 7);
  assert.equal(effectiveCurrentStreak(stats, "2026-10-20"), 0);
  assert.equal(effectiveCurrentStreak({ currentStreak: 7, lastDate: "" }, TODAY), 0);
});

/* ------------------------------------------------------------------ *
 * 6. 文档合并（本机 + Gist）
 * ------------------------------------------------------------------ */
group("多端合并与删除墓碑");

test("normalizeDoc：兼容数组 / records / checkins 三种形状", () => {
  const a = normalizeDoc([{ date: TODAY, title: "a", id: "a1" }]);
  const b = normalizeDoc({ records: [{ date: TODAY, title: "b", id: "b1" }] });
  const c = normalizeDoc({ checkins: [{ date: TODAY, title: "c", id: "c1" }] });
  assert.equal(a.records.length, 1);
  assert.equal(b.records.length, 1);
  assert.equal(c.records.length, 1);
  assert.equal(c.version, CHECKIN_DOC_VERSION);
});

test("mergeDocs：两份互不相同的记录取并集", () => {
  const local = { records: [record("2026-10-17", { id: "a" })], updatedAt: 1 };
  const remote = { records: [record("2026-10-18", { id: "b" })], updatedAt: 2 };
  const merged = mergeDocs(local, remote);
  assert.deepEqual(merged.records.map((r) => r.id).sort(), ["a", "b"]);
  assert.equal(merged.updatedAt, 2);
});

test("mergeDocs：同一 id 取 updatedAt 更新的那份（两个方向都成立）", () => {
  const oldRec = record("2026-10-18", { id: "same", title: "旧", updatedAt: 100, createdAt: 100 });
  const newRec = record("2026-10-18", { id: "same", title: "新", updatedAt: 200, createdAt: 100 });
  assert.equal(mergeDocs({ records: [oldRec] }, { records: [newRec] }).records[0].title, "新");
  assert.equal(mergeDocs({ records: [newRec] }, { records: [oldRec] }).records[0].title, "新");
});

test("mergeDocs：删除墓碑压过旧记录，不会复活", () => {
  const t = Date.now();
  const rec = record("2026-10-18", { id: "gone", createdAt: t, updatedAt: t });
  const local = { records: [], deleted: { gone: t + 100 } };
  const remote = { records: [rec] };
  assert.equal(mergeDocs(local, remote).records.length, 0);
});

test("mergeDocs：墓碑之后的新记录可以保留", () => {
  const t = Date.now();
  const rec = record("2026-10-18", { id: "back", createdAt: t + 200, updatedAt: t + 200 });
  const merged = mergeDocs({ records: [], deleted: { back: t + 100 } }, { records: [rec] });
  assert.equal(merged.records.length, 1);
  assert.equal(merged.records[0].id, "back");
});

test("normalizeDoc：旧墓碑先过滤记录、再裁剪，避免删除的记录复活", () => {
  const now = Date.now();
  const oldRecord = normalizeRecord({
    id: "old",
    date: "2024-01-01",
    title: "旧记录",
    createdAt: now - 600 * 86400000,
    updatedAt: now - 600 * 86400000,
  });
  const doc = normalizeDoc(
    { records: [oldRecord], deleted: { old: now - 500 * 86400000 } },
    now
  );
  assert.equal(doc.records.length, 0);
  assert.deepEqual(doc.deleted, {});
});

test("mergeDocs：坏记录被丢掉，好记录不受影响", () => {
  const merged = mergeDocs(
    { records: [{ date: "bad" }, null, { date: TODAY, title: "ok", id: "ok" }] },
    { records: [{ date: TODAY, title: "ok2", id: "ok2", link: "javascript:x" }] }
  );
  assert.deepEqual(merged.records.map((r) => r.id).sort(), ["ok", "ok2"]);
});

test("parseDoc / serializeDoc：能往返，坏 JSON 抛错", () => {
  const doc = {
    records: [record("2026-10-18", { id: "a", solution: "line1\nline2" })],
    deleted: { old: Date.now() },
  };
  const parsed = parseDoc(serializeDoc(doc));
  assert.equal(parsed.records.length, 1);
  assert.equal(parsed.records[0].solution, "line1\nline2");
  assert.equal(parsed.deleted.old > 0, true);

  assert.deepEqual(parseDoc("").records, []);
  assert.throws(() => parseDoc("{oops"), /JSON/);
});

test("sortRecordsDesc：日期倒序，同一天新记录在前", () => {
  const list = [
    record("2026-10-17", { id: "a", createdAt: 100 }),
    record("2026-10-18", { id: "b", createdAt: 100 }),
    record("2026-10-18", { id: "c", createdAt: 200 }),
  ];
  assert.deepEqual(sortRecordsDesc(list).map((r) => r.id), ["c", "b", "a"]);
});

test("createEmptyDoc / DEFAULT_GIST_FILE：稳定契约", () => {
  assert.deepEqual(createEmptyDoc(), { version: 1, updatedAt: 0, records: [], deleted: {} });
  assert.equal(DEFAULT_GIST_FILE, "xcpc-daily-checkins.json");
});

test("docSignature：忽略 updatedAt / 排版，只看内容", () => {
  const a = { records: [{ date: TODAY, title: "x", id: "a", updatedAt: 1 }] };
  const b = { records: [{ date: TODAY, title: "x", id: "a", updatedAt: 2 }] };
  assert.equal(docSignature(a), docSignature(b));
  const c = { records: [{ date: TODAY, title: "y", id: "a", updatedAt: 1 }] };
  assert.notEqual(docSignature(a), docSignature(c));
});

/* ------------------------------------------------------------------ *
 * 7. Codeforces 绑定（离线，mock fetch）
 * ------------------------------------------------------------------ */
group("Codeforces 账号绑定（离线）");

test("normalizeCfHandle：去 @、拒绝非法字符", () => {
  assert.equal(normalizeCfHandle("  @tourist "), "tourist");
  assert.equal(normalizeCfHandle("a_b.c-d"), "a_b.c-d");
  assert.equal(normalizeCfHandle("bad handle"), "");
  assert.equal(normalizeCfHandle(""), "");
});

await testAsync("fetchCfUser / fetchCfSolved：资料校验 + 分页提取 AC", async () => {
  const calls = [];
  const impl = async (url) => {
    calls.push(url);
    if (url.includes("user.info")) {
      return new Response(
        JSON.stringify({
          status: "OK",
          result: [
            {
              handle: "Alice",
              rating: 1800,
              maxRating: 2000,
              rank: "expert",
              avatar: "https://userpic.codeforces.org/a.png",
            },
          ],
        }),
        { status: 200 }
      );
    }
    if (url.includes("from=1")) {
      return new Response(
        JSON.stringify({
          status: "OK",
          result: [
            { verdict: "OK", problem: { contestId: 1, index: "A" } },
            { verdict: "WRONG_ANSWER", problem: { contestId: 1, index: "B" } },
          ],
        }),
        { status: 200 }
      );
    }
    return new Response(
      JSON.stringify({
        status: "OK",
        result: [{ verdict: "OK", problem: { contestId: 2, index: "C" } }],
      }),
      { status: 200 }
    );
  };

  const user = await fetchCfUser("alice", { fetchImpl: impl, minInterval: 0 });
  assert.equal(user.handle, "Alice");
  assert.equal(user.rating, 1800);

  const solved = await fetchCfSolved("alice", {
    fetchImpl: impl,
    minInterval: 0,
    pageSize: 2,
    maxPages: 5,
  });
  assert.deepEqual(solved.keys.sort(), ["1A", "2C"]);
  assert.equal(solved.submissions, 3);
  assert.equal(solved.pages, 2);
  assert.equal(calls.length, 3);
});

await testAsync("fetchCfSolved：Codeforces 返回 FAILED 时抛出可读错误", async () => {
  const impl = async () =>
    new Response(JSON.stringify({ status: "FAILED", comment: "handle: not found" }), {
      status: 200,
    });
  await assert.rejects(
    () => fetchCfSolved("nobody", { fetchImpl: impl, minInterval: 0 }),
    /not found/
  );
});

test("绑定本地持久化：写读删、AC 缓存过期", () => {
  const memory = new Map();
  const storage = {
    getItem: (key) => (memory.has(key) ? memory.get(key) : null),
    setItem: (key, value) => memory.set(key, String(value)),
    removeItem: (key) => memory.delete(key),
  };
  const binding = normalizeBinding({
    handle: "alice",
    rating: 1800,
    solvedKeys: ["1A", "bad key", "2C", "1a"],
    solvedAt: Date.now() - 1000,
  });
  assert.deepEqual(binding.solvedKeys, ["1A", "2C"]);
  assert.equal(isCfSolvedStale(binding), false);
  assert.equal(isCfSolvedStale({ ...binding, solvedAt: 0 }), true);

  assert.equal(writeCfBinding("guest", binding, storage), true);
  assert.equal(readCfBinding("guest", storage).handle, "alice");
  clearCfBinding("guest", storage);
  assert.equal(readCfBinding("guest", storage), null);
});

/* ------------------------------------------------------------------ *
 * 8. OAuth 代理 / GitHub 客户端（离线，不访问 GitHub）
 * ------------------------------------------------------------------ */
group("OAuth 代理与 GitHub 客户端（离线）");

const PROXY_ENV = {
  GITHUB_CLIENT_ID: "Iv1.testclient",
  ALLOWED_ORIGINS: "https://usedchang.github.io,http://localhost:5173",
  ALLOWED_SCOPES: "read:user gist",
};

await testAsync("CORS 白名单与 * 通配符", () => {
  assert.equal(allowedOrigin("https://usedchang.github.io", PROXY_ENV), "https://usedchang.github.io");
  assert.equal(allowedOrigin("https://evil.example", PROXY_ENV), "");
  assert.equal(allowedOrigin("", PROXY_ENV), "");
  assert.equal(allowedOrigin("https://anything", { ALLOWED_ORIGINS: "*" }), "*");
});

await testAsync("OPTIONS 预检返回 204 + CORS 头", async () => {
  const res = await handleRequest(
    { method: "OPTIONS", path: "/device/code", origin: "https://usedchang.github.io" },
    PROXY_ENV
  );
  assert.equal(res.status, 204);
  assert.equal(res.headers["access-control-allow-origin"], "https://usedchang.github.io");
  assert.match(res.headers["access-control-allow-methods"], /POST/);
});

await testAsync("GET /health 不需要访问 GitHub", async () => {
  const res = await handleRequest(
    { method: "GET", path: "/health", origin: "https://usedchang.github.io" },
    PROXY_ENV
  );
  assert.equal(res.status, 200);
  assert.equal(res.body.ok, true);
  assert.equal(res.body.configured, true);
  assert.deepEqual(res.body.scopes, ["read:user", "gist"]);
});

await testAsync("Origin 不在白名单：403 且不返回 ACAO", async () => {
  const res = await handleRequest(
    { method: "POST", path: "/device/code", origin: "https://evil.example", body: {} },
    PROXY_ENV
  );
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "origin_not_allowed");
  assert.equal(res.headers["access-control-allow-origin"], undefined);
});

await testAsync("Client ID 不匹配：403，且不会把别人的 App 请求转发出去", async () => {
  const res = await handleRequest(
    {
      method: "POST",
      path: "/device/code",
      origin: "https://usedchang.github.io",
      body: { client_id: "Iv1.other", scope: "read:user gist" },
    },
    PROXY_ENV
  );
  assert.equal(res.status, 403);
  assert.equal(res.body.error, "client_id_mismatch");
});

await testAsync("代理未配置 GITHUB_CLIENT_ID：500", async () => {
  const res = await handleRequest(
    { method: "POST", path: "/device/code", origin: "http://localhost:5173", body: {} },
    { ALLOWED_ORIGINS: "*" }
  );
  assert.equal(res.status, 500);
  assert.equal(res.body.error, "proxy_not_configured");
});

await testAsync("越权 scope：400，不访问 GitHub", async () => {
  const res = await handleRequest(
    {
      method: "POST",
      path: "/device/code",
      origin: "https://usedchang.github.io",
      body: { client_id: "Iv1.testclient", scope: "repo gist" },
    },
    PROXY_ENV
  );
  assert.equal(res.status, 400);
  assert.equal(res.body.error, "scope_not_allowed");
});

await testAsync("未知路径 404；GET /device/code 405", async () => {
  const a = await handleRequest({ method: "GET", path: "/nope", origin: "" }, PROXY_ENV);
  assert.equal(a.status, 404);
  const b = await handleRequest({ method: "GET", path: "/device/code", origin: "" }, PROXY_ENV);
  assert.equal(b.status, 405);
});

test("parseScopes / gistFileContent：客户端小工具", () => {
  assert.deepEqual(parseScopes("read:user, gist"), ["read:user", "gist"]);
  assert.deepEqual(parseScopes(""), []);
  const gist = {
    files: { "a.json": { content: "hello", truncated: false } },
  };
  assert.equal(gistFileContent(gist, "a.json"), "hello");
  assert.equal(gistFileContent(gist, "b.json"), null);
  assert.equal(gistFileContent({ files: { "a.json": { content: "x", truncated: true } } }, "a.json"), null);
});

await testAsync("findCheckinGist：列表接口不含 content，必须再 GET 单个 Gist", async () => {
  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    const href = String(url);
    calls.push(href);
    const headers = { "content-type": "application/json" };
    if (href.includes("/gists?per_page=")) {
      // 真实 GitHub 的列表返回：只有元信息，没有 content
      return new Response(
        JSON.stringify([
          {
            id: "g1",
            files: {
              "xcpc-daily-checkins.json": {
                filename: "xcpc-daily-checkins.json",
                size: 5,
                raw_url: "https://gist.githubusercontent.com/.../raw",
              },
            },
          },
        ]),
        { status: 200, headers }
      );
    }
    if (href.endsWith("/gists/g1")) {
      return new Response(
        JSON.stringify({
          id: "g1",
          files: {
            "xcpc-daily-checkins.json": {
              filename: "xcpc-daily-checkins.json",
              content: '{"records":[]}',
              truncated: false,
            },
          },
        }),
        { status: 200, headers }
      );
    }
    throw new Error(`unexpected fetch: ${href}`);
  };
  try {
    const gist = await findCheckinGist("token", { fileName: "xcpc-daily-checkins.json" });
    assert.equal(calls.length, 2);
    assert.match(calls[1], /\/gists\/g1$/);
    assert.equal(gistFileContent(gist, "xcpc-daily-checkins.json"), '{"records":[]}');
  } finally {
    globalThis.fetch = originalFetch;
  }
});

/* ------------------------------------------------------------------ *
 * 汇总
 * ------------------------------------------------------------------ */
console.log("");
if (failures.length) {
  console.log(`\x1b[31m${failures.length} 项失败\x1b[0m，${passed} 项通过`);
  for (const f of failures) {
    console.log(`  - [${f.group}] ${f.name}: ${f.err.message}`);
  }
  process.exit(1);
}
console.log(`\x1b[32m全部通过\x1b[0m：${passed} 项断言`);
