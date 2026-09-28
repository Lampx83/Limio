import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import {
  getOrCreatePortfolio,
  pinPortfolioItem,
  unpinPortfolioItem,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

type Ctx = { params: { submissionId: string } };

/** A8 — ghim bài đã chấm vào e-portfolio, hoặc sửa câu giới thiệu. Body: { note?: string | null } */
export async function PUT(req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { note?: unknown } | null;
  try {
    const r = await pinPortfolioItem(userId, params.submissionId, body?.note ?? null);
    revalidatePath(`/p/${(await getOrCreatePortfolio(userId)).slug}`);
    return NextResponse.json(r);
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}

export async function DELETE(_req: Request, { params }: Ctx) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await unpinPortfolioItem(userId, params.submissionId);
  if (r.removed) revalidatePath(`/p/${(await getOrCreatePortfolio(userId)).slug}`);
  return NextResponse.json(r);
}
