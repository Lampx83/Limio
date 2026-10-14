/**
 * Dữ liệu MẪU cho dev DB để thử phòng thi thử (LANG G5a): đề "Thi thử HSK 3 (demo)"
 * gồm 3 phần Nghe · Đọc · Viết với giờ rất ngắn (3 / 4 / 2 phút) để thử chuyển phần.
 * Nội dung tự soạn, không phải đề thật.
 *
 *   NODE_OPTIONS=--max-old-space-size=1536 \
 *     node --env-file=../db/.env --import tsx scripts/seed-mock-exam.ts
 *
 * Cần khoá demo ngoại ngữ (scripts/seed-language-demo.ts). Rerun-safe: có đề cùng tên thì thôi.
 * Chỉ dùng cho dev DB.
 */
import { prisma } from "@feedbackme/db";
import {
  createExam,
  createExamQuestion,
  createPassage,
  createSection,
  publishExam,
} from "../src/exam";

const OWNER_EMAIL = "giangvien.mau@feedbackme.dev";
const COURSE_SLUG = "demo-ngoai-ngu-tieng-trung";
const TITLE = "Thi thử HSK 3 (demo)";

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

const mcq = (prompt: string, right: string, wrong: string[]) => ({
  type: "mcq" as const,
  prompt,
  config: {
    options: [
      { id: "a", label: right, isCorrect: true },
      ...wrong.map((w, i) => ({ id: String.fromCharCode(98 + i), label: w, isCorrect: false })),
    ],
  },
});

const PARTS: {
  title: string;
  skill: "listening" | "reading" | "writing";
  minutes: number;
  passage: { title: string; text: string };
  questions: ReturnType<typeof mcq>[];
}[] = [
  {
    title: "Nghe",
    skill: "listening",
    minutes: 3,
    passage: { title: "Hội thoại 1 (lời thoại thay cho audio)", text: "A：你好，请问洗手间在哪儿？ B：在二楼，你可以坐电梯上去。" },
    questions: [
      mcq("Người A hỏi gì?", "Nhà vệ sinh ở đâu", ["Giờ mở cửa", "Giá vé"]),
      mcq("Nhà vệ sinh ở tầng mấy?", "Tầng 2", ["Tầng 1", "Tầng 3"]),
      mcq("B khuyên A đi lên bằng gì?", "Thang máy", ["Thang bộ", "Xe buýt"]),
    ],
  },
  {
    title: "Đọc",
    skill: "reading",
    minutes: 4,
    passage: { title: "Đoạn văn ngắn", text: "我每天早上七点起床，八点去学校。中午在学校吃饭，下午五点回家。" },
    questions: [
      mcq("Mấy giờ người viết dậy?", "7 giờ", ["6 giờ", "8 giờ"]),
      mcq("Buổi trưa người viết ăn ở đâu?", "Ở trường", ["Ở nhà", "Ở nhà hàng"]),
      mcq("Mấy giờ chiều người viết về nhà?", "5 giờ", ["4 giờ", "6 giờ"]),
    ],
  },
  {
    title: "Viết",
    skill: "writing",
    minutes: 2,
    passage: { title: "Sắp xếp câu", text: "Chọn câu đúng ngữ pháp." },
    questions: [
      mcq("Chọn câu đúng:", "我喜欢喝茶。", ["喝茶喜欢我。", "茶我喝喜欢。"]),
      mcq("Chọn câu đúng:", "他在图书馆看书。", ["他看书在图书馆在。", "在他图书馆看书。"]),
    ],
  },
];

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL } });
  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!owner || !course) throw new Error("Thiếu giảng viên/khoá demo — chạy seed-demo-course.ts và seed-language-demo.ts trước");

  const existing = await prisma.exam.findFirst({ where: { courseId: course.id, title: TITLE } });
  if (existing) {
    console.log(`Đã có đề "${TITLE}" (${existing.id}) — bỏ qua.`);
    return;
  }
  const { examId } = await createExam(owner.id, course.id, { title: TITLE, durationMin: 9, mockMode: true });
  for (const p of PARTS) {
    const { id: sectionId } = await createSection(owner.id, examId, {
      title: p.title,
      durationMin: p.minutes,
      languageSkill: p.skill,
    });
    const { passageId } = await createPassage(owner.id, examId, { title: p.passage.title, contentJson: doc(p.passage.text) });
    for (const q of p.questions) {
      await createExamQuestion(owner.id, examId, { ...q, passageId, sectionId });
    }
  }
  await publishExam(owner.id, examId);
  console.log(`Đã tạo "${TITLE}": ${examId}`);
  console.log(`  Giảng viên: /instructor/courses/${course.id}/exams/${examId}`);
  console.log(`  Học viên (đã ghi danh khoá): vào mục Đề thi của khoá "${COURSE_SLUG}"`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
