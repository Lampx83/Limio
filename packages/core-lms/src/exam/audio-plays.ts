import { z } from "zod";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { assertSubjectOwnsAttempt, type ExamSubject } from "./subject";
import { ExamError } from "./types";
import { assertPassageInActiveSection } from "./mock-sections";

/**
 * LANG G5b — nghe một lần / giới hạn lượt phát trong đề thi thử.
 *
 * Máy chủ CẤP từng lượt phát trước khi trình duyệt bấm phát và nhớ số lượt đã
 * cấp, nên tải lại trang không có thêm lượt. Giới hạn nói thẳng: đây là đếm lượt
 * phát, không chống được việc tải file audio về nghe riêng.
 *
 * Chỉ áp cho đề `mockMode`; đề thường giữ nguyên (không giới hạn, không ghi gì).
 */

export type AudioPolicy = "free_replay" | "limited_replay" | "once_only";

/** Số lượt tối đa; null = không giới hạn. Dữ liệu hỏng thì thắt chặt chứ không nới. */
export function audioPlayLimit(policy: AudioPolicy, maxAudioPlays: number | null): number | null {
  if (policy === "free_replay") return null;
  if (policy === "once_only") return 1;
  return maxAudioPlays && maxAudioPlays >= 1 ? maxAudioPlays : 1;
}

const ClaimInput = z.object({
  passageId: z.string().uuid(),
  audioKey: z.string().min(1).max(500),
  /** Do máy khách sinh; gửi lại vì mất mạng thì không tính hai lần. */
  playId: z.string().min(1).max(100),
});

export interface AudioPlayClaim {
  unlimited: boolean;
  limit: number | null;
  used: number;
  remaining: number | null;
}

/** Mọi `src` của node audio trong tài liệu bài đọc (Tiptap), kể cả lồng nhau. */
function audioSources(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== "object") return out;
  const n = node as { type?: string; attrs?: { src?: unknown }; content?: unknown[] };
  if (n.type === "audio" && typeof n.attrs?.src === "string") out.push(n.attrs.src);
  if (Array.isArray(n.content)) for (const c of n.content) audioSources(c, out);
  return out;
}

export async function claimAudioPlay(
  subject: ExamSubject,
  attemptId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<AudioPlayClaim> {
  const parsed = ClaimInput.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const { passageId, audioKey, playId } = parsed.data;

  const attempt = await db.examAttempt.findUnique({
    where: { id: attemptId },
    select: { id: true, examId: true, userId: true, candidateId: true, status: true, exam: { select: { mockMode: true } } },
  });
  if (!attempt) throw new ExamError("attempt_not_found");
  assertSubjectOwnsAttempt(subject, attempt);
  if (attempt.status !== "in_progress") throw new ExamError("attempt_already_submitted");

  const passage = await db.examPassage.findUnique({
    where: { id: passageId },
    select: { examId: true, audioPolicy: true, maxAudioPlays: true, contentJson: true },
  });
  if (!passage || passage.examId !== attempt.examId) throw new ExamError("validation_failed", { reason: "passage_not_in_exam" });

  const limit = attempt.exam.mockMode ? audioPlayLimit(passage.audioPolicy, passage.maxAudioPlays) : null;
  if (limit === null) return { unlimited: true, limit: null, used: 0, remaining: null };

  // audioKey phải là audio thật của bài này — nếu không, bịa key mới là có hạn mức mới.
  if (!audioSources(passage.contentJson).includes(audioKey)) {
    throw new ExamError("validation_failed", { reason: "audio_not_in_passage" });
  }
  // Không xin lượt cho bài của phần chưa mở / đã đóng.
  await assertPassageInActiveSection(attemptId, passageId, db);

  const state = (used: number): AudioPlayClaim => ({
    unlimited: false,
    limit,
    used,
    remaining: Math.max(0, limit - used),
  });

  return (db as typeof prisma).$transaction(async (tx) => {
    // Khoá theo (lượt thi, bài, audio): hai yêu cầu song song với playId khác nhau
    // không được cùng thấy "còn lượt" rồi cùng ghi.
    await tx.$executeRaw(
      Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${`${attemptId}|${passageId}|${audioKey}`}))`,
    );
    const where = { attemptId, passageId, audioKey };
    const already = await tx.examAudioPlay.findUnique({ where: { attemptId_playId: { attemptId, playId } } });
    if (already) {
      if (already.passageId !== passageId || already.audioKey !== audioKey) {
        throw new ExamError("validation_failed", { reason: "play_id_reused" });
      }
      return state(await tx.examAudioPlay.count({ where }));
    }
    const used = await tx.examAudioPlay.count({ where });
    if (used >= limit) throw new ExamError("audio_plays_exhausted", { limit, used });
    await tx.examAudioPlay.create({ data: { attemptId, passageId, audioKey, playId } });
    return state(used + 1);
  });
}

/** Số lượt đã dùng theo từng audio — cho runtime, để giao diện hiện "Còn N lượt" sau khi tải lại. */
export async function listAudioPlayUsage(
  attemptId: string,
  db: PrismaClient = prisma,
): Promise<{ passageId: string; audioKey: string; used: number }[]> {
  const rows = await db.examAudioPlay.groupBy({
    by: ["passageId", "audioKey"],
    where: { attemptId },
    _count: { _all: true },
  });
  return rows.map((r) => ({ passageId: r.passageId, audioKey: r.audioKey, used: r._count._all }));
}
