import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import {
  canEditExam,
  commitWordExamImport,
  parseExamWord,
  wordPromptToText,
  type WordCommitResult,
  type WordParseResult,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { examAssetKey } from "@/lib/storage-keys";

/** Nhập câu hỏi từ file Word — docs/tieu-chi/nhap-de-thi-tu-word.md. Phần dùng chung của hai route word-preview và word-commit. */

export const WORD_MAX_BYTES = 20 * 1024 * 1024;

export type WordUpload = { userId: string; examId: string; buf: Buffer; includeWarnings: boolean };

/** Xác thực, kiểm quyền/trạng thái đề, đọc và kiểm file tải lên. Trả `NextResponse` khi bị từ chối. */
export async function readWordUpload(req: Request, examId: string): Promise<WordUpload | NextResponse> {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: {
      id: true,
      courseId: true,
      createdById: true,
      status: true,
      purpose: true,
      _count: { select: { attempts: true } },
    },
  });
  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  if (!(await canEditExam(userId, exam))) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  // Câu có đáp án đúng — không dùng cho đề Khảo sát (docs/tieu-chi/de-thi-khao-sat.md).
  if (exam.purpose === "survey") return NextResponse.json({ error: "survey_import_unsupported" }, { status: 400 });
  if (exam.status === "published" && exam._count.attempts > 0) {
    return NextResponse.json({ error: "exam_has_attempts" }, { status: 409 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  }
  if (file.size > WORD_MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large", details: { maxBytes: WORD_MAX_BYTES } }, { status: 413 });
  }
  const buf = Buffer.from(await file.arrayBuffer());
  // .docx là một tệp ZIP ("PK"); .doc đời cũ (OLE, D0 CF) và mọi thứ khác không đọc được.
  if (buf.length < 4 || buf[0] !== 0x50 || buf[1] !== 0x4b) {
    return NextResponse.json({ error: "invalid_docx" }, { status: 415 });
  }
  return { userId, examId, buf, includeWarnings: form.get("includeWarnings") === "true" };
}

/** Đọc file; null khi file hỏng (mammoth không mở được). */
export async function parseWordUpload(buf: Buffer): Promise<WordParseResult | null> {
  try {
    return await parseExamWord(buf);
  } catch {
    return null;
  }
}

/** Dạng gửi cho bảng xem trước: giống `ParsedRow` của ImportQuestionsModal, đề bài rút thành chữ, thêm số ảnh. */
export function previewPayload(r: WordParseResult) {
  return {
    summary: r.summary,
    notes: r.notes,
    passages: r.passages.map((p) => ({
      key: p.key,
      title: p.title,
      questionCount: p.questionCount,
      imageCount: p.imageIndexes.length,
      error: p.error ?? null,
    })),
    imageCount: r.images.length,
    rows: r.rows.map((row) => ({
      rowNumber: row.rowNumber,
      status: row.status,
      errors: row.errors,
      warnings: row.warnings,
      ...(row.parsed
        ? {
            parsed: {
              type: row.parsed.type,
              prompt: wordPromptToText(row.parsed.prompt) || "(chỉ có ảnh)",
              points: row.parsed.points,
              difficulty: row.parsed.difficulty,
              passageId: null,
              passageTitleRaw: row.parsed.passageTitleRaw,
              skillIds: [],
              unresolvedSkillCodes: [],
              config: row.parsed.config,
              imageCount: row.imageIndexes.length,
            },
          }
        : {}),
    })),
  };
}

/** Ghi vào đề (logic ở core-lms: ảnh → đoạn văn → câu hỏi); đây chỉ cấp chỗ lưu tệp ảnh. */
export async function commitWordImport(
  userId: string,
  examId: string,
  parse: WordParseResult,
  includeWarnings: boolean,
): Promise<WordCommitResult> {
  return commitWordExamImport(userId, examId, parse, {
    includeWarnings,
    store: {
      async save(filename, data, contentType) {
        const key = examAssetKey(new Date(), filename);
        await storageFor(key).put(key.key, data, contentType);
      },
      async remove(filename) {
        const key = examAssetKey(new Date(), filename);
        await storageFor(key).delete(key.key);
      },
    },
  });
}
