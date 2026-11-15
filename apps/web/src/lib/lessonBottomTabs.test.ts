import { describe, expect, it } from "vitest";
import { lessonBottomTabs } from "./lessonBottomTabs";

/** docs/tieu-chi/limio-language-y-kien-hoc-vien-giao-dien.md — AC1. */
const keys = (r: ReturnType<typeof lessonBottomTabs>) => r.tabs.map((t) => t.key);

describe("lessonBottomTabs — khối Bài tập / Thảo luận cuối bài", () => {
  it("khoá thường: luôn hiện cả hai tab, kể cả khi trống", () => {
    const r = lessonBottomTabs({ languageMode: false, tasksCount: 0, tasksUndone: 0, threadsCount: 0 });
    expect(keys(r)).toEqual(["tasks", "forum"]);
    expect(r.defaultTab).toBe("forum");
  });

  it("khoá ngoại ngữ, bài trống: không tab nào (cả khối biến mất)", () => {
    const r = lessonBottomTabs({ languageMode: true, tasksCount: 0, tasksUndone: 0, threadsCount: 0 });
    expect(r.tabs).toEqual([]);
  });

  it("khoá ngoại ngữ, bài có bài tập giao: chỉ tab Bài tập, mặc định mở nó", () => {
    const r = lessonBottomTabs({ languageMode: true, tasksCount: 2, tasksUndone: 0, threadsCount: 0 });
    expect(keys(r)).toEqual(["tasks"]);
    expect(r.defaultTab).toBe("tasks");
  });

  it("khoá ngoại ngữ, bài đã có chủ đề thảo luận: tab Thảo luận vẫn hiện (không giấu dữ liệu)", () => {
    const r = lessonBottomTabs({ languageMode: true, tasksCount: 0, tasksUndone: 0, threadsCount: 3 });
    expect(keys(r)).toEqual(["forum"]);
    expect(r.tabs[0]!.count).toBe(3);
    expect(r.defaultTab).toBe("forum");
  });

  it("có cả hai: mở tab Bài tập khi còn bài chưa làm, ngược lại mở Thảo luận", () => {
    expect(lessonBottomTabs({ languageMode: true, tasksCount: 2, tasksUndone: 1, threadsCount: 1 }).defaultTab).toBe("tasks");
    expect(lessonBottomTabs({ languageMode: true, tasksCount: 2, tasksUndone: 0, threadsCount: 1 }).defaultTab).toBe("forum");
  });

  it("số đếm trên tab Bài tập là số bài chưa làm, trên Thảo luận là số chủ đề", () => {
    const r = lessonBottomTabs({ languageMode: false, tasksCount: 3, tasksUndone: 2, threadsCount: 5 });
    expect(r.tabs.map((t) => t.count)).toEqual([2, 5]);
  });
});
