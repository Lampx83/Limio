import { describe, expect, it } from "vitest";
import { freeChatErrorMessage, learnerTurnCount, parseFreeChatView, phraseUsed, restoreChat, transcriptOf, usedTargets } from "./freeChatView";

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
