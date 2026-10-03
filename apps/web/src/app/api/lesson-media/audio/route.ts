import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { isInstructor } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { storageFor } from "@/lib/storage";
import { lessonAudioKey } from "@/lib/storage-keys";
import { validateAudioUpload } from "@/lib/lessonAudio";

export const runtime = "nodejs";

/**
 * LANG G1 — upload audio bài học (bài nghe, hội thoại).
 *
 * Lưu ở `lesson-media/audio/{yyyy}/{mm}/{userId}-{ms}-{hex}.{ext}`; tên file mang
 * userId để sổ dung lượng suy ra người upload (storage/ledger.ts). Trả URL trỏ
 * vào /api/lesson-media/audio/[file] để form dùng làm `url` của payload.
 *
 * Khác route video: chỉ GIẢNG VIÊN được upload (401 chưa đăng nhập, 403 không
 * phải giảng viên). Quyền được kiểm TRƯỚC khi đọc thân request để người lạ không
 * bắt server nuốt một file lớn.
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

  const check = validateAudioUpload(file);
  if (!check.ok) {
    return NextResponse.json({ error: check.error, details: check.details }, { status: check.status });
  }

  const now = new Date();
  const filename = `${userId}-${now.getTime()}-${randomBytes(8).toString("hex")}.${check.ext}`;
  const key = lessonAudioKey(now, filename);
  const buf = Buffer.from(await file.arrayBuffer());
  await storageFor(key).put(key.key, buf, file.type);

  return NextResponse.json(
    {
      ok: true,
      url: `/api/lesson-media/audio/${filename}`,
      filename,
      sizeBytes: file.size,
      mime: file.type,
    },
    { status: 201 },
  );
}
