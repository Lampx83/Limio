import { NextResponse } from "next/server";
import { resetPassword, ResetError } from "@feedbackme/core-lms";
import { clearLoginFailures } from "@/lib/loginThrottle";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    const { email } = await resetPassword(body);
    // Vừa chứng minh sở hữu email → mở khoá đăng nhập ngay, khỏi chờ hết 15 phút.
    await clearLoginFailures(email);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ResetError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
