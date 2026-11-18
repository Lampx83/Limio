/**
 * Sinh (hoặc sinh lại) audio NEU cho thẻ từ mới của một khoá ĐÃ có. Khoá tiếng Trung: mỗi từ đọc HAI lần trong một tệp, giọng nam trước, giọng nữ sau.
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/fill-vocab-audio.ts --course <courseId> --owner <email> [--force] [--dry-run] [--provider neu|openai] [--voice ash] [--only "Chủ đề 1"]
 *
 * Mặc định chỉ thêm audio cho thẻ chưa có; `--force` đọc lại cả thẻ đã có (thay audio cũ). `--only` lọc theo chuỗi có trong tên nhóm.
 * Cổng NEU chỉ với tới được qua đường hầm thì đặt NEUTTS_BASE_URL_OVERRIDE (xem `neuSecret` ở dialogue-audio.ts).
 */
import { prisma } from "@feedbackme/db";
import { PersistentCache } from "./audio-cache";
import { updateContentItem } from "../src/courses/contents";
import { neuSecret } from "./dialogue-audio";
import { getIntegrationSecret } from "../src/integrations/integrations";
import { attachVocabAudio, attachVocabExamples, attachVocabTrack, itemsNeedingExampleAudio, createNeuVocabSynth, itemsNeedingAudio, lessonAudioStore } from "./vocab-audio";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const courseId = arg("course");
  const ownerEmail = arg("owner");
  const only = arg("only");
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");
  if (!courseId || !ownerEmail) {
    console.error('Dùng: --course <courseId> --owner <email> [--force] [--dry-run] [--only "Chủ đề 1"]');
    process.exitCode = 1;
    return;
  }
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true, language: true } });
  if (!course) throw new Error(`Không thấy khoá ${courseId}`);
  const language = (course.language ?? "zh").toLowerCase().split("-")[0]!;

  const rows = await prisma.contentItem.findMany({
    where: { type: "vocab_list", lesson: { module: { courseId, ...(only ? { title: { contains: only } } : {}) } } },
    select: { id: true, payload: true, lesson: { select: { title: true } } },
  });
  const needsTrack = (r: (typeof rows)[number]) => language === "zh" && (force || !(r.payload as { audioUrl?: unknown }).audioUrl);
  const need = rows.filter((r) => needsTrack(r) || (itemsNeedingAudio(((r.payload as { items?: Array<Record<string, unknown>> }).items ?? []) as never, language, force).length > 0 || (language === "zh" && itemsNeedingExampleAudio(((r.payload as { items?: Array<Record<string, unknown>> }).items ?? []) as never, force).length > 0)));
  const words = need.reduce((n, r) => n + itemsNeedingAudio(((r.payload as { items?: Array<Record<string, unknown>> }).items ?? []) as never, language, force).length, 0);
  console.log(`Khoá "${course.title}" (${language}): ${rows.length} khối từ mới, ${need.length} khối cần audio, ${words} từ${force ? " (đọc lại)" : ""}.`);
  if (dryRun || need.length === 0) return;

  const provider = arg("provider") ?? "neu";
  let ctx;
  if (provider === "openai") {
    // OpenAI TTS: một giọng (`--voice`), mỗi từ hai lần trong một lượt, không cần cổng NEU / hầm tới NEU.
    const voice = arg("voice") ?? "ash";
    const apiKey = await getIntegrationSecret("openai");
    const stub = { voiceFor: () => voice, synthesize: async () => { throw new Error("không dùng"); } };
    ctx = { synth: stub, language, store: lessonAudioStore(owner.id), force, openai: { apiKey, voice }, warn: (m: string) => console.warn(`⚠ ${m}`) };
    console.log(`Giọng OpenAI: ${voice}`);
  } else {
    const synth = await createNeuVocabSynth(fetch, neuSecret);
    if (!synth) throw new Error("Chưa cấu hình NEU TTS (Quản trị › Tích hợp hoặc NEUTTS_*).");
    if (!synth.voiceFor(language)) throw new Error(`NEU TTS không có giọng "${language}".`);
    ctx = { synth, language, store: lessonAudioStore(owner.id), force, pairPcm: new Map(), warn: (m: string) => console.warn(`⚠ ${m}`) };
  }
  const cache = process.env.AUDIO_CACHE_FILE ? new PersistentCache(process.env.AUDIO_CACHE_FILE) : new Map<string, string>();
  let attached = 0;
  let failed = 0;
  for (const r of need) {
    const payload = r.payload as { items: Array<Record<string, unknown>> } & Record<string, unknown>;
    const res = await attachVocabAudio(payload.items, ctx, cache);
    const ex = await attachVocabExamples(payload.items, ctx, cache);
    const track = await attachVocabTrack(payload, ctx);
    attached += res.attached;
    failed += res.failed + ex.failed;
    if (res.attached > 0 || ex.attached > 0 || track) await updateContentItem(owner.id, r.id, { payload });
    console.log(`  ✔ ${r.lesson.title}: ${res.attached} từ${ex.attached ? ` + ${ex.attached} câu ví dụ` : ""}${track ? " + audio tổng hợp" : ""}${res.failed ? `, ${res.failed} lỗi` : ""}`);
  }
  console.log(`\n✔ Giọng từ mới (NEU TTS): ${attached} từ có audio mới` + (failed ? `, ${failed} lỗi` : ""));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
