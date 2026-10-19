// Lịch sử trò chuyện với trợ lý Limio, giữ trong sessionStorage để sang trang khác (hoặc tải lại) vẫn còn. Module thuần,
// không đụng React hay window: nạp lại dữ liệu từ trình duyệt luôn được coi là KHÔNG tin cậy (có thể bị sửa tay trong
// DevTools hoặc do bản cũ), nên mọi thứ đọc ra đều đi qua sanitizeStoredMessages.

export interface StoredAction {
  id: string;
  label: string;
  href: string;
  icon: string;
}

export type StoredMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; actions: StoredAction[]; followUps: string[]; fresh?: boolean };

/** Số tin tối đa giữ lại (khoảng 15 lượt hỏi đáp). */
export const MAX_STORED_MESSAGES = 30;
/** Số tin gần nhất gửi kèm làm ngữ cảnh cho mô hình. */
export const HISTORY_SENT = 6;
export const STORAGE_PREFIX = "limio.assistant.v1.";

const TEXT_MAX = 2600;
const FOLLOW_UP_MAX = 160;
const ACTIONS_MAX = 3;
const FOLLOW_UPS_MAX = 3;

export const storageKey = (userId: string) => `${STORAGE_PREFIX}${userId}`;

const str = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");

/** Đường dẫn nội bộ an toàn: bắt đầu bằng một dấu "/", không phải "//" (đổi origin) hay chứa ký tự điều khiển. */
export function isInternalHref(href: string): boolean {
  return /^\/(?!\/)[^\s\u0000-\u001f]*$/.test(href);
}

export function sanitizeStoredMessages(raw: unknown): StoredMessage[] {
  if (!Array.isArray(raw)) return [];
  const out: StoredMessage[] = [];
  for (const m of raw) {
    if (!m || typeof m !== "object") continue;
    const o = m as Record<string, unknown>;
    const text = str(o.text, TEXT_MAX).trim();
    if (!text) continue;
    if (o.role === "user") {
      out.push({ role: "user", text });
    } else if (o.role === "assistant") {
      const actions: StoredAction[] = [];
      for (const a of Array.isArray(o.actions) ? o.actions : []) {
        if (!a || typeof a !== "object") continue;
        const r = a as Record<string, unknown>;
        const href = str(r.href, 300);
        const id = str(r.id, 80);
        const label = str(r.label, 120);
        if (id && label && isInternalHref(href)) actions.push({ id, label, href, icon: str(r.icon, 30) });
        if (actions.length >= ACTIONS_MAX) break;
      }
      const followUps = (Array.isArray(o.followUps) ? o.followUps : [])
        .map((f) => str(f, FOLLOW_UP_MAX).trim())
        .filter(Boolean)
        .slice(0, FOLLOW_UPS_MAX);
      // `fresh` (đang hiện dần) không bao giờ được khôi phục: tải lại trang thì hiện luôn đầy đủ.
      out.push({ role: "assistant", text, actions, followUps });
    }
  }
  return out.slice(-MAX_STORED_MESSAGES);
}

/** Dạng ghi xuống sessionStorage: bỏ cờ `fresh`, chỉ giữ MAX_STORED_MESSAGES tin cuối. */
export function toStoredMessages<T extends StoredMessage>(messages: readonly T[]): StoredMessage[] {
  return sanitizeStoredMessages(messages);
}

export function loadHistory(storage: Pick<Storage, "getItem"> | null | undefined, userId: string): StoredMessage[] {
  try {
    const raw = storage?.getItem(storageKey(userId));
    return raw ? sanitizeStoredMessages(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveHistory(storage: Pick<Storage, "setItem" | "removeItem"> | null | undefined, userId: string, messages: readonly StoredMessage[]): void {
  try {
    if (!storage) return;
    const stored = toStoredMessages(messages);
    if (stored.length === 0) storage.removeItem(storageKey(userId));
    else storage.setItem(storageKey(userId), JSON.stringify(stored));
  } catch {
    // Chế độ riêng tư / hết dung lượng / bị chặn: trợ lý vẫn chạy, chỉ không nhớ qua trang.
  }
}
