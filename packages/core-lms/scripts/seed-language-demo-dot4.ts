/**
 * Dữ liệu MẪU bổ sung cho dev DB để thử Limio Language đợt 1–4 trong một lần đăng nhập, trên khoá "Tiếng Trung cơ bản
 * (demo ngoại ngữ)" của scripts/seed-language-demo.ts:
 *
 *  - Thư viện giáo trình: bật `inLibrary` kèm nhà xuất bản/tác giả/ấn bản/trình độ/kỹ năng; một bài đặt "Cho xem thử"
 *    để thẻ có nút Preview.
 *  - Hai khoá ngoại ngữ khác của dev DB (hsk-4-nghe, tieng-trung-so-cap-1) cũng vào thư viện để lưới có thẻ "Khám phá
 *    thêm"; khoá "tieng-trung-so-cap-1" có một bài xem thử đầu tiên (nút Preview).
 *  - Thanh bài: thời lượng (durationSec) cho các bài chưa khai báo.
 *  - Bài luyện: khối "Bài luyện" trỏ tới đề "Thi thử HSK 3 (demo)" trong bài "Đọc: Giới thiệu bản thân".
 *  - Bài nghe có lời thoại 3 đoạn (để thấy đánh số ①②③): thêm bài "Nghe: Đi chợ (demo lời thoại nhiều đoạn)".
 *  - Mục tiêu học tập và một câu luyện làm sai của học viên mẫu (để thấy thẻ Mục tiêu và "Câu luyện nên làm lại").
 *
 * Mọi thứ đi qua hàm dịch vụ thật; KHÔNG INSERT tay vào LearningEvent. Rerun-safe: tìm-hoặc-tạo, không xoá gì.
 *
 *   node --env-file=../db/.env --import tsx scripts/seed-language-demo-dot4.ts
 *
 * Cần đã chạy scripts/seed-language-demo.ts và có đề thi thử "Thi thử HSK 3 (demo)". Chỉ dùng cho dev DB.
 */

import { prisma } from "@feedbackme/db";
import { updateCourseLibraryMeta } from "../src/language/library";
import { createLesson } from "../src/courses/lessons";
import { createContentItem } from "../src/courses/contents";
import { setGoal } from "../src/courses/learnerGoals";
import { checkPracticeAnswer, completePracticeSession, getPracticeSession, savePracticeAnswer, startPracticeSession } from "../src/exam";

const COURSE_SLUG = "demo-ngoai-ngu-tieng-trung";
const EXAM_TITLE = "Thi thử HSK 3 (demo)";
const NEW_LESSON_TITLE = "Nghe: Đi chợ (demo lời thoại nhiều đoạn)";
const TRANSCRIPT = [
  "A：你好，苹果多少钱一斤？\nB：五块钱一斤。",
  "A：我要两斤。\nB：好的，一共十块钱。",
  "A：给你钱。\nB：谢谢，欢迎下次再来！",
].join("\n\n");

async function main() {
  const course = await prisma.course.findUnique({
    where: { slug: COURSE_SLUG },
    select: {
      id: true,
      inLibrary: true,
      modules: {
        orderBy: { orderIndex: "asc" },
        select: {
          id: true,
          lessons: { orderBy: { orderIndex: "asc" }, select: { id: true, title: true, durationSec: true, previewable: true, contentItems: { select: { id: true, type: true, payload: true } } } },
        },
      },
    },
  });
  if (!course) throw new Error(`Chưa có khoá ${COURSE_SLUG}: chạy scripts/seed-language-demo.ts trước.`);
  const owner = await prisma.courseInstructor.findFirst({ where: { courseId: course.id, role: "owner" }, select: { userId: true } });
  if (!owner) throw new Error("Khoá không có chủ khoá");
  const learner = await prisma.user.findUnique({ where: { email: "sv.demo.01@feedbackme.dev" }, select: { id: true } });
  const exam = await prisma.exam.findFirst({ where: { courseId: course.id, title: EXAM_TITLE, mockMode: true, status: "published" }, select: { id: true } });
  const log = (m: string) => console.log("•", m);

  // 1. Thư viện giáo trình.
  if (!course.inLibrary) {
    await updateCourseLibraryMeta(owner.userId, course.id, {
      inLibrary: true,
      publisher: "Limio Demo",
      authors: "Giảng viên Mẫu",
      edition: "Bản 2026",
      levelBand: "A1-A2",
      focusTags: ["listening", "reading", "vocabulary"],
    });
    log("đã đưa khoá vào Thư viện giáo trình");
  }

  // 1b. Hai khoá khác vào thư viện (nếu có và đủ điều kiện: đã xuất bản, mở ghi danh tự do).
  const others: Array<{ slug: string; meta: Parameters<typeof updateCourseLibraryMeta>[2]; previewFirstLesson?: boolean }> = [
    { slug: "hsk-4-nghe", meta: { inLibrary: true, publisher: "Limio Demo", edition: "Bộ đề 2026", levelBand: "B1", focusTags: ["listening"] } },
    { slug: "tieng-trung-so-cap-1", meta: { inLibrary: true, publisher: "Oxford", authors: "Nhóm biên soạn", edition: "Second Edition", levelBand: "A1", focusTags: ["reading", "writing", "vocabulary"] }, previewFirstLesson: true },
  ];
  for (const o of others) {
    const c = await prisma.course.findUnique({
      where: { slug: o.slug },
      select: { id: true, inLibrary: true, status: true, enrollMode: true, modules: { orderBy: { orderIndex: "asc" }, take: 1, select: { lessons: { where: { isHidden: false }, orderBy: { orderIndex: "asc" }, take: 1, select: { id: true, previewable: true } } } } },
    });
    if (!c || c.status !== "published" || c.enrollMode !== "open") continue;
    const own = await prisma.courseInstructor.findFirst({ where: { courseId: c.id, role: "owner" }, select: { userId: true } });
    if (!own) continue;
    if (!c.inLibrary) {
      await updateCourseLibraryMeta(own.userId, c.id, o.meta);
      log(`đã đưa khoá ${o.slug} vào Thư viện giáo trình`);
    }
    const first = c.modules[0]?.lessons[0];
    if (o.previewFirstLesson && first && !first.previewable) {
      await prisma.lesson.update({ where: { id: first.id }, data: { previewable: true } });
      log(`đã đặt bài đầu của ${o.slug} là bài xem thử`);
    }
  }

  const lessons = course.modules.flatMap((m) => m.lessons);
  const byTitle = (t: string) => lessons.find((l) => l.title === t);

  // 2. Một bài xem thử để thẻ có nút Preview.
  const preview = byTitle("Từ mới bài 5");
  if (preview && !preview.previewable) {
    await prisma.lesson.update({ where: { id: preview.id }, data: { previewable: true } });
    log('đã đặt "Từ mới bài 5" là bài xem thử');
  }

  // 3. Thời lượng cho thanh bài (chỉ bài chưa khai báo).
  let dur = 0;
  for (const l of lessons) {
    if (l.durationSec === null) {
      await prisma.lesson.update({ where: { id: l.id }, data: { durationSec: l.title.startsWith("Từ mới") ? 420 : 780 } });
      dur++;
    }
  }
  if (dur) log(`đã khai báo thời lượng cho ${dur} bài`);

  // 4. Khối Bài luyện.
  const reading = byTitle("Đọc: Giới thiệu bản thân");
  if (exam && reading && !reading.contentItems.some((c) => c.type === "exam_practice")) {
    await createContentItem(owner.userId, reading.id, {
      type: "exam_practice",
      payload: { examId: exam.id, title: "Luyện đọc HSK" },
      orderIndex: reading.contentItems.length,
    });
    log('đã thêm khối "Bài luyện" vào bài "Đọc: Giới thiệu bản thân"');
  } else if (!exam) {
    log(`BỎ QUA Bài luyện: không thấy đề đã xuất bản "${EXAM_TITLE}"`);
  }

  // 5. Bài nghe có lời thoại nhiều đoạn.
  const family = byTitle("Nghe: Gia đình");
  const familyAudio = family?.contentItems.find((c) => c.type === "audio");
  const audioUrl = (familyAudio?.payload as { url?: string } | undefined)?.url;
  if (!byTitle(NEW_LESSON_TITLE) && audioUrl) {
    const lastModule = course.modules.at(-1)!;
    const created = await createLesson(owner.userId, lastModule.id, {
      title: NEW_LESSON_TITLE,
      orderIndex: lastModule.lessons.length + 1,
      languageSkill: "listening",
    });
    await prisma.lesson.update({ where: { id: created.lessonId }, data: { durationSec: 300 } });
    await createContentItem(owner.userId, created.lessonId, {
      type: "audio",
      payload: { url: audioUrl, title: "Đi chợ", transcript: TRANSCRIPT },
      orderIndex: 0,
    });
    log(`đã thêm bài "${NEW_LESSON_TITLE}"`);
  }

  // 6. Học viên mẫu: mục tiêu và một câu luyện làm sai.
  if (learner) {
    const hasGoal = await prisma.learnerGoal.findFirst({ where: { userId: learner.id, courseId: course.id, status: "active" }, select: { id: true } });
    if (!hasGoal) {
      const day = new Date(Date.now() + 75 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      await setGoal(learner.id, { courseId: course.id, framework: "HSK", targetLevel: "HSK 3", targetDate: day, hoursPerWeek: 4 });
      log("đã đặt mục tiêu HSK 3 cho sv.demo.01");
    }
    if (exam) {
      const wrongBefore = await prisma.examPracticeAnswer.count({ where: { session: { userId: learner.id, examId: exam.id }, isCorrect: false } });
      if (wrongBefore === 0) {
        const { sessionId } = await startPracticeSession(learner.id, exam.id, { all: true });
        const s = await getPracticeSession(learner.id, sessionId);
        const q = s.questions.find((x) => x.type === "mcq");
        const wrong = (q?.config as { options?: Array<{ id: string }> } | undefined)?.options?.[1]?.id;
        if (q && wrong) {
          await savePracticeAnswer(learner.id, sessionId, q.id, { optionIds: [wrong] });
          await checkPracticeAnswer(learner.id, sessionId, q.id);
        }
        await completePracticeSession(learner.id, sessionId);
        log('đã tạo một câu luyện làm sai cho sv.demo.01 (hiện ở "Câu luyện nên làm lại")');
      }
    }
  }
  console.log("Xong. Rerun an toàn.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
