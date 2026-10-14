import { promises as fs } from "node:fs";
import { parseAssignmentMediaFilename } from "@/lib/submissionAudio";
import { isSafeFilename, resolveKey } from "@/lib/storage-serve";
import { submissionKeyFromFilename } from "@/lib/storage-keys";

/**
 * Đọc tệp đính kèm của bài nộp từ kho của hệ thống — cho "Gợi ý điểm bằng AI". Cùng luật với
 * loadSubmissionAudio: chỉ file do hệ thống lưu (/api/assignment-media/<tên>), không bao giờ tải URL
 * ngoài (chống SSRF), và tên file phải mang userId của người nộp (chặn dán link file của người khác).
 */

export type SubmissionFileKind = "image" | "pdf" | "docx" | "text" | "audio" | "video" | "other";

const BY_EXT: Record<string, { mimeType: string; kind: SubmissionFileKind }> = {
  png: { mimeType: "image/png", kind: "image" },
  jpg: { mimeType: "image/jpeg", kind: "image" },
  jpeg: { mimeType: "image/jpeg", kind: "image" },
  webp: { mimeType: "image/webp", kind: "image" },
  gif: { mimeType: "image/gif", kind: "image" },
  svg: { mimeType: "image/svg+xml", kind: "image" },
  pdf: { mimeType: "application/pdf", kind: "pdf" },
  docx: { mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", kind: "docx" },
  txt: { mimeType: "text/plain", kind: "text" },
  json: { mimeType: "application/json", kind: "text" },
  mp3: { mimeType: "audio/mpeg", kind: "audio" },
  ogg: { mimeType: "audio/ogg", kind: "audio" },
  wav: { mimeType: "audio/wav", kind: "audio" },
  m4a: { mimeType: "audio/mp4", kind: "audio" },
  // .webm có thể là ghi âm hoặc quay màn hình — người gọi quyết định theo dạng bài (responseFormat).
  webm: { mimeType: "video/webm", kind: "video" },
  mp4: { mimeType: "video/mp4", kind: "video" },
  mov: { mimeType: "video/quicktime", kind: "video" },
};

/** Loại tệp đoán theo đuôi, KHÔNG đọc kho — để quyết định có đáng tải về không. null = không phải file hệ thống. */
export function submissionFileKind(url: string): SubmissionFileKind | null {
  const name = parseAssignmentMediaFilename(url);
  if (!name) return null;
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  return BY_EXT[ext]?.kind ?? "other";
}

export type LoadedSubmissionFile =
  | { ok: true; buffer: Buffer; mimeType: string; kind: SubmissionFileKind; filename: string }
  | { ok: false; reason: "not_hosted" | "not_owner" | "missing" | "too_large" };

export async function loadSubmissionFile(
  url: string,
  ownerUserId: string,
  opts: { maxBytes: number },
): Promise<LoadedSubmissionFile> {
  const name = parseAssignmentMediaFilename(url);
  if (!name || !isSafeFilename(name)) return { ok: false, reason: "not_hosted" };
  if (!name.startsWith(`${ownerUserId}-`)) return { ok: false, reason: "not_owner" };
  const handle = await resolveKey(submissionKeyFromFilename(name));
  if (!handle) return { ok: false, reason: "missing" };
  // Ổ cục bộ: đo trước, không kéo cả video 200 MB vào bộ nhớ chỉ để biết là quá cỡ.
  if (handle.absPath) {
    const st = await fs.stat(handle.absPath).catch(() => null);
    if (st && st.size > opts.maxBytes) return { ok: false, reason: "too_large" };
  }
  const buffer = await handle.get();
  if (buffer.length > opts.maxBytes) return { ok: false, reason: "too_large" };
  const ext = name.slice(name.lastIndexOf(".") + 1).toLowerCase();
  const meta = BY_EXT[ext] ?? { mimeType: "application/octet-stream", kind: "other" as const };
  return { ok: true, buffer, mimeType: meta.mimeType, kind: meta.kind, filename: name };
}
