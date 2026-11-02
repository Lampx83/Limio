import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { chayToanMoRong } from "./khungToanMoRong.js";

type Diem = number[] | null;
const L = chayToanMoRong({ chiLoi: true }) as unknown as { dungHinh: (ds: unknown[], gt?: Record<string, number>) => Record<string, Diem> };
const kc = (a: Diem, b: Diem) => Math.hypot(a![0]! - b![0]!, a![1]! - b![1]!);

// Câu IV.2 đề Hà Nội 2026: bộ slide dựng hình đúng từ khai báo này.
const DE = [
  { ten: "O", x: 0, y: 0 },
  { ten: "B", x: -1, y: 0 },
  { ten: "C", x: 1, y: 0 },
  { ten: "A", tren: ["O", "B"], goc: 106 },
  { ten: "H", chia: ["A", "B"], t: 0.2 },
  { ten: "D", chan: ["H", "B", "C"] },
  { ten: "E", giao: [["D", "H"], ["A", "C"]] },
  { ten: "F", giaoTron: [["C", "H"], "O", "B"], khac: "C" },
  { ten: "M", giao: [["D", "F"], { qua: "A", vuongGoc: ["D", "E"] }] },
  { ten: "K", giaoTron: [["B", "M"], "O", "B"], khac: "B" },
];

describe("hình dựng từng bước (.hinh-dung)", () => {
  it.each([
    [100, 0.1],
    [106, 0.2],
    [125, 0.28],
    [140, 0.4],
  ])("giữ đúng kết luận của đề khi kéo A tới góc %i°, H tới t = %f", (goc, t) => {
    const P = L.dungHinh(DE, { A: goc, H: t });
    expect(kc(P.H!, P.K!)).toBeCloseTo(kc(P.H!, P.M!), 9);
    expect(kc(P.H!, P.M!)).toBeCloseTo(kc(P.H!, P.A!), 9);
    expect(kc(P.O!, P.F!)).toBeCloseTo(1, 9);
    expect(kc(P.O!, P.K!)).toBeCloseTo(1, 9);
    // F và K là giao điểm THỨ HAI, không phải C và B.
    expect(kc(P.F!, P.C!)).toBeGreaterThan(0.1);
    expect(kc(P.K!, P.B!)).toBeGreaterThan(0.01);
  });

  it("điểm không dựng được là null và lan sang điểm dựng từ nó", () => {
    const P = L.dungHinh([
      { ten: "A", x: 0, y: 0 },
      { ten: "B", x: 1, y: 0 },
      { ten: "C", x: 0, y: 1 },
      { ten: "D", x: 1, y: 1 },
      { ten: "E", giao: [["A", "B"], ["C", "D"]] },
      { ten: "F", trungDiem: ["A", "E"] },
    ]);
    expect(P.E).toBeNull();
    expect(P.F).toBeNull();
  });

  it("thành phần được đăng ký trong khung", () => {
    const src = readFileSync(path.join(process.cwd(), "src/lib/slideDeck/khungToanMoRong.js"), "utf8");
    expect(src).toContain('[".hinh-dung", "hinh-dung", dungHinhDung]');
  });
});
