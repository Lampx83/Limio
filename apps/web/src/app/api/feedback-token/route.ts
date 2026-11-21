import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { hubEnabled, signFeedbackToken } from "@/lib/feedback-hub";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Cấp token Feedback Hub (10 phút) cho người đã đăng nhập; widget tự xin lại khi hết hạn.
 *
 * Danh tính gửi hub là NGƯỜI THẬT đang thao tác: khi admin đang "đăng nhập thay" một học viên, góp ý vẫn
 * thuộc về admin (không đứng tên học viên). Quyền ADMIN trên hub lấy từ DB (isAdmin), không tin vai trò trong JWT.
 */
export async function GET() {
  if (!hubEnabled()) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const session = await auth();
  const real = session?.user?.impersonator ?? session?.user;
  if (!real?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const token = signFeedbackToken({
    id: real.id,
    name: real.name || real.email || "Người dùng",
    email: real.email,
    admin: await isAdmin(real.id),
  });
  if (!token) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
}
