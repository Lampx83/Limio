import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { formatDateTime } from "@/lib/datetime";
import {
  assertCanEditExam,
  describeResponse,
  listExamResults,
  runAttemptWhere,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import {
  buildExamResultsWorkbook,
  contentDisposition,
  examResultsFilename,
} from "@/lib/examResultsWorkbook";

export const runtime = "nodejs";

/**
 * GET /api/exams/[id]/results
 *
 * Hai dạng file, chọn bằng `?format=`:
 *   (bỏ trống) — BẢNG ĐIỂM (.xlsx). File Excel cho giáo viên: sheet "Tổng hợp"
 *                và sheet "Theo câu". Lấy đúng danh sách của trang kết quả.
 *   analysis   — DỮ LIỆU PHÂN TÍCH (.csv). Mỗi thí sinh × mỗi câu một dòng, có
 *                phương án đã chọn, đáp án đúng, cột 0/1 và tổng điểm. Dành cho
 *                R / jMetrik / mirt để chạy CTT/IRT.
 *
 * `?sessionId=<uuid>` giới hạn vào một ca thi; `?roomId=<uuid>` vào một phòng.
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
    select: { id: true, courseId: true, createdById: true, title: true },
  });
  if (!exam)
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });

  try {
    await assertCanEditExam(userId, exam);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }

  const url = new URL(req.url);
  const sessionId = url.searchParams.get("sessionId");
  const roomId = url.searchParams.get("roomId");
  const wantsAnalysis = url.searchParams.get("format") === "analysis";

  // Câu hỏi theo thứ tự làm bài — dùng chung cho cả hai dạng file.
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

  if (!wantsAnalysis) {
    return bangDiem({ examId: exam.id, examTitle: exam.title, userId, questions, sessionId, roomId });
  }
  return duLieuPhanTich({ examId: exam.id, examTitle: exam.title, questions, sessionId });
}

/**
 * Bảng điểm (.xlsx). Dùng cùng `listExamResults` với trang kết quả để file và
 * màn hình không bao giờ lệch nhau về người, ca, phòng hay trạng thái.
 */
async function bangDiem({
  examId,
  examTitle,
  userId,
  questions,
  sessionId,
  roomId,
}: {
  examId: string;
  examTitle: string;
  userId: string;
  questions: Array<{ id: string; orderInExam: number; points: number }>;
  sessionId: string | null;
  roomId: string | null;
}) {
  const results = await listExamResults(userId, examId, {
    sessionId: sessionId ?? undefined,
    roomId: roomId ?? undefined,
  });

  const attemptIds = results.rows.flatMap((r) => (r.attemptId ? [r.attemptId] : []));
  const answers = attemptIds.length
    ? await prisma.examAnswer.findMany({
        where: { attemptId: { in: attemptIds } },
        select: {
          attemptId: true,
          questionId: true,
          autoScore: true,
          manualScore: true,
          needsGrading: true,
        },
      })
    : [];
  const byKey = new Map(answers.map((a) => [`${a.attemptId}:${a.questionId}`, a]));

  // Ô của một câu: Đúng / Sai / điểm lẻ / Chờ chấm / — (chưa có bài).
  // Thứ tự kiểm tra quan trọng: câu còn chờ chấm tay luôn ghi "Chờ chấm" dù đã
  // có điểm tự chấm một phần, vì điểm đó chưa phải điểm cuối.
  const cellFor = (
    attemptId: string | null,
    q: { id: string; points: number },
  ): string => {
    const ans = attemptId ? byKey.get(`${attemptId}:${q.id}`) : undefined;
    if (!ans) return "—";
    if (ans.needsGrading) return "Chờ chấm";
    const awarded = ans.manualScore ?? ans.autoScore;
    if (awarded == null) return "—";
    return awarded >= q.points ? "Đúng" : awarded > 0 ? `${awarded}/${q.points}` : "Sai";
  };

  const exportedAt = new Date();
  const buf = await buildExamResultsWorkbook({
    examTitle,
    sessionTitle: sessionId
      ? (results.sessions.find((s) => s.id === sessionId)?.title ?? null)
      : null,
    exportedAt,
    questions: questions.map((q) => ({ number: q.orderInExam + 1, points: q.points })),
    rows: results.rows.map((row) => ({
      row,
      cells: questions.map((q) => cellFor(row.attemptId, q)),
    })),
  });

  const name = examResultsFilename("Bảng điểm", examTitle, exportedAt, "xlsx");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": contentDisposition(name),
      "Content-Length": String(buf.length),
    },
  });
}

/**
 * Dữ liệu phân tích (.csv). Giữ dạng dài để chở được cả phương án đã chọn lẫn
 * điểm; pivot sang ma trận 0/1 cho mirt/jMetrik chỉ mất một dòng lệnh.
 */
async function duLieuPhanTich({
  examId,
  examTitle,
  questions,
  sessionId,
}: {
  examId: string;
  examTitle: string;
  questions: Array<{
    id: string;
    orderInExam: number;
    points: number;
    type: string;
    config: unknown;
  }>;
  sessionId: string | null;
}) {
  // runAttemptWhere thay cho `candidate: { sessionId }` cũ: lọc qua candidate
  // bỏ sót toàn bộ bài của học viên đã ghi danh, vì nhóm đó không có
  // ExamCandidate. Dùng chung điều kiện với bảng điểm để hai file không nói
  // hai chuyện khác nhau.
  const attempts = await prisma.examAttempt.findMany({
    where: runAttemptWhere(examId, sessionId),
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

  // Dạng DÀI: mỗi thí sinh × mỗi câu một dòng.
  //
  // `tong_diem` lặp trên mỗi dòng có chủ ý: hệ số phân biệt
  // (point-biserial) cần tương quan giữa từng câu và tổng điểm, có sẵn cột
  // này thì không phải join.
  const header = [
    "Thí sinh",
    "Mã dự thi",
    "Email",
    "Mã lượt thi",
    "Nộp lúc",
    "Tổng điểm",
    "Tổng điểm tối đa",
    "Số thứ tự câu",
    "Mã câu hỏi",
    "Loại câu",
    "Phương án đã chọn",
    "Đáp án đúng",
    "Trả lời (chữ)",
    "Đúng (1) / Sai (0)",
    "Điểm đạt được",
    "Điểm tối đa của câu",
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
  const name = examResultsFilename("Dữ liệu phân tích", examTitle, new Date(), "csv");
  return new Response("﻿" + lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": contentDisposition(name),
    },
  });
}
