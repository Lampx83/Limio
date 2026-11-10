import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LessonContent from "./LessonContent";

const item = { id: "i1", type: "exam_practice", payload: { examId: "e1" }, orderIndex: 0 };

describe("LessonContent — khối Bài luyện", () => {
  it("có phần tử dựng sẵn thì hiện đúng chỗ khối đó", () => {
    const html = renderToStaticMarkup(<LessonContent items={[item]} blocks={{ i1: <p>BÀI LUYỆN NHÚNG</p> }} />);
    expect(html).toContain("BÀI LUYỆN NHÚNG");
    expect(html).toContain('data-item-id="i1"');
  });
  it("không có phần tử (trang in, xem thử, chưa ghi danh) thì khối không hiện gì, kể cả khung bọc", () => {
    const html = renderToStaticMarkup(<LessonContent items={[item]} />);
    expect(html).not.toContain("data-item-id");
    expect(html).not.toContain("e1");
  });
  it("khối khác vẫn hiện bình thường bên cạnh", () => {
    const html = renderToStaticMarkup(
      <LessonContent items={[{ id: "t", type: "external_link", payload: { url: "https://example.com/x", title: "Liên kết thường" }, orderIndex: 0 }, item]} />,
    );
    expect(html).toContain("Liên kết thường");
  });
});
