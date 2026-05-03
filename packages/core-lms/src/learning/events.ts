import { Prisma, prisma } from "@feedbackme/db";
import type { LearningEventType } from "@feedbackme/shared-types";
import type { DbClient } from "../auth/tokens";

export interface EmitOptions {
  courseId?: string;
  /** Stable key for idempotent emit. If a row with this key exists, no new event is created. */
  eventKey?: string;
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
  userId: string,
  eventType: LearningEventType,
  payload: Record<string, unknown>,
  options: EmitOptions = {},
  db: DbClient = prisma,
): Promise<EmitResult> {
  try {
    const event = await db.learningEvent.create({
      data: {
        userId,
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
