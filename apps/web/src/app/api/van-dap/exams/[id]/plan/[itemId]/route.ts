import { NextResponse } from "next/server";
import { deleteVanDapItem, updateVanDapItem } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

export function PATCH(req: Request, { params }: { params: { id: string; itemId: string } }) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    await updateVanDapItem(userId, params.id, params.itemId, (body ?? {}) as never);
    return NextResponse.json({ ok: true });
  });
}

export function DELETE(_req: Request, { params }: { params: { id: string; itemId: string } }) {
  return withVanDap(async (userId) => {
    await deleteVanDapItem(userId, params.id, params.itemId);
    return NextResponse.json({ ok: true });
  });
}
