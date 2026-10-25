import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@feedbackme/db";
import { DeckCollaboratorError, addDeckCollaborator, listDeckPeople } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";

const STATUS: Record<string, number> = {
  not_found: 404,
  forbidden: 403,
  invalid_email: 400,
  user_not_found: 404,
  no_limio_live_access: 409,
  already_owner: 409,
};

function fail(e: unknown) {
  if (e instanceof DeckCollaboratorError) return NextResponse.json({ error: e.code }, { status: STATUS[e.code] ?? 400 });
  console.error("[Limio-Live Deck API - collaborators]", e);
  return NextResponse.json({ error: "server_error" }, { status: 500 });
}

/** GET: chủ và đồng giảng viên của bài giảng (docs/tieu-chi/dong-giang-vien-bai-giang.md). Chỉ chủ và đồng giảng viên xem được. */
export async function GET(_req: NextRequest, { params }: { params: { deckId: string } }) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    return NextResponse.json(await listDeckPeople(params.deckId, userId, prisma));
  } catch (e) {
    return fail(e);
  }
}

const AddSchema = z.object({ email: z.string().min(1).max(254) });

/** POST { email }: chủ bài thêm đồng giảng viên bằng email của tài khoản đã có. */
export async function POST(req: NextRequest, { params }: { params: { deckId: string } }) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const parsed = AddSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return NextResponse.json({ error: "invalid_email" }, { status: 400 });
    return NextResponse.json(await addDeckCollaborator(userId, params.deckId, parsed.data.email, prisma));
  } catch (e) {
    return fail(e);
  }
}
