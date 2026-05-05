import { NextResponse } from "next/server";
import {
  isAdmin,
  listLtiTools,
  LtiError,
  registerLtiTool,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

export async function GET() {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const tools = await listLtiTools();
  return NextResponse.json({ tools });
}

export async function POST(req: Request) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await readJson(req)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  try {
    const tool = await registerLtiTool(userId, {
      name: String(body.name ?? ""),
      toolUrl: String(body.toolUrl ?? ""),
      loginInitUrl: String(body.loginInitUrl ?? ""),
      jwksUrl: typeof body.jwksUrl === "string" ? body.jwksUrl : null,
      deploymentId: typeof body.deploymentId === "string" ? body.deploymentId : undefined,
    });
    return NextResponse.json(
      {
        id: tool.id,
        clientId: tool.clientId,
        deploymentId: tool.deploymentId,
        publicKeyKid: tool.publicKeyKid,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof LtiError) {
      return NextResponse.json({ error: e.code, details: e.details }, { status: 400 });
    }
    throw e;
  }
}
