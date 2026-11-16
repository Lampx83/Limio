/** CSV đối soát doanh thu (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC3). Không có tên, email hay id người mua. */
import { NextResponse } from "next/server";
import { canViewCourseReport, exportRevenueCsv, recordReportExported } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: { courseId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canViewCourseReport(userId, params.courseId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { csv, filename } = await exportRevenueCsv(params.courseId);
  await recordReportExported(userId, params.courseId, "revenue_csv");
  return new NextResponse(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "no-store",
    },
  });
}
