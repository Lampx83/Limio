/**
 * Khung bài học 3 cột (bài trong unit/module · nội dung · panel AI trợ giảng + Ghi chú) cho mọi khoá — quy tắc thuần
 * (docs/tieu-chi/limio-language-bai-hoc-3-cot.md). Tách khỏi component để kiểm thử được mà không cần vẽ giao diện.
 */

/** Cài đặt hệ thống (`SiteSetting`): đặt "false" thì khung chỉ còn cho khoá ngoại ngữ như trước. Thiếu/khác "false" = bật. */
export const LESSON_FRAME_ALL_COURSES_KEY = "lesson_frame.all_courses";

export function isLessonFrameAllCoursesEnabled(settingValue: string | null | undefined): boolean {
  return settingValue !== "false";
}

/** Nhãn cấp trên bài: "Unit" ở khoá ngoại ngữ, "Module" ở mọi khoá khác (thầy chốt 10/11/2026). */
export function lessonLevelLabel(languageMode: boolean): "Unit" | "Module" {
  return languageMode ? "Unit" : "Module";
}

export interface LessonFrameInput {
  languageMode: boolean;
  /** Giá trị `lesson_frame.all_courses` (đã đọc từ SiteSetting). */
  allCoursesEnabled: boolean;
  enrolled: boolean;
  learnerRole: boolean;
  previewMode: boolean;
  stageMode: boolean;
  teacherMode: boolean;
  /** Bài có bài giảng slide (bố cục riêng toàn màn hình): ngoại lệ ở đợt này. */
  hasDeckCover: boolean;
}

/**
 * Có dùng khung 3 cột không. Học viên ĐÃ GHI DANH, và giảng viên đang "xem như học viên" (`previewMode`, để thấy đúng cái học viên thấy);
 * giữ giao diện cũ cho người đọc chưa ghi danh, chiếu lớp, giảng viên đứng lớp và bài có bài giảng slide. Công tắc tắt thì chỉ còn khoá ngoại ngữ.
 */
export function lessonFrameApplies(i: LessonFrameInput): boolean {
  if (i.stageMode || i.teacherMode || i.hasDeckCover) return false;
  if (i.previewMode) return i.languageMode || i.allCoursesEnabled;
  if (!i.enrolled || !i.learnerRole) return false;
  return i.languageMode || i.allCoursesEnabled;
}

export type PanelTab = "ai" | "notes";
export type PanelWidthClass = "wide" | "mid" | "narrow";

/** Từ 1536 px: gắn cố định, mở sẵn. 1280–1535 px: gắn cố định, đóng sẵn. Dưới 1280 px: ngăn kéo che lên trang. */
export function panelWidthClass(widthPx: number): PanelWidthClass {
  if (widthPx >= 1536) return "wide";
  if (widthPx >= 1280) return "mid";
  return "narrow";
}

export function defaultPanelOpen(cls: PanelWidthClass): boolean {
  return cls === "wide";
}

/** Panel gắn cố định cạnh nội dung (true) hay che lên trang như ngăn kéo (false). */
export function panelIsDocked(cls: PanelWidthClass): boolean {
  return cls !== "narrow";
}

const PREF_PREFIX = "limio:lesson-panel:";
type StorageLike = Pick<Storage, "getItem" | "setItem">;

/** Lựa chọn mở/đóng được nhớ RIÊNG theo lớp chiều ngang (mở sẵn ở màn rộng không kéo theo mở ở màn laptop). null = chưa chọn. */
export function readPanelOpenPref(storage: StorageLike | null, cls: PanelWidthClass): boolean | null {
  try {
    const v = storage?.getItem(`${PREF_PREFIX}open:${cls}`);
    return v === "1" ? true : v === "0" ? false : null;
  } catch {
    return null;
  }
}

export function writePanelOpenPref(storage: StorageLike | null, cls: PanelWidthClass, open: boolean): void {
  try {
    storage?.setItem(`${PREF_PREFIX}open:${cls}`, open ? "1" : "0");
  } catch {
    /* lưu trữ bị chặn: vẫn chạy, chỉ không nhớ */
  }
}

export function readPanelTabPref(storage: StorageLike | null): PanelTab {
  try {
    return storage?.getItem(`${PREF_PREFIX}tab`) === "notes" ? "notes" : "ai";
  } catch {
    return "ai";
  }
}

export function writePanelTabPref(storage: StorageLike | null, tab: PanelTab): void {
  try {
    storage?.setItem(`${PREF_PREFIX}tab`, tab);
  } catch {
    /* như trên */
  }
}
