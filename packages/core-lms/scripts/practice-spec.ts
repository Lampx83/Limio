/**
 * Khối "Bài luyện" trong manifest học liệu (`lessons[].practices`) — dùng cho `import-course.ts`.
 *
 * Mỗi Bài luyện có các ĐOẠN VĂN (bài đọc, bài nghe, có thể có ảnh/bảng) cùng câu hỏi gắn vào đoạn, và/hoặc câu hỏi riêng lẻ.
 * Nội dung đoạn viết bằng khối đơn giản (`p`, `h2`, `ul`, `ol`, `table`, `image`, `audio`) và được đổi thành tài liệu Tiptap
 * đúng bộ nút mà `PassageView` vẽ được (xem apps/web/src/lib/passageDoc.ts). Tệp audio/ảnh nằm ngoài Git (thư mục `--assets`),
 * được ghi vào kho `exam-assets` và đăng ký `ExamAsset` kèm transcript — giống đường UI giảng viên đi.
 */
import { randomBytes } from "node:crypto";
import { existsSync, statSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { CreateExamQuestionInput } from "../src/exam/questions";
import { configSchemaForType } from "../src/exam/schemas";

const QuestionType = z.enum([
  "mcq",
  "multi",
  "true_false_notgiven",
  "gap_fill",
  "short_answer",
  "essay",
  "matching",
  "ordering",
  "numerical",
  "drag_drop_fill",
]);

export const ExamQuestionSpec = z.object({
  type: QuestionType,
  prompt: z.string().min(1).max(5_000),
  explanation: z.string().max(2_000).optional(),
  points: z.number().int().min(0).max(1_000).optional(),
  /** mcq / multi */
  options: z.array(z.object({ label: z.string().min(1), isCorrect: z.boolean() })).optional(),
  /** true_false_notgiven */
  correct: z.enum(["true", "false", "notgiven"]).optional(),
  /** short_answer: mọi cách viết được chấp nhận. gap_fill: `blanks[i]` = các cách viết chấp nhận của ô i. */
  answers: z.array(z.string().min(1)).optional(),
  blanks: z.array(z.array(z.string().min(1)).min(1)).optional(),
  caseSensitive: z.boolean().optional(),
  /** matching */
  pairs: z.array(z.object({ left: z.string().min(1), right: z.string().min(1) })).optional(),
  /** ordering — viết đúng thứ tự */
  sequence: z.array(z.string().min(1)).optional(),
  /** drag_drop_fill — prompt đánh dấu ô bằng [[1]], [[2]]…; thẻ không có `blank` là thẻ gây nhiễu */
  tokens: z.array(z.object({ label: z.string().min(1), blank: z.number().int().min(1).optional() })).optional(),
  /** numerical */
  expected: z.number().optional(),
  tolerance: z.number().min(0).optional(),
  /** essay */
  rubric: z.string().max(5_000).optional(),
  minWords: z.number().int().positive().optional(),
  /** essay: audio đọc bài mẫu (`explanation`) — đường dẫn tương đối so với thư mục assets. */
  sampleAudio: z.string().min(1).optional(),
  /** essay: cho học viên trả lời bằng giọng nói (mặc định bật; chỉ ghi vào cấu hình khi tắt). */
  voiceAnswer: z.boolean().optional(),
  /** essay: AI góp ý câu trả lời khi học viên kiểm tra (mặc định bật; chỉ ghi vào cấu hình khi tắt). */
  aiFeedback: z.boolean().optional(),
  /** essay: hội thoại đóng vai — học viên chọn vai A/B, nghe vai kia và ghi âm lượt của mình. `audio` từng lượt tương đối so với thư mục assets. */
  roleplay: z
    .object({
      roles: z.object({ A: z.string().max(60).optional(), B: z.string().max(60).optional() }).optional(),
      turns: z.array(z.object({ speaker: z.enum(["A", "B"]), text: z.string().min(1).max(600), audio: z.string().min(1).optional() })).min(2).max(40),
    })
    .optional(),
  /** essay: "Thử nói tự do" với bạn ảo (chatbot đóng vai). Không dùng cùng `roleplay`. */
  freechat: z
    .object({
      scenario: z.string().min(1).max(600),
      partnerRole: z.string().max(60).optional(),
      learnerRole: z.string().max(60).optional(),
      opening: z.string().min(1).max(300),
      targets: z.array(z.string().min(1).max(120)).max(10).optional(),
      maxTurns: z.number().int().min(4).max(12).optional(),
      scaffold: z
        .object({
          ideas: z.array(z.string().min(1).max(120)).max(4).optional(),
          frames: z.array(z.object({ en: z.string().min(1).max(120), vi: z.string().max(120).optional() })).max(8).optional(),
          phrases: z.array(z.object({ en: z.string().min(1).max(40), vi: z.string().max(60).optional() })).max(12).optional(),
          vocab: z.array(z.object({ en: z.string().min(1).max(40), vi: z.string().max(60).optional() })).max(12).optional(),
          model: z.object({ text: z.string().min(1).max(700), audio: z.string().max(300).optional() }).optional(),
        })
        .optional(),
    })
    .optional(),
});
export type ExamQuestionSpecT = z.infer<typeof ExamQuestionSpec>;

/** Khối nội dung của một đoạn văn. Chữ **đậm** và *nghiêng* viết bằng dấu sao. */
export const PassageBlock = z.union([
  z.object({ p: z.string() }),
  z.object({ h2: z.string() }),
  z.object({ h3: z.string() }),
  z.object({ ul: z.array(z.string()).min(1) }),
  z.object({ ol: z.array(z.string()).min(1) }),
  z.object({ table: z.object({ head: z.array(z.string()).optional(), rows: z.array(z.array(z.string())).min(1) }) }),
  /** Ảnh: `file` tương đối so với thư mục assets. */
  z.object({ image: z.string().min(1), alt: z.string().min(1) }),
  /** Audio: `file` tương đối so với thư mục assets; transcript hiện cho học viên khi luyện (bấm mở/ẩn). */
  z.object({ audio: z.string().min(1), alt: z.string().min(1), transcript: z.string().optional() }),
  /** Video (tệp .mp4/.webm tối đa 100 MB): `file` tương đối so với thư mục assets; học viên xem ngay trong đoạn văn, transcript hiện khi luyện. */
  z.object({ video: z.string().min(1), alt: z.string().min(1), transcript: z.string().optional() }),
]);
export type PassageBlockT = z.infer<typeof PassageBlock>;

export const PassageSpec = z.object({
  title: z.string().min(1).max(300),
  blocks: z.array(PassageBlock).min(1),
  questions: z.array(ExamQuestionSpec).default([]),
});

export const PracticeSpec = z
  .object({
    title: z.string().max(200).optional(),
    passages: z.array(PassageSpec).default([]),
    /** Câu hỏi không thuộc đoạn nào. */
    questions: z.array(ExamQuestionSpec).default([]),
  })
  .refine((p) => p.passages.length > 0 || p.questions.length > 0, { message: "Bài luyện phải có ít nhất một đoạn hoặc một câu hỏi" });
export type PracticeSpecT = z.infer<typeof PracticeSpec>;

// ── Chữ có dấu nhấn → nút văn bản Tiptap ─────────────────────────────────────

interface TextNode {
  type: "text";
  text: string;
  marks?: Array<{ type: string }>;
}

/** `**đậm**` và `*nghiêng*` (không lồng nhau). Chữ còn lại giữ nguyên. */
export function inlineNodes(src: string): TextNode[] {
  const out: TextNode[] = [];
  const re = /\*\*([^*]+)\*\*|\*([^*]+)\*/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    if (m.index > last) out.push({ type: "text", text: src.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ type: "text", text: m[1], marks: [{ type: "bold" }] });
    else out.push({ type: "text", text: m[2]!, marks: [{ type: "italic" }] });
    last = m.index + m[0].length;
  }
  if (last < src.length) out.push({ type: "text", text: src.slice(last) });
  return out.filter((n) => n.text !== "");
}

const para = (text: string) => {
  const content = inlineNodes(text);
  return content.length ? { type: "paragraph", content } : { type: "paragraph" };
};

export interface AssetUrls {
  image: (file: string, alt: string) => { src: string };
  audio: (file: string, alt: string, transcript?: string) => { src: string };
  video: (file: string, alt: string) => { src: string };
}

/** Khối đơn giản → tài liệu Tiptap `{type:"doc"}` (đúng tập nút của trình soạn Đoạn văn). */
export function buildPassageDoc(blocks: PassageBlockT[], assets: AssetUrls): { type: "doc"; content: unknown[] } {
  const content: unknown[] = [];
  for (const b of blocks) {
    if ("p" in b) content.push(para(b.p));
    else if ("h2" in b) content.push({ type: "heading", attrs: { level: 2 }, content: inlineNodes(b.h2) });
    else if ("h3" in b) content.push({ type: "heading", attrs: { level: 3 }, content: inlineNodes(b.h3) });
    else if ("ul" in b) content.push({ type: "bulletList", content: b.ul.map((t) => ({ type: "listItem", content: [para(t)] })) });
    else if ("ol" in b) content.push({ type: "orderedList", content: b.ol.map((t) => ({ type: "listItem", content: [para(t)] })) });
    else if ("table" in b) {
      const rows: unknown[] = [];
      if (b.table.head) rows.push({ type: "tableRow", content: b.table.head.map((t) => ({ type: "tableHeader", content: [para(t)] })) });
      for (const r of b.table.rows) rows.push({ type: "tableRow", content: r.map((t) => ({ type: "tableCell", content: [para(t)] })) });
      content.push({ type: "table", content: rows });
    } else if ("image" in b) content.push({ type: "image", attrs: { ...assets.image(b.image, b.alt), alt: b.alt } });
    else if ("audio" in b) content.push({ type: "audio", attrs: { ...assets.audio(b.audio, b.alt, b.transcript), alt: b.alt } });
    else if ("video" in b) content.push({ type: "video", attrs: { ...assets.video(b.video, b.alt), alt: b.alt } });
  }
  return { type: "doc", content };
}

/** Tệp audio mà một câu nhắc tới: audio bài mẫu và audio từng lượt của hội thoại đóng vai. */
export function questionAudioFiles(q: ExamQuestionSpecT): string[] {
  return [
    ...(q.sampleAudio ? [q.sampleAudio] : []),
    ...(q.roleplay?.turns ?? []).flatMap((t) => (t.audio ? [t.audio] : [])),
    ...(q.freechat?.scaffold?.model?.audio ? [q.freechat.scaffold.model.audio] : []),
  ];
}

/** Mọi tệp (ảnh/audio) mà các đoạn nhắc tới, theo thứ tự xuất hiện. */
export function practiceAssetFiles(p: PracticeSpecT): string[] {
  const out: string[] = [];
  for (const ps of p.passages) {
    for (const b of ps.blocks) {
      if ("image" in b) out.push(b.image);
      if ("audio" in b) out.push(b.audio);
      if ("video" in b) out.push(b.video);
    }
    for (const q of ps.questions) out.push(...questionAudioFiles(q));
  }
  for (const q of p.questions) out.push(...questionAudioFiles(q));
  return out;
}

// ── Câu hỏi → { type, prompt, config } ───────────────────────────────────────

/**
 * `scaffold.model.audio` trong tệp nguồn là đường dẫn tương đối so với thư mục assets; trong cấu hình câu thì là `/api/exam-assets/<tên>` của tệp đã tải lên
 * (`modelAudio`, do tầng ghi truyền vào). Chưa có tệp đã tải thì bỏ trường audio (đoạn mẫu chỉ có chữ).
 */
function withModelAudio<T extends { scaffold?: { model?: { text: string; audio?: string } } }>(fc: T, modelAudio?: string): T {
  const model = fc.scaffold?.model;
  if (!model) return fc;
  const { audio: _file, ...rest } = model;
  return { ...fc, scaffold: { ...fc.scaffold, model: { ...rest, ...(modelAudio ? { audio: modelAudio } : {}) } } };
}

/** `explanationAudio`: đường dẫn `/api/exam-assets/<tên>` của audio bài mẫu — do tầng ghi (đã tải tệp lên) truyền vào. */
export function expandExamQuestion(q: ExamQuestionSpecT, explanationAudio?: string, turnAudio?: Array<string | undefined>, modelAudio?: string): { type: ExamQuestionSpecT["type"]; prompt: string; config: unknown; points?: number } {
  const explanation = q.explanation?.trim() ? { explanation: q.explanation.trim() } : {};
  const matchMode = q.caseSensitive ? "exact" : "case_insensitive";
  let config: unknown;
  switch (q.type) {
    case "mcq":
    case "multi":
      config = { options: (q.options ?? []).map((o, i) => ({ id: `o${i + 1}`, label: o.label, isCorrect: o.isCorrect })), ...explanation };
      break;
    case "true_false_notgiven":
      config = { correct: q.correct, ...explanation };
      break;
    case "short_answer":
      // Trình luyện đề chấm tay `short_answer`; để học viên thấy đúng/sai ngay thì nhập thành `gap_fill` một ô (chấm tự động).
      return expandExamQuestion({ ...q, type: "gap_fill", blanks: [q.answers ?? []] });
    case "gap_fill":
      config = { blanks: (q.blanks ?? []).map((a, i) => ({ id: `b${i + 1}`, acceptedAnswers: a, matchMode })), ...explanation };
      break;
    case "matching":
      config = { pairs: (q.pairs ?? []).map((p, i) => ({ id: `p${i + 1}`, left: p.left, right: p.right })), ...explanation };
      break;
    case "ordering":
      config = { items: (q.sequence ?? []).map((label, i) => ({ id: `i${i + 1}`, label })), ...explanation };
      break;
    case "numerical":
      config = { expected: q.expected, tolerance: q.tolerance ?? 0, ...explanation };
      break;
    case "drag_drop_fill":
      config = { tokens: (q.tokens ?? []).map((t, i) => ({ id: `t${i + 1}`, label: t.label, blankIndex: t.blank ?? null })), ...explanation };
      break;
    case "essay":
      config = {
        ...(q.rubric ? { rubric: q.rubric } : {}),
        ...(q.minWords ? { minWords: q.minWords } : {}),
        ...(q.voiceAnswer === false ? { voiceAnswer: false } : {}),
        ...(q.aiFeedback === false ? { aiFeedback: false } : {}),
        ...(explanationAudio ? { explanationAudio } : {}),
        ...(q.roleplay
          ? {
              roleplay: {
                ...(q.roleplay.roles ? { roles: q.roleplay.roles } : {}),
                turns: q.roleplay.turns.map((t, i) => ({ speaker: t.speaker, text: t.text, ...(turnAudio?.[i] ? { audio: turnAudio[i] } : {}) })),
              },
            }
          : {}),
        ...(q.freechat ? { freechat: withModelAudio(q.freechat, modelAudio) } : {}),
        ...explanation,
      };
      break;
  }
  return { type: q.type, prompt: q.prompt.trim(), config, ...(q.points !== undefined ? { points: q.points } : {}) };
}

/** Kiểm từng câu qua đúng bộ kiểm của API (CreateExamQuestionInput + schema cấu hình). Trả về danh sách lỗi. */
export function practiceProblems(p: PracticeSpecT, where: string): string[] {
  const out: string[] = [];
  const check = (q: ExamQuestionSpecT, label: string) => {
    if (q.type !== "essay") {
      const stray = [q.sampleAudio && "sampleAudio", q.voiceAnswer !== undefined && "voiceAnswer", q.aiFeedback !== undefined && "aiFeedback", q.roleplay && "roleplay", q.freechat && "freechat"].filter(Boolean);
      if (stray.length) out.push(`${where} / ${label}: ${stray.join(", ")} chỉ dùng cho câu essay (câu này là ${q.type})`);
    }
    if (q.roleplay && q.freechat) out.push(`${where} / ${label}: roleplay và freechat không dùng cùng một câu (chọn một)`);
    const e = expandExamQuestion(q);
    const base = CreateExamQuestionInput.safeParse({ type: e.type, prompt: e.prompt, config: e.config, points: e.points });
    if (!base.success) {
      out.push(`${where} / ${label}: ${JSON.stringify(base.error.flatten().fieldErrors)}`);
      return;
    }
    const cfg = configSchemaForType(e.type).safeParse(e.config);
    if (!cfg.success) {
      const msgs = [...cfg.error.issues.map((i) => i.message)].join("; ");
      out.push(`${where} / ${label}: cấu hình sai — ${msgs}`);
    }
    if (q.type === "drag_drop_fill") {
      const marks = [...q.prompt.matchAll(/\[\[(\d+)\]\]/g)].map((m) => Number(m[1]));
      const blanks = (q.tokens ?? []).map((t) => t.blank).filter((b): b is number => b !== undefined);
      if (marks.slice().sort().join() !== blanks.slice().sort().join()) out.push(`${where} / ${label}: ô [[N]] trong đề không khớp các thẻ có blank`);
    }
  };
  p.passages.forEach((ps, pi) => ps.questions.forEach((q, qi) => check(q, `đoạn ${pi + 1} "${ps.title}" / câu ${qi + 1}`)));
  p.questions.forEach((q, qi) => check(q, `câu ${qi + 1}`));
  return out;
}

export function practiceQuestionCount(p: PracticeSpecT): number {
  return p.questions.length + p.passages.reduce((s, x) => s + x.questions.length, 0);
}

// ── Tệp: kiểm tra có mặt, ghi vào kho ───────────────────────────────────────

export const AUDIO_EXT: Record<string, string> = { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg", ".weba": "audio/webm" };
export const IMAGE_EXT: Record<string, string> = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif" };
export const VIDEO_EXT: Record<string, string> = { ".mp4": "video/mp4", ".webm": "video/webm" };
export const AUDIO_MAX_BYTES = 25 * 1024 * 1024;
export const VIDEO_MAX_BYTES = 100 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/** Lỗi của các tệp mà Bài luyện nhắc tới: thiếu tệp, sai đuôi, quá nặng. */
export function assetProblems(p: PracticeSpecT, assetsDir: string, where: string): string[] {
  const out: string[] = [];
  for (const ps of p.passages) {
    for (const b of ps.blocks) {
      const file = "image" in b ? b.image : "audio" in b ? b.audio : "video" in b ? b.video : null;
      if (!file) continue;
      const kind = "image" in b ? "ảnh" : "video" in b ? "video" : "audio";
      const ext = path.extname(file).toLowerCase();
      const table = "image" in b ? IMAGE_EXT : "video" in b ? VIDEO_EXT : AUDIO_EXT;
      const full = path.resolve(assetsDir, file);
      if (!table[ext]) out.push(`${where}: ${kind} "${file}" sai định dạng (${Object.keys(table).join(", ")})`);
      else if (!existsSync(full)) out.push(`${where}: không thấy tệp ${kind} "${file}" trong ${assetsDir}`);
      else if (statSync(full).size > ("image" in b ? IMAGE_MAX_BYTES : "video" in b ? VIDEO_MAX_BYTES : AUDIO_MAX_BYTES)) out.push(`${where}: ${kind} "${file}" quá nặng`);
    }
  }
  // Audio bài mẫu của câu essay (câu loại khác đã bị `practiceProblems` báo).
  const allQs = [...p.passages.flatMap((ps) => ps.questions), ...p.questions];
  const audioFiles: Array<{ file: string; what: string }> = [
    ...allQs.flatMap((q) => (q.sampleAudio ? [{ file: q.sampleAudio, what: "audio bài mẫu" }] : [])),
    ...allQs.flatMap((q) => (q.roleplay?.turns ?? []).flatMap((t, i) => (t.audio ? [{ file: t.audio, what: `audio lượt ${i + 1} của hội thoại` }] : []))),
    ...allQs.flatMap((q) => (q.freechat?.scaffold?.model?.audio ? [{ file: q.freechat.scaffold.model.audio, what: "audio đoạn nói mẫu của bạn ảo" }] : [])),
  ];
  for (const { file, what } of audioFiles) {
    const ext = path.extname(file).toLowerCase();
    const full = path.resolve(assetsDir, file);
    if (!AUDIO_EXT[ext]) out.push(`${where}: ${what} "${file}" sai định dạng (${Object.keys(AUDIO_EXT).join(", ")})`);
    else if (!existsSync(full)) out.push(`${where}: không thấy tệp ${what} "${file}" trong ${assetsDir}`);
    else if (statSync(full).size > AUDIO_MAX_BYTES) out.push(`${where}: ${what} "${file}" quá nặng`);
  }
  return out;
}

export function uploadsRoot(): string {
  return process.env.UPLOADS_ROOT ?? path.resolve(process.cwd(), "../../apps/web/uploads");
}

/** Ghi một tệp vào lớp `public` của kho cục bộ: `<kind>/yyyy/mm/<tên>`. Trả tên tệp, loại và dung lượng. */
export async function storePublicFile(kind: string, localPath: string, namePrefix: string): Promise<{ filename: string; mime: string; size: number }> {
  const ext = path.extname(localPath).toLowerCase();
  const mime = AUDIO_EXT[ext] ?? IMAGE_EXT[ext] ?? VIDEO_EXT[ext];
  if (!mime) throw new Error(`Đuôi tệp không hỗ trợ: ${localPath}`);
  const buf = await readFile(localPath);
  const now = new Date();
  const filename = `${namePrefix}-${now.getTime()}-${randomBytes(8).toString("hex")}${ext}`;
  const dest = path.join(uploadsRoot(), "public", kind, String(now.getUTCFullYear()), String(now.getUTCMonth() + 1).padStart(2, "0"), filename);
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, buf);
  return { filename, mime, size: buf.length };
}

// ── Tham chiếu ảnh trong thân bài: `asset:<tệp>` → đường dẫn đã tải lên ──────────

const ASSET_REF = /asset:([A-Za-z0-9_./-]+\.(?:png|jpe?g|webp|gif))/g;

/** Các tệp ảnh được nhắc bằng `asset:<tệp>` trong một đoạn chữ (thân bài markdown). */
export function bodyAssetRefs(text: string | undefined): string[] {
  return text ? [...text.matchAll(ASSET_REF)].map((m) => m[1]!) : [];
}

export function replaceBodyAssetRefs(text: string, urls: Map<string, string>): string {
  return text.replace(ASSET_REF, (_all, file: string) => urls.get(file) ?? `asset:${file}`);
}
