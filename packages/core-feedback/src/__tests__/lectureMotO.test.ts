import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { buildOutlinePrompt, generateLectureOutline } from "../aiTutor/lectureOutline";
import { buildSlidesPrompt } from "../aiTutor/lectureSlides";
import { buildInteractionTopUpPrompt } from "../aiTutor/lectureInteractions";

/** Trang Tạo bài giảng một ô: mô tả đi cùng tài liệu, ít nhất 5 tương tác, 90 phút — docs/tieu-chi/tao-bai-giang-mot-o.md (M9, M13–M17). */

const doc = "Phản hồi là thông tin về khoảng cách giữa kết quả hiện tại và mục tiêu học tập. ".repeat(6);
const base = { sourceText: doc, minutes: 30, minSlides: 16, maxSlides: 20 };
const never = () => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;

describe("yêu cầu của giảng viên đi cùng tài liệu (M9)", () => {
  it("có yêu cầu: thêm mục riêng và quy tắc làm theo, kiến thức vẫn chỉ từ tài liệu", () => {
    const { system, user } = buildOutlinePrompt({ ...base, intent: "Dạy cho sinh viên năm nhất, tập trung phần ứng dụng." });
    expect(user).toContain("# Yêu cầu của giảng viên");
    expect(user).toContain("Dạy cho sinh viên năm nhất");
    expect(user.indexOf("# Yêu cầu của giảng viên")).toBeLessThan(user.indexOf("# Tài liệu"));
    expect(system).toMatch(/Làm theo yêu cầu của giảng viên/);
    expect(system).toMatch(/chỉ lấy từ tài liệu/);
  });
  it("không có yêu cầu thì không có mục đó", () => {
    expect(buildOutlinePrompt(base).user).not.toContain("# Yêu cầu của giảng viên");
    expect(buildOutlinePrompt({ ...base, intent: "   " }).user).not.toContain("# Yêu cầu của giảng viên");
  });
  it("câu lệnh tạo slide cũng mang yêu cầu", () => {
    const p = buildSlidesPrompt({
      sourceText: doc,
      deckTitle: "Phản hồi",
      outline: [{ index: 0, kind: "content", layout: "image", title: "Phản hồi là gì", points: ["Phản hồi chỉ ra khoảng cách."] }],
      batch: [0],
      intent: "Dạy cho sinh viên năm nhất.",
    });
    expect(p.user).toContain("# Yêu cầu của giảng viên");
  });
});

describe("mức tối thiểu tương tác trong câu lệnh dàn ý (M14–M16)", () => {
  it("mặc định ít nhất 5 slide tương tác, 3 loại; bảng trắng tối đa 1", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).toContain("ít nhất 5 slide tương tác");
    expect(system).toContain("ít nhất 3 loại");
    expect(system).toMatch(/"whiteboard"[^\n]*tối đa 1/);
  });
  it("90 phút: 10 slide tương tác, 4 loại, 4 đến 6 phần nội dung", () => {
    const { system } = buildOutlinePrompt({ ...base, minutes: 90, minSlides: 42, maxSlides: 50, minInteractions: 10, minInteractionKinds: 4, contentParts: [4, 6] });
    expect(system).toContain("ít nhất 10 slide tương tác");
    expect(system).toContain("ít nhất 4 loại");
    expect(system).toContain("4 đến 6 phần nội dung");
  });
  it("cho phép tới 50 slide, không quá 60 (M13)", async () => {
    await expect(generateLectureOutline("u", { ...base, minSlides: 42, maxSlides: 61 }, never())).rejects.toMatchObject({ code: "validation_failed" });
  });
});

describe("câu lệnh bổ sung tương tác (M17, M18)", () => {
  const outline = [
    { index: 0, kind: "content", layout: "cover", title: "Phản hồi trong dạy học", part: "" },
    { index: 1, kind: "content", layout: "image", title: "Phản hồi là gì", part: "Khái niệm" },
    { index: 2, kind: "quiz", layout: null, title: "Đâu là phản hồi tốt?", part: "Khái niệm" },
    { index: 3, kind: "content", layout: "summary", title: "Tổng kết", part: "" },
  ];
  it("nêu đúng số cần thêm, loại cần có thêm, bảng trắng và luật vị trí", () => {
    const { system, user } = buildInteractionTopUpPrompt({ sourceText: doc, outline, need: 4, needKinds: 2, existingKinds: ["quiz"], whiteboardUsed: false, intent: "Sinh viên năm nhất." });
    expect(system).toContain("ĐÚNG 4 slide tương tác");
    expect(system).toContain("ít nhất 2 loại chưa có");
    expect(system).toMatch(/không hai slide tương tác liền nhau/i);
    expect(user).toContain("1. (Khái niệm) [content/image] Phản hồi là gì");
    expect(user).toContain("# Yêu cầu của giảng viên");
  });
  it("đã có bảng trắng thì cấm thêm", () => {
    const { system } = buildInteractionTopUpPrompt({ sourceText: doc, outline, need: 1, needKinds: 0, existingKinds: ["quiz", "whiteboard"], whiteboardUsed: true });
    expect(system).toMatch(/KHÔNG dùng "whiteboard"/);
  });
});

describe("đa dạng bố cục (M23)", () => {
  it("câu lệnh dàn ý giới hạn Chữ và hình và cấm lặp một bố cục quá 2 slide liền", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).toContain("không quá 2 slide nội dung liền nhau cùng layout");
    expect(system).toContain('"image" chiếm không quá 40%');
  });
});

describe("slide tương tác ghi đúng loại (người dùng báo 2026-10-19)", () => {
  it("câu lệnh dàn ý cấm ghi tên loại vào tiêu đề", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).toContain('không bao giờ là "content"');
    expect(system).toContain('KHÔNG mở đầu bằng tên loại');
    expect(system).toContain("Không viết thêm slide nội dung để báo trước");
  });
});
