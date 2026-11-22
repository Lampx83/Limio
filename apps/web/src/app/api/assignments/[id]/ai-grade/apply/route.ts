import { NextResponse } from "next/server";
import { applyAiGradeSuggestions } from "@feedbackme/core-lms";
import { onAssignmentGraded } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { mapAiGradeBatchError } from "@/lib/aiGradeBatchApi";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IDS = 500;

/**
 * "Chốt theo gợi ý AI" cho các bài giảng viên đã chọn. Ghi điểm THẬT và nhận xét học viên sẽ đọc, nên chỉ chạy khi
 * giảng viên đã xác nhận ở giao diện. Đi qua `gradeSubmission` (cùng kiểm quyền, cùng sự kiện).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { submissionIds?: unknown } | null;
  const ids = Array.isArray(body?.submissionIds) ? body!.submissionIds.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json({ error: "validation_failed", details: "submissionIds" }, { status: 400 });
  }
  try {
    const r = await applyAiGradeSuggestions(userId, params.id, ids);
    // Giống route chấm từng bài: nếu bài tập là nhiệm vụ Tournament thì gộp điểm vào MissionSubmission.
    for (const id of r.applied) await onAssignmentGraded(id);
    return NextResponse.json(r);
  } catch (e) {
    const m = mapAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}
