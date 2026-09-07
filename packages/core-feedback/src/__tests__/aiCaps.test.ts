import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  AiTutorError,
  GLOBAL_TOKENS_PER_DAY_KEY,
  MAX_TURNS_PER_HOUR,
  assertWithinCaps,
} from "../aiTutor/aiTutor";
import {
  DEFAULT_MONTHLY_TOKENS_INSTRUCTOR,
  DEFAULT_MONTHLY_TOKENS_LEARNER,
  MONTHLY_TOKENS_LEARNER_KEY,
  chargeTokens,
  ensureMonthlyGrant,
  getTokenBudget,
  vnMonthKey,
} from "../aiTutor/tokenWallet";

const MODEL = "gpt-4o-mini";

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

async function makeUser(slug: string, role?: RoleName) {
  const user = await prisma.user.create({
    data: { email: `cap-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  if (role) {
    const r = await prisma.role.findUniqueOrThrow({ where: { name: role } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: r.id },
    });
  }
  return user;
}

async function spend(userId: string, tokens: number) {
  await prisma.aiUsageLog.create({
    data: {
      userId,
      dayKey: today(),
      model: MODEL,
      tokensInput: tokens,
      tokensOutput: 0,
      costUsd: 0,
    },
  });
}

async function setGlobalCap(value: string | null) {
  if (value === null) {
    await prisma.siteSetting.deleteMany({
      where: { key: GLOBAL_TOKENS_PER_DAY_KEY },
    });
    return;
  }
  await prisma.siteSetting.upsert({
    where: { key: GLOBAL_TOKENS_PER_DAY_KEY },
    create: { key: GLOBAL_TOKENS_PER_DAY_KEY, value },
    update: { value },
  });
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof AiTutorError) return e.code;
    throw e;
  }
}

// SiteSetting nằm ngoài cleanDb của setup.ts (nó không thuộc về user nào), nên
// test này tự dọn khoá của mình — bỏ sót là mọi test chạy sau đều thừa hưởng
// một cái trần lạ.
afterEach(async () => {
  await setGlobalCap(null);
});

describe("assertWithinCaps — trần toàn hệ thống", () => {
  it("chặn mọi người khi tổng token trong ngày chạm trần, kể cả người chưa tiêu gì", async () => {
    const heavy = await makeUser("heavy");
    const fresh = await makeUser("fresh");
    await setGlobalCap("1000");
    await spend(heavy.id, 1000);

    expect(await codeOf(assertWithinCaps(fresh.id))).toBe("global_token_cap");
  });

  it("cho qua khi tổng còn dưới trần", async () => {
    const heavy = await makeUser("heavy2");
    const fresh = await makeUser("fresh2");
    await setGlobalCap("1000");
    await spend(heavy.id, 999);

    expect(await codeOf(assertWithinCaps(fresh.id))).toBeNull();
  });

  it("giá trị 0 là công tắc tắt hẳn — không ai gọi được", async () => {
    const u = await makeUser("killswitch");
    await setGlobalCap("0");

    expect(await codeOf(assertWithinCaps(u.id))).toBe("global_token_cap");
  });

  it("giá trị rác thì quay về mặc định, không biến thành không giới hạn", async () => {
    const u = await makeUser("garbage");
    await setGlobalCap("năm triệu");

    expect(await codeOf(assertWithinCaps(u.id))).toBeNull();
  });
});

describe("ví token — hạn mức tháng theo vai trò", () => {
  it("cấp hạn mức học viên trong lần gọi đầu tiên của tháng", async () => {
    const learner = await makeUser("wallet-learner", RoleName.Learner);
    const budget = await getTokenBudget(learner.id);

    expect(budget.monthlyRemaining).toBe(DEFAULT_MONTHLY_TOKENS_LEARNER);
    expect(budget.purchased).toBe(0);
    expect(budget.periodKey).toBe(vnMonthKey());
    expect(budget.estimatedTurns).toBeGreaterThan(0);
  });

  it("giảng viên được hạn mức riêng, cao hơn học viên", async () => {
    const instructor = await makeUser("wallet-gv", RoleName.Instructor);

    expect((await getTokenBudget(instructor.id)).monthlyRemaining).toBe(
      DEFAULT_MONTHLY_TOKENS_INSTRUCTOR,
    );
  });

  it("SiteSetting thắng giá trị mặc định", async () => {
    const learner = await makeUser("wallet-setting", RoleName.Learner);
    await prisma.siteSetting.create({
      data: { key: MONTHLY_TOKENS_LEARNER_KEY, value: "1234" },
    });

    expect((await getTokenBudget(learner.id)).monthlyRemaining).toBe(1234);

    await prisma.siteSetting.deleteMany({
      where: { key: MONTHLY_TOKENS_LEARNER_KEY },
    });
  });

  it("gọi nhiều lần trong cùng tháng chỉ cấp một lần", async () => {
    const learner = await makeUser("wallet-once", RoleName.Learner);
    await ensureMonthlyGrant(learner.id);
    await chargeTokens(learner.id, 10_000, null);
    await ensureMonthlyGrant(learner.id);

    const budget = await getTokenBudget(learner.id);
    expect(budget.monthlyRemaining).toBe(DEFAULT_MONTHLY_TOKENS_LEARNER - 10_000);
    expect(
      await prisma.aiTokenLedger.count({
        where: { userId: learner.id, kind: "monthly_grant" },
      }),
    ).toBe(1);
  });
});

describe("ví token — trừ và chặn", () => {
  it("tiêu hết hạn mức tháng trước rồi mới đụng vào phần đã mua", async () => {
    const learner = await makeUser("wallet-order", RoleName.Learner);
    await ensureMonthlyGrant(learner.id);
    await prisma.aiTokenBalance.update({
      where: { userId: learner.id },
      data: { purchased: 50_000 },
    });

    await chargeTokens(learner.id, DEFAULT_MONTHLY_TOKENS_LEARNER - 1_000, null);
    let budget = await getTokenBudget(learner.id);
    expect(budget.monthlyRemaining).toBe(1_000);
    expect(budget.purchased).toBe(50_000);

    await chargeTokens(learner.id, 3_000, null);
    budget = await getTokenBudget(learner.id);
    expect(budget.monthlyRemaining).toBe(0);
    expect(budget.purchased).toBe(48_000);
  });

  it("hết sạch số dư thì chặn lượt sau", async () => {
    const learner = await makeUser("wallet-empty", RoleName.Learner);
    await chargeTokens(learner.id, DEFAULT_MONTHLY_TOKENS_LEARNER, null);

    expect(await codeOf(assertWithinCaps(learner.id))).toBe("no_token_budget");
  });

  it("mỗi lần trừ đều để lại một dòng sổ cái truy được", async () => {
    const learner = await makeUser("wallet-ledger", RoleName.Learner);
    await chargeTokens(learner.id, 700, null);
    await chargeTokens(learner.id, 700, null);

    const rows = await prisma.aiTokenLedger.findMany({
      where: { userId: learner.id, kind: "consumption" },
    });
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.amount === -700)).toBe(true);
  });
});

describe("assertWithinCaps — phạm vi generator", () => {
  it("generator không dính cap lượt/giờ của hội thoại", async () => {
    const user = await makeUser("turns");
    const course = await prisma.course.create({
      data: { slug: "c-cap", title: "C", description: "x" },
    });
    const mod = await prisma.module.create({
      data: { courseId: course.id, title: "M", orderIndex: 0 },
    });
    const lesson = await prisma.lesson.create({
      data: { moduleId: mod.id, title: "L", orderIndex: 0 },
    });
    const conv = await prisma.aiConversation.create({
      data: { userId: user.id, lessonId: lesson.id, model: MODEL },
    });
    await prisma.aiMessage.createMany({
      data: Array.from({ length: MAX_TURNS_PER_HOUR }, () => ({
        conversationId: conv.id,
        role: "assistant" as const,
        content: "x",
      })),
    });

    expect(await codeOf(assertWithinCaps(user.id, prisma, "tutor"))).toBe(
      "rate_limited",
    );
    expect(
      await codeOf(assertWithinCaps(user.id, prisma, "generator")),
    ).toBeNull();
  });
});
