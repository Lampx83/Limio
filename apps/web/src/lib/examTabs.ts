/**
 * LANG L4.3 — các tab của trang sửa đề, theo LOẠI đề (cố định sau khi tạo):
 *  - đề thường (viết):  Tổng quan · Nội dung
 *  - đề vấn đáp:        Tổng quan · Tài liệu · Tổ chức thi
 *  - đề ngoại ngữ (`mockMode`): Cấu trúc · Nội dung · Thang điểm · Luyện đề · Xem trước
 * Link cũ (?tab=...) không hợp lệ với loại đề rơi về tab tương ứng thay vì lỗi.
 */
export type ExamTab =
  | "overview"
  | "content"
  | "materials"
  | "organize"
  | "structure"
  | "scoring"
  | "practice"
  | "preview";

export const ALL_EXAM_TABS: ExamTab[] = ["overview", "content", "materials", "organize", "structure", "scoring", "practice", "preview"];

export function examTabsFor(kind: "written" | "oral", mockMode: boolean): ExamTab[] {
  if (kind === "oral") return ["overview", "materials", "organize"];
  return mockMode ? ["structure", "content", "scoring", "practice", "preview"] : ["overview", "content"];
}

export function resolveExamTab(
  raw: string | string[] | undefined,
  kind: "written" | "oral",
  mockMode: boolean,
): ExamTab {
  const v = Array.isArray(raw) ? raw[0] : raw;
  const tabs = examTabsFor(kind, mockMode);
  if (v && (tabs as string[]).includes(v)) return v as ExamTab;
  // Tương ứng của link cũ.
  if (kind === "oral" && v === "content") return "materials";
  if (kind === "written" && v === "materials") return "content";
  return tabs[0]!;
}
