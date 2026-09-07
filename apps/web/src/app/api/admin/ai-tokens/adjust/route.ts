import { NextResponse } from "next/server";
import { adminAdjustTokens, getTokenBudget } from "@feedbackme/core-feedback";
import { isAdmin } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Cộng/trừ token thủ công. Body: { email, amount, note? }.
 *
 * Đây là van xả: người học cạn hạn mức đúng lúc ôn thi, giảng viên báo lên,
 * admin cộng thêm mà không cần ai chuyển khoản. amount âm để sửa sai sót.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await readJson(req)) as
    | { email?: string; amount?: number; note?: string }
    | null;
  const amount = Number(body?.amount);
  if (!body?.email || !Number.isFinite(amount) || amount === 0) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  const target = await prisma.user.findUnique({
    where: { email: body.email.trim().toLowerCase() },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json({ error: "user_not_found" }, { status: 404 });
  }

  await adminAdjustTokens(
    target.id,
    Math.trunc(amount),
    userId,
    body.note ?? null,
  );
  return NextResponse.json({ ok: true, budget: await getTokenBudget(target.id) });
}
