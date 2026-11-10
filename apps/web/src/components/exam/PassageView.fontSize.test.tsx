import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// PassageView kéo trình phát audio (dùng API): thay bằng khung rỗng, chỉ kiểm chữ.
vi.mock("./ExamAudioPlayer", () => ({ default: () => null, ExamAudioContext: { Provider: ({ children }: { children: React.ReactNode }) => <>{children}</> } }));

import { renderDoc } from "./PassageView";

const doc = (size: unknown) => ({
  type: "doc" as const,
  content: [{ type: "paragraph", content: [{ type: "text", text: "to hơn", marks: [{ type: "textStyle", attrs: { fontSize: size } }] }] }],
});

describe("PassageView — cỡ chữ", () => {
  it("vẽ đúng bốn mức cố định bằng style font-size", () => {
    for (const size of ["0.875rem", "1.25rem", "1.5rem"]) {
      expect(renderToStaticMarkup(<>{renderDoc(doc(size))}</>), size).toContain(`font-size:${size}`);
    }
  });
  it("giá trị lạ (có thể là chuỗi độc) bị bỏ qua, chữ vẫn hiện", () => {
    for (const size of ["12pt", "red;background:url(x)", 20, null, undefined]) {
      const html = renderToStaticMarkup(<>{renderDoc(doc(size))}</>);
      expect(html, String(size)).not.toContain("font-size");
      expect(html).toContain("to hơn");
    }
  });
});

describe("PassageView — màu chữ và màu tô nổi", () => {
  const withMarks = (marks: unknown[]) => ({ type: "doc" as const, content: [{ type: "paragraph", content: [{ type: "text", text: "màu", marks }] }] });
  it("vẽ màu chữ và màu tô nổi trong bảng", () => {
    const html = renderToStaticMarkup(<>{renderDoc(withMarks([{ type: "textStyle", attrs: { color: "#dc2626" } }, { type: "highlight", attrs: { color: "#bfdbfe" } }]))}</>);
    expect(html).toContain("color:#dc2626");
    expect(html).toContain("background-color:#bfdbfe");
  });
  it("màu ngoài bảng (hoặc chuỗi độc) bị bỏ; tô nổi không màu giữ mặc định", () => {
    const html = renderToStaticMarkup(<>{renderDoc(withMarks([{ type: "textStyle", attrs: { color: "red;background:url(x)" } }, { type: "highlight", attrs: { color: "javascript:1" } }]))}</>);
    expect(html).not.toContain("style=");
    expect(html).toContain("bg-amber-100");
    expect(html).toContain("màu");
  });
});

