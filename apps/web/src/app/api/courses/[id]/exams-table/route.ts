import { NextResponse } from "next/server";
import { listCourseExamsTable, type TableFilters } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const num = (v: string | null) => (v !== null && v !== "" && Number.isFinite(Number(v)) ? Number(v) : undefined);
const oneOf = <T extends string>(v: string | null, set: readonly T[]): T | undefined => (v && (set as readonly string[]).includes(v) ? (v as T) : undefined);

/** LANG L6.6 — bảng đề của khoá cho giảng viên (phân trang phía máy chủ). Quyền kiểm trong core. */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = new URL(req.url).searchParams;
  const f: TableFilters = {
    q: sp.get("q") ?? undefined,
    collectionId: sp.get("c") || undefined,
    paperType: oneOf(sp.get("t"), ["official", "mock", "practice_set"] as const),
    status: oneOf(sp.get("s"), ["draft", "published", "archived"] as const),
    difficulty: num(sp.get("d")),
    year: sp.get("y") || undefined,
    freePreview: sp.get("free") === "1" ? true : sp.get("free") === "0" ? false : undefined,
    sort: oneOf(sp.get("sort"), ["seq", "title", "status", "updatedAt", "difficulty"] as const),
    dir: oneOf(sp.get("dir"), ["asc", "desc"] as const),
    page: num(sp.get("page")),
    pageSize: num(sp.get("pageSize")),
  };
  try {
    return NextResponse.json(await listCourseExamsTable(userId, params.id, f));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
