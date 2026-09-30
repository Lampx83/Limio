/**
 * Turn the six placeholder lessons of "Programming for Data Science" Modules 2
 * and 3 into real lessons.
 *
 * The course was seeded from the syllabus, so these lessons held only a list of
 * learning outcomes and a reference. There is no recorded video for these
 * modules yet, so this fills them with what can be written and verified without
 * one: a full reading per lesson, an end-of-lesson quiz, and a practice
 * assignment closing each module.
 *
 *   NumPy Arrays                          reading + quiz (6)
 *   Pandas DataFrames                     reading + quiz (6)
 *   Data Cleaning and Transformation      reading + quiz (6)
 *   Aggregation and EDA in Jupyter        reading + quiz (6) + practice assignment (Module 2)
 *   Retrieving Data via RESTful APIs      reading + quiz (6)
 *   Web Scraping with BeautifulSoup       reading + quiz (6) + practice assignment (Module 3)
 *
 * Readings and assignment briefs live in scripts/content/pds-m23/*.md. Every code
 * block in them, and every expected value used in the quizzes below, was run
 * against real numpy / pandas / BeautifulSoup before being written down.
 *
 *   tsx scripts/seed-pds-modules23.ts [--dry-run]
 *
 * Idempotent: a lesson that already has an end-of-lesson quiz is skipped whole.
 * Only the reading's text is overwritten (by design — that is what this is for);
 * nothing is deleted.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "@feedbackme/db";
import {
  createQuiz,
  createQuestion,
  createAssignment,
  updateContentItem,
} from "@feedbackme/core-lms";

const COURSE_SLUG = "programming-for-data-science";
const CONTENT_DIR = join(__dirname, "content", "pds-m23");

// ─────────────────────────────────────────────────────────────────────────
// Types
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
  options?: Opt[];
  extra?: Record<string, unknown>;
}

interface LessonPlan {
  match: string; // lesson title prefix inside the course
  file: string;
  skillCode: string;
  quizTitle: string;
  quizDescription: string;
  questions: Q[];
  assignment?: {
    file: string;
    title: string;
    pedagogicalIntent: "enacting";
    responseFormat: "mixed";
  };
}

const T = (label: string, correct?: boolean, mis?: string): Opt => ({
  label,
  ...(correct ? { correct } : {}),
  ...(mis ? { mis } : {}),
});
const YES_NO = (yes: boolean): Opt[] => [T("Đúng", yes), T("Sai", !yes)];

// ─────────────────────────────────────────────────────────────────────────
// Misconceptions
// ─────────────────────────────────────────────────────────────────────────

const MISCONCEPTIONS: Record<string, { code: string; name: string; description: string }> = {
  np_list_arith: {
    code: "np_list_multiplication",
    name: "Tưởng * trên list nhân từng phần tử",
    description:
      "Học viên nhầm list Python với mảng NumPy: với list, * lặp danh sách; chỉ mảng NumPy mới nhân từng phần tử.",
  },
  np_axis_swap: {
    code: "np_axis_swap",
    name: "Nhầm axis=0 với axis=1",
    description:
      "Học viên đảo hai trục: axis=0 gộp các hàng (kết quả theo cột), axis=1 gộp các cột (kết quả theo hàng).",
  },
  pd_loc_iloc: {
    code: "pd_loc_vs_iloc",
    name: "Nhầm loc (nhãn) với iloc (vị trí)",
    description:
      "Học viên dùng nhầm loc và iloc, quên rằng loc theo nhãn và cắt lát gồm cả đầu mút cuối, còn iloc theo vị trí và không gồm đầu mút cuối.",
  },
  pd_series_df: {
    code: "pd_series_vs_dataframe",
    name: "Nhầm Series với DataFrame khi chọn cột",
    description:
      "Học viên không phân biệt df['a'] (Series) với df[['a']] (DataFrame).",
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
  http_get_post: {
    code: "http_get_vs_post",
    name: "Nhầm GET với POST",
    description:
      "Học viên nhầm GET (lấy dữ liệu, không đổi trạng thái) với POST (gửi dữ liệu để tạo mới).",
  },
  bs_class_exact: {
    code: "bs_class_selector_exact",
    name: "Tưởng li.item chỉ khớp phần tử có đúng một class",
    description:
      "Học viên cho rằng bộ chọn li.item bỏ qua phần tử có thêm class khác, trong khi một phần tử nhiều class khớp với từng class của nó.",
  },
  bs_find_all: {
    code: "bs_find_returns_list",
    name: "Nhầm find với find_all",
    description:
      "Học viên cho rằng find trả về list rỗng khi không thấy, trong khi find trả về None còn find_all mới trả về list.",
  },
  scrape_rules: {
    code: "scrape_ignoring_rules",
    name: "Bỏ qua robots.txt và điều khoản khi scrape",
    description:
      "Học viên coi việc lấy được HTML là đủ để thu thập dữ liệu, không kiểm tra robots.txt và điều khoản sử dụng của trang.",
  },
};

// ─────────────────────────────────────────────────────────────────────────
// Content
// ─────────────────────────────────────────────────────────────────────────

const DF_DEF =
  "```python\nimport pandas as pd\n\ndf = pd.DataFrame({\n    \"name\":  [\"An\", \"Binh\", \"Chi\", \"Dung\", \"Em\"],\n    \"major\": [\"IT\", \"IT\", \"Econ\", \"Econ\", \"IT\"],\n    \"score\": [8.5, 7.0, 9.0, 6.5, 7.5],\n})\n```";

const SALES_DEF =
  "```python\nimport pandas as pd\n\nsales = pd.DataFrame({\n    \"region\":  [\"N\", \"S\", \"N\", \"S\", \"N\", \"C\"],\n    \"product\": [\"A\", \"A\", \"B\", \"B\", \"A\", \"B\"],\n    \"revenue\": [100, 150, 200, 50, 300, 120],\n})\n```";

const SOUP_DEF =
  "```python\nfrom bs4 import BeautifulSoup\n\nhtml = \"\"\"<ul id=\"items\">\n<li class=\"item\"><a href=\"/p/1\">Pen</a> <span class=\"price\">3.5</span></li>\n<li class=\"item\"><a href=\"/p/2\">Book</a> <span class=\"price\">12</span></li>\n<li class=\"item sale\"><a href=\"/p/3\">Bag</a> <span class=\"price\">20</span></li>\n</ul>\"\"\"\nsoup = BeautifulSoup(html, \"html.parser\")\n```";

const M_DEF = "```python\nimport numpy as np\n\nm = np.array([[1, 2, 3],\n              [4, 5, 6]])\n```";

const PLANS: LessonPlan[] = [
  // ───────────────────────── NumPy ─────────────────────────
  {
    match: "NumPy Arrays",
    file: "numpy.md",
    skillCode: "pds.numpy.arrays",
    quizTitle: "Kiểm tra — NumPy Arrays",
    quizDescription: "6 câu về mảng, chỉ số, tính toán theo mảng, lọc và axis.",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nimport numpy as np\n\na = np.array([1, 2, 3])\nprint(a * 2)\n```",
        explanation: "Với mảng NumPy, * nhân từng phần tử nên kết quả là [2 4 6]. Nếu a là list Python thông thường thì [1, 2, 3] * 2 mới lặp danh sách thành [1, 2, 3, 1, 2, 3].",
        options: [T("[2 4 6]", true), T("[1, 2, 3, 1, 2, 3]", false, "np_list_arith"), T("[1 2 3 2]"), T("Báo TypeError")],
      },
      {
        type: "mcq",
        prompt: "`np.arange(12).reshape(3, 4).shape` cho kết quả nào?",
        explanation: "reshape(3, 4) xếp 12 phần tử thành 3 hàng, 4 cột nên shape là (3, 4).",
        options: [T("(3, 4)", true), T("(4, 3)"), T("(12,)"), T("(3, 4, 1)")],
      },
      {
        type: "numerical",
        prompt: `${M_DEF}\n\nGiá trị của m[1, 2] là bao nhiêu?`,
        explanation: "m[hàng, cột]: hàng 1 là [4, 5, 6], cột 2 của hàng đó là 6 (chỉ số đếm từ 0).",
        extra: { expected: 6, tolerance: 0.01 },
      },
      {
        type: "mcq",
        prompt: `${M_DEF}\n\n\`print(m.sum(axis=0))\` in ra gì?`,
        explanation: "axis=0 gộp các hàng lại nên có một tổng cho mỗi cột: [1+4, 2+5, 3+6] = [5 7 9]. axis=1 mới cho tổng mỗi hàng: [ 6 15].",
        options: [T("[5 7 9]", true), T("[ 6 15]", false, "np_axis_swap"), T("21"), T("[[5 7 9]]")],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nb = np.array([5, 1, 4, 2, 3])\nprint(b[b > 2])\n```",
        explanation: "b > 2 tạo mặt nạ boolean, rồi b[mặt_nạ] giữ lại các phần tử ứng với True: 5, 4 và 3 (giữ nguyên thứ tự ban đầu).",
        options: [T("[5 4 3]", true), T("[ True False  True False  True]"), T("[1 2]"), T("[5 1 4 2 3]")],
      },
      {
        type: "true_false",
        prompt: "`np.array([1, 2, 3]) + 10` cho kết quả [11 12 13] nhờ broadcasting: số 10 được áp cho từng phần tử.",
        explanation: "Đúng — broadcasting cho phép cộng một số với cả mảng mà không cần vòng lặp.",
        options: YES_NO(true),
      },
    ],
  },
  // ───────────────────────── Pandas ─────────────────────────
  {
    match: "Pandas DataFrames",
    file: "pandas.md",
    skillCode: "pds.pandas.dataframes",
    quizTitle: "Kiểm tra — Pandas DataFrames",
    quizDescription: "6 câu về shape, lọc, loc/iloc và chọn cột.",
    questions: [
      {
        type: "mcq",
        prompt: `${DF_DEF}\n\n\`df.shape\` cho kết quả nào?`,
        explanation: "shape là (số hàng, số cột): bảng có 5 học viên và 3 cột nên là (5, 3).",
        options: [T("(5, 3)", true), T("(3, 5)"), T("15"), T("5")],
      },
      {
        type: "numerical",
        prompt: `${DF_DEF}\n\n\`len(df[df["score"] >= 7.5])\` là bao nhiêu?`,
        explanation: "Các điểm ≥ 7.5 là 8.5 (An), 9.0 (Chi) và 7.5 (Em): 3 hàng.",
        extra: { expected: 3, tolerance: 0.01 },
      },
      {
        type: "mcq",
        prompt: `${DF_DEF}\n\n\`df.set_index("name").loc["Chi", "score"]\` cho kết quả nào?`,
        explanation: "loc chọn theo nhãn. Sau khi đặt name làm nhãn hàng, loc[\"Chi\", \"score\"] lấy điểm của Chi là 9.0. 8.5 là điểm của An (hàng ở vị trí 0, thứ mà iloc[0] sẽ lấy).",
        options: [T("9.0", true), T("8.5", false, "pd_loc_iloc"), T("\"Chi\""), T("Báo KeyError")],
      },
      {
        type: "mcq",
        prompt: `${DF_DEF}\n\n\`df.loc[0:2, "name"].tolist()\` cho kết quả nào?`,
        explanation: "Cắt lát của loc theo nhãn và GỒM cả nhãn cuối, nên lấy các nhãn 0, 1, 2: ['An', 'Binh', 'Chi']. Chỉ iloc[0:2] mới dừng trước vị trí 2.",
        options: [T("['An', 'Binh', 'Chi']", true), T("['An', 'Binh']", false, "pd_loc_iloc"), T("['Binh', 'Chi']"), T("['An', 'Chi']")],
      },
      {
        type: "mcq",
        prompt: `${DF_DEF}\n\nKết quả của \`df[["score"]]\` (hai cặp ngoặc vuông) thuộc kiểu nào?`,
        explanation: "Đưa vào một list tên cột thì kết quả luôn là DataFrame, dù list chỉ có một cột. Chỉ df[\"score\"] (một cặp ngoặc) mới trả về Series.",
        options: [T("DataFrame", true), T("Series", false, "pd_series_df"), T("list"), T("ndarray")],
      },
      {
        type: "numerical",
        prompt: `${DF_DEF}\n\nGiá trị của \`df["score"].mean()\` là bao nhiêu? (làm tròn 1 chữ số thập phân cũng được)`,
        explanation: "(8.5 + 7.0 + 9.0 + 6.5 + 7.5) / 5 = 38.5 / 5 = 7.7.",
        extra: { expected: 7.7, tolerance: 0.06 },
      },
    ],
  },
  // ───────────────────────── Cleaning ─────────────────────────
  {
    match: "Data Cleaning and Transformation",
    file: "cleaning.md",
    skillCode: "pds.pandas.cleaning",
    quizTitle: "Kiểm tra — Làm sạch dữ liệu",
    quizDescription: "6 câu về giá trị thiếu, dòng trùng, kiểu dữ liệu và chuỗi.",
    questions: [
      {
        type: "numerical",
        prompt: "```python\nimport pandas as pd\n\ns = pd.Series([8.0, None, 6.0, None, 10.0])\nprint(s.isna().sum())\n```\n\nĐoạn code in ra số nào?",
        explanation: "isna() cho True ở các ô thiếu, và True được cộng như 1: có 2 ô thiếu nên tổng là 2.",
        extra: { expected: 2, tolerance: 0.01 },
      },
      {
        type: "mcq",
        prompt: "Với `s = pd.Series([8.0, None, 6.0, None, 10.0])`, giá trị của `s.mean()` là bao nhiêu?",
        explanation: "mean() mặc định bỏ qua NaN: (8 + 6 + 10) / 3 = 8.0. Nếu coi NaN là 0 thì mới ra 4.8, nhưng pandas không làm vậy.",
        options: [T("8.0", true), T("4.8", false, "pd_nan_zero"), T("24.0"), T("NaN")],
      },
      {
        type: "mcq",
        prompt: "Với cùng `s`, `s.fillna(s.mean()).tolist()` cho kết quả nào?",
        explanation: "Trung bình là 8.0 nên hai ô thiếu được điền 8.0: [8.0, 8.0, 6.0, 8.0, 10.0]. fillna(0) mới cho ra các số 0.",
        options: [T("[8.0, 8.0, 6.0, 8.0, 10.0]", true), T("[8.0, 0.0, 6.0, 0.0, 10.0]", false, "pd_nan_zero"), T("[8.0, 6.0, 10.0]"), T("[8.0, None, 6.0, None, 10.0]")],
      },
      {
        type: "numerical",
        prompt: "```python\nd = pd.DataFrame({\"id\": [1, 2, 2, 3], \"v\": [\"a\", \"b\", \"b\", \"c\"]})\nprint(len(d.drop_duplicates()))\n```\n\nĐoạn code in ra số nào?",
        explanation: "Hai dòng (2, \"b\") trùng nhau nên drop_duplicates giữ lần đầu và bỏ một dòng: còn 3 dòng.",
        extra: { expected: 3, tolerance: 0.01 },
      },
      {
        type: "mcq",
        prompt: "`pd.to_numeric(pd.Series([\"1\", \"2\", \"x\"]), errors=\"coerce\")` cho phần tử thứ ba là gì?",
        explanation: "errors=\"coerce\" biến giá trị không chuyển được thành số thành NaN thay vì báo lỗi. Không có coerce thì lệnh này báo ValueError.",
        options: [T("NaN", true), T("\"x\""), T("0"), T("Báo ValueError dù có errors=\"coerce\"")],
      },
      {
        type: "mcq",
        prompt: "`pd.Series([\" An \", \"BINH\"]).str.strip().str.lower().tolist()` cho kết quả nào?",
        explanation: "strip() bỏ khoảng trắng hai đầu, lower() đưa về chữ thường: ['an', 'binh'].",
        options: [T("['an', 'binh']", true), T("[' an ', 'binh']"), T("['An', 'BINH']"), T("['an ', 'binh']")],
      },
    ],
  },
  // ───────────────────────── EDA ─────────────────────────
  {
    match: "Aggregation and Exploratory",
    file: "eda.md",
    skillCode: "pds.pandas.eda",
    quizTitle: "Kiểm tra — Tổng hợp và khám phá dữ liệu",
    quizDescription: "6 câu về groupby, value_counts, pivot_table, tương quan và Jupyter.",
    assignment: {
      file: "assign-m2.md",
      title: "Thực hành Module 2: Làm sạch và khám phá bảng điểm",
      pedagogicalIntent: "enacting",
      responseFormat: "mixed",
    },
    questions: [
      {
        type: "numerical",
        prompt: `${SALES_DEF}\n\nGiá trị của \`sales.groupby("region")["revenue"].sum()["N"]\` là bao nhiêu?`,
        explanation: "Vùng N có ba dòng: 100 + 200 + 300 = 600.",
        extra: { expected: 600, tolerance: 0.01 },
      },
      {
        type: "mcq",
        prompt: `${SALES_DEF}\n\n\`sales["region"].value_counts().idxmax()\` cho kết quả nào?`,
        explanation: "value_counts đếm số dòng mỗi vùng: N có 3, S có 2, C có 1. idxmax trả về nhãn có số đếm lớn nhất là \"N\".",
        options: [T("\"N\"", true), T("\"S\""), T("\"C\""), T("3")],
      },
      {
        type: "numerical",
        prompt: `${SALES_DEF}\n\nDoanh thu trung bình của sản phẩm A, \`sales.groupby("product")["revenue"].mean()["A"]\`, là bao nhiêu? (làm tròn 2 chữ số thập phân)`,
        explanation: "Sản phẩm A có ba dòng: 100, 150 và 300. Trung bình = 550 / 3 ≈ 183.33.",
        extra: { expected: 183.33, tolerance: 0.02 },
      },
      {
        type: "mcq",
        prompt: `${SALES_DEF}\n\nVới \`pv = sales.pivot_table(index="region", columns="product", values="revenue", aggfunc="sum")\`, ô ứng với vùng C và sản phẩm A có giá trị gì?`,
        explanation: "Vùng C chỉ có một dòng bán sản phẩm B, chưa có dữ liệu cho tổ hợp (C, A), nên pivot_table để NaN chứ không phải 0.",
        options: [T("NaN", true), T("0"), T("120"), T("100")],
      },
      {
        type: "mcq",
        prompt: "Cho `xy = pd.DataFrame({\"x\": [1, 2, 3, 4], \"z\": [8, 6, 4, 2]})`. `xy[\"x\"].corr(xy[\"z\"])` bằng −1.0. Điều đó có nghĩa gì?",
        explanation: "Hệ số −1 nghĩa là hai biến ngược chiều hoàn toàn theo đường thẳng: x tăng thì z giảm. Nó không chứng minh x là nguyên nhân làm z giảm.",
        options: [T("x tăng thì z giảm, quan hệ ngược chiều hoàn toàn theo đường thẳng", true), T("Hai biến không liên quan gì tới nhau"), T("x là nguyên nhân làm z giảm"), T("Dữ liệu bị lỗi vì hệ số không thể âm")],
      },
      {
        type: "mcq",
        prompt: "Trong Jupyter Notebook, tổ hợp phím nào chạy ô hiện tại rồi chuyển xuống ô kế tiếp?",
        explanation: "Shift + Enter chạy ô và chuyển xuống ô dưới. (Ctrl + Enter chạy ô nhưng ở nguyên tại chỗ.)",
        options: [T("Shift + Enter", true), T("Ctrl + S"), T("Esc"), T("Tab")],
      },
    ],
  },
  // ───────────────────────── REST API ─────────────────────────
  {
    match: "Retrieving Data via RESTful APIs",
    file: "restapi.md",
    skillCode: "pds.web.rest_api",
    quizTitle: "Kiểm tra — REST API và JSON",
    quizDescription: "6 câu về JSON, tham số, mã trạng thái, GET/POST và timeout.",
    questions: [
      {
        type: "mcq",
        prompt: "```python\nimport json\n\ntext = '{\"user\": {\"id\": 7, \"name\": \"An\", \"tags\": [\"ml\", \"py\"]}, \"active\": true}'\ndata = json.loads(text)\nprint(data[\"user\"][\"tags\"][1])\n```\n\nĐoạn code in ra gì?",
        explanation: "json.loads biến JSON thành dict/list. data[\"user\"][\"tags\"] là list [\"ml\", \"py\"], và chỉ số 1 (đếm từ 0) là \"py\".",
        options: [T("py", true), T("ml"), T("tags"), T("Báo KeyError")],
      },
      {
        type: "mcq",
        prompt: "```python\nreq = requests.Request(\"GET\", \"https://api.example.com/search\",\n                       params={\"q\": \"python\", \"page\": 2}).prepare()\nprint(req.url)\n```\n\nĐoạn code in ra URL nào?",
        explanation: "requests nối tham số vào sau dấu ? và ngăn cách bằng &: https://api.example.com/search?q=python&page=2.",
        options: [T("https://api.example.com/search?q=python&page=2", true), T("https://api.example.com/search/q=python/page=2"), T("https://api.example.com/search?q=python,page=2"), T("https://api.example.com/search")],
      },
      {
        type: "mcq",
        prompt: "Máy chủ trả về mã trạng thái 404. Điều đó có nghĩa gì?",
        explanation: "404 Not Found: địa chỉ hoặc tài nguyên bạn yêu cầu không tồn tại. Đó là lỗi nhóm 4xx (phía người gọi); lỗi phía máy chủ mới là nhóm 5xx như 500.",
        options: [T("Địa chỉ hoặc tài nguyên yêu cầu không tồn tại", true), T("Máy chủ gặp lỗi nội bộ", false, "http_status"), T("Yêu cầu thành công"), T("Bạn gọi quá nhanh nên bị giới hạn tốc độ")],
      },
      {
        type: "true_false",
        prompt: "`resp.json()` của thư viện requests trả về cấu trúc Python (dict hoặc list) tương ứng với dữ liệu JSON.",
        explanation: "Đúng — JSON object thành dict, JSON array thành list.",
        options: YES_NO(true),
      },
      {
        type: "mcq",
        prompt: "Phát biểu nào về GET và POST là đúng?",
        explanation: "GET dùng để lấy dữ liệu và không làm thay đổi gì trên máy chủ; POST dùng để gửi dữ liệu lên, ví dụ tạo một bản ghi mới.",
        options: [T("GET để lấy dữ liệu, POST để gửi dữ liệu tạo mới", true), T("GET để gửi dữ liệu tạo mới, POST để lấy dữ liệu", false, "http_get_post"), T("Hai phương thức giống hệt nhau"), T("POST chỉ dùng để xoá dữ liệu")],
      },
      {
        type: "true_false",
        prompt: "Nếu gọi `requests.get(url)` mà không đặt `timeout`, chương trình có thể bị treo vô thời hạn khi máy chủ không trả lời.",
        explanation: "Đúng — requests không tự đặt giới hạn thời gian, nên luôn phải truyền timeout.",
        options: YES_NO(true),
      },
    ],
  },
  // ───────────────────────── Scraping ─────────────────────────
  {
    match: "Web Scraping with BeautifulSoup",
    file: "scraping.md",
    skillCode: "pds.web.scraping",
    quizTitle: "Kiểm tra — Web scraping",
    quizDescription: "6 câu về select, find, class nhiều giá trị, quy tắc scrape và trang JavaScript.",
    assignment: {
      file: "assign-m3.md",
      title: "Thực hành Module 3: Thu thập dữ liệu từ API và trang web",
      pedagogicalIntent: "enacting",
      responseFormat: "mixed",
    },
    questions: [
      {
        type: "numerical",
        prompt: `${SOUP_DEF}\n\nĐoạn code \`sum(float(p.text) for p in soup.select("span.price"))\` cho giá trị bao nhiêu?`,
        explanation: "Ba thẻ giá có text \"3.5\", \"12\" và \"20\". Text là chuỗi nên cần float(); tổng = 3.5 + 12 + 20 = 35.5.",
        extra: { expected: 35.5, tolerance: 0.01 },
      },
      {
        type: "mcq",
        prompt: `${SOUP_DEF}\n\n\`len(soup.select("li.item"))\` cho kết quả nào?`,
        explanation: "Thẻ li thứ ba có class=\"item sale\", tức có cả hai class nên vẫn khớp li.item. Cả ba thẻ đều khớp, kết quả là 3.",
        options: [T("3", true), T("2", false, "bs_class_exact"), T("1"), T("0")],
      },
      {
        type: "mcq",
        prompt: `${SOUP_DEF}\n\n\`soup.select_one("li.sale a").text\` cho kết quả nào?`,
        explanation: "li.sale chỉ khớp thẻ li thứ ba; a bên trong nó có chữ \"Bag\". select_one trả về phần tử đầu tiên khớp, .text lấy chữ bên trong.",
        options: [T("\"Bag\"", true), T("\"Pen\""), T("\"/p/3\""), T("None")],
      },
      {
        type: "mcq",
        prompt: "Trang HTML không có thẻ `table` nào. `soup.find(\"table\")` trả về gì?",
        explanation: "find trả về phần tử đầu tiên khớp, hoặc None nếu không có. find_all mới là hàm trả về list (rỗng khi không có).",
        options: [T("None", true), T("Một list rỗng []", false, "bs_find_all"), T("Chuỗi rỗng"), T("Báo lỗi ngay khi gọi")],
      },
      {
        type: "mcq",
        prompt: "Trước khi scrape một trang web, bạn nên làm gì?",
        explanation: "Kiểm tra robots.txt và điều khoản sử dụng của trang để biết việc thu thập có được phép không; nên ưu tiên API nếu trang có cung cấp, và chờ giữa các lần gọi để không làm quá tải máy chủ.",
        options: [T("Kiểm tra robots.txt và điều khoản sử dụng của trang", true), T("Chỉ cần thấy HTML có dữ liệu là đủ", false, "scrape_rules"), T("Gửi thật nhiều yêu cầu cùng lúc cho nhanh", false, "scrape_rules"), T("Không cần làm gì")],
      },
      {
        type: "mcq",
        prompt: "Một trang chỉ hiện dữ liệu sau khi JavaScript chạy trong trình duyệt. Nếu dùng requests và BeautifulSoup thì bạn nhận được gì?",
        explanation: "requests chỉ tải HTML ban đầu và không chạy JavaScript, nên dữ liệu do JavaScript tải sau sẽ không có trong đó. Khi đó hãy tìm API ẩn mà trang gọi, hoặc dùng công cụ điều khiển trình duyệt.",
        options: [T("Chỉ HTML ban đầu, thiếu dữ liệu do JavaScript tải sau", true), T("Đầy đủ dữ liệu như khi xem trong trình duyệt"), T("Chỉ có dữ liệu JavaScript, không có HTML"), T("Luôn báo lỗi 404")],
      },
    ],
  },
];

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

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

const misIds = new Map<string, string>();

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

function misIdOf(key: string | undefined): { misconceptionId: string } | Record<string, never> {
  if (!key) return {};
  const id = misIds.get(key);
  if (!id) throw new Error(`unknown misconception key: ${key}`);
  return { misconceptionId: id };
}

function read(file: string): string {
  return readFileSync(join(CONTENT_DIR, file), "utf8").trimEnd();
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  // Fail early on anything malformed, before touching the database.
  for (const p of PLANS) {
    const body = read(p.file);
    if (body.length < 1500) throw new Error(`${p.file}: reading looks too short (${body.length} chars)`);
    for (const q of p.questions) {
      if (q.type !== "numerical") {
        const right = (q.options ?? []).filter((o) => o.correct).length;
        if (right !== 1) throw new Error(`${p.match}: "${q.prompt.slice(0, 40)}…" has ${right} correct options`);
      } else if (typeof q.extra?.expected !== "number") {
        throw new Error(`${p.match}: numerical question without expected`);
      }
    }
    if (p.assignment) read(p.assignment.file);
  }

  const skillRows = await prisma.skill.findMany({
    where: { code: { in: PLANS.map((p) => p.skillCode) } },
    select: { id: true, code: true },
  });
  const skillId = new Map(skillRows.map((s) => [s.code, s.id]));
  for (const p of PLANS) if (!skillId.has(p.skillCode)) throw new Error(`missing skill ${p.skillCode}`);

  const resolved = [];
  for (const p of PLANS) {
    const lesson = await prisma.lesson.findFirst({
      where: { title: { startsWith: p.match }, module: { courseId: course.id } },
      include: {
        contentItems: { where: { type: "markdown" }, select: { id: true } },
        quizzes: { where: { cuepointOnly: false }, select: { id: true } },
        assignments: { select: { id: true } },
      },
    });
    if (!lesson) throw new Error(`no lesson matching "${p.match}"`);
    if (lesson.contentItems.length !== 1) throw new Error(`${p.match}: expected one markdown item`);
    resolved.push({ p, lesson });
  }

  if (dryRun) {
    console.log("DRY RUN\n");
    for (const { p, lesson } of resolved) {
      console.log(
        `"${lesson.title}"  reading ${read(p.file).length} chars  quiz ${p.questions.length} câu` +
          (p.assignment ? `  + bài tập "${p.assignment.title}"` : "") +
          (lesson.quizzes.length ? "   [đã có quiz — sẽ bỏ qua]" : ""),
      );
    }
    return;
  }

  await ensureMisconceptions();

  for (const { p, lesson } of resolved) {
    if (lesson.quizzes.length > 0) {
      console.log(`skip (already has a quiz): ${lesson.title}`);
      continue;
    }

    // 1. Replace the placeholder reading.
    await updateContentItem(
      actor,
      lesson.contentItems[0]!.id,
      { payload: { body: read(p.file) } },
      prisma,
    );

    // 2. End-of-lesson quiz.
    const { quizId } = await createQuiz(
      actor,
      { courseId: course.id, lessonId: lesson.id },
      {
        title: p.quizTitle,
        description: p.quizDescription,
        passThresholdPct: 70,
        maxAttempts: 5,
        requireConfidence: true,
      },
      prisma,
    );
    for (const [i, q] of p.questions.entries()) {
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
            ? {
                options: q.options.map((o) => ({
                  label: o.label,
                  isCorrect: o.correct ?? false,
                  ...misIdOf(o.mis),
                })),
              }
            : {}),
          ...(q.extra ? { extra: q.extra } : {}),
          skillIds: [skillId.get(p.skillCode)!],
        },
        prisma,
      );
    }

    // 3. Practice assignment that closes the module.
    if (p.assignment && lesson.assignments.length === 0) {
      await createAssignment(
        actor,
        lesson.id,
        {
          title: p.assignment.title,
          description: read(p.assignment.file),
          pedagogicalIntent: p.assignment.pedagogicalIntent,
          responseFormat: p.assignment.responseFormat,
          assessmentModes: ["instructor_graded", "self_assessed"],
          requireSelfRating: true,
          requireReflection: true,
          maxScore: 100,
        },
        prisma,
      );
    }

    console.log(
      `"${lesson.title}" — reading ${read(p.file).length} chars, ${p.questions.length} câu quiz` +
        (p.assignment ? ", 1 bài tập" : ""),
    );
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
