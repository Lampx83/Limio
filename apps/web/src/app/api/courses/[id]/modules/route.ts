import { NextResponse } from "next/server";
import { createModule } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const result = await createModule(userId, params.id, body);
    return NextResponse.json(result, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    // Prisma unique-constraint on (courseId, orderIndex). Surface as a friendly
    // 409 instead of leaking 500 — this happens when client posts a stale
    // orderIndex (e.g. user double-clicked or page didn't refresh).
    if (
      typeof e === "object" &&
      e !== null &&
      (e as { code?: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { error: "order_index_taken" },
        { status: 409 },
      );
    }
    console.error("[POST /api/courses/:id/modules] unexpected", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
