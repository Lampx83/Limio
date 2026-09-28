import { NextResponse } from "next/server";
import { ResendVerificationError, resendVerificationEmail } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";

export async function POST(
  _req: Request,
  { params }: { params: { userId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    await resendVerificationEmail(adminId, params.userId, baseUrl);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ResendVerificationError) {
      const status = e.code === "user_not_found" ? 404 : 409;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
