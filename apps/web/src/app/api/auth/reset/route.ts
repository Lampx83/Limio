import { NextResponse } from "next/server";
import { resetPassword, ResetError } from "@feedbackme/core-lms";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  try {
    await resetPassword(body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ResetError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
