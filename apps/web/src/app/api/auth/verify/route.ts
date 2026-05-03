import { NextResponse } from "next/server";
import { verifyEmail, VerifyError } from "@feedbackme/core-lms";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }
  try {
    const result = await verifyEmail(token);
    return NextResponse.json({ userId: result.userId, email: result.email });
  } catch (e) {
    if (e instanceof VerifyError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
