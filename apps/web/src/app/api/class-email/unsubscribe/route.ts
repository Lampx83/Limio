import { NextResponse } from "next/server";
import { setClassEmailOptOut, verifyClassMailUnsubscribeToken } from "@feedbackme/core-lms";
import { absoluteUrl } from "@/lib/seo";

export const runtime = "nodejs";

/**
 * Liên kết "Không nhận email này nữa" trong email tổng kết và nhận xét (C4.19). Chỉ tắt thư tự động của lớp học;
 * tổng kết và nhận xét vẫn xem được trong ứng dụng. Mã ký bằng HMAC nên không đoán được người khác.
 */
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";
  const userId = verifyClassMailUnsubscribeToken(token);
  if (!userId) return NextResponse.redirect(absoluteUrl("/class-email/unsubscribed?status=invalid"), 303);
  await setClassEmailOptOut(userId, true);
  return NextResponse.redirect(absoluteUrl("/class-email/unsubscribed?status=ok"), 303);
}
