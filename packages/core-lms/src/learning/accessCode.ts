import { randomInt } from "node:crypto";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { EnrollError, enrollWithVerifiedPayment, type EnrollResult } from "./enroll";

/**
 * Mã kích hoạt khoá học có phí.
 *
 * Học viên trả tiền cho giảng viên ngoài hệ thống; giảng viên sinh một mã,
 * gửi cho đúng người đó; học viên gõ mã là ghi danh ngay, không ai duyệt lại.
 * Khác AiTokenOrder (mã ở đó chỉ để admin đối soát sau khi đã xác minh tiền
 * về) — mã này TỰ NÓ cấp quyền, nên phải đủ dài để không đoán được và endpoint
 * redeem phải có rate-limit (xem apps/web/src/app/api/redeem-code).
 */

export class AccessCodeError extends Error {
  constructor(
    public readonly code:
      | "course_not_found"
      | "course_invite_only"
      | "validation_failed"
      | "code_not_found"
      | "code_already_used"
      | "code_revoked"
      | "course_not_enrollable",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// Bỏ 0/O/1/I: người ta đọc mã qua Zalo/tin nhắn rồi gõ tay. 12 ký tự trên
// bảng 32 ký tự (~10^18 khả năng) — khác mã đối soát AiTokenOrder (6 ký tự,
// chỉ để tham chiếu chứ không tự cấp gì), mã này tự nó mở khoá học nên phải
// đủ dài để không dò được bằng brute-force.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const GROUP_LEN = 4;
const GROUP_COUNT = 3;

function randomCode(): string {
  const groups: string[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    let group = "";
    for (let i = 0; i < GROUP_LEN; i++) {
      group += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
    }
    groups.push(group);
  }
  return groups.join("-");
}

/** Chuẩn hoá mã người dùng gõ/dán: chữ hoa, bỏ mọi ký tự không phải chữ-số,
 * rồi chia lại thành nhóm 4 — người ta hay gõ thiếu gạch nối hoặc dán kèm
 * khoảng trắng từ tin nhắn. */
export function normalizeAccessCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return clean.match(/.{1,4}/g)?.join("-") ?? clean;
}

export const ACCESS_CODE_BATCH_MAX = 200;

export interface GeneratedAccessCode {
  id: string;
  code: string;
}

/** Sinh N mã mới cho một khoá. Giá được chốt (snapshot) tại thời điểm này. */
export async function generateAccessCodes(
  courseId: string,
  createdBy: string,
  count: number,
  db: PrismaClient = prisma,
): Promise<GeneratedAccessCode[]> {
  if (!Number.isInteger(count) || count < 1 || count > ACCESS_CODE_BATCH_MAX) {
    throw new AccessCodeError("validation_failed", { count });
  }
  const course = await db.course.findUnique({
    where: { id: courseId },
    select: { priceCents: true, currency: true, enrollMode: true },
  });
  if (!course) throw new AccessCodeError("course_not_found");
  // Bất biến khớp với updateCourse (core-lms/courses/courses.ts): invite_only
  // luôn priceCents=null, nên trường hợp này chỉ xảy ra nếu ai đó gọi thẳng
  // Prisma/SQL bỏ qua updateCourse — sinh mã cho một khoá không ai vào catalog
  // thấy được ô nhập mã (trang link mời không có UI redeem) là công vô ích.
  if (course.enrollMode === "invite_only") {
    throw new AccessCodeError("course_invite_only");
  }

  const created: GeneratedAccessCode[] = [];
  for (let i = 0; i < count; i++) {
    // Bốc lại khi trùng mã thay vì để hỏng cả lô — với 32^12 khả năng thì
    // gần như không bao giờ xảy ra, nhưng "gần như" không phải "không bao giờ".
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const row = await db.courseAccessCode.create({
          data: {
            courseId,
            code: randomCode(),
            createdBy,
            priceCentsSnapshot: course.priceCents,
            currency: course.currency,
          },
          select: { id: true, code: true },
        });
        created.push(row);
        break;
      } catch (e) {
        if (attempt < 4 && e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
          continue;
        }
        throw e;
      }
    }
  }
  return created;
}

export async function listAccessCodes(courseId: string, db: PrismaClient = prisma) {
  return db.courseAccessCode.findMany({
    where: { courseId },
    orderBy: { createdAt: "desc" },
    take: 300,
    include: { redeemedBy: { select: { email: true, displayName: true } } },
  });
}

/** Thu hồi một mã CHƯA dùng — dùng khi sinh nhầm hoặc phát nhầm người. */
export async function revokeAccessCode(
  courseId: string,
  codeId: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const result = await db.courseAccessCode.updateMany({
    where: { id: codeId, courseId, status: "unused" },
    data: { status: "revoked" },
  });
  if (result.count === 0) throw new AccessCodeError("code_already_used");
}

export interface RedeemAccessCodeResult extends EnrollResult {
  courseSlug: string;
  courseTitle: string;
  /** false nếu người này đã ghi danh khoá từ trước — mã không bị tiêu, vẫn
   * dùng được cho người khác. */
  codeConsumed: boolean;
}

/**
 * Đổi mã lấy một chỗ trong khoá.
 *
 * Đọc trạng thái mã trước để trả lỗi rõ ràng và để không tiêu mã khi người
 * này đã ghi danh từ trước (ví dụ nhận nhầm 2 mã) — nhưng an toàn trước đua
 * tranh KHÔNG nằm ở lần đọc đó, mà ở updateMany có điều kiện `status:
 * "unused"` ngay sau: hai request cùng redeem một mã, chỉ một cái có
 * count=1, cái còn lại thấy count=0 và biết mã vừa bị người khác dùng mất.
 */
export async function redeemAccessCode(
  userId: string,
  rawCode: string,
  db: PrismaClient = prisma,
  opts?: { baseUrl?: string },
): Promise<RedeemAccessCodeResult> {
  const code = normalizeAccessCode(rawCode);
  return db.$transaction(async (tx) => {
    const record = await tx.courseAccessCode.findUnique({
      where: { code },
      include: { course: true },
    });
    if (!record) throw new AccessCodeError("code_not_found");
    if (record.status === "revoked") throw new AccessCodeError("code_revoked");

    const existingEnrollment = await tx.enrollment.findUnique({
      where: { userId_courseId: { userId, courseId: record.courseId } },
    });
    if (existingEnrollment) {
      return {
        enrollmentId: existingEnrollment.id,
        courseVersion: existingEnrollment.courseVersion,
        created: false,
        courseSlug: record.course.slug,
        courseTitle: record.course.title,
        codeConsumed: false,
      };
    }
    if (record.status === "redeemed") throw new AccessCodeError("code_already_used");

    const claimed = await tx.courseAccessCode.updateMany({
      where: { code, status: "unused" },
      data: { status: "redeemed", redeemedByUserId: userId, redeemedAt: new Date() },
    });
    if (claimed.count === 0) {
      // Bị người khác giành mất giữa lúc đọc và lúc ghi ở trên.
      throw new AccessCodeError("code_already_used");
    }

    try {
      // Cast — tx bên trong $transaction(async (tx) => ...) thiếu vài method
      // quản lý kết nối so với PrismaClient đầy đủ (convention đã dùng ở
      // processStripeWebhook cho resolveDefaultSectionId).
      const result = await enrollWithVerifiedPayment(userId, record.course, tx as typeof prisma, {
        baseUrl: opts?.baseUrl,
      });
      return {
        ...result,
        courseSlug: record.course.slug,
        courseTitle: record.course.title,
        codeConsumed: true,
      };
    } catch (e) {
      if (e instanceof EnrollError && e.code === "course_not_enrollable") {
        throw new AccessCodeError("course_not_enrollable");
      }
      throw e;
    }
  });
}
