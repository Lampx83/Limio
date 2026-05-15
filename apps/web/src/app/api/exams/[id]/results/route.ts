import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * GET /api/exams/[id]/results
 * Returns a CSV of all graded/submitted attempts with per-question scores.
 * Instructor-only.
 */
export async function GET(
  _req: Request,
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
    select: { id: true, orderInExam: true, points: true },
  });

  // Load all graded attempts with answers
  const attempts = await prisma.examAttempt.findMany({
    where: {
      examId: exam.id,
      status: { in: ["submitted", "auto_submitted", "graded"] },
    },
    orderBy: { submittedAt: "asc" },
    select: {
      id: true,
      submittedAt: true,
      scorePct: true,
      score: true,
      passed: true,
      candidateDisplayName: true,
      user: { select: { email: true, displayName: true } },
      candidate: { select: { displayName: true, accessCode: true } },
      answers: {
        select: { questionId: true, autoScore: true, manualScore: true },
      },
    },
  });

  // Build CSV
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const qHeaders = questions.map((q) => `Câu ${q.orderInExam + 1}`);

  const header = [
    "Học sinh",
    "Email",
    "Nộp lúc",
    `Điểm (/${totalPoints})`,
    "Điểm %",
    "Kết quả",
    ...qHeaders,
  ];

  const rows = attempts.map((att) => {
    const name =
      att.user?.displayName ??
      att.candidate?.displayName ??
      att.candidateDisplayName ??
      "(ẩn danh)";
    const email = att.user?.email ?? "";
    const submittedAt = att.submittedAt
      ? att.submittedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
      : "";
    const score = att.score != null ? String(att.score) : "";
    const pct = att.scorePct != null ? `${att.scorePct.toFixed(1)}%` : "";
    const result =
      att.passed === true ? "Đạt" : att.passed === false ? "Rớt" : "Chưa chấm";

    const qCells = questions.map((q) => {
      const ans = att.answers.find((a) => a.questionId === q.id);
      if (!ans) return "—";
      const awarded = ans.manualScore ?? ans.autoScore;
      if (awarded === null || awarded === undefined) return "—";
      return awarded >= q.points ? "Đúng" : awarded > 0 ? `${awarded}/${q.points}` : "Sai";
    });

    return [name, email, submittedAt, score, pct, result, ...qCells];
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
