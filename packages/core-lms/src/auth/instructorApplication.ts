import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { grantRole } from "./roles";
import { logAudit } from "./audit";
import { sendTemplatedEmail } from "../email/templates";

// Đơn xin làm giáo viên. Người nộp vào hệ thống như học viên trong lúc chờ; admin
// duyệt thì mới được cấp role instructor. Mọi thay đổi role đều đi qua grantRole
// (đã có AuditLog), còn quyết định duyệt/từ chối ghi thêm một dòng audit riêng.

export const InstructorApplicationInput = z.object({
  institution: z.string().trim().min(1).max(200),
  subject: z.string().trim().min(1).max(200),
  motivation: z.string().trim().max(2000).optional().or(z.literal("")),
  verificationUrl: z
    .string()
    .trim()
    .max(500)
    .url()
    .refine((u) => /^https?:\/\//i.test(u), "http(s) only")
    .optional()
    .or(z.literal("")),
});
export type InstructorApplicationInput = z.infer<typeof InstructorApplicationInput>;

export class InstructorApplicationError extends Error {
  constructor(
    public readonly code:
      | "validation_failed"
      | "already_pending"
      | "already_instructor"
      | "not_found"
      | "already_reviewed"
      | "reason_required",
  ) {
    super(code);
  }
}

type Db = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

/** Dùng trong registerUser (cùng transaction) hoặc gọi riêng cho tài khoản đã có. */
export async function createInstructorApplication(
  userId: string,
  rawInput: unknown,
  db: Db = prisma,
) {
  const parsed = InstructorApplicationInput.safeParse(rawInput);
  if (!parsed.success) throw new InstructorApplicationError("validation_failed");
  const input = parsed.data;

  const pending = await db.instructorApplication.findFirst({
    where: { userId, status: "pending" },
    select: { id: true },
  });
  if (pending) throw new InstructorApplicationError("already_pending");

  const alreadyInstructor = await db.userRole.findFirst({
    where: { userId, role: { name: RoleName.Instructor }, courseId: null },
    select: { id: true },
  });
  if (alreadyInstructor) throw new InstructorApplicationError("already_instructor");

  return db.instructorApplication.create({
    data: {
      userId,
      institution: input.institution,
      subject: input.subject,
      motivation: input.motivation || null,
      verificationUrl: input.verificationUrl || null,
    },
  });
}

export async function listInstructorApplications(
  status: "pending" | "approved" | "rejected" | "all" = "pending",
  db: PrismaClient = prisma,
) {
  return db.instructorApplication.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
    include: {
      user: { select: { id: true, email: true, displayName: true, emailVerifiedAt: true } },
      reviewer: { select: { id: true, displayName: true } },
    },
    take: 200,
  });
}

export async function countPendingInstructorApplications(db: PrismaClient = prisma) {
  return db.instructorApplication.count({ where: { status: "pending" } });
}

/** Trạng thái đơn mới nhất của một người — để hiển thị "đang chờ duyệt" cho chính họ. */
export async function getLatestInstructorApplication(userId: string, db: PrismaClient = prisma) {
  return db.instructorApplication.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });
}

/**
 * Duyệt: đổi trạng thái có điều kiện (chỉ khi còn pending) để bấm lặp lại hay hai admin
 * cùng duyệt không gửi email hai lần. Email lỗi không làm hỏng việc duyệt.
 */
export async function approveInstructorApplication(
  adminId: string,
  applicationId: string,
  baseUrl: string,
  db: PrismaClient = prisma,
) {
  const claimed = await db.instructorApplication.updateMany({
    where: { id: applicationId, status: "pending" },
    data: { status: "approved", reviewedByUserId: adminId, reviewedAt: new Date() },
  });
  if (claimed.count === 0) {
    const exists = await db.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    throw new InstructorApplicationError(exists ? "already_reviewed" : "not_found");
  }

  const app = await db.instructorApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });

  await grantRole(adminId, { targetUserId: app.userId, roleName: RoleName.Instructor }, db);
  await logAudit(
    {
      action: "instructor_application.approved",
      actorUserId: adminId,
      targetUserId: app.userId,
      payload: { applicationId: app.id, institution: app.institution, subject: app.subject },
    },
    db,
  );

  const mail = await sendTemplatedEmail({
    key: "instructor.application_approved",
    to: app.user.email,
    organizationId: null,
    variables: {
      displayName: app.user.displayName,
      dashboardUrl: `${baseUrl.replace(/\/$/, "")}/instructor/dashboard`,
    },
  }).catch(() => null);

  return { application: app, emailSent: !!mail && (mail.delivered || mail.loggedOnly) };
}

export async function rejectInstructorApplication(
  adminId: string,
  applicationId: string,
  reason: string,
  db: PrismaClient = prisma,
) {
  const trimmed = reason.trim();
  if (!trimmed) throw new InstructorApplicationError("reason_required");

  const claimed = await db.instructorApplication.updateMany({
    where: { id: applicationId, status: "pending" },
    data: {
      status: "rejected",
      reviewedByUserId: adminId,
      reviewedAt: new Date(),
      rejectionReason: trimmed,
    },
  });
  if (claimed.count === 0) {
    const exists = await db.instructorApplication.findUnique({
      where: { id: applicationId },
      select: { id: true },
    });
    throw new InstructorApplicationError(exists ? "already_reviewed" : "not_found");
  }

  const app = await db.instructorApplication.findUniqueOrThrow({
    where: { id: applicationId },
    include: { user: { select: { id: true, email: true, displayName: true } } },
  });

  await logAudit(
    {
      action: "instructor_application.rejected",
      actorUserId: adminId,
      targetUserId: app.userId,
      payload: { applicationId: app.id, reason: trimmed },
    },
    db,
  );

  const mail = await sendTemplatedEmail({
    key: "instructor.application_rejected",
    to: app.user.email,
    organizationId: null,
    variables: { displayName: app.user.displayName, reason: trimmed },
  }).catch(() => null);

  return { application: app, emailSent: !!mail && (mail.delivered || mail.loggedOnly) };
}
