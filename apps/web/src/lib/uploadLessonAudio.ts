import { apiUrl } from "@/lib/apiUrl";
import { AUDIO_MAX_BYTES } from "@/lib/lessonAudio";

export type UploadAudioResult =
  | { ok: true; url: string; originalName: string }
  | { ok: false; error: string; status?: number };

/**
 * LANG G2 — upload audio cho từng dòng từ vựng / từng lượt hội thoại. Trả kết quả
 * có cấu trúc thay vì ném lỗi; mã lỗi khớp lmsErrorMessage ở lib/lmsErrors.ts.
 * Quá 50 MB bị chặn ngay ở máy khách để khỏi chờ upload rồi mới biết bị từ chối.
 */
export async function uploadLessonAudio(
  file: File,
  fetchImpl: typeof fetch = fetch,
): Promise<UploadAudioResult> {
  if (file.size > AUDIO_MAX_BYTES) return { ok: false, error: "file_too_large" };

  const fd = new FormData();
  fd.append("file", file);
  let res: Response;
  try {
    res = await fetchImpl(apiUrl("/api/lesson-media/audio"), { method: "POST", body: fd });
  } catch {
    return { ok: false, error: "network_error" };
  }
  if (!res.ok) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    return { ok: false, error: d.error ?? "upload_failed", status: res.status };
  }
  const data = (await res.json().catch(() => ({}))) as { url?: string };
  if (!data.url) return { ok: false, error: "upload_failed", status: res.status };
  return { ok: true, url: data.url, originalName: file.name };
}
