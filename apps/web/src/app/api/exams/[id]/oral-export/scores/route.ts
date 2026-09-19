import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@feedbackme/db";
import { assertCanEditExam, CourseAuthzError, slugify } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { formatDateTime } from "@/lib/datetime";

export const runtime = "nodejs";

// A6.5 — Xuất điểm vấn đáp AI ra Excel cho cả đề, để GV lưu trữ/báo cáo
// ngoài hệ thống. Chỉ GV có quyền sửa đề mới xuất được (assertCanEditExam,
// cùng authz với trang chấm).
const STATUS_LABEL: Record<string, string> = {
  pending_review: "Chờ duyệt",
  approved: "Đã duyệt (khớp AI)",
  overridden: "Đã sửa (khác AI)",
};

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, courseId: true, createdById: true, kind: true },
  });
  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  if (exam.kind !== "oral") {
    return NextResponse.json({ error: "exam_not_oral" }, { status: 400 });
  }
  try {
    await assertCanEditExam(userId, exam);
  } catch (e) {
    if (e instanceof CourseAuthzError) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw e;
  }

  const attempts = await prisma.examAttempt.findMany({
    where: { examId: exam.id, status: { in: ["submitted", "auto_submitted", "graded"] } },
    select: {
      submittedAt: true,
      status: true,
      user: { select: { displayName: true, email: true } },
      oralEvaluation: {
        select: {
          aiSuggestedScore: true,
          instructorScore: true,
          instructorNotes: true,
          status: true,
          gradedAt: true,
        },
      },
    },
    orderBy: { submittedAt: "asc" },
  });

  const rows = attempts.map((a) => ({
    "Họ tên": a.user?.displayName ?? "",
    "Email": a.user?.email ?? "",
    "Trạng thái": a.status === "graded" ? "Đã chấm" : "Chờ chấm",
    "Điểm AI đề xuất": a.oralEvaluation?.aiSuggestedScore ?? "",
    "Điểm GV chốt": a.oralEvaluation?.instructorScore ?? "",
    "Trạng thái duyệt": STATUS_LABEL[a.oralEvaluation?.status ?? "pending_review"],
    "Nhận xét GV": a.oralEvaluation?.instructorNotes ?? "",
    "Ngày nộp": a.submittedAt ? formatDateTime(a.submittedAt) : "",
    "Ngày chấm": a.oralEvaluation?.gradedAt ? formatDateTime(a.oralEvaluation.gradedAt) : "",
  }));

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 24 },
    { wch: 28 },
    { wch: 12 },
    { wch: 16 },
    { wch: 14 },
    { wch: 18 },
    { wch: 40 },
    { wch: 18 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Điểm vấn đáp");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const dateStr = new Date().toISOString().slice(0, 10);
  const filename = `diem-van-dap_${slugify(exam.title) || "de-thi"}_${dateStr}.xlsx`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="${filename}"`,
      "content-length": String(buf.length),
    },
  });
}
