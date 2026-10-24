import { NextResponse } from "next/server";
import { z } from "zod";
import { GENERATION_STALE_MS, listCourseNarrations, type NarrationKind } from "@feedbackme/core-lms";
import { prisma } from "@feedbackme/db";
import { requireAdmin } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";
import { missingVoice, startNarrationJobs } from "@/lib/narration/job";

export const runtime = "nodejs";

const Body = z.object({
  voices: z.object({
    lecturer: z.string().trim().min(1).max(100).optional(),
    A: z.string().trim().min(1).max(100).optional(),
    B: z.string().trim().min(1).max(100).optional(),
  }),
  /** Bỏ trống = mọi dòng chưa có giọng, giọng đã cũ hoặc đang lỗi. Có `ids` thì làm đúng các dòng đó (kể cả "Tạo lại"). */
  ids: z.array(z.string().uuid()).max(100).optional(),
});

const PENDING = new Set(["script", "stale", "failed"]);

/**
 * Quản trị bấm "Tạo giọng". Trả ngay 202; việc chạy nền lần lượt từng dòng, tiến độ đọc ở GET .../narrations.
 */
export async function POST(req: Request, { params }: { params: { courseId: string } }) {
  if (!(await requireAdmin())) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const parsed = Body.safeParse(await readJson(req));
  if (!parsed.success) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  const { voices, ids } = parsed.data;

  const rows = await listCourseNarrations(params.courseId);
  const wanted = ids ? rows.filter((r) => ids.includes(r.id)) : rows.filter((r) => PENDING.has(r.state));
  if (ids && wanted.length !== new Set(ids).size) return NextResponse.json({ error: "not_in_course" }, { status: 400 });

  // Bỏ dòng đang chạy thật (còn tín hiệu): bấm lần nữa không được chạy hai việc song song.
  const freshBefore = Date.now() - GENERATION_STALE_MS;
  const running = new Set(
    (await prisma.lessonNarration.findMany({ where: { id: { in: wanted.map((r) => r.id) }, status: "generating", updatedAt: { gt: new Date(freshBefore) } }, select: { id: true } })).map((r) => r.id),
  );
  const targets = wanted.filter((r) => !running.has(r.id));

  for (const t of targets) {
    const missing = missingVoice(t.kind as NarrationKind, voices);
    if (missing) return NextResponse.json({ error: "voice_required", role: missing, lessonTitle: t.lessonTitle, kind: t.kind }, { status: 400 });
  }
  if (targets.length === 0) return NextResponse.json({ ok: true, queued: 0, alreadyRunning: running.size }, { status: ids && running.size ? 409 : 200 });

  startNarrationJobs(targets.map((t) => t.id), voices);
  return NextResponse.json({ ok: true, queued: targets.length, alreadyRunning: running.size }, { status: 202 });
}
