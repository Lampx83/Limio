import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { assertCanEditCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Per-exam gradebook export (CSV). Used after exam closes to report điểm theo
 * danh sách thí sinh — optionally filtered to a single phòng thi.
 *
 * Query: ?roomId=<uuid|all|unassigned>  (default: all)
 *        ?format=csv  (default; json also supported for debug)
 *
 * Columns: Phòng, Giám thị, STT, Tên, Mã dự thi, Email, Mã SV, Lớp, Trạng
 *          thái, Điểm số, Điểm %, Đã nộp lúc.
 *
 * One row per ExamCandidate (assigned_code mode). For candidates with
 * multiple attempts, use the submitted one if any, else the latest.
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
    select: {
      id: true,
      title: true,
      courseId: true,
      passScore: true,
      accessMode: true,
    },
  });
  if (!exam)
    return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  await assertCanEditCourse(userId, exam.courseId);

  const url = new URL(req.url);
  const roomId = url.searchParams.get("roomId");
  const format = url.searchParams.get("format") ?? "csv";

  const candidateWhere: Record<string, unknown> = { examId: exam.id };
  if (roomId && roomId !== "all") {
    candidateWhere.roomId = roomId === "unassigned" ? null : roomId;
  }

  const candidates = await prisma.examCandidate.findMany({
    where: candidateWhere,
    select: {
      id: true,
      displayName: true,
      accessCode: true,
      metadata: true,
      room: {
        select: {
          id: true,
          name: true,
          proctor: { select: { displayName: true } },
        },
      },
      attempts: {
        orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
        select: {
          id: true,
          status: true,
          startedAt: true,
          submittedAt: true,
          score: true,
          scorePct: true,
          passed: true,
        },
      },
    },
    orderBy: [{ room: { name: "asc" } }, { displayName: "asc" }],
  });

  type GradebookRow = {
    room: string;
    proctor: string;
    index: number;
    displayName: string;
    accessCode: string;
    email: string;
    studentCode: string;
    className: string;
    status: string;
    score: string;
    scorePct: string;
    submittedAt: string;
  };

  const rows: GradebookRow[] = [];
  let idx = 0;
  for (const c of candidates) {
    idx++;
    // Latest attempt — attempts is already ordered submittedAt desc, startedAt desc,
    // so [0] is the most recent. `graded` and `submitted` are terminal states;
    // either gets surfaced as-is. For multi-attempt policies the latest wins.
    const attempt = c.attempts[0];
    const m = (c.metadata ?? {}) as Record<string, unknown>;
    const statusMap: Record<string, string> = {
      in_progress: "Đang làm",
      submitted: "Đã nộp",
      graded: "Đã chấm",
      abandoned: "Bỏ thi",
    };
    const status = attempt
      ? (statusMap[attempt.status] ?? attempt.status)
      : "Chưa vào thi";
    rows.push({
      room: c.room?.name ?? "(chưa gán)",
      proctor: c.room?.proctor.displayName ?? "",
      index: idx,
      displayName: c.displayName,
      accessCode: c.accessCode ?? "",
      email: typeof m.email === "string" ? m.email : "",
      studentCode: typeof m.studentCode === "string" ? m.studentCode : "",
      className: typeof m.class === "string" ? m.class : "",
      status,
      score: attempt?.score != null ? attempt.score.toString() : "",
      scorePct: attempt?.scorePct != null ? attempt.scorePct.toFixed(2) : "",
      submittedAt: attempt?.submittedAt
        ? new Intl.DateTimeFormat("vi-VN", {
            day: "2-digit",
            month: "2-digit",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Ho_Chi_Minh",
          }).format(attempt.submittedAt)
        : "",
    });
  }

  if (format === "json") {
    return NextResponse.json({ exam: { id: exam.id, title: exam.title }, rows });
  }

  // CSV — BOM for Excel UTF-8 compatibility.
  const headers = [
    "Phòng",
    "Giám thị",
    "STT",
    "Tên",
    "Mã dự thi",
    "Email",
    "Mã SV",
    "Lớp",
    "Trạng thái",
    "Điểm số",
    "Điểm %",
    "Đã nộp lúc",
  ];
  const lines = [headers.join(",")];
  for (const r of rows) {
    lines.push(
      [
        csv(r.room),
        csv(r.proctor),
        r.index.toString(),
        csv(r.displayName),
        csv(r.accessCode),
        csv(r.email),
        csv(r.studentCode),
        csv(r.className),
        csv(r.status),
        csv(r.score),
        csv(r.scorePct),
        csv(r.submittedAt),
      ].join(","),
    );
  }
  const body = "﻿" + lines.join("\n");
  const safeTitle = exam.title.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60);
  const suffix =
    roomId && roomId !== "all" ? `-${roomId.slice(0, 8)}` : "-all";
  return new NextResponse(body, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="gradebook-${safeTitle}${suffix}.csv"`,
    },
  });
}

function csv(s: string): string {
  if (s === "") return "";
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}
