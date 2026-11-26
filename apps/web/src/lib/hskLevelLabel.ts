/**
 * Nhãn cấp độ hiện trên màn chiếu: "Limio HSK 4". Rút từ tên khoá vì khoá chưa có trường cấp độ riêng: "… HSK 3.0 — Cấp 4 …" → 4 (số 3.0 là phiên bản chuẩn
 * HSK, không phải cấp), "Limio HSK4 (3.0) - Quyển 1" → 4. Không nhận ra được thì trả null và màn chiếu hiện tên khoá như cũ.
 */
export function limioHskLabel(courseTitle: string): string | null {
  const t = courseTitle ?? "";
  if (!/HSK/i.test(t)) return null;
  const cap = /C[ấa]p\s*([1-9])(?!\d)/i.exec(t);
  if (cap) return `Limio HSK ${cap[1]}`;
  const m = /HSK\s*-?\s*([1-9])(?![\d.])/i.exec(t);
  return m ? `Limio HSK ${m[1]}` : null;
}

/**
 * Số chủ đề rút từ tên module: "Chủ đề 1 · 搬进新家 — Dọn về nhà mới" → "Chủ đề 1"; "Unit 3 …" → "Unit 3". Không có số thì null.
 */
export function unitNumberLabel(moduleTitle: string): string | null {
  const m = /^\s*(Chủ đề|Chu de|Unit|Bài|Module)\s*(\d{1,3})(?!\d)/i.exec(moduleTitle ?? "");
  if (!m) return null;
  const word = /^chu de$/i.test(m[1]!) ? "Chủ đề" : m[1]!;
  return `${word} ${m[2]}`;
}
