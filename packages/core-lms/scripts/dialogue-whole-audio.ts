/**
 * Ghép audio TỪNG LƯỢT của mỗi hội thoại thành MỘT audio cả đoạn (`DialoguePayload.audioUrl`) kèm mốc `startSec` của từng lượt, để trình phát của Limio
 * (thanh tua, tốc độ 0,75×/1×/1,25×, lặp lại, tô sáng lượt theo thời gian) dùng được cho hội thoại. Dùng chính các tệp audio lượt ĐÃ có (không đọc lại).
 *
 *   node --env-file=../db/.env.prod-import --import tsx scripts/dialogue-whole-audio.ts --course <courseId> --owner <email> --uploads <thư-mục-uploads> [--dry-run] [--only "Bài khoá 1"]
 *
 * Giải mã MP3 bằng `afconvert` (có sẵn trên macOS); chạy trên máy macOS có thư mục uploads chứa các tệp audio lượt. Mỗi lượt cắt lặng thừa ở hai đầu,
 * rồi nghỉ {@link TURN_GAP_SEC} giây giữa hai lượt. Ghi tệp mới vào kho `lesson-media/audio` (như các script audio khác) — cần chép lên máy chủ.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import { updateContentItem } from "../src/courses/contents";
import { encodeMp3, parseWav, type Pcm } from "../src/narration/audio";
import { trimSilence } from "./openai-tts";
import { lessonAudioStore } from "./vocab-audio";

export const TURN_GAP_SEC = 0.45;

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function findFile(dir: string, name: string): string | null {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      const r = findFile(p, name);
      if (r) return r;
    } else if (e === name) return p;
  }
  return null;
}

/** MP3 → PCM 16-bit mono 24 kHz (afconvert). */
function decodeMp3(file: string, tmp: string): Pcm {
  const wav = join(tmp, "t.wav");
  execFileSync("afconvert", ["-f", "WAVE", "-d", "LEI16@24000", "-c", "1", file, wav]);
  return parseWav(readFileSync(wav));
}

/** Nối các lượt (đã cắt lặng thừa) cách nhau `gapSec`; trả PCM và mốc bắt đầu (giây, làm tròn 0,1) của từng lượt. */
export function joinTurns(clips: Pcm[], gapSec = TURN_GAP_SEC): { pcm: Pcm; starts: number[] } {
  const rate = clips[0]!.sampleRate;
  const gap = Math.round(rate * gapSec);
  const total = clips.reduce((n, c) => n + c.samples.length, 0) + gap * (clips.length - 1);
  const samples = new Int16Array(total);
  const starts: number[] = [];
  let pos = 0;
  for (const c of clips) {
    starts.push(Math.round((pos / rate) * 10) / 10);
    samples.set(c.samples, pos);
    pos += c.samples.length + gap;
  }
  return { pcm: { sampleRate: rate, samples }, starts };
}

async function main() {
  const courseId = arg("course");
  const ownerEmail = arg("owner");
  const uploads = arg("uploads");
  const only = arg("only");
  const dryRun = process.argv.includes("--dry-run");
  if (!courseId || !ownerEmail || !uploads) {
    console.error('Dùng: --course <id> --owner <email> --uploads <thư-mục-uploads> [--only "Bài khoá 1"] [--dry-run]');
    process.exitCode = 1;
    return;
  }
  const owner = await prisma.user.findUnique({ where: { email: ownerEmail }, select: { id: true } });
  if (!owner) throw new Error(`Không thấy tài khoản ${ownerEmail}`);
  const rows = await prisma.contentItem.findMany({
    where: { type: "dialogue", lesson: { module: { courseId, ...(only ? { lesson: { title: { contains: only } } } : {}) } } },
    select: { id: true, payload: true, lesson: { select: { title: true } } },
  });
  const tmp = mkdtempSync(join(tmpdir(), "dlg-whole-"));
  const store = lessonAudioStore(owner.id);
  try {
    for (const r of rows) {
      const payload = r.payload as { turns: Array<{ speaker: string; audioUrl?: string; startSec?: number }>; audioUrl?: string } & Record<string, unknown>;
      if (payload.turns.some((t) => !t.audioUrl)) {
        console.log(`  – ${r.lesson.title.slice(0, 20)}: có lượt chưa có audio, bỏ qua`);
        continue;
      }
      const clips = payload.turns.map((t) => {
        const f = findFile(uploads, t.audioUrl!.split("/").pop()!);
        if (!f) throw new Error(`Không thấy tệp ${t.audioUrl}`);
        return trimSilence(decodeMp3(f, tmp));
      });
      const { pcm, starts } = joinTurns(clips);
      console.log(`  ✔ ${r.lesson.title.slice(0, 20)}: ${clips.length} lượt, ${(pcm.samples.length / pcm.sampleRate).toFixed(1)} s, mốc ${starts.slice(0, 4).join(", ")}…`);
      if (dryRun) continue;
      payload.audioUrl = await store(encodeMp3(pcm));
      payload.turns.forEach((t, i) => (t.startSec = starts[i]));
      await updateContentItem(owner.id, r.id, { payload });
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

if (process.argv[1]?.endsWith("dialogue-whole-audio.ts")) {
  main()
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
