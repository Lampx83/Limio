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
  it("việc đang chờ đứng đầu, thẻ 'chưa có ý tưởng' luôn có và đứng cuối, tối đa 6", () => {
    const s = buildStarters({ courseTitles: ["A"], pendingEssays: 5, pendingAssignments: 2, staleForumThreads: 1, staleLearners: 0 });
    expect(s.length).toBeLessThanOrEqual(6);
    expect(s.slice(0, 3).every((x) => x.urgent)).toBe(true);
    expect(s[0]!.title).toBe("5 bài tự luận chờ chấm");
    expect(s[s.length - 1]!.id).toBe("no_idea");
    expect(s[s.length - 1]!.prompt).toBeTruthy();
  });

  it("không có việc chờ thì không có thẻ khẩn; giảng viên mới được gợi ý tạo khoá đầu tiên", () => {
    const s = buildStarters(empty);
    expect(s.some((x) => x.urgent)).toBe(false);
    expect(s.some((x) => x.id === "first_course")).toBe(true);
    expect(s.some((x) => x.id === "insight")).toBe(false);
  });

  it("mỗi thẻ hoặc có href hoặc có prompt, và href là điểm đến có thật", () => {
    const hrefs = new Set(ASSISTANT_DESTINATIONS.map((d) => d.href));
    for (const x of buildStarters({ courseTitles: ["A"], pendingEssays: 1, pendingAssignments: 1, staleForumThreads: 1, staleLearners: 1 })) {
      expect(Boolean(x.href) !== Boolean(x.prompt)).toBe(true);
      if (x.href) expect(hrefs.has(x.href)).toBe(true);
    }
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
