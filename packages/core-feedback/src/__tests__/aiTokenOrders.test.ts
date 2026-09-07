import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import {
  MAX_PENDING_ORDERS,
  TokenOrderError,
  cancelTokenOrder,
  confirmTokenOrder,
  createTokenOrder,
  listActivePackages,
} from "../aiTutor/tokenOrders";
import { getTokenBudget } from "../aiTutor/tokenWallet";

async function makeUser(slug: string) {
  const user = await prisma.user.create({
    data: { email: `ord-${slug}@e.com`, passwordHash: "x", displayName: slug },
  });
  const r = await prisma.role.findUniqueOrThrow({
    where: { name: RoleName.Learner },
  });
  await prisma.userRole.create({ data: { userId: user.id, roleId: r.id } });
  return user;
}

async function makePackage(slug: string, tokens = 200_000, priceVnd = 20_000) {
  return prisma.aiTokenPackage.create({
    data: { name: `Gói ${slug}`, tokens, priceVnd },
  });
}

async function codeOf(p: Promise<unknown>): Promise<string | null> {
  try {
    await p;
    return null;
  } catch (e) {
    if (e instanceof TokenOrderError) return e.code;
    throw e;
  }
}

describe("đặt đơn mua token", () => {
  it("sinh mã đối soát và chốt token/giá tại thời điểm đặt", async () => {
    const user = await makeUser("create");
    const pkg = await makePackage("create");

    const order = await createTokenOrder(user.id, pkg.id);
    expect(order.status).toBe("pending");
    expect(order.tokens).toBe(200_000);
    expect(order.priceVnd).toBe(20_000);
    expect(order.code).toMatch(/^LM[2-9A-HJ-NP-Z]{6}$/);

    // Đổi giá gói không được đụng tới đơn đã đặt.
    await prisma.aiTokenPackage.update({
      where: { id: pkg.id },
      data: { priceVnd: 99_000, tokens: 1 },
    });
    const again = await prisma.aiTokenOrder.findUniqueOrThrow({
      where: { id: order.id },
    });
    expect(again.priceVnd).toBe(20_000);
    expect(again.tokens).toBe(200_000);
  });

  it("từ chối gói đã tắt và gói không tồn tại", async () => {
    const user = await makeUser("inactive");
    const pkg = await makePackage("inactive");
    await prisma.aiTokenPackage.update({
      where: { id: pkg.id },
      data: { isActive: false },
    });

    expect(await codeOf(createTokenOrder(user.id, pkg.id))).toBe(
      "package_inactive",
    );
    expect(
      await codeOf(createTokenOrder(user.id, "00000000-0000-4000-8000-000000000000")),
    ).toBe("package_not_found");
    expect(await listActivePackages()).toHaveLength(0);
  });

  it("chặn khi có quá nhiều đơn đang chờ", async () => {
    const user = await makeUser("spam");
    const pkg = await makePackage("spam");
    for (let i = 0; i < MAX_PENDING_ORDERS; i++) {
      await createTokenOrder(user.id, pkg.id);
    }

    expect(await codeOf(createTokenOrder(user.id, pkg.id))).toBe(
      "too_many_pending",
    );
  });
});

describe("admin đối soát", () => {
  it("xác nhận thì cộng token vào phần đã mua", async () => {
    const user = await makeUser("confirm");
    const admin = await makeUser("admin-c");
    const pkg = await makePackage("confirm");
    const order = await createTokenOrder(user.id, pkg.id);
    const before = await getTokenBudget(user.id);

    const r = await confirmTokenOrder(order.id, admin.id);
    expect(r.credited).toBe(true);

    const after = await getTokenBudget(user.id);
    expect(after.purchased).toBe(before.purchased + 200_000);
    // Hạn mức tháng không bị đụng tới.
    expect(after.monthlyRemaining).toBe(before.monthlyRemaining);
  });

  it("bấm xác nhận hai lần không cộng đôi", async () => {
    const user = await makeUser("double");
    const admin = await makeUser("admin-d");
    const pkg = await makePackage("double");
    const order = await createTokenOrder(user.id, pkg.id);

    const first = await confirmTokenOrder(order.id, admin.id);
    const second = await confirmTokenOrder(order.id, admin.id);

    expect(first.credited).toBe(true);
    expect(second.credited).toBe(false);
    expect((await getTokenBudget(user.id)).purchased).toBe(200_000);
    expect(
      await prisma.aiTokenLedger.count({
        where: { userId: user.id, kind: "purchase" },
      }),
    ).toBe(1);
  });

  it("không xác nhận được đơn đã huỷ, và không huỷ được đơn đã cộng", async () => {
    const user = await makeUser("settled");
    const admin = await makeUser("admin-s");
    const pkg = await makePackage("settled");

    const cancelled = await createTokenOrder(user.id, pkg.id);
    await cancelTokenOrder(cancelled.id, admin.id, "không thấy tiền về");
    expect(await codeOf(confirmTokenOrder(cancelled.id, admin.id))).toBe(
      "already_settled",
    );

    const paid = await createTokenOrder(user.id, pkg.id);
    await confirmTokenOrder(paid.id, admin.id);
    expect(await codeOf(cancelTokenOrder(paid.id, admin.id, null))).toBe(
      "already_settled",
    );
  });

  it("token đã mua không mất khi sang tháng mới", async () => {
    const user = await makeUser("carry");
    const admin = await makeUser("admin-cr");
    const pkg = await makePackage("carry");
    const order = await createTokenOrder(user.id, pkg.id);
    await confirmTokenOrder(order.id, admin.id);

    // Giả lập đã sang tháng khác: ví còn periodKey cũ nên lần đọc sau sẽ cấp lại.
    await prisma.aiTokenBalance.update({
      where: { userId: user.id },
      data: { periodKey: "2000-01", monthlyRemaining: 0 },
    });

    const budget = await getTokenBudget(user.id);
    expect(budget.monthlyRemaining).toBeGreaterThan(0); // hạn mức mới
    expect(budget.purchased).toBe(200_000); // phần mua giữ nguyên
  });
});
