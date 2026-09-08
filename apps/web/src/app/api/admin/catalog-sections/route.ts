import { NextResponse } from "next/server";
import {
  CatalogSectionError,
  createCatalogSection,
  listCatalogSectionsForAdmin,
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

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const sections = await listCatalogSectionsForAdmin(userId);
    return NextResponse.json({ sections });
  } catch (e) {
    return mapError(e);
  }
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const section = await createCatalogSection(userId, body);
    return NextResponse.json({ section }, { status: 201 });
  } catch (e) {
    return mapError(e);
  }
}
