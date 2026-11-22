import { NextResponse } from "next/server";
import { AiGradeBatchError } from "@feedbackme/core-lms";
import { mapKnownError } from "@/lib/apiHelpers";

const STATUS: Record<AiGradeBatchError["code"], number> = {
  forbidden: 403,
  assignment_not_found: 404,
  batch_not_found: 404,
  batch_running: 409,
  nothing_to_grade: 409,
};

/** Ánh xạ lỗi của chấm hàng loạt sang JSON. Trả null nếu không phải lỗi quen thuộc (để tầng gọi ném tiếp). */
export function mapAiGradeBatchError(e: unknown): NextResponse | null {
  if (e instanceof AiGradeBatchError) {
    return NextResponse.json(e.details ? { error: e.code, details: e.details } : { error: e.code }, { status: STATUS[e.code] });
  }
  return mapKnownError(e);
}
