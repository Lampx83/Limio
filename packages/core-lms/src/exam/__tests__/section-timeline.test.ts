import { describe, expect, it } from "vitest";
import { resolveSectionTimeline } from "../section-timeline";

/**
 * LANG G5a — đồng hồ theo phần của đề thi thử, tính THUẦN từ giờ bắt đầu:
 * không có "phần hiện tại" lưu sẵn để quên cập nhật. Hết giờ phần thì phần kế
 * mở liền (nối tiếp, không khoảng nghỉ), kể cả khi không ai mở trang.
 */

const T0 = new Date("2026-10-03T08:00:00Z");
const at = (sec: number) => new Date(T0.getTime() + sec * 1000);
const sections = [
  { id: "L", durationSec: 30 * 60 },
  { id: "R", durationSec: 60 * 60 },
  { id: "W", durationSec: 45 * 60 },
];
const total = 135 * 60;

const run = (nowSec: number, overrides = {}, durationSec = total) =>
  resolveSectionTimeline({ sections, overrides, startedAt: T0, durationSec, now: at(nowSec) });

describe("resolveSectionTimeline", () => {
  it("G5a.1: vừa bắt đầu → phần đầu chạy, các phần sau chưa mở", () => {
    const t = run(0);
    expect(t.finished).toBe(false);
    expect(t.activeSectionId).toBe("L");
    expect(t.remainingSec).toBe(30 * 60);
    expect(t.sections.map((s) => s.state)).toEqual(["active", "upcoming", "upcoming"]);
  });

  it("giữa phần: còn lại = hạn phần − bây giờ", () => {
    const t = run(10 * 60);
    expect(t.activeSectionId).toBe("L");
    expect(t.remainingSec).toBe(20 * 60);
  });

  it("G5a.3: hết giờ phần đầu → sang phần 2 ngay, phần 2 tính từ lúc phần 1 hết (không từ lúc ai đó mở trang)", () => {
    const t = run(30 * 60 + 5);
    expect(t.activeSectionId).toBe("R");
    expect(t.remainingSec).toBe(60 * 60 - 5);
    expect(t.sections.map((s) => s.state)).toEqual(["done", "active", "upcoming"]);
  });

  it("đúng ranh giới: giây 1800 đã là phần 2 (phần 1 đóng khi hết giờ)", () => {
    expect(run(30 * 60 - 1).activeSectionId).toBe("L");
    expect(run(30 * 60).activeSectionId).toBe("R");
  });

  it("bỏ trang rất lâu: nhảy thẳng tới phần đang chạy theo giờ, bỏ qua các phần đã hết", () => {
    const t = run(100 * 60);
    expect(t.activeSectionId).toBe("W");
    expect(t.sections.map((s) => s.state)).toEqual(["done", "done", "active"]);
    expect(t.remainingSec).toBe(35 * 60);
  });

  it("hết tổng giờ → finished, không còn phần chạy", () => {
    const t = run(total);
    expect(t.finished).toBe(true);
    expect(t.activeSectionId).toBeNull();
    expect(t.remainingSec).toBe(0);
    expect(t.sections.every((s) => s.state === "done")).toBe(true);
  });

  it("G5a.4: nộp sớm phần 1 lúc phút 12 → phần 2 bắt đầu lúc phút 12 và có đủ 60 phút", () => {
    const o = { L: { endedAt: at(12 * 60), extraSec: 0 } };
    const t = run(13 * 60, o);
    expect(t.activeSectionId).toBe("R");
    expect(t.remainingSec).toBe(59 * 60);
    expect(t.sections[0]).toMatchObject({ state: "done" });
  });

  it("nộp sớm KHÔNG đổi tổng hạn: phần cuối vẫn có đủ giờ và hạn cả bài không lùi sớm hơn", () => {
    const o = { L: { endedAt: at(12 * 60), extraSec: 0 } };
    const t = run(12 * 60 + 60 * 60 + 1, o); // ngay sau khi phần 2 (bắt đầu phút 12) hết
    expect(t.activeSectionId).toBe("W");
    expect(t.remainingSec).toBe(45 * 60 - 1);
  });

  it("nộp sớm với giờ nộp SAU hạn tự nhiên thì bị bỏ qua (không kéo dài phần)", () => {
    const o = { L: { endedAt: at(40 * 60), extraSec: 0 } };
    expect(run(31 * 60, o).activeSectionId).toBe("R");
  });

  it("G5a.9: gia hạn phần đang chạy cộng vào phần đó và đẩy các phần sau lùi lại", () => {
    const o = { L: { endedAt: null, extraSec: 5 * 60 } };
    expect(run(32 * 60, o).activeSectionId).toBe("L");
    expect(run(32 * 60, o).remainingSec).toBe(3 * 60);
    expect(run(35 * 60, o, total + 5 * 60).activeSectionId).toBe("R");
  });

  it("hạn cứng cả bài (durationSec bị cắt theo cửa sổ ca) thắng giờ phần", () => {
    // ca đóng sớm: chỉ còn 50 phút cho đề 135 phút
    const t = run(40 * 60, {}, 50 * 60);
    expect(t.activeSectionId).toBe("R");
    expect(t.remainingSec).toBe(10 * 60); // bị cắt bởi hạn cứng, không phải 50 phút của phần R
    expect(run(50 * 60, {}, 50 * 60).finished).toBe(true);
  });

  it("trả mốc giờ từng phần để máy khách/event dùng", () => {
    const t = run(0);
    expect(t.sections[1]!.startsAt.getTime()).toBe(at(30 * 60).getTime());
    expect(t.sections[1]!.endsAt.getTime()).toBe(at(90 * 60).getTime());
  });

  it("đề không có phần nào → finished ngay (người gọi phải chặn trường hợp này từ trước)", () => {
    const t = resolveSectionTimeline({ sections: [], overrides: {}, startedAt: T0, durationSec: 60, now: at(1) });
    expect(t.finished).toBe(true);
  });
});
