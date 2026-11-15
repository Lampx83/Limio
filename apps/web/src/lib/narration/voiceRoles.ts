import type { NarrationKind, VoiceRole } from "@feedbackme/core-lms";

type NarrationVoices = Partial<Record<VoiceRole, string>>;

/** Vai giọng cần có cho từng loại — để route báo thiếu ngay thay vì tạo xong nửa chừng mới lỗi. */
export function requiredRoles(kind: NarrationKind, hasEnglish = false): VoiceRole[] {
  if (kind === "lecture") return hasEnglish ? ["lecturer", "en"] : ["lecturer"];
  return ["A", "B"];
}

/** `hasEnglish`: lời giảng có đoạn `[en: …]` (xem `CourseNarrationRow.hasEnglish`), khi đó cần thêm giọng tiếng Anh. */
export function missingVoice(kind: NarrationKind, voices: NarrationVoices, hasEnglish = false): VoiceRole | null {
  return requiredRoles(kind, hasEnglish).find((r) => !voices[r]?.trim()) ?? null;
}
