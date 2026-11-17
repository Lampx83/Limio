import { randomBytes } from "node:crypto";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../learning/events";
import { isUserEnrolled } from "../learning/enroll";
import { getCourseProgress } from "../learning/progress";

/**
 * A6 — Certification.
 *
 * Cấp 1 chứng nhận / user / course, ngay khi học viên hoàn thành đủ
 * `course.certificateMinCompletionPct` % bài học (mặc định 100; MICRO4ASIA 90).
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

/** Đủ điều kiện nhận chứng nhận khi % bài đã hoàn thành ≥ ngưỡng của khoá. */
export function meetsCertificateThreshold(completionPct: number, minCompletionPct: number): boolean {
  return completionPct >= minCompletionPct;
}

export interface CertificateEligibility {
  completionPct: number;
  minCompletionPct: number;
  eligible: boolean;
}

export async function getCertificateEligibility(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
): Promise<CertificateEligibility> {
  const [progress, course] = await Promise.all([
    getCourseProgress(userId, courseId, db),
    db.course.findUniqueOrThrow({ where: { id: courseId }, select: { certificateMinCompletionPct: true } }),
  ]);
  return {
    completionPct: progress.courseCompletionPct,
    minCompletionPct: course.certificateMinCompletionPct,
    eligible: meetsCertificateThreshold(progress.courseCompletionPct, course.certificateMinCompletionPct),
  };
}

/**
 * Gọi sau mỗi bài học hoàn thành: vừa chạm ngưỡng thì cấp luôn, chưa đủ thì thôi (không ném lỗi). Trả về chứng
 * nhận nếu học viên đã có/được cấp. Ngưỡng < 100 nên không thể chỉ chờ sự kiện course.completed.
 */
export async function issueCertificateIfEligible(
  userId: string,
  courseId: string,
  db: PrismaClient = prisma,
) {
  try {
    return await issueCertificate(userId, courseId, db);
  } catch (e) {
    if (e instanceof CertificationError && (e.code === "not_completed" || e.code === "not_enrolled")) return null;
    throw e;
  }
}

/**
 * Idempotent: gọi nhiều lần cho cùng (userId, courseId) chỉ tạo 1 hàng.
 * Throws nếu chưa enroll hoặc chưa đạt ngưỡng hoàn thành của khoá — caller (route hoàn
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
  const { eligible } = await getCertificateEligibility(userId, courseId, db);
  if (!eligible) {
    throw new CertificationError("not_completed");
  }

  const [user, course, platformSignatureSettings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, select: { displayName: true } }),
    db.course.findUniqueOrThrow({
      where: { id: courseId },
      select: {
        title: true,
        organization: {
          select: {
            name: true,
            brandingLogoUrl: true,
            signatureImageUrl: true,
            signatureName: true,
            signatureTitle: true,
          },
        },
      },
    }),
    // SiteSetting — chữ ký Limio dùng chung toàn hệ thống (config ở
    // /admin/settings), không phải model core-lms nào cả nên đọc thẳng qua
    // db thay vì import apps/web/src/lib/site-settings.ts (module boundary).
    db.siteSetting.findMany({
      where: {
        key: {
          in: [
            "branding.limio_signature_url",
            "branding.limio_signature_name",
            "branding.limio_signature_title",
          ],
        },
      },
    }),
  ]);
  const platformSettingsByKey = Object.fromEntries(
    platformSignatureSettings.map((s) => [s.key, s.value]),
  );

  const certNumber = await generateUniqueCertNumber(db);
  const issuerName = course.organization ? `Limio × ${course.organization.name}` : "Limio Learning";
  const issuerLogoUrl = course.organization?.brandingLogoUrl ?? null;
  const issuerOrgName = course.organization?.name ?? null;
  const issuerSignatureUrl = course.organization?.signatureImageUrl ?? null;
  const issuerSignatureName = course.organization?.signatureName ?? null;
  const issuerSignatureTitle = course.organization?.signatureTitle ?? null;
  const platformSignatureUrl = platformSettingsByKey["branding.limio_signature_url"] || null;
  const platformSignatureName = platformSettingsByKey["branding.limio_signature_name"] || null;
  const platformSignatureTitle = platformSettingsByKey["branding.limio_signature_title"] || null;

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
        issuerOrgName,
        issuerSignatureUrl,
        issuerSignatureName,
        issuerSignatureTitle,
        platformSignatureUrl,
        platformSignatureName,
        platformSignatureTitle,
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
