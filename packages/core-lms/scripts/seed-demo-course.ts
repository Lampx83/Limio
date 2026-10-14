/**
 * Dữ liệu GIẢ cho dev DB để chụp ảnh giao diện — khoá "Nhập môn Lập trình".
 * Đặc tả: docs/hoc-lieu/huong-dan-limio/DU-LIEU-MAU.md (đó là hợp đồng).
 *
 * Mọi thứ đi qua đúng hàm dịch vụ mà UI/API đi (createCourse → … → submitAttempt
 * → onQuizSubmitted …), KHÔNG INSERT tay vào LearningEvent. Rerun-safe: mọi bước
 * tìm-hoặc-tạo theo slug/email/tên; không xoá gì.
 *
 *   # pha 1 (mặc định): khoá, lớp, 36 học viên giả, tiến độ, bài tập, ngân hàng, diễn đàn
 *   DEMO_PASSWORD="$(cat <tệp mật khẩu>)" NODE_OPTIONS=--max-old-space-size=1536 \
 *     node --env-file=../db/.env --import tsx scripts/seed-demo-course.ts
 *
 *   # pha exams (chạy SAU khi đã chụp ảnh "trang Bắt đầu"): đề thi + đợt/ca/phòng
 *   NODE_OPTIONS=--max-old-space-size=1536 \
 *     node --env-file=../db/.env --import tsx scripts/seed-demo-course.ts --phase exams
 *
 * Chỉ dùng cho dev DB. Mật khẩu học viên giả lấy từ env DEMO_PASSWORD, không ghi vào repo.
 */

import bcrypt from "bcryptjs";
import { prisma } from "@feedbackme/db";
import { createCourse, publishCourse } from "../src/courses/courses";
import { createModule } from "../src/courses/modules";
import { createLesson } from "../src/courses/lessons";
import { createContentItem } from "../src/courses/contents";
import { createCourseSection } from "../src/courses/sections";
import { createAssignment, gradeSubmission, submitAssignment } from "../src/courses/assignments";
import { createQuiz } from "../src/quizzes/quizzes";
import { createQuestion } from "../src/quizzes/questions";
import { startAttempt, submitAnswer, submitAttempt } from "../src/quizzes/attempts";
import { enrollBySectionCode } from "../src/learning/enroll";
import { completeLesson, trackLessonView } from "../src/learning/lessons";
import { createThread, markPostResolved, postReply } from "../src/learning/forum";
import { issueCertificate } from "../src/certification/index";
import {
  copyBankQuestionToExam,
  createBank,
  createBankQuestion,
  publishBankQuestion,
  updateBankQuestion,
} from "../src/exam/bank";
import { createExam, publishExam } from "../src/exam/exams";
import { createExamRound, createExamSessionInRound } from "../src/exam/exam-rounds";
import { updateExamRoom } from "../src/exam/exam-rooms";
import { expandQuestion, type QuestionSpec } from "./import-course";
// core-gamification / core-feedback không phải dependency của core-lms: import theo
// đường dẫn tương đối (script công cụ, không phải mã module nghiệp vụ).
import {
  onCourseCompleted,
  onLessonCompleted,
  onLessonViewed,
  onMisconceptionResolved,
  onQuizSubmitted,
  awardSkillMasterBadges,
} from "../../core-gamification/src/index";
import {
  getAverageMasteryForQuiz,
  getMasterySnapshotForAttempt,
  updateLearnerStateFromAttempt,
} from "../../core-feedback/src/learnerState";
import {
  detectAndMarkResolved,
  recordMisconceptionsFromAttempt,
} from "../../core-feedback/src/misconception";
import { generateDiagnosticFeedback } from "../../core-feedback/src/diagnostic";

// ── Hằng số ───────────────────────────────────────────────────────────────────

const INSTRUCTOR_EMAIL = "giangvien.mau@feedbackme.dev";
const COURSE_SLUG = "nhap-mon-lap-trinh";
const BANK_NAME = "Nhập môn Lập trình – giữa kỳ";
const SECTIONS = [
  { name: "K65-CS1", from: 1, to: 14 },
  { name: "K65-CS2", from: 15, to: 26 },
  { name: "K65-CS3", from: 27, to: 36 },
] as const;
const LEARNER_COUNT = 36;
const FOCUS_EMAIL = "sv.demo.01@feedbackme.dev"; // học viên chụp lộ trình

const DAY = 86_400_000;

// ── RNG có hạt giống: chạy lại cho cùng kết quả ───────────────────────────────

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng = mulberry32(20261003);
const pick = <T,>(arr: readonly T[], r: () => number = rng): T => arr[Math.floor(r() * arr.length)]!;

// ── Tên người giả (ghép họ + đệm + tên phổ biến) ──────────────────────────────

const HO = ["Nguyễn", "Trần", "Lê", "Phạm", "Hoàng", "Vũ", "Đặng", "Bùi", "Đỗ", "Ngô", "Dương", "Lý", "Phan", "Võ", "Đinh"];
const DEM_NAM = ["Văn", "Minh", "Quốc", "Đức", "Hải", "Gia", "Bảo", "Tuấn", "Thành", "Khánh"];
const TEN_NAM = ["Anh", "Dũng", "Hùng", "Nam", "Long", "Khoa", "Hiếu", "Phúc", "Quân", "Sơn", "Trung", "Việt", "Kiên", "Huy", "Đạt", "Hoàng", "Nghĩa", "Tú"];
const DEM_NU = ["Thị", "Ngọc", "Thu", "Mai", "Khánh", "Phương", "Hồng", "Bảo", "Diệu", "Thanh"];
const TEN_NU = ["Linh", "Hương", "Lan", "Trang", "Thảo", "Ngân", "Hà", "Vy", "Chi", "My", "Yến", "Nhung", "Hạnh", "Ánh", "Quỳnh", "Giang", "Trâm", "Phương"];

function fakeName(i: number): string {
  // Sinh tất định theo chỉ số, đảm bảo không trùng nhau trong 36 người.
  const male = i % 2 === 1;
  const ho = HO[(i * 7 + 3) % HO.length]!;
  const dem = male ? DEM_NAM[(i * 3 + 1) % DEM_NAM.length]! : DEM_NU[(i * 3 + 2) % DEM_NU.length]!;
  const ten = male ? TEN_NAM[(i * 5 + 2) % TEN_NAM.length]! : TEN_NU[(i * 5 + 4) % TEN_NU.length]!;
  return `${ho} ${dem} ${ten}`;
}

// ── Nội dung khoá ─────────────────────────────────────────────────────────────

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const P = (s: string) => `<p>${s}</p>`;
const H = (s: string) => `<h2>${s}</h2>`;
const CODE = (s: string) => `<pre><code>${esc(s)}</code></pre>`;
const UL = (items: string[]) => `<ul>${items.map((i) => `<li>${i}</li>`).join("")}</ul>`;
const k = (s: string) => `<code>${esc(s)}</code>`;

interface LessonDef {
  title: string;
  description: string;
  durationSec: number;
  html: string;
  quiz: { title: string; difficulty: number; questions: QuestionSpec[] };
}
interface ModuleDef {
  title: string;
  description: string;
  lessons: LessonDef[];
}

const MISCONCEPTIONS = [
  { code: "py.assign_is_equation", name: "Nghĩ phép gán là phương trình toán học", description: "Học viên đọc x = x + 2 như một đẳng thức (vô lý) thay vì 'lấy giá trị bên phải bỏ vào tên bên trái'." },
  { code: "py.str_plus_adds", name: "Nghĩ + luôn cộng số học, kể cả với chuỗi", description: "Học viên quên rằng + nối hai chuỗi chứ không cộng giá trị số của chúng." },
  { code: "py.eq_vs_assign", name: "Nhầm dấu = (gán) với == (so sánh)", description: "Học viên dùng = trong điều kiện if hoặc nghĩ hai dấu có cùng tác dụng." },
  { code: "py.index_from_1", name: "Nghĩ chỉ số đếm bắt đầu từ 1", description: "Học viên cho rằng range(3) bắt đầu từ 1, trong khi Python đếm từ 0." },
  { code: "py.range_inclusive", name: "Nghĩ range gồm cả giá trị cuối", description: "Học viên cho rằng range(a, b) có cả b, trong khi giá trị cuối bị loại." },
  { code: "py.def_runs", name: "Nghĩ định nghĩa hàm là đã chạy hàm", description: "Học viên chưa phân biệt viết hàm (def) với gọi hàm." },
  { code: "py.print_is_return", name: "Nhầm print với return", description: "Học viên nghĩ in ra màn hình cũng là trả giá trị về cho nơi gọi hàm." },
] as const;

const FEEDBACK_TEMPLATES: Array<{ code: string; body: string }> = [
  { code: "py.index_from_1", body: "Python đếm từ 0, không phải từ 1. range(3) sinh ra 0, 1, 2 — ba số, bắt đầu từ 0. Hãy thử chạy for i in range(3): print(i) và xem kết quả." },
  { code: "py.range_inclusive", body: "range(a, b) lấy từ a đến b - 1: giá trị cuối b không được tính. Vì thế range(1, 5) cho 1, 2, 3, 4 chứ không có 5." },
  { code: "py.print_is_return", body: "print chỉ hiện chữ ra màn hình; muốn hàm trả giá trị về cho nơi gọi, phải dùng return. Hàm không có return trả về None." },
  { code: "py.eq_vs_assign", body: "Một dấu = là gán (đặt giá trị cho biến); hai dấu == là so sánh (hỏi hai giá trị có bằng nhau không). Trong điều kiện if, ta cần ==." },
];

const MODULES: ModuleDef[] = [
  {
    title: "Biến và kiểu dữ liệu",
    description: "Làm quen với biến, phép gán và các kiểu dữ liệu cơ bản của Python.",
    lessons: [
      {
        title: "Biến và phép gán",
        description: "Biến là cái tên gắn với một giá trị; phép gán đặt giá trị cho tên đó.",
        durationSec: 15 * 60,
        html:
          H("Biến là gì?") +
          P("Biến là một cái tên gắn với một giá trị được lưu trong bộ nhớ. Trong Python, ta tạo biến bằng cách gán giá trị cho nó với dấu " + k("=") + ", không cần khai báo kiểu trước.") +
          CODE('ten_lop = "K65-CS1"\nso_sv = 36\nprint(ten_lop, so_sv)   # K65-CS1 36') +
          H("Phép gán không phải là phương trình") +
          P("Dấu " + k("=") + " trong lập trình nghĩa là &ldquo;tính vế phải, rồi bỏ kết quả vào tên ở vế trái&rdquo;. Vì vậy " + k("x = x + 2") + " hoàn toàn hợp lệ: lấy giá trị hiện tại của " + k("x") + ", cộng 2, rồi gán lại cho " + k("x") + ".") +
          CODE("x = 5\nx = x + 2\nprint(x)   # 7") +
          H("Quy tắc đặt tên") +
          UL([
            "Gồm chữ cái, chữ số và dấu gạch dưới; không được bắt đầu bằng chữ số.",
            "Python phân biệt chữ hoa và chữ thường: " + k("diem") + " và " + k("Diem") + " là hai biến khác nhau.",
            "Nên đặt tên có nghĩa, ví dụ " + k("diem_trung_binh") + " thay vì " + k("a") + ".",
          ]),
        quiz: {
          title: "Kiểm tra: Biến và phép gán",
          difficulty: 1,
          questions: [
            { key: "bien-1", type: "mcq", prompt: "Sau khi chạy `x = 5` rồi `x = x + 2`, giá trị của `x` là bao nhiêu?", explanation: "Vế phải được tính trước: 5 + 2 = 7, rồi gán lại cho x.", options: [
              { label: "7", isCorrect: true },
              { label: "5", isCorrect: false },
              { label: "52", isCorrect: false },
              { label: "Báo lỗi vì x đã có giá trị", isCorrect: false, misconception: "py.assign_is_equation" },
            ] },
            { key: "bien-2", type: "true_false", prompt: "Trong Python, phải khai báo kiểu dữ liệu của biến trước khi gán giá trị cho nó.", options: [
              { label: "Đúng", isCorrect: false },
              { label: "Sai", isCorrect: true },
            ] },
            { key: "bien-3", type: "fill_in", prompt: "Dấu nào dùng để gán giá trị cho biến trong Python? (gõ đúng một ký tự)", answers: ["="] },
          ],
        },
      },
      {
        title: "Các kiểu dữ liệu cơ bản",
        description: "int, float, str và bool: bốn kiểu dữ liệu đầu tiên.",
        durationSec: 20 * 60,
        html:
          H("Bốn kiểu dữ liệu đầu tiên") +
          UL([
            k("int") + ": số nguyên, ví dụ " + k("42") + ", " + k("-7") + ".",
            k("float") + ": số thực, ví dụ " + k("3.14") + ", " + k("3.0") + ".",
            k("str") + ": chuỗi ký tự, đặt trong dấu nháy, ví dụ " + k('"xin chào"') + ".",
            k("bool") + ": giá trị logic, chỉ có " + k("True") + " hoặc " + k("False") + ".",
          ]) +
          P("Hàm " + k("type()") + " cho biết kiểu của một giá trị:") +
          CODE('print(type(42))        # <class \'int\'>\nprint(type(3.0))       # <class \'float\'>\nprint(type("xin chào")) # <class \'str\'>\nprint(type(True))      # <class \'bool\'>') +
          H("Cùng toán tử, khác kiểu, khác kết quả") +
          P("Toán tử " + k("+") + " cộng hai số nhưng lại nối hai chuỗi. Vì vậy " + k("3 + 4") + " cho " + k("7") + " còn " + k("'3' + '4'") + " cho " + k("'34'") + ".") +
          CODE("print(3 + 4)       # 7\nprint('3' + '4')   # 34"),
        quiz: {
          title: "Kiểm tra: Các kiểu dữ liệu cơ bản",
          difficulty: 2,
          questions: [
            { key: "kdl-1", type: "mcq", prompt: "Giá trị `3.0` có kiểu dữ liệu nào trong Python?", options: [
              { label: "float", isCorrect: true },
              { label: "int", isCorrect: false },
              { label: "str", isCorrect: false },
              { label: "bool", isCorrect: false },
            ] },
            { key: "kdl-2", type: "true_false", prompt: "Biểu thức `'5' + '3'` cho kết quả là số 8.", explanation: "Hai chuỗi được nối với nhau, kết quả là chuỗi '53'.", options: [
              { label: "Đúng", isCorrect: false, misconception: "py.str_plus_adds" },
              { label: "Sai", isCorrect: true },
            ] },
            { key: "kdl-3", type: "matching", prompt: "Ghép mỗi giá trị với kiểu dữ liệu của nó.", pairs: [
              { left: "42", right: "int" },
              { left: "3.14", right: "float" },
              { left: '"xin chào"', right: "str" },
              { left: "True", right: "bool" },
            ] },
          ],
        },
      },
    ],
  },
  {
    title: "Cấu trúc điều khiển",
    description: "Rẽ nhánh với if và lặp với for.",
    lessons: [
      {
        title: "Câu lệnh if",
        description: "Cho chương trình chọn nhánh chạy theo điều kiện.",
        durationSec: 18 * 60,
        html:
          H("Rẽ nhánh theo điều kiện") +
          P("Câu lệnh " + k("if") + " chạy một khối lệnh khi điều kiện đúng. Khối lệnh được thụt vào so với dòng " + k("if") + ", và dòng " + k("if") + " kết thúc bằng dấu hai chấm.") +
          CODE('diem = 7.5\nif diem >= 5:\n    print("Đạt")\nelse:\n    print("Chưa đạt")') +
          H("So sánh bằng: dùng ==") +
          P("Để hỏi hai giá trị có bằng nhau không, ta dùng hai dấu bằng " + k("==") + ". Một dấu " + k("=") + " là phép gán, và dùng nó trong điều kiện sẽ gây lỗi cú pháp.") +
          CODE('mat_khau = "abc123"\nif mat_khau == "abc123":\n    print("Đăng nhập thành công")') +
          H("Nhiều nhánh với elif") +
          P("Khi có nhiều trường hợp, ta nối thêm các nhánh " + k("elif") + " (viết tắt của else if). Python kiểm tra lần lượt từ trên xuống và chạy nhánh đầu tiên có điều kiện đúng.") +
          CODE('if diem >= 8:\n    xep_loai = "Giỏi"\nelif diem >= 6.5:\n    xep_loai = "Khá"\nelif diem >= 5:\n    xep_loai = "Trung bình"\nelse:\n    xep_loai = "Yếu"'),
        quiz: {
          title: "Kiểm tra: Câu lệnh if",
          difficulty: 2,
          questions: [
            { key: "if-1", type: "mcq", prompt: "Phép nào dùng để kiểm tra hai giá trị có bằng nhau trong điều kiện `if`?", options: [
              { label: "x == y", isCorrect: true },
              { label: "x = y", isCorrect: false, misconception: "py.eq_vs_assign" },
              { label: "x => y", isCorrect: false },
              { label: "x equals y", isCorrect: false },
            ] },
            { key: "if-2", type: "fill_in", prompt: "Từ khoá dùng để kiểm tra thêm một điều kiện khác sau `if` là ___.", answers: ["elif"] },
          ],
        },
      },
      {
        title: "Vòng lặp for",
        description: "Lặp lại một khối lệnh với for và range().",
        durationSec: 22 * 60,
        html:
          H("Lặp với for và range") +
          P("Vòng lặp " + k("for") + " chạy một khối lệnh nhiều lần. Kết hợp với " + k("range(n)") + ", biến đếm nhận các giá trị từ 0 đến n - 1.") +
          CODE("for i in range(3):\n    print(i)\n# 0\n# 1\n# 2") +
          H("range(a, b): bắt đầu từ a, dừng trước b") +
          P("Với " + k("range(a, b)") + ", biến đếm đi từ " + k("a") + " đến " + k("b - 1") + ": giá trị cuối " + k("b") + " không được tính. Vì vậy " + k("range(1, 5)") + " cho 1, 2, 3, 4 chứ không có 5.") +
          CODE("for i in range(1, 5):\n    print(i)   # 1 2 3 4") +
          H("Ví dụ: tính tổng 1 + 2 + … + n") +
          CODE("n = 5\ntong = 0\nfor i in range(1, n + 1):\n    tong = tong + i\nprint(tong)   # 15") +
          P("Chú ý " + k("range(1, n + 1)") + ": ta cộng thêm 1 để giá trị " + k("n") + " được tính vào tổng."),
        quiz: {
          title: "Kiểm tra: Vòng lặp for",
          difficulty: 3,
          questions: [
            { key: "for-1", type: "mcq", prompt: "Đoạn mã `for i in range(3): print(i)` in ra những số nào?", explanation: "range(3) sinh ba số bắt đầu từ 0: 0, 1, 2.", options: [
              { label: "0, 1, 2", isCorrect: true },
              { label: "1, 2, 3", isCorrect: false, misconception: "py.index_from_1" },
              { label: "0, 1, 2, 3", isCorrect: false, misconception: "py.range_inclusive" },
              { label: "Báo lỗi", isCorrect: false },
            ] },
            { key: "for-2", type: "true_false", prompt: "`range(1, 5)` sinh ra cả số 5.", options: [
              { label: "Đúng", isCorrect: false, misconception: "py.range_inclusive" },
              { label: "Sai", isCorrect: true },
            ] },
            { key: "for-3", type: "ordering", prompt: "Sắp xếp các bước để tính tổng 1 + 2 + 3 + 4 + 5 bằng vòng lặp for.", sequence: [
              "Tạo biến tong và gán bằng 0",
              "Viết dòng for i in range(1, 6):",
              "Trong vòng lặp, cộng i vào tong",
              "Sau vòng lặp, in giá trị tong",
            ] },
          ],
        },
      },
    ],
  },
  {
    title: "Hàm",
    description: "Đặt tên cho một đoạn mã để tái sử dụng: định nghĩa, gọi, tham số và giá trị trả về.",
    lessons: [
      {
        title: "Định nghĩa và gọi hàm",
        description: "Dùng def để viết hàm và gọi hàm để chạy nó.",
        durationSec: 18 * 60,
        html:
          H("Hàm là một đoạn mã có tên") +
          P("Khi một đoạn mã được dùng nhiều lần, ta gói nó vào một hàm. Từ khoá " + k("def") + " định nghĩa hàm; thân hàm được thụt vào.") +
          CODE('def chao():\n    print("Xin chào các bạn K65!")') +
          H("Định nghĩa chưa phải là chạy") +
          P("Viết " + k("def chao():") + " chỉ &ldquo;dạy&rdquo; Python về hàm " + k("chao") + ", chưa chạy dòng nào trong thân hàm. Hàm chỉ chạy khi ta gọi nó bằng tên kèm cặp ngoặc.") +
          CODE("chao()   # Xin chào các bạn K65!\nchao()   # gọi bao nhiêu lần, chạy bấy nhiêu lần") +
          P("Đặt tên hàm theo việc nó làm, dùng chữ thường và gạch dưới, ví dụ " + k("tinh_diem_tb") + "."),
        quiz: {
          title: "Kiểm tra: Định nghĩa và gọi hàm",
          difficulty: 2,
          questions: [
            { key: "ham-1", type: "mcq", prompt: "Từ khoá nào dùng để định nghĩa một hàm trong Python?", options: [
              { label: "def", isCorrect: true },
              { label: "function", isCorrect: false },
              { label: "fun", isCorrect: false },
              { label: "define", isCorrect: false },
            ] },
            { key: "ham-2", type: "true_false", prompt: "Viết `def chao():` cùng thân hàm xong thì hàm `chao` tự chạy ngay.", options: [
              { label: "Đúng", isCorrect: false, misconception: "py.def_runs" },
              { label: "Sai", isCorrect: true },
            ] },
          ],
        },
      },
      {
        title: "Tham số và giá trị trả về",
        description: "Đưa dữ liệu vào hàm bằng tham số và lấy kết quả ra bằng return.",
        durationSec: 20 * 60,
        html:
          H("Tham số: đưa dữ liệu vào hàm") +
          P("Tham số là biến đặt trong cặp ngoặc khi định nghĩa hàm. Khi gọi hàm, ta truyền đối số cho từng tham số.") +
          CODE("def binh_phuong(x):\n    return x * x\n\nprint(binh_phuong(4))   # 16") +
          H("return và print khác nhau") +
          P(k("return") + " trả giá trị về cho nơi gọi hàm để dùng tiếp; " + k("print") + " chỉ hiện chữ ra màn hình. Hàm không có " + k("return") + " sẽ trả về " + k("None") + ".") +
          CODE("def f(x):\n    print(x * 2)\n\ny = f(4)   # in ra 8\nprint(y)   # None") +
          P("Hãy tập thói quen để hàm tính toán trả kết quả bằng " + k("return") + ", còn việc in ra để cho phần chương trình bên ngoài quyết định."),
        quiz: {
          title: "Kiểm tra: Tham số và giá trị trả về",
          difficulty: 3,
          questions: [
            { key: "tham-so-1", type: "mcq", prompt: "Cho `def f(x): print(x * 2)` và lệnh `y = f(4)`. Giá trị của `y` là gì?", options: [
              { label: "None", isCorrect: true },
              { label: "8", isCorrect: false, misconception: "py.print_is_return" },
              { label: "4", isCorrect: false },
              { label: "Báo lỗi", isCorrect: false },
            ] },
            { key: "tham-so-2", type: "fill_in", prompt: "Câu lệnh dùng để trả một giá trị từ hàm về nơi gọi là ___.", answers: ["return"] },
          ],
        },
      },
    ],
  },
];

// Thứ tự phẳng 6 bài: 0 Biến, 1 Kiểu, 2 if, 3 for, 4 Định nghĩa hàm, 5 Tham số
const ALL_LESSONS = MODULES.flatMap((m) => m.lessons);
const IDX_IF = 2;
const IDX_FOR = 3;

// ── Tiện ích tìm-hoặc-tạo ─────────────────────────────────────────────────────

const log = (s: string) => console.log(s);

interface LessonRef {
  lessonId: string;
  quizId: string;
  title: string;
}
interface CourseCtx {
  courseId: string;
  slug: string;
  lessons: LessonRef[];
}

async function getInstructor() {
  const u = await prisma.user.findUnique({ where: { email: INSTRUCTOR_EMAIL }, select: { id: true } });
  if (!u) throw new Error(`Không có giảng viên mẫu ${INSTRUCTOR_EMAIL}`);
  return u.id;
}

// ── Pha 1a: khoá học ──────────────────────────────────────────────────────────

async function ensureCourse(actor: string): Promise<CourseCtx> {
  // Lỗi tư duy + mẫu phản hồi (toàn cục, upsert theo code).
  const mcIds = new Map<string, string>();
  for (const m of MISCONCEPTIONS) {
    const row = await prisma.misconception.upsert({
      where: { code: m.code },
      update: { name: m.name, description: m.description },
      create: { code: m.code, name: m.name, description: m.description },
      select: { id: true },
    });
    mcIds.set(m.code, row.id);
  }
  for (const t of FEEDBACK_TEMPLATES) {
    const mid = mcIds.get(t.code)!;
    const has = await prisma.feedbackTemplate.findFirst({
      where: { scope: "per_misconception", misconceptionId: mid },
      select: { id: true },
    });
    if (!has) {
      await prisma.feedbackTemplate.create({
        data: { scope: "per_misconception", misconceptionId: mid, body: t.body, priority: 100 },
      });
    }
  }

  let course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG }, select: { id: true, status: true } });
  if (!course) {
    const created = await createCourse(actor, {
      title: "Nhập môn Lập trình",
      slug: COURSE_SLUG,
      description:
        "Học phần nhập môn dành cho sinh viên năm nhất ngành Công nghệ thông tin, dùng ngôn ngữ Python. " +
        "Bạn sẽ học cách nghĩ như một người lập trình: dùng biến và kiểu dữ liệu, rẽ nhánh và lặp, rồi gói mã thành các hàm tái sử dụng.",
      language: "vi",
      level: "beginner",
      category: "Công nghệ thông tin",
      personalizationEnabled: true,
      enrollMode: "open",
    });
    course = { id: created.courseId, status: "draft" };
    log(`✔ Tạo khoá ${COURSE_SLUG} — ${created.courseId}`);
  } else {
    const owner = await prisma.courseInstructor.findFirst({ where: { courseId: course.id, userId: actor, role: "owner" } });
    if (!owner) throw new Error(`Slug ${COURSE_SLUG} đã thuộc khoá không phải của giảng viên mẫu — dừng.`);
    log(`• Khoá đã có: ${course.id}`);
  }
  const courseId = course.id;

  const lessons: LessonRef[] = [];
  for (const [mi, m] of MODULES.entries()) {
    let mod = await prisma.module.findFirst({ where: { courseId, title: m.title }, select: { id: true } });
    if (!mod) {
      const c = await createModule(actor, courseId, { title: m.title, description: m.description, orderIndex: mi });
      mod = { id: c.moduleId };
    }
    for (const [li, l] of m.lessons.entries()) {
      let lesson = await prisma.lesson.findFirst({ where: { moduleId: mod.id, title: l.title }, select: { id: true } });
      if (!lesson) {
        const c = await createLesson(actor, mod.id, {
          title: l.title,
          description: l.description,
          orderIndex: li,
          durationSec: l.durationSec,
        });
        lesson = { id: c.lessonId };
      }
      const hasContent = await prisma.contentItem.count({ where: { lessonId: lesson.id } });
      if (hasContent === 0) {
        await createContentItem(actor, lesson.id, { type: "richtext", orderIndex: 0, payload: { html: l.html } });
      }
      let quiz = await prisma.quiz.findFirst({ where: { lessonId: lesson.id }, select: { id: true } });
      if (!quiz) {
        const q = await createQuiz(actor, { courseId, lessonId: lesson.id }, { title: l.quiz.title, difficulty: l.quiz.difficulty });
        for (const [qi, spec] of l.quiz.questions.entries()) {
          await createQuestion(actor, q.quizId, expandQuestion(spec, qi, mcIds));
        }
        quiz = { id: q.quizId };
      }
      lessons.push({ lessonId: lesson.id, quizId: quiz.id, title: l.title });
    }
  }

  if (course.status !== "published") {
    await publishCourse(actor, courseId);
    log("✔ Đã xuất bản khoá");
  }
  return { courseId, slug: COURSE_SLUG, lessons };
}

// ── Pha 1b: lớp học ───────────────────────────────────────────────────────────

async function ensureSections(actor: string, courseId: string) {
  const out = new Map<string, { id: string; inviteCode: string }>();
  for (const s of SECTIONS) {
    let row = await prisma.courseSection.findFirst({ where: { courseId, name: s.name }, select: { id: true, inviteCode: true } });
    if (!row) {
      const c = await createCourseSection(actor, courseId, {
        name: s.name,
        description: `Lớp ${s.name} — Nhập môn Lập trình, học kỳ I`,
      });
      row = { id: c.id, inviteCode: c.inviteCode };
    }
    out.set(s.name, { id: row.id, inviteCode: row.inviteCode! });
  }
  return out;
}

// ── Pha 1c: học viên giả ──────────────────────────────────────────────────────

const pad = (i: number) => String(i).padStart(2, "0");
const emailOf = (i: number) => `sv.demo.${pad(i)}@feedbackme.dev`;

async function ensureLearners(): Promise<Map<number, string>> {
  const password = process.env.DEMO_PASSWORD;
  if (!password || password.length < 12) throw new Error("DEMO_PASSWORD chưa set hoặc ngắn hơn 12 ký tự.");
  const learnerRole = await prisma.role.upsert({ where: { name: "learner" }, update: {}, create: { name: "learner" } });
  const seen = new Date().toISOString();
  const ids = new Map<number, string>();
  let hash: string | null = null;
  for (let i = 1; i <= LEARNER_COUNT; i++) {
    const email = emailOf(i);
    const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
    if (existing) {
      ids.set(i, existing.id);
      continue;
    }
    hash ??= await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash: hash,
        displayName: fakeName(i),
        emailVerifiedAt: new Date(),
        // Đã xem hướng dẫn lần đầu, không thì cửa sổ tour che ảnh chụp.
        helpTourCompletedByRole: { learner: seen, instructor: seen },
      },
      select: { id: true },
    });
    await prisma.authProvider.create({ data: { userId: user.id, provider: "password", providerUserId: email } });
    await prisma.userRole.create({ data: { userId: user.id, roleId: learnerRole.id, grantedBy: user.id } });
    ids.set(i, user.id);
  }
  return ids;
}

// ── Kế hoạch học của từng học viên ────────────────────────────────────────────

/** Số bài đã hoàn thành của từng học viên 1..36 (tiến độ 17%..100%). */
function completionPlan(): number[] {
  const bag: number[] = [
    ...Array(8).fill(6), // hoàn thành khoá
    ...Array(5).fill(5),
    ...Array(6).fill(4),
    ...Array(6).fill(3),
    ...Array(6).fill(2),
    ...Array(5).fill(1),
  ];
  const r = mulberry32(777);
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [bag[i], bag[j]] = [bag[j]!, bag[i]!];
  }
  // sv.demo.01 (chỉ số 0): luôn 4 bài, để lộ trình có "bài tiếp theo".
  const j = bag.findIndex((v, idx) => idx > 0 && v === 4);
  [bag[0], bag[j]] = [bag[j]!, bag[0]!];
  return bag;
}

/** Kết quả từng câu của sv.demo.01 — chọn để BKT rơi đủ 3 nhãn (xem báo cáo). */
const FOCUS_OUTCOMES: boolean[][] = [
  [true, true, true], // Biến: 0.945 → Vững
  [false, false, true], // Kiểu: 0.43 → Cần ôn
  [true, true], // if: 0.775 → Nên luyện thêm
  [false, true, true], // for: 0.793 → Nên luyện thêm (sai đúng câu range(3), dính quan niệm sai)
];

// ── Làm một bài kiểm tra bằng đường thật ──────────────────────────────────────

type QRow = Awaited<ReturnType<typeof loadQuestions>>[number];
async function loadQuestions(quizId: string) {
  return prisma.quizQuestion.findMany({ where: { quizId }, orderBy: { orderIndex: "asc" }, include: { options: true } });
}

function buildResponse(q: QRow, correct: boolean, r: () => number): unknown {
  switch (q.type) {
    case "mcq":
    case "true_false": {
      if (correct) return q.options.filter((o) => o.isCorrect).map((o) => o.id);
      const wrong = q.options.filter((o) => !o.isCorrect);
      // Ưu tiên phương án gắn quan niệm sai: học viên thật hay dính chúng nhất.
      const withMc = wrong.filter((o) => o.misconceptionId);
      const chosen = withMc.length > 0 && r() < 0.8 ? pick(withMc, r) : pick(wrong, r);
      return [chosen.id];
    }
    case "fill_in":
      return correct ? q.options.find((o) => o.isCorrect)!.label : "sai";
    case "ordering": {
      const ids = [...q.options].sort((a, b) => a.orderIndex - b.orderIndex).map((o) => o.id);
      if (correct) return ids;
      return [ids[1]!, ids[0]!, ...ids.slice(2)];
    }
    case "matching": {
      const lefts = q.options.filter((o) => (o.extra as { side?: string } | null)?.side === "left");
      const rights = q.options.filter((o) => (o.extra as { side?: string } | null)?.side === "right");
      const keyOf = (o: { extra: unknown }) => (o.extra as { pairKey?: string }).pairKey;
      return lefts.map((l, i) => {
        const right = correct ? rights.find((x) => keyOf(x) === keyOf(l))! : rights[(i + 1) % rights.length]!;
        return { leftId: l.id, rightId: right.id };
      });
    }
    default:
      return "";
  }
}

async function takeQuiz(userId: string, courseId: string, quizId: string, outcomes: boolean[], r: () => number) {
  const { attemptId, created } = await startAttempt(userId, quizId);
  if (created) {
    // Chống "speed run" (< 10 giây thì XP = 0): lùi giờ bắt đầu để lượt làm trông như thật.
    await prisma.quizAttempt.update({
      where: { id: attemptId },
      data: { startedAt: new Date(Date.now() - (150 + Math.floor(r() * 420)) * 1000) },
    });
  }
  const questions = await loadQuestions(quizId);
  for (const [qi, q] of questions.entries()) {
    const ok = outcomes[qi] ?? true;
    const confidence = ok ? 3 + Math.floor(r() * 3) : 1 + Math.floor(r() * 3);
    await submitAnswer(userId, attemptId, { questionId: q.id, response: buildResponse(q, ok, r), confidence });
  }
  const result = await submitAttempt(userId, attemptId);

  // Cùng chuỗi xử lý với POST /api/attempts/[attemptId]/submit (bỏ phần email).
  const avgMastery = await getAverageMasteryForQuiz(userId, result.quizId);
  await onQuizSubmitted({
    userId,
    courseId,
    attemptId: result.attemptId,
    quizId: result.quizId,
    difficulty: result.difficulty,
    isFirstPass: result.isFirstPass,
    elapsedSec: result.elapsedSec,
    scorePct: result.scorePct,
    avgMastery,
  });
  const snapshot = await getMasterySnapshotForAttempt(userId, result.attemptId);
  await generateDiagnosticFeedback(userId, result.attemptId, undefined, { masterySnapshot: snapshot });
  const detected = await recordMisconceptionsFromAttempt(userId, result.attemptId);
  const bkt = await updateLearnerStateFromAttempt(userId, result.attemptId);
  const cleared = await detectAndMarkResolved(userId, result.attemptId, { excludeMisconceptionIds: detected.detected });
  for (const misconceptionId of cleared.resolved) {
    await onMisconceptionResolved({ userId, courseId, misconceptionId, attemptId: result.attemptId });
  }
  if (bkt.newlyMastered.length > 0) {
    await awardSkillMasterBadges({ userId, courseId, skills: bkt.newlyMastered });
  }
  return result;
}

async function studyLessons(
  userId: string,
  ctx: CourseCtx,
  lessonsToDo: number,
  outcomesFor: (lessonIdx: number, nQuestions: number) => boolean[],
  r: () => number,
  withRetry: boolean,
) {
  for (let li = 0; li < lessonsToDo; li++) {
    const lesson = ctx.lessons[li]!;
    const done = await prisma.learningEvent.findUnique({
      where: { eventKey: `lesson.completed:${userId}:${lesson.lessonId}` },
      select: { id: true },
    });
    if (done) continue;

    await trackLessonView(userId, lesson.lessonId, { positionSec: 0 });
    await onLessonViewed({ userId, courseId: ctx.courseId });

    const nQ = ALL_LESSONS[li]!.quiz.questions.length;
    const outcomes = outcomesFor(li, nQ);
    const had = await prisma.quizAttempt.count({ where: { userId, quizId: lesson.quizId, status: "submitted" } });
    if (had === 0 && r() < 0.9) {
      const res = await takeQuiz(userId, ctx.courseId, lesson.quizId, outcomes, r);
      if (withRetry && res.scorePct < 100 && r() < 0.3) {
        await takeQuiz(userId, ctx.courseId, lesson.quizId, outcomes.map(() => true), r);
      }
    }

    const c = await completeLesson(userId, lesson.lessonId, "marked_complete");
    if (c.newlyCompleted) {
      await onLessonCompleted({ userId, courseId: ctx.courseId, lessonId: lesson.lessonId });
    }
    if (c.courseCompleted) {
      await onCourseCompleted({ userId, courseId: ctx.courseId });
      await issueCertificate(userId, ctx.courseId);
    }
  }
}

// ── Bài tập ───────────────────────────────────────────────────────────────────

const RUBRIC = "4 điểm chạy đúng với dữ liệu mẫu. 3 điểm xử lý trường hợp nhập sai. 3 điểm đặt tên biến rõ ràng.";

const AVG_SOLUTIONS = [
  (n: string) => `diem = [8, 7.5, 9, 6]\n${n} = sum(diem) / len(diem)\nprint("Điểm trung bình:", ${n})`,
  (n: string) => `so_mon = int(input("Số môn: "))\ntong = 0\nfor i in range(so_mon):\n    tong = tong + float(input("Điểm: "))\n${n} = tong / so_mon\nprint(${n})`,
  (n: string) => `def tinh_${n}(ds):\n    return sum(ds) / len(ds)\n\nprint(tinh_${n}([7, 8, 9]))`,
  (n: string) => `try:\n    a = float(input("Toán: "))\n    b = float(input("Lý: "))\n    c = float(input("Hoá: "))\n    ${n} = (a + b + c) / 3\n    print(round(${n}, 2))\nexcept ValueError:\n    print("Vui lòng nhập số")`,
];
const PRIME_SOLUTIONS = [
  () => `def la_nguyen_to(n):\n    if n < 2:\n        return False\n    for i in range(2, n):\n        if n % i == 0:\n            return False\n    return True\n\nprint(la_nguyen_to(17))`,
  () => `n = int(input("Nhập n: "))\nlaso = n >= 2\nfor i in range(2, n):\n    if n % i == 0:\n        laso = False\nprint("Nguyên tố" if laso else "Không phải số nguyên tố")`,
  () => `def check(n):\n    if n < 2:\n        return False\n    i = 2\n    while i * i <= n:\n        if n % i == 0:\n            return False\n        i += 1\n    return True`,
];
const VAR_NAMES = ["diem_tb", "dtb", "trung_binh", "ket_qua", "kq", "avg_score"];
const REFLECTIONS = [
  "Em chia bài thành ba bước: nhập dữ liệu, tính tổng, rồi chia cho số môn.",
  "Em chạy thử với dữ liệu mẫu trước, sau đó thử thêm trường hợp nhập chữ.",
  "Em gặp lỗi khi quên đổi chuỗi sang số, sau đó dùng float() để sửa.",
];
const GRADE_NOTES: Array<[number, string[]]> = [
  [9, ["Bài làm chính xác và gọn. Tên biến rõ ràng, có xử lý nhập sai.", "Rất tốt. Chương trình chạy đúng với mọi dữ liệu mẫu."]],
  [7, ["Chạy đúng với dữ liệu mẫu. Cần xử lý thêm trường hợp nhập không phải số.", "Ý tưởng đúng; tên biến còn ngắn, nên đặt tên rõ nghĩa hơn."]],
  [5, ["Chương trình còn sai ở trường hợp danh sách rỗng. Em xem lại phần chia cho 0.", "Có chạy được nhưng chưa xử lý nhập sai và tên biến chưa rõ nghĩa."]],
];

async function ensureAssignment(actor: string, lessonId: string, input: Record<string, unknown> & { title: string }) {
  const found = await prisma.assignment.findFirst({ where: { lessonId, title: input.title }, select: { id: true } });
  if (found) return found.id;
  const c = await createAssignment(actor, lessonId, input);
  return c.assignmentId;
}

async function seedAssignments(
  actor: string,
  ctx: CourseCtx,
  learners: Map<number, string>,
  plan: number[],
) {
  const a1 = await ensureAssignment(actor, ctx.lessons[IDX_IF]!.lessonId, {
    title: "Bài tập 1: Tính điểm trung bình",
    description:
      "Viết chương trình Python nhận điểm của các môn học rồi in ra điểm trung bình.\n\n" +
      "Yêu cầu: nộp mã nguồn và một dòng giải thích cách em kiểm tra chương trình.",
    maxScore: 10,
    dueAt: new Date(Date.now() + 5 * DAY),
    rubricText: RUBRIC,
    responseFormat: "text",
  });
  const a2 = await ensureAssignment(actor, ctx.lessons[IDX_FOR]!.lessonId, {
    title: "Bài tập 2: Kiểm tra số nguyên tố",
    description: "Viết chương trình kiểm tra một số nguyên n có phải số nguyên tố hay không, dùng vòng lặp for.",
    maxScore: 10,
    dueAt: new Date(Date.now() - 2 * DAY),
    responseFormat: "text",
  });

  // Người nộp bài 1: 20 học viên đã qua bài "if" (k >= 3); sv.demo.01 luôn có mặt.
  const eligible1 = [...learners.keys()].filter((i) => plan[i - 1]! >= 3).sort((x, y) => x - y);
  const sub1 = [...new Set([1, ...eligible1])].slice(0, 20);
  const r = mulberry32(31337);
  for (const [pos, i] of sub1.entries()) {
    const userId = learners.get(i)!;
    const exists = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId: a1, userId } }, select: { id: true, status: true } });
    let submissionId = exists?.id;
    if (!exists) {
      const body = AVG_SOLUTIONS[i % AVG_SOLUTIONS.length]!(pick(VAR_NAMES, r));
      const s = await submitAssignment(userId, a1, { body, reflection: pick(REFLECTIONS, r) });
      submissionId = s.submissionId;
    }
    const graded = pos % 5 < 3; // 12 / 20 đã chấm
    if (graded && (!exists || exists.status !== "graded")) {
      const roll = r();
      const [score, notes] = roll < 0.4 ? GRADE_NOTES[0]! : roll < 0.8 ? GRADE_NOTES[1]! : GRADE_NOTES[2]!;
      const final = i === 1 ? 7 : score + (r() < 0.5 ? 1 : 0);
      await gradeSubmission(actor, submissionId!, { score: Math.min(10, final), feedback: i === 1 ? GRADE_NOTES[1]![1][1]! : pick(notes, r) });
    }
  }

  // Bài 2: 6 bài nộp chờ chấm (từ học viên đã qua bài "for", k >= 4).
  const eligible2 = [...learners.keys()].filter((i) => plan[i - 1]! >= 4 && i !== 1).sort((x, y) => y - x).slice(0, 6);
  for (const i of eligible2) {
    const userId = learners.get(i)!;
    const exists = await prisma.assignmentSubmission.findUnique({ where: { assignmentId_userId: { assignmentId: a2, userId } }, select: { id: true } });
    if (!exists) {
      await submitAssignment(userId, a2, { body: PRIME_SOLUTIONS[i % PRIME_SOLUTIONS.length]!(), reflection: pick(REFLECTIONS, r) });
    }
  }
  return { a1, a2 };
}

// ── Ngân hàng câu hỏi ─────────────────────────────────────────────────────────

interface BankQ {
  code: string;
  type: "mcq" | "multi" | "true_false_notgiven" | "gap_fill" | "short_answer" | "essay" | "ordering" | "matching";
  prompt: string;
  config: Record<string, unknown>;
  difficulty: number;
  cognitiveLevel: "remember_understand" | "apply" | "analyze_plus";
  estimatedTimeSec: number;
  learningOutcome: string;
  review: "pending" | "approved" | "needs_revision";
  publish: boolean;
  editNote?: string;
}
const BANK_QUESTIONS: BankQ[] = [
  { code: "NMLT-01", type: "mcq", prompt: "Đoạn mã `x = 4; y = x * 2; print(y)` in ra giá trị nào?", difficulty: 1, cognitiveLevel: "remember_understand", estimatedTimeSec: 45, learningOutcome: "Dự đoán được kết quả của phép gán và biểu thức đơn giản.", review: "approved", publish: true,
    config: { topic: "Biến và phép gán", options: [{ id: "a", label: "4", isCorrect: false }, { id: "b", label: "8", isCorrect: true }, { id: "c", label: "x * 2", isCorrect: false }, { id: "d", label: "Báo lỗi", isCorrect: false }], explanation: "y nhận giá trị x * 2 = 8." } },
  { code: "NMLT-02", type: "multi", prompt: "Những giá trị nào sau đây có kiểu `str` trong Python?", difficulty: 2, cognitiveLevel: "remember_understand", estimatedTimeSec: 60, learningOutcome: "Phân biệt được kiểu str với int, float, bool.", review: "approved", publish: true,
    config: { topic: "Kiểu dữ liệu", options: [{ id: "a", label: "\"42\"", isCorrect: true }, { id: "b", label: "42", isCorrect: false }, { id: "c", label: "'xin chào'", isCorrect: true }, { id: "d", label: "True", isCorrect: false }, { id: "e", label: "\"3.14\"", isCorrect: true }] } },
  { code: "NMLT-03", type: "true_false_notgiven", prompt: "Câu lệnh `for i in range(5)` lặp đúng 5 lần.", difficulty: 2, cognitiveLevel: "remember_understand", estimatedTimeSec: 30, learningOutcome: "Nêu được số lần lặp của vòng lặp for với range(n).", review: "approved", publish: true,
    config: { topic: "Vòng lặp for", correct: "true", explanation: "range(5) sinh 0, 1, 2, 3, 4 — năm giá trị." } },
  { code: "NMLT-04", type: "gap_fill", prompt: "Để lấy số phần tử của danh sách `ds`, ta viết ___(ds).", difficulty: 2, cognitiveLevel: "remember_understand", estimatedTimeSec: 40, learningOutcome: "Dùng được hàm dựng sẵn len().", review: "pending", publish: true,
    config: { topic: "Hàm dựng sẵn", blanks: [{ id: "b1", acceptedAnswers: ["len"], matchMode: "case_insensitive" }] } },
  { code: "NMLT-05", type: "short_answer", prompt: "Hàm nào dùng để nhận dữ liệu do người dùng gõ từ bàn phím?", difficulty: 1, cognitiveLevel: "remember_understand", estimatedTimeSec: 30, learningOutcome: "Nhận biết hàm input().", review: "pending", publish: false,
    config: { topic: "Nhập xuất", acceptedAnswers: ["input", "input()"], matchMode: "case_insensitive" } },
  { code: "NMLT-06", type: "essay", prompt: "Giải thích sự khác nhau giữa vòng lặp `for` và vòng lặp `while`, kèm một ví dụ cho mỗi loại.", difficulty: 4, cognitiveLevel: "analyze_plus", estimatedTimeSec: 600, learningOutcome: "So sánh và chọn được loại vòng lặp phù hợp.", review: "needs_revision", publish: false, editNote: "Đề còn chung chung — thêm yêu cầu về số lần lặp biết trước hay chưa biết trước.",
    config: { topic: "Cấu trúc điều khiển", rubric: "Nêu đúng điều kiện dùng for/while (3 điểm). Mỗi ví dụ chạy đúng (2 điểm x 2). Trình bày rõ ràng (3 điểm).", minWords: 80 } },
  { code: "NMLT-07", type: "ordering", prompt: "Sắp xếp các bước của chương trình tính tổng từ 1 đến n.", difficulty: 3, cognitiveLevel: "apply", estimatedTimeSec: 90, learningOutcome: "Sắp xếp đúng trình tự các bước của một thuật toán lặp.", review: "needs_revision", publish: false, editNote: "Đổi 'Nhập n' thành bước đầu tiên cho thống nhất với đề trên lớp.",
    config: { topic: "Vòng lặp for", items: [{ id: "s1", label: "Nhập n" }, { id: "s2", label: "Gán tong = 0" }, { id: "s3", label: "Lặp i từ 1 đến n, cộng i vào tong" }, { id: "s4", label: "In tong" }] } },
  { code: "NMLT-08", type: "matching", prompt: "Ghép mỗi kiểu dữ liệu với mô tả phù hợp.", difficulty: 2, cognitiveLevel: "remember_understand", estimatedTimeSec: 75, learningOutcome: "Gắn đúng kiểu dữ liệu với loại giá trị của nó.", review: "pending", publish: false,
    config: { topic: "Kiểu dữ liệu", pairs: [{ id: "p1", left: "int", right: "Số nguyên" }, { id: "p2", left: "float", right: "Số thực" }, { id: "p3", left: "str", right: "Chuỗi ký tự" }, { id: "p4", left: "bool", right: "Đúng / Sai" }] } },
];

async function seedBank(actor: string) {
  let bank = await prisma.questionBank.findFirst({ where: { ownerUserId: actor, name: BANK_NAME }, select: { id: true } });
  if (!bank) {
    bank = await createBank(actor, {
      name: BANK_NAME,
      description: "Câu hỏi ôn tập và thi giữa kỳ học phần Nhập môn Lập trình (Python).",
      visibility: "private",
    });
  }
  for (const q of BANK_QUESTIONS) {
    const has = await prisma.bankQuestion.findFirst({ where: { bankId: bank.id, code: q.code }, select: { id: true } });
    if (has) continue;
    const c = await createBankQuestion(actor, bank.id, {
      type: q.type,
      prompt: q.prompt,
      config: q.config,
      difficulty: q.difficulty,
      cognitiveLevel: q.cognitiveLevel,
      estimatedTimeSec: q.estimatedTimeSec,
      learningOutcome: q.learningOutcome,
      code: q.code,
      editNote: q.editNote,
    });
    if (q.review !== "pending") await updateBankQuestion(actor, c.id, { reviewStatus: q.review });
    if (q.publish) await publishBankQuestion(actor, c.id);
  }
  return bank.id;
}

// ── Diễn đàn ──────────────────────────────────────────────────────────────────

async function seedForum(ctx: CourseCtx, learners: Map<number, string>, plan: number[]) {
  const L = (i: number) => learners.get(i)!;
  const threads = [
    { lesson: IDX_FOR, author: 6, title: "range(1, 5) có in ra số 5 không?", body: "Em chạy for i in range(1, 5): print(i) thì chỉ thấy 1 2 3 4. Em tưởng sẽ có cả số 5 ạ? Thầy cô giải thích giúp em với.", ageDays: 2 },
    { lesson: IDX_IF, author: 9, title: "Khác nhau giữa == và = là gì?", body: "Em hay bị lỗi cú pháp khi viết if x = 5:. Hai dấu này khác nhau thế nào ạ?", ageDays: 4, reply: { by: 3, body: "Một dấu = là gán giá trị cho biến, hai dấu == là so sánh. Trong if phải dùng ==, ví dụ if x == 5:." } },
    { lesson: 5, author: 12, title: "Vì sao hàm không có return lại in ra None?", body: "Em viết hàm chỉ có print rồi gán kết quả cho biến y, in y ra thì thấy None. Em chưa hiểu vì sao ạ.", ageDays: 1 },
    { lesson: 0, author: 4, title: "Đặt tên biến thế nào cho dễ đọc?", body: "Em hay đặt tên biến là a, b, c cho nhanh. Có quy tắc nào để đặt tên rõ nghĩa hơn không ạ?", ageDays: 0 },
  ];
  for (const t of threads) {
    const lessonId = ctx.lessons[t.lesson]!.lessonId;
    // Người đăng/trả lời phải đã ghi danh — kiểm tra rồi mới gọi để lỗi rõ ràng.
    void plan;
    let thread = await prisma.forumThread.findFirst({ where: { lessonId, title: t.title }, select: { id: true } });
    if (!thread) {
      const c = await createThread(L(t.author), lessonId, { title: t.title, body: t.body });
      thread = { id: c.threadId };
      const at = new Date(Date.now() - t.ageDays * DAY - 3 * 3600_000);
      if (t.ageDays > 0) await prisma.forumThread.update({ where: { id: thread.id }, data: { createdAt: at } });
      if (t.reply) {
        const p = await postReply(L(t.reply.by), thread.id, { body: t.reply.body });
        await prisma.forumPost.update({ where: { id: p.postId }, data: { createdAt: new Date(at.getTime() + 2 * 3600_000) } });
        await markPostResolved(L(t.author), thread.id, p.postId);
      }
    }
  }
}

// ── Pha 1 ─────────────────────────────────────────────────────────────────────

async function phase1() {
  const actor = await getInstructor();
  const ctx = await ensureCourse(actor);
  const sections = await ensureSections(actor, ctx.courseId);
  const learners = await ensureLearners();
  log(`• ${learners.size} học viên giả`);

  // Ghi danh qua link mời của từng lớp (đường thật của học viên).
  const enrollRng = mulberry32(4242);
  for (const s of SECTIONS) {
    const sec = sections.get(s.name)!;
    for (let i = s.from; i <= s.to; i++) {
      const res = await enrollBySectionCode(learners.get(i)!, sec.inviteCode, prisma, { skipPaymentCheck: true });
      if (res.created) {
        // Ngày ghi danh trải trong 4 tuần để biểu đồ theo thời gian có hình.
        await prisma.enrollment.update({
          where: { id: res.enrollmentId },
          data: { enrolledAt: new Date(Date.now() - (2 + Math.floor(enrollRng() * 26)) * DAY) },
        });
      }
    }
  }

  const plan = completionPlan();
  for (let i = 1; i <= LEARNER_COUNT; i++) {
    const userId = learners.get(i)!;
    const r = mulberry32(1000 + i);
    const ability = 0.4 + r() * 0.55;
    if (i === 1) {
      await studyLessons(userId, ctx, plan[0]!, (li) => FOCUS_OUTCOMES[li]!, r, false);
    } else {
      await studyLessons(
        userId,
        ctx,
        plan[i - 1]!,
        (li, n) => Array.from({ length: n }, () => r() < ability - 0.03 * li),
        r,
        true,
      );
    }
    if (i % 6 === 0) log(`  … học viên ${i}/${LEARNER_COUNT}`);
  }

  const { a1, a2 } = await seedAssignments(actor, ctx, learners, plan);
  const bankId = await seedBank(actor);
  await seedForum(ctx, learners, plan);

  log("\n===== KẾT QUẢ PHA 1 =====");
  log(`Khoá: ${ctx.courseId} (${COURSE_SLUG})`);
  for (const s of SECTIONS) {
    const sec = sections.get(s.name)!;
    log(`Lớp ${s.name}: ${sec.id} — mời /enroll/${sec.inviteCode}`);
  }
  log(`Ngân hàng: ${bankId} → /instructor/question-banks/${bankId}`);
  log(`Bài tập 1: ${a1} → /instructor/assignments/${a1}/submissions`);
  log(`Bài tập 2: ${a2} → /instructor/assignments/${a2}/submissions`);
  log(`Trang giảng viên: /instructor/courses/${ctx.courseId}`);
  log(`Học viên chụp lộ trình: ${FOCUS_EMAIL} → /learn/${COURSE_SLUG}`);
  log(`Diễn đàn giảng viên: /instructor/forum`);
}

// ── Pha exams (chạy sau khi đã chụp "trang Bắt đầu") ──────────────────────────

/**
 * Đề thi + đợt thi / ca thi / phòng thi. Chạy SAU khi đã chụp ảnh "trang Bắt đầu":
 * khi có đề thì Bước 2 của trang đó không còn ở trạng thái "Làm tiếp bước này".
 */
async function phaseExams() {
  const actor = await getInstructor();
  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG }, select: { id: true } });
  if (!course) throw new Error("Chưa có khoá — chạy pha 1 trước.");
  const bank = await prisma.questionBank.findFirst({ where: { ownerUserId: actor, name: BANK_NAME }, select: { id: true } });
  if (!bank) throw new Error("Chưa có ngân hàng câu hỏi — chạy pha 1 trước.");

  const EXAM_TITLE = "Đề thi giữa kỳ — Nhập môn Lập trình";
  let exam = await prisma.exam.findFirst({ where: { courseId: course.id, title: EXAM_TITLE }, select: { id: true, status: true } });
  if (!exam) {
    const c = await createExam(actor, course.id, {
      title: EXAM_TITLE,
      description: "Đề thi giữa kỳ học phần Nhập môn Lập trình (Python), 45 phút.",
      durationMin: 45,
      showResultsAfterSubmit: true,
    });
    exam = { id: c.examId, status: "draft" };
  }
  const nQ = await prisma.examQuestion.count({ where: { examId: exam.id } });
  if (nQ === 0) {
    // "Chốt" câu hỏi từ ngân hàng vào đề — chỉ câu đã xuất bản mới chốt được.
    const published = await prisma.bankQuestion.findMany({
      where: { bankId: bank.id, status: "published" },
      orderBy: { code: "asc" },
      select: { id: true },
    });
    for (const q of published) await copyBankQuestionToExam(actor, q.id, exam.id);
  }

  const ROUND_CODE = "GK-NMLT-HK1";
  let round = await prisma.examRound.findFirst({ where: { courseId: course.id, code: ROUND_CODE }, select: { id: true } });
  if (!round) {
    round = await createExamRound(actor, {
      code: ROUND_CODE,
      title: "Thi giữa kỳ — Nhập môn Lập trình, học kỳ I",
      description: "Đợt thi giữa kỳ cho ba lớp K65-CS1, K65-CS2, K65-CS3.",
      courseId: course.id,
    });
  }

  const SESSION_TITLE = "Ca 1 — Sáng thứ Hai";
  let session = await prisma.examSession.findFirst({ where: { roundId: round.id, title: SESSION_TITLE }, select: { id: true } });
  if (!session) {
    // 08:00–09:30 giờ Việt Nam (UTC+7), một tuần nữa.
    const day = new Date(Date.now() + 7 * DAY);
    day.setUTCHours(1, 0, 0, 0);
    session = await createExamSessionInRound(actor, round.id, {
      examId: exam.id,
      code: "CA1",
      title: SESSION_TITLE,
      opensAt: day,
      closesAt: new Date(day.getTime() + 90 * 60_000),
    });
  }
  // Phòng mặc định được tạo sẵn cùng ca; đặt tên thật cho đẹp.
  const room = await prisma.examRoom.findFirst({ where: { sessionId: session.id }, orderBy: { orderIndex: "asc" }, select: { id: true, name: true } });
  if (room && room.name.startsWith("Phòng mặc định")) {
    await updateExamRoom(actor, room.id, { name: "Phòng thi 1", locationNote: "Phòng máy 301, nhà C5" });
  }

  // Xuất bản đề SAU khi đã có ca: publishExam tự dựng "Ca mặc định" nếu đề chưa có ca nào.
  if (exam.status === "draft") await publishExam(actor, exam.id);

  const sessions = await prisma.examSession.count({ where: { examId: exam.id } });
  log("\n===== KẾT QUẢ PHA EXAMS =====");
  log(`Đề thi: ${exam.id} → /instructor/exams/${exam.id}`);
  log(`Đợt thi: ${round.id} → /instructor/exam-rounds/${round.id} (trạng thái Nháp)`);
  log(`Ca thi: ${session.id} · số ca của đề: ${sessions}`);
}

async function main() {
  const i = process.argv.indexOf("--phase");
  const phase = i >= 0 ? process.argv[i + 1] : "1";
  if (phase === "exams") await phaseExams();
  else await phase1();
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
