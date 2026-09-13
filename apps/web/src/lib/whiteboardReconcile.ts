// Pure, isomorphic (client + server) — KHÔNG import prisma/db ở đây vì file
// này được "use client" component (Whiteboard.tsx) import trực tiếp.

// Excalidraw element — chỉ khai báo phần cần để reconcile, không import type
// từ @excalidraw/excalidraw ở server bundle.
export interface WhiteboardElement {
  id: string;
  version: number;
  versionNonce: number;
  updated: number;
  isDeleted?: boolean;
  [key: string]: unknown;
}

// Merge 1 batch element mới vào snapshot hiện có, mỗi element thắng theo
// `version` cao hơn (last-writer-wins per-element — không phải per-scene).
// Vì element chỉ được người tạo ra nó chỉnh sửa (xem Whiteboard ACC: không
// cho move/resize/xoá nét người khác), conflict thật sự gần như không xảy
// ra — merge này chủ yếu để cộng dồn nét mới + xử lý batch đến không theo
// đúng thứ tự khi mạng chập chờn.
export function reconcileWhiteboardElements(
  existing: WhiteboardElement[],
  incoming: WhiteboardElement[],
): WhiteboardElement[] {
  const byId = new Map<string, WhiteboardElement>();
  for (const el of existing) byId.set(el.id, el);
  for (const el of incoming) {
    const current = byId.get(el.id);
    if (!current || el.version > current.version) {
      byId.set(el.id, el);
    }
  }
  return Array.from(byId.values());
}

// Phase B — annotate tài liệu: elements map theo trang, { "0": [...], "1": [...] }.
// Bảng trắng tự do (Phase A) chỉ dùng key "0" — 1 trang ảo duy nhất, cùng
// shape với chế độ nhiều trang để API/client không phải rẽ nhánh theo mode.
export type WhiteboardSnapshot = Record<string, WhiteboardElement[]>;

export function getSnapshotPage(snapshot: WhiteboardSnapshot, page: number): WhiteboardElement[] {
  return snapshot[String(page)] ?? [];
}

// Merge batch mới vào ĐÚNG trang, giữ nguyên các trang khác — trả về map mới
// (không mutate `snapshot` đầu vào).
export function mergeSnapshotPage(
  snapshot: WhiteboardSnapshot,
  page: number,
  incoming: WhiteboardElement[],
): WhiteboardSnapshot {
  const key = String(page);
  return {
    ...snapshot,
    [key]: reconcileWhiteboardElements(snapshot[key] ?? [], incoming),
  };
}

// Xoá riêng 1 trang (giữ trang khác) — dùng cho reset trong chế độ tài liệu.
export function clearSnapshotPage(snapshot: WhiteboardSnapshot, page: number): WhiteboardSnapshot {
  return { ...snapshot, [String(page)]: [] };
}
