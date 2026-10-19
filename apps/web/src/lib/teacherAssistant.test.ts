import { describe, expect, it } from "vitest";
import {
  ASSISTANT_DESTINATIONS,
  buildStarters,
  courseDestinations,
  describeSituation,
  destinationById,
  normalizeAssistantReply,
  type AssistantContext,
} from "./teacherAssistant";

const empty: AssistantContext = { courseTitles: [], pendingEssays: 0, pendingAssignments: 0, staleForumThreads: 0, staleLearners: 0 };

describe("danh mục điểm đến", () => {
  it("mã không trùng và đường dẫn nằm trong khu giảng viên", () => {
    const ids = ASSISTANT_DESTINATIONS.map((d) => d.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const d of ASSISTANT_DESTINATIONS) expect(d.href.startsWith("/instructor/")).toBe(true);
  });
});

describe("normalizeAssistantReply", () => {
  it("chỉ giữ mã có trong danh mục, bỏ trùng, tối đa 3, đường dẫn lấy từ danh mục", () => {
    const r = normalizeAssistantReply({
      reply: "Thầy/cô nên chấm bài trước.",
      actions: ["grade_essays", "https://evil.example", "grade_essays", "poll", "forum", "timer"],
      followUps: [],
    });
    expect(r.actions.map((a) => a.id)).toEqual(["grade_essays", "poll", "forum"]);
    expect(r.actions[0]!.href).toBe(destinationById("grade_essays")!.href);
  });

  it("bỏ emoji, bỏ câu gợi ý trùng/rỗng, tối đa 3", () => {
    const r = normalizeAssistantReply({ reply: "Chào thầy/cô 🎉 !", actions: [], followUps: ["Gợi ý A", "Gợi ý A", "", "B", "C", "D"] });
    expect(r.reply).toBe("Chào thầy/cô!");
    expect(r.followUps).toEqual(["Gợi ý A", "B", "C"]);
  });

  it("đầu ra hỏng thì vẫn trả câu báo, không ném lỗi", () => {
    for (const bad of [null, undefined, "x", 3, { actions: "poll" }]) {
      const r = normalizeAssistantReply(bad);
      expect(r.reply.length).toBeGreaterThan(0);
      expect(r.actions).toEqual([]);
    }
  });
});

describe("buildStarters", () => {
  const withCourses: AssistantContext = { ...empty, courseTitles: ["Toán 1", "Lý 1"], courses: [{ id: "c9", title: "Toán 1" }, { id: "c8", title: "Lý 1" }], pendingEssays: 5, pendingAssignments: 2, staleForumThreads: 1 };

  it("chỉ vài thẻ soạn, không lặp việc đang chờ (đã có danh sách Cần xử lý gấp)", () => {
    const s = buildStarters(withCourses);
    expect(s.length).toBeLessThanOrEqual(6);
    expect(s.map((x) => x.id)).toEqual(["new_course", "new_live", "class_activity", "class_quiz", "open_course", "oral_new"]);
    expect(s.some((x) => /chờ chấm|chưa được trả lời/.test(x.title))).toBe(false);
  });

  it("có khoá đang dạy thì có thẻ mở khoá gần nhất, dẫn thẳng vào khoá đó", () => {
    const open = buildStarters(withCourses).find((x) => x.id === "open_course")!;
    expect(open.title).toBe('Mở khoá "Toán 1"');
    expect(open.href).toBe("/instructor/courses/c9");
  });

  it("giảng viên mới chưa có khoá thì không có thẻ mở khoá", () => {
    expect(buildStarters(empty).map((x) => x.id)).toEqual(["new_course", "new_live", "class_activity", "class_quiz", "oral_new"]);
  });

  it("mọi thẻ dẫn tới điểm đến có thật", () => {
    const hrefs = new Set(ASSISTANT_DESTINATIONS.map((d) => d.href));
    for (const x of buildStarters(withCourses)) expect(hrefs.has(x.href) || x.href.startsWith("/instructor/courses/")).toBe(true);
  });
});

describe("describeSituation", () => {
  it("chỉ nêu số liệu khác 0", () => {
    const t = describeSituation({ ...empty, courseTitles: ["Toán 1"], pendingEssays: 4 });
    expect(t).toContain("Toán 1");
    expect(t).toContain("4 bài tự luận");
    expect(t).not.toContain("bài tập");
  });
  it("người mới được nói rõ", () => {
    expect(describeSituation(empty)).toContain("người dùng mới");
  });
});

describe("điểm đến theo từng khoá", () => {
  const courses = [{ id: "c1", title: "  Nhập môn   Lập trình " }, { id: "c2", title: "Toán 1" }];

  it("mỗi khoá là một điểm đến dẫn thẳng vào khoá đó", () => {
    const d = courseDestinations(courses);
    expect(d[0]).toMatchObject({ id: "course:c1", href: "/instructor/courses/c1", label: 'Khoá "Nhập môn Lập trình"' });
  });

  it("giới hạn số khoá và chịu được danh sách rỗng", () => {
    const many = Array.from({ length: 40 }, (_, i) => ({ id: `k${i}`, title: `Khoá ${i}` }));
    expect(courseDestinations(many).length).toBe(15);
    expect(courseDestinations(undefined)).toEqual([]);
  });

  it("chấp nhận mã khoá do server cấp, và vẫn bỏ mã khoá lạ (không thuộc giảng viên)", () => {
    const r = normalizeAssistantReply(
      { reply: "Mở khoá này.", actions: ["course:c2", "course:khong-phai-cua-toi", "poll"], followUps: [] },
      courseDestinations(courses),
    );
    expect(r.actions.map((a) => a.id)).toEqual(["course:c2", "poll"]);
    expect(r.actions[0]!.href).toBe("/instructor/courses/c2");
  });
});
