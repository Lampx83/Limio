/**
 * Audio của câu hỏi Quiz (câu nghe của mini-test cuối bài): `QuizQuestion.extra.audioUrl`.
 * Chỉ nhận đường dẫn nội bộ của kho audio bài học (`/api/lesson-media/audio/…`, đi qua cổng kiểm quyền học viên đã ghi danh);
 * đường dẫn khác (địa chỉ ngoài, `..`, giao thức lạ) bị bỏ, câu vẫn làm được như câu chữ.
 */
const AUDIO_PREFIX = "/api/lesson-media/audio/";

export function quizAudioUrlOf(extra: unknown): string | null {
  if (!extra || typeof extra !== "object") return null;
  const url = (extra as { audioUrl?: unknown }).audioUrl;
  if (typeof url !== "string") return null;
  const u = url.trim();
  if (!u.startsWith(AUDIO_PREFIX) || u.length === AUDIO_PREFIX.length) return null;
  if (u.includes("..") || u.includes("\\") || /[\s?#]/.test(u)) return null;
  return u;
}
