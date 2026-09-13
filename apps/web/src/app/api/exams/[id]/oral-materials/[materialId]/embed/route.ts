import { NextResponse } from "next/server";
import OpenAI from "openai";
import { AiTutorError, embedMaterial, openAiEmbedCompute } from "@feedbackme/core-feedback";
import { IntegrationError, getIntegrationSecret, listOralMaterials } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * A6.2 — GV bấm re-embed thủ công khi lần tự động (lúc upload) thất bại
 * (thiếu OpenAI key, hết trần token…). Khác `tryEmbedMaterial` (best-effort,
 * nuốt lỗi) — route này trả lỗi thật để GV biết chính xác vì sao.
 */
export async function POST(
  _req: Request,
  { params }: { params: { id: string; materialId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  try {
    // Tái dùng guard sẵn có (GV sở hữu course + exam kind=oral) thay vì viết
    // lại authz ở đây.
    await listOralMaterials(userId, params.id);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  const material = await prisma.oralExamMaterial.findUnique({
    where: { id: params.materialId },
    select: { examId: true },
  });
  if (!material || material.examId !== params.id) {
    return NextResponse.json({ error: "material_not_found" }, { status: 404 });
  }

  let openaiKey: string;
  try {
    openaiKey = await getIntegrationSecret("openai");
  } catch (e) {
    if (e instanceof IntegrationError && e.code === "key_not_found") {
      return NextResponse.json({ error: "openai_not_configured" }, { status: 503 });
    }
    throw e;
  }

  try {
    const openai = new OpenAI({ apiKey: openaiKey });
    const r = await embedMaterial(userId, params.materialId, openAiEmbedCompute(openai));
    return NextResponse.json(r);
  } catch (e) {
    if (e instanceof AiTutorError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: e.code === "material_not_found" ? 404 : 400 },
      );
    }
    throw e;
  }
}
