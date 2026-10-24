import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listNarrationVoices } from "@/lib/narration/tts";

export const runtime = "nodejs";

/** Quản trị: danh sách giọng đọc cho hộp "Tạo giọng" (NEU TTS; ở máy dev là bộ đọc giả). */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return NextResponse.json({ ok: true, ...(await listNarrationVoices()) });
  } catch (e) {
    console.error("[narration] không lấy được danh sách giọng", e);
    return NextResponse.json({ ok: false, error: "unreachable" }, { status: 502 });
  }
}
