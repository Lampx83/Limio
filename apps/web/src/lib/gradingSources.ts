import { detectAttachmentKind } from "@/app/instructor/assignments/[id]/submissions/attachmentKind";
import { SPEAKING_BODY_PLACEHOLDER, type ResponseFormat } from "@/lib/generativeActivity";
import type { GoogleDocKind, GoogleDocTextResult } from "@/lib/googleDocText";
import { submissionFileKind, type LoadedSubmissionFile } from "@/lib/submissionFile";

/**
 * Gom những gì "Gợi ý điểm bằng AI" thật sự đọc được từ một bài nộp, và nói thẳng phần nào KHÔNG đọc
 * được. AI đọc: ô chữ; Google Docs/Sheets/Slides đã mở quyền; chữ trong PDF/Word/txt; bài nói (Whisper
 * chuyển chữ — trừ ví người chấm nếu chưa có sẵn). Ảnh và video CỐ Ý không chấm bằng AI (giảng viên tự
 * xem); chúng cùng PDF scan, link ngoài… trả về `unread` để giao diện cảnh báo, và prompt dặn model không
 * trừ điểm vì phần đó.
 */

export interface UnreadAttachment {
  /** Cụm danh từ, ghép sau "Học viên có nộp kèm …" (prompt) và "AI chưa đọc …" (giao diện). */
  what: string;
  /** Lý do cho giảng viên — kèm cách khắc phục nếu có. */
  why: string;
}

export interface GradingSources {
  body: string;
  attachments: Array<{ label: string; text: string }>;
  unread: UnreadAttachment | null;
  /** Nhãn ngắn những nguồn đã đưa cho AI, để giao diện ghi "AI đã đọc: …". */
  read: string[];
}

export type TranscribeOutcome =
  | { ok: true; text: string; created: boolean }
  | { ok: false; reason: "silent" | "too_large" | "not_hosted" | "not_configured" | "failed" };

export interface GradingSourceDeps {
  fetchGoogleDoc: (url: string) => Promise<GoogleDocTextResult>;
  /** Tệp hệ thống của người nộp (đã kiểm chủ sở hữu), có trần dung lượng. */
  loadFile: (url: string, maxBytes: number) => Promise<LoadedSubmissionFile>;
  /** Chữ trong PDF/Word; null = không có lớp chữ (PDF scan) hoặc tệp hỏng. */
  extractText: (buffer: Buffer, mimeType: string) => Promise<string | null>;
  /** Số hình nhúng trong PDF/Word — AI chỉ đọc chữ, có hình thì phải cảnh báo. */
  countImages: (buffer: Buffer, kind: "pdf" | "docx") => Promise<number>;
  /** Bản chữ bài nói: dùng lại nếu có, chưa có thì chuyển chữ (trừ ví người chấm). */
  transcribe: (url: string) => Promise<TranscribeOutcome>;
}

/** Tài liệu đọc vào bộ nhớ tối đa chừng này; ghi âm thì theo trần 25 MB của Whisper (ở tầng transcribe). */
export const GRADING_FILE_MAX_BYTES = 20 * 1024 * 1024;

const DOC_LABEL: Record<GoogleDocKind, string> = {
  document: "Google Docs",
  spreadsheets: "Google Trang tính",
  presentation: "Google Trang trình bày",
};

const AUDIO_WHAT = "một bản ghi âm (bài nói)";

function describeAttachment(url: string, format: ResponseFormat): string {
  // Máy ghi âm trên form nộp bài ra .webm — đoán theo đuôi sẽ thành "video", nên dạng bài thắng trước.
  if (format === "audio") return AUDIO_WHAT;
  const kind = detectAttachmentKind(url);
  if (kind === "image") return "một ảnh";
  if (kind === "video" || kind === "youtube" || kind === "vimeo") return "một video";
  if (kind === "audio") return AUDIO_WHAT;
  if (kind === "pdf") return "một tệp PDF";
  if (kind === "google") return "một tệp trên Google Drive";
  return "một tệp hoặc đường link đính kèm";
}

const TRANSCRIBE_WHY: Record<Exclude<TranscribeOutcome, { ok: true }>["reason"], string> = {
  silent: "Máy không nghe thấy lời nói nào trong bản ghi — hãy nghe trực tiếp.",
  too_large: "Tệp lớn hơn 25 MB, quá giới hạn chuyển giọng nói thành chữ — hãy nghe/xem trực tiếp.",
  not_hosted: "Tệp không nằm trong kho của hệ thống (hoặc không do học viên này tải lên) nên AI không mở.",
  not_configured: "Hệ thống chưa cấu hình khoá OpenAI cho chuyển giọng nói thành chữ (Whisper) — báo admin.",
  failed: "Chuyển giọng nói thành chữ thất bại lúc này — thử lại sau.",
};

const MEDIA_WHY = "AI không chấm ảnh và video — hãy tự xem trước khi chốt điểm.";

const FILE_WHY: Record<Exclude<LoadedSubmissionFile, { ok: true }>["reason"], string> = {
  not_hosted: "Đây là link ngoài hệ thống — AI chỉ mở tệp học viên tải lên và Google Docs/Trang tính/Trang trình bày đã mở quyền xem.",
  not_owner: "Tệp không do học viên này tải lên nên AI không mở.",
  missing: "Tệp không còn trong kho lưu trữ.",
  too_large: "Tệp lớn hơn 20 MB — AI không đọc tệp cỡ này.",
};

export async function collectGradingSources(
  ctx: {
    submissionId: string;
    submissionBody: string;
    attachmentUrl: string | null;
    responseFormat: ResponseFormat;
  },
  deps: GradingSourceDeps,
): Promise<GradingSources> {
  const rawBody = ctx.submissionBody.trim();
  const body = rawBody === SPEAKING_BODY_PLACEHOLDER ? "" : rawBody;
  const out: GradingSources = { body, attachments: [], unread: null, read: body ? ["phần chữ"] : [] };

  const url = ctx.attachmentUrl?.trim();
  if (!url) return out;
  const what = describeAttachment(url, ctx.responseFormat);
  const unread = (why: string, w = what) => {
    out.unread = { what: w, why };
    return out;
  };

  // 1. Google Docs/Sheets/Slides dán link.
  const doc = await deps.fetchGoogleDoc(url);
  if (doc.ok) {
    const label = DOC_LABEL[doc.kind];
    out.attachments.push({ label: `${label} học viên dán link${doc.truncated ? " (tài liệu dài, chỉ lấy phần đầu)" : ""}`, text: doc.text });
    out.read.push(label);
    return out;
  }
  if (doc.reason !== "not_google") {
    return unread(
      doc.reason === "not_accessible"
        ? "Google không cho mở — học viên cần chia sẻ “Bất kỳ ai có đường liên kết” (người xem), hoặc link sai."
        : doc.reason === "empty"
          ? "Tài liệu Google mở được nhưng trống."
          : "Không tải được tài liệu từ Google lúc này — thử lại sau.",
      "một tài liệu Google (dán link)",
    );
  }

  // 2. Link ngoài hệ thống (YouTube, Drive, Canva…): máy chủ không tự đi tải.
  const kind = submissionFileKind(url);
  if (!kind) return unread(FILE_WHY.not_hosted);

  // 3. Bài nói.
  if (ctx.responseFormat === "audio" || kind === "audio") {
    const t = await deps.transcribe(url);
    if (!t.ok) return unread(TRANSCRIBE_WHY[t.reason]);
    // Vừa chạy Whisper thì nói rõ — tiền đó trừ vào ví AI của người chấm.
    const fresh = t.created ? " (vừa chuyển giọng nói thành chữ, tính vào ví AI của bạn)" : "";
    out.attachments.push({ label: "bản chữ của bài nói (máy chuyển từ ghi âm, có thể sai chính tả)", text: t.text });
    out.read.push(`bản chữ bài nói${fresh}`);
    return out;
  }

  // 4. Ảnh và video: không chấm bằng AI — giảng viên tự xem.
  if (kind === "image" || kind === "video") return unread(MEDIA_WHY);

  if (kind !== "pdf" && kind !== "docx" && kind !== "text") {
    return unread("AI chưa đọc được loại tệp này — hãy tự mở tệp trước khi chốt điểm.");
  }

  const file = await deps.loadFile(url, GRADING_FILE_MAX_BYTES);
  if (!file.ok) return unread(FILE_WHY[file.reason]);

  // 5. Tài liệu: rút lớp chữ.
  const text =
    kind === "text" ? file.buffer.toString("utf-8").trim() || null : await deps.extractText(file.buffer, file.mimeType);
  if (!text) {
    return unread(
      kind === "pdf"
        ? "PDF không có lớp chữ (thường là ảnh scan) nên AI chưa đọc được — hãy tự xem."
        : "Không rút được chữ từ tệp (tệp hỏng hoặc trống) — hãy tự mở tệp.",
    );
  }
  const label = kind === "pdf" ? "tệp PDF" : kind === "docx" ? "tệp Word" : "tệp văn bản";
  const images = kind === "text" ? 0 : await deps.countImages(file.buffer, kind);
  out.attachments.push({ label: `${label} học viên tải lên (chỉ phần chữ)`, text });
  out.read.push(images > 0 ? `chữ trong ${label}` : label);
  // Đọc được chữ nhưng tệp còn hình: nói rõ, kẻo GV tưởng AI đã xem cả bài và model trừ điểm "thiếu".
  if (images > 0) {
    return unread(
      `AI chỉ đọc chữ trong ${label}, không xem hình — hãy tự xem các hình trước khi chốt điểm.`,
      `${images} hình trong ${label}`,
    );
  }
  return out;
}
