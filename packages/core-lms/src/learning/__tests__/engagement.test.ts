import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import { mergeVideoRanges, recordLessonEngagement, videoRangesCoverageSec } from "../engagement";
import { LearningError } from "../lessons";
import { enrollInCourse } from "../enroll";
import { createCourse, publishCourse } from "../../courses/courses";
import { createModule } from "../../courses/modules";
import { createLesson } from "../../courses/lessons";
import { createContentItem } from "../../courses/contents";
import { registerUser } from "../../auth/register";

const BASE = "http://localhost:3000";

interface Setup {
  learnerId: string;
  outsiderId: string;
  lessonId: string;
  courseId: string;
}

async function setup(slug: string, opts?: { videoDurationSec?: number }): Promise<Setup> {
  const owner = await registerUser(
    { email: `eo-${slug}@e.com`, password: "password1234", displayName: "O" },
    BASE,
  );
  const learner = await registerUser(
    { email: `el-${slug}@e.com`, password: "password1234", displayName: "L" },
    BASE,
  );
  const outsider = await registerUser(
    { email: `ex-${slug}@e.com`, password: "password1234", displayName: "X" },
    BASE,
  );
  const c = await createCourse(owner.userId, { title: slug, description: "x", slug: `eng-${slug}` });
  const m = await createModule(owner.userId, c.courseId, { title: "M", orderIndex: 0 });
  const l = await createLesson(owner.userId, m.moduleId, { title: "L", orderIndex: 0 });
  if (opts?.videoDurationSec) {
    await createContentItem(owner.userId, l.lessonId, {
      type: "video",
      payload: { url: "https://example.com/v.mp4", durationSec: opts.videoDurationSec },
      orderIndex: 0,
    });
  }
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(learner.userId, c.courseId);
  return {
    learnerId: learner.userId,
    outsiderId: outsider.userId,
    lessonId: l.lessonId,
    courseId: c.courseId,
  };
}

const beat = (o: Partial<Record<string, unknown>> = {}) => ({
  activeSecDelta: 30,
  scrollPct: 0,
  videoPct: 0,
  sessionStart: false,
  sessionEnd: false,
  ...o,
});

describe("recordLessonEngagement", () => {
  it("cộng dồn thời gian qua nhiều nhịp, giữ mốc cuộn cao nhất", async () => {
    const s = await setup("a1");

    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionStart: true, scrollPct: 12 }));
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ scrollPct: 64 }));
    // Người học cuộn ngược lên đầu bài — mốc cao nhất phải giữ nguyên, không
    // được tụt theo vị trí hiện tại.
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ scrollPct: 5 }));

    const row = await prisma.lessonEngagement.findUniqueOrThrow({
      where: { userId_lessonId: { userId: s.learnerId, lessonId: s.lessonId } },
    });
    expect(row.activeSec).toBe(90);
    expect(row.maxScrollPct).toBe(64);
    expect(row.sessionCount).toBe(1);
    expect(row.courseId).toBe(s.courseId);
  });

  it("mỗi lượt ngồi đọc mới cộng thêm một vào sessionCount", async () => {
    const s = await setup("a2");
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionStart: true }));
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionEnd: true }));
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionStart: true }));

    const row = await prisma.lessonEngagement.findUniqueOrThrow({
      where: { userId_lessonId: { userId: s.learnerId, lessonId: s.lessonId } },
    });
    expect(row.sessionCount).toBe(2);
    expect(row.activeSec).toBe(90);
  });

  it("chỉ phát lesson.engaged khi khép lượt, không phát theo từng nhịp", async () => {
    const s = await setup("a3");
    const where = { userId: s.learnerId, eventType: LearningEventType.LessonEngaged };

    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionStart: true }));
    await recordLessonEngagement(s.learnerId, s.lessonId, beat());
    expect(await prisma.learningEvent.count({ where })).toBe(0);

    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ sessionEnd: true, scrollPct: 88, videoPct: 40 }),
    );
    const events = await prisma.learningEvent.findMany({ where });
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({
      lessonId: s.lessonId,
      activeSec: 30,
      scrollPct: 88,
      videoPct: 40,
      totalActiveSec: 90,
    });
    expect(events[0]!.courseId).toBe(s.courseId);
  });

  it("lượt 0 giây không sinh event — mở nhầm rồi đóng ngay không phải một lần học", async () => {
    const s = await setup("a4");
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ activeSecDelta: 0, sessionStart: true, sessionEnd: true }),
    );
    const n = await prisma.learningEvent.count({
      where: { userId: s.learnerId, eventType: LearningEventType.LessonEngaged },
    });
    expect(n).toBe(0);
  });

  it("người chưa ghi danh bị từ chối — không trộn vào số liệu người học", async () => {
    const s = await setup("a5");
    await expect(
      recordLessonEngagement(s.outsiderId, s.lessonId, beat()),
    ).rejects.toThrow(LearningError);
    expect(await prisma.lessonEngagement.count({ where: { userId: s.outsiderId } })).toBe(0);
  });

  it("chặn trần phần chênh — một nhịp không thể khai hàng giờ", async () => {
    const s = await setup("a6");
    await expect(
      recordLessonEngagement(s.learnerId, s.lessonId, beat({ activeSecDelta: 99999 })),
    ).rejects.toThrow(LearningError);
    await expect(
      recordLessonEngagement(s.learnerId, s.lessonId, beat({ scrollPct: 400 })),
    ).rejects.toThrow(LearningError);
  });
});

describe("mergeVideoRanges", () => {
  it("gộp hai đoạn chồng lấn thành một", () => {
    expect(mergeVideoRanges([[0, 30]], [[25, 60]])).toEqual([[0, 60]]);
  });

  it("hai đoạn tách rời giữ nguyên riêng biệt", () => {
    expect(mergeVideoRanges([[0, 30]], [[100, 120]])).toEqual([
      [0, 30],
      [100, 120],
    ]);
  });

  it("đoạn chạm đúng mép cũng được gộp", () => {
    expect(mergeVideoRanges([[0, 30]], [[30, 45]])).toEqual([[0, 45]]);
  });

  it("xem lại một đoạn đã xem không sinh thêm đoạn mới", () => {
    expect(mergeVideoRanges([[0, 60]], [[10, 20]])).toEqual([[0, 60]]);
  });

  it("đoạn ngược (end <= start) bị loại bỏ, không throw", () => {
    expect(mergeVideoRanges([], [[30, 10]])).toEqual([]);
    expect(mergeVideoRanges([], [[5, 5]])).toEqual([]);
  });

  it("tự sắp xếp dù đầu vào không theo thứ tự", () => {
    expect(mergeVideoRanges([[100, 110]], [[0, 10]])).toEqual([
      [0, 10],
      [100, 110],
    ]);
  });
});

describe("videoRangesCoverageSec", () => {
  it("tổng đúng độ dài các đoạn không chồng lấn", () => {
    expect(
      videoRangesCoverageSec([
        [0, 30],
        [100, 120],
      ]),
    ).toBe(50);
  });

  it("tập rỗng -> 0", () => {
    expect(videoRangesCoverageSec([])).toBe(0);
  });
});

describe("recordLessonEngagement — video ranges", () => {
  it("lưu và gộp các đoạn qua nhiều nhịp", async () => {
    const s = await setup("v1", { videoDurationSec: 100 });

    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ sessionStart: true, videoRanges: [[0, 30]], videoPositionSec: 30 }),
    );
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ videoRanges: [[25, 50]], videoPositionSec: 50 }),
    );

    const row = await prisma.lessonEngagement.findUniqueOrThrow({
      where: { userId_lessonId: { userId: s.learnerId, lessonId: s.lessonId } },
    });
    expect(row.videoRanges).toEqual([[0, 50]]);
    expect(row.lastVideoPositionSec).toBe(50);
  });

  it("không gửi videoRanges thì không đụng gì tới đoạn đã lưu", async () => {
    const s = await setup("v2", { videoDurationSec: 100 });
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ sessionStart: true, videoRanges: [[0, 20]], videoPositionSec: 20 }),
    );
    // Nhịp thuần cuộn trang, không có tín hiệu video (vd. đã cuộn xuống dưới video).
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ scrollPct: 90 }));

    const row = await prisma.lessonEngagement.findUniqueOrThrow({
      where: { userId_lessonId: { userId: s.learnerId, lessonId: s.lessonId } },
    });
    expect(row.videoRanges).toEqual([[0, 20]]);
    expect(row.lastVideoPositionSec).toBe(20);
    expect(row.maxScrollPct).toBe(90);
  });

  it("lesson.engaged mang theo độ phủ video khi khép lượt", async () => {
    const s = await setup("v3", { videoDurationSec: 100 });
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ sessionStart: true, sessionEnd: true, videoRanges: [[0, 40]], videoPositionSec: 40 }),
    );

    const events = await prisma.learningEvent.findMany({
      where: { userId: s.learnerId, eventType: LearningEventType.LessonEngaged },
    });
    expect(events).toHaveLength(1);
    expect(events[0]!.payload).toMatchObject({
      videoCoverageSec: 40,
      videoCoveragePct: 40,
    });
  });

  it("bài không có video — vẫn hoạt động bình thường, videoRanges giữ null", async () => {
    const s = await setup("v4");
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionStart: true }));
    const row = await prisma.lessonEngagement.findUniqueOrThrow({
      where: { userId_lessonId: { userId: s.learnerId, lessonId: s.lessonId } },
    });
    expect(row.videoRanges).toBeNull();
    expect(row.lastVideoPositionSec).toBeNull();
  });

  it("chặn trần số đoạn mỗi nhịp", async () => {
    const s = await setup("v5", { videoDurationSec: 1000 });
    const tooMany = Array.from({ length: 41 }, (_, i) => [i * 10, i * 10 + 5] as [number, number]);
    await expect(
      recordLessonEngagement(s.learnerId, s.lessonId, beat({ videoRanges: tooMany })),
    ).rejects.toThrow(LearningError);
  });
});
