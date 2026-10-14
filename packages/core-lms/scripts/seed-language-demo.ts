/**
 * Dữ liệu MẪU cho dev DB để thử các tính năng ngoại ngữ (LANG G1–G4): khoá "Tiếng Trung
 * cơ bản (demo ngoại ngữ)" gồm bài nghe, từ vựng, hội thoại có audio thật, quiz theo
 * kỹ năng, flashcard và hồ sơ 4 kỹ năng.
 *
 * Mọi thứ đi qua đúng hàm dịch vụ mà UI/API đi (createCourse → … → submitAttempt →
 * updateLearnerStateFromAttempt, reviewFlashcard …), KHÔNG INSERT tay vào LearningEvent
 * hay LearnerSkillState. Rerun-safe: mỗi bước tìm-hoặc-tạo; không xoá gì.
 *
 *   NODE_OPTIONS=--max-old-space-size=1536 \
 *     node --env-file=../db/.env --import tsx scripts/seed-language-demo.ts
 *
 *   # ghi danh thêm tài khoản của bạn (học viên SẠCH, chưa có tiến độ) để thử từ đầu:
 *   SEED_ENROLL_EMAILS="ban@example.com,khac@example.com" ... (lệnh như trên)
 *
 * Cần: tài khoản giảng viên mẫu (giangvien.mau@feedbackme.dev) và học viên mẫu
 * (sv.demo.01@feedbackme.dev) đã có — tạo bởi scripts/seed-demo-course.ts.
 * Audio sinh bằng `say` + `afconvert` của macOS (giọng Mandarin); máy khác macOS thì
 * bỏ qua audio, các phần còn lại vẫn chạy.
 *
 * Chỉ dùng cho dev DB.
 */

import { execFileSync } from "node:child_process";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@feedbackme/db";
import type { FlashcardRating, LanguageSkill } from "@feedbackme/shared-types";
import { createCourse, publishCourse } from "../src/courses/courses";
import { createModule } from "../src/courses/modules";
import { createLesson, updateLesson } from "../src/courses/lessons";
import { createContentItem } from "../src/courses/contents";
import { createCourseSection } from "../src/courses/sections";
import { createQuiz } from "../src/quizzes/quizzes";
import { createQuestion } from "../src/quizzes/questions";
import { startAttempt, submitAnswer, submitAttempt } from "../src/quizzes/attempts";
import { enrollBySectionCode } from "../src/learning/enroll";
import { completeLesson, trackLessonView } from "../src/learning/lessons";
import { attributeStoredFiles, recordStoredFile } from "../src/storage";
import { onLessonCompleted, onLessonViewed, onQuizSubmitted } from "../../core-gamification/src/index";
import {
  getAverageMasteryForQuiz,
  getMasterySnapshotForAttempt,
  updateLearnerStateFromAttempt,
} from "../../core-feedback/src/learnerState";
import { generateDiagnosticFeedback } from "../../core-feedback/src/diagnostic";
import { getLanguageProfile } from "../../core-feedback/src/languageProfile";
import { getFlashcardStats, reviewFlashcard } from "../../core-feedback/src/flashcards";

// ── Hằng số ───────────────────────────────────────────────────────────────────

const OWNER_EMAIL = "giangvien.mau@feedbackme.dev";
const FOCUS_EMAIL = "sv.demo.01@feedbackme.dev";
const COURSE_SLUG = "demo-ngoai-ngu-tieng-trung";
const SECTION_NAME = "Lớp Tiếng Trung (demo)";
const DAY = 86_400_000;

const log = (s: string) => console.log(s);
const warn = (s: string) => console.warn(`⚠ ${s}`);

// ── Audio thật bằng TTS của macOS ─────────────────────────────────────────────

const VOICE_A = "Tingting";
const VOICE_B = "Eddy (Chinese (China mainland))";
let ttsDisabled = false;
let fileCounter = 0;
const audioCache = new Map<string, string>();

function uploadsRoot(): string {
  return process.env.UPLOADS_ROOT
    ? path.resolve(process.env.UPLOADS_ROOT)
    : path.resolve(import.meta.dirname, "../../../apps/web/uploads");
}

/** Sinh audio m4a cho `text` rồi lưu như một lần upload thật (đúng khoá lưu trữ + sổ dung lượng). */
async function speak(ownerId: string, text: string, voice = VOICE_A): Promise<string | undefined> {
  if (ttsDisabled) return undefined;
  const cacheKey = `${voice}|${text}`;
  if (audioCache.has(cacheKey)) return audioCache.get(cacheKey);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "tts-"));
  try {
    const aiff = path.join(dir, "a.aiff");
    const m4a = path.join(dir, "a.m4a");
    execFileSync("say", ["-v", voice, "-r", "140", "-o", aiff, "--", text], { stdio: "ignore" });
    execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "48000", aiff, m4a], { stdio: "ignore" });
    const buf = fs.readFileSync(m4a);

    const now = new Date(Date.now() + ++fileCounter); // khác nhau từng file
    const filename = `${ownerId}-${now.getTime()}-${randomBytes(8).toString("hex")}.m4a`;
    const yyyy = String(now.getUTCFullYear());
    const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
    const key = `lesson-media/audio/${yyyy}/${mm}/${filename}`;
    const dest = path.join(uploadsRoot(), "public", key);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    await recordStoredFile({ layer: "public", key, sizeBytes: buf.length, contentType: "audio/mp4", uploaderUserId: ownerId });

    const url = `/api/lesson-media/audio/${filename}`;
    audioCache.set(cacheKey, url);
    return url;
  } catch (e) {
    ttsDisabled = true;
    warn(`Không sinh được audio (cần macOS có say/afconvert). Bỏ qua audio: ${(e as Error).message}`);
    return undefined;
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ── Nội dung khoá ─────────────────────────────────────────────────────────────

interface Word {
  term: string;
  reading: string;
  meaning: string;
  example?: string;
  exampleReading?: string;
  exampleMeaning?: string;
  note?: string;
}

const VOCAB_5: Word[] = [
  { term: "你好", reading: "nǐ hǎo", meaning: "xin chào", example: "你好，我叫王明。", exampleReading: "Nǐ hǎo, wǒ jiào Wáng Míng.", exampleMeaning: "Xin chào, tôi tên là Vương Minh." },
  { term: "谢谢", reading: "xièxie", meaning: "cảm ơn", note: "Âm tiết sau đọc nhẹ." },
  { term: "不客气", reading: "bú kèqi", meaning: "không có gì (đáp lại lời cảm ơn)" },
  { term: "再见", reading: "zàijiàn", meaning: "tạm biệt" },
  { term: "朋友", reading: "péngyou", meaning: "bạn bè", example: "他是我的朋友。", exampleReading: "Tā shì wǒ de péngyou.", exampleMeaning: "Anh ấy là bạn của tôi." },
  { term: "老师", reading: "lǎoshī", meaning: "giáo viên" },
  { term: "学生", reading: "xuésheng", meaning: "học sinh, sinh viên" },
  { term: "中国", reading: "Zhōngguó", meaning: "Trung Quốc" },
  { term: "越南", reading: "Yuènán", meaning: "Việt Nam" },
  { term: "名字", reading: "míngzi", meaning: "tên" },
  { term: "认识", reading: "rènshi", meaning: "quen biết", example: "认识你很高兴。", exampleReading: "Rènshi nǐ hěn gāoxìng.", exampleMeaning: "Rất vui được quen bạn." },
  { term: "高兴", reading: "gāoxìng", meaning: "vui mừng" },
];

const VOCAB_6: Word[] = [
  { term: "家", reading: "jiā", meaning: "nhà, gia đình" },
  { term: "爸爸", reading: "bàba", meaning: "bố" },
  { term: "妈妈", reading: "māma", meaning: "mẹ" },
  { term: "哥哥", reading: "gēge", meaning: "anh trai" },
  { term: "姐姐", reading: "jiějie", meaning: "chị gái" },
  { term: "弟弟", reading: "dìdi", meaning: "em trai" },
  { term: "妹妹", reading: "mèimei", meaning: "em gái" },
  // Cố ý TRÙNG với bài 5 để thử việc gom trùng khi ôn flashcard.
  { term: "朋友", reading: "péngyou", meaning: "bạn bè", note: "Từ này cũng có ở bài 5 — flashcard chỉ cho ôn một thẻ." },
];

const VOCAB_HIDDEN: Word[] = [
  { term: "隐藏词", reading: "yǐncángcí", meaning: "từ ẩn — KHÔNG được vào bộ flashcard vì bài này đang ẩn" },
];

const DIALOGUE = [
  { speaker: "A", text: "你好！我叫王明。", reading: "Nǐ hǎo! Wǒ jiào Wáng Míng.", translation: "Xin chào! Tôi tên là Vương Minh." },
  { speaker: "B", text: "你好，我叫阮红。", reading: "Nǐ hǎo, wǒ jiào Ruǎn Hóng.", translation: "Xin chào, tôi tên là Nguyễn Hồng." },
  { speaker: "A", text: "认识你很高兴。", reading: "Rènshi nǐ hěn gāoxìng.", translation: "Rất vui được quen bạn." },
  { speaker: "B", text: "我也很高兴。你是学生吗？", reading: "Wǒ yě hěn gāoxìng. Nǐ shì xuésheng ma?", translation: "Tôi cũng rất vui. Bạn là học sinh à?" },
  { speaker: "A", text: "是，我是学生。你呢？", reading: "Shì, wǒ shì xuésheng. Nǐ ne?", translation: "Vâng, tôi là học sinh. Còn bạn?" },
  { speaker: "B", text: "我是老师。再见！", reading: "Wǒ shì lǎoshī. Zàijiàn!", translation: "Tôi là giáo viên. Tạm biệt!" },
];

const LISTENING_CLIP =
  "老师：同学们好！学生：老师好！老师：今天我们学习新课。请打开书。";

interface Q {
  prompt: string;
  options: Array<[string, boolean]>;
  explanation: string;
}
const q = (prompt: string, right: string, wrong: string[], explanation: string): Q => ({
  prompt,
  options: [[right, true], ...wrong.map((w): [string, boolean] => [w, false])],
  explanation,
});

const QUIZ_LISTENING_5: Q[] = [
  q("Trong hội thoại bài 5, ai là giáo viên?", "阮红 (người B)", ["王明 (người A)", "Cả hai người", "Không ai cả"], "Người B nói “我是老师”."),
  q("Người A tên là gì?", "王明", ["阮红", "老师", "朋友"], "Người A mở đầu bằng “我叫王明”."),
  q("Người B hỏi người A điều gì?", "Bạn có phải học sinh không?", ["Bạn tên là gì?", "Bạn là người nước nào?", "Bạn mấy tuổi?"], "“你是学生吗？” là câu hỏi có/không với 吗."),
  q("Hai người chào nhau bằng câu nào?", "你好", ["再见", "谢谢", "不客气"], "Cả hai mở đầu bằng “你好”."),
  q("Câu cuối cùng của hội thoại là gì?", "再见", ["你好", "认识你很高兴", "你是学生吗"], "Người B kết thúc bằng “再见”."),
];
const QUIZ_LISTENING_6: Q[] = [
  q("爸爸 nghĩa là gì?", "bố", ["mẹ", "anh trai", "em gái"], "爸爸 (bàba) là bố."),
  q("“Chị gái” trong tiếng Trung là gì?", "姐姐", ["妹妹", "哥哥", "弟弟"], "姐姐 (jiějie) là chị gái."),
  q("妈妈 đọc là gì?", "māma", ["bàba", "gēge", "dìdi"], "妈妈 đọc là māma."),
];
const QUIZ_READING: Q[] = [
  q("阮红是哪国人？ (Nguyễn Hồng là người nước nào?)", "越南人", ["中国人", "老师", "学生"], "Đoạn văn: “我是越南人”."),
  q("阮红的工作是什么？", "老师", ["学生", "朋友", "越南"], "Đoạn văn: “我是老师”."),
  q("王明是谁？", "阮红的朋友", ["阮红的老师", "阮红的学生", "阮红的哥哥"], "Đoạn văn: “我的朋友叫王明”."),
  q("王明是哪国人？", "中国人", ["越南人", "不知道", "老师"], "Đoạn văn: “他是中国学生”."),
  q("阮红的朋友是老师吗？", "不是，是学生", ["是老师", "是爸爸", "是朋友的老师"], "Đoạn văn: “他是中国学生”."),
];
const QUIZ_WRITING: Q[] = [
  q("Câu nào đúng ngữ pháp?", "我是学生。", ["我学生是。", "是我学生。", "学生我是。"], "Trật tự câu: Chủ ngữ + 是 + danh từ."),
  q("Điền vào chỗ trống: 我___老师。", "是", ["有", "在", "不"], "Dùng 是 để nối chủ ngữ với danh từ."),
  q("“Bạn tên là gì?” viết thế nào?", "你叫什么名字？", ["你什么叫名字？", "什么你叫名字？", "你名字叫什么吗？"], "Cấu trúc: 你叫什么名字？"),
  q("“Tôi không phải giáo viên.” viết thế nào?", "我不是老师。", ["我是不老师。", "我不老师是。", "不我是老师。"], "Phủ định của 是 đặt 不 ngay trước 是."),
];

const PASSAGE_HTML =
  "<h2>Đọc đoạn văn</h2><p>我叫阮红。我是越南人。我是老师。我的朋友叫王明，他是中国学生。</p>" +
  "<p><em>Nǐ hǎo! Wǒ jiào Ruǎn Hóng…</em> Đọc kỹ rồi làm bài đọc hiểu bên dưới.</p>";
const WRITING_HTML =
  "<h2>Viết câu đơn giản</h2><p>Mẫu câu: <strong>Chủ ngữ + 是 + danh từ</strong>. Ví dụ: 我是学生。 Phủ định: 我<strong>不</strong>是老师。</p>";
const SPEAKING_HTML =
  "<h2>Luyện phát âm</h2><p>Nghe và đọc theo bốn thanh điệu: mā, má, mǎ, mà. Bài này <strong>chưa có bài kiểm tra</strong>, " +
  "nên kỹ năng Nói sẽ hiện “Chưa đủ dữ liệu” trên hồ sơ — đúng với cách hệ thống xử lý kỹ năng chưa có dữ liệu.</p>";

interface LessonDef {
  title: string;
  skill: LanguageSkill | null;
  hidden?: boolean;
  quiz?: { title: string; questions: Q[] };
  build: (ownerId: string, lessonId: string) => Promise<void>;
}

async function wordsPayload(ownerId: string, title: string, words: Word[], withAudio: boolean) {
  const items = [];
  for (const w of words) {
    const audioUrl = withAudio ? await speak(ownerId, w.term) : undefined;
    items.push({ ...w, ...(audioUrl ? { audioUrl } : {}) });
  }
  return { title, readingLabel: "Pinyin", items };
}

const LESSONS: Array<{ module: string; lessons: LessonDef[] }> = [
  {
    module: "Bài 5 — Làm quen và chào hỏi",
    lessons: [
      {
        title: "Từ mới bài 5",
        skill: null,
        build: async (o, id) => {
          await createContentItem(o, id, { type: "vocab_list", orderIndex: 0, payload: await wordsPayload(o, "Từ mới bài 5", VOCAB_5, true) });
        },
      },
      {
        title: "Nghe: Hội thoại bài 5",
        skill: "listening",
        quiz: { title: "Nghe hiểu — hội thoại bài 5", questions: QUIZ_LISTENING_5 },
        build: async (o, id) => {
          const turns = [];
          for (const [i, t] of DIALOGUE.entries()) {
            const audioUrl = await speak(o, t.text, i % 2 === 0 ? VOICE_A : VOICE_B);
            turns.push({ ...t, ...(audioUrl ? { audioUrl } : {}) });
          }
          const whole = await speak(o, DIALOGUE.map((t) => t.text).join(" "));
          await createContentItem(o, id, {
            type: "dialogue",
            orderIndex: 0,
            payload: {
              title: "Hội thoại bài 5: Làm quen",
              caption: "Nghe cả đoạn một lần, rồi nghe từng câu. Bật/tắt bản dịch ở nút “Bản dịch”.",
              readingLabel: "Pinyin",
              ...(whole ? { audioUrl: whole } : {}),
              turns,
            },
          });
          const clip = await speak(o, LISTENING_CLIP);
          if (clip) {
            await createContentItem(o, id, {
              type: "audio",
              orderIndex: 1,
              payload: {
                url: clip,
                title: "Bài nghe hiểu: Trong lớp học",
                caption: "Nghe rồi trả lời câu hỏi. Lời thoại bị ẩn với học viên vì đây là bài nghe hiểu.",
                transcript: LISTENING_CLIP,
                showTranscript: false,
              },
            });
          }
        },
      },
      {
        title: "Đọc: Giới thiệu bản thân",
        skill: "reading",
        quiz: { title: "Đọc hiểu — giới thiệu bản thân", questions: QUIZ_READING },
        build: async (o, id) => {
          await createContentItem(o, id, { type: "richtext", orderIndex: 0, payload: { html: PASSAGE_HTML } });
        },
      },
      {
        title: "Viết: Câu đơn giản",
        skill: "writing",
        quiz: { title: "Viết — câu với 是", questions: QUIZ_WRITING },
        build: async (o, id) => {
          await createContentItem(o, id, { type: "richtext", orderIndex: 0, payload: { html: WRITING_HTML } });
        },
      },
      {
        title: "Nói: Luyện phát âm",
        skill: "speaking",
        build: async (o, id) => {
          await createContentItem(o, id, { type: "richtext", orderIndex: 0, payload: { html: SPEAKING_HTML } });
        },
      },
    ],
  },
  {
    module: "Bài 6 — Gia đình",
    lessons: [
      {
        title: "Từ mới bài 6",
        skill: null,
        build: async (o, id) => {
          await createContentItem(o, id, { type: "vocab_list", orderIndex: 0, payload: await wordsPayload(o, "Từ mới bài 6", VOCAB_6, true) });
        },
      },
      {
        title: "Nghe: Gia đình",
        skill: "listening",
        quiz: { title: "Nghe — từ vựng gia đình", questions: QUIZ_LISTENING_6 },
        build: async (o, id) => {
          const url = await speak(o, "爸爸，妈妈，哥哥，姐姐，弟弟，妹妹。");
          if (url) {
            await createContentItem(o, id, {
              type: "audio",
              orderIndex: 0,
              payload: { url, title: "Nghe và nhắc lại: các thành viên trong gia đình", transcript: "爸爸，妈妈，哥哥，姐姐，弟弟，妹妹。" },
            });
          } else {
            await createContentItem(o, id, { type: "richtext", orderIndex: 0, payload: { html: "<p>Bài nghe (không có audio trên máy này).</p>" } });
          }
        },
      },
      {
        title: "Bài ẩn (thử nghiệm)",
        skill: null,
        hidden: true,
        build: async (o, id) => {
          await createContentItem(o, id, { type: "vocab_list", orderIndex: 0, payload: await wordsPayload(o, "Từ trong bài ẩn", VOCAB_HIDDEN, false) });
        },
      },
    ],
  },
];

// ── Dựng khoá ─────────────────────────────────────────────────────────────────

async function ensureCourse(ownerId: string) {
  let course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG }, select: { id: true, status: true } });
  if (!course) {
    const c = await createCourse(ownerId, {
      title: "Tiếng Trung cơ bản (demo ngoại ngữ)",
      description:
        "Khoá mẫu để thử các tính năng ngoại ngữ: bài nghe, từ vựng, hội thoại có audio, hồ sơ 4 kỹ năng và flashcard. Dữ liệu giả, chỉ dùng trên dev.",
      slug: COURSE_SLUG,
      level: "beginner",
      category: "Ngoại ngữ",
      personalizationEnabled: true,
      languageMode: true,
    });
    course = { id: c.courseId, status: "draft" };
    log(`✔ Tạo khoá ${COURSE_SLUG}`);
  }
  return course;
}

async function ensureContent(ownerId: string, courseId: string) {
  const lessonIds = new Map<string, { id: string; quizId?: string }>();
  for (const [mi, m] of LESSONS.entries()) {
    let mod = await prisma.module.findFirst({ where: { courseId, title: m.module }, select: { id: true } });
    if (!mod) {
      const c = await createModule(ownerId, courseId, { title: m.module, orderIndex: mi });
      mod = { id: c.moduleId };
    }
    for (const [li, l] of m.lessons.entries()) {
      let lesson = await prisma.lesson.findFirst({ where: { moduleId: mod.id, title: l.title }, select: { id: true } });
      if (!lesson) {
        const c = await createLesson(ownerId, mod.id, {
          title: l.title,
          orderIndex: li,
          ...(l.skill ? { languageSkill: l.skill } : {}),
        });
        lesson = { id: c.lessonId };
        if (l.hidden) await updateLesson(ownerId, lesson.id, { isHidden: true });
      }
      if ((await prisma.contentItem.count({ where: { lessonId: lesson.id } })) === 0) {
        await l.build(ownerId, lesson.id);
        log(`  + ${l.title}`);
      }
      let quiz = await prisma.quiz.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
      if (!quiz && l.quiz) {
        const created = await createQuiz(ownerId, { courseId, lessonId: lesson.id }, { title: l.quiz.title, difficulty: 2 });
        for (const [qi, qq] of l.quiz.questions.entries()) {
          await createQuestion(ownerId, created.quizId, {
            type: "mcq",
            prompt: qq.prompt,
            explanation: qq.explanation,
            points: 1,
            orderIndex: qi,
            options: qq.options.map(([label, isCorrect]) => ({ label, isCorrect })),
          });
        }
        quiz = { id: created.quizId };
      }
      lessonIds.set(l.title, { id: lesson.id, quizId: quiz?.id });
    }
  }
  return lessonIds;
}

// ── Học viên ──────────────────────────────────────────────────────────────────

async function ensureSection(ownerId: string, courseId: string) {
  let s = await prisma.courseSection.findFirst({ where: { courseId, name: SECTION_NAME }, select: { id: true, inviteCode: true } });
  if (!s) {
    const c = await createCourseSection(ownerId, courseId, { name: SECTION_NAME, description: "Lớp demo ngoại ngữ" });
    s = { id: c.id, inviteCode: c.inviteCode };
  }
  return s as { id: string; inviteCode: string };
}

async function enroll(email: string, courseId: string, inviteCode: string): Promise<string | null> {
  const user = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (!user) {
    warn(`Không có tài khoản ${email} — bỏ qua ghi danh.`);
    return null;
  }
  const already = await prisma.enrollment.findUnique({ where: { userId_courseId: { userId: user.id, courseId } }, select: { id: true } });
  if (!already) {
    await enrollBySectionCode(user.id, inviteCode, prisma, { skipPaymentCheck: true });
    log(`✔ Ghi danh ${email}`);
  }
  return user.id;
}

/** Làm quiz bằng đường thật (cùng chuỗi xử lý với route nộp bài), `outcomes[i]` = câu i đúng hay sai. */
async function takeQuiz(userId: string, courseId: string, quizId: string, outcomes: boolean[]) {
  const { attemptId, created } = await startAttempt(userId, quizId);
  if (created) {
    // Chống "speed run": lùi giờ bắt đầu để lượt làm trông như thật.
    await prisma.quizAttempt.update({ where: { id: attemptId }, data: { startedAt: new Date(Date.now() - 240_000) } });
  }
  const questions = await prisma.quizQuestion.findMany({ where: { quizId }, orderBy: { orderIndex: "asc" }, include: { options: true } });
  for (const [i, qn] of questions.entries()) {
    const ok = outcomes[i] ?? true;
    const options = ok ? qn.options.filter((o) => o.isCorrect) : qn.options.filter((o) => !o.isCorrect).slice(0, 1);
    await submitAnswer(userId, attemptId, { questionId: qn.id, response: options.map((o) => o.id), confidence: ok ? 4 : 2 });
  }
  const result = await submitAttempt(userId, attemptId);
  const avgMastery = await getAverageMasteryForQuiz(userId, result.quizId);
  await onQuizSubmitted({
    userId, courseId, attemptId: result.attemptId, quizId: result.quizId, difficulty: result.difficulty,
    isFirstPass: result.isFirstPass, elapsedSec: result.elapsedSec, scorePct: result.scorePct, avgMastery,
  });
  const snapshot = await getMasterySnapshotForAttempt(userId, result.attemptId);
  await generateDiagnosticFeedback(userId, result.attemptId, undefined, { masterySnapshot: snapshot });
  await updateLearnerStateFromAttempt(userId, result.attemptId);
}

async function studyLesson(userId: string, courseId: string, lesson: { id: string; quizId?: string }, outcomes: boolean[]) {
  const had = lesson.quizId
    ? await prisma.quizAttempt.count({ where: { userId, quizId: lesson.quizId, status: "submitted" } })
    : 1;
  await trackLessonView(userId, lesson.id, { positionSec: 0 });
  await onLessonViewed({ userId, courseId });
  if (lesson.quizId && had === 0) await takeQuiz(userId, courseId, lesson.quizId, outcomes);
  const c = await completeLesson(userId, lesson.id, "marked_complete");
  if (c.newlyCompleted) await onLessonCompleted({ userId, courseId, lessonId: lesson.id });
}

/**
 * Tiến độ cho học viên mẫu để hồ sơ 4 kỹ năng có đủ các nhãn:
 *   Nghe → Cần ôn · Đọc → Vững · Viết → Nên luyện · Nói → Chưa đủ dữ liệu.
 */
async function seedProgress(userId: string, courseId: string, lessons: Map<string, { id: string; quizId?: string }>) {
  const L = (t: string) => lessons.get(t)!;
  await studyLesson(userId, courseId, L("Nghe: Hội thoại bài 5"), [false, false, true, false, false]);
  await studyLesson(userId, courseId, L("Nghe: Gia đình"), [false, true, false]);
  await studyLesson(userId, courseId, L("Đọc: Giới thiệu bản thân"), [true, true, true, true, true]);
  const writing = L("Viết: Câu đơn giản");
  await studyLesson(userId, courseId, writing, [true, true, true, false]);
  // Lượt 1 chỉ có 4 câu — chưa đủ 5 lượt trả lời để hiện nhãn. Làm lại một lần, kết quả
  // lẫn lộn, để Viết dừng ở giữa dải "Nên luyện" (mô phỏng BKT: ~0.70).
  if (writing.quizId && (await prisma.quizAttempt.count({ where: { userId, quizId: writing.quizId, status: "submitted" } })) === 1) {
    await takeQuiz(userId, courseId, writing.quizId, [false, true, false, true]);
  }
}

/** Ôn thẻ qua `reviewFlashcard` thật, với giờ ôn lùi về quá khứ để có đủ trạng thái. */
async function seedFlashcards(userId: string, courseId: string) {
  if ((await prisma.flashcardState.count({ where: { userId, courseId } })) > 0) return;

  const blocks = await prisma.contentItem.findMany({
    where: { type: "vocab_list", lesson: { module: { courseId } } },
    select: { payload: true },
  });
  const idOf = new Map<string, string>();
  for (const b of blocks) {
    for (const it of ((b.payload as { items?: Array<{ id: string; term: string }> }).items ?? [])) {
      if (!idOf.has(it.term)) idOf.set(it.term, it.id);
    }
  }

  const plans: Array<[string, number, FlashcardRating[]]> = [
    ["你好", 60, ["good", "good", "easy", "easy"]], // Nhớ lâu
    ["谢谢", 20, ["good", "good", "good"]], // Đang học, chưa đến hạn
    ["朋友", 25, ["good", "again", "good", "again", "good"]], // Hay quên (2 lần quên)
    ["再见", 4, ["good"]], // đến hạn
    ["老师", 3, ["hard"]], // đến hạn
    ["学生", 8, ["good", "good"]], // đến hạn
    ["中国", 1, ["easy"]], // chưa đến hạn
    ["不客气", 12, ["again", "good", "hard"]],
  ];
  for (const [term, startDaysAgo, ratings] of plans) {
    const itemId = idOf.get(term);
    if (!itemId) continue;
    let when = new Date(Date.now() - startDaysAgo * DAY);
    for (const rating of ratings) {
      const res = await reviewFlashcard(userId, courseId, { itemId, rating, mode: "term_to_meaning", reviewId: randomUUID() }, when);
      // Lần ôn sau vào 9 giờ sáng ngày đến hạn, nhưng không vượt hiện tại.
      when = new Date(Math.min(res.state.dueAt.getTime() + 9 * 3_600_000, Date.now() - 3_600_000));
    }
  }
  log("✔ Lịch sử ôn flashcard cho học viên mẫu");
}

// ── Chạy ──────────────────────────────────────────────────────────────────────

async function main() {
  const owner = await prisma.user.findUnique({ where: { email: OWNER_EMAIL }, select: { id: true } });
  if (!owner) throw new Error(`Chưa có ${OWNER_EMAIL}. Chạy scripts/seed-demo-course.ts trước.`);

  const course = await ensureCourse(owner.id);
  const lessons = await ensureContent(owner.id, course.id);
  if (course.status !== "published") {
    await publishCourse(owner.id, course.id);
    log("✔ Đã xuất bản khoá");
  }

  const section = await ensureSection(owner.id, course.id);
  const focusId = await enroll(FOCUS_EMAIL, course.id, section.inviteCode);
  const extra = (process.env.SEED_ENROLL_EMAILS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  for (const email of extra) await enroll(email, course.id, section.inviteCode);

  if (focusId) {
    await seedProgress(focusId, course.id, lessons);
    await seedFlashcards(focusId, course.id);

    const profile = await getLanguageProfile(focusId, course.id, "instructor");
    const stats = await getFlashcardStats(focusId, course.id);
    log("\n── Hồ sơ 4 kỹ năng của sv.demo.01 ──");
    for (const s of profile.skills) {
      log(`  ${s.skill.padEnd(10)} ${s.label.padEnd(14)} bằng chứng=${s.evidence} mastery=${s.mastery === null ? "—" : s.mastery!.toFixed(2)}`);
    }
    log(`  Gợi ý: ${profile.suggestion ? `${profile.suggestion.skill} → ${profile.suggestion.lessonTitle} (${profile.suggestion.reason})` : "không"}`);
    log("── Flashcard ──");
    log(`  tổng ${stats.total} · đã học ${stats.learned} · đến hạn ${stats.dueToday} · hay quên ${stats.struggling} · mới còn ${stats.newAvailable}`);
    log(`  phân bố: mới ${stats.distribution.new} / đang học ${stats.distribution.learning} / nhớ lâu ${stats.distribution.mature}`);
  }

  // Gán dung lượng file audio về đúng chủ khoá (việc tác vụ nền vẫn làm định kỳ).
  const attributed = await attributeStoredFiles();
  log(`✔ Gán dung lượng theo khoá: ${attributed.attributed} file`);

  log(`\nXong. Khoá: /learn/${COURSE_SLUG} · giảng viên: /instructor/courses/${course.id}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
