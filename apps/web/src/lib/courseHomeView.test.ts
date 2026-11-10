import { describe, expect, it } from "vitest";
import {
  continueButtonText,
  describeLevel,
  describeLevelParts,
  skillProgressRows,
  reviewCardView,
  mockStatusText,
  practiceStatusText,
  practiceButtonLabel,
  practiceHref,
  gapText,
  gapToNextRank,
  levelNameVi,
  pickContinueLesson,
  streakLabel,
} from "./courseHomeView";

describe("describeLevel", () => {
  it("viết thành câu tiếng Việt, không dùng mũi tên hay ký hiệu L2", () => {
    const s = describeLevel({ level: 1, levelName: "Newcomer", xpToNext: 140, isMaxLevel: false });
    expect(s).toBe("Cấp 1 · Người mới. Cần thêm 140 XP để lên cấp 2.");
    expect(s).not.toContain("→");
  });
  it("cấp cao nhất thì không nói về cấp kế tiếp", () => {
    expect(describeLevel({ level: 5, levelName: "Master", xpToNext: 0, isMaxLevel: true })).toBe(
      "Cấp 5 · Bậc thầy (cấp cao nhất)",
    );
  });
  it("không biết còn bao nhiêu XP thì chỉ nói cấp hiện tại", () => {
    expect(describeLevel({ level: 2, levelName: "Engaged", xpToNext: null, isMaxLevel: false })).toBe(
      "Cấp 2 · Chăm chỉ",
    );
  });
  it("tên cấp lạ giữ nguyên", () => {
    expect(levelNameVi("Legend")).toBe("Legend");
  });
});

describe("continueButtonText", () => {
  it("nói rõ tên bài", () => {
    expect(continueButtonText("continue", "Bài 1.2 · Quy trình thiết kế")).toBe(
      "Tiếp tục: Bài 1.2 · Quy trình thiết kế",
    );
    expect(continueButtonText("start", "Bài 1.1")).toBe("Bắt đầu: Bài 1.1");
  });
  it("không tìm được tên bài thì quay về câu chung", () => {
    expect(continueButtonText("continue", null)).toBe("Tiếp tục bài gần nhất");
    expect(continueButtonText("start", null)).toBe("Bắt đầu học");
  });
});

describe("streakLabel", () => {
  it("nói rõ chuỗi tính theo ngày học", () => {
    expect(streakLabel(3)).toBe("Học liên tục 3 ngày");
  });
});

describe("gapToNextRank", () => {
  const entries = [
    { rank: 1, xp: 300 },
    { rank: 2, xp: 220 },
    { rank: 3, xp: 150 },
  ];
  it("tính khoảng cách tới người ngay trên", () => {
    const g = gapToNextRank({ entries, me: { rank: 3, xp: 150 } });
    expect(g).toEqual({ aboveRank: 2, gapXp: 70 });
    expect(gapText(g!)).toBe("Còn cách hạng 2 70 XP.");
  });
  it("đứng đầu thì không có người trên", () => {
    expect(gapToNextRank({ entries, me: { rank: 1, xp: 300 } })).toBeNull();
  });
  it("người ngay trên không nằm trong danh sách đang hiện thì không đoán", () => {
    expect(gapToNextRank({ entries, me: { rank: 9, xp: 10 } })).toBeNull();
  });
  it("không có dữ liệu của mình thì không hiện", () => {
    expect(gapToNextRank({ entries, me: null })).toBeNull();
  });
  it("ngang điểm thì nói là ngang điểm", () => {
    expect(gapText({ aboveRank: 2, gapXp: 0 })).toBe("Bạn đang ngang điểm với hạng 2.");
  });
});

describe("pickContinueLesson — nút Tiếp tục và dấu trong danh sách trỏ cùng một bài", () => {
  const L = (id: string, completed = false, locked = false) => ({ id, title: `Bài ${id}`, completed, locked });

  it("bài mở gần nhất còn dở → bài đó, Đang học", () => {
    expect(pickContinueLesson("1.2", [L("1.1", true), L("1.2"), L("1.3")])).toEqual({ id: "1.2", title: "Bài 1.2", kind: "current" });
  });

  it("bài mở gần nhất đã xong → bài chưa học đầu tiên, Bài tiếp theo (không còn 'Tiếp tục: Bài 1.1')", () => {
    expect(pickContinueLesson("1.1", [L("1.1", true), L("1.2"), L("1.3")])).toEqual({ id: "1.2", title: "Bài 1.2", kind: "next" });
  });

  it("bỏ qua bài bị khoá khi tìm bài tiếp theo", () => {
    expect(pickContinueLesson("1.1", [L("1.1", true), L("1.2", false, true), L("1.3")])?.id).toBe("1.3");
  });

  it("chưa mở bài nào → bài chưa học đầu tiên", () => {
    expect(pickContinueLesson(null, [L("1.1"), L("1.2")])).toEqual({ id: "1.1", title: "Bài 1.1", kind: "next" });
  });

  it("bài gần nhất đã bị xoá/ẩn khỏi khoá → không trỏ vào nó", () => {
    expect(pickContinueLesson("da-xoa", [L("1.1", true), L("1.2")])?.id).toBe("1.2");
  });

  it("học xong cả khoá → quay lại bài gần nhất để ôn; chưa có gì → null", () => {
    expect(pickContinueLesson("1.2", [L("1.1", true), L("1.2", true)])).toEqual({ id: "1.2", title: "Bài 1.2", kind: "current" });
    expect(pickContinueLesson(null, [])).toBeNull();
  });
});

describe("describeLevelParts", () => {
  it("tách phần chính và câu \"Cần thêm … XP\"; cấp cao nhất hoặc không có mốc thì không có phần thêm", () => {
    expect(describeLevelParts({ level: 1, levelName: "Newcomer", xpToNext: 190, isMaxLevel: false })).toEqual({
      head: "Cấp 1 · Người mới",
      more: "Cần thêm 190 XP để lên cấp 2.",
    });
    expect(describeLevelParts({ level: 5, levelName: "Master", xpToNext: 0, isMaxLevel: true }).more).toBeNull();
    expect(describeLevelParts({ level: 2, levelName: "Engaged", xpToNext: null, isMaxLevel: false }).more).toBeNull();
  });
});

describe("skillProgressRows", () => {
  it("thứ tự Đọc, Nghe, Nói, Viết; phần trăm = bài đã luyện / tổng bài, làm tròn", () => {
    const rows = skillProgressRows([
      { skill: "listening", lessonsTotal: 20, lessonsPracticed: 7 },
      { skill: "speaking", lessonsTotal: 5, lessonsPracticed: 1 },
      { skill: "reading", lessonsTotal: 12, lessonsPracticed: 5 },
      { skill: "writing", lessonsTotal: 11, lessonsPracticed: 2 },
    ]);
    expect(rows.map((r) => r.label)).toEqual(["Đọc", "Nghe", "Nói", "Viết"]);
    expect(rows.map((r) => r.pct)).toEqual([42, 35, 20, 18]);
  });
  it("kỹ năng không có bài (hoặc thiếu hẳn) trả null, không chia cho 0; luyện hết là 100", () => {
    const rows = skillProgressRows([
      { skill: "reading", lessonsTotal: 0, lessonsPracticed: 0 },
      { skill: "listening", lessonsTotal: 3, lessonsPracticed: 3 },
    ]);
    expect(rows.map((r) => r.pct)).toEqual([null, 100, null, null]);
  });
});

describe("reviewCardView", () => {
  it("còn thẻ đến hạn: số từ vựng, nút Ôn kiến thức đã học, dòng Từ <bài> khi có gợi ý", () => {
    expect(reviewCardView({ reviewable: 8, suggestionLessonTitle: " Unit 02 " })).toEqual({
      done: false,
      headline: "8 từ vựng",
      fromLine: "Từ Unit 02",
      buttonLabel: "Ôn kiến thức đã học",
    });
    expect(reviewCardView({ reviewable: 8 }).fromLine).toBeNull();
    expect(reviewCardView({ reviewable: 8, suggestionLessonTitle: "  " }).fromLine).toBeNull();
  });
  it("hết thẻ: báo đã ôn xong, nút Xem bộ thẻ, không có dòng Từ", () => {
    expect(reviewCardView({ reviewable: 0, suggestionLessonTitle: "Unit 02" })).toEqual({
      done: true,
      headline: "Hôm nay bạn đã ôn xong.",
      fromLine: null,
      buttonLabel: "Xem bộ thẻ",
    });
  });
});

describe("thẻ đề hai cột: Thi thử và Luyện đề", () => {
  it("mockStatusText: chưa làm, đang làm dở, đã thi (có/không điểm)", () => {
    expect(mockStatusText({ attempt: null, attemptCount: 0 })).toBe("Chưa làm");
    expect(mockStatusText({ attempt: { status: "in_progress", scorePct: null }, attemptCount: 1 })).toBe("Đang làm dở · lượt 1");
    expect(mockStatusText({ attempt: { status: "submitted", scorePct: 72.4 }, attemptCount: 2 })).toBe("Đã thi 2 lần · gần nhất 72%");
    expect(mockStatusText({ attempt: { status: "submitted", scorePct: null }, attemptCount: 1 })).toBe("Đã thi 1 lần");
  });

  it("practiceStatusText: buổi dở thắng số buổi đã xong; không hiện điểm", () => {
    expect(practiceStatusText({ inProgress: null, completedCount: 0 })).toBe("Chưa luyện");
    expect(practiceStatusText({ inProgress: null, completedCount: 3 })).toBe("Đã luyện 3 buổi");
    expect(practiceStatusText({ inProgress: { sessionId: "s1", answered: 12, total: 30 }, completedCount: 3 })).toBe("Đang luyện dở · 12/30 câu");
  });

  it("nút và đích của Luyện đề: có buổi dở thì Tiếp tục luyện vào thẳng buổi đó", () => {
    const idle = { inProgress: null, completedCount: 0 };
    const open = { inProgress: { sessionId: "s1", answered: 1, total: 5 }, completedCount: 0 };
    expect(practiceButtonLabel(idle)).toBe("Luyện đề");
    expect(practiceButtonLabel(open)).toBe("Tiếp tục luyện");
    expect(practiceHref("ielts", "e1", idle)).toBe("/learn/ielts/exams/e1/practice");
    expect(practiceHref("ielts", "e1", open)).toBe("/learn/ielts/exams/e1/practice/s1");
  });
});
