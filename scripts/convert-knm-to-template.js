/**
 * One-shot converter: docs/Kho KNM (1).xlsx → docs/Kho-KNM-import.xlsx
 *
 * Source sheet "Kho 282_OK" có 282 câu MCQ kỹ năng mềm. Output đúng template
 * import của FeedBackMe Question Bank (14 cột) — paste lên server 224 qua
 * nút "Import .xlsx" trên trang ngân hàng câu hỏi.
 *
 * Mapping:
 *   Kỹ năng          → Topic
 *   Mức độ đầu ra    → CognitiveLevel (M1/M2 = remember_understand, M3 = apply)
 *                       + Difficulty (M1=2, M2=3, M3=4)
 *   Nội dung         → Prompt
 *   A/B/C/D          → OptionA/B/C/D (giữ nguyên text, không thêm "A. ")
 *   Đáp án đúng      → Correct (chuẩn hoá về "A" hoặc "A,C")
 */

const XLSX = require("../apps/web/node_modules/xlsx");
const path = require("path");

const SRC = path.resolve(__dirname, "../docs/Kho KNM (1).xlsx");
const DST = path.resolve(__dirname, "../docs/Kho-KNM-import.xlsx");

const LEVEL_MAP = {
  M1: { cognitive: "remember_understand", difficulty: 2 },
  M2: { cognitive: "remember_understand", difficulty: 3 },
  M3: { cognitive: "apply", difficulty: 4 },
};

/**
 * Chuẩn hoá "Đáp án đúng" về chuỗi letter ("A", "A,C", …).
 * Trả null nếu không suy ra được.
 */
function normalizeCorrect(raw, opts) {
  const s = (raw ?? "").toString().trim();
  if (!s) return null;

  // Case 1: chuỗi chỉ chứa các letter A-F + dấu phân tách → multi-letter
  const onlyLetters = /^[A-F][A-F,;.\s/]*$/i.test(s);
  if (onlyLetters) {
    const letters = [...new Set(s.toUpperCase().match(/[A-F]/g) ?? [])];
    if (letters.length > 0) return letters.join(",");
  }

  // Case 2: bắt đầu bằng "A.", "B) ", … → lấy letter đầu
  const lead = s.match(/^\s*([A-F])\s*[.):\-]\s*/i);
  if (lead) return lead[1].toUpperCase();

  // Case 3: text khớp với 1 option → suy ra letter từ vị trí option
  const cleanAns = stripLetterPrefix(s).toLowerCase();
  for (const [letter, optText] of Object.entries(opts)) {
    if (!optText) continue;
    const cleanOpt = stripLetterPrefix(optText).toLowerCase();
    if (cleanOpt === cleanAns) return letter;
  }
  // Fuzzy: 1 bên chứa toàn bộ bên kia (sau strip)
  for (const [letter, optText] of Object.entries(opts)) {
    if (!optText) continue;
    const cleanOpt = stripLetterPrefix(optText).toLowerCase();
    if (cleanOpt && cleanAns && (cleanOpt.includes(cleanAns) || cleanAns.includes(cleanOpt))) {
      return letter;
    }
  }

  return null;
}

function stripLetterPrefix(s) {
  return s.replace(/^\s*[A-F]\s*[.):\-]\s*/i, "").trim();
}

const wb = XLSX.readFile(SRC);
const src = XLSX.utils.sheet_to_json(wb.Sheets["Kho 282_OK"], { defval: "", raw: false });

const HEADER = [
  "Topic",
  "Prompt",
  "Type",
  "OptionA",
  "OptionB",
  "OptionC",
  "OptionD",
  "OptionE",
  "OptionF",
  "Correct",
  "Points",
  "Difficulty",
  "CognitiveLevel",
  "Explanation",
];

const outRows = [HEADER];
const issues = [];

for (const r of src) {
  const prompt = (r["Nội dung"] ?? "").toString().trim();
  if (!prompt) continue; // bỏ row trống

  const tt = r["TT"];
  const topic = (r["Kỹ năng"] ?? "").toString().trim();
  const mức = (r["Mức độ đầu ra"] ?? "").toString().trim().toUpperCase();
  const map = LEVEL_MAP[mức] ?? { cognitive: "apply", difficulty: 3 };
  const opts = { A: r["A"], B: r["B"], C: r["C"], D: r["D"] };

  const correct = normalizeCorrect(r["Đáp án đúng"], opts);
  if (!correct) {
    issues.push({ tt, prompt: prompt.slice(0, 60), reason: `Correct="${r["Đáp án đúng"]}" không suy ra được letter` });
  }

  outRows.push([
    topic,                              // Topic
    prompt,                             // Prompt
    "mcq",                              // Type
    (opts.A ?? "").toString().trim(),   // OptionA
    (opts.B ?? "").toString().trim(),   // OptionB
    (opts.C ?? "").toString().trim(),   // OptionC
    (opts.D ?? "").toString().trim(),   // OptionD
    "",                                 // OptionE
    "",                                 // OptionF
    correct ?? "",                      // Correct
    1,                                  // Points
    map.difficulty,                     // Difficulty
    map.cognitive,                      // CognitiveLevel
    "",                                 // Explanation (để trống)
  ]);
}

const ws = XLSX.utils.aoa_to_sheet(outRows);
ws["!cols"] = [
  { wch: 28 },  // Topic
  { wch: 60 },  // Prompt
  { wch: 8 },   // Type
  { wch: 30 },  // A
  { wch: 30 },  // B
  { wch: 30 },  // C
  { wch: 30 },  // D
  { wch: 18 },  // E
  { wch: 18 },  // F
  { wch: 10 },  // Correct
  { wch: 8 },   // Points
  { wch: 10 },  // Difficulty
  { wch: 22 },  // CognitiveLevel
  { wch: 40 },  // Explanation
];

const outWb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(outWb, ws, "Questions");
XLSX.writeFile(outWb, DST);

console.log(`✓ Wrote ${DST}`);
console.log(`  Total questions: ${outRows.length - 1}`);
console.log(`  Resolved Correct: ${outRows.length - 1 - issues.length}`);
console.log(`  Unresolved Correct: ${issues.length}`);
if (issues.length > 0) {
  console.log("\nRows cần sửa thủ công:");
  for (const i of issues) console.log(`  TT ${i.tt}: ${i.reason} — "${i.prompt}…"`);
}
