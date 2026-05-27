import { NextResponse } from "next/server";
import { previewSectionPool } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Sample N câu cụ thể cho 1 ExamSection random_from_bank. Deterministic theo
 * sectionId mặc định — query `?reshuffle=<string>` để dùng seed khác xem ví
 * dụ phân bổ khác (cho instructor verify rằng pool đa dạng).
 */
export async function GET(
  req: Request,
  { params }: { params: { id: string; sectionId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const reshuffleSeed = new URL(req.url).searchParams.get("reshuffle") ?? undefined;
  try {
    const r = await previewSectionPool(userId, params.id, params.sectionId, {
      reshuffleSeed,
    });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
