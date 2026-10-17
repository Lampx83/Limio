import { NextResponse } from "next/server";
import {
  ExamNetworkValidationError,
  OrgMemberError,
  getOrgExamNetwork,
  updateOrgExamNetwork,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { examClientIp, isInternalIp } from "@/lib/exam-network";

export const runtime = "nodejs";

function orgError(e: unknown): NextResponse | null {
  if (e instanceof OrgMemberError) {
    const status = e.code === "forbidden" ? 403 : e.code === "org_not_found" ? 404 : 400;
    return NextResponse.json({ error: e.code }, { status });
  }
  return null;
}

/**
 * GET /api/orgs/[id]/exam-network — dải mạng được phép vào thi của trường, kèm IP
 * mà máy chủ đang thấy cho chính request này. Quản trị viên dùng IP đó để kiểm
 * tra proxy truyền đúng IP thật trước khi bật giới hạn.
 */
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const rules = await getOrgExamNetwork(userId, params.id);
    const ip = examClientIp(req.headers);
    return NextResponse.json({
      rules,
      detectedIp: ip,
      detectedIpInternal: ip ? isInternalIp(ip) : null,
    });
  } catch (e) {
    const r = orgError(e);
    if (r) return r;
    throw e;
  }
}

/** PUT /api/orgs/[id]/exam-network — body { rules: string[] } (mỗi phần tử một IP/CIDR). [] = bỏ giới hạn. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { rules?: unknown };
  try {
    body = (await req.json()) as { rules?: unknown };
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.rules) || body.rules.some((r) => typeof r !== "string"))
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const rules = await updateOrgExamNetwork(userId, params.id, body.rules as string[]);
    return NextResponse.json({ ok: true, rules });
  } catch (e) {
    if (e instanceof ExamNetworkValidationError)
      return NextResponse.json({ error: "invalid_ip_rules", invalid: e.invalid }, { status: 400 });
    const r = orgError(e);
    if (r) return r;
    throw e;
  }
}
