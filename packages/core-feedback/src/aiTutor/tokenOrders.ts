import { prisma, type PrismaClient } from "@feedbackme/db";
import { creditPurchasedTokens } from "./tokenWallet";

/**
 * Đơn mua token, thanh toán bằng chuyển khoản.
 *
 * Không có cổng thanh toán: người học đặt đơn, nhận một mã để ghi vào nội dung
 * chuyển khoản, admin đối soát sao kê rồi bấm xác nhận. Đổi lại việc phải có
 * người thật trong vòng lặp, ta không phải nuôi tích hợp cổng nào, và trường
 * thu tiền bằng đúng cái tài khoản họ vẫn dùng.
 */

export class TokenOrderError extends Error {
  constructor(
    public readonly code:
      | "package_not_found"
      | "package_inactive"
      | "too_many_pending"
      | "order_not_found"
      | "already_settled",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

// Bỏ 0/O/1/I: mã này người ta gõ tay vào ô nội dung chuyển khoản trên app ngân
// hàng, một ký tự đọc nhầm là một đơn không đối soát được.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
const CODE_LENGTH = 6;

// Chặn spam: mỗi người tối đa 3 đơn đang chờ. Đơn chờ không tốn gì của hệ
// thống, nhưng mỗi cái là một dòng admin phải nhìn khi đối soát.
export const MAX_PENDING_ORDERS = 3;

function randomCode(): string {
  let out = "LM";
  const bytes = new Uint8Array(CODE_LENGTH);
  globalThis.crypto.getRandomValues(bytes);
  for (const b of bytes) out += CODE_ALPHABET[b % CODE_ALPHABET.length];
  return out;
}

export async function listActivePackages(db: PrismaClient = prisma) {
  return db.aiTokenPackage.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { priceVnd: "asc" }],
  });
}

export async function listUserOrders(
  userId: string,
  db: PrismaClient = prisma,
) {
  return db.aiTokenOrder.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { package: { select: { name: true } } },
  });
}

export async function createTokenOrder(
  userId: string,
  packageId: string,
  db: PrismaClient = prisma,
) {
  const pkg = await db.aiTokenPackage.findUnique({ where: { id: packageId } });
  if (!pkg) throw new TokenOrderError("package_not_found");
  if (!pkg.isActive) throw new TokenOrderError("package_inactive");

  const pending = await db.aiTokenOrder.count({
    where: { userId, status: "pending" },
  });
  if (pending >= MAX_PENDING_ORDERS) {
    throw new TokenOrderError("too_many_pending", { pending });
  }

  // Chốt token + giá vào đơn: sửa giá gói sau này không được làm thay đổi đơn
  // mà người ta đã cầm đi chuyển khoản.
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await db.aiTokenOrder.create({
        data: {
          userId,
          packageId: pkg.id,
          tokens: pkg.tokens,
          priceVnd: pkg.priceVnd,
          code: randomCode(),
        },
        include: { package: { select: { name: true } } },
      });
    } catch (e) {
      // Trùng mã: cực hiếm (32^6), nhưng bốc lại rẻ hơn là để đơn hỏng.
      if (
        attempt < 4 &&
        (e as { code?: string }).code === "P2002"
      ) {
        continue;
      }
      throw e;
    }
  }
  throw new TokenOrderError("order_not_found", "code_collision");
}

/**
 * Admin xác nhận đã nhận tiền: đánh dấu đơn `paid` rồi cộng token.
 *
 * Cộng token đi qua creditPurchasedTokens, vốn idempotent theo orderId — nên
 * bấm xác nhận hai lần, hay hai admin bấm cùng lúc, cũng chỉ cộng một lần.
 */
export async function confirmTokenOrder(
  orderId: string,
  adminUserId: string,
  db: PrismaClient = prisma,
): Promise<{ credited: boolean; tokens: number }> {
  const order = await db.aiTokenOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new TokenOrderError("order_not_found");
  if (order.status === "cancelled") {
    throw new TokenOrderError("already_settled", { status: order.status });
  }

  const credited = await creditPurchasedTokens(
    order.userId,
    order.tokens,
    order.id,
    db,
  );
  // Cập nhật đơn SAU khi cộng: nếu cộng hỏng giữa chừng, đơn còn `pending` để
  // admin thấy và bấm lại — an toàn vì lần cộng thứ hai không nhân đôi.
  await db.aiTokenOrder.update({
    where: { id: order.id },
    data: {
      status: "paid",
      confirmedBy: adminUserId,
      confirmedAt: new Date(),
    },
  });
  return { credited, tokens: order.tokens };
}

export async function cancelTokenOrder(
  orderId: string,
  adminUserId: string,
  note: string | null,
  db: PrismaClient = prisma,
) {
  const order = await db.aiTokenOrder.findUnique({ where: { id: orderId } });
  if (!order) throw new TokenOrderError("order_not_found");
  if (order.status === "paid") {
    throw new TokenOrderError("already_settled", { status: order.status });
  }
  return db.aiTokenOrder.update({
    where: { id: order.id },
    data: {
      status: "cancelled",
      confirmedBy: adminUserId,
      confirmedAt: new Date(),
      note,
    },
  });
}

export async function listOrdersForAdmin(
  status: "pending" | "paid" | "cancelled" | "all",
  db: PrismaClient = prisma,
) {
  return db.aiTokenOrder.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      package: { select: { name: true } },
      user: { select: { email: true, displayName: true } },
    },
  });
}
