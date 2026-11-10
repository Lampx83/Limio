import { NextResponse } from "next/server";
import { createVanDapScenario } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

/** Body: { title, aiContext, studentBrief? } */
export function POST(req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    return NextResponse.json(await createVanDapScenario(userId, params.id, (body ?? {}) as never), { status: 201 });
  });
}
