import { NextResponse } from "next/server";
import { z } from "zod";
import { submitMission, CustomMissionError } from "@feedbackme/core-gamification";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Input = z.object({
  payload: z.record(z.unknown()),
  elapsedMsSinceOpen: z.number().int().min(0).optional(),
});

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await readJson(req);
  const parsed = Input.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "validation_failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }
  try {
    const r = await submitMission({
      missionId: params.id,
      userId,
      payload: parsed.data.payload as never,
      elapsedMsSinceOpen: parsed.data.elapsedMsSinceOpen,
    });
    return NextResponse.json({ ok: true, ...r });
  } catch (e) {
    if (e instanceof CustomMissionError) {
      const status =
        e.code === "mission_not_found" || e.code === "submission_not_found"
          ? 404
          : e.code === "not_registered"
            ? 403
            : e.code === "past_deadline" || e.code === "resubmit_blocked"
              ? 409
              : e.code === "speed_run_blocked"
                ? 429
                : 400;
      return NextResponse.json(
        { error: e.code, ...(e.detail ? { detail: e.detail } : {}) },
        { status },
      );
    }
    throw e;
  }
}
