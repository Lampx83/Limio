import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import LessonContent from "./LessonContent";

const item = { id: "r1", type: "exam_ref", payload: { examId: "e1", title: "Thi cuối unit" }, orderIndex: 0 };

describe("LessonContent — khối Đề thi (exam_ref)", () => {
  it("có phần tử dựng sẵn thì hiện đúng chỗ khối đó", () => {
    const html = renderToStaticMarkup(<LessonContent items={[item]} blocks={{ r1: <p>THẺ ĐỀ THI</p> }} />);
    expect(html).toContain("THẺ ĐỀ THI");
    expect(html).toContain('data-item-id="r1"');
  });
  it("không có phần tử (trang in, chiếu lớp, chưa ghi danh, đề chưa dùng được) thì không hiện gì, kể cả khung bọc và mã đề", () => {
    const html = renderToStaticMarkup(<LessonContent items={[item]} />);
    expect(html).not.toContain("data-item-id");
    expect(html).not.toContain("e1");
    expect(html).not.toContain("Thi cuối unit");
  });
});
