import { NextResponse } from "next/server";
import { getPracticeAnswerAudio } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { storageFor } from "@/lib/storage";
import { practiceAnswerKeyFromAudioKey } from "@/lib/storage-keys";
import { resolveKey, streamStorageWithRange, streamWithRange } from "@/lib/storage-serve";

export const runtime = "nodejs";

/** Bản ghi âm là lời nói riêng của học viên: không cho trình duyệt hay proxy giữ lại. */
const PRIVATE = "private, no-store";

function withPrivateCache(res: NextResponse): NextResponse {
  res.headers.set("cache-control", PRIVATE);
  return res;
}

/**
 * Bài luyện nhúng: học viên nghe lại bản ghi âm CUỐI CÙNG của chính mình ở một câu mở. Chỉ chủ buổi luyện
 * (`getPracticeAnswerAudio` kiểm quyền; người khác nhận 404 như buổi không tồn tại). Hỗ trợ Range để tua.
 */
export async function GET(req: Request, { params }: { params: { id: string; questionId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const audio = await getPracticeAnswerAudio(userId, params.id, params.questionId);
    if (!audio) return new NextResponse("not_found", { status: 404, headers: { "cache-control": PRIVATE } });
    const key = practiceAnswerKeyFromAudioKey(audio.audioKey);
    // Khoá phải thuộc đúng buổi này: dữ liệu hỏng không được thành đường đọc tệp của buổi khác.
    if (!key || !key.key.startsWith(`practice-answers/${params.id}/`)) return new NextResponse("not_found", { status: 404, headers: { "cache-control": PRIVATE } });
    const resolved = await resolveKey(key);
    if (!resolved) return new NextResponse("not_found", { status: 404, headers: { "cache-control": PRIVATE } });

    if (resolved.absPath) return withPrivateCache(await streamWithRange(resolved.absPath, audio.mimeType, req));
    const streamed = await streamStorageWithRange(key, audio.mimeType, req);
    if (streamed) return withPrivateCache(streamed);
    const buf = await resolved.get();
    return new NextResponse(new Uint8Array(buf), {
      headers: {
        "content-type": audio.mimeType,
        "content-length": String(buf.length),
        "accept-ranges": "bytes",
        "cache-control": PRIVATE,
      },
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return withPrivateCache(mapped);
    throw e;
  }
}
