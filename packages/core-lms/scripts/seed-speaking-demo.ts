/**
 * Dữ liệu MẪU cho dev DB để thử góp ý bài nói (LANG G7): thêm bài tập ghi âm vào khoá demo ngoại ngữ, một học
 * viên nộp bản ghi (giọng TTS của macOS, lưu như một lần upload thật), rồi chạy ĐÚNG hàm `requestSpeakingFeedback`
 * nhưng với Whisper và mô hình chấm GIẢ (dev chưa cấu hình OpenAI). Kết quả: học viên thấy bản nháp "chưa duyệt",
 * giảng viên thấy bản chữ + bản nháp để duyệt.
 *
 *   NODE_OPTIONS=--max-old-space-size=1536 \
 *     node --env-file=../db/.env --import tsx scripts/seed-speaking-demo.ts
 *
 * Cần: khoá demo (scripts/seed-language-demo.ts). Rerun-safe. Chỉ dùng cho dev DB.
 */
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { prisma } from "@feedbackme/db";
import { createAssignment, submitAssignment } from "../src/courses/assignments";
import { recordStoredFile } from "../src/storage";
import { requestSpeakingFeedback } from "../../core-feedback/src/speaking/feedback";

const OWNER_EMAIL = "giangvien.mau@feedbackme.dev";
// SEED_LEARNER_EMAIL: học viên khác (đã ghi danh khoá demo) nếu muốn tự đăng nhập xem.
const LEARNER_EMAIL = process.env.SEED_LEARNER_EMAIL ?? "sv.demo.01@feedbackme.dev";
const COURSE_SLUG = "demo-ngoai-ngu-tieng-trung";
const TITLE = "Ghi âm: Giới thiệu bản thân (demo)";
const SPOKEN = "你好，我叫阮红。我是学生。我喜欢喝茶。我很高兴认识你。";
// Bản chữ "máy nghe được" — cố ý có lỗi để góp ý có chỗ chỉ ra.
const HEARD = "你好，我叫阮红。我是学生。我喜欢喝茶。我很高兴认识你。我去学校在每天。";

async function main() {
  const owner = await prisma.user.findUniqueOrThrow({ where: { email: OWNER_EMAIL } });
  const learner = await prisma.user.findUniqueOrThrow({ where: { email: LEARNER_EMAIL } });
  const course = await prisma.course.findUniqueOrThrow({ where: { slug: COURSE_SLUG } });
  const lesson = await prisma.lesson.findFirstOrThrow({
    where: { module: { courseId: course.id }, languageSkill: "speaking" },
  });

  let assignment = await prisma.assignment.findFirst({ where: { lessonId: lesson.id, title: TITLE } });
  if (!assignment) {
    const { assignmentId } = await createAssignment(owner.id, lesson.id, {
      title: TITLE,
      description: "Ghi âm khoảng 30 giây giới thiệu bản thân bằng tiếng Trung (tên, nghề nghiệp, sở thích).",
      responseFormat: "audio",
      rubricText:
        "Rubric Nói (100 điểm): nội dung đủ ý (30), phát âm và thanh điệu (30), từ vựng và ngữ pháp (25), lưu loát (15).",
      maxScore: 100,
    });
    assignment = await prisma.assignment.findUniqueOrThrow({ where: { id: assignmentId } });
    console.log(`+ bài tập: ${assignment.id}`);
  }

  let sub = await prisma.assignmentSubmission.findUnique({
    where: { assignmentId_userId: { assignmentId: assignment.id, userId: learner.id } },
  });
  if (!sub) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "spk-"));
    try {
      const aiff = path.join(dir, "a.aiff");
      const m4a = path.join(dir, "a.m4a");
      execFileSync("say", ["-v", "Tingting", "-r", "150", "-o", aiff, "--", SPOKEN], { stdio: "ignore" });
      execFileSync("afconvert", ["-f", "m4af", "-d", "aac", "-b", "48000", aiff, m4a], { stdio: "ignore" });
      const buf = fs.readFileSync(m4a);
      const now = new Date();
      const filename = `${learner.id}-${now.getTime()}-${randomBytes(8).toString("hex")}.m4a`;
      const key = `submissions/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${filename}`;
      const root = process.env.UPLOADS_ROOT ? path.resolve(process.env.UPLOADS_ROOT) : path.resolve(import.meta.dirname, "../../../apps/web/uploads");
      const dest = path.join(root, "private", key);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, buf);
      await recordStoredFile({ layer: "private", key, sizeBytes: buf.length, contentType: "audio/mp4", uploaderUserId: learner.id });
      await submitAssignment(learner.id, assignment.id, { body: "(bài nói)", attachmentUrl: `http://localhost:3000/api/assignment-media/${filename}` });
      console.log(`+ bài nộp của ${LEARNER_EMAIL} (${buf.length} byte)`);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
    sub = await prisma.assignmentSubmission.findUniqueOrThrow({
      where: { assignmentId_userId: { assignmentId: assignment.id, userId: learner.id } },
    });
  }

  if ((await prisma.speakingFeedback.count({ where: { submissionId: sub.id } })) === 0) {
    const r = await requestSpeakingFeedback(learner.id, sub.id, {
      loadAudio: async () => ({ buffer: Buffer.from("x"), mimeType: "audio/mp4" }),
      transcribe: async () => ({
        text: HEARD,
        durationSec: 24,
        words: Array.from({ length: 34 }, (_, i) => ({ start: 1 + i * 0.6, end: 1 + i * 0.6 + 0.4 })),
        language: "zh",
      }),
      openai: {
        chat: {
          completions: {
            create: async () => ({
              choices: [
                {
                  message: {
                    content: JSON.stringify({
                      summary: "Giới thiệu đủ ý: tên, nghề, sở thích. Câu cuối sai trật tự trạng ngữ.",
                      criteria: [
                        { key: "task", level: "good", comment: "Nêu đủ tên, nghề và sở thích." },
                        { key: "language", level: "fair", comment: "Dùng đúng mẫu câu đã học, riêng câu cuối sai trật tự." },
                        { key: "coherence", level: "good", comment: "Các câu nối tự nhiên." },
                      ],
                      errors: [
                        { category: "word_order", quote: "我去学校在每天", correction: "我每天去学校", explanation: "Trạng ngữ thời gian 每天 đứng trước động từ." },
                      ],
                      nextSteps: ["Ôn vị trí của trạng ngữ thời gian trong câu."],
                    }),
                  },
                },
              ],
              usage: { prompt_tokens: 500, completion_tokens: 300 },
            }),
          },
        },
      } as never,
    });
    console.log(`+ góp ý bài nói (nháp, dùng Whisper/mô hình GIẢ): ${r.feedbackId}`);
  }
  console.log(`Học viên: /learn/${COURSE_SLUG}/lessons/${lesson.id}  (tab Bài tập)`);
  console.log(`Giảng viên: /instructor/assignments/${assignment.id}/submissions`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
