import { NextResponse } from "next/server";
import {
  MemberImportError,
  OrgMemberError,
  parseMemberImportSheet,
  parseMemberImportText,
  previewOrgMemberImport,
  type ParsedMemberRow,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/orgs/[id]/members/import/preview
 * multipart (field `file`: .xlsx/.xls/.csv) hoặc JSON `{ text }`.
 * Chỉ phân loại từng dòng, không ghi DB.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let rows: ParsedMemberRow[];
  try {
    if ((req.headers.get("content-type") ?? "").includes("multipart/form-data")) {
      const file = (await req.formData()).get("file");
      if (!(file instanceof File) || file.size === 0) {
        return NextResponse.json({ error: "no_file" }, { status: 400 });
      }
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json({ error: "file_too_large" }, { status: 413 });
      }
      rows = parseMemberImportSheet(Buffer.from(await file.arrayBuffer()));
    } else {
      const body = (await req.json()) as { text?: unknown };
      if (typeof body.text !== "string") {
        return NextResponse.json({ error: "validation_failed" }, { status: 400 });
      }
      rows = parseMemberImportText(body.text);
    }
  } catch {
    return NextResponse.json({ error: "unreadable_input" }, { status: 400 });
  }

  try {
    return NextResponse.json(await previewOrgMemberImport(userId, params.id, rows));
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
