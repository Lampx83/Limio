import { NextResponse } from "next/server";
import { commitWordImport, parseWordUpload, readWordUpload } from "@/lib/examWordImport";

export const runtime = "nodejs";

/**
 * Nhập câu hỏi từ file Word sau khi xem trước. Đọc lại file (không tin dữ liệu từ trình duyệt), rồi tải ảnh, tạo đoạn văn và câu hỏi.
 * Body: multipart/form-data { file: <docx>, includeWarnings: "true"|"false" }
 * Trả: { imported, passagesCreated, imagesUploaded, skippedError, skippedWarning, errors: [{rowNumber, errors[]}] }
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const up = await readWordUpload(req, params.id);
  if (up instanceof NextResponse) return up;
  const parsed = await parseWordUpload(up.buf);
  if (!parsed) return NextResponse.json({ error: "invalid_docx" }, { status: 422 });
  if (parsed.rows.length === 0) return NextResponse.json({ error: "no_questions_found" }, { status: 422 });
  const result = await commitWordImport(up.userId, up.examId, parsed, up.includeWarnings);
  return NextResponse.json(result);
}
