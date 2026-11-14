import { describe, expect, it } from "vitest";
import {
  FRAME_BLANK,
  STUCK_GROUPS,
  asPartnerSpeech,
  frameStem,
  frameUsed,
  freeChatErrorMessage,
  hasBlank,
  highlightSegments,
  insertIntoDraft,
  learnerTurnCount,
  parseFreeChatView,
  parseScaffoldView,
  phraseUsed,
  plainModel,
  restoreChat,
  transcriptOf,
  usedTargets,
} from "./freeChatView";

const cfg = { freechat: { scenario: "Choose what to take.", opening: "What would you take?", targets: ["I'm not sure about that", "When was the last time you…?", ""], maxTurns: 99 } };

describe("parseFreeChatView", () => {
  it("đọc cấu hình, bỏ cụm rỗng, kẹp số lượt, vai mặc định", () => {
    expect(parseFreeChatView(cfg)).toEqual({
      scenario: "Choose what to take.",
      opening: "What would you take?",
      targets: ["I'm not sure about that", "When was the last time you…?"],
      maxTurns: 12,
      partnerRole: "Partner",
      learnerRole: "You",
      scaffold: null,
    });
    expect(parseFreeChatView({ freechat: { scenario: "x", opening: "y", maxTurns: 1 } })!.maxTurns).toBe(4);
  });
  it("thiếu tình huống hoặc lời mở đầu thì null", () => {
    expect(parseFreeChatView({ freechat: { scenario: "x" } })).toBeNull();
    expect(parseFreeChatView({})).toBeNull();
    expect(parseFreeChatView(null)).toBeNull();
  });
});

describe("phraseUsed", () => {
  it("không phân biệt hoa thường, dấu câu và dấu nháy cong", () => {
    expect(phraseUsed("I'm not sure about that", "Hmm, i’m NOT sure about that!")).toBe(true);
    expect(phraseUsed("I'm not sure about that", "I am not sure about that")).toBe(false);
  });
  it("cụm có '…' chỉ cần phần đầu; phải là dãy từ liền nhau, không khớp giữa từ", () => {
    expect(phraseUsed("When was the last time you…?", "When was the last time you cooked?")).toBe(true);
    expect(phraseUsed("not really", "That is nothing really")).toBe(false);
    expect(phraseUsed("sure", "I am unsure")).toBe(false);
    expect(phraseUsed("…", "anything")).toBe(false);
  });
  it("cụm có '…' ở giữa: các đoạn phải có đủ và đúng thứ tự", () => {
    expect(phraseUsed("One advantage of … is …", "One advantage of living here is the quiet")).toBe(true);
    expect(phraseUsed("One advantage of … is …", "It is quiet. One advantage of it")).toBe(false);
    expect(phraseUsed("I prefer … because …", "Because it is calm I prefer cities")).toBe(false); // sai thứ tự
  });
  it("usedTargets theo thứ tự cụm", () => {
    expect(usedTargets(["a b", "c d"], ["x a b y"])).toEqual([true, false]);
  });
});

describe("bản chữ lưu và khôi phục", () => {
  const view = { opening: "What would you take?" };
  const hist = [
    { role: "learner" as const, text: "My laptop." },
    { role: "partner" as const, text: "Why that?" },
  ];
  it("transcriptOf rồi restoreChat cho lại đúng lịch sử; đếm lượt học viên", () => {
    const t = transcriptOf(view, hist);
    expect(t).toBe("[Free chat]\nPartner: What would you take?\nLearner: My laptop.\nPartner: Why that?");
    expect(restoreChat(t, view)).toEqual(hist);
    expect(learnerTurnCount(t)).toBe(1);
    expect(restoreChat(transcriptOf(view, []), view)).toEqual([]);
  });
  it("sai dạng, đổi lời mở đầu, không xen kẽ, kết thúc bằng học viên thì null", () => {
    expect(restoreChat("hello", view)).toBeNull();
    expect(restoreChat("[Free chat]\nPartner: Other opening\nLearner: x\nPartner: y", view)).toBeNull();
    expect(restoreChat("[Free chat]\nPartner: What would you take?\nPartner: x", view)).toBeNull();
    expect(restoreChat("[Free chat]\nPartner: What would you take?\nLearner: x", view)).toBeNull();
  });
});

describe("freeChatErrorMessage", () => {
  it("mã hạn mức, hết lượt, mạng, không rõ", () => {
    expect(freeChatErrorMessage("daily_token_cap")).toMatch(/Hạn mức AI/);
    expect(freeChatErrorMessage("turn_limit")).toMatch(/hết lượt/);
    expect(freeChatErrorMessage("control_group")).toMatch(/chưa mở cho lớp/);
    expect(freeChatErrorMessage("network")).toMatch(/Mất kết nối/);
    expect(freeChatErrorMessage("lạ")).toMatch(/Có lỗi/);
  });
});

describe("asPartnerSpeech", () => {
  it("nhận đúng dạng; bỏ đoạn rỗng/sai kiểu; sai dạng hoặc không có đoạn nào thì null", () => {
    expect(asPartnerSpeech({ audioChunks: ["QUJD", "", 5], contentType: "audio/mpeg" })).toEqual({ audioChunks: ["QUJD"], contentType: "audio/mpeg" });
    expect(asPartnerSpeech({ audioChunks: [], contentType: "audio/mpeg" })).toBeNull();
    expect(asPartnerSpeech({ audioChunks: ["x"] })).toBeNull();
    expect(asPartnerSpeech(null)).toBeNull();
    expect(asPartnerSpeech("x")).toBeNull();
  });
});

// docs/tieu-chi/limio-language-ban-ao-scaffolding-moc-1.md
describe("scaffolding mốc 1", () => {
  // BẢNG DÙNG CHUNG với packages/core-feedback/src/__tests__/practiceFreeChat.test.ts (hai bản phraseUsed không được lệch).
  const PHRASE_CASES: Array<[string, string, boolean]> = [
    ["I'm not sure about that", "Hmm, i’m NOT sure about that!", true],
    ["I'm not sure about that", "I am not sure about that", false],
    ["When was the last time you…?", "When was the last time you cooked?", true],
    ["not really", "That is nothing really", false],
    ["sure", "I am unsure", false],
    ["…", "anything", false],
    ["I would take…", "I would take my phone because it is useful", true],
    ["I prefer … because …", "I prefer cities because it's lively", true],
    ["One advantage of … is …", "One advantage of living here is the quiet", true],
    ["One advantage of … is …", "It is quiet. One advantage of it", false],
    ["I prefer … because …", "Because it is calm I prefer cities", false],
  ];
  it.each(PHRASE_CASES)("phraseUsed(%j, %j) = %s", (target, text, want) => {
    expect(phraseUsed(target, text)).toBe(want);
  });

  it("parseScaffoldView: giới hạn, bỏ mục sai, rỗng thì null; parseFreeChatView mang scaffold", () => {
    const sc = parseScaffoldView({
      ideas: ["a", "b", "c", "d", "e"],
      frames: [{ en: "I would take ___ because ___.", vi: "Tôi sẽ mang ___ vì ___." }, { vi: "thiếu en" }, null],
      phrases: [{ en: "take my passport", vi: "mang hộ chiếu" }],
      vocab: [{ en: "passport", vi: "hộ chiếu" }],
      model: { text: "**I would take** my phone.", audio: "/api/exam-assets/a.m4a" },
    })!;
    expect(sc.ideas).toHaveLength(4);
    expect(sc.frames).toEqual([{ en: "I would take ___ because ___.", vi: "Tôi sẽ mang ___ vì ___." }]);
    expect(sc.phrases).toEqual([{ en: "take my passport", vi: "mang hộ chiếu" }]);
    expect(sc.vocab).toEqual([{ en: "passport", vi: "hộ chiếu" }]);
    expect(sc.model).toEqual({ text: "**I would take** my phone.", audio: "/api/exam-assets/a.m4a" });
    // audio ngoài kho đề bị bỏ (chỉ còn chữ); đoạn mẫu rỗng thì không có model
    expect(parseScaffoldView({ model: { text: "Hi", audio: "https://evil.example/x.mp3" } })!.model).toEqual({ text: "Hi", audio: "" });
    expect(parseScaffoldView({ model: { text: "  " } })).toBeNull();
    expect(parseScaffoldView({})).toBeNull();
    expect(parseScaffoldView(undefined)).toBeNull();
    expect(parseFreeChatView(cfg)!.scaffold).toBeNull();
    expect(parseFreeChatView({ freechat: { ...cfg.freechat, scaffold: { vocab: [{ en: "x", vi: "y" }] } } })!.scaffold!.vocab).toHaveLength(1);
  });

  it("frameStem lấy đoạn không rỗng đầu tiên quanh chỗ trống; frameUsed so khớp theo đó", () => {
    expect(frameStem("I would take ___ because ___.")).toBe("I would take");
    expect(frameStem("___ is an important part of my day")).toBe("is an important part of my day");
    expect(frameStem("What about you?")).toBe("What about you?");
    expect(frameStem("___")).toBe("");
    expect(frameUsed("I would take ___ because ___.", ["I would take my phone because it has my photos."])).toBe(true);
    expect(frameUsed("I would take ___ because ___.", ["I will take my phone"])).toBe(false);
    expect(frameUsed("___", ["anything"])).toBe(false);
  });

  it("highlightSegments tách đoạn thường và đoạn tô sáng; ** không khớp cặp thì coi như chữ thường; plainModel bỏ **", () => {
    expect(highlightSegments("**I would take** my phone **because** it is useful.")).toEqual([
      { text: "I would take", hl: true },
      { text: " my phone ", hl: false },
      { text: "because", hl: true },
      { text: " it is useful.", hl: false },
    ]);
    expect(highlightSegments("No marks here.")).toEqual([{ text: "No marks here.", hl: false }]);
    expect(highlightSegments("Broken **mark")).toEqual([{ text: "Broken mark", hl: false }]);
    expect(plainModel("**I would take** my phone")).toBe("I would take my phone");
  });

  it("hasBlank", () => {
    expect(hasBlank("I would take ___ because it is useful")).toBe(true);
    expect(hasBlank("I would take my phone")).toBe(false);
    expect(FRAME_BLANK).toBe("___");
  });

  describe("insertIntoDraft", () => {
    it("ô trống: chèn nguyên, bôi đen chỗ trống ĐẦU TIÊN", () => {
      const r = insertIntoDraft("", 0, 0, "I would take ___ because ___.", 300);
      expect(r.text).toBe("I would take ___ because ___.");
      expect(r.text.slice(r.selStart, r.selEnd)).toBe("___");
      expect(r.selStart).toBe("I would take ".length);
    });
    it("thêm dấu cách khi chữ liền trước không phải khoảng trắng; không thêm ở đầu ô hoặc sau dấu cách", () => {
      expect(insertIntoDraft("Hello.", 6, 6, "What about you?", 300).text).toBe("Hello. What about you?");
      expect(insertIntoDraft("Hello. ", 7, 7, "What about you?", 300).text).toBe("Hello. What about you?");
    });
    it("chèn tại con trỏ giữa câu, giữ phần sau; mẫu không có chỗ trống thì con trỏ ở cuối đoạn chèn", () => {
      const r = insertIntoDraft("I like  tea", 7, 7, "green", 300);
      expect(r.text).toBe("I like green tea"); // trước con trỏ là dấu cách nên không thêm dấu cách; phần sau giữ nguyên
      expect(r.selStart).toBe(r.selEnd);
      expect(r.text.slice(0, r.selStart)).toBe("I like green");
    });
    it("thay vùng chọn; cắt ở giới hạn ký tự và kẹp vùng chọn trong chuỗi", () => {
      expect(insertIntoDraft("I take ___", 7, 10, "my phone", 300).text).toBe("I take my phone");
      const r = insertIntoDraft("x".repeat(295), 295, 295, "I mean ___", 300);
      expect(r.text).toHaveLength(300);
      expect(r.selEnd).toBeLessThanOrEqual(300);
    });
  });

  it("khay 'Khi bị bí': bốn nhóm, mọi câu là tiếng Anh, chỗ trống dùng ___", () => {
    expect(STUCK_GROUPS.map((g) => g.label)).toEqual(["Câu giờ", "Chưa biết nói", "Nhờ nhắc lại", "Hỏi lại"]);
    const all = STUCK_GROUPS.flatMap((g) => g.items);
    expect(all.length).toBeGreaterThanOrEqual(12);
    expect(all.every((t) => t.length > 0 && t.length <= 300 && !/[À-ỹ]/.test(t))).toBe(true);
    expect(all).toContain("How can I say ___ in English?");
  });

  it("mã lỗi blank_left có lời nhắn", () => {
    expect(freeChatErrorMessage("blank_left")).toContain("chỗ trống");
  });
});
