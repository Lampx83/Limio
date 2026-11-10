import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { updateCourse, CourseError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { storageFor } from "@/lib/storage";
import { courseCoverKey, courseCoverKeyFromFilename } from "@/lib/storage-keys";
import {
  COURSE_COVER_MAX_BYTES,
  courseCoverFilename,
  courseCoverUrlFromFilename,
  coverFilenameFromUrl,
  validateCoverFile,
} from "@/lib/courseCover";

export const runtime = "nodejs";

/** Dọn tệp ảnh bìa cũ (chỉ ảnh đã tải lên của chính hệ thống; URL ngoài thì bỏ qua). Lỗi dọn không làm hỏng yêu cầu. */
async function deletePrevious(prevUrl: string | null): Promise<void> {
  const name = coverFilenameFromUrl(prevUrl);
  const key = name ? courseCoverKeyFromFilename(name) : null;
  if (key) await storageFor(key).delete(key.key).catch(() => undefined);
}

function errorResponse(e: unknown) {
  const mapped = mapKnownError(e);
  if (mapped) return mapped;
  if (e instanceof CourseError && e.code === "validation_failed") {
    return NextResponse.json({ error: "validation_failed", details: e.details }, { status: 422 });
  }
  throw e;
}

// POST /api/instructor/courses/[courseId]/cover — tải ảnh bìa / banner lên (multipart, trường "file"). Quyền = quyền sửa khoá
// (kiểm trong updateCourse). Thay ảnh thì tệp cũ được dọn.
export async function POST(req: Request, { params }: { params: { courseId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return NextResponse.json({ error: "invalid_form_data", message: "Không đọc được tệp tải lên." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "validation_failed", message: "Chưa chọn ảnh." }, { status: 400 });
  }
  const problem = validateCoverFile(file);
  if (problem) {
    const status = file.size > COURSE_COVER_MAX_BYTES ? 413 : file.size === 0 ? 400 : 415;
    return NextResponse.json({ error: "invalid_cover", message: problem }, { status });
  }

  const before = await prisma.course.findUnique({ where: { id: params.courseId }, select: { coverUrl: true } });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const filename = courseCoverFilename(params.courseId, file.type);
  const key = courseCoverKey(params.courseId, filename);
  await storageFor(key).put(key.key, Buffer.from(await file.arrayBuffer()), file.type);
  const coverUrl = courseCoverUrlFromFilename(filename);

  try {
    await updateCourse(userId, params.courseId, { coverUrl });
  } catch (e) {
    // Không có quyền hoặc lỗi khác — dọn tệp vừa tải để không để rác.
    await storageFor(key).delete(key.key).catch(() => undefined);
    return errorResponse(e);
  }
  await deletePrevious(before.coverUrl);
  return NextResponse.json({ ok: true, coverUrl }, { status: 201 });
}

// DELETE — gỡ ảnh bìa: coverUrl về null và dọn tệp.
export async function DELETE(_req: Request, { params }: { params: { courseId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const before = await prisma.course.findUnique({ where: { id: params.courseId }, select: { coverUrl: true } });
  if (!before) return NextResponse.json({ error: "not_found" }, { status: 404 });
  try {
    await updateCourse(userId, params.courseId, { coverUrl: null });
  } catch (e) {
    return errorResponse(e);
  }
  await deletePrevious(before.coverUrl);
  return NextResponse.json({ ok: true });
}
