import { randomBytes } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { isUserEnrolled } from "../learning/enroll";
import { getCourseProgress } from "../learning/progress";

/**
 * A6 — Certification.
 *
 * Cấp 1 chứng nhận / user / course, ngay khi khoá học đạt 100% hoàn thành.
 * Tên học viên + tên khoá được snapshot lúc cấp (không đọc lại User/Course
 * mỗi lần hiển thị) — đổi tên sau đó không được phép sửa lại chứng nhận đã
 * cấp, đúng như một bản in giấy thật.
 *
 * certNumber ngẫu nhiên, không suy ra được từ userId/courseId — nếu mã theo
 * kiểu `courseId-userId` thì ai biết courseId có thể dò ra chứng nhận của
 * người khác bằng cách thử userId.
 */

export class CertificationError extends Error {
  constructor(
    public readonly code: "not_enrolled" | "not_completed" | "not_found",
  ) {
    super(code);
  }
}

function randomCertNumber(): string {
  return `FBM-${randomBytes(6).toString("hex").toUpperCase()}`;
}

async function generateUniqueCertNumber(db: PrismaClient): Promise<string> {
  for (;;) {
    const candidate = randomCertNumber();
    const taken = await db.certificate.findUnique({
      where: { certNumber: candidate },
      select: { id: true },
    });
    if (!taken) return candidate;
  }
}

/**
 * Idempotent: gọi nhiều lần cho cùng (userId, courseId) chỉ tạo 1 hàng.
 * Throws nếu chưa enroll hoặc chưa hoàn thành 100% — caller (route hoàn
 * thành bài học) chỉ nên gọi khi đã biết `courseCompleted = true`, nhưng hàm
 * tự kiểm tra lại vì đây cũng là entrypoint của trang xem chứng nhận.
 */
export async function issueCertificate(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
) {
  const existing = await db.certificate.findUnique({
    where: { userId_courseId: { userId, courseId } },
  });
  if (existing) return existing;

  if (!(await isUserEnrolled(userId, courseId, db))) {
    throw new CertificationError("not_enrolled");
  }
  const progress = await getCourseProgress(userId, courseId, db);
  if (progress.courseCompletionPct < 100) {
    throw new CertificationError("not_completed");
  }

  const [user, course] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } }),
    db.course.findUniqueOrThrow({
      where: { id: courseId },
      select: { title: true, organization: { select: { name: true, brandingLogoUrl: true } } },
    }),
  ]);

  const certNumber = await generateUniqueCertNumber(db);
  const issuerName = course.organization ? `Limio × ${course.organization.name}` : "Limio Learning";
  const issuerLogoUrl = course.organization?.brandingLogoUrl ?? null;

  try {
    const certificate = await db.certificate.create({
      data: {
        userId,
        courseId,
        certNumber,
        userNameSnapshot: user.displayName,
        courseTitleSnapshot: course.title,
        issuerName,
        issuerLogoUrl,
      },
    });
    await emitEvent(
      userId,
      LearningEventType.CertificateIssued,
      { certificateId: certificate.id, courseId, certNumber },
      { courseId, eventKey: `certificate.issued:${userId}:${courseId}` },
      db,
    );
    return certificate;
  } catch (e) {
    // Hai request cùng lúc (vd double-click "Xem chứng nhận") → request sau
    // đụng unique(userId, courseId).
    if ((e as { code?: string }).code === "P2002") {
      return db.certificate.findUniqueOrThrow({
        where: { userId_courseId: { userId, courseId } },
      });
    }
    throw e;
  }
}

export async function getCertificateForUser(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
) {
  return db.certificate.findUnique({ where: { userId_courseId: { userId, courseId } } });
}

/** Trang public /verify/[certNumber] — không đòi hỏi đăng nhập. */
export async function getCertificateByNumber(certNumber: string, db: PrismaClient = prisma) {
  return db.certificate.findUnique({ where: { certNumber } });
}
