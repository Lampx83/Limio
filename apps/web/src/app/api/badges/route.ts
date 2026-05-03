import { NextResponse } from "next/server";
import { listBadgeCatalog } from "@feedbackme/core-gamification";

export async function GET() {
  const items = await listBadgeCatalog();
  return NextResponse.json({ items });
}
