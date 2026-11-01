/**
 * Dựng video giảng viên nói (Ditto) cho các bài đã có giọng. Chạy trên MÁY DEV, không cần DB hay kho tệp:
 *
 *   tsx scripts/build-lecturer-video.ts --dir <thư mục việc> [--lesson <id>] [--photo ảnh.jpg] [--dry-run]
 *
 * Thư mục việc có một thư mục con cho mỗi bài (do `lecturer-video.ts export` tạo):
 *   <dir>/<lessonId>/{audio.mp3, segments.json, meta.json}
 * và sau khi dựng thêm:
 *   <dir>/<lessonId>/{lecturer-lg.mp4, lecturer-sm.mp4, video.json}
 *   <dir>/clips/<khoá>.mp4        # từng đoạn Ditto trả về, dùng lại khi dựng lại
 *
 * Dịch vụ Ditto (Vidgen, server 232) nằm trong mạng riêng nên production không gọi tới được; vì vậy dựng offline rồi nạp
 * video lên (xem docs/van-hanh/giang-vien-ao-video.md). Hai đường gọi:
 *   LECTURER_AVATAR_SSH=<máy ssh>            ssh + `docker exec vidgen-avatar python -m vidgen.avatar call` (khoá ở lại trong container)
 *   LECTURER_AVATAR_URL=http://máy:8791 + LECTURER_AVATAR_KEY=…   HTTP thẳng
 *
 * Idempotent: bài có `video.json` khớp ảnh + âm thanh + mốc đoạn và đủ tệp thì bỏ qua; đoạn đã có trong cache không gọi lại
 * Ditto. Cần ffmpeg và ffprobe trong PATH. Không ghi gì ngoài thư mục việc.
 */
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { LECTURER_VIDEO_FPS, clipCacheKey, planClips, totalFrames, type ClipPlan, type PlanSegment } from "../src/lib/narration/lecturerVideoPlan";

const LG = { name: "lg", size: 512, crf: 23 } as const;
const SM = { name: "sm", size: 256, crf: 28 } as const;
const DITTO_SIZE = 512;

const sha1 = (b: Buffer | string) => createHash("sha1").update(b).digest("hex");

interface Args {
  dir: string;
  lesson?: string;
  photo: string;
  dryRun: boolean;
}

function parseArgs(argv: string[]): Args {
  const a: Args = { dir: "", photo: resolve(__dirname, "../public/lecturers/tien-dat.jpg"), dryRun: false };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === "--dir") a.dir = resolve(argv[++i] ?? "");
    else if (k === "--lesson") a.lesson = argv[++i];
    else if (k === "--photo") a.photo = resolve(argv[++i] ?? "");
    else if (k === "--dry-run") a.dryRun = true;
    else throw new Error(`Tham số lạ: ${k}`);
  }
  if (!a.dir) throw new Error("Thiếu --dir <thư mục việc>");
  return a;
}

// ── chạy tiến trình ───────────────────────────────────────────────────────────────────────────────────────────────
function run(cmd: string, args: string[], input?: Buffer): Promise<{ code: number; out: Buffer; err: string }> {
  return new Promise((ok, fail) => {
    const p = spawn(cmd, args, { stdio: ["pipe", "pipe", "pipe"] });
    const out: Buffer[] = [];
    let err = "";
    p.stdout.on("data", (d: Buffer) => out.push(d));
    p.stderr.on("data", (d: Buffer) => (err += d.toString()));
    p.on("error", fail);
    p.on("close", (code) => ok({ code: code ?? 1, out: Buffer.concat(out), err }));
    p.stdin.on("error", () => {});
    p.stdin.end(input);
  });
}

async function ffmpeg(args: string[]): Promise<void> {
  const r = await run("ffmpeg", ["-v", "error", "-y", ...args]);
  if (r.code !== 0) throw new Error(`ffmpeg lỗi: ${r.err.slice(-400).trim()}`);
}

async function countFrames(file: string): Promise<number> {
  const r = await run("ffprobe", ["-v", "error", "-count_frames", "-select_streams", "v:0", "-show_entries", "stream=nb_read_frames", "-of", "csv=p=0", file]);
  return Number(r.out.toString().trim());
}

// ── dịch vụ Ditto ─────────────────────────────────────────────────────────────────────────────────────────────────
type Transport = (method: "GET" | "POST", path: string, body?: Buffer) => Promise<{ code: number; data: Buffer }>;

function transportFromEnv(env = process.env): Transport {
  const ssh = env.LECTURER_AVATAR_SSH;
  const url = env.LECTURER_AVATAR_URL;
  if (ssh) {
    const container = env.LECTURER_AVATAR_CONTAINER || "vidgen-avatar";
    if (!/^[A-Za-z0-9][A-Za-z0-9._@-]*$/.test(ssh) || !/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(container)) {
      throw new Error("LECTURER_AVATAR_SSH / LECTURER_AVATAR_CONTAINER không hợp lệ");
    }
    return async (method, path, body) => {
      if (!/^\/[A-Za-z0-9/_-]{1,80}$/.test(path)) throw new Error("đường dẫn gọi dịch vụ không hợp lệ");
      const r = await run("ssh", ["-o", "BatchMode=yes", "-o", "ConnectTimeout=15", ssh, "docker", "exec", "-i", container, "python", "-m", "vidgen.avatar", "call", method, path], body);
      if (r.code !== 0 && r.code !== 3) throw new Error(`gọi dịch vụ avatar qua ssh lỗi: ${r.err.slice(-300).trim()}`);
      const nl = r.out.indexOf(0x0a);
      return { code: Number(r.out.subarray(0, nl).toString()), data: r.out.subarray(nl + 1) };
    };
  }
  if (url) {
    if (!/^https?:\/\/[A-Za-z0-9._:-]+$/.test(url)) throw new Error("LECTURER_AVATAR_URL phải là http(s)://máy:cổng");
    const key = env.LECTURER_AVATAR_KEY;
    return async (method, path, body) => {
      const res = await fetch(url + path, { method, body, headers: { "Content-Type": "application/json", ...(key ? { "X-API-Key": key } : {}) } });
      return { code: res.status, data: Buffer.from(await res.arrayBuffer()) };
    };
  }
  throw new Error("Chưa cấu hình dịch vụ Ditto: đặt LECTURER_AVATAR_SSH=<máy ssh> hoặc LECTURER_AVATAR_URL (+ LECTURER_AVATAR_KEY).");
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function dittoClip(call: Transport, photo: Buffer, wav: Buffer, timeoutMs = 20 * 60_000): Promise<Buffer> {
  const body = Buffer.from(JSON.stringify({ photo: photo.toString("base64"), audio: wav.toString("base64"), style: "real", size: DITTO_SIZE }));
  const json = (d: Buffer): Record<string, unknown> => {
    try {
      return JSON.parse(d.toString() || "{}");
    } catch {
      return { error: d.subarray(0, 200).toString() };
    }
  };
  let r = await call("POST", "/v1/jobs", body);
  let st = json(r.data);
  if (r.code !== 200 && r.code !== 202) throw new Error(String(st.error ?? `dịch vụ từ chối (mã ${r.code})`));
  const id = String(st.id);
  const t0 = Date.now();
  while (st.state !== "xong" && st.state !== "loi") {
    if (Date.now() - t0 > timeoutMs) throw new Error(`Ditto chưa xong sau ${Math.round(timeoutMs / 60000)} phút (trạng thái ${st.state}) ${st.note ?? ""}`);
    await sleep(2000);
    r = await call("GET", `/v1/jobs/${id}`);
    if (r.code !== 200) throw new Error(`dịch vụ trả mã ${r.code}`);
    st = json(r.data);
  }
  if (st.state === "loi") throw new Error(`Ditto báo lỗi: ${st.error ?? "không rõ"}`);
  const v = await call("GET", `/v1/jobs/${id}/video`);
  if (v.code !== 200 || v.data.length < 1000) throw new Error(`không tải được video (mã ${v.code})`);
  return v.data;
}

async function withRetry<T>(label: string, fn: () => Promise<T>, tries = 3): Promise<T> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (e) {
      if (i >= tries) throw e;
      console.warn(`  ${label}: ${(e as Error).message} — thử lại (${i}/${tries - 1})`);
      await sleep(5000 * i);
    }
  }
}

// ── một bài ───────────────────────────────────────────────────────────────────────────────────────────────────────
interface LessonMeta {
  lessonId: string;
  title?: string;
  durationSec: number;
}

async function buildLesson(dir: string, clipsDir: string, args: Args, photo: Buffer, call: Transport | null): Promise<"built" | "skipped" | "dry"> {
  const meta: LessonMeta = JSON.parse(await readFile(join(dir, "meta.json"), "utf8"));
  const segments: PlanSegment[] = JSON.parse(await readFile(join(dir, "segments.json"), "utf8"));
  const audioPath = join(dir, "audio.mp3");
  const audioSha = sha1(await readFile(audioPath));
  const inputHash = sha1(JSON.stringify({ photo: sha1(photo), audio: audioSha, segments, durationSec: meta.durationSec, fps: LECTURER_VIDEO_FPS, ditto: DITTO_SIZE, lg: LG, sm: SM }));

  const done = join(dir, "video.json");
  if (existsSync(done) && existsSync(join(dir, "lecturer-lg.mp4")) && existsSync(join(dir, "lecturer-sm.mp4"))) {
    const prev = JSON.parse(await readFile(done, "utf8"));
    if (prev.inputHash === inputHash) return "skipped";
  }

  const plan = planClips(segments, meta.durationSec);
  const speech = plan.reduce((s, c) => s + (c.endSec - c.startSec), 0);
  console.log(`• ${meta.title ?? meta.lessonId}: ${plan.length} đoạn, ${speech.toFixed(0)} giây lời, video ${(totalFrames(meta.durationSec) / LECTURER_VIDEO_FPS).toFixed(1)} giây`);
  if (args.dryRun) return "dry";
  if (!call) throw new Error("thiếu dịch vụ Ditto");

  const tmp = join(dir, ".build");
  await rm(tmp, { recursive: true, force: true });
  await mkdir(tmp, { recursive: true });
  const photoSha = sha1(photo);

  // 1) Ditto từng đoạn (có cache)
  const clipFiles: string[] = [];
  for (const c of plan) {
    const wavPath = join(tmp, `seg-${c.index}.wav`);
    await ffmpeg(["-ss", String(c.startSec), "-t", String(c.endSec - c.startSec), "-i", audioPath, "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", wavPath]);
    const wav = await readFile(wavPath);
    const clip = join(clipsDir, `${clipCacheKey(photoSha, sha1(wav), DITTO_SIZE)}.mp4`);
    if (!existsSync(clip)) {
      const t = Date.now();
      const data = await withRetry(`đoạn ${c.index + 1}/${plan.length}`, () => dittoClip(call, photo, wav));
      await writeFile(clip + ".part", data);
      await rename(clip + ".part", clip);
      console.log(`  đoạn ${c.index + 1}/${plan.length} (${c.anchor}): ${(c.endSec - c.startSec).toFixed(1)} giây lời, ${((Date.now() - t) / 1000).toFixed(0)} giây dựng`);
    } else {
      console.log(`  đoạn ${c.index + 1}/${plan.length} (${c.anchor}): dùng lại cache`);
    }
    clipFiles.push(clip);
    await rm(wavPath, { force: true });
  }

  // 2) ghép: mỗi đoạn đủ số hình của nó (hết thì giữ hình cuối), nối bằng concat, mỗi giây một khung chính để tua được
  const total = totalFrames(meta.durationSec);
  const outputs: Record<string, { file: string; bytes: number; width: number }> = {};
  for (const r of [LG, SM]) {
    const parts: string[] = [];
    for (const c of plan) {
      const part = join(tmp, `${r.name}-${c.index}.mp4`);
      await ffmpeg(partArgs(clipFiles[c.index]!, c, part, r.size, r.crf));
      parts.push(part);
    }
    const list = join(tmp, `${r.name}.txt`);
    await writeFile(list, parts.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n"));
    const out = join(dir, `lecturer-${r.name}.mp4`);
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-an", "-movflags", "+faststart", out + ".part.mp4"]);
    const frames = await countFrames(out + ".part.mp4");
    if (Math.abs(frames - total) > 1) throw new Error(`${r.name}: ${frames} hình, cần ${total}`);
    await rename(out + ".part.mp4", out);
    outputs[r.name] = { file: `lecturer-${r.name}.mp4`, bytes: (await stat(out)).size, width: r.size };
  }
  await writeFile(done, JSON.stringify({ lessonId: meta.lessonId, inputHash, audioSha1: audioSha, photoSha1: photoSha, fps: LECTURER_VIDEO_FPS, frames: total, durationSec: meta.durationSec, renditions: outputs, builtAt: new Date().toISOString() }, null, 2));
  await rm(tmp, { recursive: true, force: true });
  console.log(`  xong: lg ${(outputs.lg!.bytes / 1e6).toFixed(1)} MB, sm ${(outputs.sm!.bytes / 1e6).toFixed(1)} MB`);
  return "built";
}

/** Đúng `c.frames` hình: cắt bớt nếu Ditto trả dư, giữ hình cuối nếu thiếu. Mọi phần cùng tham số nên nối `-c copy` được. */
function partArgs(clip: string, c: ClipPlan, out: string, size: number, crf: number): string[] {
  return [
    "-i", clip,
    "-vf", `fps=${LECTURER_VIDEO_FPS},scale=${size}:${size}:flags=lanczos,tpad=stop_mode=clone:stop_duration=60,format=yuv420p`,
    "-frames:v", String(c.frames),
    "-an",
    "-c:v", "libx264", "-preset", "medium", "-crf", String(crf),
    "-g", String(LECTURER_VIDEO_FPS), "-keyint_min", String(LECTURER_VIDEO_FPS), "-sc_threshold", "0",
    "-r", String(LECTURER_VIDEO_FPS),
    out,
  ];
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const photo = await readFile(args.photo);
  const call = args.dryRun ? null : transportFromEnv();
  const clipsDir = join(args.dir, "clips");
  await mkdir(clipsDir, { recursive: true });
  const lessons = (await readdir(args.dir, { withFileTypes: true }))
    .filter((e) => e.isDirectory() && e.name !== "clips" && (!args.lesson || e.name === args.lesson) && existsSync(join(args.dir, e.name, "meta.json")))
    .map((e) => e.name);
  if (!lessons.length) throw new Error("Không có bài nào trong thư mục việc (thiếu <id>/meta.json).");
  const t0 = Date.now();
  const tally = { built: 0, skipped: 0, dry: 0 };
  for (const id of lessons) tally[await buildLesson(join(args.dir, id), clipsDir, args, photo, call)]++;
  console.log(`Xong sau ${((Date.now() - t0) / 60000).toFixed(1)} phút: dựng ${tally.built}, bỏ qua ${tally.skipped}${args.dryRun ? `, chỉ lập kế hoạch ${tally.dry}` : ""}.`);
}

main().catch((e) => {
  console.error(`Lỗi: ${(e as Error).message}`);
  process.exit(1);
});
