import { randomInt } from "node:crypto";
import { Prisma, prisma, type PrismaClient } from "@feedbackme/db";
import { settleGatewayPayment } from "./orderPayment";

/**
 * Chuyển khoản ngân hàng tự động đối soát qua SePay (docs/tieu-chi/thanh-toan-sepay.md).
 *
 * Người mua chuyển khoản với NỘI DUNG = mã thanh toán của đơn; SePay báo về từng giao dịch tiền vào. Ở đây chỉ có logic
 * thuần + DB: route webhook lo xác thực và định dạng, hàm này lo "giao dịch này thuộc đơn nào và có đủ tiền không".
 */

// Bỏ 0/O/1/I: ngân hàng và người gõ hay nhầm. Không dùng dấu gạch hay khoảng trắng: ngân hàng có thể xoá/đổi chúng.
const CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const PAYMENT_CODE_PREFIX = "LM";
const CODE_BODY_LEN = 10;
const CODE_RE = new RegExp(`${PAYMENT_CODE_PREFIX}[2-9A-HJ-NP-Z]{${CODE_BODY_LEN}}`, "g");

/** Mã thanh toán mới: `LM` + 10 ký tự (~10^15 khả năng); đồng thời là `Order.providerRef` và nội dung chuyển khoản. */
export function generatePaymentCode(): string {
  let body = "";
  for (let i = 0; i < CODE_BODY_LEN; i++) body += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return PAYMENT_CODE_PREFIX + body;
}

/** Chữ hoa, bỏ mọi ký tự không phải chữ-số: ngân hàng có thể chèn khoảng trắng hoặc đổi dấu trong nội dung. */
export function normalizeTransferContent(content: string): string {
  return content.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Mọi mã thanh toán xuất hiện trong nội dung chuyển khoản (thường chỉ một). */
export function extractPaymentCodes(content: string): string[] {
  return [...new Set(normalizeTransferContent(content).match(CODE_RE) ?? [])];
}

export interface BankTransactionInput {
  /** Id giao dịch phía SePay (số hoặc chuỗi) — khoá chống trùng. */
  id: string | number;
  amount: number;
  content: string;
  /** "in" = tiền vào; mọi giá trị khác bị bỏ qua. */
  transferType: string;
  gateway?: string | null;
  accountNumber?: string | null;
  referenceCode?: string | null;
  /** "YYYY-MM-DD HH:mm:ss" (giờ Việt Nam) hoặc ISO. */
  transactionDate?: string | null;
}

export type BankTransactionOutcome =
  | { result: "duplicate" }
  | { result: "ignored" }
  | { result: "unmatched" }
  | { result: "amount_mismatch"; orderId: string }
  | { result: "duplicate_payment"; orderId: string }
  | { result: "matched"; orderId: string; overpaidAmount: number | null };

function parseTransactionDate(v: string | null | undefined): Date | null {
  if (!v) return null;
  // SePay: "2024-07-02 11:08:33" theo giờ Việt Nam (UTC+7), không kèm múi giờ.
  const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(v.trim());
  const d = m ? new Date(`${m[1]}T${m[2]}+07:00`) : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Xử lý MỘT giao dịch từ SePay. Idempotent theo id giao dịch. Ném lỗi (sau khi xoá dòng nhật ký) khi gặp lỗi tạm thời để
 * route trả 500 và SePay gửi lại; mọi trường hợp "không khớp" đều trả kết quả bình thường (không để SePay gửi lại vô ích).
 */
export async function processBankTransaction(
  input: BankTransactionInput,
  opts: { expectedAccountNumber?: string | null } = {},
  db: PrismaClient = prisma,
): Promise<BankTransactionOutcome> {
  const externalId = String(input.id);
  const base = {
    provider: "sepay",
    externalId,
    amount: Math.trunc(input.amount),
    content: input.content.slice(0, 500),
    gateway: input.gateway ?? null,
    accountNumber: input.accountNumber ?? null,
    referenceCode: input.referenceCode ?? null,
    transactedAt: parseTransactionDate(input.transactionDate),
  };

  let row: { id: string };
  try {
    row = await db.bankTransaction.create({ data: { ...base, status: "ignored" }, select: { id: true } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { result: "duplicate" };
    throw e;
  }

  const finish = async (
    status: "matched" | "unmatched" | "amount_mismatch" | "duplicate_payment" | "ignored",
    extra: { orderId?: string; overpaidAmount?: number | null } = {},
  ) => {
    await db.bankTransaction.update({
      where: { id: row.id },
      data: { status, orderId: extra.orderId ?? null, overpaidAmount: extra.overpaidAmount ?? null },
    });
  };

  try {
    if (input.transferType !== "in" || !Number.isFinite(input.amount) || input.amount <= 0) {
      await finish("ignored");
      return { result: "ignored" };
    }
    if (opts.expectedAccountNumber && input.accountNumber && input.accountNumber !== opts.expectedAccountNumber) {
      await finish("ignored");
      return { result: "ignored" };
    }

    const codes = extractPaymentCodes(input.content);
    const order = codes.length
      ? await db.order.findFirst({ where: { provider: "sepay", providerRef: { in: codes } } })
      : null;
    if (!order) {
      await finish("unmatched");
      return { result: "unmatched" };
    }
    if (order.status === "paid" || order.status === "refunded") {
      await finish("duplicate_payment", { orderId: order.id });
      return { result: "duplicate_payment", orderId: order.id };
    }
    // Chuyển thiếu: không cấp quyền, để admin xử lý tay. Chuyển thừa: vẫn cấp, ghi phần chênh.
    if (base.amount < order.amountCents) {
      await finish("amount_mismatch", { orderId: order.id });
      return { result: "amount_mismatch", orderId: order.id };
    }

    const outcome = await settleGatewayPayment(
      {
        provider: "sepay",
        txnRef: order.providerRef!,
        paidAmountCents: order.amountCents,
        success: true,
        gatewayTxnRef: input.referenceCode || externalId,
      },
      db,
    );
    if (outcome.result === "paid") {
      const overpaidAmount = base.amount > order.amountCents ? base.amount - order.amountCents : null;
      await finish("matched", { orderId: order.id, overpaidAmount });
      return { result: "matched", orderId: order.id, overpaidAmount };
    }
    if (outcome.result === "already_confirmed") {
      await finish("duplicate_payment", { orderId: order.id });
      return { result: "duplicate_payment", orderId: order.id };
    }
    await finish("unmatched", { orderId: order.id });
    return { result: "unmatched" };
  } catch (e) {
    // Lỗi tạm thời: xoá dòng nhật ký để lần SePay gửi lại không bị coi là trùng.
    await db.bankTransaction.delete({ where: { id: row.id } }).catch(() => undefined);
    throw e;
  }
}
