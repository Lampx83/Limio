import * as XLSX from "xlsx";

function cell(v: unknown): string {
  return v == null ? "" : String(v).trim();
}

function csvCell(v: string): string {
  return /[",\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

/**
 * Đọc file Excel theo mẫu `mau-nhap-cau-hoi.xlsx` (mỗi câu hỏi MỘT dòng:
 * Câu hỏi | Đáp án A–D | Đáp án đúng | Giải thích) rồi đổi sang đúng CSV mà API
 * bulk-import đang nhận (mỗi đáp án một dòng: prompt,type,option_label,is_correct,explanation,points).
 * Đọc theo VỊ TRÍ cột A–G, dữ liệu bắt đầu sau dòng tiêu đề (dòng đầu có ô A bắt đầu bằng "Câu hỏi").
 */
export async function questionSheetToCsv(file: File): Promise<string> {
  const wb = XLSX.read(await file.arrayBuffer(), { type: "array" });
  const name = wb.SheetNames.find((n) => n.trim().toLowerCase() === "câu hỏi") ?? wb.SheetNames[0]!;
  const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[name]!, { header: 1, blankrows: false, defval: "" });

  const headerAt = rows.findIndex((r) => cell(r[0]).toLowerCase().startsWith("câu hỏi"));
  if (headerAt < 0) throw new Error("template_header_not_found");

  const out = ["prompt,type,option_label,is_correct,explanation,points"];
  for (const r of rows.slice(headerAt + 1)) {
    const prompt = cell(r[0]);
    if (!prompt) continue;
    const options = [1, 2, 3, 4].map((i) => cell(r[i]));
    const correct = new Set(
      cell(r[5])
        .toUpperCase()
        .split(/[^A-D]+/)
        .filter(Boolean)
        .map((L) => L.charCodeAt(0) - 65),
    );
    const explanation = cell(r[6]);
    const filled = options.map((label, i) => ({ label, i })).filter((o) => o.label);
    const isTrueFalse =
      filled.length === 2 && filled.every((o) => /^(đúng|sai)$/i.test(o.label));
    const type = isTrueFalse ? "true_false" : "mcq";
    if (filled.length === 0) {
      // Không có đáp án nào: vẫn gửi 1 dòng để API báo lỗi "no_options" đúng câu.
      out.push([prompt, type, "", "false", explanation, ""].map(csvCell).join(","));
      continue;
    }
    for (const o of filled) {
      out.push(
        [prompt, type, o.label, correct.has(o.i) ? "true" : "false", explanation, ""]
          .map(csvCell)
          .join(","),
      );
    }
  }
  return out.join("\n");
}
