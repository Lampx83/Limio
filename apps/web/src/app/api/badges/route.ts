import { NextResponse } from "next/server";
import { listBadgeCatalog } from "@feedbackme/core-gamification";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const items = await listBadgeCatalog();
  return NextResponse.json({ items });
}
