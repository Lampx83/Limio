import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import { OrgSpaceError, updateOrganizationSpace } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { isValidSpaceSlug, normalizeStored } from "@/lib/space/settings";

export const runtime = "nodejs";

/**
 * PUT /api/orgs/[id]/space — body: { enabled: boolean, slug: string | null, space: object }.
 * Platform Admin hoặc OrgAdmin của trường. `space` được chuẩn hoá ở đây (màu hex, URL https/nội bộ, độ dài chữ)
 * trước khi lưu — giá trị này sau đó đi vào CSS và HTML của trang công khai.
 */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { enabled?: unknown; slug?: unknown; space?: unknown } | null;
  if (!body || typeof body.enabled !== "boolean") {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const slug = typeof body.slug === "string" && body.slug.trim() ? body.slug.trim().toLowerCase() : null;
  if (slug !== null && !isValidSpaceSlug(slug)) {
    return NextResponse.json({ error: "invalid_slug" }, { status: 400 });
  }
  const space = normalizeStored(body.space);

  try {
    const result = await updateOrganizationSpace(userId, params.id, {
      spaceEnabled: body.enabled,
      spaceSlug: slug,
      space,
    });
    // Resolver cache 60s theo tag: áp ngay thay vì đợi hết hạn.
    revalidateTag("spaces");
    return NextResponse.json({ ok: true, ...result, space });
  } catch (e) {
    if (e instanceof OrgSpaceError) {
      const status =
        e.code === "forbidden" ? 403 : e.code === "org_not_found" ? 404 : e.code === "slug_taken" ? 409 : 400;
      return NextResponse.json(e.details ? { error: e.code, details: e.details } : { error: e.code }, { status });
    }
    throw e;
  }
}
