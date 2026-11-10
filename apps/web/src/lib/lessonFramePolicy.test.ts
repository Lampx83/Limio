import { describe, expect, it } from "vitest";
import {
  defaultPanelOpen,
  isLessonFrameAllCoursesEnabled,
  lessonFrameApplies,
  lessonLevelLabel,
  panelIsDocked,
  panelWidthClass,
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
