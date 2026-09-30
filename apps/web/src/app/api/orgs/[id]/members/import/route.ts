import { NextResponse } from "next/server";
import {
  importOrgMembers,
  MemberImportError,
  OrgMemberError,
  type ParsedMemberRow,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";
// Mỗi dòng tạo user tuần tự (có thể kèm gửi mail) — cho phép request chạy lâu hơn mặc định.
export const maxDuration = 300;

/** POST /api/orgs/[id]/members/import — body `{ rows: [{line,email,displayName?}] }`. Gửi mail mời hay không do cấu hình của trường quyết định. */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { rows?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) {
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });
  }
  const rows: ParsedMemberRow[] = [];
  for (const [i, r] of (body.rows as unknown[]).entries()) {
    const o = r as { line?: unknown; email?: unknown; displayName?: unknown } | null;
    if (!o || typeof o.email !== "string") {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    rows.push({
      line: typeof o.line === "number" ? o.line : i + 1,
      email: o.email,
      displayName: typeof o.displayName === "string" ? o.displayName : undefined,
    });
  }

  try {
    const result = await importOrgMembers(userId, params.id, rows, {
      baseUrl: process.env.NEXTAUTH_URL ?? "http://localhost:3000",
    });
    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof MemberImportError) {
      return NextResponse.json({ error: e.code }, { status: 400 });
    }
    if (e instanceof OrgMemberError) {
      return NextResponse.json({ error: e.code }, { status: e.code === "forbidden" ? 403 : 400 });
    }
    throw e;
  }
}
