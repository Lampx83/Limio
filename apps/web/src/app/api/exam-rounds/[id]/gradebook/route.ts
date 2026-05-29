import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { formatDateTime } from "@/lib/datetime";
import { canEditExamRound } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Round-level gradebook export (CSV).
 *
 * Covers all candidates across every session → room in the round. One row per
 * ExamCandidate. For candidates with multiple attempts, the latest submitted
 * one wins; if none is submitted yet, the latest in-progress attempt is shown.
 *
 * Columns: Đợt thi, Ca thi, Phòng, Giám thị, STT, Tên, Mã dự thi,
 *          Email, Mã SV, Lớp, Trạng thái, Điểm số, Điểm %, Đã nộp lúc.
 *
 * Query: ?sessionId=<uuid>  (optional — restrict to one session)
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const round = await prisma.examRound.findUnique({
    where: { id: params.id },
    select: { id: true, title: true, code: true },
  });
  if (!round)
    return NextResponse.json({ error: "round_not_found" }, { status: 404 });

  if (!(await canEditExamRound(userId, params.id)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const sessionIdFilter = url.searchParams.get("sessionId");

  // Single query: candidates → room → session → round, with latest attempt.
  const candidates = await prisma.examCandidate.findMany({
    where: {
      room: {
        session: {
          roundId: params.id,
          ...(sessionIdFilter ? { id: sessionIdFilter } : {}),
        },
      },
    },
    select: {
      id: true,
      displayName: true,
      accessCode: true,
      metadata: true,
      room: {
        select: {
          name: true,
          proctor: { select: { displayName: true } },
          session: {
            select: {
              id: true,
              title: true,
              code: true,
            },
          },
        },
      },
      attempts: {
        orderBy: [{ submittedAt: "desc" }, { startedAt: "desc" }],
        take: 1,
        select: {
          status: true,
          submittedAt: true,
          score: true,
          scorePct: true,
          passed: true,
        },
      },
    },
    orderBy: [
      { room: { session: { code: "asc" } } },
      { room: { name: "asc" } },
      { displayName: "asc" },
    ],
  });

  const statusMap: Record<string, string> = {
    in_progress: "Đang làm",
    submitted: "Đã nộp",
    auto_submitted: "Hết giờ (tự nộp)",
    graded: "Đã chấm",
    abandoned: "Bỏ thi",
    flagged: "Đang xem xét",
  };

  const headers = [
    "Ca thi",
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
    "Đạt",
    "Đã nộp lúc",
  ];

  const lines = [headers.join(",")];
  let idx = 0;
  for (const c of candidates) {
    idx++;
    const attempt = c.attempts[0] ?? null;
    const m = (c.metadata ?? {}) as Record<string, unknown>;
    const session = c.room?.session;
    const sessionLabel = session
      ? `${session.code ?? ""} ${session.title ?? ""}`.trim()
      : "";

    lines.push(
      [
        csv(sessionLabel),
        csv(c.room?.name ?? "(chưa gán)"),
        csv(c.room?.proctor.displayName ?? ""),
        idx.toString(),
        csv(c.displayName),
        csv(c.accessCode ?? ""),
        csv(typeof m.email === "string" ? m.email : ""),
        csv(typeof m.studentCode === "string" ? m.studentCode : ""),
        csv(typeof m.class === "string" ? m.class : ""),
        csv(attempt ? (statusMap[attempt.status] ?? attempt.status) : "Chưa vào thi"),
        attempt?.score != null ? attempt.score.toString() : "",
        attempt?.scorePct != null ? attempt.scorePct.toFixed(2) : "",
        attempt?.passed === true ? "Đạt" : attempt?.passed === false ? "Chưa đạt" : "",
        attempt?.submittedAt ? formatDateTime(attempt.submittedAt) : "",
      ].join(","),
    );
  }

  const body = "﻿" + lines.join("\n");
  const safeTitle = round.title.replace(/[^a-zA-Z0-9-_]+/g, "_").slice(0, 60);
  const suffix = sessionIdFilter ? `-${sessionIdFilter.slice(0, 8)}` : "-all";
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
