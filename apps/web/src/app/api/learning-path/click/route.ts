import { NextResponse } from "next/server";
import { PathClickError, recordPathClick } from "@feedbackme/core-feedback";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

const KINDS = ["review", "next", "practice", "skim"] as const;
const SURFACES = ["course_home", "quiz_result"] as const;

/**
 * B4 — học viên bấm vào một bước lộ trình (AC-2.14).
 *
 * Fire-and-forget từ client: điều hướng không bao giờ chờ hay bị huỷ bởi call này.
 */
export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await readJson(req)) as {
    lessonId?: unknown;
    kind?: unknown;
    surface?: unknown;
  } | null;
  const kind = KINDS.find((k) => k === body?.kind);
  const surface = SURFACES.find((s) => s === body?.surface);
  if (typeof body?.lessonId !== "string" || !kind || !surface) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    await recordPathClick(userId, body.lessonId, surface, kind);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof PathClickError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
