import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getOrCreatePortfolio, updatePortfolioSettings } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

/** A8 — bật/tắt công khai, dòng giới thiệu, đoạn giới thiệu, đổi đường dẫn e-portfolio. */
export async function PATCH(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const before = await getOrCreatePortfolio(userId);
    const p = await updatePortfolioSettings(userId, body);
    // Trang /p/<slug> được cache (ISR) — làm mới cả slug cũ để link cũ chết ngay.
    revalidatePath(`/p/${before.slug}`);
    if (p.slug !== before.slug) revalidatePath(`/p/${p.slug}`);
    return NextResponse.json({ slug: p.slug, isPublic: p.isPublic, headline: p.headline, about: p.about });
  } catch (e) {
    const m = mapKnownError(e);
    if (m) return m;
    throw e;
  }
}
