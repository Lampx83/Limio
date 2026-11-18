/**
 * Phần thuần của kéo-thả trong Phiếu bài tập: xếp các mảnh vào ô thứ tự (câu Sắp xếp) và đặt từ vào chỗ trống (câu Kéo thả điền).
 * Mọi thao tác (kéo, chạm-chọn rồi chạm ô, phím mũi tên, ô chọn dự phòng) đều đi qua các hàm này nên cho cùng một kết quả.
 * Dạng đáp án lưu không đổi: Sắp xếp `{order: [id…]}` (chỉ lưu khi đủ và không trùng), Kéo thả điền `{placed: {[ô]: id}}`.
 */

/** Các ô thứ tự của câu Sắp xếp: phần tử i là mảnh đang ở ô i, null là ô trống. */
export type OrderSlots = Array<string | null>;

/** Ô thứ tự từ đáp án đã lưu: mảnh không còn trong đề bị bỏ; thiếu thì để trống. */
export function slotsFromOrder(order: string[] | null | undefined, ids: string[]): OrderSlots {
  const slots: OrderSlots = ids.map(() => null);
  const valid = new Set(ids);
  let i = 0;
  for (const id of order ?? []) {
    if (valid.has(id) && !slots.includes(id) && i < slots.length) slots[i++] = id;
  }
  return slots;
}

/** Thứ tự để lưu: chỉ khi mọi ô đã có mảnh (mỗi mảnh đúng một lần); chưa đủ thì null (không lưu). */
export function orderFromSlots(slots: OrderSlots): string[] | null {
  if (slots.length === 0 || slots.some((s) => s === null)) return null;
  const ids = slots as string[];
  return new Set(ids).size === ids.length ? [...ids] : null;
}

/**
 * Đặt mảnh `id` vào ô `target`. Mảnh đang ở ô khác thì rời ô đó. Ô đích đang có mảnh khác thì mảnh đó đổi chỗ về ô cũ của `id`
 * (kéo từ ô sang ô = đổi chỗ), hoặc về khay nếu `id` đang ở khay.
 */
export function placeInSlot(slots: OrderSlots, id: string, target: number): OrderSlots {
  if (target < 0 || target >= slots.length) return slots;
  const from = slots.indexOf(id);
  if (from === target) return slots;
  const next = [...slots];
  const displaced = next[target] ?? null;
  next[target] = id;
  if (from >= 0) next[from] = displaced;
  return next;
}

/** Đưa mảnh về khay (bỏ khỏi ô). */
export function removeFromSlots(slots: OrderSlots, id: string): OrderSlots {
  return slots.map((s) => (s === id ? null : s));
}

/** Bỏ mảnh ở ô `index` về khay. */
export function clearSlot(slots: OrderSlots, index: number): OrderSlots {
  return slots.map((s, i) => (i === index ? null : s));
}

/** Dời mảnh ở ô `index` sang ô bên cạnh (mũi tên trái/phải); đổi chỗ với mảnh ở đó. Ngoài biên thì giữ nguyên. */
export function shiftSlot(slots: OrderSlots, index: number, delta: -1 | 1): OrderSlots {
  const id = slots[index];
  const to = index + delta;
  if (!id || to < 0 || to >= slots.length) return slots;
  return placeInSlot(slots, id, to);
}

/** Mảnh còn ở khay (chưa vào ô), giữ thứ tự gốc của đề. */
export function poolOf(ids: string[], slots: OrderSlots): string[] {
  const used = new Set(slots.filter((s): s is string => s !== null));
  return ids.filter((id) => !used.has(id));
}

/** Đặt từ `tokenId` vào chỗ trống `slot` của câu Kéo thả điền. Mỗi từ dùng một lần: từ đang ở chỗ trống khác thì rời chỗ đó; từ cũ ở chỗ đích quay về ngân hàng. */
export function placeToken(placed: Record<string, string>, slot: string, tokenId: string): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(placed)) if (v !== tokenId && k !== slot) next[k] = v;
  next[slot] = tokenId;
  return next;
}

/** Bỏ từ khỏi chỗ trống `slot`. */
export function clearToken(placed: Record<string, string>, slot: string): Record<string, string> {
  const next = { ...placed };
  delete next[slot];
  return next;
}
