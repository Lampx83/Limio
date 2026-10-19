import { NextResponse } from "next/server";
import { importExamManifest } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";
export const maxDuration = 120; // vài trăm đề tạo tuần tự

/**
 * LANG L6.8 — nhập hàng loạt đề. Body: { manifest, dryRun?, publish?, defaultSkill? }. `dryRun` chỉ kiểm tra và báo
 * từng đề, không ghi gì. Quyền sửa khoá kiểm trong core.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { manifest?: unknown; dryRun?: boolean; publish?: boolean; defaultSkill?: "listening" | "reading" | "writing" | "speaking" } | null;
  if (!body || body.manifest === undefined) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const r = await importExamManifest(userId, params.id, body.manifest, {
      dryRun: body.dryRun === true,
      publish: body.publish === true,
      defaultSkill: body.defaultSkill,
    });
    return NextResponse.json(r);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
