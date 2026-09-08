import { NextResponse } from "next/server";
import {
  CatalogSectionError,
  deleteCatalogSection,
  updateCatalogSection,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

function mapError(e: unknown): NextResponse {
  if (e instanceof CatalogSectionError) {
    const status = e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : 400;
    return NextResponse.json(
      e.details ? { error: e.code, details: e.details } : { error: e.code },
      { status },
    );
  }
  throw e;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const section = await updateCatalogSection(userId, params.id, body);
    return NextResponse.json({ section });
  } catch (e) {
    return mapError(e);
  }
}

export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    await deleteCatalogSection(userId, params.id);
    return NextResponse.json({ ok: true });
  } catch (e) {
    return mapError(e);
  }
}
