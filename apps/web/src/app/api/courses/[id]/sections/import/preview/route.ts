import { NextResponse } from "next/server";
import {
  parseSectionImportSheet,
  previewSectionImport,
  SectionImportError,
  type SectionImportInputRow,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";

const MAX_FILE_BYTES = 2 * 1024 * 1024;

/**
 * POST /api/courses/[id]/sections/import/preview — multipart, field `file` (.xlsx/.xls/.csv).
 * Chỉ phân loại từng dòng (kèm kỳ / giáo viên đã tra), không ghi DB.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let rows: SectionImportInputRow[];
  try {
    const file = (await req.formData()).get("file");
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: "no_file" }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ error: "file_too_large" }, { status: 413 });
    }
    rows = parseSectionImportSheet(Buffer.from(await file.arrayBuffer()));
  } catch {
    return NextResponse.json({ error: "unreadable_input" }, { status: 400 });
  }

  try {
    return NextResponse.json(await previewSectionImport(userId, params.id, rows));
  } catch (e) {
    if (e instanceof SectionImportError) return NextResponse.json({ error: e.code }, { status: 400 });
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
