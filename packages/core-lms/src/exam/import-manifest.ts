import { z } from "zod";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditCourse } from "../courses/authz";
import { createExam, publishExam, updateExam } from "./exams";
import { createExamQuestion } from "./questions";
import { createPassage } from "./passages";
import { createSection } from "./sections";
import { ExamError } from "./types";

/**
 * LANG L6.8 — nhập hàng loạt đề từ manifest JSON vào một khoá luyện đề. Mỗi đề = đề thi thử MỘT phần một kỹ năng.
 *
 * - dry-run: kiểm tra và báo từng đề, KHÔNG ghi gì (kể cả bộ);
 * - tạo ở trạng thái NHÁP (tuỳ chọn `publish`), qua đúng các hàm dịch vụ giao diện dùng;
 * - chạy lại không tạo trùng: nhận biết theo (nguồn + số thứ tự) trong khoá;
 * - một đề lỗi không chặn đề khác và không để lại đề dở.
 * Audio phải là file đã tải lên hệ thống (đường dẫn /api/...), không nhận URL ngoài.
 */

export const IMPORT_MAX_EXAMS = 500;
const HOSTED_AUDIO = /^\/api\/(lesson-media|assignment-media|exam-assets)\/[A-Za-z0-9._\/-]+$/;

const Skill = z.enum(["listening", "reading", "writing", "speaking"]);

const Option = z.object({ label: z.string().trim().min(1).max(500), correct: z.boolean().optional() });
const Question = z.object({
  type: z.literal("mcq"),
  prompt: z.string().trim().min(1).max(5000),
  options: z.array(Option).min(2).max(8),
  passage: z.number().int().min(0).optional(),
  points: z.number().positive().max(100).optional(),
});
const Passage = z.object({
  title: z.string().trim().min(1).max(300),
  text: z.string().max(50_000).default(""),
  audioUrl: z.string().max(500).optional(),
  audioPolicy: z.enum(["free_replay", "limited_replay", "once_only"]).optional(),
  maxAudioPlays: z.number().int().min(1).max(10).optional(),
});
const ManifestExam = z.object({
  title: z.string().trim().min(1).max(200),
  skill: Skill.optional(),
  minutes: z.number().int().min(1).max(240).optional(),
  collection: z.string().trim().min(1).max(200).optional(),
  seq: z.number().int().min(0).max(100_000).optional(),
  paperType: z.enum(["official", "mock", "practice_set"]).optional(),
  sourceLabel: z.string().trim().max(120).optional(),
  yearLabel: z.string().trim().max(40).optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional(),
  freePreview: z.boolean().optional(),
  passages: z.array(Passage).max(20).default([]),
  questions: z.array(Question).max(300).default([]),
});
const Manifest = z.object({ exams: z.array(z.unknown()).min(1).max(IMPORT_MAX_EXAMS) });

export interface ImportOptions {
  dryRun?: boolean;
  publish?: boolean;
  /** Kỹ năng áp cho đề không khai `skill`. */
  defaultSkill?: z.infer<typeof Skill>;
}

export interface ImportRowResult {
  index: number;
  title: string;
  status: "created" | "would_create" | "skipped_duplicate" | "error";
  errors: string[];
  examId?: string;
  published?: boolean;
}

export interface ImportResult {
  results: ImportRowResult[];
  summary: { total: number; created: number; wouldCreate: number; skipped: number; failed: number };
}

const DEFAULT_MINUTES = { listening: 30, reading: 45, writing: 45, speaking: 15 } as const;
const doc = (text: string, audioUrl?: string) => ({
  type: "doc",
  content: [
    ...(text.trim() ? text.split(/\n{2,}/).map((p) => ({ type: "paragraph", content: [{ type: "text", text: p.trim() }] })) : []),
    ...(audioUrl ? [{ type: "audio", attrs: { src: audioUrl, alt: "Audio" } }] : []),
  ],
});

/** Lỗi kiểm tra của MỘT đề (mảng rỗng = hợp lệ). */
function checkExam(raw: unknown, opts: ImportOptions): { exam?: z.infer<typeof ManifestExam>; errors: string[]; title: string } {
  const title = typeof (raw as { title?: unknown })?.title === "string" ? ((raw as { title: string }).title.trim() || "(không tên)") : "(không tên)";
  const parsed = ManifestExam.safeParse(raw);
  if (!parsed.success) {
    return { title, errors: parsed.error.issues.map((i) => `${i.path.join(".") || "đề"}: ${i.message}`) };
  }
  const e = parsed.data;
  const errors: string[] = [];
  if (!(e.skill ?? opts.defaultSkill)) errors.push("skill: thiếu kỹ năng (khai `skill` hoặc dùng --skill)");
  if (e.questions.length === 0) errors.push("questions: đề cần ít nhất 1 câu hỏi");
  e.passages.forEach((p, i) => {
    if (p.audioUrl && !HOSTED_AUDIO.test(p.audioUrl)) errors.push(`passages[${i}].audioUrl: audio phải là file đã tải lên hệ thống (/api/...), không nhận URL ngoài`);
    if (p.audioPolicy === "limited_replay" && !p.maxAudioPlays) errors.push(`passages[${i}]: limited_replay cần maxAudioPlays`);
  });
  e.questions.forEach((q, i) => {
    const right = q.options.filter((o) => o.correct).length;
    if (right !== 1) errors.push(`questions[${i}]: câu trắc nghiệm cần đúng 1 đáp án đúng (đang có ${right})`);
    if (q.passage !== undefined && q.passage >= e.passages.length) errors.push(`questions[${i}].passage: bài đọc số ${q.passage} không tồn tại`);
  });
  return { exam: errors.length ? undefined : e, errors, title };
}

export async function importExamManifest(
  actorUserId: string,
  courseId: string,
  rawManifest: unknown,
  opts: ImportOptions = {},
  db: PrismaClient = prisma,
): Promise<ImportResult> {
  await assertCanEditCourse(actorUserId, courseId, db);
  const m = Manifest.safeParse(rawManifest);
  if (!m.success) throw new ExamError("validation_failed", m.error.flatten());

  const existing = await db.exam.findMany({ where: { courseId, seq: { not: null }, sourceLabel: { not: null } }, select: { sourceLabel: true, seq: true } });
  const seen = new Set(existing.map((e) => `${e.sourceLabel}#${e.seq}`));
  const collections = new Map((await db.examCollection.findMany({ where: { courseId }, select: { id: true, title: true } })).map((c) => [c.title, c.id]));
  const results: ImportRowResult[] = [];
  /** Khoá (nguồn#số thứ tự) đã được tạo/định tạo TRONG lần chạy này — để phân biệt với đề có sẵn từ lần trước. */
  const createdKeys = new Set<string>();

  for (const [index, raw] of m.data.exams.entries()) {
    const chk = checkExam(raw, opts);
    if (!chk.exam) {
      results.push({ index, title: chk.title, status: "error", errors: chk.errors });
      continue;
    }
    const e = chk.exam;
    const key = e.sourceLabel && e.seq !== undefined ? `${e.sourceLabel}#${e.seq}` : null;
    if (key && seen.has(key)) {
      // Có sẵn trong DB (lần nhập trước) hay trùng NGAY TRONG manifest này đều không tạo hai bản.
      const inThisRun = createdKeys.has(key);
      results.push(
        inThisRun
          ? { index, title: e.title, status: "error", errors: [`trùng nguồn + số thứ tự (${key}) với một đề khác trong manifest`] }
          : { index, title: e.title, status: "skipped_duplicate", errors: [] },
      );
      continue;
    }
    if (opts.dryRun) {
      if (key) {
        seen.add(key);
        createdKeys.add(key);
      }
      results.push({ index, title: e.title, status: "would_create", errors: [] });
      continue;
    }

    let examId: string | null = null;
    try {
      const skill = (e.skill ?? opts.defaultSkill)!;
      const minutes = e.minutes ?? DEFAULT_MINUTES[skill];
      let collectionId: string | null = null;
      if (e.collection) {
        collectionId = collections.get(e.collection) ?? null;
        if (!collectionId) {
          const last = await db.examCollection.aggregate({ where: { courseId }, _max: { orderIndex: true } });
          collectionId = (await db.examCollection.create({ data: { courseId, title: e.collection, orderIndex: (last._max.orderIndex ?? -1) + 1 }, select: { id: true } })).id;
          collections.set(e.collection, collectionId);
        }
      }
      examId = (await createExam(actorUserId, courseId, { title: e.title, durationMin: minutes, mockMode: true }, db)).examId;
      const section = await createSection(actorUserId, examId, { title: skill === "listening" ? "Nghe" : skill === "reading" ? "Đọc" : skill === "writing" ? "Viết" : "Nói", durationMin: minutes, languageSkill: skill }, db);
      const meta = {
        ...(collectionId ? { collectionId } : {}),
        ...(e.seq !== undefined ? { seq: e.seq } : {}),
        ...(e.paperType ? { paperType: e.paperType } : {}),
        ...(e.sourceLabel ? { sourceLabel: e.sourceLabel } : {}),
        ...(e.yearLabel ? { yearLabel: e.yearLabel } : {}),
        ...(e.difficulty ? { difficulty: e.difficulty } : {}),
        ...(e.tags ? { tags: e.tags } : {}),
        ...(e.freePreview !== undefined ? { freePreview: e.freePreview } : {}),
      };
      if (Object.keys(meta).length) await updateExam(actorUserId, examId, meta, db);
      const passageIds: string[] = [];
      for (const p of e.passages) {
        const { passageId } = await createPassage(
          actorUserId,
          examId,
          {
            title: p.title,
            contentJson: doc(p.text, p.audioUrl),
            ...(p.audioPolicy ? { audioPolicy: p.audioPolicy } : {}),
            ...(p.maxAudioPlays ? { maxAudioPlays: p.maxAudioPlays } : {}),
          },
          db,
        );
        passageIds.push(passageId);
      }
      for (const q of e.questions) {
        await createExamQuestion(
          actorUserId,
          examId,
          {
            type: "mcq",
            prompt: q.prompt,
            ...(q.points ? { points: q.points } : {}),
            sectionId: section.id,
            ...(q.passage !== undefined ? { passageId: passageIds[q.passage] } : {}),
            config: { options: q.options.map((o, i) => ({ id: String.fromCharCode(97 + i), label: o.label, isCorrect: !!o.correct })) },
          },
          db,
        );
      }
      let published = false;
      const errors: string[] = [];
      if (opts.publish) {
        try {
          await publishExam(actorUserId, examId, db);
          published = true;
        } catch (err) {
          errors.push(`không xuất bản được: ${(err as { code?: string }).code ?? "error"}`);
        }
      }
      if (key) {
        seen.add(key);
        createdKeys.add(key);
      }
      results.push({ index, title: e.title, status: "created", errors, examId, ...(opts.publish ? { published } : {}) });
    } catch (err) {
      // Không để lại đề dở.
      if (examId) await db.exam.delete({ where: { id: examId } }).catch(() => undefined);
      const code = (err as { code?: string }).code ?? (err as Error).message;
      results.push({ index, title: e.title, status: "error", errors: [`tạo đề thất bại: ${code}`] });
    }
  }

  return {
    results,
    summary: {
      total: results.length,
      created: results.filter((r) => r.status === "created").length,
      wouldCreate: results.filter((r) => r.status === "would_create").length,
      skipped: results.filter((r) => r.status === "skipped_duplicate").length,
      failed: results.filter((r) => r.status === "error").length,
    },
  };
}
