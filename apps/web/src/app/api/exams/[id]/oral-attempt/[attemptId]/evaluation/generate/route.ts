import { createOpenaiClient, getChatOnlyApiKey } from "@/lib/openaiClient";
import { NextResponse } from "next/server";
import {
  AiTutorError,
  generateOralExamEvaluation,
  openAiChatCompute,
} from "@feedbackme/core-feedback";
import { IntegrationError, getOralEvaluation } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const STATUS_BY_CODE: Record<string, number> = {
  attempt_not_found: 404,
  not_oral_exam: 409,
  attempt_not_ended: 409,
};

/** A6.4 — GV bấm "Chấm bằng AI". Sinh điểm đề xuất, KHÔNG tự chốt điểm. */
export async function POST(
  _req: Request,
  { params }: { params: { id: string; attemptId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    // Tái dùng guard sẵn có (GV sở hữu course + exam kind=oral + attempt đã
    // kết thúc) — getOralEvaluation ném đúng lỗi core-lms nếu không hợp lệ.
    await getOralEvaluation(userId, params.attemptId);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  let openaiKey: string;
  try {
    openaiKey = await getChatOnlyApiKey();
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  try {
    const openai = createOpenaiClient(openaiKey);
    const r = await generateOralExamEvaluation(userId, params.attemptId, openAiChatCompute(openai));
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof AiTutorError) {
      const details = typeof e.details === "string" ? e.details : undefined;
      const status = (details ? STATUS_BY_CODE[details] : undefined) ?? 400;
      return NextResponse.json({ error: e.code, details: e.details }, { status });
    }
    throw e;
  }
}
