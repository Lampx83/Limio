/**
 * Tuỳ chọn đọc của học viên cho khoá ngoại ngữ (docs/tieu-chi/limio-language-ux-p0.md, mục D): pinyin luôn hiện / chạm để xem / ẩn, và cỡ chữ.
 * Nhớ theo khoá trong localStorage. Phần thuần để kiểm thử; giao diện ở `components/language/ReaderPrefs.tsx`.
 */
export type PinyinMode = "show" | "tap" | "off";
export type TextSize = "m" | "l" | "xl";

export interface ReaderPrefs {
  pinyin: PinyinMode;
  size: TextSize;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = { pinyin: "show", size: "m" };
export const PINYIN_MODES: readonly PinyinMode[] = ["show", "tap", "off"];
export const TEXT_SIZES: readonly TextSize[] = ["m", "l", "xl"];

export const readerPrefsKey = (slug: string) => `limio:reader:${slug}`;

/** Đọc giá trị đã lưu; mọi thứ sai dạng về mặc định, từng trường sai thì chỉ trường đó về mặc định. */
export function parseReaderPrefs(raw: string | null | undefined): ReaderPrefs {
  if (!raw) return DEFAULT_READER_PREFS;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof ReaderPrefs, unknown>> | null;
    return {
      pinyin: PINYIN_MODES.includes(v?.pinyin as PinyinMode) ? (v!.pinyin as PinyinMode) : DEFAULT_READER_PREFS.pinyin,
      size: TEXT_SIZES.includes(v?.size as TextSize) ? (v!.size as TextSize) : DEFAULT_READER_PREFS.size,
    };
  } catch {
    return DEFAULT_READER_PREFS;
  }
}

export const serializeReaderPrefs = (p: ReaderPrefs): string => JSON.stringify(p);

/** Các phần tử pinyin của bài (cùng danh sách với quy tắc CSS `data-rd-pinyin` ở globals.css). */
export const PINYIN_SELECTOR = "ruby.ruby-han > rt, .hsk-py, .hsk-fc-b-py, .py-latin";

/** Khối được "chạm để xem": phần tử khối gần nhất quanh chỗ chạm. Chạm vào điều khiển (nút, liên kết, ô nhập…) thì không tính. */
export function tapBlockOf(target: Element | null): Element | null {
  if (!target) return null;
  if (target.closest("button, a, input, textarea, select, summary, [role=button], [role=tab]")) return null;
  return target.closest("p, li, td, .hsk-turn, .hsk-wc, .rp-turn");
}

/**
 * Khoá có pinyin thì bảng "Aa" có nhóm Pinyin: `zh` hoặc không ghi ngôn ngữ; các khoá dạy tiếng Trung cho người Việt ghi `vi`. Cùng điều kiện với
 * `courseWantsPinyin` (components/language/PinyinLabel.tsx) nhưng nằm ở lib thuần vì trang bài là server component, không gọi được hàm của module "use client".
 */
export function courseHasPinyin(courseLanguage: string | null | undefined): boolean {
  const l = (courseLanguage ?? "").trim().toLowerCase().split(/[-_]/)[0];
  return l === "zh" || l === "vi" || l === "";
}
