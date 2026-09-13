// A6.2 — Cắt text thuần thành từng đoạn nhỏ để embed riêng từng đoạn (RAG).
// Hàm thuần, không I/O — test trực tiếp không cần DB/network.

const DEFAULT_MAX_CHARS = 1000;

/**
 * Cắt theo ranh giới đoạn văn (blank line) trước, gộp các đoạn liền nhau vào
 * cùng 1 chunk cho tới khi chạm `maxChars`. Đoạn văn tự nó đã dài hơn
 * `maxChars` thì cắt tiếp theo ranh giới khoảng trắng (không cắt giữa từ).
 *
 * Không overlap giữa các chunk — đơn giản hoá có chủ đích cho bản đầu. Nếu
 * sau này thấy AI hỏi bị "đứt mạch" ở ranh giới 2 đoạn liền kề, thêm overlap
 * lúc đó, không làm trước khi có bằng chứng cần.
 */
export function chunkText(text: string, maxChars: number = DEFAULT_MAX_CHARS): string[] {
  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  const paragraphs = trimmed
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks: string[] = [];
  let current = "";

  const flush = () => {
    if (current.length > 0) {
      chunks.push(current);
      current = "";
    }
  };

  for (const para of paragraphs) {
    const piece = para.length > maxChars ? splitLongParagraph(para, maxChars) : [para];
    for (const p of piece) {
      if (current.length === 0) {
        current = p;
      } else if (current.length + 2 + p.length <= maxChars) {
        current = `${current}\n\n${p}`;
      } else {
        flush();
        current = p;
      }
    }
  }
  flush();

  return chunks;
}

/** Cắt 1 đoạn văn dài hơn maxChars theo ranh giới khoảng trắng gần nhất. */
function splitLongParagraph(paragraph: string, maxChars: number): string[] {
  const parts: string[] = [];
  let rest = paragraph;
  while (rest.length > maxChars) {
    let cut = rest.lastIndexOf(" ", maxChars);
    if (cut <= 0) cut = maxChars; // không có khoảng trắng — cắt cứng, hiếm gặp
    parts.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest.length > 0) parts.push(rest);
  return parts;
}
