import { NextResponse } from "next/server";
import { publishVanDapExam } from "@feedbackme/core-lms";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

export function POST(_req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => {
    await publishVanDapExam(userId, params.id);
    return NextResponse.json({ ok: true });
  });
}
