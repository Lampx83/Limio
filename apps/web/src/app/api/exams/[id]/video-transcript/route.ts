import { NextResponse } from "next/server";
import { getVideoTranscriptForEditor, setVideoTranscript } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

/**
 * Transcript của một video trong đoạn văn (tải lên hoặc dán link), như audio ở `assets/[file]`. Chỉ người sửa được khoá chứa đề.
 * Khoá video là `src` (đường dẫn trong nút video) nên đi qua tham số/ thân yêu cầu, không đặt trong đường dẫn URL.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const src = new URL(req.url).searchParams.get("src") ?? "";
  try {
    return NextResponse.json(await getVideoTranscriptForEditor(userId, params.id, src));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { src?: unknown; transcript?: unknown; alt?: unknown } | null;
  if (typeof body?.src !== "string" || typeof body?.transcript !== "string") return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    await setVideoTranscript(userId, params.id, body.src, body.transcript, typeof body.alt === "string" ? body.alt : "");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
