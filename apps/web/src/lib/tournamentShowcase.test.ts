import { describe, expect, it } from "vitest";
import { paginate, showcaseScoreLabel, showcaseStatus, showcaseTeamLabel, topVotedSubmissionIds } from "./tournamentShowcase";

describe("showcaseStatus", () => {
  it("bài chấm chéo/giảng viên chấm theo MissionSubmission", () => {
    expect(showcaseStatus("mission", "passed")).toEqual({ label: "Đạt", tone: "ok" });
    expect(showcaseStatus("mission", "failed")).toEqual({ label: "Chưa đạt", tone: "bad" });
    expect(showcaseStatus("mission", "pending")).toEqual({ label: "Chờ chấm", tone: "wait" });
    expect(showcaseStatus("mission", "disqualified")).toEqual({ label: "Bị loại", tone: "bad" });
  });

  it("bài nộp qua Assignment: submitted là chờ chấm, graded là đã chấm (trước đây graded hiện 'Chờ chấm')", () => {
    expect(showcaseStatus("assignment", "submitted")).toEqual({ label: "Chờ chấm", tone: "wait" });
    expect(showcaseStatus("assignment", "graded")).toEqual({ label: "Đã chấm", tone: "ok" });
  });

  it("trạng thái lạ rơi về chờ chấm", () => {
    expect(showcaseStatus("mission", "???")).toEqual({ label: "Chờ chấm", tone: "wait" });
  });
});

describe("showcaseScoreLabel", () => {
  it("chấm chéo: điểm 0..1 hiện thành phần trăm", () => {
    expect(showcaseScoreLabel({ kind: "mission", finalScore: 0.824, score: null, maxScore: null })).toBe("82%");
    expect(showcaseScoreLabel({ kind: "mission", finalScore: 1, score: null, maxScore: null })).toBe("100%");
    expect(showcaseScoreLabel({ kind: "mission", finalScore: null, score: null, maxScore: null })).toBeNull();
  });

  it("bài tập giảng viên chấm: điểm trên thang thật của bài tập, không giả định 100", () => {
    expect(showcaseScoreLabel({ kind: "assignment", finalScore: null, score: 8, maxScore: 10 })).toBe("8/10");
    expect(showcaseScoreLabel({ kind: "assignment", finalScore: null, score: null, maxScore: 10 })).toBeNull();
  });
});

describe("showcaseTeamLabel", () => {
  it("dùng tên đội khi có", () => {
    expect(showcaseTeamLabel({ teamName: "Số Nguyên Tố", captainName: "Lan", teamSize: 3 })).toBe("Số Nguyên Tố");
  });

  it("giải theo đội mà không tra ra đội (đội trưởng đã rời): không ghi Solo", () => {
    expect(showcaseTeamLabel({ teamName: null, captainName: "Lan", teamSize: 3 })).toBe("Nhóm của Lan");
  });

  it("giải cá nhân ghi tên người nộp", () => {
    expect(showcaseTeamLabel({ teamName: null, captainName: "Lan", teamSize: 1 })).toBe("Lan");
  });
});

describe("topVotedSubmissionIds", () => {
  it("chỉ gắn nhãn khi có ít nhất 2 phiếu và dẫn đầu duy nhất, tính riêng từng nhiệm vụ", () => {
    const r = topVotedSubmissionIds([
      { missionId: "m1", submissionId: "a", votes: 3 },
      { missionId: "m1", submissionId: "b", votes: 1 },
      { missionId: "m2", submissionId: "c", votes: 1 },
      { missionId: "m2", submissionId: "d", votes: 0 },
      { missionId: "m3", submissionId: "e", votes: 4 },
      { missionId: "m3", submissionId: "f", votes: 4 },
    ]);
    expect([...r]).toEqual(["a"]);
  });
});

describe("paginate", () => {
  const list = Array.from({ length: 50 }, (_, i) => i);

  it("cắt theo trang và cho biết tổng số trang", () => {
    const p = paginate(list, 2, 24);
    expect(p.items).toEqual(list.slice(24, 48));
    expect(p).toMatchObject({ page: 2, pages: 3, total: 50 });
  });

  it("trang ngoài khoảng được đưa về trang hợp lệ", () => {
    expect(paginate(list, 99, 24).page).toBe(3);
    expect(paginate(list, 0, 24).page).toBe(1);
    expect(paginate(list, Number.NaN, 24).page).toBe(1);
  });

  it("danh sách rỗng vẫn có 1 trang", () => {
    expect(paginate([], 1, 24)).toMatchObject({ items: [], page: 1, pages: 1, total: 0 });
  });
});
