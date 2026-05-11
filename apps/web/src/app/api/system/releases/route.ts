/**
 * POST /api/system/releases — ghi release mới (gọi bởi deploy workflow)
 * GET  /api/system/releases — đọc danh sách release (chỉ admin)
 */
import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { requireAdmin } from "@/lib/session";
import { z } from "zod";

// ── Xác thực cron-secret (dùng chung với cron routes) ─────────────────────
function isCronAuthed(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("x-cron-secret") ?? "";
  return header === expected;
}

// ── Schema body cho POST ───────────────────────────────────────────────────
const CreateReleaseSchema = z.object({
  tag:        z.string().min(1).max(100),
  sha:        z.string().length(40),
  body:       z.string().max(50_000),
  deployedAt: z.string().datetime(),
});

// ── POST — deploy workflow ghi vào sau khi health check pass ──────────────
export async function POST(req: Request) {
  if (!isCronAuthed(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let parsed;
  try {
    const json = await req.json();
    parsed = CreateReleaseSchema.parse(json);
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const release = await prisma.systemRelease.upsert({
    where: { tag: parsed.tag },
    create: {
      tag:        parsed.tag,
      sha:        parsed.sha,
      body:       parsed.body,
      deployedAt: new Date(parsed.deployedAt),
    },
    // Idempotent: nếu đã tồn tại thì update body (trường hợp re-run workflow)
    update: {
      body:       parsed.body,
      deployedAt: new Date(parsed.deployedAt),
    },
  });

  return NextResponse.json({ ok: true, id: release.id }, { status: 201 });
}

// ── GET — admin đọc danh sách 30 release gần nhất ─────────────────────────
export async function GET() {
  const userId = await requireAdmin();
  if (!userId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const releases = await prisma.systemRelease.findMany({
    orderBy: { deployedAt: "desc" },
    take: 30,
    select: {
      id:         true,
      tag:        true,
      sha:        true,
      body:       true,
      deployedAt: true,
      createdAt:  true,
    },
  });

  return NextResponse.json({ releases });
}
