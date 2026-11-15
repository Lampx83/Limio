import { describe, expect, it, vi } from "vitest";
import { loadCourseLessonVideos, summarizeLessonVideos, videoDurationOf } from "./lessonVideo";

describe("videoDurationOf", () => {
  it("chỉ nhận số dương hữu hạn", () => {
    expect(videoDurationOf({ url: "x", durationSec: 120 })).toBe(120);
    for (const p of [null, undefined, "x", 5, {}, { durationSec: 0 }, { durationSec: -3 }, { durationSec: "90" }, { durationSec: NaN }, { durationSec: Infinity }]) {
      expect(videoDurationOf(p)).toBeNull();
    }
  });
});

describe("summarizeLessonVideos", () => {
  it("bài không có video thì không có trong map", () => {
    const m = summarizeLessonVideos([{ lessonId: "a", payload: { durationSec: 60 } }]);
    expect(m.has("a")).toBe(true);
    expect(m.has("b")).toBe(false);
  });

  it("cộng thời lượng nhiều video của cùng bài; thiếu durationSec thì bỏ qua phần đó", () => {
    const m = summarizeLessonVideos([
      { lessonId: "a", payload: { durationSec: 600 } },
      { lessonId: "a", payload: { url: "no-duration" } },
      { lessonId: "a", payload: { durationSec: 90 } },
      { lessonId: "b", payload: { url: "no-duration" } },
    ]);
    expect(m.get("a")).toEqual({ durationSec: 690 });
    // Có video nhưng không biết dài bao lâu: vẫn hiện dấu, không bịa thời lượng.
    expect(m.get("b")).toEqual({ durationSec: null });
  });
});

describe("loadCourseLessonVideos", () => {
  it("chỉ hỏi khối type=video chưa ẩn của đúng khoá, và chỉ lấy lessonId + payload", async () => {
    const findMany = vi.fn().mockResolvedValue([{ lessonId: "l1", payload: { durationSec: 2040 } }]);
    const m = await loadCourseLessonVideos("course-1", { contentItem: { findMany } } as never);
    expect(findMany).toHaveBeenCalledWith({
      where: { type: "video", isHidden: false, lesson: { module: { courseId: "course-1" } } },
      select: { lessonId: true, payload: true },
    });
    expect(m.get("l1")).toEqual({ durationSec: 2040 });
  });
});
