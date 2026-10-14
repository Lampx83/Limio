import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { isInstructor } from "../auth/roles";
import { createCourse } from "../courses/courses";
import { createModule } from "../courses/modules";
import { createLesson } from "../courses/lessons";
import { createContentItem } from "../courses/contents";
import { createAssignment } from "../courses/assignments";
import { createQuiz } from "../quizzes/quizzes";
import { createQuestion } from "../quizzes/questions";
import { createExam, createExamQuestion, createPassage, createSection, publishExam } from "../exam";
import { MOCK_EXAM_TEMPLATES } from "../exam/mock-templates";
import {
  LANGUAGE_TEMPLATE_DEFS,
  type LanguageTemplateDef,
  type SampleAssignment,
  type SampleQuestion,
  type TemplateId,
} from "./samples";

export type { TemplateId } from "./samples";

/**
 * LANG G8 — tạo khoá mẫu ngoại ngữ (Tiếng Trung · Tiếng Anh) cho giảng viên.
 *
 * Mọi thứ đi qua đúng hàm dịch vụ mà giao diện đi (createCourse → createModule → createLesson →
 * createContentItem → createQuiz/createAssignment → createExam…), không INSERT tay, nên lesson-as-tag,
 * ràng buộc "ngoại ngữ ⇒ cá nhân hoá" và event đều tự đúng. Chỉ TẠO khoá mới: không đọc hay sửa khoá nào
 * khác. Kết quả là bản nháp thuộc về người gọi; đề thi thử đã xuất bản (nhưng khoá chưa, nên học viên chưa
 * thấy gì).
 */

export const LANGUAGE_TEMPLATES: readonly { id: TemplateId; label: string; hint: string }[] = (
  Object.values(LANGUAGE_TEMPLATE_DEFS) as LanguageTemplateDef[]
).map(({ id, label, hint }) => ({ id, label, hint }));

export class LanguageTemplateError extends Error {
  constructor(
    public readonly code: "forbidden" | "validation_failed",
    public readonly details?: unknown,
  ) {
    super(code);
  }
}

const Input = z.object({ template: z.enum(["zh", "en"]) });

const doc = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }],
});

async function addQuiz(
  actor: string,
  courseId: string,
  lessonId: string,
  quiz: { title: string; questions: SampleQuestion[] },
  db: PrismaClient,
) {
  const { quizId } = await createQuiz(actor, { courseId, lessonId }, { title: quiz.title, difficulty: 1 }, db);
  for (const [i, qq] of quiz.questions.entries()) {
    await createQuestion(
      actor,
      quizId,
      {
        type: "mcq",
        prompt: qq.prompt,
        explanation: qq.explanation,
        points: 1,
        orderIndex: i,
        options: qq.options.map(([label, isCorrect]) => ({ label, isCorrect })),
      },
      db,
    );
  }
}

async function addAssignment(actor: string, lessonId: string, a: SampleAssignment, db: PrismaClient) {
  await createAssignment(
    actor,
    lessonId,
    {
      title: a.title,
      description: a.description,
      rubricText: a.rubric,
      responseFormat: a.responseFormat,
      maxScore: 100,
    },
    db,
  );
}

export async function createLanguageTemplateCourse(
  actorUserId: string,
  rawInput: unknown,
  db: PrismaClient = prisma,
): Promise<{ courseId: string; slug: string; examId: string }> {
  const parsed = Input.safeParse(rawInput);
  if (!parsed.success) throw new LanguageTemplateError("validation_failed", parsed.error.flatten());
  // Cùng cửa với POST /api/courses: chỉ giảng viên (hoặc admin) mới tạo khoá.
  if (!(await isInstructor(actorUserId, db))) throw new LanguageTemplateError("forbidden");
  const def = LANGUAGE_TEMPLATE_DEFS[parsed.data.template];

  const { courseId, slug } = await createCourse(
    actorUserId,
    {
      title: def.course.title,
      description: def.course.description,
      language: def.course.language,
      level: "beginner",
      category: "Ngoại ngữ",
      personalizationEnabled: true,
      languageMode: true,
    },
    db,
  );
  const { moduleId } = await createModule(actorUserId, courseId, { title: def.moduleTitle, orderIndex: 0 }, db);

  let order = 0;
  const lesson = async (title: string, languageSkill?: "listening" | "speaking" | "reading" | "writing") => {
    const { lessonId } = await createLesson(
      actorUserId,
      moduleId,
      { title, orderIndex: order++, ...(languageSkill ? { languageSkill } : {}) },
      db,
    );
    return lessonId;
  };

  // 1. Từ vựng (không gắn kỹ năng: dùng chung cho cả bốn kỹ năng)
  const vocabId = await lesson(def.vocab.lessonTitle);
  await createContentItem(
    actorUserId,
    vocabId,
    { type: "vocab_list", orderIndex: 0, payload: { title: def.vocab.title, readingLabel: def.readingLabel, items: def.vocab.items } },
    db,
  );

  // 2. Nghe — chỉ ghi chú tải audio + quiz (không audio giả)
  const listeningId = await lesson(def.listening.lessonTitle, "listening");
  await createContentItem(actorUserId, listeningId, { type: "richtext", orderIndex: 0, payload: { html: def.listening.noteHtml } }, db);
  await addQuiz(actorUserId, courseId, listeningId, def.listening.quiz, db);

  // 3. Nói — hội thoại mẫu + bài tập ghi âm (chấm tay theo rubric tới khi G7 xong)
  const speakingId = await lesson(def.speaking.lessonTitle, "speaking");
  await createContentItem(actorUserId, speakingId, { type: "richtext", orderIndex: 0, payload: { html: def.speaking.html } }, db);
  await createContentItem(
    actorUserId,
    speakingId,
    { type: "dialogue", orderIndex: 1, payload: { ...def.speaking.dialogue, readingLabel: def.readingLabel } },
    db,
  );
  await addAssignment(actorUserId, speakingId, def.speaking.assignment, db);

  // 4. Đọc
  const readingId = await lesson(def.reading.lessonTitle, "reading");
  await createContentItem(actorUserId, readingId, { type: "richtext", orderIndex: 0, payload: { html: def.reading.html } }, db);
  await addQuiz(actorUserId, courseId, readingId, def.reading.quiz, db);

  // 5. Viết — bài tập có rubric (Feedback AI của G6 tự áp dụng vì khoá bật chế độ ngoại ngữ)
  const writingId = await lesson(def.writing.lessonTitle, "writing");
  await createContentItem(actorUserId, writingId, { type: "richtext", orderIndex: 0, payload: { html: def.writing.html } }, db);
  await addQuiz(actorUserId, courseId, writingId, def.writing.quiz, db);
  await addAssignment(actorUserId, writingId, def.writing.assignment, db);

  // Đề thi thử: lấy cấu trúc phần/kỹ năng từ khung HSK/IELTS (cùng nguồn với "Tạo từ khung").
  const frame = MOCK_EXAM_TEMPLATES.find((t) => t.id === def.exam.frame)!;
  const totalMin = def.exam.sections.reduce((a, s) => a + s.minutes, 0);
  const { examId } = await createExam(actorUserId, courseId, { title: def.exam.title, durationMin: totalMin, mockMode: true }, db);
  for (const part of def.exam.sections) {
    const fs = frame.sections.find((s) => s.languageSkill === part.skill)!;
    const { id: sectionId } = await createSection(
      actorUserId,
      examId,
      { title: fs.title, durationMin: part.minutes, languageSkill: part.skill },
      db,
    );
    const { passageId } = await createPassage(actorUserId, examId, { title: part.passage.title, contentJson: doc(part.passage.text) }, db);
    for (const qq of part.questions) {
      await createExamQuestion(
        actorUserId,
        examId,
        {
          type: "mcq",
          prompt: qq.prompt,
          passageId,
          sectionId,
          config: {
            options: qq.options.map(([label, isCorrect], i) => ({
              id: String.fromCharCode(97 + i),
              label,
              isCorrect,
            })),
          },
        },
        db,
      );
    }
  }
  await publishExam(actorUserId, examId, db);

  return { courseId, slug, examId };
}
