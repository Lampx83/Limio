import { NextResponse } from "next/server";
import { suggestOrgMemberCandidates, OrgMemberError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Gợi ý user để thêm vào trường khi gõ email/tên. Phạm vi thấy được phụ thuộc vai trò, xem `suggestOrgMemberCandidates`. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const candidates = await suggestOrgMemberCandidates(userId, params.id, q.slice(0, 100));
    // Không cache: đây là dữ liệu cá nhân, đổi theo từng lần thêm/gỡ.
    return NextResponse.json({ candidates }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
    }
    throw e;
  }
}
