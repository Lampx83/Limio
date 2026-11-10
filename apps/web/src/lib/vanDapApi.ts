import { NextResponse } from "next/server";
import { VanDapError, type VanDapErrorCode } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";

/** Cờ thử nghiệm: Limio Vấn đáp chạy song song vấn đáp AI bản cũ (docs/tieu-chi/limio-van-dap.md). */
export const VAN_DAP_FEATURE = "van_dap.access";

/**
 * Người dùng có cờ `van_dap.access`, hoặc null (chưa đăng nhập / không có cờ / cờ chưa được seed).
 * Cờ chưa seed coi như tắt — không để một cấu hình thiếu làm lộ tính năng đang thử nghiệm.
 */
export async function requireVanDapUser(): Promise<string | null> {
  try {
    return await requireFeature(VAN_DAP_FEATURE);
  } catch {
    return null;
  }
}

const STATUS: Record<VanDapErrorCode, number> = {
  forbidden: 403,
  not_found: 404,
  exam_locked: 409,
  plan_empty: 409,
  validation_failed: 400,
  too_many: 400,
  not_a_permutation: 400,
  legacy_not_oral: 400,
  material_unreadable: 422,
  text_too_long: 413,
};

export function vanDapErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof VanDapError)) return null;
  return NextResponse.json(
    err.details !== undefined ? { error: err.code, details: err.details } : { error: err.code },
    { status: STATUS[err.code] ?? 400 },
  );
}

/** Bọc route: kiểm cờ, rồi đổi VanDapError thành phản hồi. Đường dẫn trực tiếp không có cờ → 403 (AC0.1). */
export async function withVanDap(handler: (userId: string) => Promise<Response>): Promise<Response> {
  const userId = await requireVanDapUser();
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  try {
    return await handler(userId);
  } catch (e) {
    const mapped = vanDapErrorResponse(e);
    if (mapped) return mapped;
    throw e;
  }
}
