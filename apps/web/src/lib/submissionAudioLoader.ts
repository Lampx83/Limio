import type { AudioPayload } from "@feedbackme/core-feedback";
import { mimeForAudioFilename, parseAssignmentMediaFilename } from "@/lib/submissionAudio";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";
import { submissionKeyFromFilename } from "@/lib/storage-keys";

/**
 * LANG G7 — đọc file ghi âm của bài nộp từ kho. Trả null (⇒ `audio_not_hosted`) nếu URL không phải file do
 * hệ thống lưu, KHÔNG phải của chính người nộp (tên file mang userId của người upload — chặn việc dán
 * link file của người khác để nhờ chuyển chữ), không phải audio, hoặc file không còn.
 */
export async function loadSubmissionAudio(url: string, ownerUserId: string): Promise<AudioPayload | null> {
  const name = parseAssignmentMediaFilename(url);
  if (!name || !isSafeFilename(name) || !name.startsWith(`${ownerUserId}-`)) return null;
  const mimeType = mimeForAudioFilename(name);
  if (!mimeType) return null;
  const handle = await resolveKey(submissionKeyFromFilename(name));
  if (!handle) return null;
  return { buffer: await handle.get(), mimeType };
}
