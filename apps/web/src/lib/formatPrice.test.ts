import { describe, expect, it } from "vitest";
import { discountPercent } from "./formatPrice";

describe("discountPercent", () => {
  it("599.000 → 199.000 giảm 67%", () => {
    expect(discountPercent(599000, 199000)).toBe(67);
  });
  it("làm tròn và giữ trong 1–99", () => {
    expect(discountPercent(1000, 999)).toBe(1);
    expect(discountPercent(1_000_000, 1)).toBe(99);
  });
  it("không có khuyến mãi hợp lệ thì null", () => {
    expect(discountPercent(null, 199000)).toBeNull();
    expect(discountPercent(undefined, 199000)).toBeNull();
    expect(discountPercent(199000, 199000)).toBeNull(); // bằng giá bán
    expect(discountPercent(100000, 199000)).toBeNull(); // thấp hơn giá bán
    expect(discountPercent(599000, 0)).toBeNull(); // miễn phí
    expect(discountPercent(599000, null)).toBeNull();
    expect(discountPercent(0, 199000)).toBeNull();
  });
});
