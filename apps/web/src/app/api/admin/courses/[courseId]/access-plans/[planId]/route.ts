import { NextResponse } from "next/server";
import { z } from "zod";
import { updateCourseAccessPlan } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const UpdateBody = z.object({
  label: z.string().min(1).max(80).optional(),
  durationMonths: z.number().int().min(1).max(120).nullable().optional(),
  priceCents: z.number().int().min(0).optional(),
  currency: z.enum(["VND", "USD"]).optional(),
  isActive: z.boolean().optional(),
});

/** Sửa giá/thời hạn, hoặc tắt (isActive=false) 1 gói bán khoá học — chỉ admin. */
export async function PATCH(
  req: Request,
  { params }: { params: { courseId: string; planId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await readJson(req);
  const parsed = UpdateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const plan = await updateCourseAccessPlan(adminId, params.planId, parsed.data);
    return NextResponse.json({ plan });
  } catch (err) {
    const mapped = mapKnownError(err);
    if (mapped) return mapped;
    throw err;
  }
}
