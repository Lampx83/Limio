import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { importSessionRooms, type SessionImportRow } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

function baseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

const str = (v: unknown) => (typeof v === "string" ? v : null);
const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);

/**
 * POST /api/exam-sessions/[id]/import — nhập phòng + giám thị + lớp học +
 * thí sinh cho MỘT ca từ một bảng dán. Xem core-lms/exam/session-import.ts.
 */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { rows?: unknown } | null;
  if (!body || !Array.isArray(body.rows))
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  const rows: SessionImportRow[] = (body.rows as Array<Record<string, unknown>>).map((r) => ({
    examClassCode: str(r.examClassCode) ?? "",
    cohortCode: str(r.cohortCode),
    instructorEmail: str(r.instructorEmail),
    roomLocation: str(r.roomLocation),
    proctorEmail: str(r.proctorEmail),
    stt: num(r.stt),
    displayName: str(r.displayName),
    email: str(r.email),
    mssv: str(r.mssv),
  }));

  try {
    const result = await importSessionRooms(userId, params.id, rows, baseUrl());
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
