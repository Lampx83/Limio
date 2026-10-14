/**
 * Phân loại nội dung một mã QR mà học viên quét ở nút scan chung trên header:
 * QR vào thi viết (`/exam/<mã>`) hay QR vào buổi vấn đáp (`/oral/<mã>`).
 *
 * Chỉ link đầy đủ mới phân biệt được hai loại. Mã trần 6 ký tự có thể là của
 * cả hai (mã vấn đáp luôn 6 ký tự, mã thi 6 hoặc 8) — giữ hành vi cũ của nút
 * scan là coi mã trần như mã thi. QR do hệ thống sinh luôn mang link đầy đủ
 * (xem `shareUrl`), nên trường hợp mã trần chỉ là đường dự phòng.
 */
export type ScanTarget = { kind: "exam" | "oral"; code: string; path: string };

const EXAM_URL = /\/exam\/([A-Za-z0-9]{6,8})(?:[/?#]|$)/;
const ORAL_URL = /\/oral\/([A-Za-z0-9]{6})(?:[/?#]|$)/;
const BARE_CODE = /^[A-Za-z0-9]{6,8}$/;

export function parseScanTarget(raw: string): ScanTarget | null {
  const text = raw.trim();

  const exam = text.match(EXAM_URL);
  if (exam?.[1]) {
    const code = exam[1].toUpperCase();
    return { kind: "exam", code, path: `/exam/${code}` };
  }

  const oral = text.match(ORAL_URL);
  if (oral?.[1]) {
    const code = oral[1].toUpperCase();
    return { kind: "oral", code, path: `/oral/${code}` };
  }

  if (BARE_CODE.test(text)) {
    const code = text.toUpperCase();
    return { kind: "exam", code, path: `/exam/${code}` };
  }
  return null;
}
