import { NextResponse } from "next/server";
import { requestPasswordReset } from "@feedbackme/core-lms";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  await requestPasswordReset(body, baseUrl);
  // Always 200 — never reveal whether the email exists.
  return NextResponse.json({ ok: true });
}
