import { NextResponse } from "next/server";
import { assertCanEditCourse, exportBatchCodesCsv } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * GET /api/courses/[id]/access-code-batches/[batchId]/export?scope=unused|all — CSV cho nhà in.
 *
 * Mã tự nó cấp quyền vào khoá, nên: chỉ người sửa được khoá, mỗi lần xuất ghi một sự kiện (core-lms), và
 * `no-store` để proxy / trình duyệt không giữ lại bản sao danh sách mã.
 */
export async function GET(req: Request, { params }: { params: { id: string; batchId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const scope = new URL(req.url).searchParams.get("scope") === "all" ? "all" : "unused";
  try {
    await assertCanEditCourse(userId, params.id);
    const r = await exportBatchCodesCsv(params.id, params.batchId, userId, { scope });
    return new NextResponse(r.csv, {
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${r.filename}"`,
        "cache-control": "no-store",
      },
    });
  } catch (e) {
    return mapKnownError(e) ?? (() => { throw e; })();
  }
}
