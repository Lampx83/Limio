// Cập nhật slide theo dàn ý đã sửa (tiêu chí L6, H10): chỉ viết lại những slide AI sinh mà
// giảng viên chưa sửa tay; slide đã sửa tay và slide tự thêm luôn được giữ nguyên.
// Module thuần: lập kế hoạch, không đụng DB hay mô hình.

import type { OutlineSlide } from "./limioLiveOutline";

export interface ExistingSlide {
  id: string;
  type: string;
  config: Record<string, unknown>;
}

export type OrderEntry = { kind: "slide"; id: string } | { kind: "new"; outlineId: string };

export interface SyncPlan {
  /** Slide AI sinh, chưa sửa, dòng dàn ý còn → viết lại nội dung (giữ id, thứ tự theo dàn ý). */
  regenerate: Array<{ slideId: string; outlineId: string }>;
  /** Dòng dàn ý chưa có slide → tạo mới. */
  create: string[];
  /** Slide AI sinh, chưa sửa, dòng dàn ý đã bị xoá → xoá. */
  remove: string[];
  /** Slide AI sinh đã được giảng viên sửa tay, dòng dàn ý còn → giữ nguyên. */
  keep: string[];
  /** Slide đã sửa tay mà dòng dàn ý đã bị xoá, và slide giảng viên tự thêm → giữ nguyên. */
  orphans: string[];
  /** Thứ tự cuối cùng của cả bài. */
  order: OrderEntry[];
}

const meta = (s: ExistingSlide) => ({
  outlineId: typeof s.config.outlineId === "string" ? s.config.outlineId : null,
  ai: s.config.aiGenerated === true,
  edited: s.config.editedByUser === true,
});

/**
 * `slides` theo thứ tự hiện tại của bài. Thứ tự mới: các slide gắn dòng dàn ý đi theo dàn ý; slide
 * không gắn dòng nào (tự thêm, hoặc đã sửa tay mà dòng dàn ý bị xoá) ở lại ngay sau slide gắn dàn ý
 * đứng trước nó trong bài cũ (hoặc đầu bài nếu không có).
 */
export function planSync(outline: OutlineSlide[], slides: ExistingSlide[]): SyncPlan {
  const rowIds = new Set(outline.map((o) => o.id));
  const byOutline = new Map<string, ExistingSlide>();
  for (const s of slides) {
    const m = meta(s);
    if (m.outlineId && !byOutline.has(m.outlineId)) byOutline.set(m.outlineId, s);
  }

  const plan: SyncPlan = { regenerate: [], create: [], remove: [], keep: [], orphans: [], order: [] };
  const removed = new Set<string>();

  for (const o of outline) {
    const s = byOutline.get(o.id);
    if (!s) plan.create.push(o.id);
    else if (meta(s).edited || !meta(s).ai) plan.keep.push(s.id);
    else plan.regenerate.push({ slideId: s.id, outlineId: o.id });
  }
  for (const s of slides) {
    const m = meta(s);
    const linkedAndPresent = m.outlineId && rowIds.has(m.outlineId) && byOutline.get(m.outlineId) === s;
    if (linkedAndPresent) continue;
    if (m.ai && !m.edited && m.outlineId) {
      plan.remove.push(s.id);
      removed.add(s.id);
    } else plan.orphans.push(s.id);
  }

  // Neo cho slide mồ côi: dòng dàn ý của slide gắn dàn ý đứng gần nhất phía trước (bài cũ) còn tồn tại.
  const anchorOf = new Map<string, string | null>();
  let lastAnchor: string | null = null;
  for (const s of slides) {
    const m = meta(s);
    if (m.outlineId && rowIds.has(m.outlineId) && byOutline.get(m.outlineId) === s) lastAnchor = m.outlineId;
    else if (!removed.has(s.id)) anchorOf.set(s.id, lastAnchor);
  }
  const orphansAt = (anchor: string | null) =>
    slides.filter((s) => anchorOf.has(s.id) && anchorOf.get(s.id) === anchor).map((s): OrderEntry => ({ kind: "slide", id: s.id }));

  plan.order.push(...orphansAt(null));
  for (const o of outline) {
    const s = byOutline.get(o.id);
    plan.order.push(s ? { kind: "slide", id: s.id } : { kind: "new", outlineId: o.id });
    plan.order.push(...orphansAt(o.id));
  }
  return plan;
}

export function syncSummary(plan: SyncPlan): { rewrite: number; add: number; remove: number; keep: number } {
  return { rewrite: plan.regenerate.length, add: plan.create.length, remove: plan.remove.length, keep: plan.keep.length + plan.orphans.length };
}

export function syncIsNoop(plan: SyncPlan, currentOrder: string[]): boolean {
  if (plan.regenerate.length || plan.create.length || plan.remove.length) return false;
  const now = plan.order.map((e) => (e.kind === "slide" ? e.id : "new"));
  return now.length === currentOrder.length && now.every((id, i) => id === currentOrder[i]);
}
