import { NextResponse } from "next/server";
import { z } from "zod";
import { createCourseAccessPlan, listCourseAccessPlans } from "@feedbackme/core-lms";
import { requireAdmin } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const CreateBody = z.object({
  label: z.string().min(1).max(80),
  durationMonths: z.number().int().min(1).max(120).nullable(),
  priceCents: z.number().int().min(0),
  currency: z.enum(["VND", "USD"]).optional(),
});

/** List every access plan (kể cả đã tắt) cho khoá học — chỉ admin. */
export async function GET(
  _req: Request,
  { params }: { params: { courseId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const plans = await listCourseAccessPlans(params.courseId, { includeInactive: true });
  return NextResponse.json({ plans });
}

/** Tạo 1 gói bán khoá học theo thời hạn — chỉ admin (không phải instructor sở hữu khoá). */
export async function POST(
  req: Request,
  { params }: { params: { courseId: string } },
) {
  const adminId = await requireAdmin();
  if (!adminId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const body = await readJson(req);
  const parsed = CreateBody.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }

  try {
    const plan = await createCourseAccessPlan(adminId, params.courseId, parsed.data);
    return NextResponse.json({ plan }, { status: 201 });
  } catch (err) {
    const mapped = mapKnownError(err);
    if (mapped) return mapped;
    throw err;
  }
}
