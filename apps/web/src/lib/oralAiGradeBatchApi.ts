import { NextResponse } from "next/server";
import { OralAiGradeBatchError } from "@feedbackme/core-lms";
import { mapKnownError } from "@/lib/apiHelpers";

const STATUS: Record<OralAiGradeBatchError["code"], number> = {
  forbidden: 403,
  exam_not_found: 404,
  exam_not_oral: 409,
  batch_running: 409,
  nothing_to_grade: 409,
};

/** Ánh xạ lỗi của chấm vấn đáp hàng loạt sang JSON. Trả null nếu không phải lỗi quen thuộc (để tầng gọi ném tiếp). */
export function mapOralAiGradeBatchError(e: unknown): NextResponse | null {
  if (e instanceof OralAiGradeBatchError) {
    return NextResponse.json(e.details ? { error: e.code, details: e.details } : { error: e.code }, { status: STATUS[e.code] });
  }
  return mapKnownError(e);
}
