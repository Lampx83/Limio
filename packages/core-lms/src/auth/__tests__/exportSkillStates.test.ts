import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { registerUser } from "../register";
import { exportProfile } from "../profile";

/**
 * LANG G3 / G3.6.1 — bản xuất dữ liệu cá nhân (GDPR) phải có trạng thái kỹ năng
 * (mastery BKT): đó là dữ liệu học tập nhạy cảm về chính người học và là nền của
 * hồ sơ 4 kỹ năng. Trước G3 nó bị bỏ sót.
 */

async function user(name: string) {
  return registerUser(
    { email: `ex-${Date.now()}-${Math.random()}@e.com`, password: "password1234", displayName: name },
    "http://localhost:3000",
  );
}

describe("exportProfile — trạng thái kỹ năng", () => {
  it("có mã/tên chủ đề, mastery, attempts, correctCount và lần cập nhật của chính người dùng", async () => {
    const a = await user("A");
    const skill = await prisma.skill.create({ data: { code: `lesson.exp-${Date.now()}`, name: "Bài 5 — Nghe" } });
    await prisma.learnerSkillState.create({
      data: { userId: a.userId, skillId: skill.id, masteryProbability: 0.42, attempts: 7, correctCount: 3 },
    });
    const out = (await exportProfile(a.userId)) as unknown as {
      skillStates: Array<Record<string, unknown>>;
    };
    expect(out.skillStates).toHaveLength(1);
    expect(out.skillStates[0]).toMatchObject({
      masteryProbability: 0.42,
      attempts: 7,
      correctCount: 3,
      skill: { code: skill.code, name: "Bài 5 — Nghe" },
    });
    expect(out.skillStates[0]!.lastUpdatedAt).toBeInstanceOf(Date);
  });

  it("không lẫn dữ liệu của người khác; người chưa có dữ liệu thì mảng rỗng", async () => {
    const a = await user("A");
    const b = await user("B");
    const skill = await prisma.skill.create({ data: { code: `lesson.exp2-${Date.now()}`, name: "S" } });
    await prisma.learnerSkillState.create({
      data: { userId: b.userId, skillId: skill.id, masteryProbability: 0.9, attempts: 4, correctCount: 4 },
    });
    const out = (await exportProfile(a.userId)) as unknown as { skillStates: unknown[] };
    expect(out.skillStates).toEqual([]);
  });

  it("vẫn không bao giờ có passwordHash", async () => {
    const a = await user("A");
    const out = (await exportProfile(a.userId)) as unknown as Record<string, unknown>;
    expect("passwordHash" in out).toBe(false);
  });
});
