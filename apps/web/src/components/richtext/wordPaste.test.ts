import { describe, expect, it } from "vitest";
import { cleanWordHtml, isWordHtml } from "./wordPaste";

describe("isWordHtml", () => {
  it("nhận diện HTML từ Word qua khai báo mso-*", () => {
    expect(isWordHtml('<p style="mso-margin-top-alt:0">A</p>')).toBe(true);
  });

  it("nhận diện qua namespace urn:schemas-microsoft-com:office", () => {
    expect(
      isWordHtml('<html xmlns:o="urn:schemas-microsoft-com:office:office">'),
    ).toBe(true);
  });

  it("HTML thường (không phải Word) trả về false", () => {
    expect(isWordHtml("<p>Chào bạn</p>")).toBe(false);
  });
});

describe("cleanWordHtml", () => {
  it("bỏ qua HTML không phải Word, giữ nguyên", () => {
    const html = "<p>Chào bạn</p>";
    expect(cleanWordHtml(html)).toBe(html);
  });

  it("gỡ comment điều kiện <!--[if ...]-->", () => {
    const html =
      '<!--[if gte mso 9]><xml></xml><![endif]--><p style="mso-x:1">A</p>';
    expect(cleanWordHtml(html)).not.toContain("<!--");
    expect(cleanWordHtml(html)).not.toContain("[if gte mso");
  });

  it("gỡ thẻ namespace <o:p>, <w:...>, <v:...>", () => {
    const html =
      '<p style="mso-x:1"><o:p>&nbsp;</o:p></p><v:shapetype id="a"></v:shapetype>';
    const out = cleanWordHtml(html);
    expect(out).not.toContain("<o:p");
    expect(out).not.toContain("<v:shapetype");
  });

  it("gỡ xmlns:* và class=\"Mso...\"", () => {
    const html =
      '<html xmlns:o="urn:schemas-microsoft-com:office:office"><p class="MsoNormal" style="mso-x:1">A</p></html>';
    const out = cleanWordHtml(html);
    expect(out).not.toContain("xmlns:o=");
    expect(out).not.toContain('class="MsoNormal"');
  });

  it("gỡ mso-* trong style nhưng giữ style thật còn lại", () => {
    const html =
      '<table style="mso-x:1"><tr><td style="mso-y:2;border:1px solid #000">A</td></tr></table>';
    const out = cleanWordHtml(html);
    expect(out).not.toContain("mso-y");
    expect(out).not.toContain("mso-x");
    expect(out).toContain('style="border:1px solid #000"');
    expect(out).toContain("<table");
    expect(out).toContain("<td");
  });

  it("style chỉ toàn mso-* thì bỏ luôn thuộc tính style", () => {
    const html = '<p style="mso-x:1;mso-y:2">A</p>';
    const out = cleanWordHtml(html);
    expect(out).not.toContain("style=");
  });
});
