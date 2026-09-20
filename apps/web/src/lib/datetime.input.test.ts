import { describe, expect, it } from "vitest";
import { fromDateTimeInputValue, toDateTimeInputValue } from "./datetime";

describe("ô datetime-local theo giờ Việt Nam", () => {
  it("ISO UTC → giờ VN (+7)", () => {
    expect(toDateTimeInputValue("2026-06-01T01:00:00.000Z")).toBe("2026-06-01T08:00");
    expect(toDateTimeInputValue("2026-06-01T17:30:00.000Z")).toBe("2026-06-02T00:30");
  });

  it("giờ VN → ISO UTC", () => {
    expect(fromDateTimeInputValue("2026-06-01T08:00")).toBe("2026-06-01T01:00:00.000Z");
    expect(fromDateTimeInputValue("2026-06-02T00:30")).toBe("2026-06-01T17:30:00.000Z");
  });

  it("đi và về không lệch (lỗi cũ: cắt chuỗi ISO làm lệch 7 giờ mỗi lần sửa)", () => {
    const iso = "2026-09-20T13:45:00.000Z";
    expect(fromDateTimeInputValue(toDateTimeInputValue(iso))).toBe(iso);
  });

  it("rỗng hoặc sai định dạng → null", () => {
    expect(fromDateTimeInputValue("")).toBeNull();
    expect(fromDateTimeInputValue("2026-06-01")).toBeNull();
    expect(fromDateTimeInputValue("abc")).toBeNull();
  });
});
