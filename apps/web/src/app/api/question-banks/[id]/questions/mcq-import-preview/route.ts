import { NextResponse } from "next/server";
import { parseMcqImportXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/** Parse .xlsx → preview rows for Question Bank. See quiz route for details. */
export async function POST(
  req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  void params.id;

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: "validation_failed", details: "missing_file" },
      { status: 400 },
    );
  }
  const buf = Buffer.from(await file.arrayBuffer());
  try {
    return NextResponse.json(parseMcqImportXlsx(buf));
  } catch (e) {
    return NextResponse.json(
      {
        error: "parse_failed",
        details: e instanceof Error ? e.message : "unknown",
      },
      { status: 400 },
    );
  }
}
