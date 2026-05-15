/**
 * PR2.17 — ExamSessionTemplate (catalog ca thi) per-Organization.
 *
 * Cấu trúc: 1 trường định nghĩa sẵn N ca thi (CA-1 07:30-09:30, CA-2 10:00-12:00, ...).
 * GV tạo round mới → pick template + chọn ngày → service auto sinh ExamSession
 * với opensAt/closesAt = ngày + giờ template (xem `instantiateSessions`).
 *
 * Authz: chỉ OrgAdmin của org đó (hoặc Platform Admin) được phép CRUD.
 */
import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isOrgAdminOf } from "../auth/roles";
import { ExamError } from "../exam/types";

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const CreateSessionTemplateInput = z.object({
  code: z.string().min(1).max(32).trim(),
  name: z.string().min(1).max(200).trim(),
  startTime: z.string().regex(TIME_REGEX, "Định dạng HH:MM"),
  endTime: z.string().regex(TIME_REGEX, "Định dạng HH:MM"),
  orderIndex: z.number().int().min(0).max(9999).optional(),
});

export const UpdateSessionTemplateInput = CreateSessionTemplateInput.partial();

export interface SessionTemplateRow {
  id: string;
  organizationId: string;
  code: string;
  name: string;
  startTime: string;
  endTime: string;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
}

async function assertOrgAdmin(
  actorUserId: string,
  organizationId: string,
  db: PrismaClient,
): Promise<void> {
  const ok = await isOrgAdminOf(actorUserId, organizationId, db);
  if (!ok) throw new ExamError("forbidden");
}

export async function listSessionTemplates(
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<SessionTemplateRow[]> {
  const rows = await db.examSessionTemplate.findMany({
    where: { organizationId },
    orderBy: [{ orderIndex: "asc" }, { startTime: "asc" }],
  });
  return rows.map(toRow);
}

export async function createSessionTemplate(
  actorUserId: string,
  organizationId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<SessionTemplateRow> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  const parsed = CreateSessionTemplateInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  if (d.startTime >= d.endTime)
    throw new ExamError("validation_failed", {
      reason: "endTime_before_startTime",
    });
  try {
    const row = await db.examSessionTemplate.create({
      data: {
        organizationId,
        code: d.code.toUpperCase(),
        name: d.name,
        startTime: d.startTime,
        endTime: d.endTime,
        orderIndex: d.orderIndex ?? 0,
      },
    });
    return toRow(row);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("validation_failed", { reason: "code_taken" });
    throw e;
  }
}

export async function updateSessionTemplate(
  actorUserId: string,
  templateId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<SessionTemplateRow> {
  const existing = await db.examSessionTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  });
  if (!existing)
    throw new ExamError("validation_failed", { reason: "template_not_found" });
  await assertOrgAdmin(actorUserId, existing.organizationId, db);

  const parsed = UpdateSessionTemplateInput.safeParse(rawInput);
  if (!parsed.success)
    throw new ExamError("validation_failed", parsed.error.flatten());
  const d = parsed.data;
  if (d.startTime && d.endTime && d.startTime >= d.endTime)
    throw new ExamError("validation_failed", {
      reason: "endTime_before_startTime",
    });
  try {
    const row = await db.examSessionTemplate.update({
      where: { id: templateId },
      data: {
        ...(d.code !== undefined ? { code: d.code.toUpperCase() } : {}),
        ...(d.name !== undefined ? { name: d.name } : {}),
        ...(d.startTime !== undefined ? { startTime: d.startTime } : {}),
        ...(d.endTime !== undefined ? { endTime: d.endTime } : {}),
        ...(d.orderIndex !== undefined ? { orderIndex: d.orderIndex } : {}),
      },
    });
    return toRow(row);
  } catch (e) {
    if ((e as { code?: string }).code === "P2002")
      throw new ExamError("validation_failed", { reason: "code_taken" });
    throw e;
  }
}

export async function deleteSessionTemplate(
  actorUserId: string,
  templateId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const existing = await db.examSessionTemplate.findUnique({
    where: { id: templateId },
    select: { organizationId: true },
  });
  if (!existing)
    throw new ExamError("validation_failed", { reason: "template_not_found" });
  await assertOrgAdmin(actorUserId, existing.organizationId, db);
  await db.examSessionTemplate.delete({ where: { id: templateId } });
}

/**
 * Apply N templates × M dates → instantiate N×M ExamSession rows on `roundId`.
 * Each session's opensAt/closesAt = (date + template.startTime/endTime) parsed
 * in the round's organization timezone.
 *
 * If only 1 date, session.code = template.code. If multiple dates, append
 * "-DD-MM" suffix to disambiguate.
 *
 * Caller responsible for authz (use createExamRoundWithSessions).
 */
export async function instantiateSessionsFromTemplates(
  roundId: string,
  courseId: string,
  examId: string,
  templateIds: string[],
  dates: string[], // YYYY-MM-DD format
  timezone: string,
  db: PrismaClient,
): Promise<{ created: number }> {
  if (templateIds.length === 0 || dates.length === 0)
    return { created: 0 };
  const templates = await db.examSessionTemplate.findMany({
    where: { id: { in: templateIds } },
    orderBy: { orderIndex: "asc" },
  });
  if (templates.length === 0) return { created: 0 };

  const multiDay = dates.length > 1;
  let created = 0;
  let nextOrder = 0;
  for (const date of dates) {
    for (const t of templates) {
      const code = multiDay
        ? `${t.code}-${formatDateSuffix(date)}`
        : t.code;
      const title = multiDay ? `${t.name} (${formatDateShort(date)})` : t.name;
      const opensAt = combineDateTime(date, t.startTime, timezone);
      const closesAt = combineDateTime(date, t.endTime, timezone);
      try {
        await db.examSession.create({
          data: {
            roundId,
            examId, // service caller resolves default exam for the course
            code,
            title,
            opensAt,
            closesAt,
            // PR2.17 — Templates không quản accessMode, để default authenticated.
            // GV chỉnh sau ở session detail.
            accessMode: "authenticated",
          },
        });
        created++;
        nextOrder++;
      } catch (e) {
        // P2002 = duplicate code in round → skip
        if ((e as { code?: string }).code !== "P2002") throw e;
      }
    }
  }
  return { created };
}

function formatDateSuffix(date: string): string {
  // "2026-05-20" → "20-05"
  const [, m, d] = date.split("-");
  return `${d}-${m}`;
}

function formatDateShort(date: string): string {
  const [, m, d] = date.split("-");
  return `${d}/${m}`;
}

function combineDateTime(date: string, time: string, timezone: string): Date {
  // Combine YYYY-MM-DD + HH:MM in the given timezone → UTC Date.
  // Simple approach: build local ISO string, then offset by timezone.
  // For "Asia/Ho_Chi_Minh" (UTC+7), we just construct the ISO with +07:00.
  const offset = tzOffsetHHMM(timezone);
  return new Date(`${date}T${time}:00${offset}`);
}

function tzOffsetHHMM(timezone: string): string {
  // Minimal mapping. For Asia/Ho_Chi_Minh (no DST), always +07:00.
  // Production: use Intl.DateTimeFormat with timeZone to derive proper offset.
  if (timezone === "Asia/Ho_Chi_Minh") return "+07:00";
  // Fallback: parse current offset using Intl (handles DST).
  try {
    const now = new Date();
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      timeZoneName: "shortOffset",
    });
    const part = fmt.formatToParts(now).find((p) => p.type === "timeZoneName");
    const match = part?.value.match(/GMT([+-]\d{1,2})(?::(\d{2}))?/);
    if (match) {
      const sign = match[1]!.startsWith("-") ? "-" : "+";
      const h = Math.abs(Number.parseInt(match[1]!, 10)).toString().padStart(2, "0");
      const m = (match[2] ?? "00").padStart(2, "0");
      return `${sign}${h}:${m}`;
    }
  } catch {
    // ignore
  }
  return "+00:00";
}

function toRow(
  r: {
    id: string;
    organizationId: string;
    code: string;
    name: string;
    startTime: string;
    endTime: string;
    orderIndex: number;
    createdAt: Date;
    updatedAt: Date;
  },
): SessionTemplateRow {
  return {
    id: r.id,
    organizationId: r.organizationId,
    code: r.code,
    name: r.name,
    startTime: r.startTime,
    endTime: r.endTime,
    orderIndex: r.orderIndex,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
