import { describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

// Lõi dùng chung với widget nên là tệp trong public/, nạp như CommonJS.
const require = createRequire(import.meta.url);
const P = require(fileURLToPath(new URL("../../public/widgets/parabola-core.js", import.meta.url))) as {
  analyze(a: number, b: number, c: number): null | {
    delta: number; vertex: { x: number; y: number }; axis: number; roots: number[]; opensUp: boolean;
  };
  makeChallenge(rnd: () => number): {
    a: number; b: number; c: number; vertex: { x: number; y: number }; through: { x: number; y: number };
  };
  checkChallenge(ch: unknown, a: number, b: number, c: number, tol?: number): { ok: boolean };
  fmt(n: number): string;
  coef(n: number): string;
};

/** PRNG xác định để test không chập chờn. */
function lcg(seed: number) {
  let s = seed;
  return () => ((s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296);
}

describe("parabola analyze", () => {
  it("x²−2x−3: đỉnh (1;−4), Δ=16, nghiệm −1 và 3", () => {
    const r = P.analyze(1, -2, -3)!;
    expect(r.vertex).toEqual({ x: 1, y: -4 });
    expect(r.delta).toBe(16);
    expect(r.roots).toEqual([-1, 3]);
    expect(r.opensUp).toBe(true);
  });

  it("Δ<0 → không nghiệm; Δ=0 → nghiệm kép tại đỉnh", () => {
    expect(P.analyze(1, 0, 1)!.roots).toEqual([]);
    const k = P.analyze(1, -2, 1)!;
    expect(k.roots).toEqual([1]);
    expect(k.vertex.y).toBe(0);
  });

  it("a<0 mở xuống; a=0 không phải bậc hai", () => {
    expect(P.analyze(-2, 4, 0)!.opensUp).toBe(false);
    expect(P.analyze(0, 3, 1)).toBeNull();
  });
});

describe("thử thách", () => {
  it("200 đề: luôn có đáp án (a,b,c) nguyên khớp đề và lọt khung vẽ", () => {
    const rnd = lcg(42);
    for (let i = 0; i < 200; i++) {
      const ch = P.makeChallenge(rnd);
      expect(ch.a).not.toBe(0);
      expect(Number.isInteger(ch.a) && Number.isInteger(ch.b) && Number.isInteger(ch.c)).toBe(true);
      expect(Math.abs(ch.vertex.x)).toBeLessThanOrEqual(4);
      expect(ch.vertex.x).not.toBe(0); // đỉnh trùng điểm cắt Oy thì đề chỉ còn một yêu cầu
      expect(Math.abs(ch.vertex.y)).toBeLessThanOrEqual(8);
      expect(P.checkChallenge(ch, ch.a, ch.b, ch.c).ok).toBe(true);
    }
  });

  it("chấm sai khi lệch đỉnh hoặc a=0", () => {
    const ch = { a: 1, b: -2, c: -3, vertex: { x: 1, y: -4 }, through: { x: 0, y: -3 } };
    expect(P.checkChallenge(ch, 1, -2, -2).ok).toBe(false);
    expect(P.checkChallenge(ch, 2, -4, -3).ok).toBe(false); // cùng đi qua (0;−3) nhưng đỉnh (1;−5)
    expect(P.checkChallenge(ch, 0, 1, -3).ok).toBe(false);
  });
});

describe("fmt", () => {
  it("dùng dấu phẩy thập phân và dấu trừ toán học", () => {
    expect(P.fmt(0.5)).toBe("0,5");
    expect(P.fmt(-1.3333)).toBe("−1,33");
    expect(P.fmt(-0)).toBe("0");
    expect(P.fmt(NaN)).toBe("—");
  });
});

describe("coef", () => {
  it("bỏ số 1 đứng trước x", () => {
    expect(P.coef(1)).toBe("");
    expect(P.coef(-1)).toBe("\u2212");
    expect(P.coef(2.5)).toBe("2,5");
  });
});
