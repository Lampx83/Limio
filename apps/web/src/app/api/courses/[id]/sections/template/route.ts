import { NextResponse } from "next/server";
import { generateSectionImportTemplateXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** File mẫu import lớp học (.xlsx). Nội dung tĩnh, chỉ cần đăng nhập. */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return new NextResponse(new Uint8Array(generateSectionImportTemplateXlsx()), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": 'attachment; filename="import-lop-hoc-template.xlsx"',
      "cache-control": "no-store",
    },
  });
}
