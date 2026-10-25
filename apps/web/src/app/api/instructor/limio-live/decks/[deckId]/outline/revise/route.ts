import { NextResponse } from "next/server";
import { deckAccessWhere } from "@feedbackme/core-lms";
import { AiGenerationError, AiTutorError, generateLectureOutline } from "@feedbackme/core-feedback";
import { prisma } from "@feedbackme/db";
import { requireFeature } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getOpenaiClient } from "@/lib/openaiClient";
import { emitLiveEvent, LearningEventType } from "@/lib/limioLiveEvents";
import { resolveDeckLanguage } from "@/lib/limioLiveLanguageServer";
import { SELF_CHECK_TARGET, interactionTarget, quizOnly } from "@/lib/limioLiveInteractions";
import { ensureInteractions } from "@/lib/limioLiveInteractionsServer";
import {
  isFullStructure,
  isImportedRow,
  isValidMinutes,
  normalizeOutline,
  outlineWarnings,
  resolveSourceKind,
  sanitizeOutline,
  sanitizeRefs,
  slideRange,
} from "@/lib/limioLiveOutline";
import { carryOutlineIds, checkInstruction, reviseRange, toRevisionInput } from "@/lib/limioLiveOutlineRevise";

export const runtime = "nodejs";
// Một lần gọi mô hình có thể mất vài chục giây.
export const maxDuration = 120;

/**
 * POST /api/instructor/limio-live/decks/[deckId]/outline/revise
 * Body: { mode: "revise" | "restart", instruction?: string, outline?: Outline, minutes?: 15|30|45|90 }
 * - "revise": AI chỉnh `outline` (dàn ý đang hiện trên trình duyệt, kể cả phần sửa tay chưa kịp lưu) theo `instruction` (5–1.000 ký tự, bắt buộc).
 * - "restart": soạn lại từ văn bản nguồn đã lưu theo đúng đường tạo ban đầu; `instruction` (nếu có) thay yêu cầu ban đầu của bài.
 * KHÔNG ghi gì vào bài: trả dàn ý mới để trình duyệt áp vào và tự lưu như mọi chỉnh sửa (có Quay lại bản trước). Phần chậm trả luồng NDJSON có nhịp giữ
 * kết nối: {"type":"start"}, {"type":"ping"}*, rồi {"type":"done","outline","warnings"} hoặc {"type":"error","error","status"}.
 * Docs: docs/tieu-chi/dan-y-chinh-bang-ai.md (R3–R11).
 */
export async function POST(req: Request, { params }: { params: { deckId: string } }) {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await readJson(req)) as { mode?: unknown; instruction?: unknown; outline?: unknown; minutes?: unknown } | null;
  const mode = body?.mode;
  if (mode !== "revise" && mode !== "restart") return NextResponse.json({ error: "validation_failed", details: "mode" }, { status: 400 });

  const deck = await prisma.liveDeck.findFirst({
    where: { id: params.deckId, ...deckAccessWhere(userId) },
    select: { id: true, outline: true, outlineMinutes: true, sourceText: true, sourceKind: true, sourceRefs: true, sourceIntent: true, lesson: { select: { id: true } } },
  });
  if (!deck || !deck.outline) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const sourceText = (deck.sourceText ?? "").trim();
  if (!sourceText) return NextResponse.json({ error: "no_source" }, { status: 422 });
  const stored = sanitizeOutline(deck.outline);
  // Bài nhập từ PowerPoint giữ nguyên slide gốc: AI không được viết lại chúng.
  if (stored.slides.some(isImportedRow)) return NextResponse.json({ error: "imported_deck" }, { status: 409 });

  const raw = typeof body?.instruction === "string" ? body.instruction : "";
  let instruction: string | null = null;
  if (mode === "revise" || raw.trim()) {
    const c = checkInstruction(raw);
    if (!c.ok) return NextResponse.json({ error: "validation_failed", details: `instruction_${c.reason}` }, { status: 400 });
    instruction = c.text;
  }

  const current = mode === "revise" ? sanitizeOutline(body?.outline) : stored;
  if (mode === "revise" && current.slides.length === 0) return NextResponse.json({ error: "validation_failed", details: "outline" }, { status: 400 });
  const minutes = isValidMinutes(body?.minutes) ? body.minutes : deck.outlineMinutes ?? 30;

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    throw e;
  }

  const kind = resolveSourceKind(deck.sourceKind);
  const refs = deck.sourceRefs === null ? [] : sanitizeRefs(deck.sourceRefs);
  const language = await resolveDeckLanguage(deck.id);
  const intent = instruction ?? deck.sourceIntent ?? null;
  // Bài giảng gắn với bài học: mức slide riêng, chỉ trắc nghiệm tự kiểm tra (nghe-giang-slide.md, AC3).
  const selfCheck = !!deck.lesson;
  const range = mode === "revise" ? reviseRange(minutes, selfCheck) : slideRange(minutes, selfCheck);
  const target = selfCheck ? SELF_CHECK_TARGET : interactionTarget(minutes);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      const fail = (error: string, status: number, details?: unknown) => send({ type: "error", error, status, details });
      try {
        send({ type: "start" });
        let rawOutline;
        try {
          rawOutline = await generateLectureOutline(
            userId,
            {
              sourceText,
              sourceKind: kind,
              minutes,
              minSlides: range.min,
              maxSlides: range.max,
              structure: isFullStructure(minutes) ? "full" : "compact",
              language,
              minInteractions: target.min,
              minInteractionKinds: target.kinds,
              ...(minutes >= 90 ? { contentParts: [4, 6] as [number, number] } : {}),
              ...(mode === "revise" ? { revision: { instruction: instruction!, current: toRevisionInput(current) } } : intent ? { intent } : {}),
            },
            openai,
          );
        } catch (e) {
          if (e instanceof AiTutorError) return fail(e.code, 429, e.details);
          if (e instanceof AiGenerationError) return fail(e.code, e.code === "validation_failed" ? 400 : 502, e.details);
          console.error("[Limio-Live outline revise]", e);
          return fail("generate_failed", 500);
        }

        const normalized = normalizeOutline(rawOutline, minutes, { sourceKind: kind, sourceText, references: refs, lang: language, selfCheck });
        if (normalized.outline.slides.length === 0) return fail("empty_outline", 502);

        // Lời dặn có thể kéo lại bình chọn hay đám mây từ: bài của bài học luôn đổi chúng về trắc nghiệm.
        let outline = selfCheck ? quizOnly(normalized.outline) : normalized.outline;
        let warnings = normalized.warnings;
        // Soạn lại từ đầu đi đúng đường tạo ban đầu, kể cả bổ sung tương tác. Chỉnh theo lời dặn thì KHÔNG: lời dặn có thể chủ ý bớt tương tác.
        if (mode === "restart") {
          const top = await ensureInteractions(userId, outline, minutes, { sourceText, sourceKind: kind, intent }, openai, { selfCheck });
          outline = top.outline;
          warnings = [...warnings, ...outlineWarnings(outline, minutes, { sourceKind: kind, sourceText, selfCheck }).filter((w) => !warnings.includes(w)), ...(top.warning ? [top.warning] : [])];
        }
        // Giữ id slide trùng slide cũ để "Cập nhật slide theo dàn ý" không xoá-tạo lại cả bài (R6).
        outline = carryOutlineIds(current, outline);

        await emitLiveEvent(userId, LearningEventType.LiveDeckOutlineRevised, {
          deckId: deck.id,
          mode,
          slideCountBefore: current.slides.length,
          slideCountAfter: outline.slides.length,
          instructionChars: instruction?.length ?? 0,
          warningCount: warnings.length,
        });
        send({ type: "done", outline, warnings });
      } catch (e) {
        console.error("[Limio-Live outline revise]", e);
        fail("generate_failed", 500);
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
