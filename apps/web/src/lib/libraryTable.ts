/**
 * LANG L6.6 / L6.8 — phần thuần của giao diện quản lý đề (bảng, thao tác hàng loạt, nhập hàng loạt).
 */
export type BulkKind =
  | "paperType" | "difficulty" | "sourceLabel" | "yearLabel" | "collection" | "tagsAdd" | "tagsRemove"
  | "allowMock" | "allowPractice" | "freePreview" | "publish" | "archive" | "clone";

export interface BulkBody {
  action: "update" | "publish" | "archive" | "clone";
  examIds: string[];
  patch?: Record<string, unknown>;
  tagsMode?: "set" | "add" | "remove";
}

const tagList = (v: string) => [...new Set(v.split(",").map((t) => t.trim()).filter(Boolean))];

export function buildBulkBody(kind: BulkKind, value: string, examIds: string[]): BulkBody {
  const v = value.trim();
  const upd = (patch: Record<string, unknown>, extra: Partial<BulkBody> = {}): BulkBody => ({ action: "update", examIds, patch, ...extra });
  switch (kind) {
    case "paperType": return upd({ paperType: v === "" ? null : v });
    case "difficulty": return upd({ difficulty: v === "" ? null : Number(v) });
    case "sourceLabel": return upd({ sourceLabel: v === "" ? null : v });
    case "yearLabel": return upd({ yearLabel: v === "" ? null : v });
    case "collection": return upd({ collectionId: v === "" ? null : v });
    case "tagsAdd": return upd({ tags: tagList(v) }, { tagsMode: "add" });
    case "tagsRemove": return upd({ tags: tagList(v) }, { tagsMode: "remove" });
    case "allowMock": return upd({ allowMock: v === "on" });
    case "allowPractice": return upd({ allowPractice: v === "on" });
    case "freePreview": return upd({ freePreview: v === "on" });
    case "publish": return { action: "publish", examIds };
    case "archive": return { action: "archive", examIds };
    case "clone": return { action: "clone", examIds };
  }
}

const BULK_ERROR: Record<string, string> = {
  exam_has_attempts: "đề đã có người thi nên không đổi được mục này",
  exam_not_found: "không tìm thấy đề",
  exam_not_in_course: "đề không thuộc khoá này",
  exam_not_draft: "đề không còn là bản nháp",
  validation_failed: "giá trị chưa hợp lệ",
  section_missing_duration: "có phần chưa đặt giờ",
  no_questions: "đề chưa có câu hỏi",
  forbidden: "bạn không có quyền sửa đề này",
};
const GENERIC_BULK_ERROR = "không làm được (xem chi tiết ở trang sửa đề)";
export const describeBulkError = (code: string): string => BULK_ERROR[code] ?? GENERIC_BULK_ERROR;

export type BulkRow = { examId: string; ok: true } | { examId: string; ok: false; error: string };

export function summarizeBulk(results: BulkRow[], titles: Map<string, string>) {
  const failures = results
    .filter((r): r is Extract<BulkRow, { ok: false }> => !r.ok)
    .map((r) => ({ examId: r.examId, title: titles.get(r.examId) ?? r.examId, reason: describeBulkError(r.error) }));
  const ok = results.length - failures.length;
  return { ok, failed: failures.length, failures, message: `${ok} đề thành công, ${failures.length} đề không làm được.` };
}

export function parseManifestText(text: string): { ok: true; manifest: { exams: unknown[] }; count: number } | { ok: false; error: string } {
  const t = text.trim();
  if (!t) return { ok: false, error: "Chưa có nội dung. Chọn file JSON hoặc dán vào ô." };
  let data: unknown;
  try {
    data = JSON.parse(t);
  } catch {
    return { ok: false, error: "File không phải JSON hợp lệ." };
  }
  const exams = (data as { exams?: unknown })?.exams;
  if (!Array.isArray(exams)) return { ok: false, error: "Thiếu mảng \"exams\" ở gốc file." };
  if (exams.length === 0) return { ok: false, error: "Mảng \"exams\" đang rỗng." };
  if (exams.length > 500) return { ok: false, error: "Tối đa 500 đề mỗi lần nhập — hãy chia nhỏ file." };
  return { ok: true, manifest: { exams }, count: exams.length };
}

const IMPORT_ROW: Record<string, string> = { created: "Đã tạo", would_create: "Sẽ tạo", skipped_duplicate: "Bỏ qua (đã có)", error: "Lỗi" };
export const describeImportRow = (status: string): string => IMPORT_ROW[status] ?? status;
