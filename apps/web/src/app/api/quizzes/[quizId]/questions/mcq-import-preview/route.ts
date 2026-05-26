import { NextResponse } from "next/server";
import { parseMcqImportXlsx } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * POST .xlsx file → trả về danh sách row đã parse + per-row status (ok/
 * warning/error). KHÔNG ghi DB. Caller hiển thị preview cho instructor;
 * sau khi confirm gọi /mcq-import-commit.
 *
 * Multipart form-data: field `file` (file .xlsx).
 */
export async function POST(
  req: Request,
  { params }: { params: { quizId: string } },
) {
  const userId = await requireUserId();
  if (!userId)
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // quizId không validate ownership ở preview — chỉ parse file. Commit step
  // mới enforce auth qua createQuestion. Tránh leak existence của quiz nếu
  // ai đó probe random IDs là acceptable: preview không touch DB.
  void params.quizId;

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
    const result = parseMcqImportXlsx(buf);
    return NextResponse.json(result);
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
