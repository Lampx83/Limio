/**
 * Mục đích của một khối Bài luyện (từ vựng, ngữ pháp, nghe, nói, đọc, viết, văn hoá), suy ra từ phần chữ trước dấu " · " trong tên khối
 * ("Ngữ pháp · 按时、赶紧" → mục đích Ngữ pháp, tên "按时、赶紧"). Quy ước đặt tên này áp dụng cho khoá HSK 4 (từ Quyển 1); tên khối không theo
 * quy ước thì không có mục đích và giao diện giữ cách hiện cũ.
 *
 * Màu theo mục đích: mỗi mục đích một màu cố định để học viên nhận ra ngay; dùng `light-dark()` nên chạy được cả giao diện sáng và tối.
 */
export type PracticePurposeKey = "vocab" | "grammar" | "culture" | "dialogue" | "reading" | "speaking" | "writing" | "speakwrite";

export interface PracticePurpose {
  key: PracticePurposeKey;
  label: string;
  /** Màu chữ/biểu tượng (sáng, tối). */
  fg: [string, string];
  /** Màu nền chip, pha 16% trên nền thẻ. */
  tint: string;
}

const P = (key: PracticePurposeKey, label: string, light: string, dark: string, tint: string): PracticePurpose => ({ key, label, fg: [light, dark], tint });

export const PRACTICE_PURPOSES: Record<PracticePurposeKey, PracticePurpose> = {
  vocab: P("vocab", "Từ vựng", "#3B6D11", "#97C459", "#639922"),
  grammar: P("grammar", "Ngữ pháp", "#534AB7", "#AFA9EC", "#7F77DD"),
  culture: P("culture", "Văn hoá", "#993556", "#ED93B1", "#D4537E"),
  dialogue: P("dialogue", "Hiểu hội thoại", "#185FA5", "#85B7EB", "#378ADD"),
  reading: P("reading", "Đọc", "#0F6E56", "#5DCAA5", "#1D9E75"),
  speaking: P("speaking", "Nói", "#993C1D", "#F0997B", "#D85A30"),
  writing: P("writing", "Viết", "#854F0B", "#EF9F27", "#BA7517"),
  speakwrite: P("speakwrite", "Nói và viết", "#993C1D", "#F0997B", "#D85A30"),
};

/** Phần chữ trước dấu " · " → mục đích. Tên thường gặp ở Bài tập tổng hợp cũng được nhận ("Luyện nói", "Đọc hiểu"…). */
const HEAD_TO_KEY: Record<string, PracticePurposeKey> = {
  "Từ vựng": "vocab",
  "Ngữ pháp": "grammar",
  "Văn hoá": "culture",
  "Hiểu hội thoại": "dialogue",
  "Đọc": "reading",
  "Đọc hiểu": "reading",
  "Nói": "speaking",
  "Luyện nói": "speaking",
  "Phiếu nói": "speaking",
  "Viết": "writing",
  "Nói và viết": "speakwrite",
};

export interface ParsedPracticeTitle {
  purpose: PracticePurpose;
  /** Phần tên sau dấu " · " (không rỗng). */
  text: string;
}

export function practicePurposeOf(title: string | null | undefined): ParsedPracticeTitle | null {
  if (!title) return null;
  const i = title.indexOf(" · ");
  if (i <= 0) return null;
  const key = HEAD_TO_KEY[title.slice(0, i).trim()];
  const text = title.slice(i + 3).trim();
  if (!key || !text) return null;
  return { purpose: PRACTICE_PURPOSES[key], text };
}

/** Kiểu chip (chữ + nền) theo mục đích; dùng làm `style` của thẻ chip. */
export function practicePurposeChipStyle(p: PracticePurpose): { color: string; backgroundColor: string } {
  return { color: `light-dark(${p.fg[0]}, ${p.fg[1]})`, backgroundColor: `color-mix(in srgb, ${p.tint} 16%, transparent)` };
}
