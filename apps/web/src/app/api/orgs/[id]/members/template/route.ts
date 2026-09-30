import { NextResponse } from "next/server";
import { generateMemberImportTemplateXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** File mẫu import thành viên (.xlsx). Nội dung tĩnh, chỉ cần đăng nhập. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return new NextResponse(new Uint8Array(generateMemberImportTemplateXlsx()), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="org-members-template.xlsx"',
      "cache-control": "no-store",
    },
  });
}
