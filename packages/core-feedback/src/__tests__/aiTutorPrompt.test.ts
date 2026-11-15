import { describe, expect, it } from "vitest";
import {
  buildSystemPrompt,
  resolveTutorFallbackLanguage,
  tutorLanguageRule,
  type LessonContext,
} from "../aiTutor/aiTutor";

/** Trợ giảng AI trả lời theo ngôn ngữ tin nhắn CUỐI của người học, không cứng tiếng Việt. */

function ctx(over: Partial<LessonContext> = {}): LessonContext {
  return {
    lessonId: "l1",
    lessonTitle: "Present perfect",
    courseTitle: "English for IT",
    courseLanguage: "en",
    uiLocale: "vi",
    contextText: "The present perfect connects the past with the present.",
    skillStates: [
      { skillCode: "lesson.l1", skillName: "Present perfect", masteryProbability: 0.2 },
      { skillCode: "lesson.l0", skillName: "Past simple", masteryProbability: 0.9 },
    ],
    ...over,
  };
}

describe("buildSystemPrompt — ngôn ngữ trả lời", () => {
  it("có chỉ dẫn 'trả lời theo ngôn ngữ tin nhắn cuối' ở đầu và cuối prompt", () => {
    const p = buildSystemPrompt(ctx());
    expect(p.startsWith("LANGUAGE RULE")).toBe(true);
    expect(p).toContain("language of the user's LAST message");
    expect(p.trimEnd().endsWith(tutorLanguageRule(ctx()))).toBe(true);
    expect(p.split("LANGUAGE RULE").length - 1).toBe(2);
  });

  it("quy định cả câu hỏi quiz/Socratic, nhãn phương án, tiêu đề cùng ngôn ngữ", () => {
    const p = buildSystemPrompt(ctx());
    expect(p).toMatch(/quiz\/practice questions and their option labels, headings/);
  });

  it("truyền ngôn ngữ khoá học làm gợi ý dự phòng", () => {
    expect(buildSystemPrompt(ctx({ courseLanguage: "en" }))).toContain("answer in English (the course's language");
    expect(buildSystemPrompt(ctx({ courseLanguage: "vi", uiLocale: "en" }))).toContain("answer in Vietnamese (the course's language");
  });

  it("khoá học không có ngôn ngữ nhận diện được → dùng ngôn ngữ giao diện, rồi tiếng Việt", () => {
    expect(resolveTutorFallbackLanguage(null, "en")).toBe("English");
    expect(resolveTutorFallbackLanguage("xx", "en")).toBe("English");
    expect(resolveTutorFallbackLanguage("en-US", "vi")).toBe("English");
    expect(resolveTutorFallbackLanguage(undefined, undefined)).toBe("Vietnamese");
  });

  it("không còn câu lệnh cứng tiếng Việt: chỉ dẫn viết bằng tiếng Anh, không bắt trả lời tiếng Việt", () => {
    const p = buildSystemPrompt(ctx());
    // Mọi ký tự có dấu tiếng Việt trong prompt chỉ được đến từ dữ liệu, không phải từ chỉ dẫn.
    expect(p).not.toMatch(/[ăâđêôơưàảãáạằẳẵắặầẩẫấậèẻẽéẹềểễếệìỉĩíịòỏõóọồổỗốộờởỡớợùủũúụừửữứựỳỷỹýỵ]/i);
    expect(p).not.toMatch(/tiếng Việt|Trả lời/);
    expect(p).not.toMatch(/always (answer|reply|respond) in Vietnamese/i);
  });

  it("nội dung bài bằng tiếng Việt vẫn không đổi quy tắc ngôn ngữ", () => {
    const p = buildSystemPrompt(ctx({ contextText: "Thì hiện tại hoàn thành nối quá khứ với hiện tại.", skillStates: [] }));
    expect(p).toContain("NOT from the language of the lesson content");
    expect(p).toContain("Thì hiện tại hoàn thành");
  });

  it("vẫn mang ngữ cảnh bài học và tình trạng skill", () => {
    const p = buildSystemPrompt(ctx());
    expect(p).toContain('Course: "English for IT"');
    expect(p).toContain("Weak: Present perfect (20%)");
    expect(p).toContain("Mastered: Past simple");
  });
});
