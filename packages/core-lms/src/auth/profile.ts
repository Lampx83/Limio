import { z } from "zod";
import { prisma } from "@feedbackme/db";
import type { DbClient } from "./tokens";

// Accept either an absolute https?: URL or an internal relative path
// (e.g. "/api/avatars/abc.jpg" produced by the avatar upload route).
const AvatarUrl = z
  .string()
  .max(500)
  .refine(
    (s) =>
      s.startsWith("/") ||
      /^https?:\/\//i.test(s),
    { message: "must be absolute URL or internal path" },
  );

export const ProfileUpdateInput = z.object({
  displayName: z.string().min(1).max(80).trim().optional(),
  avatarUrl: AvatarUrl.optional().nullable(),
  locale: z.string().min(2).max(10).optional(),
  timezone: z.string().min(1).max(64).optional(),
  // Phase 1 C5 — opt out of public course leaderboards (spec §5.5).
  leaderboardOptOut: z.boolean().optional(),
});

export class ProfileError extends Error {
  constructor(public readonly code: "validation_failed") {
    super(code);
  }
}

export async function updateProfile(
  userId: string,
  rawInput: unknown,
  db: DbClient = prisma,
): Promise<void> {
  const parsed = ProfileUpdateInput.safeParse(rawInput);
  if (!parsed.success) throw new ProfileError("validation_failed");

  // Drop undefined keys so unspecified fields don't get reset to null.
  const data = Object.fromEntries(
    Object.entries(parsed.data).filter(([, v]) => v !== undefined),
  );
  if (Object.keys(data).length === 0) return;

  await db.user.update({ where: { id: userId }, data });
}

/** Foundational GDPR export — all data tied to the user, in JSON. Never includes passwordHash. */
export async function exportProfile(userId: string, db: DbClient = prisma) {
  return db.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      emailVerifiedAt: true,
      displayName: true,
      avatarUrl: true,
      locale: true,
      timezone: true,
      createdAt: true,
      updatedAt: true,
      authProviders: { select: { id: true, provider: true, createdAt: true } },
      userRoles: {
        select: {
          id: true,
          courseId: true,
          grantedAt: true,
          role: { select: { name: true } },
        },
      },
      enrollments: true,
      // LANG G3 — mức nắm vững (BKT) của chính người dùng theo từng chủ đề: dữ liệu
      // học tập nhạy cảm (§5 nguyên tắc 4) và là nền của hồ sơ 4 kỹ năng. Trước đây
      // bản xuất bỏ sót nó.
      skillStates: {
        select: {
          masteryProbability: true,
          attempts: true,
          correctCount: true,
          lastUpdatedAt: true,
          skill: { select: { code: true, name: true } },
        },
        orderBy: { lastUpdatedAt: "asc" },
      },
      // LANG G4 — lịch ôn flashcard (lần ôn, độ dễ, hạn kế tiếp) của chính người dùng.
      flashcardStates: {
        select: {
          itemId: true,
          easeFactor: true,
          intervalDays: true,
          repetitions: true,
          lapses: true,
          dueAt: true,
          introducedAt: true,
          lastReviewedAt: true,
          lastRating: true,
          course: { select: { slug: true } },
        },
        orderBy: { introducedAt: "asc" },
      },
      verificationTokens: { select: { id: true, purpose: true, createdAt: true, consumedAt: true } },
      portfolio: {
        select: {
          slug: true,
          isPublic: true,
          headline: true,
          createdAt: true,
          updatedAt: true,
          items: { select: { submissionId: true, note: true, createdAt: true } },
        },
      },
    },
  });
}
