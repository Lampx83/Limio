import { NextResponse } from "next/server";
import { getExamSession, listRoomsForOrganizer } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Phòng của một ca + mã giám thị, cho phần bung ra ở "Tổ chức thi".
 *
 * getExamSession là hàng rào quyền: nó ném nếu người gọi không sửa được khoá
 * học. Mã giám thị mở ra danh sách người thật nên không thể để lộ rộng hơn.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await getExamSession(userId, params.id);
    const rooms = await listRoomsForOrganizer(params.id);
    return NextResponse.json({ rooms });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
