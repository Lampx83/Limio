import { describe, expect, it } from "vitest";
import { safeHttpUrl, safeHref, sanitizeUrlFields } from "./safeUrl";

describe("safeHttpUrl", () => {
  it("chấp nhận http và https, trả về chuỗi đã cắt khoảng trắng", () => {
    expect(safeHttpUrl("https://github.com/a/b")).toBe("https://github.com/a/b");
    expect(safeHttpUrl("  http://example.com/x?y=1#z  ")).toBe("http://example.com/x?y=1#z");
  });

  it("từ chối scheme nguy hiểm dù viết hoa hoặc chèn khoảng trắng/ký tự điều khiển", () => {
    for (const bad of [
      "javascript:alert(1)",
      "JavaScript:alert(1)",
      " javascript:alert(1)",
      "java\nscript:alert(1)",
      "java\tscript:alert(1)",
      "data:text/html;base64,PHNjcmlwdD4=",
      "vbscript:msgbox(1)",
      "file:///etc/passwd",
      "blob:https://a.com/x",
      "ftp://a.com/x",
    ]) {
      expect(safeHttpUrl(bad)).toBeNull();
    }
  });

  it("từ chối chuỗi không phải URL tuyệt đối, rỗng, hoặc quá dài", () => {
    expect(safeHttpUrl("")).toBeNull();
    expect(safeHttpUrl("   ")).toBeNull();
    expect(safeHttpUrl("github.com/a")).toBeNull();
    expect(safeHttpUrl("//evil.com/x")).toBeNull();
    expect(safeHttpUrl("/uploads/a.pdf")).toBeNull();
    expect(safeHttpUrl(`https://a.com/${"x".repeat(2100)}`)).toBeNull();
    expect(safeHttpUrl(123 as unknown)).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });

  it("từ chối URL có thông tin đăng nhập nhúng (user:pass@) vì hay dùng để lừa", () => {
    expect(safeHttpUrl("https://google.com@evil.com/")).toBeNull();
  });
});

describe("safeHref", () => {
  it("cho phép thêm đường dẫn nội bộ một dấu gạch chéo", () => {
    expect(safeHref("/uploads/bai-nop.pdf")).toBe("/uploads/bai-nop.pdf");
    expect(safeHref("https://a.com/x")).toBe("https://a.com/x");
  });

  it("từ chối đường dẫn giao thức tương đối và mẹo dấu gạch ngược", () => {
    expect(safeHref("//evil.com")).toBeNull();
    expect(safeHref("/\\evil.com")).toBeNull();
    expect(safeHref("\\\\evil.com")).toBeNull();
    expect(safeHref("javascript:alert(1)")).toBeNull();
  });
});

describe("sanitizeUrlFields", () => {
  it("chuẩn hoá các trường URL, bỏ trường rỗng, giữ nguyên trường khác", () => {
    const r = sanitizeUrlFields(
      { repoUrl: " https://github.com/a ", slidesUrl: "", writeup: "mô tả", n: 3 },
      ["repoUrl", "slidesUrl", "demoVideoUrl"],
    );
    expect(r).toEqual({ ok: true, value: { repoUrl: "https://github.com/a", writeup: "mô tả", n: 3 } });
  });

  it("báo lỗi và nêu tên trường khi có URL không an toàn", () => {
    expect(sanitizeUrlFields({ repoUrl: "javascript:alert(1)" }, ["repoUrl"])).toEqual({ ok: false, field: "repoUrl" });
    expect(sanitizeUrlFields({ demoVideoUrl: 5 }, ["demoVideoUrl"])).toEqual({ ok: false, field: "demoVideoUrl" });
  });

  it("không có trường URL thì trả về nguyên vẹn", () => {
    expect(sanitizeUrlFields({ artifactMarkdown: "x" }, ["repoUrl"])).toEqual({ ok: true, value: { artifactMarkdown: "x" } });
  });
});
