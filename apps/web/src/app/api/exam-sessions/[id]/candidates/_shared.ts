import { NextResponse } from "next/server";
import { candidateIssueMessage, type CandidateIssue } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

/** Chạy handler với userId đã đăng nhập; ExamError → HTTP status chuẩn. */
export async function withUser(fn: (userId: string) => Promise<unknown>) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await fn(userId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Giao diện không import core-lms (kéo theo Prisma), nên câu lỗi đi kèm từng dòng. */
export function withMessages<T extends { issue?: CandidateIssue }>(rows: T[]) {
  return rows.map((r) => (r.issue ? { ...r, message: candidateIssueMessage(r.issue) } : r));
}
