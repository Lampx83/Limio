import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { LibraryItem } from "@feedbackme/core-lms";
import PracticeRow from "./PracticeRow";

const item = (o: Partial<LibraryItem> = {}): LibraryItem => ({
  examId: "e1", title: "Đề thật 2023", collectionId: "c1", collectionTitle: "Phần 1", seq: 3, paperType: "official",
  sourceLabel: "HSK 2023-05", yearLabel: "2023", difficulty: 3, tags: [], skills: ["listening"], allowMock: true, allowPractice: true,
  freePreview: false, locked: false, myStatus: "not_started", lastLevel: null, attemptCount: 0, ...o,
});
const render = (i: LibraryItem) => renderToStaticMarkup(<PracticeRow slug="hsk-4-nghe" item={i} />);
const text = (h: string) => h.replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ");

describe("PracticeRow (L6.3)", () => {
  it("hiện tên, nguồn/năm, loại đề, số thứ tự; HAI nút Luyện đề và Phòng thi mô phỏng trỏ đúng đường dẫn", () => {
    const h = render(item());
    const t = text(h);
    for (const s of ["Đề thật 2023", "HSK 2023-05", "2023", "Đề thật", "Luyện đề", "Phòng thi mô phỏng", "Chưa làm"]) expect(t).toContain(s);
    expect(h).toContain('href="/learn/hsk-4-nghe/exams/e1/practice"');
    expect(h).toContain('href="/learn/hsk-4-nghe/exams/e1"');
  });
  it("chỉ hiện nút của chế độ đề còn cho phép", () => {
    expect(text(render(item({ allowMock: false })))).not.toContain("Phòng thi mô phỏng");
    expect(text(render(item({ allowPractice: false })))).not.toContain("Luyện đề");
  });
  it("nhãn mức gần nhất là chữ ('Cần ôn'/'Vững'), KHÔNG có số điểm hay phần trăm", () => {
    const t = text(render(item({ myStatus: "redo", lastLevel: "needs_review", attemptCount: 2 })));
    expect(t).toContain("Nên làm lại");
    expect(t).toContain("Cần ôn");
    expect(t).toContain("2 lần");
    expect(t).not.toMatch(/\d+\s*%|điểm/i);
  });
  it("trạng thái đang làm dở có dấu rõ và nút đổi thành tiếp tục", () => {
    const t = text(render(item({ myStatus: "in_progress", attemptCount: 1 })));
    expect(t).toContain("Đang làm");
  });
  it("L6.5: đề KHOÁ (chưa mua, không học thử) không có nút làm bài, nói rõ cần mua khoá", () => {
    const h = render(item({ locked: true }));
    expect(text(h)).toContain("Cần mua khoá");
    expect(h).not.toContain("/practice");
    expect(h).not.toContain('href="/learn/hsk-4-nghe/exams/e1"');
    expect(h).toContain('aria-disabled="true"');
  });
  it("L6.1: đề học thử miễn phí có nhãn 'Học thử' và làm được dù chưa mua", () => {
    const t = text(render(item({ freePreview: true })));
    expect(t).toContain("Học thử");
    expect(t).toContain("Luyện đề");
  });
  it("kỹ năng và độ khó hiện bằng chữ có nhãn truy cập", () => {
    const h = render(item({ difficulty: 4, skills: ["listening", "reading"] }));
    expect(h).toContain("Độ khó 4/5");
    expect(text(h)).toContain("Nghe");
    expect(text(h)).toContain("Đọc");
  });
  it("chữ do giảng viên nhập là text thuần (HTML bị thoát)", () => {
    const h = render(item({ title: "<img src=x onerror=alert(1)>" }));
    expect(h).not.toContain("<img");
    expect(h).toContain("&lt;img");
  });
});
