import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { prisma } from "@feedbackme/db";
import { canEditCourse, findOrInviteUserByEmail } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

function getBaseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

interface BulkRow {
  code: string;
  instructorEmail: string | null;
  name?: string | null;
}

/**
 * PR2.14 — Bulk upsert cohorts cho 1 course. Input format:
 *   { rows: [{ code, instructorEmail?, name? }, ...] }
 * Mỗi row tạo cohort mới hoặc cập nhật cohort hiện có (match by code).
 * Email không tồn tại → skip với reason 'instructor_not_found'.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await canEditCourse(userId, params.id)))
    return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = (await readJson(req)) as { rows?: BulkRow[] } | null;
  const rows = Array.isArray(body?.rows) ? body!.rows : null;
  if (!rows || rows.length === 0)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const baseUrl = getBaseUrl();

  // Resolve course → organization once (all rows share the same course).
  const course = await prisma.course.findUnique({
    where: { id: params.id },
    select: { organizationId: true },
  });
  const organizationId = course?.organizationId ?? null;

  let created = 0;
  let updated = 0;
  let invited = 0;
  const skipped: Array<{ row: number; code: string; reason: string }> = [];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const code = (r.code ?? "").trim().toUpperCase();
    if (!code) {
      skipped.push({ row: i + 1, code: "", reason: "code_required" });
      continue;
    }
    let instructorId: string | null = null;
    if (r.instructorEmail) {
      const email = r.instructorEmail.trim().toLowerCase();
      try {
        const result = await findOrInviteUserByEmail({
          email,
          // displayName của GV — fallback dùng local-part email vì format
          // bulk hiện chưa có field tên GV (r.name là tên lớp học).
          displayName: email.split("@")[0]!,
          baseUrl,
          templateKey: "cohort.instructor_invite",
          organizationId,
        });
        instructorId = result.userId;
        if (result.invited) invited++;
      } catch (e) {
        const reason = (e as Error).message === "invalid_email"
          ? "invalid_email"
          : "invite_failed";
        skipped.push({ row: i + 1, code, reason });
        continue;
      }
    }
    const name = r.name?.trim() || code;

    try {
      // Match by (courseId, code) — unique. Upsert pattern.
      const existing = await prisma.courseSection.findFirst({
        where: { courseId: params.id, code },
        select: { id: true },
      });
      if (existing) {
        await prisma.courseSection.update({
          where: { id: existing.id },
          data: { instructorId, name },
        });
        updated++;
      } else {
        await prisma.courseSection.create({
          data: {
            courseId: params.id,
            code,
            name,
            instructorId,
          },
        });
        created++;
      }
    } catch (e) {
      skipped.push({
        row: i + 1,
        code,
        reason: (e as { code?: string }).code === "P2002" ? "name_taken" : "error",
      });
    }
  }

  return NextResponse.json({ created, updated, invited, skipped });
}
