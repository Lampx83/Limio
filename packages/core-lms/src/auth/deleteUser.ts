import { prisma } from "@feedbackme/db";
import { logAudit } from "./audit";
import type { DbClient } from "./tokens";

/**
 * Xoá user = ẨN DANH HOÁ, không DELETE row.
 *
 * `User` được ~48 bảng cascade, trong đó có `LearningEvent` (append-only) —
 * xoá cứng sẽ mất lịch sử điểm/lượt thi và phá thống kê khoá học. Thay vào đó
 * gỡ toàn bộ dữ liệu định danh, giữ row + dữ liệu học dưới dạng ẩn danh.
 *
 * Không thêm cột schema: user đã xoá nhận diện qua email giả có đuôi
 * `@deleted.invalid` (TLD `.invalid` được RFC 2606 đảm bảo không bao giờ tồn
 * tại nên không thể trùng email thật hay nhận thư).
 */
export const DELETED_EMAIL_DOMAIN = "deleted.invalid";
export const DELETED_DISPLAY_NAME = "Người dùng đã xoá";

export function isDeletedUserEmail(email: string): boolean {
  return email.endsWith(`@${DELETED_EMAIL_DOMAIN}`);
}

export interface DeleteUserBlocker {
  kind: "course_owner" | "exam_round_admin";
  id: string;
  title: string;
}

export class DeleteUserError extends Error {
  constructor(
    public readonly code:
      | "user_not_found"
      | "already_deleted"
      | "cannot_delete_self"
      | "has_ownership",
    public readonly blockers: DeleteUserBlocker[] = [],
  ) {
    super(code);
  }
}

/** Khoá học / đợt thi mà user đang phụ trách — phải chuyển quyền trước khi xoá. */
export async function findDeleteBlockers(
  userId: string,
  db: DbClient = prisma,
): Promise<DeleteUserBlocker[]> {
  const [courses, rounds] = await Promise.all([
    db.courseInstructor.findMany({
      where: { userId, role: "owner" },
      select: { course: { select: { id: true, title: true } } },
    }),
    db.examRoundAdmin.findMany({
      where: { userId },
      select: { round: { select: { id: true, title: true } } },
    }),
  ]);
  return [
    ...courses.map((c) => ({
      kind: "course_owner" as const,
      id: c.course.id,
      title: c.course.title,
    })),
    ...rounds.map((r) => ({
      kind: "exam_round_admin" as const,
      id: r.round.id,
      title: r.round.title,
    })),
  ];
}

/**
 * Chỉ admin nền tảng được gọi (caller — route — phải requireAdmin). Idempotent
 * ở mức từ chối: user đã xoá → `already_deleted`.
 */
export async function deleteUser(
  actorUserId: string,
  targetUserId: string,
  db: typeof prisma = prisma,
): Promise<{ removedFiles: string[] }> {
  if (actorUserId === targetUserId) throw new DeleteUserError("cannot_delete_self");

  return db.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: targetUserId },
      select: { id: true, email: true, displayName: true },
    });
    if (!user) throw new DeleteUserError("user_not_found");
    if (isDeletedUserEmail(user.email)) throw new DeleteUserError("already_deleted");

    const blockers = await findDeleteBlockers(targetUserId, tx);
    if (blockers.length > 0) throw new DeleteUserError("has_ownership", blockers);

    // Định danh & đường vào tài khoản.
    await tx.authProvider.deleteMany({ where: { userId: targetUserId } });
    await tx.verificationToken.deleteMany({ where: { userId: targetUserId } });
    await tx.userRole.deleteMany({ where: { userId: targetUserId } });
    await tx.courseInstructor.deleteMany({ where: { userId: targetUserId } });
    // Ghi chú cá nhân — nội dung riêng tư, không có giá trị thống kê.
    await tx.note.deleteMany({ where: { userId: targetUserId } });
    // LANG G6 — góp ý bài viết do AI chứa trích đoạn bài viết riêng của học viên (đã gửi tới nhà cung cấp
    // AI): nội dung riêng tư, không có giá trị thống kê sau khi ẩn danh, nên xoá hẳn như ghi chú.
    await tx.writingFeedback.deleteMany({ where: { userId: targetUserId } });
    // LANG G7 — bài nói: file ghi âm là lời nói riêng của học viên. Bản chữ + góp ý xoá hẳn; liên kết file
    // trên bài nộp được gỡ và TÊN FILE trả về cho tầng gọi (kho file thuộc apps/web) để xoá khỏi kho.
    await tx.speakingFeedback.deleteMany({ where: { userId: targetUserId } });
    await tx.submissionTranscript.deleteMany({ where: { userId: targetUserId } });
    const audioSubs = await tx.assignmentSubmission.findMany({
      where: { userId: targetUserId, attachmentUrl: { not: null }, assignment: { responseFormat: "audio" } },
      select: { id: true, attachmentUrl: true },
    });
    const removedFiles: string[] = [];
    for (const s of audioSubs) {
      const m = /\/api\/assignment-media\/([A-Za-z0-9._-]+)$/.exec(s.attachmentUrl ?? "");
      // Bài nộp nhóm: các thành viên khác trỏ cùng một tệp — chỉ gỡ liên kết của
      // người bị xoá, KHÔNG xoá tệp khỏi kho khi người khác còn dùng.
      const sharedWithOthers =
        (await tx.assignmentSubmission.count({
          where: { attachmentUrl: s.attachmentUrl, userId: { not: targetUserId } },
        })) > 0;
      if (m && !sharedWithOthers) removedFiles.push(m[1]!);
      await tx.assignmentSubmission.update({ where: { id: s.id }, data: { attachmentUrl: null } });
    }
    // A8 — e-portfolio là trang trưng bày gắn danh tính; ẩn danh hoá mà giữ
    // lại thì /p/<slug> vẫn sống. Item cascade theo Portfolio.
    await tx.portfolio.deleteMany({ where: { userId: targetUserId } });

    await tx.user.update({
      where: { id: targetUserId },
      data: {
        email: `deleted-${targetUserId}@${DELETED_EMAIL_DOMAIN}`,
        displayName: DELETED_DISPLAY_NAME,
        avatarUrl: null,
        passwordHash: null,
        emailVerifiedAt: null,
        leaderboardOptOut: true,
      },
    });

    // Không lưu email/tên gốc trong audit — mục đích xoá chính là gỡ chúng.
    await logAudit(
      {
        action: "user.deleted",
        actorUserId,
        targetUserId,
        payload: { mode: "anonymized", removedAudioFiles: removedFiles.length },
      },
      tx,
    );
    return { removedFiles };
  });
}
