import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/session";
import { listNarrationVoices, NarrationTtsNotConfiguredError } from "@/lib/narration/tts";
import { getVoiceSample } from "@/lib/narration/voiceSample";

export const runtime = "nodejs";

/**
 * Quản trị: nghe thử một giọng (`?voice=`). Lần đầu gọi TTS rồi lưu file; các lần sau phát lại file đã lưu. Chỉ nhận
 * tên giọng có trong danh sách của NEU để không ai đẩy tên tuỳ ý vào TTS hay đường dẫn file.
 */
export async function GET(req: Request) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const voice = new URL(req.url).searchParams.get("voice") ?? "";
  try {
    const { voices } = await listNarrationVoices();
    const found = voices.find((v) => v.voice === voice);
    if (!found) return NextResponse.json({ error: "unknown_voice" }, { status: 404 });
    const wav = await getVoiceSample(found.voice, found.language);
    return new NextResponse(new Uint8Array(wav), {
      status: 200,
      headers: {
        "Content-Type": "audio/wav",
        "Content-Length": String(wav.length),
        // Bản thử gắn với câu mẫu cố định, trình duyệt giữ lại được; riêng tư vì chỉ quản trị mới nghe.
        "Cache-Control": "private, max-age=86400",
      },
    });
  } catch (e) {
    if (e instanceof NarrationTtsNotConfiguredError) return NextResponse.json({ error: "not_configured" }, { status: 400 });
    console.error("[narration] không tạo được bản đọc thử", e);
    return NextResponse.json({ error: "unreachable" }, { status: 502 });
  }
}
