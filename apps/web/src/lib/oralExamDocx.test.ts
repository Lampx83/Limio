import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { renderOralExamDocx } from "./oralExamDocx";

const base = {
  examTitle: "Giữa kỳ",
  courseTitle: "Kinh tế vi mô",
  studentName: "Nguyễn Văn An",
  studentEmail: "an@example.com",
  submittedAtLabel: "06:30 02/11/2026",
  gradedAtLabel: null,
  graded: false,
  instructorScore: null,
  instructorNotes: null,
  aiSuggestedScore: null,
  aiSummary: null,
  aiRubricBreakdown: null,
  turns: [] as { role: "examiner" | "student"; content: string }[],
  generatedAtLabel: "07:00 02/11/2026",
};

async function documentXml(props: typeof base | Parameters<typeof renderOralExamDocx>[0]) {
  const zip = await JSZip.loadAsync(await renderOralExamDocx(props));
  return zip.file("word/document.xml")!.async("string");
}

describe("renderOralExamDocx", () => {
  it("có đủ thông tin học viên và cả hai phía hội thoại", async () => {
    const xml = await documentXml({
      ...base,
      turns: [
        { role: "examiner", content: "Cầu là gì?" },
        { role: "student", content: "Cầu là lượng hàng người mua sẵn lòng mua." },
      ],
    });
    for (const text of [
      "Giữa kỳ",
      "Kinh tế vi mô",
      "Nguyễn Văn An (an@example.com)",
      "Nộp bài lúc: 06:30 02/11/2026",
      "Chưa chấm chính thức",
      "AI giám khảo",
      "Cầu là gì?",
      "Sinh viên",
      "Cầu là lượng hàng người mua sẵn lòng mua.",
    ]) {
      expect(xml).toContain(text);
    }
  });

  it("hiện điểm chính thức, nhận xét và phần AI đề xuất", async () => {
    const xml = await documentXml({
      ...base,
      graded: true,
      instructorScore: 85,
      instructorNotes: "Lập luận tốt",
      gradedAtLabel: "08:00 03/11/2026",
      aiSuggestedScore: 80,
      aiSummary: "Trả lời khá đầy đủ",
      aiRubricBreakdown: [{ topic: "Khái niệm", note: "Đúng" }],
    });
    expect(xml).toContain("Điểm chính thức: 85 / 100");
    expect(xml).toContain("Nhận xét: Lập luận tốt");
    expect(xml).toContain("Điểm AI đề xuất: 80 / 100");
    expect(xml).toContain("• Khái niệm: Đúng");
    expect(xml).not.toContain("Chưa chấm chính thức");
  });

  it("nội dung có ký tự đặc biệt không làm hỏng file", async () => {
    const xml = await documentXml({
      ...base,
      turns: [{ role: "student", content: "a < b & c > d\u000b\u0001\ud83dhết\ndòng hai" }],
    });
    expect(xml).toContain("a &lt; b &amp; c &gt; dhết");
    expect(xml).toContain("dòng hai");
    // eslint-disable-next-line no-control-regex
    expect(xml).not.toMatch(/[\x00-\x08\x0b\x0c\x0e-\x1f]/);
    expect(xml).toContain("<w:br/>");
  });
});
