import { describe, expect, it } from "vitest";
import { humanizePublishDetail, humanizePublishError } from "./examPublishErrors";

describe("humanizePublishError — mã lỗi cấp trên", () => {
  it("dịch các mã đã biết, có hướng xử lý", () => {
    expect(humanizePublishError("exam_not_publishable")).toMatch(/chưa đủ điều kiện/);
    expect(humanizePublishError("exam_not_draft")).toMatch(/đã publish/);
    expect(humanizePublishError("forbidden")).toMatch(/quyền/);
    expect(humanizePublishError("unauthorized")).toMatch(/đăng nhập/);
  });
  it("mã lạ vẫn có câu và kèm mã", () => {
    const m = humanizePublishError("weird");
    expect(m).toContain("weird");
    expect(m).not.toMatch(/^weird$/);
  });
});

describe("humanizePublishDetail — từng điều kiện chưa đạt", () => {
  it.each([
    ["openAt must be before closeAt", /giờ mở.*trước.*giờ đóng/i],
    ["durationMin must be positive", /thời lượng/i],
    ["oral exam has no material", /tài liệu/i],
    ["exam has no passages, standalone questions, or random sections", /chưa có câu hỏi/i],
    ["passage abc-123 has no questions", /đoạn văn.*chưa có câu/i],
    ["total points must be > 0", /tổng điểm/i],
  ])("%s", (raw, re) => {
    expect(humanizePublishDetail(raw)).toMatch(re);
  });

  it("không lộ id nội bộ của đoạn văn", () => {
    expect(humanizePublishDetail("passage abc-123 has no questions")).not.toContain("abc-123");
  });

  it("câu đã là tiếng Việt thì giữ nguyên", () => {
    const vi = 'Phần "Câu hỏi" đang để rút ngẫu nhiên nên chưa có câu hỏi cụ thể.';
    expect(humanizePublishDetail(vi)).toBe(vi);
  });
});
