import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { prisma } from "@feedbackme/db";
import { canEditCourse } from "@feedbackme/core-lms";
import { requireUserId } from "@/lib/session";

export const runtime = "nodejs";

/**
 * Download a pre-filled Excel template for question import.
 * Sheets:
 *   Questions  — header row + 6 example rows (one per supported type)
 *   Passages   — list of existing passages on this exam (for PassageTitle reference)
 *   Reference  — enum values + syntax notes
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } },
) {
  const userId = await requireUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const exam = await prisma.exam.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      title: true,
      courseId: true,
      passages: {
        orderBy: { orderIndex: "asc" },
        select: { id: true, title: true, orderIndex: true },
      },
    },
  });
  if (!exam) return NextResponse.json({ error: "exam_not_found" }, { status: 404 });
  if (!(await canEditCourse(userId, exam.courseId))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  // Skills tagged on the exam's course modules — useful as a copy-paste cheat sheet.
  const skills = await prisma.skill.findMany({
    orderBy: { code: "asc" },
    select: { code: true, name: true },
    take: 200,
  });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Questions — headers + 6 example rows.
  const examples = [
    {
      Type: "mcq",
      PassageTitle: exam.passages[0]?.title ?? "",
      Prompt: "Nghiệm của phương trình ax + b = 0 (a ≠ 0) là?",
      Points: 5,
      Difficulty: 2,
      SkillCodes: "algebra.linear",
      OptionA: "x = b/a",
      OptionB: "x = -b/a",
      OptionC: "x = a/b",
      OptionD: "x = -a/b",
      OptionE: "",
      OptionF: "",
      Correct: "B",
      Blanks: "",
      AcceptedAnswers: "",
      MatchMode: "",
      Rubric: "",
      MinWords: "",
      Notes: "Câu cơ bản về phương trình bậc 1",
    },
    {
      Type: "multi",
      PassageTitle: "",
      Prompt: "Chọn TẤT CẢ các số chẵn:",
      Points: 3,
      Difficulty: 1,
      SkillCodes: "math.basic",
      OptionA: "2",
      OptionB: "3",
      OptionC: "4",
      OptionD: "5",
      OptionE: "6",
      OptionF: "",
      Correct: "A;C;E",
      Blanks: "",
      AcceptedAnswers: "",
      MatchMode: "",
      Rubric: "",
      MinWords: "",
      Notes: "MULTI: liệt kê đáp án đúng phân tách bởi ';'",
    },
    {
      Type: "true_false_notgiven",
      PassageTitle: exam.passages[0]?.title ?? "",
      Prompt: "Phương trình bậc 1 luôn có đúng 1 nghiệm.",
      Points: 2,
      Difficulty: 2,
      SkillCodes: "algebra.linear",
      OptionA: "",
      OptionB: "",
      OptionC: "",
      OptionD: "",
      OptionE: "",
      OptionF: "",
      Correct: "true",
      Blanks: "",
      AcceptedAnswers: "",
      MatchMode: "",
      Rubric: "",
      MinWords: "",
      Notes: "Correct: true | false | notgiven",
    },
    {
      Type: "gap_fill",
      PassageTitle: "",
      Prompt: "Thủ đô của Pháp là ___, của Nhật là ___.",
      Points: 4,
      Difficulty: 2,
      SkillCodes: "geography.capitals",
      OptionA: "",
      OptionB: "",
      OptionC: "",
      OptionD: "",
      OptionE: "",
      OptionF: "",
      Correct: "",
      Blanks: "b1:paris|Paris ; b2:tokyo|Tokyo",
      AcceptedAnswers: "",
      MatchMode: "case_insensitive",
      Rubric: "",
      MinWords: "",
      Notes: "Mỗi blank phân tách bởi ';', đáp án trong 1 blank bởi '|'",
    },
    {
      Type: "short_answer",
      PassageTitle: "",
      Prompt: "Thủ đô của Pháp?",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "geography.capitals",
      OptionA: "",
      OptionB: "",
      OptionC: "",
      OptionD: "",
      OptionE: "",
      OptionF: "",
      Correct: "",
      Blanks: "",
      AcceptedAnswers: "paris ; Paris",
      MatchMode: "case_insensitive",
      Rubric: "",
      MinWords: "",
      Notes: "",
    },
    {
      Type: "essay",
      PassageTitle: "",
      Prompt: "Trình bày các bước giải phương trình bậc 1 ẩn x.",
      Points: 10,
      Difficulty: 3,
      SkillCodes: "algebra.linear",
      OptionA: "",
      OptionB: "",
      OptionC: "",
      OptionD: "",
      OptionE: "",
      OptionF: "",
      Correct: "",
      Blanks: "",
      AcceptedAnswers: "",
      MatchMode: "",
      Rubric: "Đầy đủ 3 bước: chuyển vế, gộp, chia.",
      MinWords: 50,
      Notes: "",
    },
  ];
  const wsQuestions = XLSX.utils.json_to_sheet(examples);
  // Set column widths for readability.
  wsQuestions["!cols"] = [
    { wch: 18 },
    { wch: 22 },
    { wch: 50 },
    { wch: 7 },
    { wch: 10 },
    { wch: 25 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 14 },
    { wch: 12 },
    { wch: 30 },
    { wch: 30 },
    { wch: 18 },
    { wch: 30 },
    { wch: 10 },
    { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, wsQuestions, "Questions");

  // Sheet 2: Passages — instructor copies title into PassageTitle column.
  const passageRows =
    exam.passages.length > 0
      ? exam.passages.map((p, i) => ({
          "STT": i + 1,
          "PassageTitle (copy chính xác sang sheet Questions)": p.title,
        }))
      : [
          {
            "STT": "",
            "PassageTitle (copy chính xác sang sheet Questions)":
              "(Chưa có đoạn nào. Tạo đoạn trong UI trước, hoặc bỏ trống cột PassageTitle để tạo câu hỏi độc lập.)",
          },
        ];
  const wsPassages = XLSX.utils.json_to_sheet(passageRows);
  wsPassages["!cols"] = [{ wch: 5 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, wsPassages, "Passages");

  // Sheet 3: Reference — enum values + syntax.
  const refRows = [
    { Field: "Type", Values: "mcq, multi, true_false_notgiven, gap_fill, short_answer, essay" },
    { Field: "Difficulty", Values: "1 (Dễ) · 2 (Trung bình, mặc định) · 3 (Khó)" },
    { Field: "Correct (MCQ)", Values: "Chữ cái: A / B / C / D / E / F (chỉ 1)" },
    { Field: "Correct (MULTI)", Values: "Phân tách bằng ';': A;C;E" },
    { Field: "Correct (TF_NG)", Values: "true | false | notgiven" },
    { Field: "Blanks (gap_fill)", Values: "id:đáp1|đáp2 ; id:đáp1 — cách bởi ';' giữa blank, '|' giữa đáp án" },
    { Field: "AcceptedAnswers (short)", Values: "Phân tách bằng ';': paris ; Paris ; PARIS" },
    { Field: "MatchMode", Values: "case_insensitive (mặc định) | exact" },
    { Field: "SkillCodes", Values: "Phân tách bằng ';' — phải khớp code đã có (xem sheet Skills)" },
    { Field: "PassageTitle", Values: "Khớp chính xác title từ sheet Passages; trống = câu hỏi độc lập" },
    { Field: "MinWords (essay)", Values: "Số nguyên dương; 0 hoặc trống = không yêu cầu" },
    { Field: "Notes", Values: "Tự do — chỉ instructor thấy, không hiển thị học viên" },
  ];
  const wsRef = XLSX.utils.json_to_sheet(refRows);
  wsRef["!cols"] = [{ wch: 24 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, wsRef, "Reference");

  // Sheet 4: Examples-Vietnamese — 24 ready-to-copy samples across all types.
  const vietnameseExamples = buildVietnameseExamples();
  const wsVi = XLSX.utils.json_to_sheet(vietnameseExamples);
  wsVi["!cols"] = wsQuestions["!cols"];
  XLSX.utils.book_append_sheet(wb, wsVi, "Examples-Vietnamese");

  // Sheet 5: Skills (cheat sheet of available skill codes).
  if (skills.length > 0) {
    const wsSkills = XLSX.utils.json_to_sheet(
      skills.map((s) => ({ Code: s.code, Name: s.name })),
    );
    wsSkills["!cols"] = [{ wch: 32 }, { wch: 40 }];
    XLSX.utils.book_append_sheet(wb, wsSkills, "Skills");
  }

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const safeName = exam.title.replace(/[^a-zA-Z0-9_-]+/g, "_").slice(0, 40);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="exam-questions-${safeName || "template"}.xlsx"`,
      "content-length": String(buf.length),
    },
  });
}

interface ExampleRow {
  Type: string;
  PassageTitle: string;
  Prompt: string;
  Points: number;
  Difficulty: number;
  SkillCodes: string;
  OptionA: string;
  OptionB: string;
  OptionC: string;
  OptionD: string;
  OptionE: string;
  OptionF: string;
  Correct: string;
  Blanks: string;
  AcceptedAnswers: string;
  MatchMode: string;
  Rubric: string;
  MinWords: string;
  Notes: string;
}

/** 24 ví dụ tiếng Việt thực tế — 4 câu cho mỗi 6 loại, đa lĩnh vực. */
function buildVietnameseExamples(): ExampleRow[] {
  const blank = {
    PassageTitle: "",
    OptionA: "",
    OptionB: "",
    OptionC: "",
    OptionD: "",
    OptionE: "",
    OptionF: "",
    Correct: "",
    Blanks: "",
    AcceptedAnswers: "",
    MatchMode: "",
    Rubric: "",
    MinWords: "",
  };

  return [
    // ─── MCQ (4 câu) ─────────────────────────────────────────────────────
    {
      ...blank,
      Type: "mcq",
      Prompt: "Tổng các góc trong một tam giác bằng bao nhiêu độ?",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "math.geometry",
      OptionA: "90°",
      OptionB: "120°",
      OptionC: "180°",
      OptionD: "360°",
      Correct: "C",
      Notes: "Kiến thức cơ bản hình học lớp 6",
    },
    {
      ...blank,
      Type: "mcq",
      Prompt: "Tác giả của tác phẩm \"Truyện Kiều\" là ai?",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "literature.vietnamese",
      OptionA: "Nguyễn Trãi",
      OptionB: "Nguyễn Du",
      OptionC: "Hồ Xuân Hương",
      OptionD: "Nguyễn Đình Chiểu",
      Correct: "B",
      Notes: "Văn học Việt Nam cổ điển",
    },
    {
      ...blank,
      Type: "mcq",
      Prompt:
        "Cách mạng tháng Tám năm 1945 ở Việt Nam diễn ra vào ngày tháng nào?",
      Points: 3,
      Difficulty: 2,
      SkillCodes: "history.vietnam",
      OptionA: "2/9/1945",
      OptionB: "19/8/1945",
      OptionC: "30/4/1945",
      OptionD: "7/5/1945",
      Correct: "B",
      Notes: "",
    },
    {
      ...blank,
      Type: "mcq",
      Prompt:
        "Trong cấu trúc DNA, base nào sẽ ghép cặp với Adenine (A)?",
      Points: 3,
      Difficulty: 2,
      SkillCodes: "biology.genetics",
      OptionA: "Guanine (G)",
      OptionB: "Cytosine (C)",
      OptionC: "Thymine (T)",
      OptionD: "Uracil (U)",
      Correct: "C",
      Notes: "Sinh học phân tử",
    },

    // ─── MULTI (4 câu) ───────────────────────────────────────────────────
    {
      ...blank,
      Type: "multi",
      Prompt:
        "Chọn TẤT CẢ các số nguyên tố trong dãy sau:",
      Points: 4,
      Difficulty: 2,
      SkillCodes: "math.basic",
      OptionA: "2",
      OptionB: "9",
      OptionC: "11",
      OptionD: "15",
      OptionE: "17",
      OptionF: "21",
      Correct: "A;C;E",
      Notes: "Phép tính nhẩm + nhận biết số nguyên tố",
    },
    {
      ...blank,
      Type: "multi",
      Prompt:
        "Những phép tu từ nào dưới đây thường được dùng trong thơ ca?",
      Points: 4,
      Difficulty: 2,
      SkillCodes: "literature.rhetoric",
      OptionA: "Ẩn dụ",
      OptionB: "So sánh",
      OptionC: "Phép tịnh tiến",
      OptionD: "Nhân hoá",
      OptionE: "Phương trình bậc 2",
      Correct: "A;B;D",
      Notes: "",
    },
    {
      ...blank,
      Type: "multi",
      Prompt: "Quốc gia nào thuộc khu vực Đông Nam Á?",
      Points: 3,
      Difficulty: 1,
      SkillCodes: "geography.asia",
      OptionA: "Thái Lan",
      OptionB: "Hàn Quốc",
      OptionC: "Việt Nam",
      OptionD: "Nhật Bản",
      OptionE: "Indonesia",
      OptionF: "Trung Quốc",
      Correct: "A;C;E",
      Notes: "",
    },
    {
      ...blank,
      Type: "multi",
      Prompt: "Đâu là ngôn ngữ lập trình phổ biến?",
      Points: 3,
      Difficulty: 1,
      SkillCodes: "cs.programming",
      OptionA: "JavaScript",
      OptionB: "HTML",
      OptionC: "Python",
      OptionD: "CSS",
      OptionE: "TypeScript",
      Correct: "A;C;E",
      Notes: "HTML/CSS không phải ngôn ngữ lập trình, là markup/styling",
    },

    // ─── TRUE/FALSE/NOTGIVEN (4 câu) ─────────────────────────────────────
    {
      ...blank,
      Type: "true_false_notgiven",
      Prompt:
        "Mặt Trời là một ngôi sao thuộc dải Ngân Hà.",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "science.astronomy",
      Correct: "true",
      Notes: "",
    },
    {
      ...blank,
      Type: "true_false_notgiven",
      Prompt:
        "Việt Nam tuyên bố độc lập vào ngày 2 tháng 9 năm 1945.",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "history.vietnam",
      Correct: "true",
      Notes: "",
    },
    {
      ...blank,
      Type: "true_false_notgiven",
      Prompt: "Nước biển có vị mặn vì có nhiều đường.",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "science.chemistry",
      Correct: "false",
      Notes: "Vị mặn từ NaCl, không phải đường",
    },
    {
      ...blank,
      Type: "true_false_notgiven",
      Prompt:
        "Albert Einstein đã được trao giải Nobel Vật lý cho thuyết tương đối.",
      Points: 3,
      Difficulty: 2,
      SkillCodes: "science.physics",
      Correct: "false",
      Notes: "Ông nhận Nobel cho công trình về hiệu ứng quang điện (1921), KHÔNG phải thuyết tương đối",
    },

    // ─── GAP_FILL (4 câu) ────────────────────────────────────────────────
    {
      ...blank,
      Type: "gap_fill",
      Prompt:
        "Thủ đô của Việt Nam là ___, của Hàn Quốc là ___, của Nhật Bản là ___.",
      Points: 6,
      Difficulty: 1,
      SkillCodes: "geography.capitals",
      Blanks:
        "b1:Hà Nội|hà nội ; b2:Seoul|seoul ; b3:Tokyo|tokyo",
      MatchMode: "case_insensitive",
      Notes: "Mỗi blank cho 1 thủ đô",
    },
    {
      ...blank,
      Type: "gap_fill",
      Prompt:
        "Công thức hoá học của nước là ___, của muối ăn là ___.",
      Points: 4,
      Difficulty: 1,
      SkillCodes: "science.chemistry",
      Blanks: "b1:H2O|H₂O ; b2:NaCl",
      MatchMode: "case_insensitive",
      Notes: "Chấp nhận cả ký hiệu subscript thường và Unicode",
    },
    {
      ...blank,
      Type: "gap_fill",
      Prompt:
        "Đơn vị cơ bản của sự sống là ___. Bộ phận tế bào chứa thông tin di truyền là ___.",
      Points: 4,
      Difficulty: 2,
      SkillCodes: "biology.basics",
      Blanks: "b1:tế bào|cell ; b2:nhân|nucleus|nhân tế bào",
      MatchMode: "case_insensitive",
      Notes: "",
    },
    {
      ...blank,
      Type: "gap_fill",
      Prompt:
        "Tác phẩm \"Lão Hạc\" do nhà văn ___ sáng tác, viết về nỗi đau của ___.",
      Points: 4,
      Difficulty: 2,
      SkillCodes: "literature.vietnamese",
      Blanks: "b1:Nam Cao ; b2:người nông dân|nông dân",
      MatchMode: "case_insensitive",
      Notes: "",
    },

    // ─── SHORT_ANSWER (4 câu) ────────────────────────────────────────────
    {
      ...blank,
      Type: "short_answer",
      Prompt: "Kết quả của 12 × 8 là bao nhiêu?",
      Points: 1,
      Difficulty: 1,
      SkillCodes: "math.basic",
      AcceptedAnswers: "96",
      MatchMode: "exact",
      Notes: "Phép nhân cơ bản",
    },
    {
      ...blank,
      Type: "short_answer",
      Prompt:
        "Ai là chủ tịch đầu tiên của nước Cộng hoà Xã hội Chủ nghĩa Việt Nam?",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "history.vietnam",
      AcceptedAnswers: "Hồ Chí Minh ; Chủ tịch Hồ Chí Minh ; Bác Hồ",
      MatchMode: "case_insensitive",
      Notes: "Chấp nhận nhiều cách gọi",
    },
    {
      ...blank,
      Type: "short_answer",
      Prompt: "Diện tích hình vuông có cạnh 5cm là bao nhiêu cm²?",
      Points: 2,
      Difficulty: 1,
      SkillCodes: "math.geometry",
      AcceptedAnswers: "25 ; 25cm² ; 25 cm² ; 25 cm2",
      MatchMode: "case_insensitive",
      Notes: "",
    },
    {
      ...blank,
      Type: "short_answer",
      Prompt:
        "Năm nào Việt Nam giành chiến thắng Điện Biên Phủ?",
      Points: 2,
      Difficulty: 2,
      SkillCodes: "history.vietnam",
      AcceptedAnswers: "1954",
      MatchMode: "exact",
      Notes: "",
    },

    // ─── ESSAY (4 câu) ───────────────────────────────────────────────────
    {
      ...blank,
      Type: "essay",
      Prompt:
        "Phân tích vai trò của giáo dục trong sự phát triển kinh tế - xã hội của một quốc gia.",
      Points: 10,
      Difficulty: 3,
      SkillCodes: "social.economics",
      Rubric:
        "1) Định nghĩa giáo dục (2đ) · 2) Tác động lên nhân lực (3đ) · 3) Tác động lên kinh tế (3đ) · 4) Liên hệ thực tiễn (2đ)",
      MinWords: "300",
      Notes: "Bài luận nghị luận xã hội",
    },
    {
      ...blank,
      Type: "essay",
      Prompt:
        "Trình bày các bước giải phương trình bậc hai ax² + bx + c = 0 bằng công thức nghiệm tổng quát.",
      Points: 8,
      Difficulty: 2,
      SkillCodes: "math.algebra",
      Rubric:
        "1) Tính delta = b² - 4ac (2đ) · 2) Phân biệt 3 trường hợp delta >/=/<0 (3đ) · 3) Công thức nghiệm x = (-b ± √Δ)/2a (2đ) · 4) Ví dụ minh hoạ (1đ)",
      MinWords: "150",
      Notes: "",
    },
    {
      ...blank,
      Type: "essay",
      Prompt:
        "Phân tích hình tượng người nông dân trong truyện ngắn \"Lão Hạc\" của Nam Cao.",
      Points: 10,
      Difficulty: 3,
      SkillCodes: "literature.vietnamese",
      Rubric:
        "1) Hoàn cảnh xã hội (2đ) · 2) Phẩm chất nhân hậu của Lão Hạc (3đ) · 3) Bi kịch & lựa chọn cuối cùng (3đ) · 4) Thông điệp tác phẩm (2đ)",
      MinWords: "400",
      Notes: "Văn học lớp 8",
    },
    {
      ...blank,
      Type: "essay",
      Prompt:
        "So sánh quang hợp và hô hấp tế bào ở thực vật về nguyên liệu, sản phẩm, vị trí xảy ra và vai trò.",
      Points: 8,
      Difficulty: 2,
      SkillCodes: "biology.plant",
      Rubric:
        "Mỗi tiêu chí (nguyên liệu, sản phẩm, vị trí, vai trò) 2đ · Trình bày bằng bảng so sánh được +1đ bonus",
      MinWords: "200",
      Notes: "Có thể trình bày dạng bảng để dễ so sánh",
    },
  ];
}
