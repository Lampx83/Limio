import { NextResponse } from "next/server";
import { updateOrganizationSlideBrand } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";
import { validateOrgBrandInput } from "@/lib/limioLiveBrand";

export const runtime = "nodejs";

/**
 * PATCH /api/orgs/[id]/brand — OrgAdmin của trường (hoặc Platform Admin) đặt thương hiệu cho slide Limio-Live của cả trường:
 * { brand: { colors, bg, logoPos, logoSize, logoShow, defaultTemplate? } | null }. Logo KHÔNG nằm ở đây: dùng logo của trường
 * (POST /api/orgs/[id]/logo). Mọi giảng viên của trường dùng bộ này cho bài chưa có thương hiệu riêng.
 */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { brand?: unknown } | null;
  if (!body || !("brand" in body)) return NextResponse.json({ error: "validation_failed", details: "brand_required" }, { status: 400 });
  const v = validateOrgBrandInput(body.brand);
  if (!v.ok) return NextResponse.json({ error: "validation_failed", details: { brand: v.error } }, { status: 400 });

  try {
    const r = await updateOrganizationSlideBrand(userId, params.id, v.brand as Record<string, unknown> | null);
    return NextResponse.json({ ok: true, slideBrand: r.slideBrand });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
