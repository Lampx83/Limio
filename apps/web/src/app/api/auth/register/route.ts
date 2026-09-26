import { NextResponse } from "next/server";
import { registerUser, RegisterError } from "@feedbackme/core-lms";

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    const result = await registerUser(body, baseUrl);
    return NextResponse.json(
      {
        userId: result.userId,
        email: result.email,
        emailSent: result.emailSent,
        // Verification URL is logged via dev email helper. Don't return it in prod.
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof RegisterError) {
      const status = e.code === "email_taken" ? 409 : 400;
      return NextResponse.json({ error: e.code, message: e.message }, { status });
    }
    throw e;
  }
}
