import { NextResponse } from "next/server";
import { suggestOrgAdminCandidates, OrgAdminError } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

/** Gợi ý user để cấp OrgAdmin khi gõ email/tên. Chỉ Platform Admin. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const q = new URL(req.url).searchParams.get("q") ?? "";
  try {
    const candidates = await suggestOrgAdminCandidates(adminId, params.id, q.slice(0, 100));
    // Không cache: danh bạ người dùng là dữ liệu cá nhân.
    return NextResponse.json({ candidates }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof OrgAdminError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
    }
    throw e;
  }
}
