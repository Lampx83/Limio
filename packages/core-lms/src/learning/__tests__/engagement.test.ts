import { describe, expect, it } from "vitest";
import { prisma } from "@feedbackme/db";
import { LearningEventType } from "@feedbackme/shared-types";
import {
  PDF_PAGE_VIEWED_MIN_SEC,
  getCourseEngagement,
  mergePdfPages,
  mergeVideoRanges,
  recordLessonEngagement,
  summarizePdfPages,
  videoRangesCoverageSec,
} from "../engagement";
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
  /** Id các khối PDF của bài, theo thứ tự tạo. */
  pdfIds: string[];
  /** Id khối video (nếu có) — để thử "khối có thật nhưng không phải PDF". */
  videoId: string | null;
}

async function setup(
  slug: string,
  opts?: { videoDurationSec?: number; pdfCount?: number },
): Promise<Setup> {
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
  let videoId: string | null = null;
  if (opts?.videoDurationSec) {
    const v = await createContentItem(owner.userId, l.lessonId, {
      type: "video",
      payload: { url: "https://example.com/v.mp4", durationSec: opts.videoDurationSec },
      orderIndex: 0,
    });
    videoId = v.contentItemId;
  }
  const pdfIds: string[] = [];
  for (let i = 0; i < (opts?.pdfCount ?? 0); i++) {
    const pdf = await createContentItem(owner.userId, l.lessonId, {
      type: "pdf",
      payload: { url: `https://example.com/doc-${i}.pdf`, title: `PDF ${i}` },
      orderIndex: i + 1,
    });
    pdfIds.push(pdf.contentItemId);
  }
  await publishCourse(owner.userId, c.courseId);
  await enrollInCourse(learner.userId, c.courseId);
  return {
    learnerId: learner.userId,
    outsiderId: outsider.userId,
    lessonId: l.lessonId,
    courseId: c.courseId,
    pdfIds,
    videoId,
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

// ── Đo đọc PDF theo từng trang (docs/tieu-chi/doc-pdf-theo-trang.md) ─────────

const pdfView = (contentItemId: string, o: Record<string, unknown> = {}) => ({
  contentItemId,
  totalPages: 10,
  lastPage: 1,
  dwellSec: { "1": 5 },
  ...o,
});

async function engagementRow(s: Setup) {
  return prisma.lessonEngagement.findUniqueOrThrow({
    where: { userId_lessonId: { userId: s.learnerId, lessonId: s.lessonId } },
  });
}

describe("recordLessonEngagement — PDF theo trang", () => {
  it("AC2: cộng dồn giây theo trang qua nhiều nhịp, totalPages/lastPage lấy giá trị mới nhất", async () => {
    const s = await setup("p1", { pdfCount: 1 });
    const id = s.pdfIds[0]!;

    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ pdf: [pdfView(id, { lastPage: 3, dwellSec: { "2": 10, "3": 12 } })] }),
    );
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ pdf: [pdfView(id, { totalPages: 12, lastPage: 3, dwellSec: { "3": 8, "4": 6 } })] }),
    );

    const row = await engagementRow(s);
    expect(row.pdfPages).toEqual({
      [id]: { totalPages: 12, lastPage: 3, dwellSec: { "2": 10, "3": 20, "4": 6 } },
    });
  });

  it("AC2: nhịp không có trường pdf thì pdfPages vẫn null, các số liệu khác ghi như cũ", async () => {
    const s = await setup("p2", { pdfCount: 1 });
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ scrollPct: 40 }));
    const row = await engagementRow(s);
    expect(row.pdfPages).toBeNull();
    expect(row.activeSec).toBe(30);
    expect(row.maxScrollPct).toBe(40);
  });

  it("AC2: nhịp không có pdf không xoá số liệu PDF đã ghi", async () => {
    const s = await setup("p3", { pdfCount: 1 });
    const id = s.pdfIds[0]!;
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ pdf: [pdfView(id)] }));
    await recordLessonEngagement(s.learnerId, s.lessonId, beat());
    const row = await engagementRow(s);
    expect((row.pdfPages as Record<string, unknown>)[id]).toBeDefined();
  });

  it("AC2: khối không thuộc bài / không phải PDF bị bỏ, nhịp vẫn được ghi", async () => {
    const s = await setup("p4", { pdfCount: 1, videoDurationSec: 60 });
    const good = s.pdfIds[0]!;
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({
        pdf: [
          pdfView("00000000-0000-4000-8000-000000000000"),
          pdfView(s.videoId!),
          pdfView(good, { dwellSec: { "1": 7 } }),
        ],
      }),
    );
    const row = await engagementRow(s);
    expect(Object.keys(row.pdfPages as object)).toEqual([good]);
    expect(row.activeSec).toBe(30);
  });

  it("AC2: khối PDF của bài khác không ghi được vào bài này", async () => {
    const a = await setup("p5a", { pdfCount: 1 });
    const b = await setup("p5b", { pdfCount: 1 });
    await recordLessonEngagement(
      a.learnerId,
      a.lessonId,
      beat({ pdf: [pdfView(b.pdfIds[0]!)] }),
    );
    expect((await engagementRow(a)).pdfPages).toBeNull();
  });

  it("AC2: trang < 1 hoặc > totalPages bị bỏ", async () => {
    const s = await setup("p6", { pdfCount: 1 });
    const id = s.pdfIds[0]!;
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({
        pdf: [pdfView(id, { totalPages: 5, lastPage: 5, dwellSec: { "0": 9, "3": 4, "6": 9, "99": 9 } })],
      }),
    );
    const row = await engagementRow(s);
    expect((row.pdfPages as Record<string, { dwellSec: object }>)[id]!.dwellSec).toEqual({ "3": 4 });
  });

  it("AC2: lastPage ngoài khoảng 1..totalPages được kẹp lại", async () => {
    const s = await setup("p6b", { pdfCount: 1 });
    const id = s.pdfIds[0]!;
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ pdf: [pdfView(id, { totalPages: 5, lastPage: 40, dwellSec: { "2": 3 } })] }),
    );
    const row = await engagementRow(s);
    expect((row.pdfPages as Record<string, { lastPage: number }>)[id]!.lastPage).toBe(5);
  });

  it("AC2: hai PDF trong một bài được tách riêng", async () => {
    const s = await setup("p7", { pdfCount: 2 });
    const [a, b] = s.pdfIds as [string, string];
    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({
        pdf: [
          pdfView(a, { dwellSec: { "1": 5 } }),
          pdfView(b, { totalPages: 3, lastPage: 2, dwellSec: { "2": 9 } }),
        ],
      }),
    );
    const row = await engagementRow(s);
    const p = row.pdfPages as Record<string, { dwellSec: Record<string, number>; totalPages: number }>;
    expect(p[a]!.dwellSec).toEqual({ "1": 5 });
    expect(p[b]!.dwellSec).toEqual({ "2": 9 });
    expect(p[b]!.totalPages).toBe(3);
  });

  it("AC2: chặn trần — giây quá lớn, quá nhiều trang, quá nhiều PDF đều bị từ chối", async () => {
    const s = await setup("p8", { pdfCount: 1 });
    const id = s.pdfIds[0]!;
    await expect(
      recordLessonEngagement(s.learnerId, s.lessonId, beat({ pdf: [pdfView(id, { dwellSec: { "1": 9999 } })] })),
    ).rejects.toThrow(LearningError);
    const manyPages = Object.fromEntries(Array.from({ length: 61 }, (_, i) => [String(i + 1), 1]));
    await expect(
      recordLessonEngagement(
        s.learnerId,
        s.lessonId,
        beat({ pdf: [pdfView(id, { totalPages: 100, dwellSec: manyPages })] }),
      ),
    ).rejects.toThrow(LearningError);
    await expect(
      recordLessonEngagement(s.learnerId, s.lessonId, beat({ pdf: Array.from({ length: 11 }, () => pdfView(id)) })),
    ).rejects.toThrow(LearningError);
    await expect(
      recordLessonEngagement(s.learnerId, s.lessonId, beat({ pdf: [pdfView(id, { dwellSec: { abc: 3 } })] })),
    ).rejects.toThrow(LearningError);
    expect(await prisma.lessonEngagement.count({ where: { userId: s.learnerId } })).toBe(0);
  });

  it("AC2: người chưa ghi danh vẫn bị từ chối khi gửi pdf", async () => {
    const s = await setup("p9", { pdfCount: 1 });
    await expect(
      recordLessonEngagement(s.outsiderId, s.lessonId, beat({ pdf: [pdfView(s.pdfIds[0]!)] })),
    ).rejects.toThrow(LearningError);
  });

  it("AC3: lesson.engaged mang bản tóm tắt cộng dồn của PDF, không phát theo từng nhịp", async () => {
    const s = await setup("p10", { pdfCount: 1 });
    const id = s.pdfIds[0]!;
    const where = { userId: s.learnerId, eventType: LearningEventType.LessonEngaged };

    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ sessionStart: true, pdf: [pdfView(id, { totalPages: 8, lastPage: 2, dwellSec: { "1": 20, "2": 2 } })] }),
    );
    expect(await prisma.learningEvent.count({ where })).toBe(0);

    await recordLessonEngagement(
      s.learnerId,
      s.lessonId,
      beat({ sessionEnd: true, pdf: [pdfView(id, { totalPages: 8, lastPage: 3, dwellSec: { "2": 1, "3": 15 } })] }),
    );
    const events = await prisma.learningEvent.findMany({ where });
    expect(events).toHaveLength(1);
    // Trang 1 (20s) và 3 (15s) đã xem; trang 2 cộng lại 2 + 1 = 3s, đúng ngưỡng.
    expect((events[0]!.payload as { pdf?: unknown }).pdf).toEqual([
      { contentItemId: id, totalPages: 8, pagesViewed: 3, lastPage: 3 },
    ]);
  });

  it("AC3: bài không có PDF — payload lesson.engaged không có trường pdf", async () => {
    const s = await setup("p11");
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionStart: true, sessionEnd: true }));
    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: { userId: s.learnerId, eventType: LearningEventType.LessonEngaged },
    });
    expect(ev.payload).not.toHaveProperty("pdf");
  });

  it("AC3: bài có PDF nhưng chưa đo được trang nào — cũng không có trường pdf (không phải mảng rỗng)", async () => {
    const s = await setup("p12", { pdfCount: 1 });
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ sessionStart: true, sessionEnd: true }));
    const ev = await prisma.learningEvent.findFirstOrThrow({
      where: { userId: s.learnerId, eventType: LearningEventType.LessonEngaged },
    });
    expect(ev.payload).not.toHaveProperty("pdf");
  });

  it("AC4: getCourseEngagement trả pdfPages (null khi chưa đo)", async () => {
    const s = await setup("p13", { pdfCount: 1 });
    const id = s.pdfIds[0]!;
    await recordLessonEngagement(s.learnerId, s.lessonId, beat({ pdf: [pdfView(id)] }));
    const rows = await getCourseEngagement(s.courseId);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.pdfPages?.[id]?.dwellSec).toEqual({ "1": 5 });

    const s2 = await setup("p14", { pdfCount: 1 });
    await recordLessonEngagement(s2.learnerId, s2.lessonId, beat());
    expect((await getCourseEngagement(s2.courseId))[0]!.pdfPages).toBeNull();
  });
});

describe("mergePdfPages", () => {
  const item = (dwellSec: Record<string, number>, o: Record<string, unknown> = {}) => ({
    contentItemId: "a",
    totalPages: 10,
    lastPage: 1,
    dwellSec,
    ...o,
  });

  it("existing null + incoming rỗng -> null (không tạo state rỗng)", () => {
    expect(mergePdfPages(null, [], new Set(["a"]))).toBeNull();
    expect(mergePdfPages(null, [item({})], new Set(["a"]))).toBeNull();
  });

  it("incoming rỗng giữ nguyên state cũ", () => {
    const old = { a: { totalPages: 4, lastPage: 2, dwellSec: { "2": 9 } } };
    expect(mergePdfPages(old, [], new Set(["a"]))).toEqual(old);
  });

  it("cộng giây cùng trang, thêm trang mới, không sửa đối tượng đầu vào", () => {
    const old = { a: { totalPages: 4, lastPage: 2, dwellSec: { "2": 9 } } };
    const copy = JSON.parse(JSON.stringify(old));
    const out = mergePdfPages(old, [item({ "2": 1, "3": 4 }, { totalPages: 4, lastPage: 3 })], new Set(["a"]));
    expect(out).toEqual({ a: { totalPages: 4, lastPage: 3, dwellSec: { "2": 10, "3": 4 } } });
    expect(old).toEqual(copy);
  });

  it("khối không nằm trong tập hợp lệ bị bỏ", () => {
    expect(mergePdfPages(null, [item({ "1": 3 })], new Set(["zzz"]))).toBeNull();
  });
});

describe("summarizePdfPages", () => {
  it(`trang chỉ tính "đã xem" từ ${PDF_PAGE_VIEWED_MIN_SEC} giây`, () => {
    const out = summarizePdfPages({
      a: { totalPages: 6, lastPage: 4, dwellSec: { "1": 2, "2": PDF_PAGE_VIEWED_MIN_SEC, "4": 40 } },
    });
    expect(out).toEqual([{ contentItemId: "a", totalPages: 6, pagesViewed: 2, lastPage: 4 }]);
  });

  it("không đếm trang vượt totalPages (PDF bị thay bằng bản ngắn hơn)", () => {
    const out = summarizePdfPages({
      a: { totalPages: 2, lastPage: 2, dwellSec: { "1": 9, "2": 9, "7": 99 } },
    });
    expect(out[0]!.pagesViewed).toBe(2);
  });

  it("null hoặc rỗng -> mảng rỗng", () => {
    expect(summarizePdfPages(null)).toEqual([]);
    expect(summarizePdfPages({})).toEqual([]);
  });
});
