// Dùng chung cho các route /api/admin/plans* và /api/admin/subscriptions*.
import { NextResponse } from "next/server";
import { isAdmin, PlanError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

/** Trả `{ adminId }` hoặc một NextResponse lỗi (chưa đăng nhập 401, không phải admin nền tảng 403). */
export async function guardPlatformAdmin(): Promise<{ adminId: string } | { res: NextResponse }> {
  const userId = await requireUserId();
  if (!userId) return { res: NextResponse.json({ error: "unauthorized" }, { status: 401 }) };
  if (!(await isAdmin(userId))) return { res: NextResponse.json({ error: "forbidden" }, { status: 403 }) };
  return { adminId: userId };
}

/** PlanError → 400 { error: code } (không thấy gói/thuê bao → 404); lỗi khác ném tiếp. */
export function planErrorResponse(e: unknown): NextResponse {
  if (e instanceof PlanError) {
    const status = e.code === "plan_not_found" || e.code === "subscription_not_found" ? 404 : 400;
    return NextResponse.json({ error: e.code }, { status });
  }
  throw e;
}

export function parseDate(v: unknown): Date | null {
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}
