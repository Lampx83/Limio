import { z } from "zod";
import { prisma } from "@feedbackme/db";
import {
  QUICK_ACTIVITY_KINDS,
  TRASH_BATCH_LIMIT,
  deleteQuickActivitiesForever,
  moveQuickActivitiesToTrash,
  restoreQuickActivities,
  type QuickActivityKind,
} from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";

export const runtime = "nodejs";

const BodySchema = z.object({
  kind: z.enum(QUICK_ACTIVITY_KINDS as [QuickActivityKind, ...QuickActivityKind[]]),
  ids: z.array(z.string().min(1)).min(1).max(TRASH_BATCH_LIMIT),
  action: z.enum(["trash", "restore", "delete_forever"]),
});

// POST — thùng rác của lịch sử Hoạt động nhanh. Id không thuộc GV này bị bỏ qua (count chỉ đếm phiên đã đổi).
export async function POST(req: Request) {
  const userId = await requireFeature("teaching_tools.access");
  if (!userId) {
    return Response.json({ error: "forbidden" }, { status: 403 });
  }

  const parsed = BodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "invalid_body" }, { status: 400 });
  }
  const { kind, ids, action } = parsed.data;

  const result =
    action === "trash"
      ? await moveQuickActivitiesToTrash(kind, ids, userId, prisma)
      : action === "restore"
        ? await restoreQuickActivities(kind, ids, userId, prisma)
        : await deleteQuickActivitiesForever(kind, ids, userId, prisma);

  return Response.json({ ok: true, count: result.count });
}
