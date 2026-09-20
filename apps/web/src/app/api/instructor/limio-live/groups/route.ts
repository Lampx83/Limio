import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import {
  createLiveDeckGroup,
  listLinkableCourses,
  listLiveDeckGroups,
} from "@feedbackme/core-lms";
import { z } from "zod";

const GroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  kind: z.enum(["course", "event", "other"]),
  courseId: z.string().uuid().nullable().optional(),
});

/**
 * GET /api/instructor/limio-live/groups
 * Nhóm bài giảng của giảng viên + danh sách khoá LMS có thể liên kết.
 */
export async function GET() {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const [groups, courses] = await Promise.all([
      listLiveDeckGroups(userId, prisma),
      listLinkableCourses(userId, prisma),
    ]);
    return NextResponse.json({ groups, courses });
  } catch (error) {
    console.error("[Limio-Live Groups API - GET]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** POST /api/instructor/limio-live/groups — tạo nhóm mới */
export async function POST(req: NextRequest) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    const parsed = GroupSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid input", details: parsed.error.flatten() },
        { status: 400 }
      );
    }
    const group = await createLiveDeckGroup(userId, parsed.data, prisma);
    return NextResponse.json(group, { status: 201 });
  } catch (error) {
    console.error("[Limio-Live Groups API - POST]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.startsWith("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
