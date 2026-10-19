import { NextResponse } from "next/server";
import {
  LessonDraftError,
  discardLessonDraft,
  getLessonDraft,
  setKeepFormatHtml,
  updateLessonDraft,
  type UpdateLessonDraftInput,
} from "@feedbackme/core-lms";
import { isLessonWritingMode, readLessonLook } from "@feedbackme/shared-types";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { outlineProblems, sanitizeLessonOutline } from "@/lib/lessonOutline";

export const runtime = "nodejs";

/** Trần HTML một bài giữ nguyên định dạng (bài ≤ 4.000 từ cộng thẻ và ảnh). */
const MAX_HTML_CHARS = 1_500_000;

function draftError(e: unknown): NextResponse | null {
  if (!(e instanceof LessonDraftError)) return null;
  const status = e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : 409;
  return NextResponse.json({ error: e.code }, { status });
}

/** GET — toàn bộ bản nháp: tài liệu đã tách đoạn, dàn ý, giao diện, cách viết. */
export async function GET(_req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await getLessonDraft(userId, params.draftId));
  } catch (e) {
    const r = draftError(e);
    if (r) return r;
    throw e;
  }
}

/**
 * PUT — tự lưu khi giảng viên sửa dàn ý (không gọi AI, không tốn token — D6).
 * Body (đều tuỳ chọn): { outline, look, writing, addObjectivesSummary, confirm }.
 * Sửa dàn ý/cách viết là bỏ chốt; `confirm: true` chỉ được nhận khi dàn ý
 * (đã gửi kèm hoặc đang lưu) không còn lỗi chặn — trả 422 kèm danh sách lỗi.
 */
export async function PUT(req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const draft = await getLessonDraft(userId, params.draftId);
    const patch: UpdateLessonDraftInput = {};

    if (body.outline !== undefined) {
      const outline = sanitizeLessonOutline(body.outline, draft.sourceParas.length);
      if (!outline) return NextResponse.json({ error: "validation_failed", details: "outline" }, { status: 400 });
      patch.outline = outline;
    }
    if (body.look !== undefined) {
      const look = body.look === null ? null : readLessonLook(body.look);
      if (body.look !== null && !look) return NextResponse.json({ error: "validation_failed", details: "look" }, { status: 400 });
      patch.look = look;
    }
    if (body.writing !== undefined) {
      if (!isLessonWritingMode(body.writing)) return NextResponse.json({ error: "validation_failed", details: "writing" }, { status: 400 });
      patch.writing = body.writing;
    }
    if (body.addObjectivesSummary !== undefined) {
      if (typeof body.addObjectivesSummary !== "boolean") {
        return NextResponse.json({ error: "validation_failed", details: "addObjectivesSummary" }, { status: 400 });
      }
      patch.addObjectivesSummary = body.addObjectivesSummary;
    }
    if (body.confirm === true) {
      const problems = outlineProblems(patch.outline ?? draft.outline, draft.sourceParas);
      if (problems.length) return NextResponse.json({ error: "outline_has_problems", problems }, { status: 422 });
      patch.confirm = true;
    }

    // Bài giữ nguyên định dạng: giảng viên chấp nhận một đoạn AI sửa → lưu HTML mới.
    if (body.resultHtml !== undefined) {
      if (typeof body.resultHtml !== "string" || body.resultHtml.length > MAX_HTML_CHARS) {
        return NextResponse.json({ error: "validation_failed", details: "resultHtml" }, { status: 400 });
      }
      await setKeepFormatHtml(userId, params.draftId, body.resultHtml);
    }

    const saved = await updateLessonDraft(userId, params.draftId, patch);
    return NextResponse.json({ confirmedAt: saved.confirmedAt, updatedAt: saved.updatedAt });
  } catch (e) {
    const r = draftError(e);
    if (r) return r;
    throw e;
  }
}

/** DELETE — bỏ bản nháp (giữ lại trong DB với trạng thái đã bỏ, không xoá). */
export async function DELETE(_req: Request, { params }: { params: { draftId: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await discardLessonDraft(userId, params.draftId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const r = draftError(e);
    if (r) return r;
    throw e;
  }
}
