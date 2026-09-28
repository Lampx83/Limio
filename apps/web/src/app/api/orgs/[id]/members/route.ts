import { NextResponse } from "next/server";
import { listOrgMembers, addOrgMember, OrgMemberError } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

function errorStatus(code: OrgMemberError["code"]): number {
  switch (code) {
    case "forbidden":
      return 403;
    case "org_not_found":
      return 404;
    case "already_member":
    case "belongs_to_other_org":
      return 409;
    default:
      return 400;
  }
}

export async function GET(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? undefined;
  const page = Number(url.searchParams.get("page") ?? 0);
  const limit = Number(url.searchParams.get("limit") ?? 25);

  try {
    const result = await listOrgMembers(userId, params.id, { q, page, limit });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof OrgMemberError) {
      return NextResponse.json({ error: e.code }, { status: errorStatus(e.code) });
    }
    throw e;
  }
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { email?: unknown; displayName?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  const email = typeof body.email === "string" ? body.email : "";
  const displayName =
    typeof body.displayName === "string" ? body.displayName : undefined;
  if (!email.trim()) {
    return NextResponse.json({ error: "missing_email" }, { status: 400 });
  }

  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  try {
    const result = await addOrgMember(userId, params.id, {
      email,
      displayName,
      baseUrl,
    });
    return NextResponse.json(result, { status: result.invited ? 201 : 200 });
  } catch (e) {
    if (e instanceof OrgMemberError) {
      return NextResponse.json({ error: e.code }, { status: errorStatus(e.code) });
    }
    throw e;
  }
}
