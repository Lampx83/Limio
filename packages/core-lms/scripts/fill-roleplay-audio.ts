/**
 * Bổ sung audio mẫu NEU TTS cho các câu đóng vai (`roleplay`) ĐÃ có trong một khoá — không nhập lại khoá.
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/fill-roleplay-audio.ts --course <courseId> --owner <email> [--genders speakers.json] [--force] [--dry-run]
 *
 * Chỉ thêm `audio` cho lượt chưa có (`--force`: đọc lại cả lượt đã có); không đổi chữ, vai hay phiên âm giáo viên đã ghi. `--genders` = {"tên vai": "f"|"m"}
 * để chọn giọng nam/nữ. Cấu hình NEU lấy từ DB (cần SECRETS_MASTER_KEY); cổng chỉ với tới qua đường hầm thì đặt NEUTTS_BASE_URL_OVERRIDE. Cần UPLOADS_ROOT.
 */
import { readFileSync } from "node:fs";
import { prisma } from "@feedbackme/db";
import { createAudioAsset } from "../src/exam/assets";
import { updateExamQuestion } from "../src/exam/questions";
import { storePublicBuffer } from "./practice-spec";
import { resolveNeu, type Gender } from "./dialogue-audio";
import { fillRoleplayAudio } from "./roleplay-audio";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const courseId = arg("course");
  const ownerEmail = arg("owner");
  const dryRun = process.argv.includes("--dry-run");
  const force = process.argv.includes("--force");
  const gendersFile = arg("genders");
  const genders = gendersFile ? (JSON.parse(readFileSync(gendersFile, "utf8")) as Record<string, Gender>) : {};
  if (!courseId || !ownerEmail) {
    console.error("Dùng: --course <courseId> --owner <email> [--genders file.json] [--force] [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const course = await prisma.course.findUnique({ where: { id: courseId }, select: { title: true, language: true } });
  if (!course) throw new Error(`Không thấy khoá ${courseId}`);
  const language = (course.language ?? "zh").toLowerCase().split("-")[0]!;

  const qs = await prisma.examQuestion.findMany({
    where: { type: "essay", exam: { ownerContentItem: { lesson: { module: { courseId } } } } },
    select: { id: true, examId: true, config: true },
  });
  const withRp = qs.filter((q) => Array.isArray((q.config as { roleplay?: { turns?: unknown } } | null)?.roleplay?.turns));
  const need = withRp.filter(
    (q) => force || ((q.config as { roleplay: { turns: Array<{ audio?: string }> } }).roleplay.turns).some((t) => !t.audio),
  );
  console.log(`Khoá "${course.title}" (${language}): ${withRp.length} câu đóng vai, ${need.length} ${force ? "sẽ đọc lại" : "còn lượt chưa có audio"}.`);
  if (dryRun || need.length === 0) return;

  const { synth, voices } = await resolveNeu(language);
  console.log(`Giọng NEU "${language}": ${voices.join(", ")}`);
  let attached = 0;
  let failed = 0;
  for (const q of need) {
    const r = await fillRoleplayAudio(q.config, {
      voices,
      genders,
      force,
      warn: (m) => console.warn(`⚠ ${m}`),
      synthesize: async (text, voice) => {
        const mp3 = await synth.synthesize(text, voice);
        const st = await storePublicBuffer("exam-assets", ".mp3", mp3, q.examId);
        await createAudioAsset(owner.id, q.examId, { s3Key: st.filename, mimeType: st.mime, sizeBytes: st.size, altText: "Role-play turn audio" });
        return `/api/exam-assets/${st.filename}`;
      },
    });
    attached += r.attached;
    failed += r.failed;
    if (r.attached > 0) await updateExamQuestion(owner.id, q.id, { config: r.config });
  }
  console.log(`\n✔ Audio mẫu đóng vai (NEU TTS): ${attached} lượt có audio mới` + (failed ? `, ${failed} lượt lỗi` : ""));
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
