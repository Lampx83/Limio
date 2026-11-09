import { NextResponse } from "next/server";
import { deleteVanDapScenario, updateVanDapScenario } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

export function PATCH(req: Request, { params }: { params: { id: string; scenarioId: string } }) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    await updateVanDapScenario(userId, params.id, params.scenarioId, (body ?? {}) as never);
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(_req: Request, { params }: { params: { id: string; scenarioId: string } }) {
  return withVanDap(async (userId) => {
    await deleteVanDapScenario(userId, params.id, params.scenarioId);
    return NextResponse.json({ ok: true });
  });
}
