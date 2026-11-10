import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  addVanDapMaterial,
  extractMaterialText,
  VAN_DAP_LIMITS,
  VAN_DAP_MATERIAL_MIME_TYPES,
  loadDraftVanDapExam,
  VanDapError,
} from "@feedbackme/core-lms";
import { withVanDap } from "@/lib/vanDapApi";
import { storageFor } from "@/lib/storage";
import { vanDapMaterialKey } from "@/lib/storage-keys";

export const runtime = "nodejs";

const EXT_BY_MIME: Record<string, string> = {
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/**
 * Tải tài liệu nguồn (PDF, Word, .txt, .md; tối đa 20 MB). multipart/form-data: file, title?.
 * Tệp không đọc được chữ (PDF scan) bị từ chối NGAY với `material_unreadable` — không lưu, không im lặng (AC1.2).
 */
export function POST(req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => {
    // Kiểm quyền và trạng thái nháp TRƯỚC khi đọc tệp / ghi storage.
    await loadDraftVanDapExam(userId, params.id);

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
    if (!(VAN_DAP_MATERIAL_MIME_TYPES as readonly string[]).includes(file.type)) {
      return NextResponse.json({ error: "unsupported_media_type", details: { allowed: VAN_DAP_MATERIAL_MIME_TYPES } }, { status: 415 });
    }
    if (file.size > VAN_DAP_LIMITS.materialMaxBytes) {
      return NextResponse.json({ error: "file_too_large", details: { maxBytes: VAN_DAP_LIMITS.materialMaxBytes } }, { status: 413 });
    }
    const rawTitle = form.get("title");
    const title = (typeof rawTitle === "string" && rawTitle.trim() ? rawTitle : file.name).trim().slice(0, VAN_DAP_LIMITS.titleMax);

    const buf = Buffer.from(await file.arrayBuffer());
    const text = await extractMaterialText(buf, file.type);
    if (text === null) throw new VanDapError("material_unreadable");
    if (text.length > VAN_DAP_LIMITS.materialMaxChars) {
      throw new VanDapError("text_too_long", { maxChars: VAN_DAP_LIMITS.materialMaxChars });
    }

    const now = new Date();
    const filename = `${params.id}-${now.getTime()}-${randomBytes(8).toString("hex")}.${EXT_BY_MIME[file.type]}`;
    const key = vanDapMaterialKey(now, filename);
    const storage = storageFor(key);
    await storage.put(key.key, buf, file.type);
    try {
      const r = await addVanDapMaterial(userId, params.id, {
        title,
        mimeType: file.type,
        sizeBytes: file.size,
        s3Key: filename,
        extractedText: text,
      });
      return NextResponse.json(r, { status: 201 });
    } catch (e) {
      await storage.delete(key.key).catch(() => undefined);
      throw e;
    }
  });
}
