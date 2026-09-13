// A6.1 — Vấn đáp AI. Trích text thuần từ file GV upload (parse thuần tuý,
// KHÔNG gọi AI). Trả về null khi parse thất bại hoặc không có text layer
// (vd PDF scan ảnh) — route/caller phải cảnh báo GV, không suy đoán thay.

export async function extractMaterialText(
  buf: Buffer,
  mimeType: string,
): Promise<string | null> {
  try {
    if (mimeType === "text/plain" || mimeType === "text/markdown") {
      const text = buf.toString("utf-8").trim();
      return text.length > 0 ? text : null;
    }
    if (mimeType === "application/pdf") {
      // Import the inner lib path, NOT "pdf-parse" itself — that package's
      // top-level index.js runs debug code that reads a fixture file off disk
      // when it detects no CJS parent module (true for a dynamic ESM import),
      // crashing with ENOENT instead of parsing our buffer.
      const pdfParse = (await import("pdf-parse/lib/pdf-parse.js")).default;
      const result = await pdfParse(buf);
      const text = result.text.trim();
      return text.length > 0 ? text : null;
    }
    if (
      mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer: buf });
      const text = result.value.trim();
      return text.length > 0 ? text : null;
    }
    return null;
  } catch {
    // File hỏng / không parse được — im lặng trả null, không throw. Đây là
    // trường hợp acceptance criteria mô tả rõ: để trống chứ không chặn upload.
    return null;
  }
}
