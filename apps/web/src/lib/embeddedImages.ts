/**
 * Đếm hình nhúng trong PDF/Word của bài nộp — để "Gợi ý điểm bằng AI" cảnh báo khi nó chỉ đọc phần chữ
 * mà bỏ qua hình (sơ đồ, ảnh chụp màn hình, bài vẽ chụp lại). Không dựng trang, không giải nén ảnh:
 * chỉ cần biết CÓ hình hay không và khoảng bao nhiêu.
 */

/** Hình nhỏ hơn mức này (biểu tượng, gạch đầu dòng, logo chân trang) không đáng để cảnh báo. */
const MIN_EDGE = 48;

/**
 * PDF: ảnh luôn là một đối tượng stream riêng có `/Subtype /Image`, và từ điển của stream không bao giờ
 * bị nén (object stream chỉ chứa đối tượng không phải stream) — nên đọc thẳng trên byte là đủ tin.
 * Không tính:
 * - mặt nạ trong suốt (/SMask): ảnh PNG trong suốt được lưu thành 2 đối tượng;
 * - ảnh chỉ dùng trong tô mẫu (/Type /Pattern): PDF xuất từ trình duyệt dựng bóng đổ, dải màu, nền CSS
 *   thành ảnh lặp — không phải hình người làm bài chèn vào (đối chiếu PyMuPDF trên PDF Chrome/Skia);
 * - hình quá nhỏ (biểu tượng, gạch đầu dòng).
 */
export function countPdfImages(buf: Buffer): number {
  const src = buf.toString("latin1");
  // Phần từ điển của mỗi đối tượng: từ "12 0 obj" tới "stream"/"endobj" đầu tiên.
  const objs: Array<{ num: string; dict: string }> = [];
  for (const m of src.matchAll(/(\d+)\s+\d+\s+obj\b/g)) {
    const start = m.index! + m[0].length;
    const tail = src.slice(start, start + 8000);
    const end = tail.search(/\bstream\b|\bendobj\b/);
    objs.push({ num: m[1]!, dict: end >= 0 ? tail.slice(0, end) : tail });
  }

  const masks = new Set<string>();
  const patternOnly = new Set<string>();
  for (const { dict } of objs) {
    for (const r of dict.matchAll(/\/SMask\s+(\d+)\s+\d+\s+R/g)) masks.add(r[1]!);
    if (/\/Type\s*\/Pattern\b|\/PatternType\b/.test(dict)) {
      const xobj = /\/XObject\s*<<([^>]*)>>/.exec(dict)?.[1] ?? "";
      for (const r of xobj.matchAll(/(\d+)\s+\d+\s+R/g)) patternOnly.add(r[1]!);
    }
  }

  let count = 0;
  for (const { num, dict } of objs) {
    if (!/\/Subtype\s*\/Image\b/.test(dict)) continue;
    if (masks.has(num) || patternOnly.has(num)) continue;
    const w = Number(/\/Width\s+(\d+)/.exec(dict)?.[1]);
    const h = Number(/\/Height\s+(\d+)/.exec(dict)?.[1]);
    if (w > 0 && h > 0 && (w < MIN_EDGE || h < MIN_EDGE)) continue;
    count++;
  }
  return count;
}

/** Word (.docx): mọi hình chèn vào đều nằm trong thư mục `word/media/` của gói zip. */
export async function countDocxImages(buf: Buffer): Promise<number> {
  try {
    const JSZip = (await import("jszip")).default;
    const zip = await JSZip.loadAsync(buf);
    return Object.keys(zip.files).filter(
      (p) => p.startsWith("word/media/") && /\.(png|jpe?g|gif|bmp|tiff?|webp|svg|emf|wmf)$/i.test(p),
    ).length;
  } catch {
    return 0; // tệp hỏng: phần rút chữ đã tự báo, ở đây không thêm cảnh báo sai
  }
}
