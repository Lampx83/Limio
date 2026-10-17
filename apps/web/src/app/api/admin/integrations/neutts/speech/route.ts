import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { NEU_TTS_MAX_CHARS } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { getNeuGateway, NeuApiNotConfiguredError } from "@/lib/neuApi";

export const runtime = "nodejs";

/**
 * Admin: đọc thử một đoạn text bằng một giọng qua Kong. Trả thẳng WAV để
 * trình duyệt phát. Giới hạn độ dài theo NEU_TTS_MAX_CHARS (cùng chunk thật).
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let body: { text?: unknown; voice?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const voice = typeof body.voice === "string" && body.voice ? body.voice : undefined;
  if (!text) return NextResponse.json({ error: "empty_text" }, { status: 400 });
  if (text.length > NEU_TTS_MAX_CHARS) {
    return NextResponse.json({ error: "text_too_long", max: NEU_TTS_MAX_CHARS }, { status: 400 });
  }

  let gw;
  try {
    gw = await getNeuGateway();
  } catch (e) {
    if (e instanceof NeuApiNotConfiguredError) {
      return NextResponse.json({ error: "not_configured" }, { status: 400 });
    }
    throw e;
  }

  try {
    const res = await fetch(`${gw.baseUrl}/v1/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": gw.apiKey },
      body: JSON.stringify({ text, voice, normalize: true }),
      cache: "no-store",
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) {
      return NextResponse.json({ error: `http_${res.status}` }, { status: 502 });
    }
    return new NextResponse(await res.arrayBuffer(), {
      status: 200,
      headers: { "Content-Type": "audio/wav", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
