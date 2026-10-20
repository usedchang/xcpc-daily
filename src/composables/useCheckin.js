import { computed, reactive, ref, watch } from "vue";
import { CHECKIN } from "../config/checkin.js";
import { safeStorage } from "../utils/storage.js";
import { useGithubAuth, updateSession, expireSession } from "./useGithubAuth.js";
import {
  createCheckinGist,
  createGist,
  findCheckinGist,
  findOwnGistByFileName,
  gistFileContent,
  updateCheckinGist,
  updateGistFile,
} from "../auth/github.js";
import {
  buildCalendar,
  computeStats,
  createEmptyDoc,
  docHasData,
  docSignature,
  makeRecord,
  mergeDocs,
  parseDoc,
  serializeDoc,
  sortRecordsDesc,
  validateCheckin,
} from "../data/checkin-core.js";
import {
  buildLeaderboardSnapshot,
  inactiveSnapshotText,
  snapshotText,
} from "../data/leaderboard-core.js";
import { todayInBeijing } from "../utils/date.js";

/**
 * 打卡状态（模块级单例）。
 *
 * 数据流：
 *   表单 → records（响应式）→ localStorage（立刻）
 *                          ↘ Gist（1.2s 防抖；失败保留本机，可手动重试）
 *
 * 登录 / 退出都只切「账号命名空间」，不会清掉任何记录：
 *   - 未登录：xcpc-checkins-v1:guest
 *   - 已登录：xcpc-checkins-v1:<github login>
 * 登录时把 guest 的记录并进账号（并清空 guest），退出后 guest 是空的。
 *
 * Gist 不是「云端覆盖本机」：每次先拉云端、按 id 合并（见 checkin-core 的
 * mergeDocs），再把合并结果写回去。两台设备各自离线打卡，联网后都不会丢。
 */

const KEY_PREFIX = "xcpc-checkins-v1:";
const GUEST_ACCOUNT = "guest";
/** Gist 单文件上限 1 MB，留一点余量给 JSON 外壳。 */
const MAX_GIST_BYTES = 900_000;

const records = ref([]);
const deleted = ref({});
const account = ref(GUEST_ACCOUNT);
const ready = ref(false);
const selectedDate = ref("");
const formOpen = ref(false);
const formSeed = ref(null);
const notice = ref("");
const noticeKind = ref("ok");
const storageError = ref("");

const sync = reactive({
  state: "local", // local | syncing | pending | saving | saved | empty | error
  message: "",
  at: 0,
  gistId: "",
});

const leaderboard = reactive({
  // off | idle | saving | saved | error
  state: "off",
  message: "",
  at: 0,
});

let auth = null;
let initialized = false;
let todayGetter = () => todayInBeijing();

let login = "";
let token = "";
let currentGistId = "";
let allowSave = false;
let initialPullDone = false;
let loadSeq = 0;
let pullPromise = null;
let saveTimer = 0;
let saveInFlight = false;
let dirty = false;
let lastSavedSignature = "";
let noticeTimer = 0;
let snapshotTimer = 0;
let snapshotInFlight = false;
let snapshotDirty = false;
/** 每次开关/切号都 +1：旧快照请求晚回来时不能把新状态覆盖回去。 */
let leaderboardEpoch = 0;

const today = computed(() => {
  const value = todayGetter();
  return value || todayInBeijing();
});

const calendar = computed(() => buildCalendar(records.value, today.value, CHECKIN.calendarWeeks));
const stats = computed(() => computeStats(records.value, today.value));
const sortedRecords = computed(() => sortRecordsDesc(records.value));
const visibleRecords = computed(() =>
  selectedDate.value
    ? sortedRecords.value.filter((r) => r.date === selectedDate.value)
    : sortedRecords.value
);
const hasRecords = computed(() => records.value.length > 0);
const viewer = computed(() => auth?.viewer?.value || null);
const leaderboardPublic = computed(() => Boolean(auth?.session?.value?.leaderboardPublic));
const leaderboardGistId = computed(() => String(auth?.session?.value?.leaderboardGistId || ""));

function keyFor(name) {
  return `${KEY_PREFIX}${name || GUEST_ACCOUNT}`;
}

function readDoc(name) {
  const store = safeStorage();
  if (!store) return createEmptyDoc();
  const key = keyFor(name);
  let raw = "";
  try {
    raw = store.getItem(key) || "";
  } catch {
    return createEmptyDoc();
  }
  if (!raw) return createEmptyDoc();
  try {
    return parseDoc(raw);
  } catch (err) {
    // 数据坏了先别覆盖：原样备份一份，方便用户自己捞回来。
    // 备份后把坏数据从主 key 移走，否则每次打开都会再备份一遍、把存储撑满。
    try {
      store.setItem(`${key}:broken:${Date.now()}`, raw);
      store.removeItem(key);
    } catch {
      // 备份/删除失败也不影响主流程
    }
    storageError.value = `本机打卡数据损坏（${err.message}），已备份到 localStorage 后从空记录开始`;
    return createEmptyDoc();
  }
}

function writeDoc(name, doc) {
  const store = safeStorage();
  if (!store) {
    storageError.value = "浏览器禁用了 localStorage，刷新后本机记录可能丢失";
    return false;
  }
  try {
    store.setItem(keyFor(name), JSON.stringify(doc));
    storageError.value = "";
    return true;
  } catch {
    storageError.value = "本机存储空间不足，记录可能没有写进 localStorage";
    return false;
  }
}

function persistLocal() {
  return writeDoc(account.value, {
    version: 1,
    updatedAt: Date.now(),
    records: records.value,
    deleted: deleted.value,
  });
}

function setNotice(message, kind = "ok") {
  notice.value = message;
  noticeKind.value = kind;
  window.clearTimeout(noticeTimer);
  if (message) {
    noticeTimer = window.setTimeout(() => {
      notice.value = "";
    }, 5000);
  }
}

function setSync(state, message = "", at = sync.at) {
  sync.state = state;
  sync.message = message;
  sync.at = at;
}

function setLeaderboardState(state, message = "", at = leaderboard.at) {
  leaderboard.state = state;
  leaderboard.message = message;
  leaderboard.at = at;
}

function errorMessage(err) {
  if (err?.status === 401) return "GitHub 登录已失效，请重新登录";
  return String(err?.message || err || "同步失败");
}

/**
 * 切入某个账号：先读本机，立即可用；再异步拉 Gist 合并。
 * 所有异步回来都要核对 loadSeq，防止「切号之后旧请求把新账号的数据覆盖了」。
 */
function switchAccount(nextLogin, nextToken) {
  loadSeq += 1;
  const seq = loadSeq;

  window.clearTimeout(saveTimer);
  saveTimer = 0;
  window.clearTimeout(snapshotTimer);
  snapshotTimer = 0;
  leaderboardEpoch += 1;
  saveInFlight = false;
  snapshotInFlight = false;
  snapshotDirty = false;
  dirty = false;
  pullPromise = null;
  currentGistId = "";
  lastSavedSignature = "";
  allowSave = false;
  initialPullDone = false;
  sync.at = 0;

  login = nextLogin || "";
  token = nextToken || "";
  account.value = login ? login.toLowerCase() : GUEST_ACCOUNT;
  selectedDate.value = "";
  formOpen.value = false;
  formSeed.value = null;

  const local = readDoc(account.value);
  records.value = local.records;
  deleted.value = local.deleted;
  ready.value = true;

  if (!login || !token) {
    initialPullDone = true;
    allowSave = false;
    setSync("local", CHECKIN.allowGuest ? "记录只保存在这个浏览器，登录后会同步到 Gist" : "请先登录");
    sync.gistId = "";
    setLeaderboardState("off", "");
    return;
  }

  setLeaderboardState(
    auth?.session?.value?.leaderboardPublic ? "idle" : "off",
    auth?.session?.value?.leaderboardPublic ? "登录后更新公开快照…" : ""
  );

  // 游客记录并入账号：只做一次（做完清空 guest），所以退出后再随便打卡也不会被反复导入。
  const guestDoc = readDoc(GUEST_ACCOUNT);
  if (docHasData(guestDoc)) {
    const merged = mergeDocs({ records: records.value, deleted: deleted.value }, guestDoc);
    records.value = merged.records;
    deleted.value = merged.deleted;
    persistLocal();
    writeDoc(GUEST_ACCOUNT, createEmptyDoc());
    if (guestDoc.records.length) {
      setNotice(`已把本机的 ${guestDoc.records.length} 条体验记录并入当前账号`);
    }
  }

  setSync("syncing", "正在读取云端记录…");
  sync.gistId = "";
  void pullFromGist(seq);
}

/** 拉云端 → 合并 → 写回本机；只有云端确实缺数据时才回写 Gist。 */
async function pullFromGist(seq = loadSeq) {
  if (!login || !token) return;
  if (pullPromise) return pullPromise;

  pullPromise = (async () => {
    try {
      const gist = await findCheckinGist(token, {
        gistId: auth?.session?.value?.gistId || currentGistId,
        fileName: CHECKIN.gistFileName,
      });
      if (seq !== loadSeq) return;

      if (!gist) {
        initialPullDone = true;
        allowSave = true;
        sync.gistId = "";
        if (hasRecords.value) {
          setSync("pending", "云端还没有记录，正在创建私有 Gist…");
          scheduleSave(true);
        } else {
          setSync("empty", "还没有云端记录，第一次打卡会自动创建私有 Gist");
        }
        scheduleLeaderboardSnapshot();
        return;
      }

      const content = gistFileContent(gist, CHECKIN.gistFileName);
      if (content == null) {
        throw new Error("Gist 里的打卡文件为空或超过 1 MB，无法读取");
      }

      const remote = parseDoc(content);
      const merged = mergeDocs({ records: records.value, deleted: deleted.value }, remote);
      if (seq !== loadSeq) return;

      records.value = merged.records;
      deleted.value = merged.deleted;
      persistLocal();

      currentGistId = String(gist.id || "");
      sync.gistId = currentGistId;
      if (gist.id) updateSession({ gistId: currentGistId });

      const changed = docSignature(merged) !== docSignature(remote);
      initialPullDone = true;
      allowSave = true;
      lastSavedSignature = changed ? "" : docSignature(remote);

      if (changed || dirty) {
        setSync("pending", "本机有云端没有的记录，正在写回…");
        scheduleSave(true);
      } else {
        setSync("saved", "已与云端同步", Date.now());
      }
      scheduleLeaderboardSnapshot();
    } catch (err) {
      if (seq !== loadSeq) return;
      initialPullDone = true;
      allowSave = false;
      setSync("error", errorMessage(err));
      if (leaderboardPublic.value) {
        setLeaderboardState("error", "云端记录读取失败，公开快照暂未更新");
      }
      if (err?.status === 401) expireSession();
    } finally {
      // 切号后旧请求可能才回来：别把新账号正在进行的 pullPromise 清掉
      if (seq === loadSeq) pullPromise = null;
    }
  })();

  return pullPromise;
}

/**
 * 1.2 秒防抖写 Gist：连续删除/补录几条只发一次请求。
 * 首次登录的「拉取」还没完成时只记 dirty，不抢跑（否则会在云端已有 Gist 时又建一个）。
 */
function scheduleSave(immediate = false) {
  dirty = true;
  if (!login || !token) {
    setSync("local", "记录只保存在这个浏览器，登录后会同步到 Gist");
    return;
  }
  if (!initialPullDone) {
    setSync("syncing", "正在读取云端记录，稍后写入…");
    return;
  }
  if (!allowSave) {
    setSync("error", sync.message || "云端同步不可用，记录已保存在本机");
    return;
  }

  setSync("pending", "等待写入私有 Gist…");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void flushSave();
  }, immediate ? 30 : 1200);
}

async function flushSave(force = false) {
  if (!login || !token || !allowSave) return;
  if (saveInFlight || (!dirty && !force)) return;

  const seq = loadSeq;
  const loginAtStart = login;
  const doc = {
    version: 1,
    updatedAt: Date.now(),
    records: records.value,
    deleted: deleted.value,
  };
  const signature = docSignature(doc);
  const payload = serializeDoc(doc);

  // 按 UTF-8 字节数算：中文一个字 3 字节，用 length（UTF-16 码元）会低估三倍
  const bytes = new TextEncoder().encode(payload).length;
  if (bytes > MAX_GIST_BYTES) {
    dirty = true;
    setSync("error", "打卡记录超过 Gist 的单文件上限（1 MB），请删除一些旧记录或缩短完整题解");
    return;
  }

  if (currentGistId && signature === lastSavedSignature) {
    dirty = false;
    setSync("saved", "已与云端同步", sync.at || Date.now());
    return;
  }

  saveInFlight = true;
  dirty = false;
  setSync("saving", "正在写入私有 Gist…");

  try {
    let gist;
    if (!currentGistId) {
      gist = await createCheckinGist(token, {
        fileName: CHECKIN.gistFileName,
        description: CHECKIN.gistDescription,
        content: payload,
      });
      currentGistId = String(gist?.id || "");
      if (!currentGistId) throw new Error("GitHub 没有返回 Gist id，创建云端记录失败");
      if (seq === loadSeq && login === loginAtStart) {
        sync.gistId = currentGistId;
        updateSession({ gistId: currentGistId });
      }
    } else {
      try {
        gist = await updateCheckinGist(token, currentGistId, {
          fileName: CHECKIN.gistFileName,
          content: payload,
        });
      } catch (err) {
        // Gist 被删了：重新建一个，而不是让同步永远卡在 404
        if (err?.status !== 404) throw err;
        currentGistId = "";
        sync.gistId = "";
        gist = await createCheckinGist(token, {
          fileName: CHECKIN.gistFileName,
          description: CHECKIN.gistDescription,
          content: payload,
        });
        currentGistId = String(gist?.id || "");
        if (!currentGistId) throw new Error("GitHub 没有返回 Gist id，创建云端记录失败");
        if (seq === loadSeq && login === loginAtStart) {
          sync.gistId = currentGistId;
          updateSession({ gistId: currentGistId });
        }
      }
    }

    if (seq !== loadSeq || login !== loginAtStart) return;
    lastSavedSignature = signature;
    setSync("saved", "已同步到私有 Gist", Date.now());
  } catch (err) {
    if (seq !== loadSeq) return;
    dirty = true;
    setSync("error", errorMessage(err));
    if (err?.status === 401) expireSession();
    if (err?.status === 403) allowSave = false; // 没有 gist 权限，重试也不会成功
  } finally {
    if (seq === loadSeq) {
      // 旧账号的请求晚回来时不能碰新账号的 in-flight 标记
      saveInFlight = false;
      if (dirty && sync.state !== "error") scheduleSave(true);
    }
  }
}

/**
 * 更新公开排行榜快照（只含统计数字）。
 *
 * 快照 Gist 是 public 的，但内容只有：
 *   login / currentStreak / activeDays / total / last30Days / updatedAt
 * 题目、题解、提交链接都留在私有 Gist，不进快照。
 */
async function syncLeaderboardSnapshot() {
  if (!CHECKIN.leaderboard.enabled || !leaderboardPublic.value || !login || !token) {
    return false;
  }
  if (!initialPullDone) {
    setLeaderboardState("idle", "正在读取云端记录，稍后更新公开快照");
    return false;
  }
  if (snapshotInFlight) {
    snapshotDirty = true;
    return false;
  }

  const seq = loadSeq;
  const loginAtStart = login;
  const epoch = leaderboardEpoch;
  snapshotInFlight = true;
  setLeaderboardState("saving", "正在更新排行榜公开快照…");

  try {
    const snapshot = buildLeaderboardSnapshot({
      login,
      records: records.value,
      today: today.value,
    });
    if (!snapshot) throw new Error("无法生成排行榜快照");

    const content = snapshotText(snapshot);
    const fileName = CHECKIN.leaderboard.snapshotFile;
    const description = CHECKIN.leaderboard.snapshotDescription;
    let gistId = String(auth?.session?.value?.leaderboardGistId || "");

    if (gistId) {
      try {
        await updateGistFile(token, gistId, { fileName, content, description });
      } catch (err) {
        if (err?.status !== 404) throw err;
        gistId = "";
      }
    }

    // 换设备 / 快照 Gist 被删：按文件名找回已有的公开快照，避免重复创建
    if (!gistId) {
      const existing = await findOwnGistByFileName(token, fileName, { publicOnly: true });
      if (existing?.id) {
        gistId = String(existing.id);
        await updateGistFile(token, gistId, { fileName, content, description });
      } else {
        const created = await createGist(token, {
          fileName,
          description,
          content,
          public: true,
        });
        gistId = String(created?.id || "");
        if (!gistId) throw new Error("GitHub 没有返回快照 Gist id");
      }
    }

    if (seq !== loadSeq || login !== loginAtStart || epoch !== leaderboardEpoch) return false;
    updateSession({ leaderboardPublic: true, leaderboardGistId: gistId });
    setLeaderboardState("saved", "公开快照已更新", Date.now());
    return true;
  } catch (err) {
    if (seq !== loadSeq || epoch !== leaderboardEpoch) return false;
    setLeaderboardState("error", errorMessage(err));
    return false;
  } finally {
    if (seq === loadSeq && epoch === leaderboardEpoch) {
      snapshotInFlight = false;
      if (snapshotDirty) {
        snapshotDirty = false;
        scheduleLeaderboardSnapshot(true);
      }
    }
  }
}

function scheduleLeaderboardSnapshot(immediate = false) {
  if (!CHECKIN.leaderboard.enabled || !leaderboardPublic.value || !login || !token) return;
  // 首次登录的私有数据还没拉完：先别把不完整的统计发布出去
  if (!initialPullDone) return;

  window.clearTimeout(snapshotTimer);
  snapshotTimer = window.setTimeout(() => {
    void syncLeaderboardSnapshot();
  }, immediate ? 80 : 1500);
}

/**
 * 打开 / 关闭「公开到排行榜」。
 * 打开时立即生成公开快照；关闭时删除公开 Gist（失败也先把本机状态关掉）。
 */
async function setLeaderboardPublic(enabled) {
  if (!login || !token) {
    return { ok: false, error: "请先登录 GitHub" };
  }
  if (Boolean(enabled) === leaderboardPublic.value) return { ok: true };

  if (enabled && !initialPullDone) {
    return { ok: false, error: "正在读取云端记录，请稍后再开启排行榜" };
  }

  leaderboardEpoch += 1;
  snapshotDirty = false;

  if (!enabled) {
    const oldId = leaderboardGistId.value;
    snapshotInFlight = false;
    snapshotDirty = false;
    updateSession({ leaderboardPublic: false, leaderboardGistId: "" });
    window.clearTimeout(snapshotTimer);
    setLeaderboardState("off", "已停止公开排行榜统计");
    if (oldId && token) {
      try {
        // 不直接删 Gist：登记 Issue 还指着它，删掉会让排行榜出现「加载失败」。
        // 改成 inactive 快照，排行榜直接忽略；用户之后仍可到 GitHub 手动删除。
        await updateGistFile(token, oldId, {
          fileName: CHECKIN.leaderboard.snapshotFile,
          content: inactiveSnapshotText(login),
          description: CHECKIN.leaderboard.snapshotDescription,
        });
      } catch (err) {
        if (err?.status !== 404) {
          setNotice("已停止公开；公开快照失效标记未写入，请稍后重试或手动删除", "error");
          return { ok: true, warning: errorMessage(err) };
        }
      }
    }
    setNotice("已从排行榜下架，公开快照已置为失效");
    window.dispatchEvent(new CustomEvent("xcpc-leaderboard:refresh"));
    return { ok: true };
  }

  updateSession({ leaderboardPublic: true });
  setLeaderboardState("saving", "正在创建公开快照…");
  const ok = await syncLeaderboardSnapshot();
  if (!ok) {
    // 创建/更新失败就恢复关闭状态，避免 UI 显示「已公开」但云端其实没更新。
    // 错误显示在 publishError；状态回到 off，用户重新打开开关即可重试。
    updateSession({ leaderboardPublic: false, leaderboardGistId: "" });
    setLeaderboardState("off", "");
    setNotice("公开到排行榜失败，请重试", "error");
    return { ok: false, error: leaderboard.message || "公开快照创建失败" };
  }
  setNotice("已公开排行榜统计（只有数字，不含题解）");
  window.dispatchEvent(new CustomEvent("xcpc-leaderboard:refresh"));
  return { ok: true };
}

/** 手动「重新同步」：拉一次云端再写回；错误状态下先恢复 allowSave。 */
async function syncNow() {
  if (!login || !token) return;
  if (!allowSave || sync.state === "error") {
    await pullFromGist();
  }
  if (allowSave) {
    dirty = true;
    await flushSave(true);
  }
}

/**
 * 新增一条打卡。返回 `{ ok, record?, errors?, error? }`，表单据此显示字段错误。
 */
function addCheckin(input) {
  const todayValue = today.value;
  const errors = validateCheckin(input, todayValue);
  if (Object.keys(errors).length) return { ok: false, errors };

  if (!login && !CHECKIN.allowGuest) {
    return { ok: false, error: "请先用 GitHub 登录再打卡" };
  }

  const now = Date.now();
  const record = makeRecord({ ...input, date: String(input.date).trim() }, now);
  if (!record) return { ok: false, errors: { date: "日期不合法，请重新选择" } };

  // 连点两次提交按钮 / 刷新后又提交一遍：一分钟内完全相同的记录只收一条
  const duplicate = records.value.some(
    (r) =>
      r.date === record.date &&
      r.title === record.title &&
      r.submission === record.submission &&
      Math.abs(r.createdAt - now) < 60_000
  );
  if (duplicate) return { ok: false, error: "刚刚已经记过一条相同的提交了" };

  records.value = [...records.value, record];
  persistLocal();
  scheduleSave();
  scheduleLeaderboardSnapshot();
  formOpen.value = false;
  formSeed.value = null;
  selectedDate.value = "";
  setNotice(
    login
      ? `已打卡 ${record.date}，正在同步…`
      : `已记录 ${record.date}（仅保存在本机，登录后会并入账号）`
  );

  return { ok: true, record };
}

function removeCheckin(id) {
  const target = records.value.find((r) => r.id === id);
  if (!target) return false;
  // 墓碑必须比记录本身新；系统时钟回拨时靠 max 兜住，否则删除会被合并逻辑判成旧操作
  deleted.value = { ...deleted.value, [id]: Math.max(Date.now(), target.updatedAt + 1) };
  records.value = records.value.filter((r) => r.id !== id);
  persistLocal();
  scheduleSave();
  scheduleLeaderboardSnapshot();
  setNotice(`已删除 ${target.date} 的一条记录`);
  return true;
}

function openForm(seed = {}) {
  formSeed.value = { ...seed };
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  formSeed.value = null;
}

function selectDate(date) {
  selectedDate.value = selectedDate.value === date ? "" : date;
}

function clearSelectedDate() {
  selectedDate.value = "";
}

function onVisibilityChange() {
  if (document.visibilityState === "hidden" && dirty) {
    void flushSave(true);
  }
}

/** 断网时记录只落本机；网络恢复后自动补一次，不必让用户手动点「重试」。 */
function onOnline() {
  if (login && token && sync.state === "error") {
    void syncNow();
  }
  if (leaderboardPublic.value && leaderboard.state === "error") {
    void syncLeaderboardSnapshot();
  }
}

function onStorage(event) {
  if (!event?.key || event.key !== keyFor(account.value)) return;
  const incoming = readDoc(account.value);
  const merged = mergeDocs({ records: records.value, deleted: deleted.value }, incoming);
  records.value = merged.records;
  deleted.value = merged.deleted;
  setNotice("另一个标签页更新了打卡记录");
}

function init() {
  if (initialized) return;
  initialized = true;

  // 先按当前登录态装载一次。不能只依赖 watch 的 immediate：
  // 首次回调里 nextLogin / nextToken 与模块初始值（同为 ""）相等，
  // 会被「值没变」的判断挡掉，游客记录就永远读不进来。
  const initial = auth.session.value;
  switchAccount(initial?.login || "", initial?.token || "");

  watch(
    [() => auth.session.value?.login || "", () => auth.session.value?.token || ""],
    ([nextLogin, nextToken]) => {
      if (nextLogin === login && nextToken === token) return;
      switchAccount(nextLogin, nextToken);
    }
  );

  document.addEventListener("visibilitychange", onVisibilityChange);
  window.addEventListener("storage", onStorage);
  window.addEventListener("online", onOnline);
}

/**
 * 在 CheckinPanel 里调用一次。getToday 传一个返回北京日期字符串的函数，
 * 这样与 App.vue 的「今日题目」共用同一个跨天刷新节拍。
 */
export function useCheckin(getToday) {
  if (typeof getToday === "function") todayGetter = getToday;
  auth = useGithubAuth();
  init();

  return {
    records,
    today,
    ready,
    selectedDate,
    formOpen,
    formSeed,
    notice,
    noticeKind,
    storageError,
    sync,
    viewer,
    leaderboard,
    leaderboardPublic,
    leaderboardGistId,
    setLeaderboardPublic,
    syncLeaderboardSnapshot,
    isLoggedIn: computed(() => Boolean(viewer.value)),
    calendar,
    stats,
    todayCount: computed(() => stats.value.todayCount),
    hasRecords,
    sortedRecords,
    visibleRecords,
    addCheckin,
    removeCheckin,
    openForm,
    closeForm,
    selectDate,
    clearSelectedDate,
    syncNow,
    setNotice,
  };
}
