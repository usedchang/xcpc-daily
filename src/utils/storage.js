/**
 * 安全拿到 localStorage。
 *
 * Safari 隐私模式下 localStorage 对象存在但 setItem 会抛，所以不只判断
 * `typeof localStorage`，而是真正探一次写入；Node / 禁用存储时返回 null。
 */
let cached;

export function safeStorage() {
  if (cached !== undefined) return cached;
  try {
    const storage = globalThis.localStorage;
    if (!storage) {
      cached = null;
      return cached;
    }
    const probe = "__xcpc_probe__";
    storage.setItem(probe, "1");
    storage.removeItem(probe);
    cached = storage;
  } catch {
    cached = null;
  }
  return cached;
}
