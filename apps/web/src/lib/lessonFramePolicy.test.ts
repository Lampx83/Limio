import { describe, expect, it } from "vitest";
import { lessonViewModes, resolveLessonView, type LessonViewInput } from "./lessonFramePolicy";
import {
  defaultPanelOpen,
  isLessonFrameAllCoursesEnabled,
  isLearnerInCourse,
  lessonFrameApplies,
  lessonLevelLabel,
  panelIsDocked,
  panelWidthClass,
  previewHidesSiteChrome,
  readPanelOpenPref,
  readPanelTabPref,
  writePanelOpenPref,
  writePanelTabPref,
  type LessonFrameInput,
} from "./lessonFramePolicy";

const base: LessonFrameInput = {
  languageMode: false,
  allCoursesEnabled: true,
  enrolled: true,
  learnerRole: true,
  previewMode: false,
  stageMode: false,
  teacherMode: false,
  hasDeckCover: false,
};

describe("lessonFrameApplies", () => {
  it("học viên đã ghi danh ở khoá thường: có khung (công tắc bật)", () => {
    expect(lessonFrameApplies(base)).toBe(true);
  });
  it("giữ giao diện cũ cho: chưa ghi danh, không phải học viên, chiếu lớp, giảng viên đứng lớp, bài có slide", () => {
    for (const patch of [
      { enrolled: false },
      { learnerRole: false },
      { stageMode: true },
      { teacherMode: true },
      { hasDeckCover: true },
    ]) {
      expect(lessonFrameApplies({ ...base, ...patch })).toBe(false);
      expect(lessonFrameApplies({ ...base, languageMode: true, ...patch })).toBe(false);
    }
  });
  it("giảng viên xem như học viên (không ghi danh, không phải vai học viên) cũng có khung, như học viên đã ghi danh", () => {
    const t = { ...base, enrolled: false, learnerRole: false, previewMode: true };
    expect(lessonFrameApplies(t)).toBe(true);
    expect(lessonFrameApplies({ ...t, languageMode: true, allCoursesEnabled: false })).toBe(true);
    expect(lessonFrameApplies({ ...t, allCoursesEnabled: false })).toBe(false); // công tắc tắt + khoá thường: giao diện cũ
    for (const patch of [{ stageMode: true }, { teacherMode: true }, { hasDeckCover: true }]) {
      expect(lessonFrameApplies({ ...t, ...patch })).toBe(false);
    }
  });
  it("công tắc tắt: khoá thường quay về giao diện cũ, khoá ngoại ngữ vẫn có khung", () => {
    expect(lessonFrameApplies({ ...base, allCoursesEnabled: false })).toBe(false);
    expect(lessonFrameApplies({ ...base, allCoursesEnabled: false, languageMode: true })).toBe(true);
  });
  it("đọc công tắc: chỉ 'false' mới tắt", () => {
    expect(isLessonFrameAllCoursesEnabled(null)).toBe(true);
    expect(isLessonFrameAllCoursesEnabled("true")).toBe(true);
    expect(isLessonFrameAllCoursesEnabled("")).toBe(true);
    expect(isLessonFrameAllCoursesEnabled("false")).toBe(false);
  });
});

describe("nhãn cấp trên bài", () => {
  it("Unit ở khoá ngoại ngữ, Module ở khoá khác", () => {
    expect(lessonLevelLabel(true)).toBe("Unit");
    expect(lessonLevelLabel(false)).toBe("Module");
  });
});

describe("panel phải theo chiều ngang", () => {
  it("phân lớp 1536 / 1280 và mặc định mở/đóng", () => {
    expect(panelWidthClass(1920)).toBe("wide");
    expect(panelWidthClass(1536)).toBe("wide");
    expect(panelWidthClass(1535)).toBe("mid");
    expect(panelWidthClass(1280)).toBe("mid");
    expect(panelWidthClass(1279)).toBe("narrow");
    expect(panelWidthClass(375)).toBe("narrow");
    expect(defaultPanelOpen("wide")).toBe(true);
    expect(defaultPanelOpen("mid")).toBe(false);
    expect(defaultPanelOpen("narrow")).toBe(false);
    expect(panelIsDocked("wide")).toBe(true);
    expect(panelIsDocked("mid")).toBe(true);
    expect(panelIsDocked("narrow")).toBe(false);
  });
  it("nhớ mở/đóng riêng theo lớp chiều ngang; tab mặc định là AI", () => {
    const mem = new Map<string, string>();
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
    expect(readPanelOpenPref(storage, "mid")).toBeNull();
    writePanelOpenPref(storage, "wide", false);
    writePanelOpenPref(storage, "mid", true);
    expect(readPanelOpenPref(storage, "wide")).toBe(false);
    expect(readPanelOpenPref(storage, "mid")).toBe(true);
    expect(readPanelOpenPref(storage, "narrow")).toBeNull();
    expect(readPanelTabPref(storage)).toBe("ai");
    writePanelTabPref(storage, "notes");
    expect(readPanelTabPref(storage)).toBe("notes");
  });
  it("lưu trữ bị chặn hoặc không có: không ném lỗi, coi như chưa chọn", () => {
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    expect(readPanelOpenPref(blocked, "mid")).toBeNull();
    expect(() => writePanelOpenPref(blocked, "mid", true)).not.toThrow();
    expect(readPanelTabPref(blocked)).toBe("ai");
    expect(readPanelOpenPref(null, "wide")).toBeNull();
  });
});

describe("xem thử ẩn header/footer của site", () => {
  it("chỉ ẩn ở xem thử bản cũ không khung; có khung 3 cột thì hiện như học viên; không xem thử thì không ẩn", () => {
    expect(previewHidesSiteChrome(true, false)).toBe(true);
    expect(previewHidesSiteChrome(true, true)).toBe(false);
    expect(previewHidesSiteChrome(false, false)).toBe(false);
    expect(previewHidesSiteChrome(false, true)).toBe(false);
  });
});

describe("isLearnerInCourse", () => {
  it("vai học viên: luôn là học viên", () => {
    expect(isLearnerInCourse({ activeRoleIsLearner: true, enrolled: false, canEdit: false })).toBe(true);
  });
  it("giảng viên khác được mời vào lớp (đã ghi danh, không có quyền sửa khoá): là học viên của khoá này", () => {
    expect(isLearnerInCourse({ activeRoleIsLearner: false, enrolled: true, canEdit: false })).toBe(true);
  });
  it("người dạy khoá này (có quyền sửa) hoặc chưa ghi danh: vẫn là giảng viên", () => {
    expect(isLearnerInCourse({ activeRoleIsLearner: false, enrolled: true, canEdit: true })).toBe(false);
    expect(isLearnerInCourse({ activeRoleIsLearner: false, enrolled: false, canEdit: false })).toBe(false);
  });
});

describe("lessonFrameApplies: người dạy khoá ngoại ngữ thấy sẵn khung (teacherFrame)", () => {
  const base = { languageMode: true, allCoursesEnabled: false, enrolled: false, learnerRole: false, previewMode: false, stageMode: false, teacherMode: false, hasDeckCover: false };
  it("bật khung cho khoá ngoại ngữ dù chưa ghi danh", () => {
    expect(lessonFrameApplies({ ...base, teacherFrame: true })).toBe(true);
  });
  it("không bật cho khoá không phải ngoại ngữ (kể cả khi công tắc mọi khoá tắt)", () => {
    expect(lessonFrameApplies({ ...base, languageMode: false, teacherFrame: true })).toBe(false);
  });
  it("giảng viên đứng lớp (?gv=1), màn chiếu cũ và bài có bài giảng slide vẫn giữ giao diện cũ", () => {
    expect(lessonFrameApplies({ ...base, teacherFrame: true, teacherMode: true })).toBe(false);
    expect(lessonFrameApplies({ ...base, teacherFrame: true, stageMode: true })).toBe(false);
    expect(lessonFrameApplies({ ...base, teacherFrame: true, hasDeckCover: true })).toBe(false);
  });
  it("không có cờ thì người dạy chưa ghi danh vẫn thấy giao diện cũ như trước", () => {
    expect(lessonFrameApplies({ ...base })).toBe(false);
  });
});

/* ---------- ma trận hiển thị của trang bài học (resolveLessonView) ---------- */
describe("resolveLessonView: ma trận người xem × chế độ × loại khoá", () => {
  const v = (o: Partial<LessonViewInput>) =>
    resolveLessonView({
      canEdit: false,
      canTeach: false,
      languageMode: true,
      allCoursesEnabled: true,
      enrolled: false,
      activeRoleIsLearner: false,
      hasDeckCover: false,
      ...o,
    });
  const owner = { canEdit: true, canTeach: true };

  it("học viên đã ghi danh: khung bài học (khoá ngoại ngữ, và khoá khác khi bật mọi khoá)", () => {
    expect(v({ enrolled: true, activeRoleIsLearner: true }).frame).toBe(true);
    expect(v({ enrolled: true, activeRoleIsLearner: true, languageMode: false }).frame).toBe(true);
    expect(v({ enrolled: true, activeRoleIsLearner: true, languageMode: false, allCoursesEnabled: false }).frame).toBe(false);
  });

  it("người đọc ở vai học viên (không phải người dạy của khoá) chưa ghi danh: không khung, không nút giảng viên", () => {
    const d = v({ activeRoleIsLearner: true });
    expect(d).toMatchObject({ frame: false, teachSlide: false, teacherFrame: false });
  });

  it("người dạy khoá NGOẠI NGỮ chọn vai học viên, chưa ghi danh: là 'Xem như học viên' (khung, bài luyện bản xem thử), không nút Slide, không nút giảng viên", () => {
    const d = v({ activeRoleIsLearner: true, asLearnerStaff: true });
    expect(d).toMatchObject({ frame: true, previewMode: true, teacherFrame: false, teachSlide: false, practiceAsPreview: true, teacherMode: false });
  });

  it("vai học viên của người dạy ở khoá KHÁC (không ngoại ngữ) không đổi: asLearnerStaff bị bỏ qua", () => {
    expect(v({ activeRoleIsLearner: true, asLearnerStaff: true, languageMode: false })).toMatchObject({ frame: false, previewMode: false });
  });

  it("người dạy khoá NGOẠI NGỮ, không tham số: khung + nút Slide, không phải xem trước", () => {
    expect(v({ ...owner })).toMatchObject({ frame: true, teacherFrame: true, previewMode: false, teachSlide: true, practiceAsPreview: true });
  });

  it("người dạy khoá ngoại ngữ đã ghi danh vào khoá của mình: vẫn khung giảng viên (không rơi về giao diện cũ)", () => {
    expect(v({ ...owner, enrolled: true })).toMatchObject({ frame: true, teacherFrame: true, practiceAsPreview: true });
  });

  it("?preview=1: khung như học viên nhưng vẫn có nút Slide", () => {
    expect(v({ ...owner, preview: "1" })).toMatchObject({ frame: true, previewMode: true, teacherFrame: false, teachSlide: true, practiceAsPreview: true });
  });

  it("?preview=0 và ?gv=1 bị bỏ qua ở khoá ngoại ngữ: vẫn khung + nút giảng viên (chỉ còn ba trạng thái)", () => {
    expect(v({ ...owner, preview: "0" })).toMatchObject({ frame: true, teacherFrame: true, previewMode: false, teachSlide: true });
    expect(v({ ...owner, gv: "1" })).toMatchObject({ frame: true, teacherFrame: true, teacherMode: false, teachSlide: true });
  });

  it("?stage=1 (màn chiếu cũ): không khung và không nút Slide", () => {
    expect(v({ ...owner, stage: "1" })).toMatchObject({ frame: false, stageMode: true, teachSlide: false });
  });

  it("khoá khác ngoại ngữ vẫn có ?gv=1 (đứng lớp) và ?preview=0 như cũ", () => {
    const o = { canEdit: true, canTeach: false, languageMode: false };
    expect(v({ ...o, gv: "1" })).toMatchObject({ frame: false, teacherMode: true });
    expect(v({ ...o, preview: "0" })).toMatchObject({ frame: false, teacherFrame: false, previewMode: false });
  });

  it("bài có bài giảng slide (bố cục riêng): không khung ở mọi vai", () => {
    expect(v({ ...owner, hasDeckCover: true }).frame).toBe(false);
    expect(v({ enrolled: true, activeRoleIsLearner: true, hasDeckCover: true }).frame).toBe(false);
  });

  it("khoá KHÔNG phải ngoại ngữ: người dạy giữ giao diện cũ; chỉ ?preview=1 mới có khung và chỉ khi bật mọi khoá; không có nút Slide của Chiếu lớp", () => {
    const o = { canEdit: true, canTeach: false, languageMode: false };
    expect(v(o)).toMatchObject({ frame: false, teacherFrame: false, teachSlide: false });
    expect(v({ ...o, preview: "1" }).frame).toBe(true);
    expect(v({ ...o, preview: "1", allCoursesEnabled: false }).frame).toBe(false);
  });

  it("giảng viên không sửa / trợ giảng ĐÃ GHI DANH (canTeach, không canEdit): thấy khung như học viên + nút Slide, bài luyện làm thật", () => {
    expect(v({ canEdit: false, canTeach: true, enrolled: true })).toMatchObject({ frame: true, teachSlide: true, teacherFrame: false, practiceAsPreview: false, teachView: false });
  });

  it("giảng viên không sửa / trợ giảng CHƯA ghi danh (trung tâm phân giảng): vào bài ở chế độ xem, có Slide, không nút soạn, bài luyện bản xem thử", () => {
    expect(v({ canEdit: false, canTeach: true })).toMatchObject({ frame: true, teachView: true, previewMode: true, teachSlide: true, teacherFrame: false, practiceAsPreview: true });
  });

  it("người dạy không sửa ở màn chiếu cũ (?stage=1): không chế độ xem, không Slide", () => {
    expect(v({ canEdit: false, canTeach: true, stage: "1" })).toMatchObject({ frame: false, teachView: false, teachSlide: false });
  });

  it("người dạy không sửa ở khoá KHÔNG phải ngoại ngữ: không có chế độ xem (canTeach chỉ có ở khoá ngoại ngữ)", () => {
    expect(v({ canEdit: false, canTeach: true, languageMode: false })).toMatchObject({ teachView: false });
  });

  it("giảng viên khác vào lớp bằng link mời (không sửa, đã ghi danh, không có quyền dạy): khung học viên, không nút", () => {
    expect(v({ enrolled: true })).toMatchObject({ frame: true, teachSlide: false });
  });

  it("bất biến trên toàn bộ tổ hợp", () => {
    const bool = [false, true];
    const params = [undefined, "0", "1"];
    for (const canEdit of bool) for (const canTeachRaw of bool) for (const languageMode of bool) for (const allCoursesEnabled of bool)
      for (const enrolled of bool) for (const activeRoleIsLearner of bool) for (const hasDeckCover of bool)
        for (const preview of params) for (const gv of params) for (const stage of params) {
          // canTeach ngụ ý canEdit hoặc không (giảng viên không sửa), và chỉ có ở khoá ngoại ngữ; chủ khoá ở vai học viên thì cả hai đều false.
          const canTeach = canTeachRaw && languageMode && !(activeRoleIsLearner);
          const ce = canEdit && !activeRoleIsLearner;
          // Người dạy (có quyền sửa nếu không chọn vai học viên) ở vai học viên và chưa ghi danh: khoá ngoại ngữ coi như "Xem như học viên".
          const asLearnerStaff = canEdit && activeRoleIsLearner && !enrolled;
          const d = resolveLessonView({ canEdit: ce, canTeach: canTeach || (ce && languageMode), languageMode, allCoursesEnabled, enrolled, activeRoleIsLearner, asLearnerStaff, hasDeckCover, preview, gv, stage });
          const tag = JSON.stringify({ ce, languageMode, enrolled, activeRoleIsLearner, hasDeckCover, preview, gv, stage });
          // màn chiếu cũ, ?gv=1 và bài có bài giảng slide không bao giờ có khung
          if (d.stageMode || d.teacherMode || hasDeckCover) expect(d.frame, tag).toBe(false);
          // các chế độ của người dạy chỉ có khi người dạy có quyền sửa (riêng "xem như học viên" còn có từ vai học viên của người dạy ở khoá ngoại ngữ)
          if (d.teacherMode || d.teacherFrame) expect(ce, tag).toBe(true);
          if (d.previewMode) expect(ce || (asLearnerStaff && languageMode) || d.teachView, tag).toBe(true);
          // chế độ xem của người dạy không sửa: chỉ khoá ngoại ngữ, chưa ghi danh, không phải người sửa được, và luôn có Slide
          if (d.teachView) {
            expect(languageMode && !enrolled && !ce, tag).toBe(true);
            expect(d.teachSlide, tag).toBe(true);
            if (!hasDeckCover) expect(d.frame && d.practiceAsPreview, tag).toBe(true);
          }
          // ?gv=1 và ?preview=0 chỉ còn ý nghĩa ở khoá không phải ngoại ngữ
          if (languageMode) expect(d.teacherMode, tag).toBe(false);
          // vai học viên không bao giờ có nút của người dạy
          if (asLearnerStaff) expect(d.teachSlide || d.teacherFrame, tag).toBe(false);
          // khung của người dạy chỉ ở khoá ngoại ngữ; bài luyện bản xem trước chỉ trong khung và chỉ cho người sửa được
          if (d.teacherFrame) expect(languageMode, tag).toBe(true);
          if (d.practiceAsPreview) expect(d.frame && (ce || asLearnerStaff || d.teachView), tag).toBe(true);
          // một người dạy có quyền sửa, khoá ngoại ngữ, không ở màn chiếu cũ và không có bài giảng slide thì LUÔN thấy khung (gv và preview=0 không còn đổi được)
          if (ce && languageMode && !preview && !stage && !hasDeckCover) expect(d.frame, tag).toBe(true);
          // nút Slide không hiện ở màn chiếu cũ
          if (d.stageMode) expect(d.teachSlide, tag).toBe(false);
        }
  });
});
