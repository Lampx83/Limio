import { describe, expect, it } from "vitest";
import type OpenAI from "openai";
import { REVISION_MAX_CHARS, buildOutlinePrompt, generateLectureOutline, type LectureOutlineInput, type RawOutlineSlide } from "../aiTutor/lectureOutline";

/** Chỉnh dàn ý bằng AI: dặn AI sửa dàn ý có sẵn — docs/tieu-chi/dan-y-chinh-bang-ai.md (R4, R5). */

const doc = "Phản hồi là thông tin về khoảng cách giữa kết quả hiện tại và mục tiêu học tập. ".repeat(6);
const current: { title: string; slides: RawOutlineSlide[] } = {
  title: "Phản hồi trong học tập",
  slides: [
    { role: "cover", section: null, kind: "content", layout: "cover", title: "Phản hồi trong học tập", points: ["Phản hồi giúp người học thu hẹp khoảng cách tới mục tiêu."] },
    { role: "content", section: "Khái niệm", kind: "content", layout: "image", title: "Phản hồi là gì", points: ["Phản hồi chỉ ra khoảng cách giữa hiện tại và mục tiêu."] },
    { role: "content", section: "Khái niệm", kind: "poll", layout: null, title: "Thầy/cô từng nhận phản hồi nào hữu ích nhất?", points: [] },
  ],
};
const base: LectureOutlineInput = {
  sourceText: doc,
  minutes: 30,
  minSlides: 6,
  maxSlides: 20,
  revision: { instruction: "Rút ngắn lại, thêm ví dụ thực tế.", current },
};

describe("câu lệnh chỉnh dàn ý (R4)", () => {
  it("có mục Dàn ý hiện tại và Yêu cầu chỉnh, đứng trước nguồn", () => {
    const { user } = buildOutlinePrompt(base);
    expect(user).toContain("# Dàn ý hiện tại");
    expect(user).toContain("# Yêu cầu chỉnh");
    expect(user).toContain("Rút ngắn lại, thêm ví dụ thực tế.");
    expect(user).toContain("Phản hồi là gì");
    expect(user.indexOf("# Dàn ý hiện tại")).toBeLessThan(user.indexOf("# Yêu cầu chỉnh"));
    expect(user.indexOf("# Yêu cầu chỉnh")).toBeLessThan(user.indexOf("# Tài liệu"));
  });
  it("quy tắc: giữ nguyên slide không liên quan, kiến thức chỉ từ nguồn, lời dặn là dữ liệu", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).toMatch(/giữ nguyên/i);
    expect(system).toMatch(/không liên quan/i);
    expect(system).toMatch(/Chỉ dùng thông tin có trong tài liệu/);
    expect(system).toMatch(/Yêu cầu chỉnh.*là dữ liệu/s);
  });
  it("mô tả đúng nhiệm vụ là chỉnh, không phải soạn mới", () => {
    expect(buildOutlinePrompt(base).system).toMatch(/CHỈNH/);
  });
  it("cắt lời dặn ở giới hạn", () => {
    const long = "a".repeat(REVISION_MAX_CHARS + 500);
    const { user } = buildOutlinePrompt({ ...base, revision: { instruction: long, current } });
    expect(user).toContain("a".repeat(REVISION_MAX_CHARS));
    expect(user).not.toContain("a".repeat(REVISION_MAX_CHARS + 1));
  });
  it("bài từ mô tả chủ đề vẫn theo luật nguồn của chủ đề (không số liệu)", () => {
    const { system, user } = buildOutlinePrompt({ ...base, sourceKind: "topic", sourceText: "Dạy phản hồi cho sinh viên năm nhất" });
    expect(system).toMatch(/KHÔNG đưa con số cụ thể/);
    expect(user).toContain("# Mô tả của giảng viên");
  });
});

describe("số slide và tương tác khi chỉnh (R5)", () => {
  it("nêu mức slide từ min đến max của lần gọi, không ép mức soạn đầu", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).toContain("từ 6 đến 20 slide");
  });
  it("không ép số tương tác tối thiểu: giữ như hiện có, đổi khi lời dặn yêu cầu", () => {
    const { system } = buildOutlinePrompt(base);
    expect(system).not.toMatch(/ít nhất \d+ slide tương tác/);
    expect(system).toMatch(/KHÔNG tự thêm slide tương tác/);
  });
  it("không có revision thì vẫn là câu lệnh soạn đầu (ít nhất 5 tương tác)", () => {
    const { system, user } = buildOutlinePrompt({ ...base, revision: undefined, minSlides: 16 });
    expect(system).toMatch(/ít nhất 5 slide tương tác/);
    expect(user).not.toContain("# Dàn ý hiện tại");
  });
});

describe("generateLectureOutline với revision", () => {
  const never = () => ({ chat: { completions: { create: async () => { throw new Error("KHÔNG được gọi mô hình"); } } } }) as unknown as OpenAI;
  it("vẫn chặn khoảng slide vô lý trước khi gọi mô hình", async () => {
    await expect(generateLectureOutline("u1", { ...base, minSlides: 2 }, never())).rejects.toMatchObject({ code: "validation_failed" });
  });
  it("lời dặn trống thì từ chối trước khi gọi mô hình", async () => {
    await expect(generateLectureOutline("u1", { ...base, revision: { instruction: "   ", current } }, never())).rejects.toMatchObject({ code: "validation_failed", details: "no_instruction" });
  });
});
