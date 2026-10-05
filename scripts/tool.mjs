#!/usr/bin/env node
/**
 * 本地开发工具（Windows 下由 `xcpc.bat` 调用；其它平台直接 `node scripts/tool.mjs`）。
 *
 *   node scripts/tool.mjs            菜单
 *   node scripts/tool.mjs dev        启动开发服务器
 *   node scripts/tool.mjs check      全量检查
 *   node scripts/tool.mjs check live 全量检查 + 真实 Codeforces 题库验收
 *   node scripts/tool.mjs help       帮助
 *
 * 为什么逻辑放在 Node 而不是直接写在 .bat 里：
 *   cmd.exe 按**控制台代码页**解析 .bat，含多字节 UTF-8 中文的批处理会被从
 *   字符中间截断，轻则把注释碎片当命令执行，重则原地死循环（实测都遇到过）。
 *   所以 xcpc.bat 只保留 ASCII 的环境准备工作，中文提示全部在这里输出 ——
 *   Node 自己按 UTF-8 读写，配合 bat 里的 `chcp 65001` 显示正常。
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");

/* ------------------------------------------------------------------ *
 * 小工具
 * ------------------------------------------------------------------ */
const C = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
};
const say = (s = "") => process.stdout.write(`${s}\n`);
const rule = (ch = "=") => say(`  ${ch.repeat(60)}`);

/**
 * 跑一条命令，输出直接透传到当前终端。
 *
 * 用 shell 执行整条命令行（而不是 spawn + 参数数组）：Windows 上 npm 是
 * npm.cmd，Node 出于安全考虑不允许非 shell 模式下启动 .cmd/.bat（会抛 EINVAL），
 * 而这里的命令都是写死的常量，不存在拼接注入的问题。
 */
function run(cmdline) {
  const started = Date.now();
  const res = spawnSync(cmdline, {
    cwd: ROOT,
    stdio: "inherit",
    shell: true,
    // TEMP/TMP 由 xcpc.bat 指到 .tmp；直接跑本脚本时也补上，保持行为一致
    env: { ...process.env, TEMP: resolve(ROOT, ".tmp"), TMP: resolve(ROOT, ".tmp") },
  });
  return { code: res.status ?? 1, ms: Date.now() - started };
}

const secs = (ms) => `${(ms / 1000).toFixed(1)}s`;

/* ------------------------------------------------------------------ *
 * 环境预检
 * ------------------------------------------------------------------ */
function preflight() {
  if (!existsSync(resolve(ROOT, "node_modules", ".bin"))) {
    say();
    say(`  ${C.yellow}[*]${C.reset} 还没装依赖，正在执行 npm install ...`);
    const r = run("npm install");
    if (r.code !== 0) {
      say(`  ${C.red}[FAIL]${C.reset} npm install 失败`);
      return false;
    }
  }
  return true;
}

/* ------------------------------------------------------------------ *
 * dev / check
 * ------------------------------------------------------------------ */
function dev() {
  if (!preflight()) return 1;
  say();
  rule("-");
  say("    启动开发服务器（改代码 / 改 data 里的 json 都会热更新）");
  say("    浏览器打开下面打印的地址；按 Ctrl+C 停止");
  rule("-");
  say();
  return run("npm run dev").code;
}

/** 全量检查的各个步骤。 */
function check(live) {
  if (!preflight()) return 1;

  const steps = [
    { name: "数据校验 + 生产构建", cmd: "npm run build" },
    { name: "随机性测试（离线）", cmd: "node scripts/test-cf-random.mjs" },
  ];
  if (live) {
    steps.push({ name: "随机性测试（联网 · 真实 Codeforces 题库）", cmd: "node scripts/test-cf-random.mjs --live" });
  }

  const artifacts = [
    "dist/index.html",
    "dist/assets/index.js",
    "dist/assets/index.css",
    "dist/data/index.json",
  ];

  say();
  rule();
  say(`    全量检查开始    ${new Date().toLocaleString("zh-CN")}`);
  rule();

  let failed = 0;
  const t0 = Date.now();

  steps.forEach((step, i) => {
    say();
    say(`  ${C.bold}[${i + 1}/${steps.length}] ${step.name}${C.reset}`);
    say(`  ${C.dim}      > ${step.cmd}${C.reset}`);
    const r = run(step.cmd);
    if (r.code !== 0) {
      say(`      ${C.red}[FAIL]${C.reset} ${step.name}  ${C.dim}(${secs(r.ms)})${C.reset}`);
      failed += 1;
    } else {
      say(`      ${C.green}[OK]${C.reset}   ${step.name}  ${C.dim}(${secs(r.ms)})${C.reset}`);
    }
  });

  say();
  say(`  ${C.bold}[产物]${C.reset} 检查 dist 里的关键文件`);
  for (const rel of artifacts) {
    if (existsSync(resolve(ROOT, rel))) {
      say(`      ${C.green}[OK]${C.reset}   ${rel}`);
    } else {
      say(`      ${C.red}[FAIL]${C.reset} 缺少 ${rel}`);
      failed += 1;
    }
  }

  say();
  rule();
  if (failed) {
    say(`    ${C.red}[FAIL]${C.reset} ${failed} 个检查项未通过，详见上面的输出`);
    rule();
    say(`    耗时 ${secs(Date.now() - t0)}`);
    return 1;
  }
  say(`    ${C.green}[OK]${C.reset}   全部检查通过`);
  rule();
  say(`    耗时 ${secs(Date.now() - t0)}`);
  return 0;
}

/* ------------------------------------------------------------------ *
 * 菜单
 * ------------------------------------------------------------------ */
async function menu() {
  say();
  rule();
  say(`    ${C.bold}XCPC 每日一题 · 本地工具${C.reset}`);
  rule();
  say();
  say("    [1] 启动开发服务器        npm run dev");
  say("    [2] 全量检查              数据校验 + 构建 + 随机性测试");
  say("    [3] 全量检查（含联网）    额外跑真实 Codeforces 题库验收");
  say("    [0] 退出");
  say();

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((r) => rl.question("  输入序号后回车： ", r));
  rl.close();

  switch (answer.trim()) {
    case "1":
      return dev();
    case "2":
      return check(false);
    case "3":
      return check(true);
    case "0":
      return 0;
    default:
      say(`\n  ${C.red}[x]${C.reset} 无效输入。`);
      return 1;
  }
}

function help() {
  say();
  say(`  ${C.bold}XCPC 每日一题 · 本地工具${C.reset}`);
  say();
  say("    xcpc.bat                不带参数：弹出菜单");
  say("    xcpc.bat dev            启动开发服务器");
  say(`    xcpc.bat check          全量检查（${C.cyan}数据校验 + 构建 + 离线随机性测试${C.reset}）`);
  say("    xcpc.bat check live     全量检查 + 真实 Codeforces 题库验收（需联网）");
  say("    xcpc.bat all            等价于 check live");
  say("    xcpc.bat help           显示本帮助");
  say();
  say("    （非 Windows 环境直接把 xcpc.bat 换成 node scripts/tool.mjs）");
  say();
  say("    说明：xcpc.bat 会把 TEMP/TMP 指向仓库内的 .tmp\\，避开受限环境下");
  say("          esbuild 清不掉临时文件导致的 spawn EPERM / Access is denied。");
  return 0;
}

/* ------------------------------------------------------------------ *
 * 入口
 * ------------------------------------------------------------------ */
const [sub, extra] = process.argv.slice(2);
const mode = String(sub || "").toLowerCase();

let code;
if (!mode) code = await menu();
else if (mode === "dev") code = dev();
else if (mode === "check") code = check(String(extra || "").toLowerCase() === "live");
else if (mode === "all") code = check(true);
else if (["help", "-h", "--help"].includes(mode)) code = help();
else {
  say(`\n  ${C.red}[x]${C.reset} 未知参数：${sub}`);
  code = help();
}

process.exit(code);
