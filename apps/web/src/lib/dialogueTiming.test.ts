import { describe, expect, it } from "vitest";
import {
  activeTurnIndex,
  formatMark,
  hasMarks,
  markNext,
  nextUnmarkedIndex,
  parseMark,
  setMark,
  undoLastMark,
  validateMarks,
} from "@/lib/dialogueTiming";

/** LANG K2 — mốc thời gian lượt trong audio cả đoạn (hàm thuần). */

const t = (startSec?: number) => ({ startSec });

describe("activeTurnIndex (K2b.1)", () => {
  const turns = [t(2), t(6.5), t(12)];
  it("trước mốc đầu tiên → không lượt nào", () => {
    expect(activeTurnIndex(turns, 0)).toBeNull();
    expect(activeTurnIndex(turns, 1.99)).toBeNull();
  });
  it("đúng lượt có mốc lớn nhất ≤ thời điểm hiện tại (mốc bằng thời điểm thì tính lượt đó)", () => {
    expect(activeTurnIndex(turns, 2)).toBe(0);
    expect(activeTurnIndex(turns, 6.4)).toBe(0);
    expect(activeTurnIndex(turns, 6.5)).toBe(1);
    expect(activeTurnIndex(turns, 11.9)).toBe(1);
  });
  it("sau lượt cuối giữ lượt cuối tới hết audio", () => {
    expect(activeTurnIndex(turns, 12)).toBe(2);
    expect(activeTurnIndex(turns, 9999)).toBe(2);
  });
  it("lượt không mốc không bao giờ sáng; lượt trước đó giữ sáng cho tới mốc kế tiếp có mặt (K2c.4)", () => {
    const t2 = [t(1), t(), t(9)];
    expect(activeTurnIndex(t2, 5)).toBe(0);
    expect(activeTurnIndex(t2, 9)).toBe(2);
    expect([0, 3, 8, 9, 20].map((x) => activeTurnIndex(t2, x))).not.toContain(1);
  });
  it("không mốc nào, hoặc thời điểm lạ (NaN, âm) → null", () => {
    expect(activeTurnIndex([t(), t()], 5)).toBeNull();
    expect(activeTurnIndex(turns, Number.NaN)).toBeNull();
    expect(activeTurnIndex(turns, -3)).toBeNull();
  });
  it("hasMarks", () => {
    expect(hasMarks([t(), t()])).toBe(false);
    expect(hasMarks([t(), t(0)])).toBe(true);
  });
});

describe("markNext — nút 'Đánh dấu lượt kế' (K2c.1)", () => {
  it("ghi mốc cho lượt chưa có mốc đầu tiên, làm tròn 0,1 giây, báo lượt đã đánh dấu", () => {
    const r = markNext([t(), t(), t()], 2.46);
    expect(r).toMatchObject({ ok: true, index: 0 });
    if (r.ok) expect(r.turns.map((x) => x.startSec)).toEqual([2.5, undefined, undefined]);
  });
  it("tiếp tục tới lượt kế; luôn là lượt chưa mốc đầu tiên, kể cả khi có lượt đã mốc ở sau", () => {
    const r = markNext([t(1), t(), t(9)], 4);
    expect(r).toMatchObject({ ok: true, index: 1 });
  });
  it("mốc không lớn hơn mốc lượt trước → từ chối kèm lý do nêu số lượt (K2c.3)", () => {
    const r = markNext([t(5), t()], 4.9);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/lượt 1/);
  });
  it("mốc không nhỏ hơn mốc lượt đã có phía sau → từ chối", () => {
    const r = markNext([t(1), t(), t(9)], 9);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/lượt 3/);
  });
  it("đã đủ mốc → không còn lượt để đánh dấu", () => {
    const r = markNext([t(1), t(2)], 5);
    expect(r.ok).toBe(false);
  });
  it("không sửa mảng đầu vào", () => {
    const input = [t(), t()];
    markNext(input, 3);
    expect(input[0]!.startSec).toBeUndefined();
  });
});

describe("nextUnmarkedIndex", () => {
  it("lượt chưa mốc đầu tiên, hoặc null khi đủ", () => {
    expect(nextUnmarkedIndex([t(1), t(), t()])).toBe(1);
    expect(nextUnmarkedIndex([t(1), t(2)])).toBeNull();
    expect(nextUnmarkedIndex([])).toBeNull();
  });
});

describe("undoLastMark / setMark (K2c.2)", () => {
  it("Hoàn tác bỏ mốc của lượt có mốc ở vị trí SAU CÙNG", () => {
    const out = undoLastMark([t(1), t(5), t()]);
    expect(out.map((x) => x.startSec)).toEqual([1, undefined, undefined]);
    expect(undoLastMark([t(), t()]).map((x) => x.startSec)).toEqual([undefined, undefined]);
  });
  it("setMark sửa một mốc nếu vẫn tăng dần giữa hai láng giềng có mốc; null xoá mốc", () => {
    expect(setMark([t(1), t(5), t(9)], 1, 6)).toMatchObject({ ok: true });
    expect(setMark([t(1), t(5), t(9)], 1, 0.5)).toMatchObject({ ok: false });
    expect(setMark([t(1), t(5), t(9)], 1, 9)).toMatchObject({ ok: false });
    const cleared = setMark([t(1), t(5), t(9)], 1, null);
    expect(cleared.ok && cleared.turns.map((x) => x.startSec)).toEqual([1, undefined, 9]);
  });
  it("mốc âm/NaN bị từ chối", () => {
    expect(setMark([t(), t()], 0, -1).ok).toBe(false);
    expect(setMark([t(), t()], 0, Number.NaN).ok).toBe(false);
  });
});

describe("validateMarks (K2a.3)", () => {
  it("báo lượt đầu tiên làm mốc không còn tăng dần, nêu số lượt", () => {
    expect(validateMarks([t(1), t(5), t(9)])).toEqual([]);
    const e = validateMarks([t(5), t(1)]);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatch(/lượt 2/i);
  });
  it("đổi chỗ hai lượt có mốc làm sai thứ tự → báo", () => {
    const swapped = [t(5), t(1), t(9)];
    expect(validateMarks(swapped).length).toBeGreaterThan(0);
  });
});

describe("formatMark / parseMark — m:ss,d", () => {
  it("định dạng", () => {
    expect(formatMark(0)).toBe("0:00,0");
    expect(formatMark(65.34)).toBe("1:05,3");
    expect(formatMark(600)).toBe("10:00,0");
  });
  it("đọc lại: m:ss,d · số giây thập phân · rỗng/lạ → null", () => {
    expect(parseMark("1:05,3")).toBe(65.3);
    expect(parseMark("65.3")).toBe(65.3);
    expect(parseMark("65,3")).toBe(65.3);
    expect(parseMark("0:07")).toBe(7);
    expect(parseMark("")).toBeNull();
    expect(parseMark("abc")).toBeNull();
    expect(parseMark("-3")).toBeNull();
  });
});

import { turnClickAction } from "@/lib/dialogueTiming";

describe("turnClickAction — bấm vào một lượt (K2b.2)", () => {
  const base = { hasOwnAudio: false, hasMark: false, hasWholeAudio: false, wholePlaying: false, sequenceOn: false };
  it("đang nghe cả đoạn (audio cả đoạn) và lượt có mốc → tua, kể cả khi lượt có audio riêng", () => {
    expect(turnClickAction({ ...base, hasWholeAudio: true, wholePlaying: true, hasMark: true, hasOwnAudio: true })).toBe("seek_whole");
  });
  it("rảnh và lượt có audio riêng → nghe riêng lượt đó (như K1.4)", () => {
    expect(turnClickAction({ ...base, hasWholeAudio: true, hasMark: true, hasOwnAudio: true })).toBe("play_own");
  });
  it("đang chạy chuỗi 'Nghe cả đoạn' của K1 và lượt có audio riêng → nhảy trong chuỗi", () => {
    expect(turnClickAction({ ...base, sequenceOn: true, hasOwnAudio: true, hasWholeAudio: true, hasMark: true })).toBe("sequence_jump");
  });
  it("lượt chỉ có mốc (không audio riêng) + có audio cả đoạn → tua và phát, kể cả khi đang rảnh", () => {
    expect(turnClickAction({ ...base, hasWholeAudio: true, hasMark: true })).toBe("seek_whole");
  });
  it("không audio riêng, không mốc (hoặc có mốc mà không có audio cả đoạn) → không bấm được", () => {
    expect(turnClickAction(base)).toBe("none");
    expect(turnClickAction({ ...base, hasWholeAudio: true })).toBe("none");
    expect(turnClickAction({ ...base, hasMark: true })).toBe("none");
  });
  it("audio cả đoạn đang chạy nhưng lượt không mốc mà có audio riêng → nghe riêng (audio cả đoạn sẽ nhường)", () => {
    expect(turnClickAction({ ...base, hasWholeAudio: true, wholePlaying: true, hasOwnAudio: true })).toBe("play_own");
  });
});
