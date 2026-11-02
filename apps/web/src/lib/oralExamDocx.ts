import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  ShadingType,
  TextRun,
} from "docx";

// A6.6 — Xuất phiên vấn đáp ra Word để lưu trữ. Không dùng PDF: đo với 100 phiên 40 lượt, PDF mất 38 giây
// và chặn máy chủ tới 1 giây mỗi lần, Word mất dưới 1 giây vì không phải dàn trang, nhúng phông.

export interface OralExamDocxProps {
  examTitle: string;
  courseTitle: string | null;
  studentName: string;
  studentEmail: string | null;
  submittedAtLabel: string | null;
  gradedAtLabel: string | null;
  graded: boolean;
  instructorScore: number | null;
  instructorNotes: string | null;
  aiSuggestedScore: number | null;
  aiSummary: string | null;
  aiRubricBreakdown: { topic: string; note: string }[] | null;
  turns: { role: "examiner" | "student"; content: string }[];
  generatedAtLabel: string;
}

const GRAY = "F4F4F5";
const BLUE = "E0F2FE";
const VIOLET = "F5F3FF";

/**
 * Bỏ ký tự XML không cho phép. Lời nhận dạng giọng nói hay AI thỉnh thoảng lẫn ký tự điều khiển,
 * chỉ một ký tự cũng khiến Word báo file hỏng.
 */
function clean(s: string): string {
  return s
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f￾￿]/g, "")
    .replace(/[\ud800-\udbff](?![\udc00-\udfff])|(?<![\ud800-\udbff])[\udc00-\udfff]/g, "");
}

/** Giữ xuống dòng trong nội dung. */
function runs(text: string, opts: { bold?: boolean; size?: number; color?: string } = {}): TextRun[] {
  return clean(text)
    .split(/\r\n|\r|\n/)
    .map((line, i) => new TextRun({ text: line, break: i > 0 ? 1 : 0, ...opts }));
}

function shaded(fill: string, children: TextRun[], extra: { keepNext?: boolean; after?: number } = {}) {
  return new Paragraph({
    children,
    shading: { type: ShadingType.CLEAR, color: "auto", fill },
    keepNext: extra.keepNext,
    spacing: { after: extra.after ?? 0, line: 288 },
  });
}

function sectionHeading(text: string) {
  return new Paragraph({
    text,
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 280, after: 100 },
  });
}

export async function renderOralExamDocx(props: OralExamDocxProps): Promise<Buffer> {
  const {
    examTitle,
    courseTitle,
    studentName,
    studentEmail,
    submittedAtLabel,
    gradedAtLabel,
    graded,
    instructorScore,
    instructorNotes,
    aiSuggestedScore,
    aiSummary,
    aiRubricBreakdown,
    turns,
    generatedAtLabel,
  } = props;

  const children: Paragraph[] = [
    new Paragraph({ children: runs(examTitle), heading: HeadingLevel.HEADING_1, spacing: { after: 60 } }),
  ];
  if (courseTitle) {
    children.push(
      new Paragraph({ children: runs(courseTitle, { color: "555555" }), spacing: { after: 160 } }),
    );
  }
  children.push(
    new Paragraph({
      children: runs(`Học viên: ${studentName}${studentEmail ? ` (${studentEmail})` : ""}`),
      spacing: { after: 40 },
    }),
  );
  if (submittedAtLabel) {
    children.push(new Paragraph({ children: runs(`Nộp bài lúc: ${submittedAtLabel}`) }));
  }

  children.push(sectionHeading("Điểm và nhận xét"));
  if (graded) {
    children.push(shaded(GRAY, runs(`Điểm chính thức: ${instructorScore} / 100`, { bold: true })));
    if (gradedAtLabel) children.push(shaded(GRAY, runs(`Chấm lúc: ${gradedAtLabel}`)));
    if (instructorNotes) children.push(shaded(GRAY, runs(`Nhận xét: ${instructorNotes}`)));
  } else {
    children.push(shaded(GRAY, runs("Chưa chấm chính thức", { bold: true })));
  }
  if (aiSuggestedScore !== null) {
    children.push(
      new Paragraph({ spacing: { after: 80 } }),
      shaded(
        VIOLET,
        runs("AI đề xuất (chỉ tham khảo nội bộ giảng viên, không phải điểm chính thức)", {
          bold: true,
          size: 18,
          color: "6D28D9",
        }),
      ),
      shaded(VIOLET, runs(`Điểm AI đề xuất: ${aiSuggestedScore} / 100`)),
    );
    if (aiSummary) children.push(shaded(VIOLET, runs(aiSummary)));
    for (const b of aiRubricBreakdown ?? []) {
      children.push(shaded(VIOLET, runs(`• ${b.topic}: ${b.note}`, { size: 20 })));
    }
  }

  children.push(sectionHeading("Toàn bộ hội thoại"));
  if (turns.length === 0) {
    children.push(new Paragraph({ children: runs("Chưa có lượt hỏi-đáp nào.") }));
  }
  for (const t of turns) {
    const fill = t.role === "examiner" ? GRAY : BLUE;
    const label = t.role === "examiner" ? "AI giám khảo" : "Sinh viên";
    children.push(
      shaded(fill, runs(label, { bold: true, size: 18, color: "555555" }), { keepNext: true }),
      shaded(fill, runs(t.content), { after: 120 }),
    );
  }

  const doc = new Document({
    creator: "Limio",
    title: clean(`Vấn đáp - ${examTitle} - ${studentName}`),
    styles: {
      default: {
        // Khai tiếng Việt để Word không gạch đỏ cả bài vì tưởng là tiếng Anh.
        document: { run: { font: "Arial", size: 22, language: { value: "vi-VN" } } },
        heading1: { run: { font: "Arial", size: 32, bold: true, color: "000000" } },
        heading2: { run: { font: "Arial", size: 24, bold: true, color: "000000" } },
      },
    },
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    size: 16,
                    color: "999999",
                    children: [
                      `Xuất lúc ${generatedAtLabel}, trang `,
                      PageNumber.CURRENT,
                      "/",
                      PageNumber.TOTAL_PAGES,
                    ],
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });
  return Packer.toBuffer(doc);
}
