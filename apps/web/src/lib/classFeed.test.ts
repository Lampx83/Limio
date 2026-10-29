import { describe, expect, it } from "vitest";
import {
  buildFeed,
  classifyFeedEvent,
  joinNames,
  learnerFeedName,
  type FeedInput,
} from "./classFeed";

const T0 = new Date("2026-10-29T08:00:00Z");
const minutesAfter = (m: number) => new Date(T0.getTime() + m * 60_000);

function lessonDone(userId: string, name: string, at: Date, lessonId = "L1"): FeedInput {
  return {
    id: `${userId}-${lessonId}`,
    occurredAt: at,
    userId,
    name,
    avatarUrl: null,
    courseId: "C1",
    courseTitle: "Thiết kế UI/UX",
    cls: classifyFeedEvent("lesson.completed", { lessonId })!,
    targetTitle: "Bài 2.3",
  };
}

describe("classifyFeedEvent", () => {
  it("chỉ nhận các khoảnh khắc tích cực; sự kiện khác bị bỏ", () => {
    expect(classifyFeedEvent("lesson.completed", { lessonId: "L1" })?.targetId).toBe("L1");
    expect(classifyFeedEvent("badge.earned", { badgeName: "Bước đầu" })?.detail).toBe("Bước đầu");
    expect(classifyFeedEvent("quiz.question.answered", { isCorrect: false })).toBeNull();
    expect(classifyFeedEvent("ai.tutor.asked", {})).toBeNull();
    expect(classifyFeedEvent("lesson.viewed", {})).toBeNull();
  });

  it("payload hỏng không làm hàm văng lỗi", () => {
    expect(classifyFeedEvent("lesson.completed", null)?.targetId).toBeNull();
    expect(classifyFeedEvent("lesson.completed", "x")?.targetId).toBeNull();
  });

  it("không đưa điểm số vào kết quả quiz", () => {
    const c = classifyFeedEvent("quiz.submitted", { quizId: "Q1", scorePct: 12 })!;
    expect(JSON.stringify(c)).not.toContain("12");
  });
});

describe("learnerFeedName", () => {
  it("ẩn danh khi học viên tắt hiển thị công khai hoặc không có tên", () => {
    expect(learnerFeedName({ displayName: "Lan", leaderboardOptOut: false })).toBe("Lan");
    expect(learnerFeedName({ displayName: "Lan", leaderboardOptOut: true })).toBe("Một học viên");
    expect(learnerFeedName({ displayName: "  ", leaderboardOptOut: false })).toBe("Một học viên");
  });
});

describe("joinNames", () => {
  it("ghép tên gọn", () => {
    expect(joinNames(["A"])).toBe("A");
    expect(joinNames(["A", "B"])).toBe("A và B");
    expect(joinNames(["A", "B", "C"], 5)).toBe("A, B và 3 bạn khác");
  });
});

describe("buildFeed", () => {
  it("dưới 3 người cùng làm một việc thì giữ từng dòng, mới nhất trước", () => {
    const feed = buildFeed([lessonDone("u1", "Lan", minutesAfter(1)), lessonDone("u2", "Minh", minutesAfter(5))], 6);
    expect(feed.map((f) => f.names)).toEqual(["Minh", "Lan"]);
    expect(feed[0]!.phrase).toBe("vừa hoàn thành bài");
  });

  it("từ 3 người trở lên gộp thành một dòng, đổi 'vừa' thành 'đã'", () => {
    const feed = buildFeed(
      ["u1", "u2", "u3", "u4", "u5"].map((u, i) => lessonDone(u, `HV${i + 1}`, minutesAfter(i))),
      6,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0]!.total).toBe(5);
    expect(feed[0]!.people).toHaveLength(3);
    expect(feed[0]!.names).toBe("HV5, HV4 và 3 bạn khác");
    expect(feed[0]!.phrase).toBe("đã hoàn thành bài");
  });

  it("một học viên làm lại cùng việc nhiều lần chỉ tính một lần", () => {
    const feed = buildFeed(
      [lessonDone("u1", "Lan", minutesAfter(1)), lessonDone("u1", "Lan", minutesAfter(9)), lessonDone("u1", "Lan", minutesAfter(3))],
      6,
    );
    expect(feed).toHaveLength(1);
    expect(feed[0]!.occurredAt).toEqual(minutesAfter(9));
  });

  it("bài khác nhau không gộp vào nhau", () => {
    const feed = buildFeed(
      [lessonDone("u1", "A", minutesAfter(1), "L1"), lessonDone("u2", "B", minutesAfter(2), "L2"), lessonDone("u3", "C", minutesAfter(3), "L3")],
      6,
    );
    expect(feed).toHaveLength(3);
  });

  it("cắt theo limit", () => {
    const many = Array.from({ length: 10 }, (_, i) => lessonDone(`u${i}`, `HV${i}`, minutesAfter(i), `L${i}`));
    expect(buildFeed(many, 6)).toHaveLength(6);
  });
});
