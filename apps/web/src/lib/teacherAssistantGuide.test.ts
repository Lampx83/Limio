import { describe, expect, it } from "vitest";
import { ASSISTANT_DESTINATIONS } from "./teacherAssistant";
import { ASSISTANT_LIMITS, GUIDES, MAX_GUIDES_PER_TURN, pickIdeaSeeds, selectGuides } from "./teacherAssistantGuide";

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
    expect(ASSISTANT_LIMITS).toMatch(/thông báo/);
    // Nhập tệp .md đã có trong luồng "Văn bản — AI hỗ trợ", nên không còn nằm trong mục "chưa có".
    expect(ASSISTANT_LIMITS).not.toMatch(/nhập bài từ Markdown/);
  });
});

describe("rubric (lỗi trả lời sai: nói Limio chưa hỗ trợ rubric)", () => {
  it("câu hỏi về nhập rubric kéo mục rubric lên đầu, và mục đó khẳng định CÓ hỗ trợ ở cả bốn nơi", () => {
    const ids = selectGuides("Trên limio có hỗ trợ nhập rubric để AI chấm mà").map((g) => g.id);
    expect(ids[0]).toBe("rubric");
    const g = GUIDES.find((x) => x.id === "rubric")!;
    expect(g.body).toMatch(/Limio CÓ hỗ trợ nhập rubric/);
    for (const part of ["Lưu rubric", "Rubric (tuỳ chọn)", "Nhập rubric", "Đấu trường"]) expect(g.body).toContain(part);
    expect(g.destinationIds).toEqual(expect.arrayContaining(["assignments", "grade_essays", "oral_exams", "tournaments"]));
  });

  it("không mục nào nói là chưa có rubric", () => {
    for (const g of GUIDES) expect(g.body, g.id).not.toMatch(/chưa (có|hỗ trợ)[^.]*rubric/i);
  });

  it("mục 'điều Limio chưa có' không được nói như thể chưa có rubric", () => {
    expect(ASSISTANT_LIMITS).toMatch(/AI có đọc nó khi gợi ý điểm/);
    expect(ASSISTANT_LIMITS).not.toMatch(/chưa có:[^.]*;\s*bảng tiêu chí chấm có cấu trúc \(rubric là/);
  });
});

describe("tri thức đã cập nhật theo giao diện 2026-10-19", () => {
  const all = GUIDES.map((g) => g.body).join("\n");

  it("không còn hướng dẫn tạo đợt thi hay Trưởng đợt (đã gỡ khỏi luồng tổ chức thi)", () => {
    expect(all).not.toMatch(/\+ Tạo đợt thi|Trưởng đợt|tab Đợt thi/);
    const g = GUIDES.find((x) => x.id === "to-chuc-thi")!;
    expect(g.body).toMatch(/Ca thi/);
    expect(g.body).toMatch(/không còn khái niệm đợt thi/);
  });

  it("giữ các nhãn giao diện thật còn tiếng Anh để giảng viên tìm được", () => {
    expect(all).toContain('"Assignment"');
    expect(all).toContain("Forum Q&A");
    expect(all).toContain("Learner Insights");
    expect(all).toContain('"Publish"');
  });

  it("câu hỏi các tính năng mới kéo đúng mục", () => {
    const first = (q: string) => selectGuides(q)[0]?.id;
    expect(first("Làm sao tạo bài học từ tài liệu Word bằng AI?")).toBe("bai-hoc-tu-tai-lieu");
    expect(first("Cách tạo ca thi chính thức và nhập danh sách thí sinh")).toBe("to-chuc-thi");
    expect(first("Nộp bài theo nhóm thì giảng viên chỉnh nhóm ở đâu?")).toBe("bai-tap-nhom");
    expect(first("Tôi muốn tạo bài giảng từ file PowerPoint")).toBe("bai-giang-tao");
    expect(first("Thêm từ vựng và audio cho bài tiếng Trung")).toBe("ngoai-ngu");
    expect(first("Chia sẻ bài giảng bằng link và tải PDF")).toBe("bai-giang-trinh-chieu");
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

describe("tình huống dùng tính năng (ngữ cảnh áp dụng)", () => {
  it("mỗi mục có ít nhất hai tình huống, là câu đầy đủ xưng thầy/cô", () => {
    for (const g of GUIDES) {
      expect(g.useCases.length, g.id).toBeGreaterThanOrEqual(2);
      for (const u of g.useCases) {
        expect(u, `${g.id}: ${u}`).toMatch(/thầy\/cô/i);
        expect(u.length, `${g.id}: ${u}`).toBeGreaterThan(40);
        expect(u.length, `${g.id}: ${u}`).toBeLessThan(260);
      }
    }
  });

  it("pickIdeaSeeds: đủ số lượng, mỗi tình huống từ một mục khác nhau, ổn định theo seed", () => {
    const a = pickIdeaSeeds(10, 5);
    expect(a).toHaveLength(5);
    expect(new Set(a.map((x) => x.split(":")[0])).size).toBe(5);
    expect(pickIdeaSeeds(10, 5)).toEqual(a);
  });

  it("pickIdeaSeeds: các ngày khác nhau cho nhóm gợi ý khác nhau", () => {
    const days = Array.from({ length: 6 }, (_, d) => pickIdeaSeeds(20_000 + d, 5).join("|"));
    expect(new Set(days).size).toBe(6);
  });

  it("pickIdeaSeeds: seed âm hoặc rất lớn vẫn không lỗi", () => {
    expect(pickIdeaSeeds(-7, 3)).toHaveLength(3);
    expect(pickIdeaSeeds(10 ** 9, 3)).toHaveLength(3);
  });
});
