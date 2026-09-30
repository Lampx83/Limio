/**
 * Kỳ học của Organization (xem model AcademicTerm + quy ước tuần ở
 * packages/shared-types/src/academicTerm.ts). Chỉ OrgAdmin của chính trường
 * đó hoặc Platform Admin được sửa; mọi thành viên trường chỉ đọc (qua
 * getOrgCalendarContext) để hiện nhãn "Tuần N/M" trên lịch.
 */
import { prisma, type PrismaClient } from "@feedbackme/db";
import {
  ACADEMIC_TERM_MAX_WEEKS,
  isDayKey,
  termsOverlap,
  type AcademicTermLike,
} from "@feedbackme/shared-types";
import { isOrgAdminOf } from "../auth/roles";

export class AcademicTermError extends Error {
  constructor(
    public readonly code:
      | "forbidden"
      | "not_found"
      | "invalid_name"
      | "invalid_start_date"
      | "invalid_week_count"
      | "overlaps_existing_term",
    /** Với overlaps_existing_term: tên kỳ đang chiếm những tuần đó, để báo cho người nhập. */
    public readonly details?: { conflictingTermName: string },
  ) {
    super(code);
  }
}

export interface AcademicTermInput {
  name: string;
  /** `YYYY-MM-DD` */
  startDate: string;
  weekCount: number;
}

const NAME_MAX = 100;

// `startDate` là cột DATE: Prisma trả về Date lúc 00:00 UTC của đúng ngày lịch đó,
// nên cắt ISO lấy đúng khoá ngày — không đi qua múi giờ nào.
function toLike(row: { id: string; name: string; startDate: Date; weekCount: number }): AcademicTermLike {
  return {
    id: row.id,
    name: row.name,
    startDate: row.startDate.toISOString().slice(0, 10),
    weekCount: row.weekCount,
  };
}

async function assertOrgAdmin(actorUserId: string, organizationId: string, db: PrismaClient): Promise<void> {
  if (!(await isOrgAdminOf(actorUserId, organizationId, db))) {
    throw new AcademicTermError("forbidden");
  }
}

function validate(input: AcademicTermInput): AcademicTermInput {
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name || name.length > NAME_MAX) throw new AcademicTermError("invalid_name");
  if (!isDayKey(input.startDate)) throw new AcademicTermError("invalid_start_date");
  if (
    !Number.isInteger(input.weekCount) ||
    input.weekCount < 1 ||
    input.weekCount > ACADEMIC_TERM_MAX_WEEKS
  ) {
    throw new AcademicTermError("invalid_week_count");
  }
  return { name, startDate: input.startDate, weekCount: input.weekCount };
}

/** Không kiểm quyền — caller đã xác định user được xem trường này. Sắp theo ngày bắt đầu. */
export async function listAcademicTerms(
  organizationId: string,
  db: PrismaClient = prisma,
): Promise<AcademicTermLike[]> {
  const rows = await db.academicTerm.findMany({
    where: { organizationId },
    orderBy: { startDate: "asc" },
    select: { id: true, name: true, startDate: true, weekCount: true },
  });
  return rows.map(toLike);
}

async function assertNoOverlap(
  organizationId: string,
  input: AcademicTermInput,
  db: PrismaClient,
  ignoreTermId?: string,
): Promise<void> {
  const others = await listAcademicTerms(organizationId, db);
  const clash = others.find((t) => t.id !== ignoreTermId && termsOverlap(t, input));
  if (clash) throw new AcademicTermError("overlaps_existing_term", { conflictingTermName: clash.name });
}

export async function createAcademicTerm(
  actorUserId: string,
  organizationId: string,
  input: AcademicTermInput,
  db: PrismaClient = prisma,
): Promise<AcademicTermLike> {
  await assertOrgAdmin(actorUserId, organizationId, db);
  const data = validate(input);
  const org = await db.organization.findUnique({ where: { id: organizationId }, select: { id: true } });
  if (!org) throw new AcademicTermError("not_found");
  await assertNoOverlap(organizationId, data, db);
  const row = await db.academicTerm.create({
    data: {
      organizationId,
      name: data.name,
      startDate: new Date(`${data.startDate}T00:00:00.000Z`),
      weekCount: data.weekCount,
    },
    select: { id: true, name: true, startDate: true, weekCount: true },
  });
  return toLike(row);
}

export async function updateAcademicTerm(
  actorUserId: string,
  termId: string,
  input: AcademicTermInput,
  db: PrismaClient = prisma,
): Promise<AcademicTermLike> {
  const existing = await db.academicTerm.findUnique({
    where: { id: termId },
    select: { organizationId: true },
  });
  if (!existing) throw new AcademicTermError("not_found");
  await assertOrgAdmin(actorUserId, existing.organizationId, db);
  const data = validate(input);
  await assertNoOverlap(existing.organizationId, data, db, termId);
  const row = await db.academicTerm.update({
    where: { id: termId },
    data: {
      name: data.name,
      startDate: new Date(`${data.startDate}T00:00:00.000Z`),
      weekCount: data.weekCount,
    },
    select: { id: true, name: true, startDate: true, weekCount: true },
  });
  return toLike(row);
}

export async function deleteAcademicTerm(
  actorUserId: string,
  termId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const existing = await db.academicTerm.findUnique({
    where: { id: termId },
    select: { organizationId: true },
  });
  if (!existing) throw new AcademicTermError("not_found");
  await assertOrgAdmin(actorUserId, existing.organizationId, db);
  await db.academicTerm.delete({ where: { id: termId } });
}

export interface OrgCalendarContext {
  /** null = tài khoản không thuộc trường nào → lịch trơn, không nhãn kỳ học. */
  organization: { id: string; name: string } | null;
  terms: AcademicTermLike[];
}

/** Trường + các kỳ học của chính user, để dựng nhãn trên lịch. */
export async function getOrgCalendarContext(
  userId: string,
  db: PrismaClient = prisma,
): Promise<OrgCalendarContext> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { organization: { select: { id: true, name: true } } },
  });
  const organization = user?.organization ?? null;
  if (!organization) return { organization: null, terms: [] };
  return { organization, terms: await listAcademicTerms(organization.id, db) };
}
