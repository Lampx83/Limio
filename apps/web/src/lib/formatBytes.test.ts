import { describe, expect, it } from "vitest";
import { formatBytes } from "./formatBytes";

describe("formatBytes", () => {
  it("định dạng theo bậc, dấu phẩy thập phân", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(5 * 1024 * 1024)).toBe("5,0 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3,0 GB");
    expect(formatBytes(250 * 1024 ** 3)).toBe("250 GB");
  });
  it("giá trị không hợp lệ không làm vỡ trang", () => {
    expect(formatBytes(-1)).toBe("—");
    expect(formatBytes(NaN)).toBe("—");
  });
});
