import { NextResponse } from "next/server";
import { importVanDapFromLegacyExam } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

/**
 * Nhập từ đề vấn đáp cũ: tạo một đề Limio Vấn đáp MỚI (nháp). Đề cũ không đổi.
 * Cố ý không phụ thuộc công tắc "Tắt vấn đáp AI bản cũ" — nhập là đọc đề cũ, phải còn dùng được sau khi tắt.
 * Body: { legacyExamId }
 */
export function POST(req: Request) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as { legacyExamId?: unknown } | null;
    if (typeof body?.legacyExamId !== "string") {
      return NextResponse.json({ error: "validation_failed", details: "legacyExamId" }, { status: 400 });
    }
    return NextResponse.json(await importVanDapFromLegacyExam(userId, body.legacyExamId), { status: 201 });
  });
}
