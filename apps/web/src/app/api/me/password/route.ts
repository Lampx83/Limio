import { NextResponse } from "next/server";
import { ChangePasswordError, changePassword } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  try {
    await changePassword(userId, body);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof ChangePasswordError) {
      const status =
        e.code === "current_password_incorrect"
          ? 401
          : e.code === "no_password_set"
            ? 409
            : e.code === "user_not_found"
              ? 404
              : 400;
      return NextResponse.json({ error: e.code }, { status });
    }
    throw e;
  }
}
