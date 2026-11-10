import { createHash, createHmac } from "node:crypto";

/**
 * Mã công khai và xáo trộn cho các loại câu Sắp xếp, Ghép cặp, Kéo thả điền (docs/tieu-chi/exam-loai-cau-va-dan-anh-doan-van.md, C).
 *
 * `config` đầy đủ lưu đáp án NGAY TRONG CẤU TRÚC: thứ tự phần tử của Sắp xếp là thứ tự đúng, vế trái/phải của Ghép cặp chung mã cặp,
 * `blankIndex` của token Kéo thả cho biết ô đúng — và mã phần tử do trình soạn sinh theo số thứ tự nên nhìn mã cũng đoán được. Vì
 * vậy xuống trình duyệt:
 *   - mã phần tử đổi thành mã công khai (HMAC với khoá phía máy chủ, không suy ngược được),
 *   - danh sách được xáo trộn (ổn định theo `seed` = lượt làm + câu).
 * Phía máy chủ, chấm điểm đổi mã công khai về mã gốc (`resolvePublicId`); mã gốc cũ vẫn được nhận.
 */

function secret(): string {
  // Khoá ký phía máy chủ. Đổi khoá thì mã công khai trong đáp án đang làm dở không còn khớp: đáp án đó tính là chưa trả lời.
  return process.env.EXAM_PUBLIC_SECRET || process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET || "limio-dev-public-token-salt";
}

/** Mã công khai của một phần tử (ổn định giữa các lần gọi). */
export function publicToken(id: string): string {
  return "t" + createHmac("sha256", secret()).update(id).digest("base64url").slice(0, 11);
}

/**
 * Đổi giá trị học viên gửi lên (mã công khai, hoặc mã gốc của dữ liệu cũ) về mã gốc trong `ids`; không khớp thì null.
 */
export function resolvePublicId(ids: readonly string[], value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (ids.includes(value)) return value;
  for (const id of ids) if (publicToken(id) === value) return id;
  return null;
}

function mulberry32(a: number): () => number {
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Xáo trộn ổn định theo `seed` (cùng seed → cùng thứ tự, nên tải lại trang không đổi thứ tự). `sameAsOriginal` cho biết kết quả có
 * trùng thứ tự cần tránh (thứ tự đúng) không; trùng thì xoay một bước để chắc chắn khác.
 */
export function seededShuffle<T>(items: readonly T[], seed: string, sameAsOriginal: (r: T[]) => boolean = () => false): T[] {
  const out = [...items];
  const rnd = mulberry32(createHash("sha256").update(seed).digest().readUInt32BE(0));
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  if (out.length > 1 && sameAsOriginal(out)) out.push(out.shift()!);
  return out;
}
