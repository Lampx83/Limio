import { NextResponse } from "next/server";
import { createBank, listBanks } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const banks = await listBanks(userId);
  return NextResponse.json({ banks });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await readJson(req);
  try {
    const r = await createBank(userId, body);
    return NextResponse.json(r, { status: 201 });
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
