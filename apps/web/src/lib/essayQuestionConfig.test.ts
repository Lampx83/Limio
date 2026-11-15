import { describe, expect, it } from "vitest";
import { buildEssayConfig, buildFreeChatConfig, freeChatDraftFromConfig, emptyFreeChatDraft, buildRolePlayConfig, cleanExplanationAudio, emptyEssayDraft, essayDraftFromConfig, rolePlayDraftFromConfig } from "./essayQuestionConfig";

// docs/tieu-chi/bai-luyen-tra-loi-bang-giong-noi-va-bai-mau.md — AC3, AC5a.

describe("buildEssayConfig", () => {
  it("câu trống: config rỗng (hai công tắc mặc định bật không được ghi ra)", () => {
    expect(buildEssayConfig(emptyEssayDraft())).toEqual({});
  });

  it("có bài mẫu, tiêu chí, số từ, audio mẫu thì ghi đủ; bài mẫu được cắt khoảng trắng", () => {
    const cfg = buildEssayConfig({
      ...emptyEssayDraft(),
      rubric: "<p>Nêu ít nhất ba mốc thời gian</p>",
      minWords: 40,
      explanation: "  I learned about the first day.  ",
      explanationAudio: "/api/exam-assets/ex-1-abc.mp3",
    });
    expect(cfg).toEqual({
      rubric: "<p>Nêu ít nhất ba mốc thời gian</p>",
      minWords: 40,
      explanation: "I learned about the first day.",
      explanationAudio: "/api/exam-assets/ex-1-abc.mp3",
    });
  });

  it("công tắc chỉ được lưu khi TẮT", () => {
    expect(buildEssayConfig({ ...emptyEssayDraft(), voiceAnswer: false })).toEqual({ voiceAnswer: false });
    expect(buildEssayConfig({ ...emptyEssayDraft(), aiFeedback: false })).toEqual({ aiFeedback: false });
    expect(buildEssayConfig({ ...emptyEssayDraft(), voiceAnswer: false, aiFeedback: false })).toEqual({ voiceAnswer: false, aiFeedback: false });
    expect("voiceAnswer" in buildEssayConfig({ ...emptyEssayDraft(), voiceAnswer: true })).toBe(false);
  });

  it("số từ 0 hoặc âm không được ghi; audio sai đường dẫn bị bỏ (không lọt vào config)", () => {
    const cfg = buildEssayConfig({ ...emptyEssayDraft(), minWords: 0, explanationAudio: "https://evil.example/a.mp3" });
    expect(cfg).toEqual({});
    expect(buildEssayConfig({ ...emptyEssayDraft(), minWords: -3 })).toEqual({});
  });
});

describe("essayDraftFromConfig", () => {
  it("câu cũ chưa có khoá mới: hai công tắc bật, không có audio", () => {
    const d = essayDraftFromConfig({ rubric: "Tiêu chí", minWords: 20 });
    expect(d).toMatchObject({ rubric: "Tiêu chí", minWords: 20, explanation: "", explanationAudio: "", voiceAnswer: true, aiFeedback: true });
  });

  it("đọc lại đúng những gì đã lưu (vòng đi vòng lại không đổi)", () => {
    const saved = {
      rubric: "R",
      minWords: 10,
      explanation: "Mẫu",
      explanationAudio: "/api/exam-assets/a.mp3",
      voiceAnswer: false,
      aiFeedback: false,
    };
    expect(buildEssayConfig(essayDraftFromConfig(saved))).toEqual(saved);
  });

  it("đổi chữ thường của rubric cũ thành HTML qua hàm được truyền", () => {
    expect(essayDraftFromConfig({ rubric: "a" }, (s) => `<p>${s}</p>`).rubric).toBe("<p>a</p>");
  });
});

describe("cleanExplanationAudio", () => {
  it("chỉ nhận /api/exam-assets/<tên tệp>", () => {
    expect(cleanExplanationAudio("/api/exam-assets/x_1-2.mp3")).toBe("/api/exam-assets/x_1-2.mp3");
    for (const bad of ["", "x.mp3", "/api/exam-assets/", "/api/exam-assets/a/b.mp3", "/limio/api/exam-assets/a.mp3", "/api/exam-assets/a.mp3?x=1", null, 5]) {
      expect(cleanExplanationAudio(bad)).toBe("");
    }
  });
});

describe("hội thoại đóng vai trong trình soạn", () => {
  const draft = { text: "A: Hi.\nB: Hello there.\n\nA: Bye.", roleA: "Khách", roleB: "", audio: ["/api/exam-assets/a.m4a", "", "https://evil.example/x.mp3"] };

  it("dựng config: lượt theo thứ tự, tên vai chỉ ghi khi có, audio đúng số thứ tự lượt và chỉ nhận đường dẫn kho đề", () => {
    expect(buildRolePlayConfig(draft)).toEqual({
      roles: { A: "Khách" },
      turns: [
        { speaker: "A", text: "Hi.", audio: "/api/exam-assets/a.m4a" },
        { speaker: "B", text: "Hello there." },
        { speaker: "A", text: "Bye." },
      ],
    });
  });

  it("ít hơn 2 lượt thì không ghi roleplay (câu vẫn là câu mở thường); dòng sai dạng bị bỏ", () => {
    expect(buildRolePlayConfig({ ...draft, text: "A: Hi." })).toBeUndefined();
    expect(buildRolePlayConfig({ ...draft, text: "xin chào\nA: Hi.\nB: Yo." })!.turns).toHaveLength(2);
    expect(buildEssayConfig(emptyEssayDraft(), { ...draft, text: "" })).toEqual({});
  });

  it("buildEssayConfig kèm roleplay; đọc lại config ra đúng bản nháp (khứ hồi)", () => {
    const cfg = buildEssayConfig(emptyEssayDraft(), draft);
    expect(cfg).toHaveProperty("roleplay");
    const back = rolePlayDraftFromConfig(cfg);
    expect(back.text).toBe("A: Hi.\nB: Hello there.\nA: Bye.");
    expect(back.roleA).toBe("Khách");
    expect(back.roleB).toBe("");
    expect(back.audio).toEqual(["/api/exam-assets/a.m4a", "", ""]);
  });
});

describe("thử nói tự do trong trình soạn", () => {
  const d = { scenario: " Choose what to take. ", partnerRole: "Sam", learnerRole: "", opening: "What would you take?", targets: "I'm not sure about that\n\n  not really essential \n", maxTurns: 99 };

  it("dựng config: cắt khoảng trắng, mỗi dòng một cụm, số lượt kẹp 4–12, vai trống thì bỏ", () => {
    expect(buildFreeChatConfig(d)).toEqual({
      scenario: "Choose what to take.",
      partnerRole: "Sam",
      opening: "What would you take?",
      targets: ["I'm not sure about that", "not really essential"],
      maxTurns: 12,
    });
    expect(buildFreeChatConfig({ ...d, maxTurns: 1 })!.maxTurns).toBe(4);
  });
  it("thiếu tình huống hoặc lời mở đầu thì không ghi freechat", () => {
    expect(buildFreeChatConfig({ ...d, scenario: " " })).toBeUndefined();
    expect(buildFreeChatConfig({ ...d, opening: "" })).toBeUndefined();
    expect(buildFreeChatConfig(emptyFreeChatDraft())).toBeUndefined();
  });
  it("buildEssayConfig: ghi freechat; có kịch bản đóng vai thì bỏ freechat (chọn một); khứ hồi giữ nguyên nội dung", () => {
    const cfg = buildEssayConfig(emptyEssayDraft(), undefined, d);
    expect(cfg).toHaveProperty("freechat");
    const back = freeChatDraftFromConfig(cfg);
    expect(back).toMatchObject({ scenario: "Choose what to take.", partnerRole: "Sam", learnerRole: "", opening: "What would you take?", maxTurns: 12 });
    expect(back.targets).toBe("I'm not sure about that\nnot really essential");
    const both = buildEssayConfig(emptyEssayDraft(), { text: "A: Hi.\nB: Hello.", roleA: "", roleB: "", audio: [] }, d);
    expect(both).toHaveProperty("roleplay");
    expect(both).not.toHaveProperty("freechat");
  });
});

describe("scaffold của bạn ảo trong trình soạn", () => {
  const base = { scenario: "Choose what to take.", partnerRole: "", learnerRole: "", opening: "What would you take?", targets: "I would take…", maxTurns: 8 };
  it("dựng scaffold: mỗi dòng một mục, dấu | tách nghĩa, dòng thiếu nghĩa vẫn lưu, quá giới hạn thì cắt", () => {
    const cfg = buildFreeChatConfig({
      ...base,
      ideas: "Chọn một món\n\n Nói vì sao \nÝ 3\nÝ 4\nÝ 5",
      frames: "I would take ___ because ___. | Tôi sẽ mang ___ vì ___.\nWhat about you?",
      phrases: "take my passport | mang hộ chiếu\nleave it behind",
      vocab: "passport | hộ chiếu\nvaluable",
      modelText: " **I would take** my phone. ",
      modelAudio: "/api/exam-assets/m.m4a",
    })!;
    expect(cfg.scaffold).toEqual({
      ideas: ["Chọn một món", "Nói vì sao", "Ý 3", "Ý 4"],
      frames: [
        { en: "I would take ___ because ___.", vi: "Tôi sẽ mang ___ vì ___." },
        { en: "What about you?", vi: "" },
      ],
      phrases: [
        { en: "take my passport", vi: "mang hộ chiếu" },
        { en: "leave it behind", vi: "" },
      ],
      vocab: [
        { en: "passport", vi: "hộ chiếu" },
        { en: "valuable", vi: "" },
      ],
      model: { text: "**I would take** my phone.", audio: "/api/exam-assets/m.m4a" },
    });
  });
  it("không điền gì thì không ghi scaffold (cấu hình cũ giữ nguyên)", () => {
    expect(buildFreeChatConfig(base)).not.toHaveProperty("scaffold");
    expect(buildFreeChatConfig({ ...base, ideas: " ", frames: "|", phrases: "", vocab: "", modelText: " " })).not.toHaveProperty("scaffold");
  });
  it("khứ hồi: dựng rồi đọc lại ra đúng ba ô", () => {
    const d = { ...base, ideas: "Chọn một món", frames: "I would take ___. | Tôi sẽ mang ___.\nWhat about you?", phrases: "take my passport | mang hộ chiếu", vocab: "passport | hộ chiếu", modelText: "**I would take** my phone.", modelAudio: "/api/exam-assets/m.m4a" };
    const back = freeChatDraftFromConfig(buildEssayConfig(emptyEssayDraft(), undefined, d));
    expect(back.ideas).toBe("Chọn một món");
    expect(back.frames).toBe("I would take ___. | Tôi sẽ mang ___.\nWhat about you?");
    expect(back.phrases).toBe("take my passport | mang hộ chiếu");
    expect(back.vocab).toBe("passport | hộ chiếu");
    expect(back.modelText).toBe("**I would take** my phone.");
    expect(back.modelAudio).toBe("/api/exam-assets/m.m4a");
    expect(freeChatDraftFromConfig({}).frames).toBe("");
  });
});
