import { NextResponse } from "next/server";
import { parseWordUpload, previewPayload, readWordUpload } from "@/lib/examWordImport";

export const runtime = "nodejs";

/**
 * Xem trước nhập câu hỏi từ file Word (.docx): đọc file, kiểm từng câu, trả bảng như Excel/AI.
 * KHÔNG ghi gì (không tải ảnh, không tạo đoạn/câu) — docs/tieu-chi/nhap-de-thi-tu-word.md.
 * Body: multipart/form-data { file: <docx> }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const up = await readWordUpload(req, params.id);
  if (up instanceof NextResponse) return up;
  const parsed = await parseWordUpload(up.buf);
  if (!parsed) return NextResponse.json({ error: "invalid_docx" }, { status: 422 });
  if (parsed.rows.length === 0) return NextResponse.json({ error: "no_questions_found" }, { status: 422 });
  return NextResponse.json(previewPayload(parsed));
}
