import { NextResponse } from "next/server";
import { assertCanManageInstructors, getInstructorAssignments, removeCoInstructor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

// GET /api/courses/[id]/instructors/[userId] — việc đang giao cho người này (lớp phụ trách, buổi sắp tới, khung giờ), để hộp xác nhận gỡ nói rõ gỡ sẽ làm gì.
// Cùng quyền với gỡ: chủ khoá, OrgAdmin của tổ chức, Platform Admin.
export async function GET(
  _req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await assertCanManageInstructors(userId, params.id);
    return NextResponse.json(await getInstructorAssignments(params.id, params.userId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

// DELETE /api/courses/[id]/instructors/[userId]?handoverTo=<userId> — chủ khoá, OrgAdmin của tổ chức hoặc Platform Admin. Gỡ quyền và dọn
// việc đang giao trong một thao tác; `handoverTo` (không bắt buộc) chuyển các việc đó cho giáo viên khác của khoá, bỏ trống thì để trống chỗ người dạy.
// Không gỡ được chủ khoá qua endpoint này.
export async function DELETE(
  req: Request,
  { params }: { params: { id: string; userId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const handoverTo = new URL(req.url).searchParams.get("handoverTo");
  try {
    const r = await removeCoInstructor(userId, params.id, params.userId, { handoverToUserId: handoverTo || null });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
