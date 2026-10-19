// Trang Tạo bài giảng một ô: mô tả ý muốn, kèm một tài liệu nếu có (docs/tieu-chi/tao-bai-giang-mot-o.md). Hàm thuần.

// Khớp TOPIC_MIN_CHARS / TOPIC_MAX_CHARS của core-feedback (máy chủ kiểm lại).
export const TOPIC_MIN = 15;
export const TOPIC_MAX = 2000;
/** Dán vào ô một đoạn dài hơn mức này (khi chưa có tệp) thì đoạn đó thành tài liệu "Văn bản dán" (M4). */
export const PASTE_AS_DOC_CHARS = 2000;

export type UploadKind = "pptx" | "legacy_ppt" | "doc" | "unsupported";

/** Loại tệp theo đuôi: tệp PowerPoint đi sang trang nhập PowerPoint (M7). */
export function classifyUpload(name: string): UploadKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === "pptx") return "pptx";
  if (ext === "ppt") return "legacy_ppt";
  if (ext === "docx" || ext === "pdf" || ext === "txt" || ext === "md") return "doc";
  return "unsupported";
}

/** Đoạn vừa dán có thành tài liệu không (M4): dài hơn 2.000 ký tự (không tính khoảng trắng hai đầu) và chưa có tệp. */
export function pasteAsDocument(text: string, hasAttachment: boolean): boolean {
  return !hasAttachment && text.trim().length > PASTE_AS_DOC_CHARS;
}

/** Nút "Soạn dàn ý" (M6): có tài liệu thì mô tả không bắt buộc; không có thì mô tả từ 15 ký tự. Mô tả luôn ≤ 2.000. */
export function canSubmitCreate(input: { description: string; hasAttachment: boolean }): boolean {
  const n = input.description.trim().length;
  if (n > TOPIC_MAX) return false;
  return input.hasAttachment || n >= TOPIC_MIN;
}

// Tệp PowerPoint chọn ở trang Tạo bài giảng được chuyển sang trang nhập qua biến trong bộ nhớ, kèm mô tả của giảng viên:
// chuyển trang bằng router phía trình duyệt giữ nguyên module này, nên trang nhập đọc được tệp mà không phải chọn lại.
let pending: { file: File; intent: string } | null = null;

export function handOffPptx(file: File, intent = ""): void {
  pending = { file, intent: intent.trim() };
}

/** Lấy tệp (và mô tả) đã chuyển sang, một lần duy nhất. */
export function takeHandedOffPptx(): { file: File; intent: string } | null {
  const p = pending;
  pending = null;
  return p;
}
