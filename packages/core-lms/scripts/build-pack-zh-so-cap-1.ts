/**
 * Dựng và phát hành giáo trình "Tiếng Trung sơ cấp 1 (HSK 1)" (CENTER C3) từ scripts/packs/zh-so-cap-1.ts.
 *
 * Mọi thứ đi qua hàm dịch vụ thật (createCourse → createModule → createLesson → createContentItem → createQuiz →
 * createAssignment → publishCoursePack), nên lesson-as-tag, ràng buộc ngoại ngữ và event đều tự đúng.
 * Rerun-safe: khoá nguồn tìm-hoặc-tạo (theo slug); nếu khoá đã có chương thì KHÔNG dựng lại nội dung, chỉ phát hành
 * lại thông tin gói. Muốn dựng lại từ đầu thì xoá khoá nguồn trước.
 *
 *   PACK_ADMIN_EMAIL=quan.tri@example.com NODE_OPTIONS=--max-old-space-size=1536 \
 *     node --env-file=../db/.env --import tsx scripts/build-pack-zh-so-cap-1.ts
 *
 * Cần một tài khoản quản trị (role admin) đã có sẵn. Chỉ dùng cho DB đã được phép ghi.
 */

import { prisma } from "@feedbackme/db";
import { createCourse } from "../src/courses/courses";
import { createModule } from "../src/courses/modules";
import { createLesson } from "../src/courses/lessons";
import { createContentItem } from "../src/courses/contents";
import { createAssignment } from "../src/courses/assignments";
import { publishCoursePack } from "../src/courses/coursePacks";
import { createQuiz } from "../src/quizzes/quizzes";
import { createQuestion } from "../src/quizzes/questions";
import { PACK, SESSIONS } from "./packs/zh-so-cap-1";

const log = (s: string) => console.log(s);

async function main() {
  const email = process.env.PACK_ADMIN_EMAIL;
  if (!email) throw new Error("Thiếu PACK_ADMIN_EMAIL (email của tài khoản quản trị).");
  const admin = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!admin) throw new Error(`Không có tài khoản ${email}.`);
  const adminId = admin.id;

  let course = await prisma.course.findUnique({ where: { slug: PACK.courseSlug }, select: { id: true, _count: { select: { modules: true } } } });
  if (!course) {
    const c = await createCourse(adminId, {
      title: PACK.title,
      description: PACK.summary,
      slug: PACK.courseSlug,
      level: "beginner",
      category: "Ngoại ngữ",
      personalizationEnabled: true,
      languageMode: true,
    });
    course = { id: c.courseId, _count: { modules: 0 } };
    log(`✔ Tạo khoá nguồn ${PACK.courseSlug}`);
  }

  if (course._count.modules === 0) {
    for (const [i, s] of SESSIONS.entries()) {
      const m = await createModule(adminId, course.id, { title: s.title, orderIndex: i });
      const vocabLesson = await createLesson(adminId, m.moduleId, { title: `Từ vựng — ${s.title.replace(/^Buổi \d+:\s*/, "")}`, orderIndex: 0 });
      await createContentItem(adminId, vocabLesson.lessonId, {
        type: "vocab_list",
        orderIndex: 0,
        payload: { title: "Từ mới", readingLabel: "Pinyin", items: s.vocab },
      });

      const talkLesson = await createLesson(adminId, m.moduleId, { title: `Hội thoại — ${s.dialogue.title}`, orderIndex: 1 });
      await createContentItem(adminId, talkLesson.lessonId, {
        type: "dialogue",
        orderIndex: 0,
        payload: { title: s.dialogue.title, readingLabel: "Pinyin", turns: s.dialogue.turns },
      });
      await createContentItem(adminId, talkLesson.lessonId, { type: "teacher_note", orderIndex: 1, payload: { html: s.teacherNoteHtml } });

      const quiz = await createQuiz(adminId, { courseId: course.id, lessonId: talkLesson.lessonId }, { title: `Quiz cuối buổi ${i + 1}`, difficulty: 1 });
      for (const [qi, q] of s.quiz.entries()) {
        await createQuestion(adminId, quiz.quizId, {
          type: "mcq",
          prompt: q.prompt,
          explanation: q.explanation,
          points: 1,
          orderIndex: qi,
          options: [{ label: q.correct, isCorrect: true }, ...q.wrong.map((label) => ({ label, isCorrect: false }))],
        });
      }
      await createAssignment(adminId, talkLesson.lessonId, {
        title: s.homework.title,
        description: s.homework.description,
        rubricText: s.homework.rubric,
        responseFormat: "text",
        maxScore: 100,
      });
      log(`  ✔ ${s.title}`);
    }
  } else {
    log(`↺ Khoá nguồn đã có ${course._count.modules} chương, giữ nguyên nội dung.`);
  }

  const res = await publishCoursePack(adminId, course.id, {
    slug: PACK.slug,
    title: PACK.title,
    summary: PACK.summary,
    language: PACK.language,
    outcomeLevel: PACK.outcomeLevel,
  });
  log(`Xong. Gói ${PACK.slug}: ${res.sessionCount} buổi (packId ${res.packId}).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
