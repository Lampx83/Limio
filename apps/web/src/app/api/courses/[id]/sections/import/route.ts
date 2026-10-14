import { NextResponse } from "next/server";
import {
  importCourseSections,
  SectionImportError,
  type SectionImportInputRow,
} from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError } from "@/lib/apiHelpers";

export const runtime = "nodejs";
// Mỗi dòng tạo một lớp tuần tự — cho phép request chạy lâu hơn mặc định.
export const maxDuration = 120;

const str = (v: unknown) => (typeof v === "string" ? v : undefined);

/**
 * POST /api/courses/[id]/sections/import — body `{ rows: [{line, name, termLabel?, note?}] }`.
 * Server phân loại lại từng dòng, chỉ tạo các dòng hợp lệ; dòng lỗi được trả về trong `failed`.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { rows?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!Array.isArray(body.rows)) return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const rows: SectionImportInputRow[] = [];
  for (const [i, r] of (body.rows as unknown[]).entries()) {
    const o = r as Record<string, unknown> | null;
    if (!o || typeof o.name !== "string") {
      return NextResponse.json({ error: "validation_failed" }, { status: 400 });
    }
    rows.push({
      line: typeof o.line === "number" ? o.line : i + 2,
      name: o.name,
      termLabel: str(o.termLabel),
      note: str(o.note),
    });
  }

  try {
    return NextResponse.json(await importCourseSections(userId, params.id, rows));
  } catch (e) {
    if (e instanceof SectionImportError) return NextResponse.json({ error: e.code }, { status: 400 });
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
