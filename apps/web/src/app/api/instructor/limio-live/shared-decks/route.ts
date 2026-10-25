import { NextResponse } from "next/server";
import { prisma } from "@feedbackme/db";
import { listDecksSharedWithMe } from "@feedbackme/core-lms";
import { requireFeature } from "@/lib/session";

/** GET: bài giảng người khác thêm mình vào làm đồng giảng viên ("Được chia sẻ với tôi"). */
export async function GET() {
  const userId = await requireFeature("limio_live.access");
  if (!userId) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  return NextResponse.json({ decks: await listDecksSharedWithMe(userId, prisma) });
}
