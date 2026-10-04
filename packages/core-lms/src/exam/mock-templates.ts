import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { createExam } from "./exams";
import { createSection } from "./sections";
import { ExamError } from "./types";

/**
 * LANG G5c.1 — khung đề thi thử HSK · IELTS · TOEIC · Tuỳ chỉnh.
 *
 * Khung CHỈ dựng cấu trúc rỗng: các phần và kỹ năng của từng phần. Cố ý KHÔNG kèm câu
 * hỏi, bài đọc, giờ hay bảng quy đổi: đề thật có bản quyền, còn số phút/thang điểm chính
 * thức phải do giảng viên đối chiếu nguồn rồi điền. Phần Nói nằm ngoài thi thử (có thi
 * vấn đáp riêng), nên IELTS không có phần Nói.
 */
export interface MockExamTemplate {
  id: "hsk" | "ielts" | "toeic" | "custom";
  label: string;
  hint: string;
  sections: { title: string; languageSkill: "listening" | "reading" | "writing" | "speaking" }[];
}

export const MOCK_EXAM_TEMPLATES: readonly MockExamTemplate[] = [
  {
    id: "hsk",
    label: "HSK",
    hint: "Nghe · Đọc · Viết",
    sections: [
      { title: "Nghe", languageSkill: "listening" },
      { title: "Đọc", languageSkill: "reading" },
      { title: "Viết", languageSkill: "writing" },
    ],
  },
  {
    id: "ielts",
    label: "IELTS",
    hint: "Listening · Reading · Writing (không có Speaking)",
    sections: [
      { title: "Listening", languageSkill: "listening" },
      { title: "Reading", languageSkill: "reading" },
      { title: "Writing", languageSkill: "writing" },
    ],
  },
  {
    id: "toeic",
    label: "TOEIC",
    hint: "Listening · Reading",
    sections: [
      { title: "Listening", languageSkill: "listening" },
      { title: "Reading", languageSkill: "reading" },
    ],
  },
  { id: "custom", label: "Tuỳ chỉnh", hint: "Đề trống, tự thêm các phần", sections: [] },
];

const Input = z.object({
  title: z.string().trim().min(1).max(200),
  template: z.enum(["hsk", "ielts", "toeic", "custom"]),
});

export async function createMockExamFromTemplate(
  actorUserId: string,
  courseId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ examId: string }> {
  const parsed = Input.safeParse(rawInput);
  if (!parsed.success) throw new ExamError("validation_failed", parsed.error.flatten());
  const tpl = MOCK_EXAM_TEMPLATES.find((t) => t.id === parsed.data.template)!;
  // createExam kiểm quyền sửa khoá. Thời lượng đề chỉ là giá trị tạm: xuất bản sẽ chuẩn hoá
  // thành tổng giờ các phần.
  const { examId } = await createExam(
    actorUserId,
    courseId,
    { title: parsed.data.title, durationMin: 60, mockMode: true },
    db,
  );
  for (const s of tpl.sections) {
    await createSection(actorUserId, examId, { title: s.title, languageSkill: s.languageSkill }, db);
  }
  return { examId };
}
