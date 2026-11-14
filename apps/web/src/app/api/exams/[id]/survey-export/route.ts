import { NextResponse } from "next/server";
import { loadSurveyExport, recordSurveyExport } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { contentDisposition, examResultsFilename } from "@/lib/examResultsWorkbook";
import { buildSurveyExportWorkbook } from "@/lib/surveyExportWorkbook";

export const runtime = "nodejs";

/**
 * GET /api/exams/[id]/survey-export — "Câu trả lời khảo sát" (.xlsx) của một đề
 * Khảo sát (docs/tieu-chi/de-thi-khao-sat.md AC7). Chỉ người sửa được đề.
 *
 * `?sessionId=<uuid>` giới hạn vào một ca; `?phase=pre|post` vào một lần đo.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId") || null;
  const rawPhase = url.searchParams.get("phase");
  const phase = rawPhase === "pre" || rawPhase === "post" ? rawPhase : null;

  try {
    const data = await loadSurveyExport(userId, params.id, { sessionId, phase });
    const buf = await buildSurveyExportWorkbook(data);
    await recordSurveyExport(userId, params.id, data.rows.length, { sessionId, phase });
    const name = examResultsFilename("Câu trả lời khảo sát", data.examTitle, new Date(), "xlsx");
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": contentDisposition(name),
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
