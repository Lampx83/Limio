import { NextResponse } from "next/server";
import { clearCourseSessionPlan, getCourseSessionPlan, saveCourseSessionPlan } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

async function guard<T>(fn: (userId: string) => Promise<T>) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    return NextResponse.json(await fn(userId));
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}

/** Phân phối chương trình của khoá (CENTER K): bài theo buổi cho mọi lớp. Người quản khoá và người chỉ dạy xem được. */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  return guard((u) => getCourseSessionPlan(u, params.id));
}

/** Thay toàn bộ bảng: { sessions: Array<{ topic?: string | null; lessonIds: string[] }> }, dòng i là buổi i+1. Người quản khoá. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const body = await readJson(req);
  return guard((u) => saveCourseSessionPlan(u, params.id, body));
}

/** "Xoá phân phối": khoá quay về giáo án theo chương. Người quản khoá. */
export async function DELETE(_req: Request, { params }: { params: { id: string } }) {
  return guard((u) => clearCourseSessionPlan(u, params.id));
}
