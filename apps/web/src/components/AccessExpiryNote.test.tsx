import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import AccessExpiryNote from "./AccessExpiryNote";

const inDays = (n: number) => new Date(Date.now() + n * 86400000);

describe("AccessExpiryNote", () => {
  it("quyền không giới hạn thời gian → không hiện gì", () => {
    expect(renderToStaticMarkup(<AccessExpiryNote expiresAt={null} />)).toBe("");
    expect(renderToStaticMarkup(<AccessExpiryNote expiresAt={undefined} onDark renewHref="/x" />)).toBe("");
  });
  it("quyền có hạn → số ngày còn lại và ngày hết hạn; còn lâu màu xanh, sắp hết màu cảnh báo", () => {
    const far = renderToStaticMarkup(<AccessExpiryNote expiresAt={inDays(300)} />);
    expect(far).toContain("Còn 300 ngày");
    expect(far).toContain("Hạn sử dụng: ");
    expect(far).toContain('data-tone="ok"');
    expect(renderToStaticMarkup(<AccessExpiryNote expiresAt={inDays(12)} />)).toContain('data-tone="soon"');
  });
  it("nút Gia hạn chỉ hiện khi có renewHref", () => {
    expect(renderToStaticMarkup(<AccessExpiryNote expiresAt={inDays(12)} onDark />)).not.toContain("Gia hạn");
    expect(renderToStaticMarkup(<AccessExpiryNote expiresAt={inDays(12)} onDark renewHref="/checkout/x" />)).toContain('href="/checkout/x"');
  });
});
