import { describe, expect, it } from "vitest";
import {
  FLASHCARD_EASE_MAX,
  FLASHCARD_EASE_MIN,
  FLASHCARD_MATURE_AT_DAYS,
  FLASHCARD_MAX_INTERVAL_DAYS,
  cardStage,
  normalizeTerm,
  previewIntervals,
  scheduleReview,
  vnDayStart,
  type SrsState,
} from "../flashcardSrs";

/**
 * LANG G4 / G4.1 — bộ lập lịch ôn cách quãng. Hàm thuần: cùng đầu vào, cùng kết
 * quả; không đọc đồng hồ ngoài `now` truyền vào.
 */

const DAY = 24 * 60 * 60 * 1000;
// 15:00 giờ VN ngày 03/10/2026.
const NOW = new Date("2026-10-03T08:00:00Z");
const RATINGS = ["again", "hard", "good", "easy"] as const;

const seen = (over: Partial<SrsState> = {}): SrsState => ({
  easeFactor: 2.5,
  intervalDays: 6,
  repetitions: 2,
  lapses: 0,
  ...over,
});

describe("vnDayStart — ngày theo giờ Việt Nam (UTC+7)", () => {
  it("đầu ngày VN: 00:00 VN = 17:00 UTC hôm trước", () => {
    expect(vnDayStart(new Date("2026-10-03T08:00:00Z")).toISOString()).toBe("2026-10-02T17:00:00.000Z");
  });
  it("23:59:59 VN vẫn cùng ngày; 00:00:00 VN là ngày kế", () => {
    expect(vnDayStart(new Date("2026-10-03T16:59:59Z")).toISOString()).toBe("2026-10-02T17:00:00.000Z");
    expect(vnDayStart(new Date("2026-10-03T17:00:00Z")).toISOString()).toBe("2026-10-03T17:00:00.000Z");
  });
});

describe("scheduleReview — thẻ mới (G4.1.1)", () => {
  it("lần ôn đầu: Quên 1 · Khó 1 · Được 2 · Dễ 4 ngày", () => {
    const days = RATINGS.map((r) => scheduleReview(null, r, NOW).intervalDays);
    expect(days).toEqual([1, 1, 2, 4]);
  });

  it("đến hạn vào ĐẦU ngày VN của ngày thứ N (không phải đúng giờ đã ôn)", () => {
    // Ôn 15:00 VN ngày 3/10, hẹn sau 2 ngày → hạn 00:00 VN ngày 5/10 = 17:00Z ngày 4/10.
    expect(scheduleReview(null, "good", NOW).dueAt.toISOString()).toBe("2026-10-04T17:00:00.000Z");
  });

  it("Quên ở thẻ mới không tính là 'lapse' (chưa từng thuộc)", () => {
    expect(scheduleReview(null, "again", NOW).lapses).toBe(0);
  });

  it("thẻ mới: easeFactor khởi đầu 2.5, lần Được/Dễ/Khó tăng số lần thuộc, Quên về 0", () => {
    expect(scheduleReview(null, "good", NOW)).toMatchObject({ repetitions: 1 });
    expect(scheduleReview(null, "hard", NOW)).toMatchObject({ repetitions: 1 });
    expect(scheduleReview(null, "easy", NOW)).toMatchObject({ repetitions: 1 });
    expect(scheduleReview(null, "again", NOW)).toMatchObject({ repetitions: 0 });
  });
});

describe("scheduleReview — thẻ đã ôn (G4.1.2)", () => {
  it("Được: khoảng mới = khoảng cũ × easeFactor, làm tròn", () => {
    expect(scheduleReview(seen({ intervalDays: 6, easeFactor: 2.5 }), "good", NOW).intervalDays).toBe(15);
    expect(scheduleReview(seen({ intervalDays: 10, easeFactor: 1.3 }), "good", NOW).intervalDays).toBe(13);
  });

  it("Được luôn tăng ít nhất 1 ngày so với khoảng cũ (kể cả khi nhân ra không đổi)", () => {
    expect(scheduleReview(seen({ intervalDays: 1, easeFactor: 1.3, repetitions: 1 }), "good", NOW).intervalDays).toBe(2);
  });

  it("Khó: × 1.2 làm tròn, tối thiểu 1, và giảm easeFactor 0.15", () => {
    const r = scheduleReview(seen({ intervalDays: 10 }), "hard", NOW);
    expect(r.intervalDays).toBe(12);
    expect(r.easeFactor).toBeCloseTo(2.35, 5);
  });

  it("Dễ: × easeFactor × 1.3, hơn Được ít nhất 1 ngày, và tăng easeFactor 0.15", () => {
    const r = scheduleReview(seen({ intervalDays: 10, easeFactor: 2.5 }), "easy", NOW);
    expect(r.intervalDays).toBe(33); // round(10 × 2.5 × 1.3)
    expect(r.easeFactor).toBeCloseTo(2.65, 5);
  });

  it("Quên: về 1 ngày, về 0 lần thuộc, +1 lapse, giảm easeFactor 0.2", () => {
    const r = scheduleReview(seen({ intervalDays: 40, repetitions: 5, lapses: 1 }), "again", NOW);
    expect(r).toMatchObject({ intervalDays: 1, repetitions: 0, lapses: 2 });
    expect(r.easeFactor).toBeCloseTo(2.3, 5);
  });

  it("thẻ vừa bị Quên (repetitions=0) ôn lại thì dùng bảng thẻ mới: Được = 2 ngày", () => {
    const lapsed = scheduleReview(seen({ intervalDays: 40, repetitions: 5 }), "again", NOW);
    expect(scheduleReview(lapsed, "good", NOW).intervalDays).toBe(2);
  });
});

describe("scheduleReview — bất biến (G4.1.3)", () => {
  // Lưới trạng thái đủ rộng để bắt lỗi biên: khoảng, độ dễ, số lần thuộc, lapse.
  const grid: SrsState[] = [];
  for (const intervalDays of [1, 2, 3, 6, 15, 21, 40, 120, 300, 365])
    for (const easeFactor of [1.3, 1.5, 2.5, 3.0])
      for (const repetitions of [0, 1, 2, 7])
        for (const lapses of [0, 3]) grid.push({ easeFactor, intervalDays, repetitions, lapses });

  it("Quên ≤ Khó ≤ Được ≤ Dễ trên mọi trạng thái (và trên thẻ mới)", () => {
    for (const s of [null, ...grid]) {
      const p = previewIntervals(s, NOW);
      expect(p.again, JSON.stringify(s)).toBeLessThanOrEqual(p.hard);
      expect(p.hard, JSON.stringify(s)).toBeLessThanOrEqual(p.good);
      expect(p.good, JSON.stringify(s)).toBeLessThanOrEqual(p.easy);
    }
  });

  it("Quên luôn đặt về đúng 1 ngày", () => {
    for (const s of grid) expect(scheduleReview(s, "again", NOW).intervalDays).toBe(1);
  });

  it("easeFactor luôn trong [1.3, 3.0]; khoảng cách luôn trong [1, 365]; lapses không bao giờ giảm", () => {
    for (const s of grid)
      for (const r of RATINGS) {
        const n = scheduleReview(s, r, NOW);
        expect(n.easeFactor).toBeGreaterThanOrEqual(FLASHCARD_EASE_MIN);
        expect(n.easeFactor).toBeLessThanOrEqual(FLASHCARD_EASE_MAX);
        expect(n.intervalDays).toBeGreaterThanOrEqual(1);
        expect(n.intervalDays).toBeLessThanOrEqual(FLASHCARD_MAX_INTERVAL_DAYS);
        expect(n.lapses).toBeGreaterThanOrEqual(s.lapses);
      }
  });

  it("Quên liên tục kéo easeFactor xuống sàn 1.3 chứ không xuống thấp hơn", () => {
    let s: SrsState | null = seen({ easeFactor: 2.5 });
    for (let i = 0; i < 20; i++) s = scheduleReview(s, "again", NOW);
    expect(s!.easeFactor).toBeCloseTo(FLASHCARD_EASE_MIN, 5);
  });

  it("Dễ liên tục không vượt trần 365 ngày và easeFactor không vượt 3.0", () => {
    let s: SrsState | null = null;
    for (let i = 0; i < 40; i++) s = scheduleReview(s, "easy", NOW);
    expect(s!.intervalDays).toBe(FLASHCARD_MAX_INTERVAL_DAYS);
    expect(s!.easeFactor).toBeLessThanOrEqual(FLASHCARD_EASE_MAX);
  });
});

describe("previewIntervals — G4.1.4", () => {
  it("bốn khoảng đúng bằng kết quả scheduleReview sẽ áp (nút không bao giờ nói dối)", () => {
    for (const s of [null, seen(), seen({ intervalDays: 40, easeFactor: 1.8, repetitions: 4, lapses: 2 })]) {
      const p = previewIntervals(s, NOW);
      for (const r of RATINGS) expect(p[r]).toBe(scheduleReview(s, r, NOW).intervalDays);
    }
  });
});

describe("hàm thuần — G4.1.5", () => {
  it("cùng đầu vào cho cùng kết quả; không sửa trạng thái truyền vào", () => {
    const s = seen();
    const frozen = JSON.stringify(s);
    const a = scheduleReview(s, "good", NOW);
    const b = scheduleReview(s, "good", NOW);
    expect(a).toEqual(b);
    expect(JSON.stringify(s)).toBe(frozen);
  });
});

describe("cardStage / normalizeTerm", () => {
  it("Mới (không trạng thái) · Đang học (< 21 ngày) · Nhớ lâu (≥ 21 ngày)", () => {
    expect(FLASHCARD_MATURE_AT_DAYS).toBe(21);
    expect(cardStage(null)).toBe("new");
    expect(cardStage(seen({ intervalDays: 20 }))).toBe("learning");
    expect(cardStage(seen({ intervalDays: 21 }))).toBe("mature");
  });

  it("normalizeTerm bỏ khác biệt hoa-thường, khoảng trắng và dạng Unicode", () => {
    expect(normalizeTerm("  Hello ")).toBe(normalizeTerm("hello"));
    expect(normalizeTerm("café")).toBe(normalizeTerm("café"));
    expect(normalizeTerm("你好")).not.toBe(normalizeTerm("你们"));
  });
});
