import { NextResponse } from "next/server";
import { ExamError, getLegacyOralReadiness, isAdmin, setLegacyOralDisabled } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";

export const runtime = "nodejs";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return (await isAdmin(session.user.id)) ? session.user.id : null;
}

/** Số liệu "tắt có ảnh hưởng ai không" của vấn đáp AI bản cũ. Chỉ đọc. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json(await getLegacyOralReadiness());
}

/** Body: { disabled: boolean }. Tắt/bật vấn đáp AI bản cũ cho toàn hệ thống. */
export async function PUT(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { disabled?: unknown } | null;
  if (typeof body?.disabled !== "boolean") {
    return NextResponse.json({ error: "disabled_must_be_boolean" }, { status: 400 });
  }
  try {
    await setLegacyOralDisabled(adminId, body.disabled);
  } catch (e) {
    if (e instanceof ExamError && e.code === "forbidden") {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
    throw e;
  }
  return NextResponse.json(await getLegacyOralReadiness());
}
