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
  /**
   * Người dạy (sửa được khoá) mở bài của khoá NGOẠI NGỮ mà không chọn chế độ nào: thấy sẵn khung bài học như học viên (thầy chốt 26/11/2026), vẫn giữ
   * các nút của giảng viên. (Khoá ngoại ngữ không còn giao diện giảng viên cũ.)
   */
  teacherFrame?: boolean;
}

/**
 * Người này có đang là HỌC VIÊN của khoá này không (để `lessonFrameApplies` bật khung). Vai "học viên" thì đương nhiên. Giảng viên khác được mời vào lớp
 * bằng link `/enroll/<mã>` thì tài khoản vẫn ở vai "giảng viên" nhưng ở khoá này họ chỉ là người học: đã ghi danh và KHÔNG có quyền sửa khoá,
 * nên phải thấy đúng giao diện học viên (khoá ngoại ngữ: khung bài học riêng). Người dạy khoá này (chủ khoá, đồng giảng viên, quản trị) giữ giao diện giảng viên.
 */
export function isLearnerInCourse(i: { activeRoleIsLearner: boolean; enrolled: boolean; canEdit: boolean }): boolean {
  return i.activeRoleIsLearner || (i.enrolled && !i.canEdit);
}

/**
 * Có dùng khung 3 cột không. Học viên ĐÃ GHI DANH, và giảng viên đang "xem như học viên" (`previewMode`, để thấy đúng cái học viên thấy);
 * giữ giao diện cũ cho người đọc chưa ghi danh, chiếu lớp, giảng viên đứng lớp và bài có bài giảng slide. Công tắc tắt thì chỉ còn khoá ngoại ngữ.
 */
export function lessonFrameApplies(i: LessonFrameInput): boolean {
  if (i.stageMode || i.teacherMode || i.hasDeckCover) return false;
  if (i.teacherFrame) return i.languageMode;
  if (i.previewMode) return i.languageMode || i.allCoursesEnabled;
  if (!i.enrolled || !i.learnerRole) return false;
  return i.languageMode || i.allCoursesEnabled;
}

/**
 * MỌI quyết định hiển thị của trang bài học (giao diện giảng viên cũ / khung bài học / nút của giảng viên) gom ở đây để rà được trong một chỗ
 * và kiểm thử cả ma trận (lessonFramePolicy.test.ts). Trang bài học chỉ đọc kết quả, không tự so sánh các cờ.
 *
 * Bảng quyết định (vai "người dạy" = `canEdit`: chủ khoá, đồng giảng viên, quản trị, và KHÔNG đang chọn vai học viên):
 *
 * | Ai mở                                            | Địa chỉ        | Khoá ngoại ngữ                       | Khoá khác                         |
 * |--------------------------------------------------|----------------|--------------------------------------|-----------------------------------|
 * | Học viên đã ghi danh (hoặc đang ở vai học viên)  | bất kỳ         | khung bài học                        | khung (nếu bật mọi khoá) / cũ     |
 * | Người dạy                                        | không tham số  | khung bài học + nút giảng viên       | giao diện giảng viên cũ           |
 * | Người dạy                                        | ?preview=1     | khung, như học viên (chỉ còn "Slide")| khung nếu bật mọi khoá, không thì cũ |
 * | Người dạy                                        | ?preview=0     | như không tham số (bỏ qua)           | giao diện giảng viên cũ           |
 * | Người dạy                                        | ?gv=1          | như không tham số (bỏ qua)           | cũ + ghi chú giảng viên           |
 * | Người dạy chọn vai "học viên", chưa ghi danh     | bất kỳ         | như ?preview=1 ("Xem như học viên")  | trang người đọc chưa ghi danh     |
 * | Bất kỳ                                           | ?stage=1       | màn chiếu cũ (không khung)           | màn chiếu cũ                      |
 * | Bài có bài giảng slide (bố cục riêng)            | bất kỳ         | cũ                                   | cũ                                |
 * | Chưa ghi danh, không phải người dạy              | —              | không qua đây (trang xem thử/chuyển) |                                   |
 *
 * Nút "Slide" (mở Chiếu lớp) hiện cho người dạy của khoá ngoại ngữ (`canTeach`: kể cả giảng viên không sửa, trợ giảng đã ghi danh) ở mọi chế độ trừ màn chiếu cũ.
 */
export interface LessonViewModesInput {
  canEdit: boolean;
  /**
   * Người dạy của khoá NGOẠI NGỮ đang chọn vai "học viên" (RoleSwitcher) và chưa ghi danh: vai này là "Xem như học viên" (cùng giao diện với `?preview=1`),
   * không phải trang người đọc chưa ghi danh (bị chuyển đi hoặc chặn thanh toán) trên chính khoá của mình.
   */
  asLearnerStaff?: boolean;
  /** Người dạy của khoá NGOẠI NGỮ (chủ, đồng giảng viên, không sửa, trợ giảng, quản trị; không đang chọn vai học viên); false nếu không phải khoá ngoại ngữ. */
  canTeach: boolean;
  languageMode: boolean;
  preview?: string;
  gv?: string;
  stage?: string;
}

export interface LessonViewModes {
  stageMode: boolean;
  teacherMode: boolean;
  previewMode: boolean;
  teacherFrame: boolean;
  teachSlide: boolean;
}

export function lessonViewModes(i: LessonViewModesInput): LessonViewModes {
  const stageMode = i.stage === "1";
  // Khoá ngoại ngữ chỉ có ba trạng thái: mặc định (khung + nút giảng viên), "Xem như học viên" (`?preview=1` hoặc vai học viên) và Slide (Chiếu lớp).
  // `?gv=1` (đứng lớp) và `?preview=0` (giao diện giảng viên cũ) bị bỏ qua ở khoá ngoại ngữ: Slide đã gồm ghi chú giảng viên và đồng hồ.
  const teacherMode = i.canEdit && i.gv === "1" && !i.languageMode;
  const asLearnerStaff = !!i.asLearnerStaff && i.languageMode;
  const previewMode = (i.canEdit && i.preview === "1") || asLearnerStaff;
  const teacherFrame = i.canEdit && i.languageMode && !previewMode && !stageMode;
  return { stageMode, teacherMode, previewMode, teacherFrame, teachSlide: i.canTeach && !stageMode };
}

export interface LessonViewInput extends LessonViewModesInput {
  allCoursesEnabled: boolean;
  enrolled: boolean;
  activeRoleIsLearner: boolean;
  hasDeckCover: boolean;
}

export interface LessonViewDecision extends LessonViewModes {
  learnerRole: boolean;
  /** Dùng khung bài học 3 cột (và giao diện riêng của ngoại ngữ nếu là khoá ngoại ngữ). */
  frame: boolean;
  /** Bài luyện trong khung dùng bản xem trước của giảng viên (không tạo buổi luyện, không ghi gì). */
  practiceAsPreview: boolean;
}

export function resolveLessonView(i: LessonViewInput): LessonViewDecision {
  const m = lessonViewModes(i);
  const learnerRole = isLearnerInCourse({ activeRoleIsLearner: i.activeRoleIsLearner, enrolled: i.enrolled, canEdit: i.canEdit });
  const frame = lessonFrameApplies({
    languageMode: i.languageMode,
    allCoursesEnabled: i.allCoursesEnabled,
    enrolled: i.enrolled,
    learnerRole,
    previewMode: m.previewMode,
    stageMode: m.stageMode,
    teacherMode: m.teacherMode,
    hasDeckCover: i.hasDeckCover,
    teacherFrame: m.teacherFrame,
  });
  return { ...m, learnerRole, frame, practiceAsPreview: frame && (m.previewMode || m.teacherFrame) };
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

/**
 * Xem thử của giảng viên (`?preview=1`) có ẩn header và footer của site không. Bản cũ (không khung) chỉ còn tên bài + nội dung nên ẩn
 * cho gọn; khi có khung 3 cột, xem thử phải giống hệt học viên đã ghi danh (thầy 11/11/2026) nên header và footer hiện như thường.
 */
export function previewHidesSiteChrome(previewMode: boolean, frameOn: boolean): boolean {
  return previewMode && !frameOn;
}
