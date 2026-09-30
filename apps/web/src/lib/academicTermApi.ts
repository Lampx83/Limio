import { NextResponse } from "next/server";
import type { AcademicTermError, AcademicTermInput } from "@feedbackme/core-lms";

/**
 * Đọc body tạo/sửa kỳ học. Chỉ kiểm kiểu ở đây (để service nhận đúng dạng);
 * miền giá trị (độ dài tên, ngày có thật, số tuần, chồng lấn) do service kiểm.
 * Trả null nếu body không đúng hình dạng.
 */
export async function parseAcademicTermBody(req: Request): Promise<AcademicTermInput | null> {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return null;
  }
  const b = body as { name?: unknown; startDate?: unknown; weekCount?: unknown } | null;
  if (
    typeof b?.name !== "string" ||
    typeof b.startDate !== "string" ||
    typeof b.weekCount !== "number"
  ) {
    return null;
  }
  return { name: b.name, startDate: b.startDate, weekCount: b.weekCount };
}

export function academicTermErrorResponse(e: AcademicTermError): NextResponse {
  const status =
    e.code === "forbidden" ? 403 : e.code === "not_found" ? 404 : e.code === "overlaps_existing_term" ? 409 : 400;
  return NextResponse.json(e.details ? { error: e.code, details: e.details } : { error: e.code }, { status });
}
