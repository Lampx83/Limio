import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { formatDateTime } from "@/lib/datetime";
import {
  assertCanEditCourse,
  describeResponse,
  runAttemptWhere,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * GET /api/exams/[id]/results
 *
 * Hai dạng file, chọn bằng `?format=`:
 *   (bỏ trống) — BẢNG ĐIỂM. Mỗi thí sinh một dòng, mỗi câu một cột Đúng/Sai.
 *                Để đọc và nộp cho khoa.
 *   analysis   — DỮ LIỆU PHÂN TÍCH. Mỗi thí sinh × mỗi câu một dòng, có
 *                phương án đã chọn, đáp án đúng, cột 0/1 và tổng điểm. Nạp
 *                thẳng vào R / jMetrik / mirt để chạy CTT/IRT.
 *
 * `?sessionId=<uuid>` giới hạn vào một đợt thi.
 * Chỉ giảng viên của khoá.
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: { id: true, courseId: true, title: true },
  });
  if (!exam)
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });

  try {
    await assertCanEditCourse(userId, exam.courseId);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  // Load questions ordered by position
  const questions = await prisma.examQuestion.findMany({
    where: { examId: exam.id },
    orderBy: { orderInExam: "asc" },
    select: {
      id: true,
      orderInExam: true,
      points: true,
      type: true,
      config: true,
    },
  });

  // ?sessionId=<uuid> — xuất riêng MỘT lần thi. Không truyền thì gộp mọi lần
  // của gói đề, giữ nguyên hành vi cũ.
  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const wantsAnalysis = url.searchParams.get("format") === "analysis";

  // Load all graded attempts with answers
  // runAttemptWhere thay cho `candidate: { sessionId }` cũ: lọc qua candidate
  // bỏ sót toàn bộ bài của học viên đã ghi danh, vì nhóm đó không có
  // ExamCandidate. Dùng chung điều kiện với phân tích để hai file không bao
  // giờ nói hai chuyện khác nhau.
  const attempts = await prisma.examAttempt.findMany({
    where: runAttemptWhere(exam.id, sessionId),
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      submittedAt: true,
      scorePct: true,
      score: true,
      candidateDisplayName: true,
      user: { select: { email: true, displayName: true } },
      candidate: { select: { displayName: true, accessCode: true } },
      answers: {
        select: {
          questionId: true,
          autoScore: true,
          manualScore: true,
          answerJson: true,
        },
      },
    },
  });

  const totalPoints = questions.reduce((s, q) => s + q.points, 0);

  const subjectOf = (att: (typeof attempts)[number]) => ({
    name:
      att.user?.displayName ??
      att.candidate?.displayName ??
      att.candidateDisplayName ??
      "(ẩn danh)",
    code: att.candidate?.accessCode ?? "",
    email: att.user?.email ?? "",
  });

  if (wantsAnalysis) {
    // Dạng DÀI: mỗi thí sinh × mỗi câu một dòng.
    //
    // Chọn dạng dài thay vì ma trận rộng vì nó không mất gì: giữ được cả
    // phương án đã chọn lẫn điểm, chở được mọi loại câu hỏi, và pivot sang ma
    // trận 0/1 cho mirt/jMetrik chỉ mất một dòng lệnh. Ma trận rộng thì ngược
    // lại — đã rộng rồi thì không lấy lại được phương án nhiễu.
    //
    // `tong_diem` lặp trên mỗi dòng có chủ ý: hệ số phân biệt
    // (point-biserial) cần tương quan giữa từng câu và tổng điểm, có sẵn cột
    // này thì không phải join.
    const header = [
      "thi_sinh",
      "ma_du_thi",
      "email",
      "attempt_id",
      "nop_luc",
      "tong_diem",
      "tong_diem_toi_da",
      "cau_so",
      "cau_hoi_id",
      "loai_cau",
      "phuong_an_chon",
      "dap_an_dung",
      "tra_loi_chu",
      "dung",
      "diem",
      "diem_toi_da",
    ];

    const rows: (string | number)[][] = [];
    for (const att of attempts) {
      const who = subjectOf(att);
      const submittedAt = att.submittedAt ? formatDateTime(att.submittedAt) : "";
      for (const q of questions) {
        const ans = att.answers.find((a) => a.questionId === q.id);
        const awarded = ans ? (ans.manualScore ?? ans.autoScore) : null;
        const d = describeResponse(q.type, q.config, ans?.answerJson ?? null);
        // Ngưỡng 0/1 khớp với phần phân tích câu hỏi (analytics.ts): đạt ≥99%
        // điểm tối đa mới tính là đúng. Hai chỗ lệch nhau thì cùng một đợt ra
        // hai p-value khác nhau.
        const dung =
          awarded === null ? "" : q.points <= 0 ? (awarded > 0 ? 1 : 0) : awarded / q.points >= 0.99 ? 1 : 0;
        rows.push([
          who.name,
          who.code,
          who.email,
          att.id,
          submittedAt,
          att.score ?? "",
          totalPoints,
          q.orderInExam + 1,
          q.id,
          q.type,
          d.chosen,
          d.key,
          d.text,
          dung,
          awarded ?? "",
          q.points,
        ]);
      }
    }

    const lines = [header, ...rows].map((row) =>
      row.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(","),
    );
    const name = `${exam.title.replace(/[^a-z0-9]/gi, "_")}_phan_tich.csv`;
    return new Response("\ufeff" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}"`,
      },
    });
  }

  // Build CSV
  const qHeaders = questions.map((q) => `Câu ${q.orderInExam + 1}`);

  const header = [
    "Học sinh",
    "Email",
    "Nộp lúc",
    `Điểm (/${totalPoints})`,
    "Điểm %",
    ...qHeaders,
  ];

  const rows = attempts.map((att) => {
    const name =
      att.user?.displayName ??
      att.candidate?.displayName ??
      att.candidateDisplayName ??
      "(ẩn danh)";
    const email = att.user?.email ?? "";
    const submittedAt = att.submittedAt ? formatDateTime(att.submittedAt) : "";
    const score = att.score != null ? String(att.score) : "";
    const pct = att.scorePct != null ? `${att.scorePct.toFixed(1)}%` : "";

    const qCells = questions.map((q) => {
      const ans = att.answers.find((a) => a.questionId === q.id);
      if (!ans) return "—";
      const awarded = ans.manualScore ?? ans.autoScore;
      if (awarded === null || awarded === undefined) return "—";
      return awarded >= q.points ? "Đúng" : awarded > 0 ? `${awarded}/${q.points}` : "Sai";
    });

    return [name, email, submittedAt, score, pct, ...qCells];
  });

  const csvLines = [header, ...rows].map((row) =>
    row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","),
  );
  const csv = "﻿" + csvLines.join("\r\n"); // BOM for Excel UTF-8

  const filename = `${exam.title.replace(/[^a-z0-9]/gi, "_")}_results.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
