import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import {
  TEACHER_ASSISTANT_HISTORY_TURNS,
  TEACHER_ASSISTANT_MESSAGE_MAX,
  buildTeacherAssistantPrompt,
  generateTeacherAssistantReply,
  type TeacherAssistantInput,
} from "../aiTutor/teacherAssistant";

/** Trợ lý trang chủ giảng viên: prompt chỉ cho chọn mã trong danh mục và không tin tin nhắn của người dùng. */

const base: TeacherAssistantInput = {
  situation: "Đang dạy 1 khoá: Toán 1.\n3 bài tự luận đang chờ chấm.",
  destinations: [
    { id: "poll", label: "Bình chọn nhanh", description: "Hỏi cả lớp một câu." },
    { id: "grade_essays", label: "Chấm bài tự luận", description: "Chấm các câu tự luận đang chờ." },
  ],
  history: [],
  message: "Hôm nay tôi chưa có ý tưởng.",
};
const never = () => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;

describe("buildTeacherAssistantPrompt", () => {
  it("liệt kê mọi mã điểm đến và buộc mô hình chỉ dùng mã trong danh mục", () => {
    const { system } = buildTeacherAssistantPrompt(base);
    expect(system).toContain("- poll: Bình chọn nhanh");
    expect(system).toContain("- grade_essays: Chấm bài tự luận");
    expect(system).toMatch(/Chỉ dùng mã có trong danh mục/);
  });

  it("đưa tình hình thật vào phần người dùng và cấm bịa số liệu", () => {
    const { system, user } = buildTeacherAssistantPrompt(base);
    expect(user).toContain("3 bài tự luận đang chờ chấm");
    expect(system).toMatch(/Không bịa số liệu/);
  });

  it("coi tin nhắn là dữ liệu: nằm trong khối ngoặc kép, cắt theo giới hạn", () => {
    const { user } = buildTeacherAssistantPrompt({ ...base, message: "x".repeat(TEACHER_ASSISTANT_MESSAGE_MAX + 300) });
    const inner = user.split('"""')[1]!;
    expect(inner.trim().length).toBe(TEACHER_ASSISTANT_MESSAGE_MAX);
  });

  it("chỉ gửi các lượt gần nhất của lịch sử", () => {
    const history = Array.from({ length: 20 }, (_, i) => ({ role: i % 2 ? ("assistant" as const) : ("user" as const), text: `lượt ${i}` }));
    const { user } = buildTeacherAssistantPrompt({ ...base, history });
    expect(user).toContain("lượt 19");
    expect(user).not.toContain(`lượt ${19 - TEACHER_ASSISTANT_HISTORY_TURNS} `);
    expect(user).not.toContain("lượt 0\n");
  });
});

describe("hướng dẫn cách dùng và trò chuyện thân thiện", () => {
  it("có hướng dẫn thì đưa vào prompt cùng mục 'điều Limio chưa có'", () => {
    const { system } = buildTeacherAssistantPrompt({
      ...base,
      guides: [{ title: "Tổ chức thi", body: 'Bấm "Mở" để nhận đường dẫn và mã QR.' }],
      limits: "Limio chưa có: gửi thông báo cho cả lớp.",
    });
    expect(system).toContain("# TÀI LIỆU HƯỚNG DẪN");
    expect(system).toContain("## Tổ chức thi");
    expect(system).toContain('Bấm "Mở" để nhận đường dẫn và mã QR.');
    expect(system).toContain("# ĐIỀU LIMIO CHƯA CÓ");
    expect(system).toContain("gửi thông báo cho cả lớp");
  });

  it("không có hướng dẫn thì không có khối tài liệu (câu chào, trò chuyện)", () => {
    const { system } = buildTeacherAssistantPrompt(base);
    expect(system).not.toContain("# TÀI LIỆU HƯỚNG DẪN");
    expect(system).not.toContain("# ĐIỀU LIMIO CHƯA CÓ");
  });

  it("buộc trả lời theo tài liệu, không bịa bước, và cho phép trò chuyện thân thiện", () => {
    const { system } = buildTeacherAssistantPrompt(base);
    expect(system).toMatch(/theo đúng tài liệu/);
    expect(system).toMatch(/Không bịa tính năng, nút hay bước làm/);
    expect(system).toMatch(/Trò chuyện thân thiện/);
    expect(system).toMatch(/không tư vấn y tế, pháp lý, tài chính, chính trị/);
  });
});

describe("generateTeacherAssistantReply", () => {
  it("tin nhắn rỗng bị từ chối trước khi chạm mô hình", async () => {
    await expect(generateTeacherAssistantReply("u1", { ...base, message: "   " }, never())).rejects.toMatchObject({ code: "validation_failed" });
  });
});
