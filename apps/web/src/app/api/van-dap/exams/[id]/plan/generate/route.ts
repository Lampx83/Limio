import { NextResponse } from "next/server";
import { AiGenerationError, AiTutorError, generateVanDapPlan } from "@feedbackme/core-feedback";
import { VanDapError, getVanDapMaterialTexts, loadDraftVanDapExam, replaceVanDapPlan } from "@feedbackme/core-lms";
import { getOpenaiClient } from "@/lib/openaiClient";
import { requireVanDapUser, vanDapErrorResponse } from "@/lib/vanDapApi";

export const runtime = "nodejs";
export const maxDuration = 300;

/**
 * "Tạo dàn từ tài liệu" (AC1.3–AC1.5). Thay TOÀN BỘ dàn hiện có bằng dàn AI đề xuất — thầy/cô sửa sau.
 * Tài liệu dài sinh theo từng phần nên có thể mất vài chục giây: trả luồng NDJSON có nhịp "ping" để proxy không cắt.
 *   {"type":"start"} {"type":"ping"}* rồi {"type":"done","items":n,"parts":n} hoặc {"type":"error","error","status"}.
 * Lỗi ở bất kỳ bước nào thì dàn cũ còn nguyên (chỉ thay khi đã có dàn đầy đủ).
 */
export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireVanDapUser();
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let exam;
  let materials;
  try {
    exam = await loadDraftVanDapExam(userId, params.id);
    materials = await getVanDapMaterialTexts(userId, params.id);
  } catch (e) {
    const mapped = vanDapErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
  if (materials.length === 0) return NextResponse.json({ error: "no_materials" }, { status: 400 });

  let openai;
  try {
    openai = await getOpenaiClient();
  } catch (e) {
    if ((e as Error).message === "openai_not_configured") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (o: unknown) => controller.enqueue(enc.encode(JSON.stringify(o) + "\n"));
      const beat = setInterval(() => send({ type: "ping" }), 8000);
      const fail = (error: string, status: number, details?: unknown) => send({ type: "error", error, status, details });
      try {
        send({ type: "start" });
        let plan;
        try {
          plan = await generateVanDapPlan(
            userId,
            {
              materials: materials.map((m) => ({ title: m.title, text: m.text })),
              durationMin: exam.durationMin,
              language: exam.language,
            },
            openai,
          );
        } catch (e) {
          if (e instanceof AiTutorError) return fail(e.code, 429, e.details);
          if (e instanceof AiGenerationError) return fail(e.code, e.code === "validation_failed" ? 400 : 502, e.details);
          console.error("[van-dap plan generate]", e);
          return fail("generate_failed", 500);
        }
        const saved = await replaceVanDapPlan(userId, params.id, plan.items, { parts: plan.parts });
        send({ type: "done", items: saved.items, parts: plan.parts });
      } catch (e) {
        if (e instanceof VanDapError) return fail(e.code, e.code === "exam_locked" ? 409 : 400, e.details);
        console.error("[van-dap plan generate]", e);
        fail("generate_failed", 500);
      } finally {
        clearInterval(beat);
        controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" },
  });
}
