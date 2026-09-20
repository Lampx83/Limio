import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";

export const runtime = "nodejs";

const ALLOWED_KEYS = [
  "payment.enabled",
  "footer.text",
  "footer.enabled",
  // Thông tin chuyển khoản hiện trên trang mua token.
  "ai.bank.name",
  "ai.bank.account_number",
  "ai.bank.account_name",
  // Hạn mức token: đổi được lúc đang chạy, không cần restart.
  "ai.monthly_tokens.learner",
  "ai.monthly_tokens.instructor",
  "ai.tokens_per_day_global",
  // "true"/"false": khoá trang Token AI của người dùng (mặc định khoá).
  "ai.tokens_page.locked",
] as const;
type AllowedKey = (typeof ALLOWED_KEYS)[number];

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) return null;
  if (!(await isAdmin(session.user.id))) return null;
  return session.user.id;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const entries = await Promise.all(
    ALLOWED_KEYS.map(async (key) => [key, await getSiteSetting(key)]),
  );

  return NextResponse.json(Object.fromEntries(entries));
}

export async function PATCH(req: Request) {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const body = await req.json();

  for (const [key, value] of Object.entries(body)) {
    if (!ALLOWED_KEYS.includes(key as AllowedKey)) {
      return NextResponse.json({ error: `unknown key: ${key}` }, { status: 400 });
    }
    if (typeof value !== "string") {
      return NextResponse.json({ error: `value for ${key} must be a string` }, { status: 400 });
    }
    await setSiteSetting(key, value);
  }

  return NextResponse.json({ ok: true });
}
