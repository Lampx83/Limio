import { describe, expect, it } from "vitest";
import { ASSISTANT_DESTINATIONS } from "./teacherAssistant";
import { ASSISTANT_LIMITS, GUIDES, MAX_GUIDES_PER_TURN, selectGuides } from "./teacherAssistantGuide";

describe("kho hướng dẫn", () => {
  it("mã mục không trùng, mỗi mục có từ khoá và nội dung gọn", () => {
    const ids = GUIDES.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const g of GUIDES) {
      expect(g.keywords.length).toBeGreaterThan(2);
      expect(g.body.length).toBeGreaterThan(80);
      // Mỗi lượt có thể mang tới 3 mục: giữ mỗi mục dưới ~1.500 chữ để prompt không phình.
      expect(g.body.length).toBeLessThan(1500);
    }
  });

  it("mọi điểm đến được nhắc tới đều có trong danh mục", () => {
    const known = new Set(ASSISTANT_DESTINATIONS.map((d) => d.id));
    for (const g of GUIDES) for (const id of g.destinationIds) expect(known.has(id), `${g.id} → ${id}`).toBe(true);
  });

  it("không hứa tính năng Limio chưa có (nhập Markdown, thông báo lớp, kéo thả chương)", () => {
    const all = GUIDES.map((g) => g.body).join(" ");
    expect(all).not.toMatch(/nhập bài từ markdown bằng|gửi thông báo cho cả lớp bằng/i);
    expect(ASSISTANT_LIMITS).toMatch(/Markdown/);
    expect(ASSISTANT_LIMITS).toMatch(/thông báo/);
  });
});

describe("selectGuides", () => {
  it("câu hỏi cách làm kéo đúng mục liên quan", () => {
    const ids = selectGuides("Làm sao tạo đề thi từ ngân hàng câu hỏi?").map((g) => g.id);
    expect(ids).toContain("thiet-ke-de-thi");
    expect(ids).toContain("ngan-hang-cau-hoi");
  });

  it("không phân biệt dấu và hoa thường", () => {
    expect(selectGuides("tao link thi nhanh cho lop").map((g) => g.id)[0]).toBe("to-chuc-thi");
    expect(selectGuides("DIỄN ĐÀN có câu hỏi chưa trả lời").map((g) => g.id)).toContain("dien-dan");
  });

  it("chào hỏi hoặc trò chuyện thì không mang hướng dẫn nào", () => {
    expect(selectGuides("Xin chào Limio, hôm nay thầy hơi mệt")).toEqual([]);
    expect(selectGuides("cảm ơn nhé")).toEqual([]);
  });

  it("tối đa 3 mục và xếp mục khớp nhiều từ khoá lên trước", () => {
    const r = selectGuides("bài tập chấm bài nhận xét rubric hạn nộp đề thi câu hỏi lớp học diễn đàn");
    expect(r.length).toBeLessThanOrEqual(MAX_GUIDES_PER_TURN);
    expect(r[0]!.id).toBe("bai-tap-cham-bai");
  });

  it("giữ mạch hội thoại: câu hỏi ngắn tiếp nối vẫn nhận mục của câu trước", () => {
    expect(selectGuides("còn bước tiếp theo thì sao?", ["Cách tạo link thi nhanh cho lớp"]).map((g) => g.id)).toContain("to-chuc-thi");
  });

  it("từ khoá ngắn chỉ khớp nguyên từ, không khớp giữa từ khác", () => {
    // "xp" không được khớp trong "expert"; "vote" không khớp trong "devoted".
    expect(selectGuides("an expert and devoted teacher")).toEqual([]);
  });
});
