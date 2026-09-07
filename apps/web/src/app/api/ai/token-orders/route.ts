import { NextResponse } from "next/server";
import {
  TokenOrderError,
  createTokenOrder,
  listUserOrders,
} from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { getSiteSetting } from "@/lib/site-settings";

export const runtime = "nodejs";

/**
 * Thông tin chuyển khoản do admin cấu hình. Thiếu thì trang mua hiện trạng
 * thái "chưa cấu hình" thay vì đưa người ta một ô trống để chuyển tiền vào.
 */
async function bankInfo() {
  const [bankName, accountNumber, accountName] = await Promise.all([
    getSiteSetting("ai.bank.name"),
    getSiteSetting("ai.bank.account_number"),
    getSiteSetting("ai.bank.account_name"),
  ]);
  return { bankName, accountNumber, accountName };
}

export async function GET() {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    orders: await listUserOrders(userId),
    bank: await bankInfo(),
  });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await readJson(req)) as { packageId?: string } | null;
  if (!body?.packageId) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    const order = await createTokenOrder(userId, body.packageId);
    return NextResponse.json({ order, bank: await bankInfo() });
  } catch (e) {
    if (e instanceof TokenOrderError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: e.code === "too_many_pending" ? 429 : 400 },
      );
    }
    throw e;
  }
}
