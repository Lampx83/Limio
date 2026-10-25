import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listNarrationVoices } from "@/lib/narration/tts";
import { isVoiceRegion } from "@/lib/narration/voiceCatalog";
import { setVoiceLabel } from "@/lib/narration/voiceLabels";

export const runtime = "nodejs";

/** Quản trị: dán nhãn vùng miền cho một giọng (`region`: "bac" | "nam", hoặc null để gỡ nhãn). */
export async function PUT(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { voice?: unknown; region?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const voice = typeof body.voice === "string" ? body.voice : "";
  if (body.region !== null && !isVoiceRegion(body.region)) {
    return NextResponse.json({ error: "invalid_region" }, { status: 400 });
  }
  try {
    const { voices } = await listNarrationVoices();
    if (!voices.some((v) => v.voice === voice)) return NextResponse.json({ error: "unknown_voice" }, { status: 404 });
    await setVoiceLabel(voice, body.region, adminId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[narration] không lưu được nhãn giọng", e);
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
}
