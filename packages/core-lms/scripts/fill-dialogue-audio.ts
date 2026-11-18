/**
 * Bổ sung audio NEU từng lượt cho các tài nguyên hội thoại ĐÃ có trong một khoá (đã nhập trước đó mà chưa có audio).
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/fill-dialogue-audio.ts --course <courseId> --owner <email> [--dry-run] [--force] [--genders speakers.json] [--voices voices.json]
 *
 * `--voices <file.json>` = {"người nói": "tên giọng"} cố định giọng từng nhân vật cho MỌI hội thoại của khoá (nên dùng, kẻo giọng đổi giữa các hội thoại).
 * Chỉ thêm `audioUrl` cho lượt chưa có (`--force`: đọc lại cả lượt đã có, thay audio cũ); `--genders <file.json>` = {"người nói": "f"|"m"} để chọn giọng nam/nữ; không đổi chữ, phiên âm hay bản dịch. Cấu hình NEU lấy từ DB (cần SECRETS_MASTER_KEY); cổng chỉ với
 * tới được qua đường hầm thì đặt NEUTTS_BASE_URL_OVERRIDE (xem `neuSecret`). Cần UPLOADS_ROOT trỏ thư mục sẽ chép lên S3.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { PersistentCache } from "./audio-cache";
import { updateContentItem } from "../src/courses/contents";
import { getIntegrationSecret } from "../src/integrations/integrations";
import { attachDialogueAudio, prepareDialogueAudio, type Gender } from "./dialogue-audio";
import { lessonAudioStore } from "./vocab-audio";
import { openAiSpeech, SENTENCE_INSTRUCTIONS } from "./openai-tts";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Turn { id?: string; speaker: string; text: string; audioUrl?: string; [k: string]: unknown }

async function main() {
  const courseId = arg("course");
  const ownerEmail = arg("owner");
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const gendersFile = arg("genders");
  const genders = gendersFile ? (JSON.parse(readFileSync(gendersFile, "utf8")) as Record<string, Gender>) : {};
  const voicesFile = arg("voices");
  const voiceMap = voicesFile ? (JSON.parse(readFileSync(voicesFile, "utf8")) as Record<string, string>) : undefined;
  if (!courseId || !ownerEmail) {
    console.error("Dùng: --course <courseId> --owner <email> [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true, language: true } });
  if (!course) throw new Error(`Không thấy khoá ${courseId}`);
  const language = (course.language ?? "zh").toLowerCase().split("-")[0]!;

  const items = await prisma.contentItem.findMany({
    where: { type: "dialogue", lesson: { module: { courseId } } },
    select: { id: true, payload: true },
  });
  const need = items.filter((it) => force || ((it.payload as { turns?: Turn[] }).turns ?? []).some((t) => !t.audioUrl));
  console.log(`Khoá "${course.title}" (${language}): ${items.length} hội thoại, ${need.length} ${force ? "sẽ đọc lại" : "còn lượt chưa có audio"}.`);
  if (dryRun || need.length === 0) return;

  // `--provider openai`: mỗi lượt đọc tự nhiên MỘT lần bằng OpenAI TTS, giọng cố định theo `--voices` (tên giọng OpenAI: nova, ash, onyx, echo…).
  const ctx =
    arg("provider") === "openai"
      ? await (async () => {
          const apiKey = await getIntegrationSecret("openai");
          const names = [...new Set(Object.values(voiceMap ?? {}))];
          console.log(`Giọng OpenAI: ${names.join(", ")}`);
          return {
            synth: { synthesize: (text: string, voice: string) => openAiSpeech({ apiKey, voice, input: text, instructions: SENTENCE_INSTRUCTIONS }) },
            voices: names.length ? names : ["nova", "ash", "onyx", "echo"],
            store: lessonAudioStore(owner.id),
            warn: (m: string) => console.warn(`⚠ ${m}`),
          };
        })()
      : await prepareDialogueAudio(language, owner.id);
  if (!ctx) throw new Error("Chưa dùng được NEU TTS (xem cảnh báo ở trên).");
  ctx.genders = genders;
  ctx.voiceMap = voiceMap;
  ctx.force = force;
  const cache = process.env.AUDIO_CACHE_FILE ? new PersistentCache(process.env.AUDIO_CACHE_FILE) : new Map<string, string>();
  let attached = 0;
  let failed = 0;
  for (const it of need) {
    const payload = it.payload as { turns: Turn[] } & Record<string, unknown>;
    const r = await attachDialogueAudio(payload.turns, ctx, cache);
    attached += r.attached;
    failed += r.failed;
    if (r.attached > 0) await updateContentItem(owner.id, it.id, { payload });
  }
  console.log(`\n✔ Giọng hội thoại (NEU TTS): ${attached} lượt có audio mới` + (failed ? `, ${failed} lượt lỗi` : ""));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
