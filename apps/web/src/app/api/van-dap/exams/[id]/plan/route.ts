import { NextResponse } from "next/server";
import { createVanDapItem, reorderVanDapItems } from "@feedbackme/core-lms";
import { readJson } from "@/lib/apiHelpers";
import { withVanDap } from "@/lib/vanDapApi";

export const runtime = "nodejs";

/** Thêm một ý vào cuối dàn. Body: { core, sourceExcerpt?, level?, expectedAnswer?, maxFollowUps? } */
export function POST(req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as Record<string, unknown> | null;
    return NextResponse.json(await createVanDapItem(userId, params.id, (body ?? {}) as never), { status: 201 });
  });
}

/** Đổi thứ tự ưu tiên. Body: { orderedIds: string[] } — hoán vị ĐẦY ĐỦ của các ý hiện có. */
export function PUT(req: Request, { params }: { params: { id: string } }) {
  return withVanDap(async (userId) => {
    const body = (await readJson(req)) as { orderedIds?: unknown } | null;
    if (!Array.isArray(body?.orderedIds) || body.orderedIds.some((x) => typeof x !== "string")) {
      return NextResponse.json({ error: "validation_failed", details: "orderedIds" }, { status: 400 });
    }
    await reorderVanDapItems(userId, params.id, body.orderedIds as string[]);
    return NextResponse.json({ ok: true });
  });
}
