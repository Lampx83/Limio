import { describe, expect, it } from "vitest";
import { EN, VI } from "./index";
import { submitWarning, leaveWarning, saveStatusText, joinNumbers } from "@/lib/quizPlayerState";
import { formatInterval } from "@/lib/flashcardSession";
import { describeWritingError, categoryLabel, levelLabel } from "@/lib/writingFeedbackText";
import { describeSpeakingError } from "@/lib/speakingFeedbackText";
import { formatPoints, xpMultiplierNote } from "@/lib/quizResultView";
import { recorderErrorText } from "@/lib/audioRecorder";

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]!).sort();

describe("từ điển vùng practice", () => {
  const keys = Object.keys(VI).filter((k) => k.startsWith("practice."));
  it("có khoá và mọi bản en giữ nguyên tham số {x} của bản vi", () => {
    expect(keys.length).toBeGreaterThan(200);
    for (const k of keys) {
      const en = (EN as Record<string, string | undefined>)[k];
      if (en === undefined) continue;
      expect(placeholders(en), k).toEqual(placeholders((VI as Record<string, string>)[k]!));
    }
  });
  it("mọi khoá practice đều đã có bản en (không để rơi về tiếng Việt trong vùng này)", () => {
    const missing = keys.filter((k) => !(EN as Record<string, string | undefined>)[k]);
    expect(missing).toEqual([]);
  });
});

describe("hàm trợ giúp nhận ngôn ngữ", () => {
  it("mặc định vẫn là tiếng Việt, en cho bản dịch", () => {
    expect(joinNumbers([3, 5, 7])).toBe("3, 5 và 7");
    expect(joinNumbers([3, 5, 7], "en")).toBe("3, 5 and 7");
    expect(submitWarning({ empty: [2], needsConfidence: [], flagged: [] })).toContain("Trước khi nộp");
    expect(submitWarning({ empty: [2, 4], needsConfidence: [], flagged: [] }, "en")).toContain("Before you submit");
    expect(leaveWarning([1], "en")).toMatch(/Question 1 hasn't been saved/);
    expect(saveStatusText({ kind: "saved", at: 0 }, 0, () => "10:00", "en")).toBe("Saved at 10:00.");
  });
  it("khoảng ôn, lỗi AI, điểm, XP, micro", () => {
    expect(formatInterval(3)).toBe("3 ngày");
    expect(formatInterval(3, "en")).toBe("3 d");
    expect(describeWritingError("no_token_budget", "en")).toMatch(/AI credits/);
    expect(describeWritingError("???")).toMatch(/Chưa nhận được góp ý/);
    expect(describeSpeakingError("no_speech", "en")).toMatch(/No speech/);
    expect(describeSpeakingError("forbidden", "en")).toBe(describeWritingError("forbidden", "en"));
    expect(categoryLabel("grammar", "en")).toBe("Grammar");
    expect(categoryLabel("lạ", "en")).toBe("lạ");
    expect(levelLabel("good", "en")?.text).toBe("Good");
    expect(formatPoints(12.5)).toBe("12,5");
    expect(formatPoints(12.5, "en")).toBe("12.5");
    expect(xpMultiplierNote(0.5, "en")).toContain("×0.5");
    expect(recorderErrorText("NotFoundError", "en")).toMatch(/No microphone/);
  });
});
