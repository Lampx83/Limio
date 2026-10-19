// Chèn slide vào đúng vị trí trong bài giảng (nút [+] giữa các slide trong trình sửa, kiểu PowerPoint). Hàm thuần.

/** Đưa `id` (vừa tạo, đang ở cuối) về vị trí `at` (0 = đầu bài); `at` ngoài khoảng thì để ở cuối. */
export function moveIdTo(ids: string[], id: string, at: number): string[] {
  const rest = ids.filter((x) => x !== id);
  const pos = Number.isInteger(at) && at >= 0 && at < rest.length ? at : rest.length;
  return [...rest.slice(0, pos), id, ...rest.slice(pos)];
}

/** Lời nhắc của nút chèn ở khe trước slide thứ `at` (0-based) trong bài có `total` slide. */
export function insertGapLabel(at: number, total: number): string {
  return at >= total ? "Thêm slide vào cuối bài" : `Chèn slide mới vào trước slide ${at + 1}`;
}
