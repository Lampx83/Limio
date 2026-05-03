import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Daily streak grace-period check — placeholder. Future: send reminder emails
 * when a learner is 1 day from breaking their streak. For MVP just no-op.
 */
export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  const expected = process.env.CRON_SECRET;
  if (expected && auth !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({ ok: true, todo: "send_streak_reminders" });
}
