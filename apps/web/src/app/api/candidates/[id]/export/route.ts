import { NextResponse } from "next/server";
import { exportCandidateData } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/** A5.8 — Export full candidate data (Nghị định 13/2023 Điều 12). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const data = await exportCandidateData(userId, params.id);
    return new NextResponse(JSON.stringify(data, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="candidate-${params.id.slice(0, 8)}.json"`,
      },
    });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
