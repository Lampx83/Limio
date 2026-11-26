import { Prisma, prisma } from "@feedbackme/db";
import type { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";

export interface EmitOptions {
  /** null/undefined cho event không gắn khoá học (vd tournament "toàn nền tảng"). */
  courseId?: string | null;
  /** Stable key for idempotent emit. If a row with this key exists, no new event is created. */
  eventKey?: string;
  /**
   * A5.8 — Candidate subject when the event belongs to an anonymous test-taker
   * (open_code / assigned_code mode). Caller must pass `userId=null` in that
   * case. CHECK constraint enforces ≥1 of (userId, candidateId) is set.
   */
  candidateId?: string;
}

export interface EmitResult {
  eventId: bigint;
  /** False when an event with the same eventKey already existed. */
  created: boolean;
}

/**
 * Append a row to LearningEvent. Per CLAUDE.md §5.1 every meaningful action emits an event.
 * Idempotent when `eventKey` is provided.
 */
export async function emitEvent(
  userId: string | null,
  eventType: LearningEventType,
  payload: Record<string, unknown>,
  options: EmitOptions = {},
  db: DbClient = prisma,
): Promise<EmitResult> {
  if (!userId && !options.candidateId) {
    throw new Error("emitEvent: userId or candidateId is required");
  }
  // Tra khoá TRƯỚC khi ghi, đừng chỉ dựa vào bắt P2002: (1) Prisma ở prod in mọi
  // lỗi truy vấn thành dòng `prisma:error` dù mã bắt được, nên đường trùng bình
  // thường (bấm hoàn thành bài hai lần...) làm bẩn log; (2) trong $transaction,
  // INSERT vi phạm unique làm Postgres huỷ cả giao dịch ("current transaction is
  // aborted"). Nhánh catch dưới chỉ còn cho trường hợp hai yêu cầu chạy đua.
  if (options.eventKey) {
    const existing = await db.learningEvent.findUnique({
      where: { eventKey: options.eventKey },
      select: { id: true },
    });
    if (existing) return { eventId: existing.id, created: false };
  }
  try {
    const event = await db.learningEvent.create({
      data: {
        userId,
        candidateId: options.candidateId,
        eventType,
        payload: payload as Prisma.InputJsonValue,
        courseId: options.courseId,
        eventKey: options.eventKey,
      },
    });
    return { eventId: event.id, created: true };
  } catch (e) {
    // Duck-type the Prisma error: instanceof Prisma.PrismaClientKnownRequestError
    // is unreliable across webpack RSC bundle boundaries (the runtime class can
    // differ from the imported one), so check the code field directly.
    const code = (e as { code?: string }).code;
    if (options.eventKey && code === "P2002") {
      const existing = await db.learningEvent.findUnique({
        where: { eventKey: options.eventKey },
      });
      if (existing) return { eventId: existing.id, created: false };
    }
    throw e;
  }
}
