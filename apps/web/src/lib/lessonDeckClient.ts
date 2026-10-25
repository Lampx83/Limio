import { apiUrl } from "@/lib/apiUrl";

/** Lời báo lỗi cho giảng viên theo mã lỗi của các tuyến bài giảng / dàn ý. */
export const LESSON_DECK_ERRORS: Record<string, string> = {
  forbidden: "Bạn không có quyền sửa khoá này.",
  deck_in_use: "Bài giảng này đang gắn với một bài học khác. Gỡ ở bài kia trước.",
  deck_not_yours: "Chỉ gắn được bài giảng do chính bạn tạo.",
  lesson_has_deck: "Bài học đã có bài giảng. Tải lại trang rồi thử lại.",
  source_too_short: "Bài viết còn quá ngắn để soạn bài giảng.",
  openai_not_configured: "Chưa cấu hình mô hình AI trên máy chủ này.",
  empty_outline: "AI chưa soạn được dàn ý. Thử lại sau.",
  generate_failed: "AI chưa soạn được dàn ý. Thử lại sau.",
  validation_failed: "AI trả về dàn ý chưa hợp lệ. Thử lại sau.",
  ai_quota_exceeded: "Đã hết hạn mức AI. Thử lại sau.",
};

export const lessonDeckErrorText = (code: string | undefined | null, fallback = "Chưa tạo được bài giảng từ bài viết."): string =>
  LESSON_DECK_ERRORS[code ?? ""] ?? fallback;

export class LessonDeckClientError extends Error {
  constructor(public readonly code: string) {
    super(lessonDeckErrorText(code));
  }
}

/**
 * Tạo bài giảng slide từ chữ của bài học (nghe-giang-slide.md, AC2): máy chủ đọc bài, AI đề xuất dàn ý rồi gắn bài giảng nháp vào
 * bài học. Trả id bài giảng; người gọi chuyển sang trang dàn ý để giảng viên xem và xác nhận trước khi tạo slide.
 * Ném LessonDeckClientError (mã lỗi trong LESSON_DECK_ERRORS) khi lỗi.
 */
export async function createLessonDeckFromArticle(lessonId: string, opts: { replace?: boolean } = {}): Promise<{ deckId: string }> {
  const form = new FormData();
  form.set("lessonId", lessonId);
  if (opts.replace) form.set("replace", "1");
  let r: Response;
  try {
    r = await fetch(apiUrl("/api/instructor/limio-live/outline"), { method: "POST", body: form });
  } catch {
    throw new LessonDeckClientError("network");
  }
  if (!r.ok || !r.body) {
    const j = (await r.json().catch(() => ({}))) as { error?: string };
    throw new LessonDeckClientError(j.error ?? "generate_failed");
  }
  // Luồng NDJSON: nhịp giữ kết nối rồi {type:"done",deckId} hoặc {type:"error",error}.
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  let deckId: string | null = null;
  let failure: string | null = null;
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";
    for (const line of lines) {
      if (!line.trim()) continue;
      const ev = JSON.parse(line) as { type: string; deckId?: string; error?: string };
      if (ev.type === "done" && ev.deckId) deckId = ev.deckId;
      if (ev.type === "error") failure = ev.error ?? "generate_failed";
    }
  }
  if (failure || !deckId) throw new LessonDeckClientError(failure ?? "generate_failed");
  return { deckId };
}
