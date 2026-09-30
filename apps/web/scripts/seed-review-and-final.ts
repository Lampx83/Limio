/**
 * Review lessons and end-of-course knowledge checks.
 *
 *   tsx scripts/seed-review-and-final.ts pds [--dry-run]
 *   tsx scripts/seed-review-and-final.ts ml  [--dry-run]
 *
 * pds  1. Turns the four placeholder reading lessons of Module 1 (which the 11
 *         video units made redundant) into review lessons: a cheat sheet plus a
 *         4-question quiz each. They keep their titles and skill tags, and now
 *         give the `pds.python.*` skills real evidence instead of nothing.
 *      2. Adds "Kiểm tra tổng hợp cuối khoá" at the end of Module 3: 15 questions
 *         across the three modules.
 * ml   Adds the same kind of final check at the end of Module 3 (run it AFTER
 *      the ML micro-units and labs so it really is the last lesson).
 *
 * This is a self-check for learners (pass 70%, several attempts). It is NOT the
 * formal Final Exam the syllabus describes — that is an institutional decision.
 *
 * Every expected value below was produced by running the code, or computed
 * from the formula, before being written down.
 *
 * Idempotent: a lesson that already has a quiz is skipped whole.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import {
  createLesson,
  createContentItem,
  createSkill,
  tagLessonSkill,
  createQuiz,
  createQuestion,
  updateContentItem,
} from "@feedbackme/core-lms";

// ─────────────────────────────────────────────────────────────────────────
// Types and helpers
// ─────────────────────────────────────────────────────────────────────────

interface Opt {
  label: string;
  correct?: boolean;
  mis?: string;
}

interface Q {
  type: "mcq" | "true_false" | "numerical";
  prompt: string;
  explanation: string;
  /** Skill code carrying this question. */
  skill: string;
  options?: Opt[];
  extra?: Record<string, unknown>;
}

const T = (label: string, correct?: boolean, mis?: string): Opt => ({
  label,
  ...(correct ? { correct } : {}),
  ...(mis ? { mis } : {}),
});
const YES_NO = (yes: boolean): Opt[] => [T("Đúng", yes), T("Sai", !yes)];
const NUM = (expected: number, tolerance = 0.01) => ({ expected, tolerance });
const code = (src: string) => "```python\n" + src + "\n```";

const MISCONCEPTIONS: Record<string, { code: string; name: string; description: string }> = {
  list_alias: {
    code: "py_list_assignment_copies",
    name: "Tưởng b = a tạo bản sao của list",
    description:
      "Học viên cho rằng gán một list sang biến khác sao chép nội dung, nên sửa b không ảnh hưởng a.",
  },
  div_vs_floor: {
    code: "py_true_vs_floor_division",
    name: "Nhầm phép chia / với chia lấy phần nguyên //",
    description:
      "Học viên nhầm '/' (luôn ra float) với '//' (làm tròn xuống) hoặc quên '%' là phần dư.",
  },
  np_axis_swap: {
    code: "np_axis_swap",
    name: "Nhầm axis=0 với axis=1",
    description:
      "Học viên đảo hai trục: axis=0 gộp các hàng (kết quả theo cột), axis=1 gộp các cột (kết quả theo hàng).",
  },
  pd_nan_zero: {
    code: "pd_mean_counts_nan_as_zero",
    name: "Tưởng mean() tính NaN như 0",
    description:
      "Học viên cho rằng giá trị thiếu được tính là 0 khi lấy trung bình, trong khi pandas mặc định bỏ qua NaN.",
  },
  http_status: {
    code: "http_status_class_confusion",
    name: "Nhầm nhóm mã trạng thái HTTP",
    description:
      "Học viên nhầm lỗi phía người gọi (4xx, ví dụ 404) với lỗi phía máy chủ (5xx).",
  },
  inherit_vs_poly: {
    code: "py_inheritance_vs_polymorphism",
    name: "Nhầm kế thừa với đa hình",
    description:
      "Học viên nhầm việc lớp con dùng lại code của lớp cha (kế thừa) với việc cùng một tên phương thức cho hành vi khác nhau tuỳ đối tượng (đa hình).",
  },
  attr_shared: {
    code: "py_instance_attribute_shared",
    name: "Tưởng thuộc tính của một object ảnh hưởng mọi object",
    description:
      "Học viên nhầm instance attribute (riêng từng object) với class attribute (dùng chung).",
  },
  accuracy_always_good: {
    code: "ml_accuracy_always_good",
    name: "Coi accuracy cao là mô hình tốt",
    description:
      "Học viên cho rằng accuracy cao luôn nghĩa là mô hình tốt, bỏ qua trường hợp dữ liệu mất cân bằng khi mô hình chỉ đoán lớp đa số.",
  },
  fit_test: {
    code: "ml_fit_on_test_set",
    name: "Fit scaler trên tập test",
    description:
      "Học viên dùng fit_transform cho cả tập test, làm rò rỉ thông tin của tập test vào quá trình chuẩn hoá.",
  },
  regression_vs_classification: {
    code: "ml_regression_vs_classification",
    name: "Nhầm regression với classification",
    description:
      "Học viên phân loại sai bài toán dự đoán giá trị liên tục thành bài toán phân loại và ngược lại.",
  },
};

/**
 * Prompts render through plainToRichHtml, which keeps HTML as-is but turns
 * plain text into <p>/<br> — so markdown fences would show up literally and
 * indentation would collapse. Convert backtick code to real <pre>/<code>.
 */
function rich(text: string): string {
  if (!text.includes("`")) return text;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts = text.split(/```(?:\w+)?\n([\s\S]*?)```/);
  return parts
    .map((part, i) =>
      i % 2 === 1
        ? `<pre><code>${esc(part.replace(/\n$/, ""))}</code></pre>`
        : part
            .split(/\n\s*\n/)
            .filter((para) => para.trim())
            .map((para) => `<p>${esc(para.trim()).replace(/`([^`]+)`/g, "<code>$1</code>")}</p>`)
            .join(""),
    )
    .join("");
}

const misIds = new Map<string, string>();
async function ensureMisconceptions() {
  for (const [key, m] of Object.entries(MISCONCEPTIONS)) {
    const row = await prisma.misconception.upsert({
      where: { code: m.code },
      update: { name: m.name, description: m.description },
      create: m,
    });
    misIds.set(key, row.id);
  }
}
function misIdOf(key: string | undefined): { misconceptionId: string } | Record<string, never> {
  if (!key) return {};
  const id = misIds.get(key);
  if (!id) throw new Error(`unknown misconception key: ${key}`);
  return { misconceptionId: id };
}

function validate(label: string, qs: Q[]) {
  for (const q of qs) {
    if (q.type === "numerical") {
      if (typeof q.extra?.expected !== "number") throw new Error(`${label}: numerical without expected`);
    } else {
      const right = (q.options ?? []).filter((o) => o.correct).length;
      if (right !== 1) throw new Error(`${label}: "${q.prompt.slice(0, 40)}…" has ${right} correct options`);
    }
  }
}

const CONTENT_DIR = join(__dirname, "content", "pds-review");
const read = (f: string) => readFileSync(join(CONTENT_DIR, f), "utf8").trimEnd();

// ─────────────────────────────────────────────────────────────────────────
// PDS — review lessons (Module 1) and final check
// ─────────────────────────────────────────────────────────────────────────

const PDS_SLUG = "programming-for-data-science";

const PDS_REVIEWS: Array<{ match: string; file: string; skill: string; quizTitle: string; questions: Q[] }> = [
  {
    match: "Variables, Data Types, and Operators",
    file: "basics.md",
    skill: "pds.python.basics",
    quizTitle: "Ôn tập — Biến, kiểu dữ liệu và toán tử",
    questions: [
      { type: "mcq", skill: "pds.python.basics", prompt: `Đoạn code sau in ra gì?\n\n${code("print(10 // 3, 10 % 3, 2 ** 3)")}`,
        explanation: "// là chia lấy phần nguyên (10 // 3 = 3), % là phần dư (10 % 3 = 1), ** là luỹ thừa (2 ** 3 = 8).",
        options: [T("3 1 8", true), T("3.33 1 8", false, "div_vs_floor"), T("3 1 6"), T("3 3 8")] },
      { type: "mcq", skill: "pds.python.basics", prompt: `Đoạn code sau in ra gì?\n\n${code("x = [1, 2, 3]\ny = x\ny.append(4)\nprint(x)")}`,
        explanation: "y = x không tạo bản sao: x và y là hai tên cho cùng một list, nên thêm 4 qua y thì x cũng thấy. Muốn bản sao độc lập phải dùng x.copy().",
        options: [T("[1, 2, 3, 4]", true), T("[1, 2, 3]", false, "list_alias"), T("[4]"), T("Báo lỗi")] },
      { type: "mcq", skill: "pds.python.basics", prompt: `Đoạn code sau in ra gì?\n\n${code("s = 'Python'\nprint(s[1:4], s[-1])")}`,
        explanation: "s[1:4] lấy vị trí 1, 2, 3 (dừng trước 4): 'yth'. s[-1] là ký tự cuối: 'n'. print cách nhau bằng dấu cách.",
        options: [T("yth n", true), T("yt n"), T("ytho n"), T("Pyth n")] },
      { type: "mcq", skill: "pds.python.basics", prompt: `Đoạn code sau in ra gì?\n\n${code('d = {"a": 1, "b": 2}\nprint(d.get("c", 0), len(d))')}`,
        explanation: "d.get(\"c\", 0) trả về giá trị mặc định 0 khi khoá không tồn tại (không báo lỗi như d[\"c\"]); len(d) là số khoá: 2.",
        options: [T("0 2", true), T("None 2"), T("Báo KeyError"), T("0 3")] },
    ],
  },
  {
    match: "Control Flow: Conditionals and Loops",
    file: "control.md",
    skill: "pds.python.control_flow",
    quizTitle: "Ôn tập — Rẽ nhánh và vòng lặp",
    questions: [
      { type: "mcq", skill: "pds.python.control_flow", prompt: `Đoạn code sau in ra gì?\n\n${code("for i in range(5):\n    if i % 2 == 0:\n        continue\n    print(i)")}`,
        explanation: "continue bỏ qua lượt hiện tại khi i chẵn (0, 2, 4), nên chỉ các số lẻ 1 và 3 được in.",
        options: [T("1 3", true), T("0 2 4"), T("0 1 2 3 4"), T("1 2 3 4")] },
      { type: "numerical", skill: "pds.python.control_flow", prompt: `Đoạn code sau in ra số nào?\n\n${code("n = 10\nc = 0\nwhile n > 1:\n    n //= 2\n    c += 1\nprint(c)")}`,
        explanation: "n lần lượt là 10 → 5 → 2 → 1 (dừng vì n > 1 sai): vòng lặp chạy 3 lần nên c = 3.", extra: NUM(3) },
      { type: "numerical", skill: "pds.python.control_flow", prompt: `Đoạn code sau in ra số nào?\n\n${code("total = 0\nfor i in range(1, 5):\n    total += i\nprint(total)")}`,
        explanation: "range(1, 5) sinh 1, 2, 3, 4 (dừng trước 5): tổng = 10.", extra: NUM(10) },
      { type: "mcq", skill: "pds.python.control_flow", prompt: `Đoạn code sau in ra gì?\n\n${code("for x in [1, 2, 3]:\n    if x == 5:\n        break\nelse:\n    print('done')")}`,
        explanation: "else của vòng lặp chạy khi vòng lặp kết thúc bình thường (không bị break). Không phần tử nào bằng 5 nên không break, và 'done' được in.",
        options: [T("done", true), T("Không in gì"), T("1 2 3"), T("Báo lỗi")] },
    ],
  },
  {
    match: "Functions",
    file: "functions.md",
    skill: "pds.python.functions",
    quizTitle: "Ôn tập — Hàm",
    questions: [
      { type: "numerical", skill: "pds.python.functions", prompt: `Đoạn code sau in ra số nào?\n\n${code("def f(a, b=2, *args):\n    return a + b + sum(args)\n\nprint(f(1, 2, 3, 4))")}`,
        explanation: "a = 1, b = 2, *args = (3, 4) nên sum(args) = 7. Kết quả 1 + 2 + 7 = 10.", extra: NUM(10) },
      { type: "mcq", skill: "pds.python.functions", prompt: `Đoạn code sau in ra gì?\n\n${code("print(sorted(['bb', 'a', 'ccc'], key=lambda s: len(s)))")}`,
        explanation: "key=lambda s: len(s) sắp xếp theo độ dài chuỗi: 'a' (1), 'bb' (2), 'ccc' (3).",
        options: [T("['a', 'bb', 'ccc']", true), T("['a', 'bb', 'ccc'] theo bảng chữ cái đảo"), T("['bb', 'a', 'ccc']"), T("['ccc', 'bb', 'a']")] },
      { type: "mcq", skill: "pds.python.functions", prompt: `Đoạn code sau in ra gì?\n\n${code("x = 1\n\ndef g():\n    global x\n    x = 5\n\ng()\nprint(x)")}`,
        explanation: "Nhờ khai báo global x, phép gán x = 5 trong hàm đổi biến x bên ngoài, nên print(x) in 5. Không có global thì x bên ngoài vẫn là 1.",
        options: [T("5", true), T("1"), T("None"), T("Báo NameError")] },
      { type: "mcq", skill: "pds.python.functions", prompt: `Đoạn code sau in ra gì?\n\n${code("def mm(values):\n    return min(values), max(values)\n\na, b = mm([3, 1, 2])\nprint(a, b)")}`,
        explanation: "return min(...), max(...) trả về một tuple (1, 3), rồi được gán vào a và b: a = 1, b = 3.",
        options: [T("1 3", true), T("3 1"), T("(1, 3) None"), T("Báo lỗi vì trả về hai giá trị")] },
    ],
  },
  {
    match: "Basic Object-Oriented Programming",
    file: "oop.md",
    skill: "pds.python.oop",
    quizTitle: "Ôn tập — Lập trình hướng đối tượng",
    questions: [
      { type: "mcq", skill: "pds.python.oop", prompt: `Đoạn code sau in ra gì?\n\n${code("class Counter:\n    def __init__(self):\n        self.n = 0\n    def inc(self):\n        self.n += 1\n\nc1 = Counter()\nc2 = Counter()\nc1.inc()\nc1.inc()\nc2.inc()\nprint(c1.n, c2.n)")}`,
        explanation: "n là thuộc tính riêng của từng object: c1 tăng hai lần (2), c2 tăng một lần (1).",
        options: [T("2 1", true, undefined), T("3 3", false, "attr_shared"), T("2 2", false, "attr_shared"), T("1 1")] },
      { type: "mcq", skill: "pds.python.oop", prompt: `Đoạn code sau in ra gì?\n\n${code("class A:\n    def hi(self):\n        return 'A'\n\nclass B(A):\n    def hi(self):\n        return 'B' + super().hi()\n\nprint(B().hi())")}`,
        explanation: "B ghi đè hi() nhưng gọi super().hi() để mở rộng thay vì thay thế: 'B' + 'A' = 'BA'.",
        options: [T("BA", true), T("B"), T("A"), T("AB", false, "inherit_vs_poly")] },
      { type: "numerical", skill: "pds.python.oop", prompt: `Đoạn code sau in ra số nào?\n\n${code("class S:\n    count = 0\n    def __init__(self):\n        S.count += 1\n\nS()\nS()\nprint(S.count)")}`,
        explanation: "count là thuộc tính lớp, dùng chung; mỗi lần tạo object __init__ tăng nó thêm 1. Hai lần tạo nên S.count = 2.", extra: NUM(2) },
      { type: "true_false", skill: "pds.python.oop", prompt: `Với đoạn code sau, isinstance(B(), A) là True.\n\n${code("class A:\n    pass\n\nclass B(A):\n    pass")}`,
        explanation: "Đúng — object của lớp con cũng là một object của lớp cha (quan hệ 'is-a').", options: YES_NO(true) },
    ],
  },
];

const PDS_FINAL_SKILL = {
  code: "pds.final.course_check",
  name: "Tổng hợp kiến thức Programming for Data Science",
  description: "Vận dụng tổng hợp Python, NumPy/Pandas và thu thập dữ liệu web (API, BeautifulSoup).",
};

const PDS_FINAL: { title: string; description: string; body: string; quizTitle: string; questions: Q[] } = {
  title: "Kiểm tra tổng hợp cuối khoá",
  description: "15 câu tự đánh giá bao quát cả ba module.",
  body:
    "## Kiểm tra tổng hợp cuối khoá\n\n" +
    "Bài này gồm **15 câu**, mỗi module 5 câu, để bạn tự đánh giá mức độ nắm kiến thức toàn khoá. Đạt từ 70% và được làm lại nhiều lần; sau mỗi lần bạn thấy giải thích đáp án.\n\n" +
    "| Phần | Nội dung |\n|---|---|\n" +
    "| Module 1 (5 câu) | Toán tử, list, vòng lặp, hàm, lớp |\n" +
    "| Module 2 (5 câu) | NumPy, Pandas, giá trị thiếu, groupby |\n" +
    "| Module 3 (5 câu) | Mã trạng thái, JSON, BeautifulSoup, tham số API |\n\n" +
    "Nếu sai ở phần nào, quay lại các đơn vị và bài ôn tập của phần đó rồi làm lại.\n\n" +
    "> Đây là bài **tự kiểm tra**, không thay thế bài thi cuối kỳ chính thức của học phần.",
  quizTitle: "Kiểm tra tổng hợp cuối khoá — Programming for Data Science",
  questions: [
    { type: "mcq", skill: "pds.python.basics", prompt: `Đoạn code sau in ra gì?\n\n${code("print(10 // 3, 10 % 3, 2 ** 3)")}`,
      explanation: "// là chia lấy phần nguyên (3), % là phần dư (1), ** là luỹ thừa (8).",
      options: [T("3 1 8", true), T("3.33 1 8", false, "div_vs_floor"), T("3 1 6"), T("3 3 8")] },
    { type: "mcq", skill: "pds.python.basics", prompt: `Đoạn code sau in ra gì?\n\n${code("x = [1, 2, 3]\ny = x.copy()\ny.append(4)\nprint(x)")}`,
      explanation: "copy() tạo một list mới độc lập, nên thêm 4 vào y không ảnh hưởng x: [1, 2, 3].",
      options: [T("[1, 2, 3]", true), T("[1, 2, 3, 4]", false, "list_alias"), T("[4]"), T("Báo lỗi")] },
    { type: "mcq", skill: "pds.python.control_flow", prompt: `Đoạn code sau in ra gì?\n\n${code("for i in range(3):\n    if i == 1:\n        continue\n    print(i)")}`,
      explanation: "continue bỏ qua lượt i = 1, nên chỉ 0 và 2 được in.",
      options: [T("0 2", true), T("0 1 2"), T("1"), T("0 1")] },
    { type: "mcq", skill: "pds.python.functions", prompt: `Đoạn code sau in ra gì?\n\n${code("def s(*n):\n    return sum(n)\n\nprint(s(1, 2, 3))")}`,
      explanation: "*n gom các đối số vào tuple (1, 2, 3); sum của chúng là 6.",
      options: [T("6", true), T("(1, 2, 3)"), T("3"), T("Báo TypeError")] },
    { type: "mcq", skill: "pds.python.oop", prompt: `Đoạn code sau in ra gì?\n\n${code("class C:\n    def __init__(self, v):\n        self.v = v\n    def double(self):\n        return self.v * 2\n\nprint(C(4).double())")}`,
      explanation: "C(4) tạo object có v = 4; double() trả về self.v * 2 = 8.",
      options: [T("8", true), T("4"), T("44"), T("Báo lỗi")] },
    { type: "numerical", skill: "pds.numpy.arrays", prompt: `Đoạn code sau in ra số nào?\n\n${code("import numpy as np\n\nprint(np.arange(1, 6).mean())")}`,
      explanation: "np.arange(1, 6) là [1 2 3 4 5] (dừng trước 6); trung bình = 15 / 5 = 3.0.", extra: NUM(3) },
    { type: "mcq", skill: "pds.numpy.arrays", prompt: `Đoạn code sau in ra gì?\n\n${code("import numpy as np\n\nprint(np.array([[1, 2], [3, 4]]).sum(axis=1))")}`,
      explanation: "axis=1 cộng theo từng hàng: [1 + 2, 3 + 4] = [3 7]. axis=0 mới cho tổng từng cột [4 6].",
      options: [T("[3 7]", true), T("[4 6]", false, "np_axis_swap"), T("10"), T("[[3 7]]")] },
    { type: "mcq", skill: "pds.pandas.dataframes", prompt: `${code('import pandas as pd\n\ndf = pd.DataFrame({"name": ["An", "Binh", "Chi", "Dung"],\n                   "score": [8, 5, 9, 4]})')}\n\n\`len(df[df["score"] >= 5])\` cho kết quả nào?`,
      explanation: "Các điểm ≥ 5 là 8, 5 và 9: 3 hàng (điểm 4 bị loại).",
      options: [T("3", true), T("2"), T("4"), T("1")] },
    { type: "mcq", skill: "pds.pandas.cleaning", prompt: `${code("import pandas as pd\n\nprint(pd.Series([1, None, 3]).mean())")}\n\nĐoạn code in ra gì?`,
      explanation: "mean() bỏ qua giá trị thiếu: (1 + 3) / 2 = 2.0. Nếu coi thiếu là 0 thì mới ra 1.33, nhưng pandas không làm vậy.",
      options: [T("2.0", true), T("1.33", false, "pd_nan_zero"), T("NaN"), T("4.0")] },
    { type: "numerical", skill: "pds.pandas.eda", prompt: `Đoạn code sau in ra số nào?\n\n${code('import pandas as pd\n\nd = pd.DataFrame({"g": ["a", "a", "b"], "v": [1, 3, 5]})\nprint(d.groupby("g")["v"].sum()["a"])')}`,
      explanation: "Nhóm a có hai dòng với v = 1 và 3: tổng = 4.", extra: NUM(4) },
    { type: "mcq", skill: "pds.web.rest_api", prompt: "Máy chủ trả về mã trạng thái 500. Điều đó có nghĩa gì?",
      explanation: "500 Internal Server Error là lỗi phía máy chủ (nhóm 5xx). Lỗi phía người gọi như địa chỉ sai (404) thuộc nhóm 4xx.",
      options: [T("Máy chủ gặp lỗi nội bộ", true), T("Địa chỉ không tồn tại", false, "http_status"), T("Yêu cầu thành công"), T("Bạn chưa đăng nhập")] },
    { type: "mcq", skill: "pds.web.rest_api", prompt: `Đoạn code sau in ra gì?\n\n${code("import json\n\nprint(json.loads('{\"a\": [1, 2, {\"b\": 3}]}')[\"a\"][2][\"b\"])")}`,
      explanation: "\"a\" là list [1, 2, {...}]; phần tử chỉ số 2 là dict {\"b\": 3}; [\"b\"] cho 3.",
      options: [T("3", true), T("2"), T("{'b': 3}"), T("Báo KeyError")] },
    { type: "mcq", skill: "pds.web.scraping", prompt: `Đoạn code sau in ra gì?\n\n${code("from bs4 import BeautifulSoup\n\nsoup = BeautifulSoup('<p>a</p><p class=\"x\">b</p>', 'html.parser')\nprint(soup.select('p.x')[0].text)")}`,
      explanation: "p.x chỉ khớp thẻ p có class x, tức thẻ thứ hai; .text lấy chữ bên trong: b.",
      options: [T("b", true), T("a"), T("p.x"), T("None")] },
    { type: "true_false", skill: "pds.web.scraping", prompt: "Trước khi scrape một trang web, bạn nên kiểm tra robots.txt và điều khoản sử dụng của trang.",
      explanation: "Đúng — đó là cách biết việc thu thập có được phép hay không; nên ưu tiên API nếu có, và chờ giữa các lần gọi.", options: YES_NO(true) },
    { type: "mcq", skill: "pds.web.rest_api", prompt: `Đoạn code sau in ra URL nào?\n\n${code('import requests\n\nreq = requests.Request("GET", "https://h.example/",\n                       params={"a": 1, "b": "x y"}).prepare()\nprint(req.url)')}`,
      explanation: "requests mã hoá tham số và ghép sau dấu ?: khoảng trắng trong 'x y' được mã hoá thành +, cho https://h.example/?a=1&b=x+y.",
      options: [T("https://h.example/?a=1&b=x+y", true), T("https://h.example/?a=1&b=x y"), T("https://h.example/?a=1,b=x+y"), T("https://h.example/a=1/b=x+y")] },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// ML — final check
// ─────────────────────────────────────────────────────────────────────────

const ML_SLUG = "fundamental-of-machine-learning";

const ML_FINAL_SKILL = {
  code: "ml.final.course_check",
  name: "Tổng hợp kiến thức học máy cơ bản",
  description:
    "Vận dụng tổng hợp chuẩn bị dữ liệu, các thuật toán cốt lõi và đánh giá mô hình.",
};

const ML_FINAL: typeof PDS_FINAL = {
  title: "Kiểm tra tổng hợp cuối khoá",
  description: "15 câu tự đánh giá bao quát cả ba module.",
  body:
    "## Kiểm tra tổng hợp cuối khoá\n\n" +
    "Bài này gồm **15 câu**, mỗi module 5 câu, để bạn tự đánh giá mức độ nắm kiến thức toàn khoá. Đạt từ 70% và được làm lại nhiều lần; sau mỗi lần bạn thấy giải thích đáp án.\n\n" +
    "| Phần | Nội dung |\n|---|---|\n" +
    "| Module 1 (5 câu) | Chuẩn hoá, mã hoá đặc trưng, loại đặc trưng, tránh rò rỉ dữ liệu |\n" +
    "| Module 2 (5 câu) | Hồi quy logistic, Gini, SVM, bootstrapping |\n" +
    "| Module 3 (5 câu) | Precision, Recall, F1, accuracy với dữ liệu mất cân bằng, RMSE |\n\n" +
    "Câu tính toán có đáp án số: làm tròn theo yêu cầu của đề. Nếu sai ở phần nào, quay lại các đơn vị của phần đó rồi làm lại.\n\n" +
    "> Đây là bài **tự kiểm tra**, không thay thế bài thi cuối kỳ chính thức của học phần.",
  quizTitle: "Kiểm tra tổng hợp cuối khoá — Fundamental of Machine Learning",
  questions: [
    { type: "numerical", skill: "ml.lecture.foundations", prompt: "Cột grade có giá trị nhỏ nhất là 2 và lớn nhất là 10. Sau khi chuẩn hoá Min-Max, giá trị 8 trở thành bao nhiêu?",
      explanation: "(8 − 2) / (10 − 2) = 6 / 8 = 0.75.", extra: NUM(0.75) },
    { type: "numerical", skill: "ml.lecture.foundations", prompt: "Một đặc trưng có trung bình 60 và độ lệch chuẩn 5. Sau khi chuẩn hoá z-score, giá trị 70 trở thành bao nhiêu?",
      explanation: "z = (70 − 60) / 5 = 2.", extra: NUM(2) },
    { type: "mcq", skill: "ml.lecture.foundations", prompt: "Cỡ áo S – M – L là loại đặc trưng nào?",
      explanation: "S, M, L là các hạng mục CÓ thứ tự (S < M < L) nên là ordinal. Nominal là hạng mục không thứ tự (ví dụ màu sắc).",
      options: [T("Ordinal", true), T("Nominal"), T("Numerical liên tục"), T("Boolean")] },
    { type: "mcq", skill: "ml.lecture.foundations", prompt: "Cột màu sắc có 4 giá trị khác nhau (black, blue, white, green). Sau one-hot encoding sẽ có bao nhiêu cột nhị phân?",
      explanation: "One-hot encoding tạo một cột nhị phân cho mỗi hạng mục, nên có 4 cột.",
      options: [T("4", true), T("1"), T("3"), T("16")] },
    { type: "mcq", skill: "ml.lecture.foundations", prompt: "Khi chuẩn hoá dữ liệu bằng scaler, cách làm nào đúng?",
      explanation: "Chỉ fit trên tập train (học trung bình/độ lệch chuẩn từ train) rồi dùng đúng scaler đó để transform cả train và test. Fit trên test làm rò rỉ thông tin của test vào mô hình.",
      options: [T("Fit trên tập train, rồi transform train và test", true), T("Fit lại riêng trên tập test", false, "fit_test"), T("Fit trên toàn bộ dữ liệu trước khi chia tập", false, "fit_test"), T("Không cần chuẩn hoá")] },
    { type: "mcq", skill: "ml.lecture.algorithms", prompt: "Hồi quy logistic (Logistic Regression) được dùng cho loại bài toán nào?",
      explanation: "Dù tên có chữ regression, nó là mô hình phân loại: cho ra xác suất trong khoảng (0, 1) rồi so với ngưỡng (thường 0.5) để quyết định nhãn.",
      options: [T("Phân loại, đầu ra là xác suất trong (0, 1)", true), T("Dự đoán giá trị số liên tục", false, "regression_vs_classification"), T("Gom cụm dữ liệu không có nhãn"), T("Giảm số chiều dữ liệu")] },
    { type: "numerical", skill: "ml.lecture.algorithms", prompt: "Một nút của cây quyết định có 5 mẫu nhãn Yes và 5 mẫu nhãn No. Gini = 1 − Σ pᵢ² của nút đó là bao nhiêu?",
      explanation: "p(Yes) = p(No) = 0.5 nên Gini = 1 − (0.5² + 0.5²) = 1 − 0.5 = 0.5.", extra: NUM(0.5) },
    { type: "mcq", skill: "ml.lecture.algorithms", prompt: "Một nhánh của cây quyết định có Gini = 0. Điều đó có nghĩa gì?",
      explanation: "Gini = 0 nghĩa là nhánh hoàn toàn thuần khiết: mọi mẫu cùng một nhãn, không cần chia tiếp.",
      options: [T("Nhánh thuần khiết: mọi mẫu cùng một nhãn", true), T("Nhánh rỗng, không có mẫu nào"), T("Nhánh có số mẫu Yes bằng số mẫu No"), T("Mô hình đang bị lỗi")] },
    { type: "mcq", skill: "ml.lecture.algorithms", prompt: "Trong SVM, support vectors là những điểm nào?",
      explanation: "Support vectors là các điểm dữ liệu nằm sát đường phân lớp (biên) nhất; chỉ chúng quyết định vị trí của siêu phẳng, các điểm xa hơn không ảnh hưởng.",
      options: [T("Các điểm nằm sát đường phân lớp nhất", true), T("Mọi điểm của lớp dương"), T("Các điểm nằm xa đường phân lớp nhất"), T("Các điểm bị gán nhãn sai")] },
    { type: "mcq", skill: "ml.lecture.algorithms", prompt: "Bootstrapping (nền tảng của Random Forest) lấy mẫu như thế nào?",
      explanation: "Bootstrapping là lấy mẫu CÓ hoàn lại: một quan sát có thể được chọn nhiều lần trong cùng một mẫu, và có quan sát không được chọn.",
      options: [T("Lấy mẫu có hoàn lại từ dữ liệu gốc", true), T("Lấy mẫu không hoàn lại"), T("Chia dữ liệu thành các nhóm bằng nhau"), T("Lấy đúng nửa đầu của dữ liệu")] },
    { type: "numerical", skill: "ml.lecture.evaluation", prompt: "Một mô hình phân loại có TP = 30 và FP = 10. Precision = TP / (TP + FP) là bao nhiêu?",
      explanation: "Precision = 30 / (30 + 10) = 0.75.", extra: NUM(0.75) },
    { type: "numerical", skill: "ml.lecture.evaluation", prompt: "Cùng mô hình đó có TP = 30 và FN = 20. Recall = TP / (TP + FN) là bao nhiêu?",
      explanation: "Recall = 30 / (30 + 20) = 0.6.", extra: NUM(0.6) },
    { type: "numerical", skill: "ml.lecture.evaluation", prompt: "Với Precision = 0.75 và Recall = 0.6, điểm F1 = 2·P·R / (P + R) là bao nhiêu? (làm tròn 2 chữ số thập phân)",
      explanation: "F1 = 2 × 0.75 × 0.6 / (0.75 + 0.6) = 0.9 / 1.35 ≈ 0.67. Chú ý F1 nằm gần giá trị nhỏ hơn (0.6), khác trung bình cộng 0.675.", extra: NUM(0.67, 0.02) },
    { type: "mcq", skill: "ml.lecture.evaluation", prompt: "Trong tập dữ liệu có 99% mẫu bình thường và 1% gian lận, một mô hình luôn đoán \"bình thường\" đạt accuracy 99%. Kết luận nào đúng?",
      explanation: "Accuracy bị đánh lừa khi dữ liệu mất cân bằng: mô hình này không bắt được ca gian lận nào (Recall của lớp gian lận bằng 0) nhưng vẫn có accuracy cao. Cần xem Precision, Recall, F1.",
      options: [T("Accuracy gây hiểu lầm; mô hình vô dụng vì bỏ sót mọi ca gian lận", true), T("Mô hình rất tốt vì accuracy cao", false, "accuracy_always_good"), T("Mô hình tốt nếu Precision bằng 1"), T("Không thể đánh giá được")] },
    { type: "numerical", skill: "ml.lecture.evaluation", prompt: "Một mô hình hồi quy sai +3 ở mẫu thứ nhất và −4 ở mẫu thứ hai. RMSE bằng bao nhiêu? (làm tròn 2 chữ số thập phân)",
      explanation: "MSE = (3² + (−4)²) / 2 = 25 / 2 = 12.5; RMSE = √12.5 ≈ 3.54. (MAE cùng dữ liệu là 3.5 — RMSE lớn hơn vì phạt sai số lớn nặng hơn.)", extra: NUM(3.54, 0.02) },
  ],
};

// ─────────────────────────────────────────────────────────────────────────
// Runner
// ─────────────────────────────────────────────────────────────────────────

async function addQuiz(
  actor: string,
  courseId: string,
  lessonId: string,
  title: string,
  description: string,
  questions: Q[],
  skillIds: Map<string, string>,
) {
  const { quizId } = await createQuiz(
    actor,
    { courseId, lessonId },
    { title, description, passThresholdPct: 70, maxAttempts: 5, requireConfidence: true },
    prisma,
  );
  for (const [i, q] of questions.entries()) {
    const sid = skillIds.get(q.skill);
    if (!sid) throw new Error(`unknown skill ${q.skill}`);
    await createQuestion(
      actor,
      quizId,
      {
        type: q.type,
        prompt: rich(q.prompt),
        explanation: q.explanation,
        points: 1,
        orderIndex: i,
        ...(q.options
          ? { options: q.options.map((o) => ({ label: o.label, isCorrect: o.correct ?? false, ...misIdOf(o.mis) })) }
          : {}),
        ...(q.extra ? { extra: q.extra } : {}),
        skillIds: [sid],
      },
      prisma,
    );
  }
}

async function skillMap(codes: string[]): Promise<Map<string, string>> {
  const rows = await prisma.skill.findMany({ where: { code: { in: codes } }, select: { id: true, code: true } });
  const m = new Map(rows.map((r) => [r.code, r.id]));
  for (const c of codes) if (!m.has(c)) throw new Error(`missing skill ${c}`);
  return m;
}

async function ensureSkill(def: { code: string; name: string; description: string }): Promise<string> {
  const found = await prisma.skill.findUnique({ where: { code: def.code } });
  return found?.id ?? (await createSkill(def, prisma)).skillId;
}

async function addFinal(
  actor: string,
  courseId: string,
  moduleId: string,
  plan: typeof PDS_FINAL,
  finalSkill: { code: string; name: string; description: string },
) {
  const existing = await prisma.lesson.findFirst({
    where: { moduleId, title: plan.title },
    include: { quizzes: { where: { cuepointOnly: false }, select: { id: true } } },
  });
  if (existing && existing.quizzes.length > 0) {
    console.log(`skip (already built): ${plan.title}`);
    return;
  }
  if (existing) throw new Error(`"${plan.title}" exists without a quiz — delete it and rerun`);

  const skills = await skillMap([...new Set(plan.questions.map((q) => q.skill))]);
  const finalSkillId = await ensureSkill(finalSkill);

  const max = await prisma.lesson.aggregate({ where: { moduleId }, _max: { orderIndex: true } });
  const orderIndex = (max._max.orderIndex ?? -1) + 1;
  const { lessonId } = await createLesson(
    actor,
    moduleId,
    { title: plan.title, orderIndex, description: plan.description },
    prisma,
  );
  await createContentItem(actor, lessonId, { type: "markdown", payload: { body: plan.body }, orderIndex: 0 }, prisma);
  await addQuiz(actor, courseId, lessonId, plan.quizTitle, plan.description, plan.questions, skills);
  await tagLessonSkill(actor, lessonId, { skillId: finalSkillId }, prisma);
  console.log(`[${orderIndex}] "${plan.title}" — ${plan.questions.length} câu`);
}

async function main() {
  const which = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (which !== "pds" && which !== "ml") {
    console.error("usage: seed-review-and-final.ts <pds|ml> [--dry-run]");
    process.exit(1);
  }
  const slug = which === "pds" ? PDS_SLUG : ML_SLUG;

  // Validate everything before touching the database.
  for (const r of PDS_REVIEWS) validate(r.match, r.questions);
  validate("PDS final", PDS_FINAL.questions);
  validate("ML final", ML_FINAL.questions);
  for (const r of PDS_REVIEWS) if (read(r.file).length < 900) throw new Error(`${r.file} too short`);

  const course = await prisma.course.findUnique({ where: { slug } });
  if (!course) throw new Error(`no course ${slug}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;
  const modules = await prisma.module.findMany({ where: { courseId: course.id }, orderBy: { orderIndex: "asc" } });
  const lastModule = modules[modules.length - 1];
  if (!lastModule) throw new Error("course has no module");

  if (dryRun) {
    console.log("DRY RUN\n");
    if (which === "pds") {
      for (const r of PDS_REVIEWS) console.log(`review "${r.match}": ${read(r.file).length} chars, ${r.questions.length} câu`);
      console.log(`final "${PDS_FINAL.title}": ${PDS_FINAL.questions.length} câu → ${lastModule.title}`);
    } else {
      console.log(`final "${ML_FINAL.title}": ${ML_FINAL.questions.length} câu → ${lastModule.title}`);
    }
    return;
  }

  await ensureMisconceptions();

  if (which === "pds") {
    const codes = [...new Set(PDS_REVIEWS.flatMap((r) => r.questions.map((q) => q.skill)))];
    const skills = await skillMap(codes);
    for (const r of PDS_REVIEWS) {
      const lesson = await prisma.lesson.findFirst({
        where: { title: r.match, module: { courseId: course.id } },
        include: {
          contentItems: { where: { type: "markdown" }, select: { id: true } },
          quizzes: { where: { cuepointOnly: false }, select: { id: true } },
        },
      });
      if (!lesson) throw new Error(`no lesson "${r.match}"`);
      if (lesson.quizzes.length > 0) {
        console.log(`skip (already has a quiz): ${lesson.title}`);
        continue;
      }
      if (lesson.contentItems.length !== 1) throw new Error(`${r.match}: expected one markdown item`);
      await updateContentItem(actor, lesson.contentItems[0]!.id, { payload: { body: read(r.file) } }, prisma);
      await addQuiz(actor, course.id, lesson.id, r.quizTitle, "4 câu ôn tập kèm giải thích.", r.questions, skills);
      console.log(`review "${lesson.title}" — ${read(r.file).length} chars, ${r.questions.length} câu`);
    }
    await addFinal(actor, course.id, lastModule.id, PDS_FINAL, PDS_FINAL_SKILL);
  } else {
    await addFinal(actor, course.id, lastModule.id, ML_FINAL, ML_FINAL_SKILL);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
