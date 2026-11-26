import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { isAdmin, logAudit } from "@feedbackme/core-lms";
import { auth } from "@/lib/auth";
import { getSiteSetting, setSiteSetting } from "@/lib/site-settings";
import { listCatalogSpaceChoices } from "@/lib/space/catalogSpaces";
import { CATALOG_SPACES_KEY, normalizeSlugs, parseCatalogSpacesSetting, serializeCatalogSpacesSetting } from "@/lib/space/catalogSpaceConfig";

export const runtime = "nodejs";

async function requireAdmin(): Promise<string | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return (await isAdmin(session.user.id)) ? session.user.id : null;
}

/** GET: lựa chọn hiện tại + các space có thể chọn. PUT: { mode: "auto" | "manual", slugs: string[] } (docs/tieu-chi/space-catalog-xem-truoc.md). Chỉ admin nền tảng. */
export async function GET() {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const [choices, raw] = await Promise.all([listCatalogSpaceChoices(), getSiteSetting(CATALOG_SPACES_KEY)]);
  const selection = parseCatalogSpacesSetting(raw);
  return NextResponse.json({ mode: selection === null ? "auto" : "manual", slugs: selection ?? [], choices });
}

export async function PUT(req: Request) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const body = (await req.json().catch(() => null)) as { mode?: unknown; slugs?: unknown } | null;
  if (!body || (body.mode !== "auto" && body.mode !== "manual")) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  let selection: string[] | null = null;
  if (body.mode === "manual") {
    if (!Array.isArray(body.slugs)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    selection = normalizeSlugs(body.slugs);
    // Chỉ nhận space đang bật: slug lạ là dữ liệu sai (space đã tắt/xoá), báo lỗi thay vì lưu ngầm.
    const valid = new Set((await listCatalogSpaceChoices()).map((c) => c.slug));
    const unknown = selection.filter((s) => !valid.has(s));
    if (unknown.length) return NextResponse.json({ error: "unknown_space", slugs: unknown }, { status: 400 });
  }

  await setSiteSetting(CATALOG_SPACES_KEY, serializeCatalogSpacesSetting(selection));
  // Payload chỉ mang slug và số lượng.
  await logAudit({ action: "catalog.spaces.updated", actorUserId: adminId, payload: { mode: body.mode, slugs: selection ?? [] } });
  revalidateTag("spaces");
  return NextResponse.json({ ok: true, mode: body.mode, slugs: selection ?? [] });
}
