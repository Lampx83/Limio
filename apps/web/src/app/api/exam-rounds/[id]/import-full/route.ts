import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { bulkImportRoundFull } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";
import { mapKnownError, readJson } from "@/lib/apiHelpers";

export const runtime = "nodejs";

function getBaseUrl(): string {
  const h = headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  return `${proto}://${host}`;
}

export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await readJson(req)) as { rows?: unknown[] } | null;
  const rows = Array.isArray(body?.rows) ? (body!.rows as Array<Record<string, unknown>>) : null;
  if (!rows || rows.length === 0)
    return NextResponse.json({ error: "validation_failed" }, { status: 400 });

  try {
    const result = await bulkImportRoundFull(
      userId,
      params.id,
      rows.map((r) => ({
        cohortCode: String(r.cohortCode ?? ""),
        instructorEmail:
          typeof r.instructorEmail === "string" ? r.instructorEmail : null,
        examClassCode: String(r.examClassCode ?? ""),
        studentCount:
          typeof r.studentCount === "number" ? r.studentCount : null,
        roomLocation:
          typeof r.roomLocation === "string" ? r.roomLocation : null,
        proctorEmail:
          typeof r.proctorEmail === "string" ? r.proctorEmail : null,
        sessionCode: String(r.sessionCode ?? ""),
        stt: typeof r.stt === "number" ? r.stt : null,
      })),
      getBaseUrl(),
    );
    return NextResponse.json(result);
  } catch (e) {
    const mapped = mapKnownError(e);
    if (mapped) return mapped;
    throw e;
  }
}
