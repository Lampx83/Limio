import { formatDate } from "@/lib/datetime";

/** Bỏ ký tự hệ điều hành cấm trong tên file; giữ dấu tiếng Việt. */
function cleanPart(s: string, maxLength: number): string {
  return s
    .normalize("NFC")
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\x00-\x1f\x7f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength)
    .replace(/[\s.]+$/, "");
}

/** Ngày theo giờ Việt Nam, không dùng toISOString vì thi sáng sớm sẽ lùi một ngày. */
function dayStamp(date: Date): string {
  return formatDate(date).replace(/\//g, "-");
}

/** Ví dụ "Nguyễn Văn An - 02-11-2026 - Giữa kỳ Kinh tế vi mô.docx". */
export function buildOralExamFilename(
  studentName: string,
  examDate: Date,
  examTitle: string,
): string {
  const student = cleanPart(studentName, 80) || "Học viên";
  const title = cleanPart(examTitle, 80) || "Đề vấn đáp";
  return `${student} - ${dayStamp(examDate)} - ${title}.docx`;
}

/** Tên thư mục trong file nén, cũng là tên file nén (thêm ".zip"). */
export function buildOralExamBatchName(examTitle: string, exportedAt: Date): string {
  const title = cleanPart(examTitle, 80) || "Đề vấn đáp";
  return `Vấn đáp - ${title} - ${dayStamp(exportedAt)}`;
}

/**
 * Trả về hàm cấp tên không trùng, file sau thêm " (2)". So không phân biệt hoa thường vì
 * ổ đĩa Windows và macOS coi hai tên chỉ khác hoa thường là một file.
 */
export function createUniqueFilenames(): (name: string) => string {
  const used = new Set<string>();
  return (name) => {
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    let candidate = name;
    for (let n = 2; used.has(candidate.toLowerCase()); n += 1) {
      candidate = `${stem} (${n})${ext}`;
    }
    used.add(candidate.toLowerCase());
    return candidate;
  };
}
