import { NextResponse } from "next/server";
import {
  deleteIntegrationCredential,
  IntegrationError,
  isAdmin,
  setIntegrationCredential,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function POST(
  req: Request,
  { params }: { params: { key: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await readJson(req)) as { value?: string; meta?: Record<string, unknown> } | null;
  if (!body?.value) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  try {
    await setIntegrationCredential(params.key, body.value, userId, body.meta ?? null);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof IntegrationError) {
      return NextResponse.json(
        { error: e.code, details: e.details },
        { status: e.code === "validation_failed" ? 400 : 500 },
      );
    }
    throw e;
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: { key: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  try {
    await deleteIntegrationCredential(params.key);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof IntegrationError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    throw e;
  }
}
