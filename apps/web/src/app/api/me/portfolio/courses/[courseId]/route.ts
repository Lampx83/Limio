import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getOrCreatePortfolio,
  pinPortfolioCourse,
  unpinPortfolioCourse,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

type Ctx = { params: { courseId: string } };

/** A8 — khoe một khoá đã hoàn thành (có chứng nhận) trên e-portfolio. */
export async function PUT(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await pinPortfolioCourse(userId, params.courseId);
    if (r.created) revalidatePath(`/p/${(await getOrCreatePortfolio(userId)).slug}`);
    return NextResponse.json(r);
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

/** Thôi khoe khoá. Bài đã ghim của khoá được giữ lại nhưng ẩn khỏi trang công khai. */
export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await unpinPortfolioCourse(userId, params.courseId);
  if (r.removed) revalidatePath(`/p/${(await getOrCreatePortfolio(userId)).slug}`);
  return NextResponse.json(r);
}
