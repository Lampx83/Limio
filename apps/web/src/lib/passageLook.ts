/**
 * Kiểu trình bày của một Đoạn văn (bài đọc): `look` nằm ở gốc tài liệu, importer đặt theo thể loại văn bản.
 * Mỗi kiểu có CSS riêng `.pv-<look>` trong globals.css (PassageView). Giá trị lạ hoặc thiếu thì hiện như cũ.
 *
 * Danh sách này được lặp ở importer (`packages/core-lms/scripts/practice-spec.ts`, `PASSAGE_LOOKS`) vì core-lms không import apps/web;
 * thêm kiểu mới thì sửa cả hai chỗ và thêm khối CSS (test `passageLook.test.ts` nhắc phần CSS).
 */
export const PASSAGE_LOOKS = ["newspaper", "factfile", "posts"] as const;

export type PassageLook = (typeof PASSAGE_LOOKS)[number];

/** Kiểu của đoạn văn, hoặc null khi không đặt hay giá trị không thuộc danh sách. */
export function passageLook(contentJson: unknown): PassageLook | null {
  const raw = (contentJson as { look?: unknown } | null | undefined)?.look;
  return typeof raw === "string" && (PASSAGE_LOOKS as readonly string[]).includes(raw) ? (raw as PassageLook) : null;
}
