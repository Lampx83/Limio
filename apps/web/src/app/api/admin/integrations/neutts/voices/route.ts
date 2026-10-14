import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { getNeuGateway, NeuApiNotConfiguredError } from "@/lib/neuApi";

export const runtime = "nodejs";

/** Admin: lấy danh sách giọng của NEU TTS qua Kong (GET /tts/v1/voices). */
export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let gw;
  try {
    gw = await getNeuGateway();
  } catch (e) {
    if (e instanceof NeuApiNotConfiguredError) {
      return NextResponse.json({ ok: false, error: "not_configured" }, { status: 400 });
    }
    throw e;
  }

  try {
    const res = await fetch(`${gw.baseUrl}/v1/voices`, {
      headers: { "x-api-key": gw.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `http_${res.status}` }, { status: 502 });
    }
    const j = (await res.json()) as { voices?: string[]; default?: string };
    return NextResponse.json({ ok: true, voices: j.voices ?? [], default: j.default ?? null });
  } catch {
    return NextResponse.json({ ok: false, error: "unreachable" }, { status: 502 });
  }
}
