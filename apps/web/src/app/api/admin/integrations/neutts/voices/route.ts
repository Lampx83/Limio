import { NextResponse } from "next/server";
import { isAdmin } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { getNeuGateway, NeuApiNotConfiguredError } from "@/lib/neuApi";

export const runtime = "nodejs";

type NeuVoice = { voice: string; language: string };

/**
 * NEU từng trả `voices: string[]`, nay trả `[{ voice, language }]` (thêm giọng
 * en/zh). Chuẩn hoá về một dạng để client không phải đoán — render nhầm object
 * vào JSX từng làm sập cả trang /admin/integrations.
 */
function normalizeVoices(raw: unknown): NeuVoice[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((v): NeuVoice[] => {
    if (typeof v === "string") return [{ voice: v, language: "vi" }];
    if (v && typeof v === "object" && typeof (v as { voice?: unknown }).voice === "string") {
      const lang = (v as { language?: unknown }).language;
      return [{ voice: (v as { voice: string }).voice, language: typeof lang === "string" ? lang : "vi" }];
    }
    return [];
  });
}

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
    const j = (await res.json()) as { voices?: unknown; languages?: unknown; default?: unknown };
    const languages =
      j.languages && typeof j.languages === "object" && !Array.isArray(j.languages)
        ? (j.languages as Record<string, string>)
        : {};
    return NextResponse.json({
      ok: true,
      voices: normalizeVoices(j.voices),
      languages,
      default: typeof j.default === "string" ? j.default : null,
    });
  } catch {
    return NextResponse.json({ ok: false, error: "unreachable" }, { status: 502 });
  }
}
