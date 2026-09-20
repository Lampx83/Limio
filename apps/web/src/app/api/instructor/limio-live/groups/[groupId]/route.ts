import { NextRequest, NextResponse } from "next/server";
import { requireFeature } from "@/lib/session";
import { prisma } from "@feedbackme/db";
import { deleteLiveDeckGroup, updateLiveDeckGroup } from "@feedbackme/core-lms";
import { z } from "zod";

const GroupSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  kind: z.enum(["course", "event", "other"]),
  courseId: z.string().uuid().nullable().optional(),
});

/** PATCH — sửa tên / loại / khoá liên kết của nhóm */
export async function PATCH(
  req: NextRequest,
  { params }: { params: { groupId: string } }
) {
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
    const group = await updateLiveDeckGroup(params.groupId, userId, parsed.data, prisma);
    return NextResponse.json(group);
  } catch (error) {
    console.error("[Limio-Live Group API - PATCH]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.startsWith("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** DELETE — xoá nhóm; bài giảng trong nhóm chỉ mất nhóm, không bị xoá */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { groupId: string } }
) {
  try {
    const userId = await requireFeature("limio_live.access");
    if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
    await deleteLiveDeckGroup(params.groupId, userId, prisma);
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[Limio-Live Group API - DELETE]", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    const status = message.startsWith("Not authorized") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
