/**
 * Tuỳ chọn đọc của học viên cho khoá ngoại ngữ (docs/tieu-chi/limio-language-ux-p0.md, mục D): pinyin luôn hiện / chạm để xem / ẩn, và cỡ chữ.
 * Nhớ theo khoá trong localStorage. Phần thuần để kiểm thử; giao diện ở `components/language/ReaderPrefs.tsx`.
 */
export type PinyinMode = "show" | "tap" | "off";
export type TextSize = "m" | "l" | "xl";

export interface ReaderPrefs {
  pinyin: PinyinMode;
  /** Bản dịch (lời thoại…): cùng ba mức với pinyin, nhưng MẶC ĐỊNH ẨN (trừ khoá nhập môn, xem `defaultReaderPrefsFor`). */
  translation: PinyinMode;
  size: TextSize;
}

export const DEFAULT_READER_PREFS: ReaderPrefs = { pinyin: "show", translation: "off", size: "m" };

/**
 * Khoá nhập môn cho người chưa biết tiếng Trung: bản dịch hiện sẵn, học viên tự ẩn khi đã quen. Người mới đọc pinyin chưa thạo
 * nên bản dịch ẩn nghĩa là không có điểm tựa nào. Giá trị người học đã chọn (lưu trong localStorage) vẫn thắng mặc định này.
 */
export const TRANSLATION_SHOWN_BY_DEFAULT_SLUGS: ReadonlySet<string> = new Set(["hsk-1-goc"]);

export function defaultReaderPrefsFor(slug: string | undefined): ReaderPrefs {
  return slug && TRANSLATION_SHOWN_BY_DEFAULT_SLUGS.has(slug) ? { ...DEFAULT_READER_PREFS, translation: "show" } : DEFAULT_READER_PREFS;
}
export const PINYIN_MODES: readonly PinyinMode[] = ["show", "tap", "off"];
export const TEXT_SIZES: readonly TextSize[] = ["m", "l", "xl"];

export const readerPrefsKey = (slug: string) => `limio:reader:${slug}`;

/** Đọc giá trị đã lưu; mọi thứ sai dạng về mặc định, từng trường sai thì chỉ trường đó về mặc định. */
export function parseReaderPrefs(raw: string | null | undefined, defaults: ReaderPrefs = DEFAULT_READER_PREFS): ReaderPrefs {
  if (!raw) return defaults;
  try {
    const v = JSON.parse(raw) as Partial<Record<keyof ReaderPrefs, unknown>> | null;
    return {
      pinyin: PINYIN_MODES.includes(v?.pinyin as PinyinMode) ? (v!.pinyin as PinyinMode) : defaults.pinyin,
      translation: PINYIN_MODES.includes(v?.translation as PinyinMode) ? (v!.translation as PinyinMode) : defaults.translation,
      size: TEXT_SIZES.includes(v?.size as TextSize) ? (v!.size as TextSize) : defaults.size,
    };
  } catch {
    return defaults;
  }
}

export const serializeReaderPrefs = (p: ReaderPrefs): string => JSON.stringify(p);

/** Các phần tử pinyin của bài (cùng danh sách với quy tắc CSS `data-rd-pinyin` ở globals.css). */
export const PINYIN_SELECTOR = "ruby.ruby-han > rt, .hsk-py, .hsk-fc-b-py, .py-latin";

/** Bản dịch của bài (đoạn có `data-rd-tr`): hiện/ẩn theo tuỳ chọn "Bản dịch" của bảng Aa. */
export const TRANSLATION_SELECTOR = "[data-rd-tr]";

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
