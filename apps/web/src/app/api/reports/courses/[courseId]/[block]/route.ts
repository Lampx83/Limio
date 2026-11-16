/**
 * Báo cáo cho nhà xuất bản — một khối số liệu (docs/tieu-chi/bao-cao-nha-xuat-ban.md, AC2–AC7).
 * Mỗi khối một route để trang hiện dần. Chỉ trả số liệu tổng hợp, không có danh tính người học.
 */
import { NextResponse } from "next/server";
import {
  canViewCourseReport,
  getActivationReport,
  getHardestQuestions,
  getLearnerReport,
  getMasteryByLesson,
  getRemediationUptake,
  getRevenueReport,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { parseReportRange } from "@/lib/reportApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BLOCKS = ["activation", "revenue", "learners", "mastery", "questions", "remediation"] as const;
type Block = (typeof BLOCKS)[number];

export async function GET(req: Request, { params }: { params: { courseId: string; block: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(BLOCKS as readonly string[]).includes(params.block)) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  // Không phân biệt "khoá không tồn tại" với "không có quyền", để không lộ khoá của tổ chức khác.
  if (!(await canViewCourseReport(userId, params.courseId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const range = parseReportRange(url.searchParams.get("range"));
  const courseId = params.courseId;
  let data: unknown;
  switch (params.block as Block) {
    case "activation": {
      const b = url.searchParams.get("batch");
      data = await getActivationReport(courseId, {
        range,
        batchId: b === null || b === "" ? undefined : b === "loose" ? null : b,
      });
      break;
    }
    case "revenue":
      data = await getRevenueReport(courseId, { range });
      break;
    case "learners":
      data = await getLearnerReport(courseId, { range });
      break;
    case "mastery":
      data = await getMasteryByLesson(courseId);
      break;
    case "questions":
      data = await getHardestQuestions(courseId);
      break;
    case "remediation":
      data = await getRemediationUptake(courseId, { range });
      break;
  }
  return NextResponse.json(
    { generatedAt: new Date().toISOString(), data },
    { headers: { "cache-control": "private, no-store" } },
  );
}
