import { NextResponse } from "next/server";
import {
  createExamCodeBatch,
  DispatchError,
  listBatchesForExam,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

function getBaseUrl(req: Request): string {
  const h = req.headers;
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return host ? `${proto}://${host}` : "";
}

/** GET — list batches for this exam (history). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const batches = await listBatchesForExam(params.id, userId);
    return NextResponse.json({ batches });
  } catch (e) {
    return mapDispatchError(e);
  }
}

/** POST — phase 1: create a batch + items. Body: ignored (driven by exam state). */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const result = await createExamCodeBatch({
      examId: params.id,
      actorUserId: userId,
      baseUrl: getBaseUrl(req),
    });
    return NextResponse.json(result);
  } catch (e) {
    return mapDispatchError(e);
  }
}

function mapDispatchError(e: unknown): NextResponse {
  if (e instanceof DispatchError) {
    const status = e.code === "forbidden" ? 403 : 400;
    return NextResponse.json({ error: e.code }, { status });
  }
  const mapped = mapKnownError(e);
  if (mapped) return mapped;
  throw e;
}
