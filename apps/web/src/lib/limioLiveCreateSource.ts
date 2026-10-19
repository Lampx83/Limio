// Trang Tạo bài giảng: ba thẻ chọn nguyên liệu (docs/tieu-chi/tao-bai-giang-ba-the.md).

export type CreateSource = "idea" | "doc" | "pptx";

export const CREATE_SOURCES: ReadonlyArray<{ id: CreateSource; label: string; hint: string }> = [
  { id: "idea", label: "Từ ý tưởng", hint: "AI soạn từ kiến thức chung theo mô tả của thầy/cô." },
  { id: "doc", label: "Từ tài liệu", hint: "Word, PDF hoặc dán văn bản; AI bám sát tài liệu." },
  { id: "pptx", label: "Từ bài PowerPoint", hint: "Giữ hình, ghi chú giảng, bảng và biểu đồ." },
];

// Khớp TOPIC_MIN_CHARS của core-feedback (máy chủ kiểm lại).
export const TOPIC_MIN = 15;

export type UploadKind = "pptx" | "legacy_ppt" | "doc" | "unsupported";

/** Loại tệp theo đuôi: tệp PowerPoint đi sang trang nhập PowerPoint thay vì bị báo lỗi. */
export function classifyUpload(name: string): UploadKind {
  const ext = /\.([a-z0-9]+)$/i.exec(name)?.[1]?.toLowerCase();
  if (ext === "pptx") return "pptx";
  if (ext === "ppt") return "legacy_ppt";
  if (ext === "docx" || ext === "pdf" || ext === "txt" || ext === "md") return "doc";
  return "unsupported";
}

/** Nút "Soạn dàn ý" chỉ xét dữ liệu của thẻ đang chọn; thẻ PowerPoint không có nút này. */
export function canSubmitSource(source: CreateSource, input: { topic: string; text: string; hasFile: boolean }): boolean {
  if (source === "idea") return input.topic.trim().length >= TOPIC_MIN;
  if (source === "doc") return input.hasFile || input.text.trim().length > 0;
  return false;
}

// Tệp PowerPoint chọn ở trang Tạo bài giảng được chuyển sang trang nhập qua biến trong bộ nhớ: chuyển trang bằng
// router phía trình duyệt giữ nguyên module này, nên trang nhập đọc được tệp mà không phải tải lên hay chọn lại.
let pendingPptx: File | null = null;

export function handOffPptx(file: File): void {
  pendingPptx = file;
}

/** Lấy tệp đã chuyển sang (một lần duy nhất). */
export function takeHandedOffPptx(): File | null {
  const f = pendingPptx;
  pendingPptx = null;
  return f;
}
