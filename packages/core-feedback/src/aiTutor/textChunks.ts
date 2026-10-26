/**
 * Chia văn bản dán vào thành các lô nhỏ để mỗi lời gọi LLM chỉ phải sinh một
 * lượng output vừa phải.
 *
 * Vì sao cần: "Nhập bằng AI" trả JSON ~0,43 token output cho mỗi ký tự đầu vào
 * (đo trên Qwen3.5 tự host, ~34 token/giây). Văn bản ~9.000 ký tự đã chạm trần
 * `max_tokens` (JSON bị cắt giữa chừng) và gần timeout 120 giây của SDK; cả hai
 * cùng hiện ra là "AI không đọc được nội dung này". Chia lô vừa tránh trần token,
 * vừa chạy song song nên nhanh hơn một lời gọi dài.
 *
 * Ranh giới ưu tiên: đầu câu hỏi ("Câu 5", "5.", "Question 5") > dòng trống >
 * từng dòng > cắt cứng. Không bao giờ cắt giữa một câu nếu còn ranh giới tốt hơn.
 */

/** Dòng mở đầu một câu hỏi: "Câu 12", "Question 3", "Bài 4", "7." / "7)". */
const QUESTION_START = /^\s*(?:(?:câu|question|bài|q)\s*\d+|\d{1,3}\s*[.):])/i;

type Level = 0 | 1 | 2;

/** Gom các dòng thành nhóm; mỗi nhóm bắt đầu ở một ranh giới theo `level`. */
function groupLines(lines: string[], level: Level): string[][] {
  const groups: string[][] = [];
  let cur: string[] = [];
  lines.forEach((line, i) => {
    const startsNew =
      level === 0
        ? QUESTION_START.test(line)
        : level === 1
          ? i > 0 && lines[i - 1]!.trim() === "" && line.trim() !== ""
          : true;
    if (startsNew && cur.length > 0) {
      groups.push(cur);
      cur = [];
    }
    cur.push(line);
  });
  if (cur.length > 0) groups.push(cur);
  return groups;
}

/** Cắt cứng một đoạn không có ranh giới nào: ưu tiên chỗ trắng gần cuối lô. */
function hardSplit(text: string, max: number): string[] {
  const out: string[] = [];
  let rest = text;
  while (rest.length > max) {
    const window = rest.slice(0, max);
    const ws = Math.max(window.lastIndexOf(" "), window.lastIndexOf("\t"));
    const cut = ws > max * 0.8 ? ws : max;
    out.push(rest.slice(0, cut));
    rest = rest.slice(cut);
  }
  if (rest.length > 0) out.push(rest);
  return out;
}

function toUnits(lines: string[], level: number, max: number): string[] {
  const text = lines.join("\n");
  if (text.length <= max) return [text];
  if (level > 2) return hardSplit(text, max);
  const groups = groupLines(lines, level as Level);
  // Mức này không tạo thêm ranh giới nào → thử mức mịn hơn.
  if (groups.length < 2) return toUnits(lines, level + 1, max);
  return groups.flatMap((g) => toUnits(g, level + 1, max));
}

/**
 * Chia `raw` thành các lô ≤ `maxChars` (trừ khi `maxChars` quá nhỏ), giữ nguyên
 * thứ tự và nội dung; lô nào cũng không rỗng. Văn bản ngắn hơn ngưỡng trả về 1 lô.
 */
export function splitIntoChunks(raw: string, maxChars: number): string[] {
  const text = raw.trim();
  if (text.length <= maxChars) return text ? [text] : [];

  const units = toUnits(text.split("\n"), 0, maxChars);
  const chunks: string[] = [];
  let cur = "";
  for (const unit of units) {
    if (cur && cur.length + 1 + unit.length > maxChars) {
      chunks.push(cur);
      cur = unit;
    } else {
      cur = cur ? `${cur}\n${unit}` : unit;
    }
  }
  if (cur) chunks.push(cur);
  return chunks.map((c) => c.trim()).filter((c) => c.length > 0);
}

/**
 * Chạy `fn` trên từng phần tử với tối đa `limit` lời gọi đồng thời. Giữ thứ tự
 * kết quả theo `items`; không bao giờ ném — mỗi phần tử trả về fulfilled/rejected
 * để caller quyết định (ghi nhận token của các lô đã xong trước khi báo lỗi).
 */
export async function mapWithLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  async function worker() {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await fn(items[i]!, i) };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker));
  return results;
}
