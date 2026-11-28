import { NextResponse } from "next/server";
import { applyOralAiSuggestions } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { recordStatus } from "@/lib/exam-live-bus";
import { mapOralAiGradeBatchError } from "@/lib/oralAiGradeBatchApi";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_IDS = 500;

/**
 * "Chốt theo đề xuất AI" cho các lượt giảng viên đã chọn. Ghi điểm THẬT và ghi chú sinh viên sẽ đọc, nên chỉ chạy khi
 * giảng viên đã xác nhận ở giao diện. Đi qua `submitOralEvaluation` (cùng kiểm quyền, cùng sự kiện).
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { attemptIds?: unknown } | null;
  const ids = Array.isArray(body?.attemptIds) ? body!.attemptIds.filter((x): x is string => typeof x === "string") : [];
  if (ids.length === 0 || ids.length > MAX_IDS) {
    return NextResponse.json({ error: "validation_failed", details: "attemptIds" }, { status: 400 });
  }
  try {
    const r = await applyOralAiSuggestions(userId, params.id, ids);
    // Giống route chốt từng lượt — best effort, dashboard giám thị thường không còn mở.
    for (const id of r.applied) await recordStatus(id, "graded").catch(() => undefined);
    return NextResponse.json(r);
  } catch (e) {
    const m = mapOralAiGradeBatchError(e);
    if (m) return m;
    throw e;
  }
}
