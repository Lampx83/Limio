import { describe, expect, it } from "vitest";
import { LECTURE_INTRO_ANCHOR, LECTURE_OUTRO_ANCHOR } from "../../../../../packages/core-lms/src/narration/script";
import {
  ANCHOR_INTRO,
  ANCHOR_OUTRO,
  clearResume,
  fractionWithin,
  listenedPercent,
  minutesLabel,
  nextStart,
  normalizeHeading,
  parseResume,
  previousStart,
  readResume,
  anchorLabel,
  resolveAnchors,
  segmentIndexAt,
  serializeResume,
  speedLabel,
  weightedIndexAt,
  writeResume,
  type KeyValueStore,
} from "./learner";

const segs = [
  { startSec: 0, endSec: 38.66 },
  { startSec: 39.16, endSec: 87.04 },
  { startSec: 87.54, endSec: 136.18 },
];

describe("hằng số neo", () => {
  it("khớp với core-lms", () => {
    expect(ANCHOR_INTRO).toBe(LECTURE_INTRO_ANCHOR);
    expect(ANCHOR_OUTRO).toBe(LECTURE_OUTRO_ANCHOR);
  });
});

describe("segmentIndexAt", () => {
  it("chọn đoạn đang phát", () => {
    expect(segmentIndexAt(segs, 0)).toBe(0);
    expect(segmentIndexAt(segs, 20)).toBe(0);
    expect(segmentIndexAt(segs, 60)).toBe(1);
    expect(segmentIndexAt(segs, 130)).toBe(2);
  });
  it("khoảng lặng giữa hai đoạn vẫn thuộc đoạn trước", () => {
    expect(segmentIndexAt(segs, 38.9)).toBe(0);
  });
  it("tua tới đúng đầu đoạn rồi đọc lại lệch vài mili giây vẫn ra đoạn đó", () => {
    expect(segmentIndexAt(segs, 39.16)).toBe(1);
    expect(segmentIndexAt(segs, 39.16 - 0.01)).toBe(1);
  });
  it("sau đoạn cuối vẫn là đoạn cuối; trước đoạn đầu là -1; rỗng là -1", () => {
    expect(segmentIndexAt(segs, 9999)).toBe(2);
    expect(segmentIndexAt([{ startSec: 5, endSec: 9 }], 1)).toBe(-1);
    expect(segmentIndexAt([], 3)).toBe(-1);
  });
});

describe("previousStart / nextStart", () => {
  it("nghe quá vài giây thì Mục trước quay về đầu mục đang nghe", () => {
    expect(previousStart(segs, 60)).toBe(39.16);
  });
  it("mới vào mục thì Mục trước nhảy sang mục trước đó", () => {
    expect(previousStart(segs, 40)).toBe(0);
    expect(previousStart(segs, 88)).toBe(39.16);
  });
  it("ở đầu bài thì Mục trước về 0", () => {
    expect(previousStart(segs, 1)).toBe(0);
    expect(previousStart(segs, 0)).toBe(0);
  });
  it("Mục sau nhảy tới đầu mục kế, và null ở mục cuối", () => {
    expect(nextStart(segs, 10)).toBe(39.16);
    expect(nextStart(segs, 60)).toBe(87.54);
    expect(nextStart(segs, 130)).toBeNull();
  });
});

describe("ánh xạ anchor với tiêu đề mục", () => {
  const headings = [
    ["1 AI tạo ra câu trả lời như thế nào", "AI tạo ra câu trả lời như thế nào"],
    ["Trôi chảy và chính xác là hai phẩm chất khác nhau (fluency và accuracy)"],
    ["Tài liệu tham khảo"],
  ];
  it("mo-dau và tong-ket là neo đặc biệt", () => {
    expect(resolveAnchors(["mo-dau", "tong-ket"], headings)).toEqual([{ type: "intro" }, { type: "outro" }]);
  });
  it("khớp tiêu đề dù có số thứ tự trong huy hiệu", () => {
    expect(resolveAnchors(["AI tạo ra câu trả lời như thế nào"], headings)).toEqual([{ type: "heading", index: 0 }]);
  });
  it("khớp bất kể hoa thường, dấu nháy, khoảng trắng", () => {
    expect(resolveAnchors(["  trôi chảy và chính xác là hai phẩm chất khác nhau (Fluency và accuracy)  "], headings)).toEqual([
      { type: "heading", index: 1 },
    ]);
    expect(normalizeHeading("“Hỏi  AI”: thế nào?")).toBe(normalizeHeading('"hỏi ai" thế nào'));
  });
  it("anchor có hậu tố #n trỏ tới bước n của mục", () => {
    expect(resolveAnchors(["AI tạo ra câu trả lời như thế nào #2", "AI tạo ra câu trả lời như thế nào#10"], headings)).toEqual([
      { type: "heading", index: 0, step: 2 },
      { type: "heading", index: 0, step: 10 },
    ]);
    // #0 không phải bước nào: coi như cả mục.
    expect(resolveAnchors(["AI tạo ra câu trả lời như thế nào #0"], headings)).toEqual([{ type: "heading", index: 0 }]);
    expect(resolveAnchors(["Mục đã bị xoá #2"], headings)).toEqual([{ type: "none" }]);
    expect(anchorLabel("Giải phương trình #3")).toBe("Giải phương trình · bước 3");
  });
  it("anchor không có mục tương ứng thì none, không đoán", () => {
    expect(resolveAnchors(["Mục đã bị xoá", ""], headings)).toEqual([{ type: "none" }, { type: "none" }]);
  });
  it("không nhầm chữ có dấu khác nhau", () => {
    expect(normalizeHeading("câu hỏi")).not.toBe(normalizeHeading("cầu hỏi"));
  });
});

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

describe("nhớ vị trí nghe dở", () => {
  it("lưu rồi đọc lại đúng phiên bản giọng", () => {
    const s = memoryStore();
    writeResume(s, "L1", "lecture", 7, 372.9);
    expect(readResume(s, "L1", "lecture", 7, 500)).toBe(372);
    expect(readResume(s, "L1", "podcast", 7, 500)).toBeNull();
  });
  it("giọng được tạo lại (phiên bản đổi) thì bỏ vị trí cũ", () => {
    const s = memoryStore();
    writeResume(s, "L1", "lecture", 7, 100);
    expect(readResume(s, "L1", "lecture", 8, 500)).toBeNull();
  });
  it("gần đầu hoặc gần cuối thì không đề nghị nghe tiếp", () => {
    expect(parseResume(serializeResume(1, 4), 1, 300)).toBeNull();
    expect(parseResume(serializeResume(1, 295), 1, 300)).toBeNull();
    expect(parseResume(serializeResume(1, 150), 1, 300)).toBe(150);
  });
  it("dữ liệu hỏng thì null chứ không ném lỗi", () => {
    expect(parseResume("{không phải json", 1, 300)).toBeNull();
    expect(parseResume(JSON.stringify({ v: 1, t: "abc" }), 1, 300)).toBeNull();
    expect(parseResume(null, 1, 300)).toBeNull();
  });
  it("xoá được; kho ném lỗi vẫn không làm hỏng giao diện", () => {
    const s = memoryStore();
    writeResume(s, "L1", "lecture", 1, 100);
    clearResume(s, "L1", "lecture");
    expect(readResume(s, "L1", "lecture", 1, 500)).toBeNull();
    const boom: KeyValueStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(() => writeResume(boom, "L1", "lecture", 1, 100)).not.toThrow();
    expect(readResume(boom, "L1", "lecture", 1, 500)).toBeNull();
    expect(() => clearResume(boom, "L1", "lecture")).not.toThrow();
    expect(readResume(null, "L1", "lecture", 1, 500)).toBeNull();
  });
});

describe("nhãn và số liệu", () => {
  it("thời lượng làm tròn theo phút, tối thiểu 1", () => {
    expect(minutesLabel(415.48)).toBe("7 phút");
    expect(minutesLabel(20)).toBe("1 phút");
    expect(minutesLabel(Number.NaN)).toBe("1 phút");
  });
  it("tốc độ dùng dấu phẩy", () => {
    expect(speedLabel(0.75)).toBe("0,75×");
    expect(speedLabel(1)).toBe("1×");
    expect(speedLabel(1.5)).toBe("1,5×");
  });
  it("phần trăm đã nghe kẹp 0–100", () => {
    expect(listenedPercent(50, 200)).toBe(25);
    expect(listenedPercent(500, 200)).toBe(100);
    expect(listenedPercent(5, 0)).toBe(0);
  });
});

describe("theo dõi trong một mục", () => {
  it("weightedIndexAt chia theo độ dài chữ của từng khối", () => {
    const w = [100, 300, 100]; // 20% / 60% / 20%
    expect(weightedIndexAt(w, 0)).toBe(0);
    expect(weightedIndexAt(w, 0.19)).toBe(0);
    expect(weightedIndexAt(w, 0.21)).toBe(1);
    expect(weightedIndexAt(w, 0.79)).toBe(1);
    expect(weightedIndexAt(w, 0.81)).toBe(2);
    expect(weightedIndexAt(w, 1)).toBe(2);
  });

  it("weightedIndexAt chịu được đầu vào lạ", () => {
    expect(weightedIndexAt([], 0.5)).toBe(-1);
    expect(weightedIndexAt([0, 0], 0.9)).toBe(1); // khối rỗng vẫn tính trọng số tối thiểu
    expect(weightedIndexAt([5, 5], Number.NaN)).toBe(0);
    expect(weightedIndexAt([5, 5], 7)).toBe(1);
    expect(weightedIndexAt([5, 5], -3)).toBe(0);
  });

  it("fractionWithin kẹp trong 0–1 và đoạn rỗng cho 0", () => {
    const seg = { startSec: 10, endSec: 20 };
    expect(fractionWithin(seg, 5)).toBe(0);
    expect(fractionWithin(seg, 15)).toBe(0.5);
    expect(fractionWithin(seg, 25)).toBe(1);
    expect(fractionWithin({ startSec: 3, endSec: 3 }, 3)).toBe(0);
  });
});
