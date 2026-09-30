/**
 * Build "Programming for Data Science" Module 1 as a series of micro-lessons.
 *
 * The recording is one 51-minute session covering the whole module. That is too
 * coarse for micro-credential delivery, so it is cut on slide boundaries into
 * eleven short units. Each unit is self-contained and separately assessable:
 *
 *   short video (2–7 min)  →  one in-video cuepoint quiz that pauses playback
 *   →  end-of-unit quiz (pass 70%)  →  its own skill, so mastery is recorded
 *      per unit and not just per module.
 *
 *   Introduction.mp4 -> "Course Overview", first lesson of Module 1
 *   u01..u11.mp4     -> units 1.1 … 1.11, straight after it
 *   (no video)       -> "Thực hành tổng hợp Module 1": the practice assignment
 *
 * Cut points and cuepoint times come from slide-change detection on the video
 * itself. Every cuepoint sits just before the next slide appears, so a question
 * lands right after a concept finishes, never mid-explanation. Times below are
 * relative to the start of each unit's clip.
 *
 *   tsx scripts/seed-pds-lectures.ts <video-dir> [--dry-run]
 *
 * <video-dir> holds Introduction.mp4 and u01.mp4 … u11.mp4. Idempotent: a lesson
 * that already carries a video is skipped whole. Blobs go through the storage
 * adapter, so S3_* decides where they land. The older single 51-minute lecture
 * ("Bài giảng 1: …") is not touched here — remove it with
 * scripts/delete-lesson.ts once the units are confirmed.
 *
 * Note on cuepoints: the gating player only mounts for signed-in learners, and
 * only grades `mcq` / `true_false`. Every cuepoint question is therefore mcq or
 * true_false. Every question is built only from code and slides visible in the
 * video, or from a snippet whose output is fixed by the language.
 */
import { randomBytes } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import {
  createLesson,
  createContentItem,
  createSkill,
  tagLessonSkill,
  createQuiz,
  createQuestion,
  createCuepointQuiz,
  createAssignment,
} from "@feedbackme/core-lms";
import { storageFor } from "../src/lib/storage";
import { lessonVideoKey } from "../src/lib/storage-keys";

const COURSE_SLUG = "programming-for-data-science";
const MAX_VIDEO_BYTES = 1024 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface Opt {
  label: string;
  correct?: boolean;
  /** Misconception key — only meaningful on a wrong option. */
  mis?: string;
  extra?: Record<string, unknown>;
}

interface Q {
  type: "mcq" | "true_false" | "fill_in" | "numerical" | "ordering" | "matching" | "short_answer";
  prompt: string;
  explanation?: string;
  points?: number;
  options?: Opt[];
  extra?: Record<string, unknown>;
  skill?: string;
}

interface Cue {
  /** Seconds from the start of THIS unit's clip. */
  atSec: number;
  /** Only mcq / true_false gate playback — see file header. */
  q: Q & { type: "mcq" | "true_false" };
}

interface Unit {
  key: string;
  file: string;
  title: string;
  description: string;
  body: string;
  skill: { code: string; name: string; description: string };
  cue: Cue;
  quiz: { title: string; description: string; questions: Q[] };
}

interface SkillDef {
  code: string;
  name: string;
  description: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Skills — one per unit, plus overview and the capstone.
// ─────────────────────────────────────────────────────────────────────────

const sk = (key: string, name: string, description: string): SkillDef => ({
  code: `pds.micro.${key}`,
  name,
  description,
});

const SKILLS: Record<string, SkillDef> = {
  overview: {
    code: "pds.intro.course_overview",
    name: "Tổng quan khoá học và lộ trình 3 module",
    description:
      "Nắm được khoá học đi từ lập trình Python, qua xử lý dữ liệu với NumPy/Pandas, tới thu thập dữ liệu web bằng API và BeautifulSoup.",
  },
  capstone: {
    code: "pds.lecture.python_fundamentals",
    name: "Nền tảng lập trình Python: từ biến tới lập trình hướng đối tượng",
    description:
      "Biến, toán tử, kiểu dữ liệu chuẩn, rẽ nhánh và vòng lặp, hàm, và lập trình hướng đối tượng cơ bản trong Python.",
  },
  syntax: sk("syntax", "Python và cú pháp cơ bản", "Chọn đúng phiên bản Python, hiểu phân biệt hoa thường, thụt lề và comment."),
  variables: sk("variables_io", "Biến, nhập và xuất dữ liệu", "Tạo và đặt tên biến theo PEP 8, dùng print(), f-string và input()."),
  operators: sk("operators", "Toán tử và biểu thức", "Dùng toán tử số học, so sánh, logic, in/is và nắm thứ tự ưu tiên."),
  numstr: sk("numbers_strings", "Số, boolean và chuỗi", "Làm việc với số, boolean, truthiness, và chỉ số/slice/phương thức của chuỗi."),
  lists: sk("lists", "List", "Tạo, sửa, sao chép và sắp xếp list."),
  collections: sk("collections", "Tuple, Set, Dictionary và ép kiểu", "Chọn đúng tuple, set hoặc dictionary và chuyển đổi kiểu dữ liệu."),
  conditionals: sk("conditionals", "Rẽ nhánh if / elif / else", "Điều khiển luồng chương trình bằng if, elif, else và pass."),
  loops: sk("loops", "Vòng lặp for và while", "Lặp với range, lặp qua chuỗi, break/continue/else và while."),
  functions: sk("functions", "Hàm", "Định nghĩa hàm, tham số mặc định, *args/**kwargs, lambda và phạm vi biến."),
  classes: sk("classes", "Lớp và đối tượng", "Định nghĩa class, __init__, self, thuộc tính riêng và dùng chung."),
  oop: sk("oop_pillars", "Kế thừa, đóng gói và đa hình", "Phân biệt và áp dụng kế thừa, đóng gói và đa hình."),
};

const MISCONCEPTIONS: Record<string, { code: string; name: string; description: string }> = {
  input_is_number: {
    code: "py_input_returns_number",
    name: "Tưởng input() trả về số",
    description:
      "Học viên cho rằng input() tự nhận ra số và trả về int/float, quên rằng nó luôn trả về chuỗi nên phải ép kiểu.",
  },
  div_vs_floor: {
    code: "py_true_vs_floor_division",
    name: "Nhầm phép chia / với chia lấy phần nguyên //",
    description:
      "Học viên nhầm '/' (luôn ra float) với '//' (làm tròn xuống) hoặc quên '%' là phần dư.",
  },
  is_vs_eq: {
    code: "py_is_vs_equals",
    name: "Dùng `is` để so sánh giá trị",
    description:
      "Học viên dùng `is` thay cho `==` để so sánh giá trị, trong khi `is` kiểm tra hai tên có cùng trỏ tới một đối tượng hay không.",
  },
  slice_end: {
    code: "py_slice_end_inclusive",
    name: "Tưởng chỉ số cuối của slice được lấy",
    description:
      "Học viên tính s[a:b] gồm cả vị trí b, trong khi slice dừng ngay trước b.",
  },
  list_alias: {
    code: "py_list_assignment_copies",
    name: "Tưởng b = a tạo bản sao của list",
    description:
      "Học viên cho rằng gán một list sang biến khác sao chép nội dung, nên sửa b không ảnh hưởng a.",
  },
  int_rounds: {
    code: "py_int_rounds",
    name: "Tưởng int() làm tròn số thực",
    description:
      "Học viên cho rằng int(3.99) ra 4, trong khi int() cắt bỏ phần thập phân.",
  },
  range_end: {
    code: "py_range_includes_end",
    name: "Tưởng range(a, b) gồm cả b",
    description: "Học viên nghĩ range(2, 6) kết thúc ở 6, trong khi nó dừng ngay trước 6.",
  },
  scope_leak: {
    code: "py_local_assignment_changes_global",
    name: "Tưởng gán trong hàm sẽ đổi biến bên ngoài",
    description:
      "Học viên cho rằng x = 99 bên trong hàm làm đổi biến x toàn cục, quên rằng phép gán tạo một biến local mới.",
  },
  attr_shared: {
    code: "py_instance_attribute_shared",
    name: "Tưởng thuộc tính của một object ảnh hưởng mọi object",
    description:
      "Học viên nhầm instance attribute (riêng từng object) với class attribute (dùng chung).",
  },
  inherit_vs_poly: {
    code: "py_inheritance_vs_polymorphism",
    name: "Nhầm kế thừa với đa hình",
    description:
      "Học viên nhầm việc lớp con dùng lại code của lớp cha (kế thừa) với việc cùng một tên phương thức cho hành vi khác nhau tuỳ đối tượng (đa hình).",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────

const OVERVIEW = {
  file: "Introduction.mp4",
  title: "Course Overview",
  description: "Video giới thiệu khoá học và lộ trình 3 module.",
  body:
    "## Course Overview\n\n" +
    "Video giới thiệu ngắn (khoảng 2 phút) về khoá học và cách các module nối với nhau.\n\n" +
    "### Lộ trình 3 module\n\n" +
    "| Module | Nội dung |\n" +
    "|---|---|\n" +
    "| 1. Fundamentals of Python Programming | Biến, kiểu dữ liệu, toán tử, rẽ nhánh và vòng lặp, hàm, lập trình hướng đối tượng cơ bản |\n" +
    "| 2. Data Manipulation with NumPy and Pandas | Mảng và DataFrame — làm sạch, biến đổi, tổng hợp và khám phá dữ liệu trong Jupyter |\n" +
    "| 3. Accessing and Collecting Web Data | Gọi REST API, làm việc với JSON, và scraping cơ bản với BeautifulSoup |\n\n" +
    "### Cách học\n\n" +
    "Module 1 được chia thành **11 đơn vị ngắn**, mỗi đơn vị 2–7 phút với một mục tiêu duy nhất: một video, một câu hỏi chèn giữa video, và một bài kiểm tra nhỏ (đạt từ 70%). Hoàn thành từng đơn vị là bạn đã nắm chắc một kỹ năng cụ thể — không cần học liền một mạch. Cuối module có một bài thực hành tổng hợp.",
};

const CAPSTONE = {
  title: "Thực hành tổng hợp Module 1",
  description: "Bài thực hành gom các kỹ năng của 11 đơn vị vào một chương trình hoàn chỉnh.",
  body:
    "## Thực hành tổng hợp Module 1\n\n" +
    "Bài này gom toàn bộ kỹ năng của Module 1 — biến, kiểu dữ liệu, rẽ nhánh, vòng lặp, hàm và lớp — vào một chương trình nhỏ. Làm sau khi bạn đã hoàn thành các đơn vị 1.1 đến 1.11.\n\n" +
    "Đề bài nằm ở phần **Bài tập** bên dưới.",
  assignment: {
    title: "Thực hành 1: Chương trình quản lý điểm học viên",
    description:
      "Viết một chương trình Python nhỏ để quản lý điểm của một lớp học, dùng đủ các kiến thức của Module 1.\n\n" +
      "Chương trình cần có:\n\n" +
      "1. **Dữ liệu** — một dictionary lồng nhau, mỗi học viên có `name` và một list `scores` (ít nhất 5 học viên, mỗi người ít nhất 3 điểm).\n" +
      "2. **Hàm** — `average(scores)` trả về điểm trung bình; `classify(avg)` trả về xếp loại theo `if / elif / else`.\n" +
      "3. **Vòng lặp** — duyệt qua tất cả học viên bằng `for`, in ra tên, điểm trung bình (định dạng bằng f-string, 2 chữ số thập phân) và xếp loại.\n" +
      "4. **Class** — một class `Student` có `__init__`, ít nhất một phương thức (ví dụ `status()`), và một class con kế thừa từ `Student` ghi đè phương thức đó.\n" +
      "5. **Nhập liệu** — cho người dùng nhập tên một học viên bằng `input()`, sau đó in kết quả của học viên đó (xử lý trường hợp không tìm thấy).\n\n" +
      "Nộp file `.py` hoặc notebook `.ipynb`, kèm vài dòng giải thích: bạn chọn cấu trúc dữ liệu nào và vì sao, và phần nào khiến bạn gặp lỗi nhiều nhất khi viết.\n\n" +
      "Chấm điểm dựa trên việc chương trình chạy đúng và bạn dùng đúng công cụ cho từng việc, không dựa vào độ dài code.",
    pedagogicalIntent: "enacting" as const,
    responseFormat: "mixed" as const,
  },
};

const T = (label: string, correct?: boolean, mis?: string): Opt => ({ label, ...(correct ? { correct } : {}), ...(mis ? { mis } : {}) });
const YES_NO = (yes: boolean): Opt[] => [T("Đúng", yes), T("Sai", !yes)];

const UNITS: Unit[] = [
  // ───────────────────────── 1.1 ─────────────────────────
  {
    key: "u01",
    file: "u01.mp4",
    title: "1.1 Python và cú pháp cơ bản",
    description: "Python là gì, chạy Python thế nào, và ba quy tắc cú pháp đầu tiên: hoa thường, thụt lề, comment.",
    skill: SKILLS.syntax!,
    body:
      "## 1.1 Python và cú pháp cơ bản\n\n" +
      "**Sau đơn vị này bạn sẽ:** chọn đúng phiên bản Python, và viết được một đoạn code không sai cú pháp cơ bản.\n\n" +
      "### Cần nhớ\n\n" +
      "- Luôn dùng **Python 3** — Python 2 đã hết vòng đời từ năm 2020.\n" +
      "- Python **phân biệt hoa thường**: `age`, `Age`, `AGE` là ba tên khác nhau.\n" +
      "- Khối lệnh được xác định bằng **thụt lề** (4 dấu cách theo PEP 8); dòng mở khối kết thúc bằng dấu `:`.\n" +
      "- Comment một dòng bắt đầu bằng `#`.",
    cue: {
      atSec: 165,
      q: {
        type: "mcq",
        prompt: "Nên dùng phiên bản Python nào cho công việc mới?",
        explanation: "Luôn dùng Python 3. Python 2 đã kết thúc vòng đời từ năm 2020 và không còn được cập nhật.",
        options: [T("Python 2, vì ổn định hơn"), T("Python 3", true), T("Cả hai đều được như nhau"), T("Phiên bản nào cũng chạy giống nhau")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.1 — Cú pháp cơ bản",
      description: "3 câu về phiên bản, hoa thường và thụt lề.",
      questions: [
        { type: "true_false", prompt: "Trong Python, age, Age và AGE là ba biến khác nhau.", explanation: "Đúng — Python phân biệt chữ hoa và chữ thường.", options: YES_NO(true) },
        {
          type: "mcq",
          prompt: "Python dùng gì để xác định phạm vi của một khối lệnh?",
          explanation: "Thụt lề (quy ước PEP 8 là 4 dấu cách). Dòng mở khối như if hay for kết thúc bằng dấu hai chấm.",
          options: [T("Cặp ngoặc nhọn { }"), T("Thụt lề", true), T("Từ khoá begin và end"), T("Dấu chấm phẩy ở cuối dòng")],
        },
        {
          type: "mcq",
          prompt: "Ký tự nào bắt đầu một comment trên một dòng?",
          explanation: "Dấu # — mọi thứ từ đó tới hết dòng bị Python bỏ qua.",
          options: [T("//"), T("#", true), T("--"), T("/* */")],
        },
      ],
    },
  },
  // ───────────────────────── 1.2 ─────────────────────────
  {
    key: "u02",
    file: "u02.mp4",
    title: "1.2 Biến, nhập và xuất dữ liệu",
    description: "Tạo và đặt tên biến theo PEP 8, in kết quả bằng print và f-string, nhận dữ liệu bằng input.",
    skill: SKILLS.variables!,
    body:
      "## 1.2 Biến, nhập và xuất dữ liệu\n\n" +
      "**Sau đơn vị này bạn sẽ:** khai báo biến đúng quy ước, in kết quả đẹp và nhận dữ liệu từ người dùng.\n\n" +
      "### Cần nhớ\n\n" +
      "- Đặt tên: biến và hàm dùng `snake_case`, hằng số dùng `UPPER_SNAKE_CASE`, class dùng `PascalCase`.\n" +
      "- `del x` xoá tên `x`; dùng `x` sau đó gây `NameError`.\n" +
      "- `print(*objects, sep=' ', end='\\n')` — `sep` là thứ chèn giữa các giá trị, `end` là thứ chèn ở cuối.\n" +
      "- f-string: `f\"{score:.2f}\"` in 2 chữ số thập phân.\n" +
      "- **`input()` luôn trả về chuỗi** — muốn tính toán phải ép kiểu: `int(input(...))`.",
    cue: {
      atSec: 202,
      q: {
        type: "mcq",
        prompt: "Theo quy ước PEP 8, một hằng số như giá trị tối đa nên được đặt tên theo kiểu nào?",
        explanation: "Hằng số dùng UPPER_SNAKE_CASE, ví dụ MAX_SIZE hay PI. Biến và hàm dùng snake_case, còn tên class dùng PascalCase.",
        options: [T("snake_case, ví dụ max_size"), T("UPPER_SNAKE_CASE, ví dụ MAX_SIZE", true), T("PascalCase, ví dụ MaxSize"), T("Bắt đầu bằng dấu gạch dưới, ví dụ _max_size")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.2 — Biến và nhập xuất",
      description: "4 câu về input, del, f-string và print.",
      questions: [
        {
          type: "mcq",
          prompt: "Hàm input() trả về giá trị thuộc kiểu nào?",
          explanation: "input() luôn trả về chuỗi (str), kể cả khi người dùng gõ 42. Muốn dùng như số phải ép kiểu, ví dụ int(input(...)). Quên bước này thì \"5\" + 1 báo TypeError.",
          options: [T("int nếu người dùng gõ số, ngược lại là str", false, "input_is_number"), T("float", false, "input_is_number"), T("str — luôn luôn là chuỗi", true), T("Tuỳ theo biến nhận giá trị", false, "input_is_number")],
        },
        {
          type: "true_false",
          prompt: "Sau khi chạy `x = 5`, rồi `del x`, rồi `print(x)` thì Python báo NameError.",
          explanation: "Đúng — del x xoá tên x, nên dùng lại x sau đó là NameError.",
          options: YES_NO(true),
        },
        {
          type: "mcq",
          prompt: "Với score = 9.456, f\"{score:.2f}\" cho kết quả nào?",
          explanation: ".2f nghĩa là số thực với 2 chữ số thập phân, có làm tròn: 9.456 thành 9.46.",
          options: [T("9.4"), T("9.45"), T("9.46", true), T("9.456")],
        },
        {
          type: "mcq",
          prompt: "print(1, 2, 3, sep='*') in ra gì?",
          explanation: "sep là chuỗi chèn giữa các giá trị (mặc định là một dấu cách). Với sep='*' ta được 1*2*3.",
          options: [T("1 2 3"), T("1*2*3", true), T("123"), T("1, 2, 3")],
        },
      ],
    },
  },
  // ───────────────────────── 1.3 ─────────────────────────
  {
    key: "u03",
    file: "u03.mp4",
    title: "1.3 Toán tử và biểu thức",
    description: "Toán tử số học và gán, so sánh và logic, in/is, và thứ tự ưu tiên.",
    skill: SKILLS.operators!,
    body:
      "## 1.3 Toán tử và biểu thức\n\n" +
      "**Sau đơn vị này bạn sẽ:** đọc và viết đúng các biểu thức, biết toán tử nào chạy trước.\n\n" +
      "### Cần nhớ\n\n" +
      "- `/` luôn ra số thực; `//` chia lấy phần nguyên (làm tròn xuống); `%` là phần dư; `**` là luỹ thừa.\n" +
      "- `n % 2 == 0` kiểm tra n chẵn.\n" +
      "- `==` so sánh **giá trị**; `is` kiểm tra hai tên có cùng trỏ tới **một đối tượng**, thường dùng để kiểm tra `None`.\n" +
      "- Ưu tiên từ cao xuống thấp: `**`, rồi `* / % //`, rồi `+ -`, rồi so sánh, rồi `is`/`in`, cuối cùng `not and or`.",
    cue: {
      atSec: 137,
      q: {
        type: "mcq",
        prompt: "Kết quả của print(7 // 2) và print(7 % 2) lần lượt là gì?",
        explanation: "// là chia lấy phần nguyên (làm tròn xuống) nên 7 // 2 = 3; % là phần dư nên 7 % 2 = 1. Còn 7 / 2 mới cho 3.5 vì / luôn trả về float.",
        options: [T("3.5 và 1", false, "div_vs_floor"), T("3 và 1", true), T("3 và 3.5", false, "div_vs_floor"), T("4 và 1", false, "div_vs_floor")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.3 — Toán tử",
      description: "3 câu về `is`, luỹ thừa và thứ tự ưu tiên.",
      questions: [
        {
          type: "mcq",
          prompt: "Theo bài giảng, toán tử `is` chủ yếu được dùng để làm gì?",
          explanation: "== so sánh giá trị, còn is kiểm tra hai tên có trỏ tới cùng một đối tượng không. Vì vậy is chủ yếu dùng để kiểm tra None (x is None); so sánh giá trị hãy dùng ==.",
          options: [T("So sánh xem hai số hoặc hai chuỗi có bằng nhau không", false, "is_vs_eq"), T("Kiểm tra một biến có phải None", true), T("Kiểm tra một phần tử có nằm trong list không"), T("So sánh lớn hơn hoặc nhỏ hơn giữa hai số")],
        },
        { type: "numerical", prompt: "Giá trị của biểu thức 2 ** 10 là bao nhiêu?", explanation: "** là luỹ thừa: 2 mũ 10 = 1024.", extra: { expected: 1024, tolerance: 0.01 } },
        {
          type: "ordering",
          prompt: "Sắp xếp các nhóm toán tử sau theo thứ tự ưu tiên từ CAO xuống THẤP, đúng như bảng trong bài giảng.",
          explanation: "Luỹ thừa (**) trước, rồi nhân chia (* / % //), rồi cộng trừ, rồi so sánh, rồi is / in, cuối cùng là not, and, or (thấp nhất).",
          options: [T("** (luỹ thừa)"), T("* / % // (nhân, chia, phần dư)"), T("+ - (cộng, trừ)"), T("< <= > >= == != (so sánh)"), T("is, is not, in, not in"), T("not, and, or (logic)")],
        },
      ],
    },
  },
  // ───────────────────────── 1.4 ─────────────────────────
  {
    key: "u04",
    file: "u04.mp4",
    title: "1.4 Số, boolean và chuỗi",
    description: "Kiểu số và boolean, truthiness, và cách lấy phần tử, cắt lát và dùng phương thức của chuỗi.",
    skill: SKILLS.numstr!,
    body:
      "## 1.4 Số, boolean và chuỗi\n\n" +
      "**Sau đơn vị này bạn sẽ:** dự đoán đúng một giá trị là truthy hay falsy, và cắt chuỗi đúng vị trí.\n\n" +
      "### Cần nhớ\n\n" +
      "- Falsy: `False None 0 0.0 '' [] () {} set()`. Mọi thứ khác là truthy — kể cả chuỗi `\"False\"`.\n" +
      "- `True + True` bằng 2 (boolean là số).\n" +
      "- Chuỗi đánh chỉ số từ 0; slice `s[a:b]` **dừng ngay trước b**; `s[::-1]` đảo ngược.\n" +
      "- Chuỗi là **immutable**: không sửa được từng ký tự.",
    cue: {
      atSec: 197,
      q: {
        type: "mcq",
        prompt: "bool(\"False\") trả về gì?",
        explanation: "Mọi chuỗi không rỗng đều là truthy, bất kể nội dung của nó là gì — nên bool(\"False\") là True. Chỉ chuỗi rỗng '' mới falsy.",
        options: [T("False, vì nội dung là chữ False"), T("True", true), T("Báo lỗi"), T("None")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.4 — Số và chuỗi",
      description: "4 câu về slice, toán tử chuỗi, immutable và boolean.",
      questions: [
        {
          type: "mcq",
          prompt: "Với s = 'Hello World!', biểu thức s[2:5] cho kết quả nào?",
          explanation: "Chỉ số bắt đầu từ 0: s[2]='l', s[3]='l', s[4]='o'. Slice dừng ngay TRƯỚC chỉ số 5 nên lấy các vị trí 2, 3, 4 → 'llo'.",
          options: [T("'ell'", false, "slice_end"), T("'llo'", true), T("'llo '", false, "slice_end"), T("'el'", false, "slice_end")],
        },
        { type: "mcq", prompt: "\"ab\" * 3 cho kết quả nào?", explanation: "Nhân chuỗi với một số nguyên lặp chuỗi đó: \"ab\" * 3 = \"ababab\".", options: [T("\"ab3\""), T("\"ababab\"", true), T("\"aaabbb\""), T("Báo TypeError")] },
        { type: "true_false", prompt: "Chuỗi trong Python là immutable — không thể gán s[0] = 'J' để đổi ký tự đầu.", explanation: "Đúng — muốn đổi phải tạo một chuỗi mới (ví dụ bằng replace hoặc nối chuỗi).", options: YES_NO(true) },
        { type: "numerical", prompt: "Giá trị của True + True là bao nhiêu?", explanation: "bool là kiểu con của int: True bằng 1, nên True + True = 2.", extra: { expected: 2, tolerance: 0.01 } },
      ],
    },
  },
  // ───────────────────────── 1.5 ─────────────────────────
  {
    key: "u05",
    file: "u05.mp4",
    title: "1.5 List",
    description: "Tạo, đánh chỉ số, thêm và xoá phần tử, sao chép và sắp xếp list.",
    skill: SKILLS.lists!,
    body:
      "## 1.5 List\n\n" +
      "**Sau đơn vị này bạn sẽ:** thao tác với list mà không rơi vào bẫy sao chép.\n\n" +
      "### Cần nhớ\n\n" +
      "- List có thứ tự, **sửa được**, cho phép trùng: `nums[0] = 99`.\n" +
      "- Thêm/xoá: `append`, `insert`, `extend`, `remove`, `pop`, `del`, `clear`.\n" +
      "- **`b = a` không tạo bản sao** — hai tên cùng trỏ tới một list. Muốn bản sao thật, dùng `a.copy()`.\n" +
      "- `a.sort()` sắp xếp tại chỗ; `sorted(a)` trả về list mới.",
    cue: {
      atSec: 161,
      q: {
        type: "mcq",
        prompt: "Cho a = [1, 2, 3], sau đó chạy b = a rồi b.append(4). Lúc này a là gì?",
        explanation: "b = a KHÔNG tạo bản sao — a và b là hai tên cho cùng một list, nên thêm 4 qua b thì a cũng thấy: [1, 2, 3, 4]. Muốn bản sao độc lập phải dùng b = a.copy().",
        options: [T("[1, 2, 3]", false, "list_alias"), T("[1, 2, 3, 4]", true), T("[4]"), T("Báo lỗi vì list là immutable")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.5 — List",
      description: "3 câu về slice, mutable và sort.",
      questions: [
        {
          type: "mcq",
          prompt: "Với nums = [1, 2, 3, 4, 5], nums[1:3] cho kết quả nào?",
          explanation: "Slice lấy các vị trí 1 và 2 (dừng trước 3): [2, 3].",
          options: [T("[1, 2, 3]", false, "slice_end"), T("[2, 3]", true), T("[2, 3, 4]", false, "slice_end"), T("[1, 2]")],
        },
        { type: "true_false", prompt: "Sau nums[0] = 99, list nums được thay đổi tại chỗ.", explanation: "Đúng — list là mutable, khác với chuỗi và tuple.", options: YES_NO(true) },
        {
          type: "mcq",
          prompt: "Điểm khác nhau giữa a.sort() và sorted(a) là gì?",
          explanation: "a.sort() sắp xếp ngay trên list a (tại chỗ) và trả về None; sorted(a) giữ nguyên a và trả về một list mới đã sắp xếp.",
          options: [T("Không khác nhau"), T("a.sort() sắp xếp tại chỗ; sorted(a) trả về list mới", true), T("sorted(a) sắp xếp tại chỗ; a.sort() trả về list mới"), T("a.sort() chỉ dùng được cho chuỗi")],
        },
      ],
    },
  },
  // ───────────────────────── 1.6 ─────────────────────────
  {
    key: "u06",
    file: "u06.mp4",
    title: "1.6 Tuple, Set, Dictionary và ép kiểu",
    description: "Ba kiểu tập hợp còn lại và cách chuyển đổi giữa các kiểu dữ liệu.",
    skill: SKILLS.collections!,
    body:
      "## 1.6 Tuple, Set, Dictionary và ép kiểu\n\n" +
      "**Sau đơn vị này bạn sẽ:** chọn đúng kiểu tập hợp cho từng bài toán.\n\n" +
      "### Cần nhớ\n\n" +
      "| Kiểu | Có thứ tự | Sửa được | Trùng lặp |\n" +
      "|---|---|---|---|\n" +
      "| List `[]` | Có | Có | Cho phép |\n" +
      "| Tuple `()` | Có | Không | Cho phép |\n" +
      "| Set `{}` | Không | Có | Không cho phép |\n" +
      "| Dict `{k: v}` | Có | Có | Khoá là duy nhất |\n\n" +
      "- Tuple một phần tử cần dấu phẩy: `(50,)`.\n" +
      "- Dictionary có thể lồng nhau: `students[\"s1\"][\"name\"]`.\n" +
      "- `int(3.99)` là 3 — `int()` cắt bỏ phần thập phân chứ không làm tròn.",
    cue: {
      atSec: 115,
      q: {
        type: "mcq",
        prompt: "print({1, 2, 3, 2, 1}) in ra gì?",
        explanation: "Set không cho phép phần tử trùng, nên các giá trị lặp bị bỏ: {1, 2, 3}.",
        options: [T("{1, 2, 3, 2, 1}"), T("{1, 2, 3}", true), T("[1, 2, 3]"), T("Báo lỗi vì có phần tử trùng")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.6 — Tuple, Set, Dictionary",
      description: "4 câu về tuple, dictionary lồng nhau và ép kiểu.",
      questions: [
        { type: "true_false", prompt: "Với t = ('physics', 'chemistry', 1997), lệnh t[0] = 'maths' báo TypeError.", explanation: "Đúng — tuple là immutable. Muốn \"đổi\" phải chuyển sang list, sửa, rồi chuyển ngược lại.", options: YES_NO(true) },
        {
          type: "mcq",
          prompt: "Cách nào tạo một tuple chỉ có MỘT phần tử là số 50?",
          explanation: "Dấu phẩy mới tạo nên tuple: (50,). Còn (50) chỉ là số 50 đặt trong ngoặc.",
          options: [T("(50)"), T("(50,)", true), T("[50]"), T("{50}")],
        },
        {
          type: "mcq",
          prompt: "Cho students = {\"s1\": {\"name\": \"Anna\", \"scores\": [8, 9, 7]}}. students[\"s1\"][\"name\"] cho kết quả nào?",
          explanation: "Đi từng tầng: students[\"s1\"] là dictionary bên trong, rồi [\"name\"] lấy giá trị \"Anna\".",
          options: [T("\"s1\""), T("\"Anna\"", true), T("[8, 9, 7]"), T("Báo KeyError")],
        },
        {
          type: "mcq",
          prompt: "int(3.99) trả về giá trị nào?",
          explanation: "int() cắt bỏ phần thập phân chứ không làm tròn (truncates, does not round), nên int(3.99) = 3. Muốn làm tròn phải dùng round().",
          options: [T("4", false, "int_rounds"), T("3", true), T("3.99"), T("Báo ValueError")],
        },
      ],
    },
  },
  // ───────────────────────── 1.7 ─────────────────────────
  {
    key: "u07",
    file: "u07.mp4",
    title: "1.7 Rẽ nhánh if / elif / else",
    description: "Điều khiển luồng chương trình bằng if, elif, else, if lồng nhau và pass.",
    skill: SKILLS.conditionals!,
    body:
      "## 1.7 Rẽ nhánh if / elif / else\n\n" +
      "**Sau đơn vị này bạn sẽ:** viết được chuỗi điều kiện và đoán đúng nhánh nào sẽ chạy.\n\n" +
      "### Cần nhớ\n\n" +
      "- Python kiểm tra từ trên xuống và chạy **nhánh đầu tiên có điều kiện đúng**; các nhánh còn lại bị bỏ qua.\n" +
      "- `else` thuộc về `if` gần nhất cùng mức thụt lề.\n" +
      "- `pass` là câu lệnh giữ chỗ, tránh lỗi cú pháp khi khối lệnh chưa viết.",
    cue: {
      atSec: 182,
      q: {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nscore = 78\nif score >= 90:\n    grade = 'A'\nelif score >= 80:\n    grade = 'B'\nelif score >= 70:\n    grade = 'C'\nelse:\n    grade = 'F'\nprint(grade)\n```",
        explanation: "Python kiểm tra lần lượt từ trên xuống và chạy nhánh đầu tiên có điều kiện đúng, các nhánh còn lại bị bỏ qua. 78 không ≥ 90, không ≥ 80, nhưng ≥ 70 nên grade = 'C'.",
        options: [T("A"), T("B"), T("C", true), T("F")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.7 — Rẽ nhánh",
      description: "3 câu về thứ tự kiểm tra, pass và else.",
      questions: [
        {
          type: "mcq",
          prompt: "Trong chuỗi if / elif / else, khi có nhiều điều kiện cùng đúng thì điều gì xảy ra?",
          explanation: "Chỉ nhánh đầu tiên có điều kiện đúng được chạy; Python bỏ qua mọi nhánh phía sau.",
          options: [T("Tất cả các nhánh đúng đều chạy"), T("Chỉ nhánh đúng đầu tiên chạy", true), T("Chỉ nhánh đúng cuối cùng chạy"), T("Python báo lỗi")],
        },
        {
          type: "mcq",
          prompt: "Câu lệnh pass dùng để làm gì?",
          explanation: "pass là câu lệnh giữ chỗ — không làm gì, nhưng giúp khối lệnh trống không gây lỗi cú pháp.",
          options: [T("Thoát khỏi chương trình"), T("Giữ chỗ cho một khối lệnh chưa viết, tránh lỗi cú pháp", true), T("Bỏ qua điều kiện phía trên"), T("In ra thông báo bỏ qua")],
        },
        { type: "true_false", prompt: "else thuộc về câu lệnh if gần nhất có cùng mức thụt lề.", explanation: "Đúng — mức thụt lề quyết định else ghép với if nào khi có if lồng nhau.", options: YES_NO(true) },
      ],
    },
  },
  // ───────────────────────── 1.8 ─────────────────────────
  {
    key: "u08",
    file: "u08.mp4",
    title: "1.8 Vòng lặp for và while",
    description: "Lặp với range, lặp qua chuỗi, break/continue/else, vòng lặp lồng nhau và while.",
    skill: SKILLS.loops!,
    body:
      "## 1.8 Vòng lặp for và while\n\n" +
      "**Sau đơn vị này bạn sẽ:** chọn đúng loại vòng lặp và dự đoán chính xác nó chạy bao nhiêu lần.\n\n" +
      "### Cần nhớ\n\n" +
      "- `range(start, end, step)` **dừng ngay trước `end`**: `range(2, 6)` là 2, 3, 4, 5.\n" +
      "- `break` thoát vòng lặp; `continue` bỏ qua lượt hiện tại.\n" +
      "- `else` sau vòng lặp chỉ chạy nếu vòng lặp **không** bị `break`.\n" +
      "- `for` khi biết trước số lượt; `while` khi lặp tới lúc một điều kiện sai.",
    cue: {
      atSec: 206,
      q: {
        type: "mcq",
        prompt: "Vòng lặp `for i in range(2, 6): print(i)` in ra dãy số nào?",
        explanation: "range(start, end) dừng ngay TRƯỚC end, nên range(2, 6) sinh 2, 3, 4, 5 — không có 6.",
        options: [T("2 3 4 5 6", false, "range_end"), T("2 3 4 5", true), T("3 4 5 6", false, "range_end"), T("2 3 4 5 6 7", false, "range_end")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.8 — Vòng lặp",
      description: "4 câu về while, else, break/continue và range có bước nhảy.",
      questions: [
        {
          type: "mcq",
          prompt: "Đoạn code sau in ra gì?\n\n```python\ni = 1\nwhile i < 6:\n    print(i)\n    i += 1\n```",
          explanation: "Vòng while chạy chừng nào i < 6 còn đúng. i chạy từ 1 tới 5; khi i = 6 điều kiện sai nên dừng, 6 không được in.",
          options: [T("1 2 3 4 5", true), T("1 2 3 4 5 6", false, "range_end"), T("0 1 2 3 4 5"), T("Chạy vô hạn")],
        },
        { type: "true_false", prompt: "Khối else gắn với vòng for vẫn chạy khi vòng lặp bị thoát bằng break.", explanation: "Sai — else của vòng lặp chỉ chạy khi vòng lặp kết thúc bình thường, không bị break.", options: YES_NO(false) },
        {
          type: "mcq",
          prompt: "Điểm khác nhau giữa break và continue là gì?",
          explanation: "break thoát hẳn khỏi vòng lặp; continue chỉ bỏ qua phần còn lại của lượt hiện tại rồi sang lượt kế tiếp.",
          options: [T("break bỏ qua lượt hiện tại; continue thoát vòng lặp"), T("break thoát vòng lặp; continue bỏ qua lượt hiện tại", true), T("Hai câu lệnh giống nhau"), T("break chỉ dùng trong while")],
        },
        {
          type: "mcq",
          prompt: "range(2, 20, 3) sinh dãy nào?",
          explanation: "Bắt đầu từ 2, mỗi lần cộng 3, dừng trước 20: 2, 5, 8, 11, 14, 17.",
          options: [T("2 5 8 11 14 17", true), T("2 5 8 11 14 17 20", false, "range_end"), T("3 6 9 12 15 18"), T("2 3 4 ... 19")],
        },
      ],
    },
  },
  // ───────────────────────── 1.9 ─────────────────────────
  {
    key: "u09",
    file: "u09.mp4",
    title: "1.9 Hàm",
    description: "Định nghĩa và gọi hàm, tham số mặc định, *args/**kwargs, lambda và phạm vi biến.",
    skill: SKILLS.functions!,
    body:
      "## 1.9 Hàm\n\n" +
      "**Sau đơn vị này bạn sẽ:** đóng gói một việc thành hàm tái sử dụng được và hiểu biến sống ở đâu.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Parameter** là tên trong định nghĩa; **argument** là giá trị lúc gọi.\n" +
      "- Tham số mặc định: `def power(base, exp=2)`.\n" +
      "- `*args` gom đối số vị trí thừa vào một **tuple**; `**kwargs` gom đối số có tên vào một **dict**.\n" +
      "- `lambda x: x ** 2` là hàm ẩn danh một dòng.\n" +
      "- Gán trong hàm tạo biến **local** mới; muốn đổi biến ngoài phải khai báo `global`.",
    cue: {
      atSec: 184,
      q: {
        type: "mcq",
        prompt: "Cho `def power(base, exp=2): return base ** exp`. Lời gọi power(3) trả về bao nhiêu?",
        explanation: "exp có giá trị mặc định 2, nên khi không truyền exp thì dùng 2: 3 ** 2 = 9. power(3, 3) mới cho 27.",
        options: [T("6"), T("9", true), T("27"), T("Báo lỗi vì thiếu đối số exp")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.9 — Hàm",
      description: "4 câu về phạm vi biến, *args, lambda và tham số.",
      questions: [
        {
          type: "mcq",
          prompt: "Đoạn code sau in ra gì?\n\n```python\nx = 10\n\ndef change():\n    x = 99\n\nchange()\nprint(x)\n```",
          explanation: "Gán x = 99 bên trong hàm tạo một biến local mới cũng tên x, không đụng tới x bên ngoài, nên print(x) vẫn in 10. Muốn đổi biến bên ngoài phải khai báo global x trong hàm.",
          options: [T("99", false, "scope_leak"), T("10", true), T("None"), T("Báo NameError", false, "scope_leak")],
        },
        {
          type: "mcq",
          prompt: "Trong định nghĩa `def total(*numbers)`, khi gọi total(1, 2, 3) thì numbers là gì?",
          explanation: "*args gom các đối số vị trí thừa vào một tuple, nên numbers = (1, 2, 3). Còn **kwargs mới gom các đối số có tên vào một dictionary.",
          options: [T("Một list [1, 2, 3]"), T("Một tuple (1, 2, 3)", true), T("Một dictionary"), T("Chỉ giá trị đầu tiên là 1")],
        },
        { type: "numerical", prompt: "Cho square = lambda x: x ** 2. Giá trị của square(5) là bao nhiêu?", explanation: "lambda x: x ** 2 là hàm bình phương: 5 ** 2 = 25.", extra: { expected: 25, tolerance: 0.01 } },
        {
          type: "mcq",
          prompt: "Trong `def area(width, height)` và lời gọi `area(3, 4)`, số 3 và 4 được gọi là gì?",
          explanation: "width và height là parameter (tên trong định nghĩa); 3 và 4 là argument (giá trị truyền lúc gọi).",
          options: [T("Parameter"), T("Argument", true), T("Attribute"), T("Return value")],
        },
      ],
    },
  },
  // ───────────────────────── 1.10 ─────────────────────────
  {
    key: "u10",
    file: "u10.mp4",
    title: "1.10 Lớp và đối tượng",
    description: "Class là bản thiết kế, object là thực thể; __init__, self, thuộc tính riêng và dùng chung.",
    skill: SKILLS.classes!,
    body:
      "## 1.10 Lớp và đối tượng\n\n" +
      "**Sau đơn vị này bạn sẽ:** viết được một class đơn giản và tạo nhiều object từ nó.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Class** là bản thiết kế; **object** (instance) là thực thể cụ thể tạo từ class.\n" +
      "- `__init__` là constructor; `self` là chính object đang gọi phương thức.\n" +
      "- **Instance attribute** (`self.name`) là riêng từng object; **class attribute** (`Student.university`) dùng chung cho mọi object.\n" +
      "- `anna.status()` được Python hiểu là `Student.status(anna)`.",
    cue: {
      atSec: 137,
      q: {
        type: "mcq",
        prompt: "Trong lập trình hướng đối tượng, class và object khác nhau thế nào?",
        explanation: "Class là bản thiết kế mô tả object có dữ liệu gì và làm được gì; object (instance) là một thực thể cụ thể được tạo từ class đó.",
        options: [T("Class là một thực thể cụ thể, object là bản thiết kế"), T("Class là bản thiết kế, object là thực thể cụ thể tạo từ nó", true), T("Hai khái niệm này giống hệt nhau"), T("Class chỉ chứa hàm, object chỉ chứa biến")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.10 — Lớp và đối tượng",
      description: "3 câu về thuộc tính riêng, constructor và self.",
      questions: [
        {
          type: "mcq",
          prompt: "Có hai object `anna = Student(\"Anna\", 3.8)` và `binh = Student(\"Binh\", 2.9)`. Sau khi chạy `anna.name = \"Anna Nguyen\"`, giá trị `binh.name` là gì?",
          explanation: "name là instance attribute — mỗi object giữ bản riêng, nên đổi anna.name không ảnh hưởng binh. Chỉ class attribute (như Student.university) mới dùng chung cho mọi object.",
          options: [T("\"Anna Nguyen\"", false, "attr_shared"), T("\"Binh\" — không đổi", true), T("None", false, "attr_shared"), T("Báo lỗi vì không được gán lại thuộc tính")],
        },
        {
          type: "fill_in",
          prompt: "Phương thức đặc biệt được gọi tự động khi tạo một object mới từ class (hàm dựng / constructor) có tên là gì?",
          explanation: "__init__ là constructor của class trong Python; self là tham số đầu tiên, chỉ chính object đang được tạo.",
          options: [T("__init__", true), T("init", true)],
        },
        {
          type: "mcq",
          prompt: "Lời gọi anna.status() thực chất được Python hiểu như thế nào?",
          explanation: "Python truyền object vào làm đối số đầu tiên: anna.status() tương đương Student.status(anna). Vì thế phương thức có tham số self.",
          options: [T("Student.status()"), T("Student.status(anna)", true), T("status(Student)"), T("anna = Student.status")],
        },
      ],
    },
  },
  // ───────────────────────── 1.11 ─────────────────────────
  {
    key: "u11",
    file: "u11.mp4",
    title: "1.11 Kế thừa, đóng gói và đa hình",
    description: "Ba trụ cột của OOP: dùng lại code của lớp cha, bảo vệ dữ liệu bên trong, và cùng một tên phương thức cho hành vi khác nhau.",
    skill: SKILLS.oop!,
    body:
      "## 1.11 Kế thừa, đóng gói và đa hình\n\n" +
      "**Sau đơn vị này bạn sẽ:** phân biệt được ba khái niệm hay bị nhầm nhất của OOP.\n\n" +
      "### Cần nhớ\n\n" +
      "| Khái niệm | Ý nghĩa | Ví dụ trong bài |\n" +
      "|---|---|---|\n" +
      "| **Kế thừa** | Lớp con dùng lại mọi thứ của lớp cha, có thể thêm hoặc ghi đè (quan hệ \"is-a\") | `class Dog(Animal)` |\n" +
      "| **Đóng gói** | Bảo vệ dữ liệu bên trong khỏi bị sửa tuỳ tiện | `self.__balance` + `deposit()` |\n" +
      "| **Đa hình** | Cùng tên phương thức, hành vi khác nhau tuỳ đối tượng | `speak()` của Dog, Cat, Cow |\n\n" +
      "Dùng `super()` để **mở rộng** phương thức của lớp cha thay vì thay thế hoàn toàn.",
    cue: {
      atSec: 99,
      q: {
        type: "mcq",
        prompt: "Trong class BankAccount, số dư được lưu ở self.__balance và chỉ đổi qua deposit() (từ chối số tiền không dương). Đóng gói ở đây nhằm mục đích gì?",
        explanation: "Đóng gói (encapsulation) bảo vệ dữ liệu bên trong object khỏi bị sửa tuỳ tiện: mọi thay đổi phải đi qua phương thức có kiểm tra hợp lệ.",
        options: [T("Cho lớp con dùng lại code của lớp cha"), T("Bảo vệ dữ liệu bên trong khỏi bị sửa tuỳ tiện", true), T("Để cùng một tên phương thức cho nhiều hành vi"), T("Để chương trình chạy nhanh hơn")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.11 — Ba trụ cột của OOP",
      description: "3 câu phân biệt kế thừa, đa hình và cách dùng super().",
      questions: [
        {
          type: "mcq",
          prompt: "Dog, Cat và Cow đều có phương thức speak(), nhưng mỗi lớp cho ra một kết quả khác (Woof!, Meow!, Moo!). Vòng lặp `for a in animals: print(a.name, 'says', a.speak())` minh hoạ khái niệm nào?",
          explanation: "Cùng một tên phương thức nhưng hành vi khác nhau tuỳ đối tượng là đa hình (polymorphism). Kế thừa là việc lớp con dùng lại code của lớp cha; đóng gói là bảo vệ dữ liệu bên trong object.",
          options: [T("Kế thừa (inheritance)", false, "inherit_vs_poly"), T("Đóng gói (encapsulation)"), T("Đa hình (polymorphism)", true), T("Hàm lambda")],
        },
        {
          type: "mcq",
          prompt: "Với `class Dog(Animal)`, phát biểu nào đúng?",
          explanation: "Dog kế thừa từ Animal: quan hệ 'is-a' (Dog là một Animal), Dog dùng lại mọi thứ của Animal và có thể thêm hoặc ghi đè (override) phần riêng, ví dụ speak().",
          options: [T("Animal kế thừa từ Dog"), T("Dog là lớp con, kế thừa thuộc tính và phương thức của Animal", true), T("Hai lớp độc lập, không liên quan gì tới nhau"), T("Dog là một object của Animal", false, "inherit_vs_poly")],
        },
        {
          type: "mcq",
          prompt: "Khi nào nên dùng super() trong một lớp con?",
          explanation: "super() cho phép gọi phương thức của lớp cha để mở rộng nó, thay vì thay thế hoàn toàn.",
          options: [T("Để xoá phương thức của lớp cha"), T("Để mở rộng phương thức của lớp cha thay vì thay thế hoàn toàn", true), T("Để tạo một object mới"), T("Để tạo biến toàn cục")],
        },
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

/** Length of a clip in whole seconds, read from the file itself. */
function durationOf(filePath: string): number {
  const out = execFileSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", filePath],
    { encoding: "utf8" },
  );
  const sec = Math.round(parseFloat(out));
  if (!Number.isFinite(sec) || sec <= 0) throw new Error(`cannot read duration: ${filePath}`);
  return sec;
}

async function uploadVideo(filePath: string, ownerId: string) {
  const buf = await readFile(filePath);
  if (buf.byteLength === 0) throw new Error(`empty file: ${filePath}`);
  if (buf.byteLength > MAX_VIDEO_BYTES) {
    throw new Error(`too large (${buf.byteLength}B): ${filePath}`);
  }
  const now = new Date();
  const filename = `${ownerId}-${now.getTime()}-${randomBytes(8).toString("hex")}.mp4`;
  const key = lessonVideoKey(now, filename);
  await storageFor(key).put(key.key, buf, "video/mp4");
  return { url: `/api/lesson-media/videos/${filename}`, mb: buf.byteLength / 1024 / 1024 };
}

/** skill code -> id */
const skillIds = new Map<string, string>();
const misIds = new Map<string, string>();

async function ensureSkills() {
  for (const s of Object.values(SKILLS)) {
    const found = await prisma.skill.findUnique({ where: { code: s.code } });
    skillIds.set(s.code, found?.id ?? (await createSkill(s, prisma)).skillId);
  }
}

async function ensureMisconceptions() {
  for (const [key, m] of Object.entries(MISCONCEPTIONS)) {
    // upsert rather than createMisconception — the service throws on duplicates.
    const row = await prisma.misconception.upsert({
      where: { code: m.code },
      update: { name: m.name, description: m.description },
      create: m,
    });
    misIds.set(key, row.id);
  }
}

function skillIdOf(code: string): string {
  const id = skillIds.get(code);
  if (!id) throw new Error(`unknown skill: ${code}`);
  return id;
}

/** Map our question shape onto CreateQuestionInput. */
function toQuestionInput(q: Q, orderIndex: number, skillCode: string) {
  const options = q.options?.map((o) => ({
    label: o.label,
    // `ordering` grades by orderIndex and `matching` by extra.pairKey — for both
    // the service still wants the flag, and false is the documented convention.
    isCorrect: o.correct ?? false,
    ...(o.mis ? { misconceptionId: misIds.get(o.mis) } : {}),
    ...(o.extra ? { extra: o.extra } : {}),
  }));
  return {
    type: q.type,
    prompt: rich(q.prompt),
    ...(q.explanation ? { explanation: q.explanation } : {}),
    points: q.points ?? 1,
    orderIndex,
    ...(options ? { options } : {}),
    ...(q.extra ? { extra: q.extra } : {}),
    skillIds: [skillIdOf(skillCode)],
  };
}

/**
 * Open a slot at `insertAt` by shifting later lessons down one. Highest first
 * because (moduleId, orderIndex) is unique and checked per statement. Does
 * nothing when the slot is already free.
 */
async function openSlot(moduleId: string, insertAt: number) {
  const occupied = await prisma.lesson.findFirst({
    where: { moduleId, orderIndex: insertAt },
    select: { id: true },
  });
  if (!occupied) return;
  const siblings = await prisma.lesson.findMany({
    where: { moduleId, orderIndex: { gte: insertAt } },
    orderBy: { orderIndex: "desc" },
    select: { id: true, orderIndex: true },
  });
  for (const s of siblings) {
    await prisma.lesson.update({ where: { id: s.id }, data: { orderIndex: s.orderIndex + 1 } });
  }
}

/**
 * Prompts render through plainToRichHtml, which keeps HTML as-is but turns
 * plain text into <p>/<br> — so markdown fences would show up literally and
 * indentation would collapse. Convert backtick code to real <pre>/<code>.
 */
function rich(text: string): string {
  if (!text.includes("`")) return text;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const parts = text.split(/```(?:\w+)?\n([\s\S]*?)```/);
  // split() with one capture group alternates: text, code, text, code, ...
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

function fmt(sec: number) {
  return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, "0")}`;
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const dir = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!dir) {
    console.error("usage: seed-pds-lectures.ts <video-dir> [--dry-run]");
    process.exit(1);
  }
  for (const f of [OVERVIEW.file, ...UNITS.map((u) => u.file)]) {
    if (!existsSync(join(dir, f))) throw new Error(`missing video: ${f}`);
  }
  for (const u of UNITS) {
    const dur = durationOf(join(dir, u.file));
    if (u.cue.atSec >= dur - 5) {
      throw new Error(`${u.title}: cuepoint ${u.cue.atSec}s is not inside the ${dur}s clip`);
    }
  }

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  const mod = await prisma.module.findFirst({
    where: { courseId: course.id },
    orderBy: { orderIndex: "asc" },
  });
  if (!mod) throw new Error("course has no module");

  if (dryRun) {
    console.log("DRY RUN\n");
    console.log(`Module: ${mod.title}`);
    console.log(`\n"${OVERVIEW.title}" <- ${OVERVIEW.file}`);
    let total = 0;
    for (const u of UNITS) {
      const dur = durationOf(join(dir, u.file));
      total += dur;
      console.log(
        `\n"${u.title}" <- ${u.file} (${fmt(dur)})` +
          `\n  cuepoint: ${fmt(u.cue.atSec)}  quiz: ${u.quiz.questions.length} câu (${[...new Set(u.quiz.questions.map((q) => q.type))].join(", ")})`,
      );
    }
    console.log(`\n"${CAPSTONE.title}" (bài tập, không video)`);
    console.log(`\nTổng: ${UNITS.length} đơn vị, ${fmt(total)} video, ${UNITS.length} cuepoint`);
    return;
  }

  await ensureSkills();
  await ensureMisconceptions();
  console.log(`skills: ${skillIds.size}, misconceptions: ${misIds.size}`);

  // ── Course Overview: first lesson, with the intro video ────────────────
  let overview = await prisma.lesson.findFirst({
    where: { title: OVERVIEW.title, moduleId: mod.id },
    include: { contentItems: { select: { type: true } } },
  });
  if (overview?.contentItems.some((c) => c.type === "video")) {
    console.log("Course Overview: already built — skip");
  } else {
    // Upload first: if the transfer dies, the worst case is an orphan blob the
    // sweep collects — not a half-built lesson on a live course.
    const up = await uploadVideo(join(dir, OVERVIEW.file), actor);
    if (!overview) {
      await openSlot(mod.id, 0);
      const { lessonId } = await createLesson(
        actor,
        mod.id,
        { title: OVERVIEW.title, orderIndex: 0, description: OVERVIEW.description },
        prisma,
      );
      await createContentItem(actor, lessonId, { type: "markdown", payload: { body: OVERVIEW.body }, orderIndex: 0 }, prisma);
      await tagLessonSkill(actor, lessonId, { skillId: skillIdOf(SKILLS.overview!.code) }, prisma);
      overview = await prisma.lesson.findUniqueOrThrow({
        where: { id: lessonId },
        include: { contentItems: { select: { type: true } } },
      });
    }
    await createContentItem(
      actor,
      overview.id,
      { type: "video", payload: { url: up.url, durationSec: durationOf(join(dir, OVERVIEW.file)) }, orderIndex: 1 },
      prisma,
    );
    console.log(`Course Overview <- ${OVERVIEW.file} (${up.mb.toFixed(1)} MB)`);
  }

  // ── Units, one after another straight after the overview ───────────────
  let prevTitle = OVERVIEW.title;
  for (const u of UNITS) {
    const existing = await prisma.lesson.findFirst({
      where: { moduleId: mod.id, title: u.title },
      include: { contentItems: { select: { type: true } } },
    });
    if (existing?.contentItems.some((c) => c.type === "video")) {
      console.log(`skip (already built): ${u.title}`);
      prevTitle = u.title;
      continue;
    }
    if (existing) {
      throw new Error(
        `"${u.title}" exists without a video — a previous run stopped midway. Delete it (scripts/delete-lesson.ts) and rerun.`,
      );
    }

    const filePath = join(dir, u.file);
    const up = await uploadVideo(filePath, actor);
    const durationSec = durationOf(filePath);

    const anchor = await prisma.lesson.findFirstOrThrow({
      where: { moduleId: mod.id, title: prevTitle },
      select: { orderIndex: true },
    });
    const orderIndex = anchor.orderIndex + 1;
    await openSlot(mod.id, orderIndex);

    const { lessonId } = await createLesson(
      actor,
      mod.id,
      { title: u.title, orderIndex, description: u.description },
      prisma,
    );

    // 1. Reading
    await createContentItem(actor, lessonId, { type: "markdown", payload: { body: u.body }, orderIndex: 0 }, prisma);

    // 2. Cuepoint quiz must exist before the video payload can reference it —
    //    both must land in the same run, or the orphan sweep on the next
    //    content save would collect it.
    const { quizId: cueQuizId } = await createCuepointQuiz(
      actor,
      lessonId,
      {
        atSec: u.cue.atSec,
        question: {
          type: u.cue.q.type,
          prompt: rich(u.cue.q.prompt),
          ...(u.cue.q.explanation ? { explanation: u.cue.q.explanation } : {}),
          points: 1,
          options: u.cue.q.options?.map((o) => ({
            label: o.label,
            isCorrect: o.correct ?? false,
            ...(o.mis ? { misconceptionId: misIds.get(o.mis) } : {}),
          })),
          skillIds: [skillIdOf(u.skill.code)],
        },
      },
      prisma,
    );

    // 3. Video carrying the cuepoint
    await createContentItem(
      actor,
      lessonId,
      {
        type: "video",
        payload: { url: up.url, durationSec, cuepoints: [{ atSec: u.cue.atSec, quizId: cueQuizId }] },
        orderIndex: 1,
      },
      prisma,
    );

    // 4. End-of-unit quiz
    const { quizId } = await createQuiz(
      actor,
      { courseId: course.id, lessonId },
      {
        title: u.quiz.title,
        description: u.quiz.description,
        passThresholdPct: 70,
        maxAttempts: 5,
        requireConfidence: true,
      },
      prisma,
    );
    for (const [i, q] of u.quiz.questions.entries()) {
      await createQuestion(actor, quizId, toQuestionInput(q, i, u.skill.code), prisma);
    }

    // 5. Skill tag (publish gate needs every lesson tagged)
    await tagLessonSkill(actor, lessonId, { skillId: skillIdOf(u.skill.code) }, prisma);

    console.log(
      `[${orderIndex}] "${u.title}" — ${fmt(durationSec)}, ${up.mb.toFixed(1)} MB, ` +
        `1 cuepoint, ${u.quiz.questions.length} câu quiz`,
    );
    prevTitle = u.title;
  }

  // ── Capstone: practice assignment, no video ────────────────────────────
  const capstone = await prisma.lesson.findFirst({ where: { moduleId: mod.id, title: CAPSTONE.title } });
  if (capstone) {
    console.log(`skip (already built): ${CAPSTONE.title}`);
  } else {
    const anchor = await prisma.lesson.findFirstOrThrow({
      where: { moduleId: mod.id, title: prevTitle },
      select: { orderIndex: true },
    });
    const orderIndex = anchor.orderIndex + 1;
    await openSlot(mod.id, orderIndex);
    const { lessonId } = await createLesson(
      actor,
      mod.id,
      { title: CAPSTONE.title, orderIndex, description: CAPSTONE.description },
      prisma,
    );
    await createContentItem(actor, lessonId, { type: "markdown", payload: { body: CAPSTONE.body }, orderIndex: 0 }, prisma);
    await createAssignment(
      actor,
      lessonId,
      {
        title: CAPSTONE.assignment.title,
        description: CAPSTONE.assignment.description,
        pedagogicalIntent: CAPSTONE.assignment.pedagogicalIntent,
        responseFormat: CAPSTONE.assignment.responseFormat,
        assessmentModes: ["instructor_graded", "self_assessed"],
        requireSelfRating: true,
        requireReflection: true,
        maxScore: 100,
      },
      prisma,
    );
    await tagLessonSkill(actor, lessonId, { skillId: skillIdOf(SKILLS.capstone!.code) }, prisma);
    console.log(`[${orderIndex}] "${CAPSTONE.title}" — 1 bài tập`);
  }

  // Publish gate sanity check.
  const tagged = await prisma.contentSkillMapping.findMany({
    where: { contentType: "lesson" },
    select: { contentId: true },
  });
  const untagged = await prisma.lesson.count({
    where: { module: { courseId: course.id }, id: { notIn: tagged.map((t) => t.contentId) } },
  });
  console.log(`\nUntagged lessons: ${untagged} (phải là 0 để publish được)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
