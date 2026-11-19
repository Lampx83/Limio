import { randomBytes } from "node:crypto";
import type { PrismaClient } from "@feedbackme/db";
import { prisma } from "@feedbackme/db";
import { commitExamQuestionRows } from "../imports/commitToExam";
import { createImageAsset } from "./assets";
import { createPassage } from "./passages";
import { ExamError } from "./types";
import { replaceEmbeddedImages, wordHtmlToPassageDoc } from "./importWordDoc";
import type { WordImportRow, WordParseResult } from "./importWord";

/**
 * Ghi kết quả đọc file Word vào đề — docs/tieu-chi/nhap-de-thi-tu-word.md (AC3, AC4, AC6).
 * Lưu tệp ảnh là việc của tầng web (kho tệp), nên nhận qua `store`.
 *
 * Ghi được bao nhiêu ghi bấy nhiêu (như Excel/AI): ảnh hoặc đoạn lỗi thì chỉ các câu phụ thuộc vào nó bị bỏ và được báo lỗi.
 */

export interface WordCommitStore {
  /** Lưu tệp ảnh với tên `filename` (đã sinh sẵn, duy nhất). Ném lỗi nếu không lưu được. */
  save(filename: string, data: Buffer, contentType: string): Promise<void>;
  /** Xoá tệp vừa lưu khi bước ghi DB của ảnh đó thất bại. */
  remove(filename: string): Promise<void>;
}

export interface WordCommitResult {
  imported: number;
  passagesCreated: number;
  imagesUploaded: number;
  skippedError: number;
  skippedWarning: number;
  errors: Array<{ rowNumber: number; errors: string[] }>;
}

const EXT_BY_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

function errorText(e: unknown): string {
  if (e instanceof ExamError) {
    if (e.code === "exam_not_draft") return "đề đã xuất bản nên không tải ảnh lên được; hãy chuyển đề về Nháp rồi nhập lại";
    return e.code;
  }
  return e instanceof Error ? e.message : "lỗi không rõ";
}

export async function commitWordExamImport(
  actorUserId: string,
  examId: string,
  parse: WordParseResult,
  opts: { includeWarnings: boolean; store: WordCommitStore },
  db: PrismaClient = prisma,
): Promise<WordCommitResult> {
  const errors = new Map<number, string[]>();
  const addErr = (n: number, msg: string) => errors.set(n, [...(errors.get(n) ?? []), msg]);

  let selected: WordImportRow[] = parse.rows.filter((r) =>
    opts.includeWarnings ? r.status !== "error" && r.parsed : r.status === "ok" && r.parsed,
  );
  const skippedError = parse.summary.error;
  const skippedWarning = opts.includeWarnings ? 0 : parse.summary.warning;

  // Đoạn cần tạo: có ít nhất một câu được chọn, hoặc đoạn không có câu nào và không lỗi.
  const usedKeys = new Set(selected.map((r) => r.passageKey).filter((k): k is string => !!k));
  const passagesToMake = parse.passages.filter((p) => !p.error && (usedKeys.has(p.key) || p.questionCount === 0));

  // Ảnh cần tải: của câu được chọn + của đoạn sẽ tạo.
  const needed = new Set<number>([...selected.flatMap((r) => r.imageIndexes), ...passagesToMake.flatMap((p) => p.imageIndexes)]);
  const urlOf = new Map<number, string>();
  const imageFail = new Map<number, string>();
  for (const idx of needed) {
    const img = parse.images[idx];
    if (!img) continue;
    const filename = `${examId}-${Date.now()}-${randomBytes(8).toString("hex")}.${EXT_BY_MIME[img.contentType] ?? "png"}`;
    try {
      await opts.store.save(filename, img.data, img.contentType);
    } catch (e) {
      imageFail.set(idx, errorText(e));
      continue;
    }
    try {
      await createImageAsset(
        actorUserId,
        examId,
        { s3Key: filename, mimeType: img.contentType, sizeBytes: img.data.length, altText: img.alt || "Hình minh hoạ" },
        db,
      );
      urlOf.set(idx, `/api/exam-assets/${filename}`);
    } catch (e) {
      await opts.store.remove(filename).catch(() => undefined);
      imageFail.set(idx, errorText(e));
    }
  }
  const srcOf = (i: number) => urlOf.get(i) ?? null;

  // Đoạn văn.
  const passageId = new Map<string, string>();
  const passageFail = new Map<string, string>();
  let passagesCreated = 0;
  for (const p of passagesToMake) {
    const badImg = p.imageIndexes.find((i) => imageFail.has(i));
    if (badImg !== undefined) {
      passageFail.set(p.key, `Đoạn văn “${p.title}”: ảnh không tải lên được (${imageFail.get(badImg)})`);
      continue;
    }
    try {
      const r = await createPassage(actorUserId, examId, { title: p.title, contentJson: wordHtmlToPassageDoc(p.html, srcOf) }, db);
      passageId.set(p.key, r.passageId);
      passagesCreated++;
    } catch (e) {
      passageFail.set(p.key, `Đoạn văn “${p.title}”: ${errorText(e)}`);
    }
  }

  // Câu hỏi: bỏ câu phụ thuộc vào ảnh/đoạn lỗi, còn lại thay đường dẫn ảnh và gắn đoạn.
  selected = selected.filter((r) => {
    const badImg = r.imageIndexes.find((i) => imageFail.has(i));
    if (badImg !== undefined) {
      addErr(r.rowNumber, `Ảnh không tải lên được (${imageFail.get(badImg)})`);
      return false;
    }
    if (r.passageKey && passageFail.has(r.passageKey)) {
      addErr(r.rowNumber, passageFail.get(r.passageKey)!);
      return false;
    }
    return true;
  });
  const rows = selected.map((r) => ({
    ...r,
    parsed: {
      ...r.parsed!,
      prompt: replaceEmbeddedImages(r.parsed!.prompt, srcOf),
      passageId: r.passageKey ? (passageId.get(r.passageKey) ?? null) : null,
    },
  }));

  const { imported, errors: writeErrors } = await commitExamQuestionRows(actorUserId, examId, rows, db);
  for (const e of writeErrors) addErr(e.rowNumber, e.message);

  return {
    imported,
    passagesCreated,
    imagesUploaded: urlOf.size,
    skippedError,
    skippedWarning,
    errors: [
      ...parse.rows.filter((r) => r.status === "error").map((r) => ({ rowNumber: r.rowNumber, errors: r.errors })),
      ...[...errors].map(([rowNumber, errs]) => ({ rowNumber, errors: errs })),
    ],
  };
}
