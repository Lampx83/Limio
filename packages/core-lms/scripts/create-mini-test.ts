/**
 * Tạo mini-test cuối bài (Quiz gắn vào bài) từ một tệp JSON, bằng đúng `createQuiz`/`createQuestion` của hệ thống
 * (câu hỏi tự mang chủ đề của bài). Xem docs/tieu-chi/mini-test-cuoi-bai.md.
 *
 *   pnpm create:mini-test -- --owner gv@example.com --spec mini-test.json [--apply] [--replace]
 *
 * Tệp JSON: { lessonId, title, description?, timeLimitSec, questions: [{ type, prompt, explanation?, options?, extra?, audioFrom?, listen? }] }
 *   - `audioFrom`: tiền tố tên khối hội thoại của bài ("课文1A"); script gắn `extra.audioUrl` = audio cả đoạn của khối đó.
 *   - `listen`: { script: [{ who, line }], question?: "问：…" } — kịch bản câu nghe kiểu đề HSK (hội thoại ngắn, rồi người dẫn đọc câu hỏi).
 *     Thêm `--audio` (cần OPENAI_API_KEY) thì đọc bằng OpenAI TTS (giọng nhân vật theo --voices, người dẫn "旁白"), ghép các lượt cách 0,6 giây
 *     và câu hỏi cách 1,2 giây, ghi vào kho audio bài học, gắn `extra.audioUrl`. Audio đã sinh nhớ trong --audio-cache (theo nội dung) nên chạy lại không tốn thêm.
 * Không có --apply thì chỉ kiểm tra và in tóm tắt. Bài đã có quiz cùng tên thì dừng, trừ khi có --replace (xoá quiz cũ rồi tạo lại).
 * Mini-test không xáo thứ tự câu (giữ phần nghe, đọc, viết như đề HSK), không bắt chấm độ tự tin, điểm lấy lượt mới nhất, làm lại không giới hạn.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { encodeMp3, type Pcm } from "../src/narration/audio";
import { createQuestion, createQuiz, deleteQuiz } from "../src/quizzes";
import { openAiSpeechPcm, sentenceInstructionsFor, trimSilence } from "./openai-tts";
import { lessonAudioStore } from "./vocab-audio";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface SpecQuestion {
  type: string;
  prompt: string;
  explanation?: string;
  options?: unknown[];
  extra?: Record<string, unknown>;
  audioFrom?: string;
  listen?: { script: Array<{ who: string; line: string }>; question?: string };
}
interface Spec {
  lessonId: string;
  title: string;
  description?: string;
  timeLimitSec: number;
  questions: SpecQuestion[];
}

const NARRATOR = "旁白";
const TURN_GAP_SEC = 0.6;
const QUESTION_GAP_SEC = 1.2;

function joinClips(clips: Array<{ pcm: Pcm; gapAfterSec: number }>): Pcm {
  const rate = clips[0]!.pcm.sampleRate;
  const total = clips.reduce((n, c, i) => n + c.pcm.samples.length + (i < clips.length - 1 ? Math.round(rate * c.gapAfterSec) : 0), 0);
  const out = new Int16Array(total);
  let pos = 0;
  clips.forEach((c, i) => {
    out.set(c.pcm.samples, pos);
    pos += c.pcm.samples.length + (i < clips.length - 1 ? Math.round(rate * c.gapAfterSec) : 0);
  });
  return { sampleRate: rate, samples: out };
}

async function main() {
  const email = arg("owner");
  const specPath = arg("spec");
  if (!email || !specPath) throw new Error("Cần --owner <email> và --spec <tệp.json>");
  const apply = process.argv.includes("--apply");
  const replace = process.argv.includes("--replace");
  const spec = JSON.parse(readFileSync(specPath, "utf8")) as Spec;

  const owner = await prisma.user.findFirst({ where: { email }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy người dùng ${email}`);
  const lesson = await prisma.lesson.findUnique({
    where: { id: spec.lessonId },
    select: { title: true, module: { select: { courseId: true } }, contentItems: { where: { type: "dialogue" }, select: { payload: true } } },
  });
  if (!lesson) throw new Error(`Không thấy bài ${spec.lessonId}`);
  const courseId = lesson.module.courseId;

  const audioOf = (prefix: string): string => {
    const hit = lesson.contentItems
      .map((c) => c.payload as { title?: string; audioUrl?: string })
      .find((p) => typeof p.title === "string" && p.title.startsWith(prefix) && typeof p.audioUrl === "string");
    if (!hit?.audioUrl) throw new Error(`Bài không có hội thoại "${prefix}" có audio`);
    return hit.audioUrl;
  };
  const wantAudio = process.argv.includes("--audio");
  const voicesPath = arg("voices");
  const cachePath = arg("audio-cache");
  const voices: Record<string, string> = voicesPath ? JSON.parse(readFileSync(voicesPath, "utf8")) : {};
  const cache: Record<string, string> = cachePath && existsSync(cachePath) ? JSON.parse(readFileSync(cachePath, "utf8")) : {};
  const store = lessonAudioStore(owner.id);

  async function listenAudio(listen: NonNullable<SpecQuestion["listen"]>): Promise<string | null> {
    const key = createHash("sha1").update(JSON.stringify([listen, voices])).digest("hex").slice(0, 20);
    if (cache[key]) return cache[key]!;
    if (!wantAudio) return null;
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error("Thiếu OPENAI_API_KEY để sinh audio câu nghe");
    const clips: Array<{ pcm: Pcm; gapAfterSec: number }> = [];
    const say = async (who: string, text: string, gapAfterSec: number) => {
      const voice = voices[who] ?? "sage";
      clips.push({ pcm: trimSilence(await openAiSpeechPcm({ apiKey, voice, input: text, instructions: sentenceInstructionsFor(voice) })), gapAfterSec });
    };
    for (const t of listen.script) await say(t.who, t.line, TURN_GAP_SEC);
    if (listen.question) await say(voices[NARRATOR] ? NARRATOR : "sage", listen.question, 0);
    else clips[clips.length - 1]!.gapAfterSec = 0;
    // Khoảng nghỉ trước câu hỏi dài hơn giữa các lượt thoại.
    if (listen.question && clips.length >= 2) clips[clips.length - 2]!.gapAfterSec = QUESTION_GAP_SEC;
    const url = await store(encodeMp3(joinClips(clips)));
    cache[key] = url;
    if (cachePath) writeFileSync(cachePath, JSON.stringify(cache, null, 1));
    return url;
  }

  const questions: Array<Omit<SpecQuestion, "audioFrom" | "listen">> = [];
  for (const q of spec.questions) {
    const { audioFrom, listen, ...rest } = q;
    let extra = rest.extra;
    if (audioFrom) extra = { ...(extra ?? {}), audioUrl: audioOf(audioFrom) };
    if (listen) {
      const url = await listenAudio(listen);
      if (url) extra = { ...(extra ?? {}), audioUrl: url };
      else console.warn(`Câu "${rest.prompt.slice(0, 30)}" có kịch bản nghe nhưng chưa có audio (thêm --audio)`);
    }
    questions.push({ ...rest, ...(extra ? { extra } : {}) });
  }

  const existing = await prisma.quiz.findMany({ where: { lessonId: spec.lessonId, title: spec.title }, select: { id: true } });
  console.log(`Bài: ${lesson.title}\nMini-test: ${spec.title} — ${questions.length} câu, ${Math.round(spec.timeLimitSec / 60)} phút, ${questions.filter((q) => q.extra?.audioUrl).length} câu có audio`);
  if (existing.length > 0 && !replace) throw new Error(`Bài đã có quiz cùng tên (${existing.length}); thêm --replace để tạo lại`);
  if (!apply) {
    console.log("(chạy thử, chưa ghi gì)");
    return;
  }
  for (const e of existing) await deleteQuiz(owner.id, e.id);
  const { quizId } = await createQuiz(owner.id, { courseId, lessonId: spec.lessonId }, {
    title: spec.title,
    description: spec.description,
    timeLimitSec: spec.timeLimitSec,
    scoringPolicy: "latest",
    randomizeOrder: false,
    requireConfidence: false,
  });
  for (const q of questions) await createQuestion(owner.id, quizId, q);
  console.log(`Đã tạo quiz ${quizId}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
