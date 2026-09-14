import { describe, expect, it } from "vitest";
import {
  canRevealAnswers,
  canRevealNow,
  canRevealScore,
  canRevealScoreNow,
  resolveRevealPolicy,
  type RevealSessionInput,
} from "../reveal-policy";

const NOW = new Date("2026-08-26T10:00:00Z");

/** Ca hẹn giờ, mặc định đang mở tại NOW. */
function scheduled(o: Partial<RevealSessionInput> = {}): RevealSessionInput {
  return {
    revealAnswers: null,
    opensAt: new Date("2026-08-26T09:00:00Z"),
    closesAt: new Date("2026-08-26T11:00:00Z"),
    timingMode: "scheduled",
    status: "open",
    ...o,
  };
}

/** Ca thủ công — status là nguồn sự thật, mốc giờ không tính. */
function manual(o: Partial<RevealSessionInput> = {}): RevealSessionInput {
  return {
    revealAnswers: null,
    opensAt: new Date("2026-08-26T09:00:00Z"),
    closesAt: null,
    timingMode: "manual",
    status: "open",
    ...o,
  };
}

describe("resolveRevealPolicy — ca thắng gói đề", () => {
  it("ca có chính sách riêng thì dùng của ca", () => {
    const p = resolveRevealPolicy(
      { revealAnswers: "never" },
      { showResultsAfterSubmit: true },
    );
    expect(p).toBe("never");
  });

  it("ca để trống thì kế thừa gói đề", () => {
    expect(
      resolveRevealPolicy({ revealAnswers: null }, { showResultsAfterSubmit: true }),
    ).toBe("immediately");
    expect(
      resolveRevealPolicy({ revealAnswers: null }, { showResultsAfterSubmit: false }),
    ).toBe("never");
  });

  it("bài làm cũ không có ca thì rơi về gói đề, không nổ", () => {
    expect(resolveRevealPolicy(null, { showResultsAfterSubmit: true })).toBe(
      "immediately",
    );
    expect(resolveRevealPolicy(null, { showResultsAfterSubmit: false })).toBe(
      "never",
    );
  });
});

describe("canRevealNow", () => {
  it("immediately: lộ ngay, kể cả ca đang mở", () => {
    expect(canRevealNow("immediately", scheduled(), NOW)).toBe(true);
  });

  it("never: không lộ, kể cả ca đã đóng", () => {
    expect(canRevealNow("never", scheduled({ status: "closed" }), NOW)).toBe(
      false,
    );
  });

  it("after_close: ca còn mở thì CHƯA lộ", () => {
    expect(canRevealNow("after_close", scheduled(), NOW)).toBe(false);
  });

  it("after_close: quá closesAt thì lộ", () => {
    const past = scheduled({ closesAt: new Date("2026-08-26T09:30:00Z") });
    expect(canRevealNow("after_close", past, NOW)).toBe(true);
  });

  it("after_close: ca thủ công lộ khi GV bấm đóng, không theo giờ", () => {
    expect(canRevealNow("after_close", manual(), NOW)).toBe(false);
    expect(
      canRevealNow("after_close", manual({ status: "closed" }), NOW),
    ).toBe(true);
  });

  it("after_close: ca chưa tới giờ mở KHÔNG tính là đã đóng", () => {
    const future = scheduled({
      opensAt: new Date("2026-08-26T11:00:00Z"),
      closesAt: new Date("2026-08-26T12:00:00Z"),
    });
    expect(canRevealNow("after_close", future, NOW)).toBe(false);
  });

  it("after_close mà không biết ca nào thì KHÔNG lộ", () => {
    // Bài làm cũ có trước cột sessionId. Không biết lúc nào đóng thì chọn
    // hướng an toàn, thà giấu nhầm còn hơn lộ nhầm.
    expect(canRevealNow("after_close", null, NOW)).toBe(false);
  });
});

describe("canRevealNow — score_only không lộ đáp án", () => {
  it("score_only: không lộ chi tiết từng câu, kể cả ca đã đóng", () => {
    expect(canRevealNow("score_only", scheduled({ status: "closed" }), NOW)).toBe(
      false,
    );
  });
});

describe("canRevealScoreNow", () => {
  it("immediately: lộ điểm ngay", () => {
    expect(canRevealScoreNow("immediately", scheduled(), NOW)).toBe(true);
  });

  it("score_only: lộ điểm ngay, giống immediately", () => {
    expect(canRevealScoreNow("score_only", scheduled(), NOW)).toBe(true);
  });

  it("never: không lộ điểm", () => {
    expect(
      canRevealScoreNow("never", scheduled({ status: "closed" }), NOW),
    ).toBe(false);
  });

  it("after_close: theo đúng cổng sessionOpenState như canRevealNow", () => {
    expect(canRevealScoreNow("after_close", scheduled(), NOW)).toBe(false);
    expect(
      canRevealScoreNow("after_close", manual({ status: "closed" }), NOW),
    ).toBe(true);
  });
});

describe("canRevealScore vs canRevealAnswers — hai cờ độc lập", () => {
  it("score_only: điểm lộ, đáp án không — cùng một ca", () => {
    const exam = { showResultsAfterSubmit: true };
    const ca = scheduled({ revealAnswers: "score_only" });

    expect(canRevealScore(ca, exam, NOW)).toBe(true);
    expect(canRevealAnswers(ca, exam, NOW)).toBe(false);
  });

  it("immediately: cả điểm lẫn đáp án đều lộ", () => {
    const exam = { showResultsAfterSubmit: true };
    const ca = scheduled({ revealAnswers: "immediately" });

    expect(canRevealScore(ca, exam, NOW)).toBe(true);
    expect(canRevealAnswers(ca, exam, NOW)).toBe(true);
  });

  it("never: cả điểm lẫn đáp án đều không lộ", () => {
    const exam = { showResultsAfterSubmit: true };
    const ca = scheduled({ revealAnswers: "never" });

    expect(canRevealScore(ca, exam, NOW)).toBe(false);
    expect(canRevealAnswers(ca, exam, NOW)).toBe(false);
  });
});

describe("canRevealAnswers — chính cái lỗi thiết kế này sinh ra để chặn", () => {
  it("hai ca cùng một gói đề, chính sách khác nhau, không giẫm lên nhau", () => {
    const exam = { showResultsAfterSubmit: true };
    const caOnTap = scheduled({ revealAnswers: "immediately" });
    const caThiThat = scheduled({ revealAnswers: "never" });

    expect(canRevealAnswers(caOnTap, exam, NOW)).toBe(true);
    expect(canRevealAnswers(caThiThat, exam, NOW)).toBe(false);
  });

  it("ca ghi đè NGƯỢC với gói đề vẫn thắng", () => {
    // Gói đề tắt, nhưng riêng ca ôn tập cho xem.
    expect(
      canRevealAnswers(
        scheduled({ revealAnswers: "immediately" }),
        { showResultsAfterSubmit: false },
        NOW,
      ),
    ).toBe(true);
    // Gói đề bật, nhưng riêng ca thi thật thì giấu.
    expect(
      canRevealAnswers(
        scheduled({ revealAnswers: "never" }),
        { showResultsAfterSubmit: true },
        NOW,
      ),
    ).toBe(false);
  });
});
