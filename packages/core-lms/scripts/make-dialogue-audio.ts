/**
 * Sinh audio từng lượt cho tài nguyên hội thoại bằng NEU TTS, ghi vào thư mục assets để `import-course.ts` tải lên như học liệu thường.
 *
 * Chạy trên máy soạn (không cần DB): khoá NEU đặt trong biến môi trường, KHÔNG lấy từ DB (khoá trong DB mã hoá bằng khoá chỉ có trên server).
 *
 *   export NEUTTS_BASE_URL=http://…/tts   NEUTTS_API_KEY=…   NEUTTS_VOICE_ZH=<giọng tiếng Trung>
 *   pnpm --filter @feedbackme/core-lms exec node --import tsx scripts/make-dialogue-audio.ts \
 *       --file hsk3-lessons-1-4.json --assets ./assets [--language zh] [--force] [--dry-run]
 *
 * Mỗi người nói giữ một giọng suốt khoá (theo thứ tự người nói xuất hiện trong từng hội thoại, xoay vòng trong các giọng của ngôn ngữ).
 * Tệp đã có thì bỏ qua (trừ --force). Sinh xong, dựng lại manifest (build_all.py) để các lượt có `audio`, rồi nhập.
 */
import { existsSync, readFileSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { dialogueAudioFile, resolveNeu, speakableTurn } from "./dialogue-audio";

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

interface Turn { speaker: string; text: string }
interface Manifest { course?: { language?: string }; modules: Array<{ lessons: Array<{ title: string; dialogues?: Array<{ turns: Turn[] }> }> }> }

const envSecret = async (key: string): Promise<string> => {
  const env: Record<string, string | undefined> = {
    "neutts.base_url": process.env.NEUTTS_BASE_URL,
    "neutts.api_key": process.env.NEUTTS_API_KEY,
  };
  const v = key.startsWith("neutts.voice_") ? process.env[`NEUTTS_VOICE_${key.slice("neutts.voice_".length).toUpperCase()}`] : env[key];
  if (!v) throw new Error(`thiếu biến môi trường cho ${key}`);
  return v;
};

async function main() {
  const file = arg("file");
  const assets = arg("assets");
  if (!file || !assets) {
    console.error("Dùng: --file <manifest.json> --assets <thư-mục-assets> [--language zh] [--force] [--dry-run]");
    process.exitCode = 1;
    return;
  }
  const manifest = JSON.parse(readFileSync(file, "utf8")) as Manifest;
  const language = (arg("language") ?? manifest.course?.language ?? "zh").toLowerCase().split("-")[0]!;
  const force = process.argv.includes("--force");
  const dryRun = process.argv.includes("--dry-run");

  // Danh sách việc: mỗi (người nói, chữ) một tệp, theo giọng của người nói trong hội thoại đầu tiên nó xuất hiện.
  const jobs = new Map<string, { speaker: string; text: string; speakerIndex: number }>();
  for (const m of manifest.modules) {
    for (const l of m.lessons) {
      for (const d of l.dialogues ?? []) {
        const order = [...new Set(d.turns.map((t) => t.speaker))];
        for (const t of d.turns) {
          const text = speakableTurn(t.text);
          if (!text) continue;
          const f = dialogueAudioFile(t.speaker, t.text);
          if (!jobs.has(f)) jobs.set(f, { speaker: t.speaker, text, speakerIndex: order.indexOf(t.speaker) });
        }
      }
    }
  }
  const todo = [...jobs.entries()].filter(([f]) => force || !existsSync(path.resolve(assets, f)));
  console.log(`${jobs.size} lượt duy nhất, ${jobs.size - todo.length} đã có tệp, ${todo.length} cần sinh (ngôn ngữ "${language}").`);
  if (dryRun || todo.length === 0) return;

  const { synth, voices } = await resolveNeu(language, fetch, envSecret);
  console.log(`Giọng "${language}": ${voices.join(", ")}`);

  let done = 0;
  let failed = 0;
  for (const [f, job] of todo) {
    // Giọng theo thứ tự xuất hiện của người nói trong hội thoại của nó (xoay vòng khi ít giọng).
    const voice = voices[job.speakerIndex % voices.length]!;
    try {
      const mp3 = await synth.synthesize(job.text, voice);
      const dest = path.resolve(assets, f);
      await mkdir(path.dirname(dest), { recursive: true });
      await writeFile(dest, mp3);
      done += 1;
      if (done % 10 === 0) console.log(`  … ${done}/${todo.length}`);
    } catch (e) {
      failed += 1;
      console.warn(`⚠ Lỗi "${job.text.slice(0, 20)}…" (${voice}): ${(e as Error).message}`);
    }
  }
  console.log(`\nXong: ${done} tệp mới, ${failed} lỗi. Dựng lại manifest (python3 build/build_all.py) rồi nhập.`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
