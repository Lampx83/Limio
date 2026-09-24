import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { getCourseOutlineForImport, listImportableCourses } from "@feedbackme/core-lms";

/**
 * GET /api/instructor/limio-live/import-course
 *   → các khoá giảng viên được sửa (để chọn nguồn nhập bài giảng)
 * GET ...?courseId=<uuid>
 *   → mục lục (chương → bài) của khoá đó
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

    const courseId = req.nextUrl.searchParams.get("courseId");
    if (!courseId) {
      return NextResponse.json({ courses: await listImportableCourses(userId, prisma) });
    }
    const modules = await getCourseOutlineForImport(userId, courseId, prisma);
    return NextResponse.json({ modules });
  } catch (error) {
    console.error("[Limio-Live Import Course API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: message.startsWith("Not authorized") ? 403 : 500 });
  }
}
