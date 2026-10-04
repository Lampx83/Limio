import { NextResponse } from "next/server";
import { endCurrentSection } from "@feedbackme/core-lms";
import { requireExamSubject } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";
import { recordStatus } from "@/lib/exam-live-bus";
import { enqueueAutoGrade } from "@/lib/queue/autoGradeJob";

export const runtime = "nodejs";

/**
 * LANG G5a — "Nộp phần này" của đề thi thử. Body tuỳ chọn { sectionId }: phần
 * máy khách đang thấy; nếu máy chủ đã sang phần khác (gửi lặp vì mất mạng) thì
 * không kết thúc luôn phần kế. Phần cuối thì nộp cả bài và xếp hàng chấm điểm.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const subject = await requireExamSubject(params.id);
  if (!subject) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req).catch(() => null)) as { sectionId?: unknown } | null;
  const expectSectionId = typeof body?.sectionId === "string" ? body.sectionId : undefined;
  try {
    const r = await endCurrentSection(subject, params.id, { expectSectionId });
    if (r.finished) {
      await recordStatus(params.id, "submitted");
      enqueueAutoGrade(params.id).catch((err) => {
        console.error(`[section/end] enqueueAutoGrade failed for ${params.id}:`, err);
      });
    }
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
