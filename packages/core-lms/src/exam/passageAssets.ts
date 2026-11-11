import { prisma, type PrismaClient } from "@feedbackme/db";
import { assertCanEditExam } from "../courses/authz";
import { ExamError } from "./types";

/**
 * Ảnh/audio của đoạn văn: dọn tệp mồ côi khi gỡ khỏi đoạn, soạn và lấy transcript.
 * docs/tieu-chi/bai-doc-anh-audio-xoa-transcript.md (AC1, AC3, AC4).
 *
 * Transcript KHÔNG nằm trong tài liệu đoạn văn (tài liệu được gửi nguyên xuống trình duyệt học viên): nó ở
 * `ExamAsset.transcript`, tra bằng tên tệp lấy từ `src` của nút audio, và chỉ được đưa xuống khi chế độ làm bài cho phép.
 */

/** Tên tệp trong một đường dẫn `/api/exam-assets/<tên>` (có hoặc không có tiền tố basePath); không phải đường dẫn của kho này thì null. */
export function examAssetFilename(src: unknown): string | null {
  if (typeof src !== "string") return null;
  const m = /\/api\/exam-assets\/([A-Za-z0-9._-]+)(?:[?#].*)?$/.exec(src);
  return m ? m[1]! : null;
}

function collect(node: unknown, types: ReadonlySet<string>, out: Set<string>): void {
  if (!node || typeof node !== "object") return;
  const n = node as { type?: string; attrs?: { src?: unknown }; content?: unknown[] };
  if (n.type && types.has(n.type)) {
    const f = examAssetFilename(n.attrs?.src);
    if (f) out.add(f);
  }
  if (Array.isArray(n.content)) for (const c of n.content) collect(c, types, out);
}

/** Tên các tệp ảnh và audio của kho đề mà tài liệu đoạn văn đang dùng. */
export function assetFilenamesInDoc(doc: unknown): string[] {
  const out = new Set<string>();
  collect(doc, new Set(["image", "audio"]), out);
  return [...out];
}

/** Tên các tệp audio trong tài liệu đoạn văn. */
export function audioFilenamesInDoc(doc: unknown): string[] {
  const out = new Set<string>();
  collect(doc, new Set(["audio"]), out);
  return [...out];
}

const VIDEO_UPLOAD_RE = /\/api\/lesson-media\/videos\/([A-Za-z0-9._-]+)(?:[?#].*)?$/;

/**
 * Khoá của một video trong đoạn văn để gắn transcript: video tải lên (kho video bài học) → tên tệp; video dán link (YouTube,
 * Vimeo, Drive…) → `link:<đường dẫn>`. Transcript của video lưu ở một dòng `ExamAsset` (type=video) tạo khi lưu transcript lần đầu.
 */
export function videoAssetKey(src: unknown): string | null {
  if (typeof src !== "string" || src.trim() === "") return null;
  const m = VIDEO_UPLOAD_RE.exec(src);
  return m ? m[1]! : `link:${src.trim()}`;
}

/** Chuỗi cần tìm trong JSON để biết khoá video còn được dùng không. */
function videoNeedle(key: string): string {
  return key.startsWith("link:") ? key.slice(5) : key;
}

/** Khoá các video trong tài liệu đoạn văn. */
export function videoKeysInDoc(doc: unknown): string[] {
  const out = new Set<string>();
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return;
    const n = node as { type?: string; attrs?: { src?: unknown }; content?: unknown[] };
    if (n.type === "video") {
      const k = videoAssetKey(n.attrs?.src);
      if (k) out.add(k);
    }
    if (Array.isArray(n.content)) for (const c of n.content) walk(c);
  };
  walk(doc);
  return [...out];
}

/** Khoá transcript của mọi audio (tên tệp) và video (khoá video) trong tài liệu đoạn văn. */
export function transcriptKeysInDoc(doc: unknown): { audio: string[]; video: string[] } {
  return { audio: audioFilenamesInDoc(doc), video: videoKeysInDoc(doc) };
}

/** Tệp còn được đoạn khác (trừ `exceptPassageId`) hoặc câu hỏi nào của đề nhắc tới không? */
async function stillUsedInExam(examId: string, filename: string, exceptPassageId: string | null, db: PrismaClient): Promise<boolean> {
  const [passages, questions] = await Promise.all([
    db.examPassage.findMany({ where: { examId }, select: { id: true, contentJson: true } }),
    db.examQuestion.findMany({ where: { examId }, select: { prompt: true, config: true } }),
  ]);
  for (const p of passages) {
    if (p.id === exceptPassageId) continue;
    if (JSON.stringify(p.contentJson).includes(filename)) return true;
  }
  for (const q of questions) {
    if (q.prompt.includes(filename) || JSON.stringify(q.config).includes(filename)) return true;
  }
  return false;
}

/**
 * Sau khi đoạn văn được lưu: các tệp CÓ trong nội dung cũ mà không còn trong nội dung mới (và không đoạn/câu nào khác dùng)
 * bị xoá khỏi bảng `ExamAsset` của đề. Trả về tên các tệp mà **không còn dòng nào** (kể cả đề khác, vì nhân bản đề dùng chung tệp)
 * trỏ tới, để lớp gọi xoá khỏi kho lưu trữ. Chỉ dọn những gì đoạn này từng dùng: ảnh vừa tải lên mà đoạn khác chưa lưu thì không bị đụng.
 */
export async function pruneRemovedPassageAssets(
  examId: string,
  passageId: string,
  oldDoc: unknown,
  newDoc: unknown,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const keep = new Set(assetFilenamesInDoc(newDoc));
  const removed = assetFilenamesInDoc(oldDoc).filter((f) => !keep.has(f));
  const filesToDelete: string[] = [];
  for (const filename of removed) {
    if (await stillUsedInExam(examId, filename, passageId, db)) continue;
    await db.examAsset.deleteMany({ where: { examId, s3Key: filename } });
    const others = await db.examAsset.count({ where: { s3Key: filename } });
    if (others === 0) filesToDelete.push(filename);
  }
  // Video: chỉ có dòng transcript (tệp nằm ở kho video bài học, có thể dùng chỗ khác nên không xoá tệp).
  const keepVideo = new Set(videoKeysInDoc(newDoc));
  for (const key of videoKeysInDoc(oldDoc)) {
    if (keepVideo.has(key)) continue;
    if (await stillUsedInExam(examId, videoNeedle(key), passageId, db)) continue;
    await db.examAsset.deleteMany({ where: { examId, type: "video", s3Key: key } });
  }
  return filesToDelete;
}

/** Dọn như trên khi cả đoạn bị xoá. */
export async function pruneDeletedPassageAssets(examId: string, passageId: string, oldDoc: unknown, db: PrismaClient = prisma): Promise<string[]> {
  return pruneRemovedPassageAssets(examId, passageId, oldDoc, { type: "doc", content: [] }, db);
}

/** Đề nháp, hoặc đề ẩn của Bài luyện chưa lưu trữ: được dọn tệp mồ côi. Đề thường đã xuất bản thì giữ (có thể đang có người làm). */
export function canPruneAssets(exam: { status: string; ownerContentItemId: string | null }): boolean {
  return exam.ownerContentItemId ? exam.status !== "archived" : exam.status === "draft";
}

/** Tên tệp audio bài mẫu (`explanationAudio`) trong cấu hình một câu hỏi; không có thì null. */
export function explanationAudioFilename(config: unknown): string | null {
  if (!config || typeof config !== "object") return null;
  return examAssetFilename((config as { explanationAudio?: unknown }).explanationAudio);
}

/**
 * Sau khi câu hỏi được lưu (cấu hình đã ở DB là bản mới): audio bài mẫu CÓ trong cấu hình cũ mà không còn trong cấu hình mới
 * (và không đoạn/câu nào của đề nhắc tới) bị xoá khỏi bảng `ExamAsset` của đề. Trả về tên các tệp không còn dòng nào trỏ tới
 * (kể cả đề khác, vì nhân bản đề dùng chung tệp) để lớp gọi xoá khỏi kho. Chỉ dọn tệp câu này từng dùng.
 */
export async function pruneRemovedQuestionAssets(
  examId: string,
  oldConfig: unknown,
  newConfig: unknown,
  db: PrismaClient = prisma,
): Promise<string[]> {
  const oldFile = explanationAudioFilename(oldConfig);
  if (!oldFile || oldFile === explanationAudioFilename(newConfig)) return [];
  if (await stillUsedInExam(examId, oldFile, null, db)) return [];
  await db.examAsset.deleteMany({ where: { examId, s3Key: oldFile } });
  return (await db.examAsset.count({ where: { s3Key: oldFile } })) === 0 ? [oldFile] : [];
}

/** Dọn như trên khi cả câu bị xoá (hàng đã xoá khỏi DB). */
export async function pruneDeletedQuestionAssets(examId: string, oldConfig: unknown, db: PrismaClient = prisma): Promise<string[]> {
  return pruneRemovedQuestionAssets(examId, oldConfig, {}, db);
}

async function loadEditableAudio(actorUserId: string, examId: string, filename: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true, status: true, ownerContentItemId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  const asset = await db.examAsset.findFirst({
    where: { examId, s3Key: filename, type: "audio" },
    select: { id: true, altText: true, transcript: true },
  });
  if (!asset) throw new ExamError("asset_not_found");
  return { exam, asset };
}

/** Giảng viên đọc transcript của một audio (để sửa). */
export async function getAudioTranscriptForEditor(
  actorUserId: string,
  examId: string,
  filename: string,
  db: PrismaClient = prisma,
): Promise<{ transcript: string; altText: string }> {
  const { asset } = await loadEditableAudio(actorUserId, examId, filename, db);
  return { transcript: asset.transcript ?? "", altText: asset.altText ?? "" };
}

export const TRANSCRIPT_MAX_CHARS = 20_000;

/** Giảng viên đặt/sửa/xoá trắng transcript của một audio. Rỗng thì xoá. Sửa được cả khi đề đã xuất bản (đó là ghi chú, không đổi câu hỏi). */
export async function setAudioTranscript(
  actorUserId: string,
  examId: string,
  filename: string,
  transcript: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const text = transcript.replace(/\r\n/g, "\n").trim();
  if (text.length > TRANSCRIPT_MAX_CHARS) throw new ExamError("validation_failed", { field: "transcript", max: TRANSCRIPT_MAX_CHARS });
  const { exam, asset } = await loadEditableAudio(actorUserId, examId, filename, db);
  if (exam.status === "archived") throw new ExamError("exam_not_draft");
  await db.examAsset.update({ where: { id: asset.id }, data: { transcript: text === "" ? null : text } });
}

/** Các audio của đề đã có transcript (cho nhãn "Có transcript" trên thẻ audio): tên tệp → có/không. */
export async function listAudioTranscriptFlags(
  actorUserId: string,
  examId: string,
  db: PrismaClient = prisma,
): Promise<Record<string, boolean>> {
  const exam = await db.exam.findUnique({ where: { id: examId }, select: { courseId: true, createdById: true } });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  // Cả audio (khoá = tên tệp) và video (khoá = tên tệp hoặc `link:<đường dẫn>`): hai kiểu khoá không trùng nhau.
  const rows = await db.examAsset.findMany({ where: { examId, type: { in: ["audio", "video"] } }, select: { s3Key: true, transcript: true } });
  const out: Record<string, boolean> = {};
  for (const r of rows) out[r.s3Key] = !!r.transcript?.trim();
  return out;
}

async function loadEditableExam(actorUserId: string, examId: string, db: PrismaClient) {
  const exam = await db.exam.findUnique({
    where: { id: examId },
    select: { courseId: true, createdById: true, status: true, ownerContentItemId: true },
  });
  if (!exam) throw new ExamError("exam_not_found");
  await assertCanEditExam(actorUserId, exam, db);
  return exam;
}

/** Giảng viên đọc transcript của một video (tải lên hoặc dán link) để sửa; chưa có thì rỗng. */
export async function getVideoTranscriptForEditor(
  actorUserId: string,
  examId: string,
  src: string,
  db: PrismaClient = prisma,
): Promise<{ transcript: string }> {
  const key = videoAssetKey(src);
  if (!key) throw new ExamError("validation_failed", { field: "src" });
  await loadEditableExam(actorUserId, examId, db);
  const row = await db.examAsset.findFirst({ where: { examId, type: "video", s3Key: key }, select: { transcript: true } });
  return { transcript: row?.transcript ?? "" };
}

/** Giảng viên đặt/sửa/xoá trắng transcript của một video. Có chữ → tạo (hoặc sửa) dòng; rỗng → xoá dòng. */
export async function setVideoTranscript(
  actorUserId: string,
  examId: string,
  src: string,
  transcript: string,
  alt: string,
  db: PrismaClient = prisma,
): Promise<void> {
  const key = videoAssetKey(src);
  if (!key) throw new ExamError("validation_failed", { field: "src" });
  const text = transcript.replace(/\r\n/g, "\n").trim();
  if (text.length > TRANSCRIPT_MAX_CHARS) throw new ExamError("validation_failed", { field: "transcript", max: TRANSCRIPT_MAX_CHARS });
  const exam = await loadEditableExam(actorUserId, examId, db);
  if (exam.status === "archived") throw new ExamError("exam_not_draft");
  const existing = await db.examAsset.findFirst({ where: { examId, type: "video", s3Key: key }, select: { id: true } });
  if (text === "") {
    if (existing) await db.examAsset.delete({ where: { id: existing.id } });
    return;
  }
  if (existing) {
    await db.examAsset.update({ where: { id: existing.id }, data: { transcript: text } });
    return;
  }
  await db.examAsset.create({
    data: {
      examId,
      type: "video",
      s3Key: key,
      mimeType: key.startsWith("link:") ? "video/x-link" : "video/*",
      sizeBytes: 0, // dòng chỉ giữ transcript; tệp video (nếu có) nằm ở kho video bài học
      altText: alt.trim().slice(0, 500) || null,
      transcript: text,
      uploadedById: actorUserId,
    },
  });
}

/**
 * Transcript của các audio và video trong những đoạn đã cho — CHỈ gọi ở chế độ cho phép học viên xem (luyện đề, Bài luyện, xem thử của giảng viên).
 * Không bao giờ gọi cho lượt thi thử đang làm. Khoá = tên tệp; audio không có transcript thì vắng mặt.
 */
export async function getAudioTranscriptsForPassages(
  examId: string,
  passages: Array<{ contentJson: unknown }>,
  db: PrismaClient = prisma,
): Promise<Record<string, string>> {
  const audio = new Set<string>();
  const video = new Set<string>();
  for (const p of passages) {
    const k = transcriptKeysInDoc(p.contentJson);
    k.audio.forEach((f) => audio.add(f));
    k.video.forEach((f) => video.add(f));
  }
  if (audio.size === 0 && video.size === 0) return {};
  const rows = await db.examAsset.findMany({
    where: {
      examId,
      OR: [
        ...(audio.size ? [{ type: "audio" as const, s3Key: { in: [...audio] } }] : []),
        ...(video.size ? [{ type: "video" as const, s3Key: { in: [...video] } }] : []),
      ],
    },
    select: { s3Key: true, transcript: true },
  });
  const out: Record<string, string> = {};
  for (const r of rows) if (r.transcript?.trim()) out[r.s3Key] = r.transcript;
  return out;
}
