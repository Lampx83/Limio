import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  createOralMaterialDocument,
  extractMaterialText,
  ExamError,
  listOralMaterials,
  MATERIAL_FILE_MIME_TYPES,
  MATERIAL_MAX_BYTES,
} from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { storageFor } from "@/lib/storage";
import { oralExamMaterialKey } from "@/lib/storage-keys";
import { tryEmbedMaterial } from "@/lib/oralExamEmbed";

export const runtime = "nodejs";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** A6.1 — List tài liệu vấn đáp AI của 1 exam. GV-only, không có route cho SV. */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    const materials = await listOralMaterials(userId, params.id);
    return NextResponse.json({ materials });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/**
 * Upload tài liệu dạng file (document | rubric).
 * multipart/form-data: file=<file>, title=<string>, type=document|rubric
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireFeature("ai_oral.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  const title = form.get("title");
  const type = form.get("type");

  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "validation_failed", details: "no_file" },
      { status: 400 },
    );
  }
  if (typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json(
      { error: "validation_failed", details: "title_required" },
      { status: 400 },
    );
  }
  if (type !== "document" && type !== "rubric") {
    return NextResponse.json(
      { error: "validation_failed", details: "invalid_type" },
      { status: 400 },
    );
  }
  if (!(MATERIAL_FILE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return NextResponse.json(
      { error: "unsupported_media_type", details: { allowed: MATERIAL_FILE_MIME_TYPES } },
      { status: 415 },
    );
  }
  if (file.size > MATERIAL_MAX_BYTES) {
    return NextResponse.json(
      { error: "file_too_large", details: { maxBytes: MATERIAL_MAX_BYTES } },
      { status: 413 },
    );
  }

  const examId = params.id;
  const ext = EXT_BY_MIME[file.type]!;
  const now = new Date();
  const filename = `${examId}-${now.getTime()}-${randomBytes(8).toString("hex")}.${ext}`;
  const key = oralExamMaterialKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  const storage = storageFor(key);
  await storage.put(key.key, buf, file.type);

  const extractedText = await extractMaterialText(buf, file.type);

  try {
    const r = await createOralMaterialDocument(userId, examId, {
      type,
      title: title.trim(),
      s3Key: filename,
      mimeType: file.type,
      sizeBytes: file.size,
      extractedText,
    });
    const embedded = await tryEmbedMaterial(userId, r.materialId);
    return NextResponse.json(
      { materialId: r.materialId, extracted: r.extracted, embedded },
      { status: 201 },
    );
  } catch (e) {
    await storage.delete(key.key).catch(() => undefined);
    if (e instanceof ExamError) {
      const mapped = mapKnownError(e);
      if (mapped) return mapped;
    }
    throw e;
  }
}
