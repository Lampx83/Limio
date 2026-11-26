import { describe, expect, it, vi } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { emitEvent } from "../events";
import type { DbClient } from "../../auth/tokens";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

async function user(slug: string) {
  const u = await registerUser(
    { email: `emit-${slug}@e.com`, password: "password1234", displayName: "E" },
    BASE,
  );
  return u.userId;
}

describe("emitEvent — chống ghi trùng theo eventKey", () => {
  it("khoá đã có: trả sự kiện cũ, KHÔNG thử ghi (không sinh dòng prisma:error ở log prod)", async () => {
    const userId = await user("dup1");
    const eventKey = `test.emit:${userId}:dup1`;
    const first = await emitEvent(userId, LearningEventType.LessonViewed, { n: 1 }, { eventKey });
    expect(first.created).toBe(true);

    const create = vi.fn(prisma.learningEvent.create);
    const db = {
      learningEvent: { findUnique: prisma.learningEvent.findUnique, create },
    } as unknown as DbClient;
    const again = await emitEvent(userId, LearningEventType.LessonViewed, { n: 2 }, { eventKey }, db);

    expect(again).toEqual({ eventId: first.eventId, created: false });
    expect(create).not.toHaveBeenCalled();
    expect(await prisma.learningEvent.count({ where: { eventKey } })).toBe(1);
  });

  it("ghi trùng trong cùng giao dịch không làm hỏng giao dịch đó", async () => {
    // Postgres huỷ cả giao dịch khi một câu INSERT vi phạm unique: trước khi vá,
    // lần emit thứ hai trong $transaction làm mọi truy vấn sau đó lỗi
    // "current transaction is aborted".
    const userId = await user("tx1");
    const eventKey = `test.emit:${userId}:tx1`;
    const result = await prisma.$transaction(async (tx) => {
      const a = await emitEvent(userId, LearningEventType.LessonViewed, {}, { eventKey }, tx);
      const b = await emitEvent(userId, LearningEventType.LessonViewed, {}, { eventKey }, tx);
      const u = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      return { a, b, u };
    });
    expect(result.a.created).toBe(true);
    expect(result.b).toEqual({ eventId: result.a.eventId, created: false });
    expect(result.u?.id).toBe(userId);
  });

  it("hai yêu cầu cùng lúc (tra trước đều chưa thấy): vẫn bắt P2002 và trả sự kiện của bên thắng", async () => {
    const userId = await user("race1");
    const eventKey = `test.emit:${userId}:race1`;
    const winner = await emitEvent(userId, LearningEventType.LessonViewed, {}, { eventKey });

    let lookups = 0;
    const db = {
      learningEvent: {
        // Lần tra đầu mô phỏng lúc bên kia chưa ghi xong.
        findUnique: (args: Parameters<typeof prisma.learningEvent.findUnique>[0]) =>
          lookups++ === 0 ? Promise.resolve(null) : prisma.learningEvent.findUnique(args),
        create: prisma.learningEvent.create,
      },
    } as unknown as DbClient;
    const loser = await emitEvent(userId, LearningEventType.LessonViewed, {}, { eventKey }, db);
    expect(loser).toEqual({ eventId: winner.eventId, created: false });
  });

  it("không có eventKey: luôn ghi dòng mới, không tra trước", async () => {
    const userId = await user("nokey1");
    const findUnique = vi.fn(prisma.learningEvent.findUnique);
    const db = {
      learningEvent: { findUnique, create: prisma.learningEvent.create },
    } as unknown as DbClient;
    const a = await emitEvent(userId, LearningEventType.LessonViewed, {}, {}, db);
    const b = await emitEvent(userId, LearningEventType.LessonViewed, {}, {}, db);
    expect(a.created && b.created).toBe(true);
    expect(a.eventId).not.toBe(b.eventId);
    expect(findUnique).not.toHaveBeenCalled();
  });
});
