import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { DeckCollaboratorError, removeDeckCollaborator } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";

/** DELETE: chủ bài gỡ một đồng giảng viên, hoặc đồng giảng viên tự rời (userId = chính mình). */
export async function DELETE(_req: NextRequest, { params }: { params: { deckId: string; userId: string } }) {
  try {
    const actor = await requireFeature("limio_live.access");
    if (!actor) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    await removeDeckCollaborator(actor, params.deckId, params.userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof DeckCollaboratorError) return NextResponse.json({ error: e.code }, { status: e.code === "not_found" ? 404 : 403 });
    console.error("[Limio-Live Deck API - collaborators delete]", e);
    return NextResponse.json({ error: "server_error" }, { status: 500 });
  }
}
