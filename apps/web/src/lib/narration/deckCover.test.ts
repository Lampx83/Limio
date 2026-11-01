import { describe, expect, it } from "vitest";
import {
  addHeard,
  deckCoverId,
  deckCoverLabel,
  deckIdOfUrl,
  heardEnough,
  heardFraction,
  heardKey,
  readHeard,
  resumeSlideNumber,
  stepHeard,
  withoutDeckIntro,
  writeHeard,
  type HeardRanges,
} from "./deckCover";

const memoryStore = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
  };
};

const text = { type: "rich_text", payload: { html: "Giới thiệu" } };
const deck = { type: "embed", payload: { url: "/decks/ham-bac-hai", height: 720 } };
const widget = { type: "embed", payload: { url: "/widgets/parabola.html" } };
const after = { type: "rich_text", payload: { html: "Sau khung" } };
const ANCHORS = ["s0b0", "s1b0", "s2b0", "s2b1"];

describe("điều kiện hiện bìa", () => {
  it("đủ khung slide, lời giảng theo slide và giảng viên ảo thì hiện", () => {
    expect(deckCoverId([text, deck], ANCHORS, true)).toBe("ham-bac-hai");
  });
  it("chưa có giọng thì giữ khung trong trang", () => {
    expect(deckCoverId([deck], null, true)).toBeNull();
  });
  it("khoá đặt Không hiện thì giữ khung trong trang", () => {
    expect(deckCoverId([deck], ANCHORS, false)).toBeNull();
  });
  it("bài thường và lời giảng theo mục thì không hiện", () => {
    expect(deckCoverId([text, widget], ANCHORS, true)).toBeNull();
    expect(deckCoverId([deck], ["Đỉnh và trục"], true)).toBeNull();
  });
  it("chỉ nhận đúng địa chỉ khung slide", () => {
    expect(deckIdOfUrl("/decks/conic")).toBe("conic");
    expect(deckIdOfUrl("/decks/../x")).toBeNull();
    expect(deckIdOfUrl("https://evil.example/decks/conic")).toBeNull();
    expect(deckIdOfUrl(undefined)).toBeNull();
  });
});

describe("lời giới thiệu trước khung", () => {
  it("bỏ phần trước khung, giữ khung và phần sau", () => {
    expect(withoutDeckIntro([text, deck, after])).toEqual([deck, after]);
  });
  it("giữ ghi chú giảng viên đứng trước khung", () => {
    const note = { type: "teacher_note", payload: {} };
    expect(withoutDeckIntro([note, text, deck])).toEqual([note, deck]);
  });
  it("không có khung thì giữ nguyên", () => {
    expect(withoutDeckIntro([text, after])).toEqual([text, after]);
  });
});

describe("chữ trên nút", () => {
  const base = { resumeSlide: null, completed: false, heard: 0, thresholdPct: 80 };
  it("chưa nghe", () => expect(deckCoverLabel(base)).toBe("Bắt đầu học"));
  it("nghe dở", () => expect(deckCoverLabel({ ...base, resumeSlide: 3 })).toBe("Học tiếp từ slide 3"));
  it("nghe dở thì ưu tiên học tiếp dù đã hoàn thành", () => expect(deckCoverLabel({ ...base, resumeSlide: 3, completed: true })).toBe("Học tiếp từ slide 3"));
  it("đã hoàn thành", () => expect(deckCoverLabel({ ...base, completed: true })).toBe("Học lại"));
  it("đã nghe đủ", () => expect(deckCoverLabel({ ...base, heard: 0.9 })).toBe("Học lại"));
  it("mới nghe chút ít mà không có vị trí nhớ", () => expect(deckCoverLabel({ ...base, heard: 0.01 })).toBe("Bắt đầu học"));
});

describe("slide đang nghe dở", () => {
  const segments = [
    { anchor: "s0b0", startSec: 0, endSec: 10 },
    { anchor: "s2b1", startSec: 10, endSec: 20 },
  ];
  it("đếm từ 1", () => {
    expect(resumeSlideNumber(segments, 15)).toBe(3);
    expect(resumeSlideNumber(segments, 5)).toBe(1);
  });
  it("không có vị trí thì null", () => expect(resumeSlideNumber(segments, null)).toBeNull());
});

describe("phần đã nghe", () => {
  const listen = (ranges: HeardRanges, from: number, to: number, tick = 0.25) => {
    let r = ranges;
    let t = from;
    while (t < to) {
      const next = Math.min(to, t + tick);
      r = stepHeard(r, t, next);
      t = next;
    }
    return r;
  };

  it("nghe liền một mạch thì gộp thành một khoảng", () => {
    expect(listen([], 0, 10)).toEqual([[0, 10]]);
  });
  it("nghe lại một đoạn không cộng hai lần", () => {
    const r = listen(listen([], 0, 10), 5, 10);
    expect(heardFraction(r, 100)).toBeCloseTo(0.1);
  });
  it("tua qua không tính", () => {
    let r = listen([], 0, 10);
    r = stepHeard(r, 10, 90); // tua
    r = listen(r, 90, 95);
    expect(heardFraction(r, 100)).toBeCloseTo(0.15);
  });
  it("tua ngược không tính", () => {
    expect(stepHeard([[0, 50]], 50, 10)).toEqual([[0, 50]]);
  });
  it("nhịp đầu sau khi nhảy chỗ không tính", () => {
    expect(stepHeard([], null, 10)).toEqual([]);
  });
  it("nghe 1,5× trong tab nền vẫn được tính", () => {
    expect(stepHeard([], 10, 11.5)).toEqual([[10, 11.5]]);
  });
  it("tốc độ nghe không đổi tổng thời lượng đã nghe", () => {
    expect(heardFraction(listen([], 0, 50, 0.375), 100)).toBeCloseTo(heardFraction(listen([], 0, 50, 0.1875), 100));
  });
  it("gộp nhiều khoảng rời khi nghe nối lại", () => {
    const r = addHeard(addHeard(addHeard([], 0, 10), 20, 30), 8, 22);
    expect(r).toEqual([[0, 30]]);
  });
  it("giữ đúng thứ tự khi thêm khoảng ở giữa", () => {
    const r = addHeard(addHeard(addHeard([], 0, 10), 40, 50), 20, 30);
    expect(r).toEqual([
      [0, 10],
      [20, 30],
      [40, 50],
    ]);
  });
  it("không vượt quá 100%", () => {
    expect(heardFraction([[0, 200]], 100)).toBe(1);
    expect(heardFraction([[0, 10]], 0)).toBe(0);
  });
  it("đủ ngưỡng đúng theo số hiển thị", () => {
    expect(heardEnough(0.8, 80)).toBe(true);
    expect(heardEnough(0.799, 80)).toBe(false);
  });
});

describe("lưu phần đã nghe", () => {
  it("đọc lại được qua nhiều lần mở bài", () => {
    const store = memoryStore();
    writeHeard(store, "b1", 2, [[0, 10.04]]);
    const r = addHeard(readHeard(store, "b1", 2), 10, 20);
    expect(heardFraction(r, 100)).toBeCloseTo(0.2);
  });
  it("giọng tạo lại thì tính lại từ đầu", () => {
    const store = memoryStore();
    writeHeard(store, "b1", 2, [[0, 10]]);
    expect(readHeard(store, "b1", 3)).toEqual([]);
  });
  it("dữ liệu hỏng thì coi như chưa nghe", () => {
    const store = memoryStore();
    store.setItem(heardKey("b1"), "{hỏng");
    expect(readHeard(store, "b1", 1)).toEqual([]);
    store.setItem(heardKey("b1"), JSON.stringify({ v: 1, r: [["x", 2], [1]] }));
    expect(readHeard(store, "b1", 1)).toEqual([]);
  });
  it("không có kho lưu thì không lỗi", () => {
    expect(readHeard(null, "b1", 1)).toEqual([]);
    expect(() => writeHeard(null, "b1", 1, [])).not.toThrow();
  });
});
