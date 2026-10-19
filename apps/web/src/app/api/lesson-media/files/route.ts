import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isInstructor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { lessonFileKey } from "@/lib/storage-keys";
import { lessonFileMimeForFilename, validateLessonFileUpload } from "@/lib/lessonFile";

export const runtime = "nodejs";

/**
 * Upload cho tài nguyên "File đính kèm" (ContentItem type `file`) — học viên
 * bấm là tải về. Giới hạn 10 MB, loại file theo danh sách đuôi ở lib/lessonFile.
 *
 * Lưu ở `lesson-media/files/{yyyy}/{mm}/{userId}-{ms}-{hex}.{ext}`; tên file
 * mang userId để sổ dung lượng suy ra người upload. Tên gốc KHÔNG nằm trong
 * key — trả về `originalName` để form điền sẵn ô "Tên file" (payload.filename).
 *
 * Chỉ giảng viên được upload (401/403), kiểm quyền TRƯỚC khi đọc thân request.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isInstructor(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data" }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "validation_failed", details: "no_file" }, { status: 400 });
  }

  const check = validateLessonFileUpload(file);
  if (!check.ok) {
    return NextResponse.json({ error: check.error, details: check.details }, { status: check.status });
  }

  const now = new Date();
  const filename = `${userId}-${now.getTime()}-${randomBytes(8).toString("hex")}.${check.ext}`;
  const key = lessonFileKey(now, filename);
  // content-type theo đuôi, không theo MIME client gửi (xem lib/lessonFile).
  const mime = lessonFileMimeForFilename(filename)!;
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, mime);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/lesson-media/files/${filename}`,
      filename,
      originalName: file.name,
      sizeBytes: file.size,
      mime,
    },
    { status: 201 },
  );
}
