// Bổ sung slide tương tác phía máy chủ (docs/tieu-chi/tao-bai-giang-mot-o.md, M17–M18): dàn ý còn thiếu mức tối thiểu thì
// gọi AI một lần nhỏ rồi chèn đúng luật. Lỗi AI không bao giờ làm hỏng việc tạo bài: giữ dàn ý như cũ, kèm cảnh báo.
import type OpenAI from "openai";
import { generateInteractionTopUp, type LectureSourceKind } from "@feedbackme/core-feedback";
import { capWhiteboards, insertInteractions, interactionGap, topUpSummary } from "./limioLiveInteractions";
import type { Outline } from "./limioLiveOutline";

export const TOPUP_FAILED_WARNING = "Chưa bổ sung được slide tương tác tự động; thầy/cô có thể thêm ở dàn ý.";

export async function ensureInteractions(
  userId: string,
  outlineIn: Outline,
  minutes: number,
  ctx: { sourceText: string; sourceKind?: LectureSourceKind; intent?: string | null },
  openai: OpenAI | null,
): Promise<{ outline: Outline; added: number; warning: string | null }> {
  const outline = capWhiteboards(outlineIn);
  const gap = interactionGap(outline, minutes);
  if (gap.need <= 0) return { outline, added: 0, warning: null };
  if (!openai) return { outline, added: 0, warning: TOPUP_FAILED_WARNING };
  try {
    const rows = await generateInteractionTopUp(
      userId,
      {
        sourceText: ctx.sourceText,
        sourceKind: ctx.sourceKind,
        intent: ctx.intent ?? undefined,
        outline: topUpSummary(outline),
        need: gap.need,
        needKinds: gap.needKinds,
        existingKinds: gap.kinds,
        whiteboardUsed: gap.kinds.includes("whiteboard"),
      },
      openai,
    );
    const r = insertInteractions(outline, rows);
    return { outline: r.outline, added: r.added, warning: r.added < gap.need ? TOPUP_FAILED_WARNING : null };
  } catch (e) {
    console.error("[Limio-Live interaction top-up]", e);
    return { outline, added: 0, warning: TOPUP_FAILED_WARNING };
  }
}
