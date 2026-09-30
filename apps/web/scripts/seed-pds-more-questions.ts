/**
 * Extra multiple-choice questions for Programming for Data Science.
 *
 * A micro-credential needs a question pool large enough that a learner cannot
 * pass by memorising a handful of items. This adds mcq / true-false questions to
 * the end-of-lesson quiz of each lesson listed below, so that each course has at
 * least 150 multiple-choice questions in its lesson quizzes.
 *
 *   tsx scripts/seed-pds-more-questions.ts [--dry-run]
 *
 * Every question was written against the lesson's own content, and every code
 * output or number in them was executed / computed before being written down.
 * New questions inherit the skill tag of the lesson's existing quiz questions.
 *
 * Idempotent: a question whose prompt already exists in that quiz is skipped.
 * Nothing is deleted or edited. Run scripts/rebalance-option-order.ts afterwards
 * to spread the correct answer evenly across positions.
 */
import { prisma } from "@feedbackme/db";
import { createQuestion } from "@feedbackme/core-lms";

const COURSE_SLUG = "programming-for-data-science";

interface Opt { label: string; correct?: boolean; mis?: string }
interface Q { type: "mcq" | "true_false"; prompt: string; explanation: string; options: Opt[] }
const T = (label: string, correct?: boolean, mis?: string): Opt => ({ label, ...(correct ? { correct } : {}), ...(mis ? { mis } : {}) });
const YES_NO = (yes: boolean): Opt[] => [T("Đúng", yes), T("Sai", !yes)];

const EXISTING_MIS_CODES: Record<string, string> = {
  accuracy_always_good: "ml_accuracy_always_good",
  attr_shared: "py_instance_attribute_shared",
  bs_class_exact: "bs_class_selector_exact",
  bs_find_all: "bs_find_returns_list",
  capstone: "pds.lecture.python_fundamentals",
  div_vs_floor: "py_true_vs_floor_division",
  fit_test: "ml_fit_on_test_set",
  http_get_post: "http_get_vs_post",
  http_status: "http_status_class_confusion",
  inherit_vs_poly: "py_inheritance_vs_polymorphism",
  input_is_number: "py_input_returns_number",
  int_rounds: "py_int_rounds",
  is_vs_eq: "py_is_vs_equals",
  list_alias: "py_list_assignment_copies",
  np_axis_swap: "np_axis_swap",
  np_list_arith: "np_list_multiplication",
  overview: "pds.intro.course_overview",
  pd_loc_iloc: "pd_loc_vs_iloc",
  pd_nan_zero: "pd_mean_counts_nan_as_zero",
  pd_series_df: "pd_series_vs_dataframe",
  range_end: "py_range_includes_end",
  regression_vs_classification: "ml_regression_vs_classification",
  scope_leak: "py_local_assignment_changes_global",
  scrape_rules: "scrape_ignoring_rules",
  slice_end: "py_slice_end_inclusive",
};

// Sinh tự động bởi pds_more_verify.py — mọi kết quả code đã được chạy thật.
// Yêu cầu có sẵn: Opt, Q, T, YES_NO. Không import, không export.

const MORE_MIS: Record<string, { code: string; name: string; description: string }> = {
  more_fstring_no_prefix: {
    code: "pds_more_fstring_no_prefix",
    name: "Quên chữ f trước f-string",
    description: "Học viên viết {biến} trong chuỗi thường và tưởng Python tự thay bằng giá trị; thiếu tiền tố f thì chuỗi được in nguyên văn.",
  },
  more_truthy_by_content: {
    code: "pds_more_truthy_by_content",
    name: "Xét truthy theo phần tử bên trong thay vì độ rỗng",
    description: "Học viên cho rằng list hay chuỗi chứa giá trị 0 (hoặc False) là falsy, trong khi chỉ container rỗng mới falsy.",
  },
  more_str_item_assign: {
    code: "pds_more_str_item_assign",
    name: "Tưởng gán được từng ký tự của chuỗi",
    description: "Học viên viết s[0] = 'H' để đổi ký tự, quên rằng chuỗi là immutable và phải tạo chuỗi mới.",
  },
  more_append_extend: {
    code: "pds_more_append_extend",
    name: "Nhầm append với extend",
    description: "Học viên nhầm append (thêm đúng một phần tử, có thể là cả list) với extend (thêm từng phần tử của một iterable).",
  },
  more_set_indexable: {
    code: "pds_more_set_indexable",
    name: "Tưởng set đánh chỉ số được như list",
    description: "Học viên truy cập phần tử của set bằng chỉ số s[0], quên rằng set không có thứ tự nên không hỗ trợ chỉ số.",
  },
  more_if_chain_independent: {
    code: "pds_more_if_chain_independent",
    name: "Coi hai if liên tiếp là một chuỗi if/elif",
    description: "Học viên cho rằng sau khi một if đúng thì các if sau không được xét nữa, trong khi mỗi if độc lập đều được kiểm tra; chỉ elif/else mới bị bỏ qua.",
  },
  more_class_attr_copy: {
    code: "pds_more_class_attr_copy",
    name: "Tưởng object giữ bản sao riêng của class attribute",
    description: "Học viên cho rằng object đã tạo trước đó giữ giá trị cũ của class attribute khi class attribute được đổi, trong khi mọi object đọc chung từ class.",
  },
  more_missing_self: {
    code: "pds_more_missing_self",
    name: "Quên self. khi gán thuộc tính trong __init__",
    description: "Học viên viết name = name trong __init__ và tưởng tạo thuộc tính của object, trong khi đó chỉ là biến local.",
  },
  more_self_passed_manually: {
    code: "pds_more_self_passed_manually",
    name: "Tưởng phải truyền self khi tạo object",
    description: "Học viên cho rằng lời gọi Student('An') thiếu self, quên rằng Python tự truyền object mới vào tham số self.",
  },
  more_dunder_no_effect: {
    code: "pds_more_dunder_no_effect",
    name: "Tưởng __ở đầu tên thuộc tính không có tác dụng",
    description: "Học viên cho rằng thuộc tính bắt đầu bằng hai dấu gạch dưới vẫn truy cập trực tiếp được từ ngoài class như thuộc tính thường.",
  },
  more_has_a_vs_is_a: {
    code: "pds_more_has_a_vs_is_a",
    name: "Dùng kế thừa cho quan hệ 'có một'",
    description: "Học viên dùng kế thừa khi giữa hai class chỉ là quan hệ chứa/thuộc về (has-a), thay vì quan hệ 'là một' (is-a).",
  },
  more_linspace_arange: {
    code: "pds_more_linspace_arange",
    name: "Nhầm linspace với arange",
    description: "Học viên nhầm linspace (nhận số điểm, gồm cả hai đầu) với arange (nhận bước nhảy, dừng trước điểm cuối).",
  },
  more_and_or_mask: {
    code: "pds_more_and_or_mask",
    name: "Nhầm & với | khi kết hợp điều kiện lọc",
    description: "Học viên nhầm '&' (thoả cả hai điều kiện) với '|' (thoả ít nhất một điều kiện) khi lọc DataFrame.",
  },
  more_dropna_all: {
    code: "pds_more_dropna_all",
    name: "Tưởng dropna chỉ bỏ dòng thiếu mọi ô",
    description: "Học viên cho rằng dropna() chỉ bỏ dòng mà tất cả các cột đều thiếu, trong khi mặc định nó bỏ dòng có ít nhất một ô thiếu.",
  },
  more_na_string_is_nan: {
    code: "pds_more_na_string_is_nan",
    name: "Tưởng chuỗi 'N/A' đã là giá trị thiếu",
    description: "Học viên cho rằng fillna xử lý được chuỗi 'N/A', trong khi 'N/A' chỉ là một chuỗi thường cho tới khi được chuyển thành NaN.",
  },
  more_eda_skip_overview: {
    code: "pds_more_eda_skip_overview",
    name: "Bỏ qua bước xem tổng quan dữ liệu",
    description: "Học viên nhảy thẳng vào xử lý hay phân tích sâu (điền ô thiếu, vẽ tương quan, groupby) trước khi xem shape, head và info.",
  },
  more_corr_zero_independent: {
    code: "pds_more_corr_zero_independent",
    name: "Coi tương quan gần 0 là độc lập",
    description: "Học viên cho rằng hệ số tương quan gần 0 nghĩa là không có liên hệ, quên rằng nó chỉ đo liên hệ tuyến tính.",
  },
  more_rate_limit_flood: {
    code: "pds_more_rate_limit_flood",
    name: "Xử lý lỗi 429 bằng cách gọi dồn dập hơn",
    description: "Học viên đáp lại lỗi giới hạn tốc độ (429) bằng cách gọi nhiều hơn thay vì chậm lại.",
  },
  more_json_literals: {
    code: "pds_more_json_literals",
    name: "Tưởng json.loads giữ nguyên true/null của JSON",
    description: "Học viên nghĩ giá trị boolean sau json.loads vẫn viết chữ thường true như trong JSON, trong khi Python dùng True.",
  },
  more_css_id_class: {
    code: "pds_more_css_id_class",
    name: "Nhầm # (id) với . (class) trong bộ chọn CSS",
    description: "Học viên dùng li#sale để chọn theo class, quên rằng # dành cho id còn . dành cho class.",
  },
  more_bs_get_raises: {
    code: "pds_more_bs_get_raises",
    name: "Tưởng .get() báo KeyError khi thiếu thuộc tính",
    description: "Học viên cho rằng tag.get('href') báo lỗi khi thiếu thuộc tính như tag['href'], trong khi .get trả về None.",
  },
  more_bs_text_number: {
    code: "pds_more_bs_text_number",
    name: "Tưởng .text của BeautifulSoup là số",
    description: "Học viên cho rằng chữ lấy bằng .text tự là số nên nhân được, quên rằng nó luôn là chuỗi và cần float()/int().",
  },
};

const MORE: Array<{ match: string; questions: Q[] }> = [
  {
    match: "1.1 Python và cú pháp cơ bản",
    questions: [
      {
        type: "mcq",
        prompt: "Chạy đoạn code sau, Python báo lỗi nào?\n\n```python\nscore = 5\nif score > 3:\nprint(\"cao\")\n```",
        explanation: "Dòng print nằm trong khối của if nhưng không được thụt lề, nên Python báo IndentationError (thiếu khối lệnh được thụt lề sau dòng kết thúc bằng dấu hai chấm). Sửa bằng cách thụt dòng print vào 4 dấu cách. Các biến ở đây đều đã được định nghĩa và so sánh 5 > 3 là hợp lệ nên không có NameError hay TypeError.",
        options: [
        T("TypeError: không thể so sánh số 5 với số 3"),
        T("IndentationError: sau dòng if cần một khối lệnh được thụt lề", true),
        T("NameError: biến score chưa được định nghĩa"),
        T("Không lỗi, chương trình in ra chữ cao"),
      ],
      },
      {
        type: "true_false",
        prompt: "Lệnh `Print(\"xin chào\")` (viết hoa chữ P) vẫn chạy bình thường vì Python không phân biệt chữ hoa và chữ thường.",
        explanation: "Sai — Python phân biệt hoa thường. Tên hàm có sẵn là print (chữ thường); Print là một tên khác chưa được định nghĩa nên Python báo NameError.",
        options: YES_NO(false),
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\ntotal = 3\n# total = total + 10\nprint(total)\n```",
        explanation: "Mọi thứ từ dấu # tới hết dòng là comment và bị Python bỏ qua, nên total không bao giờ được cộng thêm 10 và vẫn bằng 3.",
        options: [
        T("3", true),
        T("13"),
        T("Không in gì"),
        T("Báo lỗi vì dòng comment viết sai cú pháp"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nn = 5\nif n > 10:\n    print(\"A\")\n    print(\"B\")\nprint(\"C\")\n```",
        explanation: "Hai dòng print(\"A\") và print(\"B\") được thụt lề nên thuộc khối của if; vì 5 > 10 sai nên cả khối bị bỏ qua. Dòng print(\"C\") không thụt lề nên nằm ngoài if và luôn chạy. Thụt lề chính là thứ quyết định dòng nào thuộc khối.",
        options: [
        T("A rồi C"),
        T("A, B rồi C (mỗi chữ một dòng)"),
        T("Không in gì"),
        T("C", true),
      ],
      },
    ],
  },
  {
    match: "1.2 Biến, nhập và xuất dữ liệu",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nprint(\"Xin\", \"chào\", sep=\"-\", end=\"!\")\nprint(\"Python\")\n```",
        explanation: "sep là chuỗi chèn giữa các giá trị (ở đây \"-\") nên dòng đầu là Xin-chào; end là chuỗi chèn ở cuối lần in (ở đây \"!\" thay cho ký tự xuống dòng mặc định), nên lần print kế tiếp nối liền ngay sau đó: Xin-chào!Python.",
        options: [
        T("Xin-chào!Python", true),
        T("Xin-chào! rồi Python ở dòng kế tiếp"),
        T("Xin chào!Python"),
        T("Xin-chào-Python"),
      ],
      },
      {
        type: "mcq",
        prompt: "Cho `score = 9` (số nguyên). Cách nào in ra đúng dòng Điểm: 9?",
        explanation: "f-string cần chữ f đứng trước dấu nháy thì {score} mới được thay bằng giá trị 9. Bỏ chữ f thì Python in nguyên văn {score}. Nối chuỗi với số bằng + báo TypeError vì không cộng được str với int, còn viết hai giá trị cạnh nhau không có dấu phẩy là SyntaxError.",
        options: [
        T("print(\"Điểm: \" + score)"),
        T("print(\"Điểm: {score}\")", false, "more_fstring_no_prefix"),
        T("print(\"Điểm: \" score)"),
        T("print(f\"Điểm: {score}\")", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Theo quy ước PEP 8, ba tên MAX_USERS, user_count và UserProfile lần lượt phù hợp nhất để đặt cho thứ gì?",
        explanation: "UPPER_SNAKE_CASE (MAX_USERS) dành cho hằng số, snake_case (user_count) dành cho biến và hàm, PascalCase (UserProfile) dành cho tên class. Các thứ tự khác đều gán sai kiểu đặt tên cho vai trò.",
        options: [
        T("Class, biến, hằng số"),
        T("Biến, hằng số, class"),
        T("Hằng số, class, biến"),
        T("Hằng số, biến, class", true),
      ],
      },
      {
        type: "true_false",
        prompt: "Người dùng gõ 5 khi chạy đoạn code sau, chương trình in ra 10.\n\n```python\nx = input()\nprint(x * 2)\n```",
        explanation: "Sai — input() luôn trả về chuỗi, nên x là \"5\" và \"5\" * 2 là phép lặp chuỗi, cho \"55\". Muốn ra 10 phải ép kiểu: int(input()) * 2.",
        options: [T("Đúng", false, "input_is_number"), T("Sai", true)],
      },
    ],
  },
  {
    match: "1.3 Toán tử và biểu thức",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nprint(2 + 3 * 4 ** 2)\n```",
        explanation: "Luỹ thừa (**) có ưu tiên cao nhất: 4 ** 2 = 16; sau đó nhân: 3 * 16 = 48; cuối cùng cộng: 2 + 48 = 50. Nếu cộng trước hay nhân trước ngoài thứ tự ưu tiên thì sẽ ra 80, 196 hoặc 400.",
        options: [
        T("400"),
        T("196"),
        T("80"),
        T("50", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nprint(-7 // 2)\n```",
        explanation: "// là chia lấy phần nguyên theo nghĩa làm tròn XUỐNG: -7 / 2 = -3.5, làm tròn xuống ra -4 (không phải -3). Chỉ khi cắt bỏ phần thập phân như int(-3.5) mới ra -3.",
        options: [
        T("-3.5", false, "div_vs_floor"),
        T("4"),
        T("-3", false, "div_vs_floor"),
        T("-4", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Với n là số nguyên dương, biểu thức nào cho True khi và chỉ khi n là số lẻ?",
        explanation: "n % 2 là phần dư khi chia 2: số lẻ dư 1. n // 2 == 1 chỉ đúng với n = 2 hoặc 3, n % 2 == 0 kiểm tra số chẵn, còn n / 2 == 1 chỉ đúng với n = 2.",
        options: [
        T("n % 2 == 0"),
        T("n / 2 == 1", false, "div_vs_floor"),
        T("n % 2 == 1", true),
        T("n // 2 == 1", false, "div_vs_floor"),
      ],
      },
      {
        type: "true_false",
        prompt: "Biểu thức `not True or True` cho kết quả True, vì `not` được tính trước `or`.",
        explanation: "Đúng — not có ưu tiên cao hơn and, or: (not True) or True = False or True = True. Nếu tính or trước thì not (True or True) mới ra False.",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "1.4 Số, boolean và chuỗi",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\ndata = [0]\nif data:\n    print(\"có\")\nelse:\n    print(\"trống\")\n```",
        explanation: "Truthiness của list phụ thuộc vào việc list có rỗng hay không, không phụ thuộc giá trị bên trong. [0] có một phần tử nên là truthy dù phần tử đó là 0; chỉ list rỗng [] mới falsy.",
        options: [
        T("trống", false, "more_truthy_by_content"),
        T("có", true),
        T("Báo lỗi vì 0 không phải điều kiện hợp lệ"),
        T("Không in gì"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\ns = \"Python\"\nprint(s[::-1])\n```",
        explanation: "Slice s[::-1] có bước nhảy -1 nên duyệt chuỗi từ cuối về đầu, tức đảo ngược chuỗi: \"Python\" thành \"nohtyP\".",
        options: [
        T("P"),
        T("nohtyP", true),
        T("nohty"),
        T("Python"),
      ],
      },
      {
        type: "mcq",
        prompt: "Cho s = 'hello'. Cách nào tạo được chuỗi 'Hello' (đổi chữ cái đầu thành chữ hoa)?",
        explanation: "Chuỗi là immutable nên phải tạo chuỗi mới: \"H\" + s[1:] ghép chữ H với phần còn lại. s[0] = \"H\" báo TypeError; s.upper() không sửa s mà trả về chuỗi mới HELLO (viết hoa hết); s.replace(0, \"H\") cũng lỗi vì replace nhận chuỗi, không nhận vị trí.",
        options: [
        T("s = \"H\" + s[1:]", true),
        T("s.replace(0, \"H\")"),
        T("s[0] = \"H\"", false, "more_str_item_assign"),
        T("s.upper()"),
      ],
      },
      {
        type: "true_false",
        prompt: "Với s = 'Python' (6 ký tự), lệnh s[6] báo IndexError vì chỉ số hợp lệ chạy từ 0 đến 5.",
        explanation: "Đúng — chỉ số bắt đầu từ 0 nên ký tự cuối là s[5]. s[6] vượt quá chuỗi và gây IndexError. (Riêng slice thì không báo lỗi khi vượt: s[2:99] vẫn chạy.)",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "1.5 List",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\na = [1, 2]\na.append([3, 4])\nb = [1, 2]\nb.extend([3, 4])\nprint(len(a), len(b))\n```",
        explanation: "append thêm ĐÚNG MỘT phần tử vào cuối — ở đây phần tử đó là cả list [3, 4] — nên a = [1, 2, [3, 4]] có 3 phần tử. extend thêm từng phần tử của list truyền vào nên b = [1, 2, 3, 4] có 4 phần tử.",
        options: [
        T("4 4", false, "more_append_extend"),
        T("3 3"),
        T("3 4", true),
        T("4 3", false, "more_append_extend"),
      ],
      },
      {
        type: "mcq",
        prompt: "Học viên muốn `top` là list điểm đã sắp xếp tăng dần, nhưng sau đoạn code sau `top` lại là None. Vì sao?\n\n```python\nscores = [7, 9, 6]\ntop = scores.sort()\n```",
        explanation: "scores.sort() sắp xếp ngay trên list scores (tại chỗ) và trả về None, nên gán kết quả của nó cho top cho ra None. Muốn có một list mới đã sắp xếp mà giữ nguyên scores, dùng top = sorted(scores).",
        options: [
        T("sort() trả về bản sao chưa sắp xếp của list"),
        T("Phải khai báo top = [] trước khi gọi sort()"),
        T("sort() chỉ chạy được trên list chứa chuỗi, còn list số thì trả về None"),
        T("sort() sắp xếp tại chỗ và trả về None; muốn có list mới phải dùng sorted()", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nnums = [10, 20, 30, 20]\nnums.remove(20)\nlast = nums.pop()\nprint(nums, last)\n```",
        explanation: "remove(20) chỉ xoá lần xuất hiện ĐẦU TIÊN của 20, còn lại [10, 30, 20]. pop() không đối số lấy ra và trả về phần tử cuối là 20, để lại [10, 30].",
        options: [
        T("[10, 30] 20", true),
        T("[10] 30"),
        T("[10, 20] 30"),
        T("[10, 30, 20] 20"),
      ],
      },
      {
        type: "true_false",
        prompt: "Với a = [1, 2, 3] và b = a.copy(), biểu thức a == b cho True còn a is b cho False.",
        explanation: "Đúng — copy() tạo một list mới có cùng nội dung: == so sánh giá trị nên True, còn is kiểm tra có cùng một đối tượng hay không nên False. Với b = a (không copy) thì cả hai đều True.",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "1.6 Tuple, Set, Dictionary và ép kiểu",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nstudents = {\"s1\": {\"name\": \"Anna\", \"scores\": [8, 9]}}\nstudents[\"s1\"][\"scores\"].append(7)\nprint(students[\"s1\"][\"scores\"])\n```",
        explanation: "students[\"s1\"][\"scores\"] đi hai tầng dictionary và trả về đúng list [8, 9] bên trong; append sửa list đó tại chỗ (list là mutable) nên khi in ra được [8, 9, 7].",
        options: [
        T("[8, 9]"),
        T("[8, 9, 7]", true),
        T("Báo AttributeError vì dictionary không có append"),
        T("[7]"),
      ],
      },
      {
        type: "mcq",
        prompt: "Chạy đoạn code sau, điều gì xảy ra?\n\n```python\ncodes = [\"A1\", \"B2\", \"A1\", \"C3\", \"B2\"]\nunique = set(codes)\nprint(len(unique), unique[0])\n```",
        explanation: "Set không có thứ tự nên không đánh chỉ số được: unique[0] báo TypeError (object không hỗ trợ truy cập bằng chỉ số). Vì các đối số của print được tính xong trước khi in, nên lỗi xảy ra trước và không có gì được in ra, kể cả len(unique) = 3. Nếu cần vị trí, hãy chuyển sang list: list(unique)[0].",
        options: [
        T("In ra 3 A1", false, "more_set_indexable"),
        T("Báo TypeError vì set không có thứ tự nên không đánh chỉ số được", true),
        T("In ra 3 rồi mới báo lỗi ở giá trị thứ hai"),
        T("In ra 5 A1"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nprint(int(\"12\") + int(3.99))\n```",
        explanation: "int(\"12\") ép chuỗi thành số 12; int(3.99) cắt bỏ phần thập phân chứ không làm tròn, cho 3. Tổng 12 + 3 = 15. Nếu int làm tròn thì mới ra 16.",
        options: [
        T("15", true),
        T("16", false, "int_rounds"),
        T("Báo TypeError vì trộn chuỗi và số"),
        T("15.99"),
      ],
      },
      {
        type: "true_false",
        prompt: "Dictionary `{\"a\": 1, \"a\": 2}` không báo lỗi; nó chỉ còn một khoá \"a\" với giá trị 2.",
        explanation: "Đúng — khoá trong dictionary là duy nhất; khi trùng khoá, giá trị viết sau ghi đè giá trị trước và Python không báo lỗi.",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "1.7 Rẽ nhánh if / elif / else",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nx = 15\nif x > 10:\n    print(\"A\")\nif x > 5:\n    print(\"B\")\nelse:\n    print(\"C\")\n```",
        explanation: "Đây là HAI câu lệnh if độc lập chứ không phải một chuỗi if/elif. if đầu đúng nên in A; sau đó Python vẫn kiểm tra if thứ hai: 15 > 5 đúng nên in B, còn else (thuộc if thứ hai) bị bỏ qua. Nếu viết elif ở dòng thứ hai thì chỉ in A.",
        options: [
        T("Chỉ A", false, "more_if_chain_independent"),
        T("Chỉ B"),
        T("A rồi B (hai dòng)", true),
        T("A rồi C"),
      ],
      },
      {
        type: "mcq",
        prompt: "Học viên muốn điểm từ 90 trở lên xếp loại A, nhưng với score = 95 đoạn code sau lại in ra C. Nguyên nhân là gì?\n\n```python\nscore = 95\nif score >= 70:\n    grade = \"C\"\nelif score >= 90:\n    grade = \"A\"\nelse:\n    grade = \"F\"\nprint(grade)\n```",
        explanation: "Python chạy nhánh đầu tiên có điều kiện đúng rồi bỏ qua mọi nhánh sau. score >= 70 là điều kiện rộng và đã đúng với 95, nên nhánh score >= 90 không bao giờ được xét. Phải đặt điều kiện hẹp nhất (>= 90) lên trước, điều kiện rộng hơn xuống sau.",
        options: [
        T("Điều kiện score >= 70 nằm trước và đã đúng, nên các nhánh sau bị bỏ qua", true),
        T("Nhánh else chạy vì 95 không thoả điều kiện nào"),
        T("95 là số nguyên nên không so sánh được với 90"),
        T("Dòng elif score >= 90 sai cú pháp nên bị bỏ qua"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nage = 20\nhas_id = False\nif age >= 18:\n    if has_id:\n        print(\"vào\")\n    else:\n        print(\"xuất trình thẻ\")\nelse:\n    print(\"chưa đủ tuổi\")\n```",
        explanation: "age >= 18 đúng nên vào khối ngoài. Ở trong, else thụt lề cùng mức với if has_id nên thuộc về if has_id: vì has_id là False nên else này chạy và in \"xuất trình thẻ\". Else ngoài cùng (cùng mức với if age) mới là nhánh chưa đủ tuổi và không chạy.",
        options: [
        T("xuất trình thẻ", true),
        T("chưa đủ tuổi"),
        T("vào"),
        T("Không in gì"),
      ],
      },
      {
        type: "true_false",
        prompt: "Dòng `if x = 5:` là cách hợp lệ để kiểm tra x có bằng 5 hay không.",
        explanation: "Sai — = là phép gán và không được dùng làm điều kiện (SyntaxError). Muốn so sánh phải dùng ==: if x == 5:.",
        options: YES_NO(false),
      },
    ],
  },
  {
    match: "1.8 Vòng lặp for và while",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\ncount = 0\nfor i in range(3):\n    for j in range(4):\n        count += 1\nprint(count)\n```",
        explanation: "Vòng ngoài chạy 3 lượt (i = 0, 1, 2); mỗi lượt vòng trong chạy đủ 4 lượt (j = 0..3). Tổng số lần count += 1 là 3 × 4 = 12, chứ không phải 3 + 4.",
        options: [
        T("4"),
        T("12", true),
        T("7"),
        T("3"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau chạy mãi không dừng. Vì sao?\n\n```python\ni = 0\nwhile i < 3:\n    print(i)\n```",
        explanation: "Thân vòng lặp không thay đổi i, nên i luôn bằng 0 và điều kiện i < 3 luôn đúng: vòng lặp in 0 mãi mãi. Phải cập nhật biến điều kiện, ví dụ thêm dòng i += 1 ở cuối thân vòng lặp.",
        options: [
        T("0 < 3 là điều kiện không hợp lệ trong while"),
        T("Biến i không đổi trong thân vòng lặp nên điều kiện i < 3 luôn đúng", true),
        T("while luôn cần lệnh break mới dừng được"),
        T("Lệnh print làm giảm giá trị của i mỗi lượt"),
      ],
      },
      {
        type: "mcq",
        prompt: "Trường hợp nào nên dùng vòng lặp while thay vì for?",
        explanation: "while hợp với việc lặp tới khi một điều kiện thôi đúng mà không biết trước số lượt, như nhắc nhập lại mật khẩu tới khi đúng. Ba trường hợp còn lại đều có sẵn số lượt hoặc tập phần tử để duyệt nên dùng for.",
        options: [
        T("Duyệt từng ký tự của một chuỗi cho trước để đếm nguyên âm"),
        T("Cộng tất cả phần tử của một list điểm số cho sẵn"),
        T("In lần lượt các số từ 1 đến 10 ra màn hình"),
        T("Nhắc nhập lại mật khẩu cho tới khi đúng, không biết trước số lần", true),
      ],
      },
      {
        type: "true_false",
        prompt: "Vòng lặp `for i in range(5)` cho i lần lượt nhận các giá trị 1, 2, 3, 4, 5.",
        explanation: "Sai — range(5) bắt đầu từ 0 và dừng ngay trước 5, nên i nhận 0, 1, 2, 3, 4 (đúng 5 lượt). Muốn 1..5 phải viết range(1, 6).",
        options: [T("Đúng", false, "range_end"), T("Sai", true)],
      },
    ],
  },
  {
    match: "1.9 Hàm",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\ndef f(*args, **kwargs):\n    return args, kwargs\n\nprint(f(1, 2, x=3))\n```",
        explanation: "*args gom các đối số vị trí thừa (1, 2) vào một tuple; **kwargs gom các đối số có tên (x=3) vào một dictionary {'x': 3}. Hàm trả về cả hai dưới dạng một tuple hai phần tử.",
        options: [
        T("((1, 2), {'x': 3})", true),
        T("((1, 2), ('x', 3))"),
        T("([1, 2], {'x': 3})"),
        T("((1, 2, 3), {})"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra None thay vì 5. Vì sao?\n\n```python\ndef add(a, b):\n    total = a + b\n\nresult = add(2, 3)\nprint(result)\n```",
        explanation: "Hàm không có câu lệnh return thì mặc định trả về None; total chỉ là biến local, mất đi khi hàm kết thúc. Sửa bằng cách thêm return a + b (hoặc return total).",
        options: [
        T("Phải khai báo global result trước khi gọi add"),
        T("total là biến local nên bị xoá và được thay bằng 0"),
        T("Tham số a và b chưa có giá trị mặc định"),
        T("Hàm không có lệnh return nên mặc định trả về None", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Cho hàm bên dưới. Lời gọi `power(exp=3, base=2)` trả về bao nhiêu?\n\n```python\ndef power(base, exp=2):\n    return base ** exp\n```",
        explanation: "Đối số có tên được ghép theo tên tham số chứ không theo thứ tự: base = 2, exp = 3 nên 2 ** 3 = 8. Nếu ghép theo thứ tự vị trí (base = 3, exp = 2) mới ra 9.",
        options: [
        T("Báo TypeError vì đối số có tên phải đúng thứ tự"),
        T("9"),
        T("6"),
        T("8", true),
      ],
      },
      {
        type: "true_false",
        prompt: "Với biến toàn cục count = 0, chỉ cần viết `count += 1` trong hàm là tăng được count bên ngoài mà không cần khai báo gì thêm.",
        explanation: "Sai — count += 1 là phép gán nên Python coi count là biến local của hàm; vì nó chưa có giá trị nên báo UnboundLocalError. Muốn đổi biến bên ngoài phải khai báo global count trong hàm (hoặc tốt hơn: truyền vào và return).",
        options: [T("Đúng", false, "scope_leak"), T("Sai", true)],
      },
    ],
  },
  {
    match: "1.10 Lớp và đối tượng",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nclass Student:\n    university = \"Tech\"\n\n    def __init__(self, name):\n        self.name = name\n\na = Student(\"An\")\nb = Student(\"Binh\")\nStudent.university = \"NEU\"\nprint(a.university, b.university)\n```",
        explanation: "university là class attribute, dùng chung cho mọi object: a và b không giữ bản sao riêng mà đọc thẳng từ class. Đổi Student.university thì cả hai cùng thấy giá trị mới NEU.",
        options: [
        T("Tech Tech", false, "more_class_attr_copy"),
        T("Tech NEU"),
        T("NEU NEU", true),
        T("NEU Tech", false, "more_class_attr_copy"),
      ],
      },
      {
        type: "mcq",
        prompt: "Chạy đoạn code sau, điều gì xảy ra?\n\n```python\nclass Dog:\n    def __init__(self, name):\n        name = name\n\nd = Dog(\"Rex\")\nprint(d.name)\n```",
        explanation: "name = name chỉ gán tham số cho một biến local cùng tên, không tạo thuộc tính của object. Thiếu self. nên d không có thuộc tính name và d.name báo AttributeError. Đúng phải là self.name = name.",
        options: [
        T("TypeError, vì Dog(\"Rex\") thiếu đối số"),
        T("AttributeError, vì name = name chỉ tạo biến cục bộ", true),
        T("In ra None vì thuộc tính chưa có giá trị"),
        T("In ra Rex vì tham số name đã được lưu vào object", false, "more_missing_self"),
      ],
      },
      {
        type: "mcq",
        prompt: "Chạy đoạn code sau, Python báo lỗi gì?\n\n```python\nclass Student:\n    def __init__(self, name, gpa):\n        self.name = name\n        self.gpa = gpa\n\nan = Student(\"An\")\n```",
        explanation: "Khi tạo object, Python tự truyền object mới vào tham số self, bạn không viết nó ra. Lời gọi Student(\"An\") chỉ cung cấp name còn thiếu gpa, nên báo TypeError: missing 1 required positional argument: 'gpa'.",
        options: [
        T("AttributeError vì chưa có thuộc tính gpa"),
        T("Không lỗi, gpa tự có giá trị None"),
        T("TypeError vì thiếu đối số self", false, "more_self_passed_manually"),
        T("TypeError vì thiếu đối số gpa; self do Python tự truyền", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Phương thức __init__ của một class được Python chạy vào lúc nào?",
        explanation: "__init__ được gọi tự động đúng một lần cho MỖI object, ngay lúc tạo object (Student(\"An\", 3.8)); bạn không phải gọi tay. Định nghĩa class chưa tạo object nào nên chưa chạy __init__, và dùng object sau đó (gọi phương thức, gán thuộc tính) cũng không chạy lại nó.",
        options: [
        T("Tự động ngay khi tạo một object mới từ class", true),
        T("Chỉ khi bạn tự gọi nó bằng tay sau khi tạo object"),
        T("Mỗi lần bạn gọi một phương thức bất kỳ của object"),
        T("Một lần duy nhất, ngay khi class được định nghĩa"),
      ],
      },
    ],
  },
  {
    match: "1.11 Kế thừa, đóng gói và đa hình",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nclass Animal:\n    def speak(self):\n        return \"...\"\n\nclass Cat(Animal):\n    def speak(self):\n        return \"Meow\"\n\nclass Fish(Animal):\n    pass\n\nprint(Cat().speak(), Fish().speak())\n```",
        explanation: "Cat ghi đè (override) speak() nên trả về \"Meow\". Fish không định nghĩa gì thêm nên kế thừa nguyên speak() của Animal và trả về \"...\". Đây là kế thừa (Fish) kết hợp ghi đè (Cat).",
        options: [
        T("Meow ...", true),
        T("Meow Meow"),
        T("Báo AttributeError vì Fish không có speak()"),
        T("... ..."),
      ],
      },
      {
        type: "mcq",
        prompt: "Chạy đoạn code sau, điều gì xảy ra?\n\n```python\nclass Account:\n    def __init__(self):\n        self.__balance = 100\n\nacc = Account()\nprint(acc.__balance)\n```",
        explanation: "Thuộc tính bắt đầu bằng hai dấu gạch dưới bị Python đổi tên bên trong class (thành _Account__balance), nên truy cập trực tiếp bằng acc.__balance từ bên ngoài báo AttributeError. Ý đồ đóng gói là buộc code bên ngoài đi qua các phương thức như deposit().",
        options: [
        T("Báo TypeError vì __balance là hằng số"),
        T("In ra 100", false, "more_dunder_no_effect"),
        T("In ra None"),
        T("Báo AttributeError vì __balance không truy cập trực tiếp được từ ngoài class", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Trong các cặp class sau, cặp nào hợp lý để dùng kế thừa?",
        explanation: "Kế thừa mô tả quan hệ \"là một\" (is-a): Car là một Vehicle nên class Car(Vehicle) hợp lý. Engine là một BỘ PHẬN của Car (quan hệ \"có một\"), không phải một Car; quan hệ này nên biểu diễn bằng thuộc tính (car.engine), không phải kế thừa.",
        options: [
        T("class Student(Car), vì cả hai cùng có thuộc tính name"),
        T("class Car(Vehicle), vì một Car là một Vehicle", true),
        T("class Engine(Car), vì Engine là một phần của Car", false, "more_has_a_vs_is_a"),
        T("class Car(Engine), vì Car có một Engine", false, "more_has_a_vs_is_a"),
      ],
      },
      {
        type: "true_false",
        prompt: "Nếu lớp con ghi đè speak() mà không gọi super().speak(), thì khi gọi speak() trên object của lớp con, phương thức speak() của lớp cha sẽ không chạy.",
        explanation: "Đúng — ghi đè là thay thế hoàn toàn phương thức của lớp cha. Muốn vẫn chạy phần của lớp cha (mở rộng thay vì thay thế) thì phải gọi super().speak() bên trong.",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "Variables, Data Types, and Operators",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\na = [1]\nb = [1]\nprint(a == b, a is b)\n```",
        explanation: "== so sánh GIÁ TRỊ: hai list cùng nội dung [1] nên True. is kiểm tra có phải cùng MỘT đối tượng: a và b là hai list riêng biệt (mỗi dấu [] tạo một list mới) nên False.",
        options: [
        T("False False"),
        T("False True"),
        T("True True", false, "is_vs_eq"),
        T("True False", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Cần lưu họ tên theo mã sinh viên và tra ra tên ngay khi biết mã. Kiểu dữ liệu nào phù hợp nhất?",
        explanation: "dictionary lưu cặp khoá–giá trị, khoá là mã sinh viên (duy nhất) và giá trị là họ tên, tra cứu bằng ds[ma]. set chỉ chứa phần tử đơn lẻ và không có thứ tự, tuple là một dãy cố định, còn một chuỗi dài nối mọi tên thì không tra cứu theo mã được.",
        options: [
        T("set các họ tên: set không lưu được mã đi kèm"),
        T("dictionary: mã sinh viên là khoá, họ tên là giá trị", true),
        T("tuple (mã, tên) duy nhất cho cả lớp học"),
        T("chuỗi dài nối mọi mã và tên bằng dấu phẩy"),
      ],
      },
    ],
  },
  {
    match: "Control Flow: Conditionals and Loops",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì? (end=\"\" khiến các lần in nối liền nhau)\n\n```python\nfor n in range(1, 8):\n    if n % 3 == 0:\n        print(\"F\", end=\"\")\n    elif n % 2 == 0:\n        print(\"E\", end=\"\")\n    else:\n        print(n, end=\"\")\n```",
        explanation: "Với mỗi n, Python chạy nhánh đầu tiên có điều kiện đúng: n = 6 chia hết cho 3 nên nhánh F chạy trước và nhánh E bị bỏ qua dù 6 cũng chẵn. Kết quả: 1, E (n=2), F (n=3), E (n=4), 5, F (n=6), 7 tức 1EFE5F7.",
        options: [
        T("1EFE5E7"),
        T("1EFE5F7", true),
        T("12F45F7"),
        T("1EFE5FE7"),
      ],
      },
      {
        type: "mcq",
        prompt: "Vòng lặp `while True:` (điều kiện luôn đúng) kết thúc bằng cách nào? Ví dụ:\n\n```python\nn = 0\nwhile True:\n    n += 1\n    if n == 3:\n        break\nprint(n)\n```",
        explanation: "Vì điều kiện True không bao giờ sai, vòng lặp chỉ dừng khi bên trong có break (hoặc return, hoặc một lỗi). Ở đây n tăng tới 3 thì break chạy và thoát vòng lặp, nên in 3. Không có break thì vòng lặp chạy vô hạn.",
        options: [
        T("Sau đúng một lượt, giống như câu lệnh if"),
        T("Khi Python thấy biến đầu tiên của thân vòng lặp đổi giá trị"),
        T("Chỉ khi gặp break (hoặc return) bên trong thân vòng lặp", true),
        T("Không bao giờ, kể cả khi thân vòng lặp có break"),
      ],
      },
    ],
  },
  {
    match: "Functions",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\npairs = [(\"An\", 8), (\"Binh\", 6), (\"Chi\", 9)]\nprint(sorted(pairs, key=lambda p: p[1])[0][0])\n```",
        explanation: "key=lambda p: p[1] sắp xếp theo điểm (phần tử thứ hai của mỗi cặp), tăng dần: Binh (6), An (8), Chi (9). [0] lấy cặp đầu là (\"Binh\", 6), rồi [0] lấy tên: Binh. Người có điểm cao nhất (Chi) sẽ ở cuối danh sách.",
        options: [
        T("An"),
        T("6"),
        T("Chi"),
        T("Binh", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Cho hàm bên dưới. Lời gọi nào báo TypeError?\n\n```python\ndef f(a, b=2):\n    return a + b\n```",
        explanation: "a là tham số bắt buộc (không có giá trị mặc định) nên f(b=1) thiếu a và báo TypeError. Ba lời gọi còn lại đều đủ a: f(1) dùng b mặc định 2; f(1, b=5) và f(b=5, a=1) truyền đủ hai tham số (đối số có tên có thể đứng bất kỳ thứ tự nào).",
        options: [
        T("f(1, b=5)"),
        T("f(b=1)", true),
        T("f(1)"),
        T("f(b=5, a=1)"),
      ],
      },
    ],
  },
  {
    match: "Basic Object-Oriented Programming",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nclass Student:\n    school = \"NEU\"\n\n    def __init__(self, name):\n        self.name = name\n\na = Student(\"An\")\na.school = \"HUST\"\nb = Student(\"Binh\")\nprint(a.school, b.school, Student.school)\n```",
        explanation: "Gán a.school = \"HUST\" tạo một thuộc tính riêng của object a (che thuộc tính của class), không đổi class attribute. b vẫn đọc school từ class nên là NEU, và Student.school vẫn là NEU. Muốn đổi cho mọi object phải gán qua tên class: Student.school = ...",
        options: [
        T("HUST HUST HUST", false, "attr_shared"),
        T("HUST NEU NEU", true),
        T("HUST HUST NEU"),
        T("NEU NEU NEU"),
      ],
      },
      {
        type: "mcq",
        prompt: "Class Student có thuộc tính gpa. Bạn muốn chặn code bên ngoài gán gpa = -5 tuỳ tiện. Nên áp dụng khái niệm OOP nào?",
        explanation: "Đó là đóng gói (encapsulation): lưu điểm ở thuộc tính riêng như self.__gpa và chỉ cho đổi qua một phương thức có kiểm tra hợp lệ (ví dụ từ chối giá trị âm). Kế thừa dùng lại code của lớp cha, đa hình cho cùng tên phương thức hành vi khác nhau, còn class attribute chỉ làm dữ liệu dùng chung — không cái nào bảo vệ dữ liệu.",
        options: [
        T("Kế thừa: tạo lớp con của Student để chứa gpa", false, "inherit_vs_poly"),
        T("Đóng gói: lưu ở self.__gpa và chỉ đổi qua phương thức có kiểm tra", true),
        T("Đa hình: viết nhiều phương thức cùng tên gpa", false, "inherit_vs_poly"),
        T("Class attribute: đặt gpa ở cấp class để dùng chung"),
      ],
      },
    ],
  },
  {
    match: "NumPy Arrays",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nimport numpy as np\n\nprint(np.linspace(0, 10, 5))\n```",
        explanation: "np.linspace(start, stop, num) sinh num điểm cách đều, GỒM cả hai đầu: 5 điểm từ 0 đến 10 là 0, 2.5, 5, 7.5, 10 (kiểu số thực). Dãy [0 2 4 6 8] là của np.arange(0, 10, 2) — arange nhận bước nhảy và dừng trước điểm cuối, còn linspace nhận SỐ ĐIỂM.",
        options: [
        T("[0 2 4 6 8]", false, "more_linspace_arange"),
        T("[0. 2. 4. 6. 8.]", false, "more_linspace_arange"),
        T("[ 0.   2.5  5.   7.5 10. ]", true),
        T("[ 2.5  5.   7.5 10. ]"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nimport numpy as np\n\ng = np.array([[10, 20, 30],\n              [40, 50, 60],\n              [70, 80, 90]])\nprint(g[:, 1], g[2])\n```",
        explanation: "g[hàng, cột] với dấu : nghĩa là \"tất cả\". g[:, 1] lấy cột 1 của mọi hàng: [20 50 80]. g[2] lấy cả hàng 2: [70 80 90]. Hai kết quả bị hoán đổi ([40 50 60] [30 60 90] là g[1] và g[:, 2]) khi nhầm hàng với cột.",
        options: [
        T("[10 40 70] [70 80 90]"),
        T("[20 50 80] [30 60 90]"),
        T("[20 50 80] [70 80 90]", true),
        T("[40 50 60] [30 60 90]"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn `np.array([1, 2, 3]).reshape(2, 2)` báo ValueError. Vì sao?",
        explanation: "reshape chỉ đổi cách xếp các phần tử chứ không thêm hay bớt: kích thước mới phải có đúng tổng số phần tử cũ. Mảng có 3 phần tử không xếp vừa lưới 2 × 2 = 4 ô. Với np.arange(4).reshape(2, 2) thì được vì 2 × 2 = 4.",
        options: [
        T("reshape chỉ dùng được với mảng tạo bằng np.arange"),
        T("Mảng có 3 phần tử, không xếp vừa 2 × 2 = 4 ô; reshape phải giữ nguyên tổng số phần tử", true),
        T("reshape chỉ nhận đúng một số làm đối số"),
        T("Mảng phải có kiểu số thực (float) mới reshape được"),
      ],
      },
      {
        type: "true_false",
        prompt: "Với a = np.array([1, 2.5]), phần tử a[0] vẫn giữ kiểu số nguyên vì bạn nhập 1 (không có phần thập phân).",
        explanation: "Sai — mảng NumPy chứa các số CÙNG kiểu: chỉ cần một số thực là cả mảng thành float64, nên a[0] là 1.0 (in ra [1.  2.5]). Đó là lý do mảng lưu gọn và tính toán nhanh, khác với list cho phép trộn kiểu.",
        options: YES_NO(false),
      },
    ],
  },
  {
    match: "Pandas DataFrames",
    questions: [
      {
        type: "mcq",
        prompt: "```python\nimport pandas as pd\n\ndf = pd.DataFrame({\n    \"name\":  [\"An\", \"Binh\", \"Chi\", \"Dung\", \"Em\"],\n    \"major\": [\"IT\", \"IT\", \"Econ\", \"Econ\", \"IT\"],\n    \"score\": [8.5, 7.0, 9.0, 6.5, 7.5],\n})\n\nprint(df[(df[\"major\"] == \"Econ\") | (df[\"score\"] >= 8.5)][\"name\"].tolist())\n```\n\nĐoạn code in ra gì?",
        explanation: "| là \"hoặc\": giữ hàng thoả ít nhất một điều kiện. Ngành Econ có Chi (9.0) và Dung (6.5); điểm ≥ 8.5 có An (8.5) và Chi (9.0). Hợp lại là An, Chi, Dung. Nếu dùng & (\"và\") thì chỉ còn Chi, người thoả cả hai.",
        options: [
        T("['An', 'Binh', 'Chi', 'Dung', 'Em']"),
        T("['An', 'Chi']"),
        T("['An', 'Chi', 'Dung']", true),
        T("['Chi']", false, "more_and_or_mask"),
      ],
      },
      {
        type: "mcq",
        prompt: "```python\nimport pandas as pd\n\ndf = pd.DataFrame({\n    \"name\":  [\"An\", \"Binh\", \"Chi\", \"Dung\", \"Em\"],\n    \"major\": [\"IT\", \"IT\", \"Econ\", \"Econ\", \"IT\"],\n    \"score\": [8.5, 7.0, 9.0, 6.5, 7.5],\n})\n\ndf[df[\"major\"] == \"IT\" and df[\"score\"] > 7]\n```\n\nĐoạn code báo ValueError (The truth value of a Series is ambiguous). Cách sửa đúng là gì?",
        explanation: "and chỉ làm việc với một giá trị True/False, còn df[\"major\"] == \"IT\" là cả một Series nhiều giá trị. Để kết hợp điều kiện theo từng hàng phải dùng & (và), | (hoặc), và đặt mỗi điều kiện trong ngoặc tròn: df[(df[\"major\"] == \"IT\") & (df[\"score\"] > 7)].",
        options: [
        T("Đổi dấu ngoặc vuông ngoài cùng thành df.iloc[...]"),
        T("Thay and bằng dấu phẩy giữa hai điều kiện"),
        T("Bỏ điều kiện thứ hai và chỉ lọc theo major"),
        T("Thay and bằng & và đặt mỗi điều kiện trong ngoặc tròn", true),
      ],
      },
      {
        type: "mcq",
        prompt: "```python\nimport pandas as pd\n\ndf = pd.DataFrame({\n    \"name\":  [\"An\", \"Binh\", \"Chi\", \"Dung\", \"Em\"],\n    \"major\": [\"IT\", \"IT\", \"Econ\", \"Econ\", \"IT\"],\n    \"score\": [8.5, 7.0, 9.0, 6.5, 7.5],\n})\n\nprint(df.sort_values(\"score\").head(2)[\"name\"].tolist())\n```\n\nĐoạn code in ra gì?",
        explanation: "sort_values(\"score\") sắp xếp tăng dần theo điểm: Dung (6.5), Binh (7.0), Em (7.5), An (8.5), Chi (9.0). head(2) lấy hai hàng đầu nên tên là ['Dung', 'Binh']. Muốn hai người điểm cao nhất phải thêm ascending=False (khi đó ra ['Chi', 'An']).",
        options: [
        T("['Dung', 'Binh']", true),
        T("['An', 'Binh']"),
        T("['Binh', 'Dung']"),
        T("['Chi', 'An']"),
      ],
      },
      {
        type: "true_false",
        prompt: "```python\nimport pandas as pd\n\ndf = pd.DataFrame({\n    \"name\":  [\"An\", \"Binh\", \"Chi\", \"Dung\", \"Em\"],\n    \"major\": [\"IT\", \"IT\", \"Econ\", \"Econ\", \"IT\"],\n    \"score\": [8.5, 7.0, 9.0, 6.5, 7.5],\n})\n```\n\nMặc định, `df.describe()` thống kê cả các cột chữ `name`, `major` bên cạnh cột số `score`.",
        explanation: "Sai — mặc định describe() chỉ thống kê các cột số; với df này kết quả chỉ có cột score (count, mean, std, min, các phân vị, max). Muốn xem cả cột chữ phải truyền thêm include=\"all\".",
        options: YES_NO(false),
      },
    ],
  },
  {
    match: "Data Cleaning and Transformation",
    questions: [
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nimport pandas as pd\n\nd = pd.DataFrame({\"a\": [1, None, 3, 4], \"b\": [\"x\", \"y\", None, \"w\"]})\nprint(d.dropna().shape)\n```",
        explanation: "dropna() trên DataFrame mặc định bỏ mọi dòng có ÍT NHẤT MỘT ô thiếu. Dòng 1 thiếu ở cột a, dòng 2 thiếu ở cột b nên cả hai bị bỏ; còn lại dòng 0 và dòng 3, shape (2, 2). Số dòng vẫn là 4 chỉ khi tưởng dropna chỉ bỏ dòng mà MỌI ô đều thiếu.",
        options: [
        T("(2, 1)"),
        T("(4, 2)", false, "more_dropna_all"),
        T("(2, 2)", true),
        T("(3, 2)"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nimport pandas as pd\n\nmajor = pd.Series([\" IT\", \"it\", \"IT \", \"Econ\", \"econ\"])\nprint(len(major.unique()), len(major.str.strip().str.lower().unique()))\n```",
        explanation: "Trước khi chuẩn hoá, năm giá trị \" IT\", \"it\", \"IT \", \"Econ\", \"econ\" đều khác nhau nên có 5 nhóm. Sau strip() + lower() chỉ còn \"it\" và \"econ\": 2 nhóm. Đó là lý do phải chuẩn hoá chuỗi trước khi groupby hay đếm.",
        options: [
        T("5 5"),
        T("5 2", true),
        T("2 2"),
        T("3 1"),
      ],
      },
      {
        type: "mcq",
        prompt: "```python\nimport pandas as pd\n\ndiem = pd.Series([\"8\", \"N/A\", \"7\", \"9\"])\n```\n\nCột điểm bị đọc thành chữ vì có chuỗi \"N/A\". Lệnh nào chuyển cột về số và biến \"N/A\" thành NaN?",
        explanation: "pd.to_numeric(..., errors=\"coerce\") chuyển được chuỗi số thành số và biến giá trị hỏng như \"N/A\" thành NaN. astype(int) báo ValueError vì gặp \"N/A\". fillna(0) không làm gì vì \"N/A\" chỉ là một chuỗi bình thường chứ chưa phải NaN. drop_duplicates() chỉ bỏ dòng trùng, không đổi kiểu.",
        options: [
        T("diem.astype(int)"),
        T("diem.drop_duplicates()"),
        T("pd.to_numeric(diem, errors=\"coerce\")", true),
        T("diem.fillna(0)", false, "more_na_string_is_nan"),
      ],
      },
      {
        type: "true_false",
        prompt: "Với d = pd.DataFrame({\"id\": [1, 1, 1, 2], \"v\": [\"a\", \"a\", \"a\", \"b\"]}) (ba dòng giống hệt nhau và một dòng khác), `d.duplicated().sum()` bằng 2, vì lần xuất hiện đầu tiên của nhóm trùng không được tính là trùng.",
        explanation: "Đúng — duplicated() đánh dấu True cho các dòng lặp lại một dòng ĐÃ xuất hiện trước đó, còn lần đầu tiên là False. Ba dòng giống nhau cho hai giá trị True, nên tổng là 2 (và drop_duplicates() giữ lại 2 dòng: một dòng đại diện của nhóm trùng và dòng còn lại).",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "Aggregation and Exploratory Data Analysis in Jupyter",
    questions: [
      {
        type: "mcq",
        prompt: "```python\nimport pandas as pd\n\nsales = pd.DataFrame({\n    \"region\":  [\"N\", \"S\", \"N\", \"S\", \"N\", \"C\"],\n    \"product\": [\"A\", \"A\", \"B\", \"B\", \"A\", \"B\"],\n    \"revenue\": [100, 150, 200, 50, 300, 120],\n})\n\nr = sales.groupby(\"product\")[\"revenue\"].agg([\"count\", \"max\"])\nprint(r.loc[\"B\", \"count\"], r.loc[\"B\", \"max\"])\n```\n\nĐoạn code in ra gì?",
        explanation: "Sản phẩm B có ba dòng doanh thu 200, 50, 120: count là số dòng = 3, max là giá trị lớn nhất = 200. Tổng là 370 nhưng đề không hỏi sum, và 120 chỉ là doanh thu của dòng cuối.",
        options: [
        T("3 120"),
        T("6 200"),
        T("3 370"),
        T("3 200", true),
      ],
      },
      {
        type: "mcq",
        prompt: "```python\nimport pandas as pd\n\nsales = pd.DataFrame({\n    \"region\":  [\"N\", \"S\", \"N\", \"S\", \"N\", \"C\"],\n    \"product\": [\"A\", \"A\", \"B\", \"B\", \"A\", \"B\"],\n    \"revenue\": [100, 150, 200, 50, 300, 120],\n})\n\npv = sales.pivot_table(index=\"region\", columns=\"product\",\n                       values=\"revenue\", aggfunc=\"sum\")\nprint(pv.loc[\"N\", \"A\"])\n```\n\nĐoạn code in ra gì?",
        explanation: "Vùng N có hai dòng bán sản phẩm A: 100 và 300. pivot_table với aggfunc=\"sum\" cộng chúng lại ở ô (N, A): 400 (pandas in 400.0 vì bảng có ô NaN nên cả bảng là số thực). 600.0 là tổng cả vùng N (gồm cả sản phẩm B), 100.0 chỉ là dòng đầu, còn 200.0 là ô (N, B).",
        options: [
        T("200.0"),
        T("400.0", true),
        T("100.0"),
        T("600.0"),
      ],
      },
      {
        type: "mcq",
        prompt: "Bạn vừa nhận một file CSV mới chưa biết gì về nó. Việc nên làm ĐẦU TIÊN là gì?",
        explanation: "Bước đầu của quy trình khám phá là xem tổng quan: df.shape (bao nhiêu hàng, cột), df.head() (vài dòng mẫu), df.info() (kiểu dữ liệu, ô thiếu). Chưa biết dữ liệu có gì thì vẽ tương quan, điền ô thiếu bằng 0 hay groupby đều dễ dẫn tới kết luận sai; những bước đó đến sau.",
        options: [
        T("Vẽ ngay biểu đồ tương quan giữa mọi cặp cột", false, "more_eda_skip_overview"),
        T("Chạy groupby theo từng cột để so sánh các nhóm", false, "more_eda_skip_overview"),
        T("Điền mọi ô thiếu bằng 0 cho dữ liệu gọn gàng", false, "more_eda_skip_overview"),
        T("Xem tổng quan bằng df.shape, df.head() và df.info()", true),
      ],
      },
      {
        type: "true_false",
        prompt: "Hệ số tương quan giữa hai biến gần 0 chứng tỏ hai biến độc lập nhau, không có bất kỳ mối liên hệ nào.",
        explanation: "Sai — hệ số tương quan chỉ đo mức liên hệ TUYẾN TÍNH. Ví dụ x = [-2, -1, 0, 1, 2] và y = x² có quan hệ hoàn toàn xác định nhưng x.corr(y) bằng 0. Vì vậy nên vẽ biểu đồ chứ không chỉ nhìn một con số.",
        options: [T("Đúng", false, "more_corr_zero_independent"), T("Sai", true)],
      },
    ],
  },
  {
    match: "Retrieving Data via RESTful APIs",
    questions: [
      {
        type: "mcq",
        prompt: "Chương trình gọi API liên tục và bắt đầu nhận mã trạng thái 429. Nên xử lý thế nào?",
        explanation: "429 Too Many Requests nghĩa là bạn gọi quá nhanh nên bị giới hạn tốc độ (lỗi nhóm 4xx, do phía người gọi). Cách đúng là gọi chậm lại, chờ giữa các lần gọi. Gọi dồn dập hơn chỉ làm bị chặn lâu hơn; 429 không phải lỗi máy chủ (5xx) và không liên quan GET hay POST.",
        options: [
        T("Đổi sang POST vì GET đã bị chặn", false, "http_get_post"),
        T("Gọi dồn dập hơn cho tới khi được chấp nhận", false, "more_rate_limit_flood"),
        T("Chờ giữa các lần gọi hoặc giảm tần suất gọi", true),
        T("Bỏ qua vì 429 nghĩa là máy chủ bị hỏng", false, "http_status"),
      ],
      },
      {
        type: "mcq",
        prompt: "Đoạn code sau in ra gì?\n\n```python\nimport json\n\ndata = json.loads('{\"ok\": true, \"items\": [{\"id\": 1}, {\"id\": 2}]}')\nprint(data[\"ok\"], data[\"items\"][1][\"id\"], type(data[\"items\"]).__name__)\n```",
        explanation: "json.loads đổi JSON true thành True của Python, JSON array thành list và JSON object thành dict. data[\"items\"] là list hai dict; chỉ số 1 là {\"id\": 2}; [\"id\"] cho 2. Kiểu của data[\"items\"] là list. Chữ thường true chỉ tồn tại trong văn bản JSON, không phải trong Python.",
        options: [
        T("True 1 list"),
        T("True 2 list", true),
        T("true 2 list", false, "more_json_literals"),
        T("True 2 dict"),
      ],
      },
      {
        type: "mcq",
        prompt: "Một API chia dữ liệu thành các trang. Sau khi gọi hai trang, ta có đoạn code sau (mỗi phần tử là một bản ghi). Nó in ra gì?\n\n```python\nimport pandas as pd\n\npage1 = [{\"id\": 1}, {\"id\": 2}]\npage2 = [{\"id\": 3}]\nrows = page1 + page2\nprint(pd.DataFrame(rows).shape)\n```",
        explanation: "page1 + page2 nối hai list thành một list 3 bản ghi. pd.DataFrame(rows) tạo bảng có mỗi dict thành một hàng và mỗi khoá thành một cột: 3 hàng, 1 cột (id), tức shape (3, 1).",
        options: [
        T("(3, 1)", true),
        T("(2, 1)"),
        T("(1, 3)"),
        T("(3, 2)"),
      ],
      },
      {
        type: "true_false",
        prompt: "Lệnh `resp.raise_for_status()` báo lỗi (HTTPError) khi mã trạng thái là 4xx hoặc 5xx, và không làm gì khi mã là 200.",
        explanation: "Đúng — raise_for_status() biến các phản hồi lỗi (4xx phía người gọi, 5xx phía máy chủ) thành ngoại lệ để chương trình không vô tình đọc dữ liệu của một phản hồi lỗi; với 200 nó im lặng cho chạy tiếp.",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "Web Scraping with BeautifulSoup",
    questions: [
      {
        type: "mcq",
        prompt: "```python\nfrom bs4 import BeautifulSoup\n\nhtml = \"\"\"<ul id=\"items\">\n<li class=\"item\"><a href=\"/p/1\">Pen</a> <span class=\"price\">3.5</span></li>\n<li class=\"item\"><a href=\"/p/2\">Book</a> <span class=\"price\">12</span></li>\n<li class=\"item sale\"><a href=\"/p/3\">Bag</a> <span class=\"price\">20</span></li>\n</ul>\"\"\"\nsoup = BeautifulSoup(html, \"html.parser\")\n```\n\nMuốn lấy thẻ span.price chỉ của mặt hàng có class sale (Bag, giá 20). Lệnh select nào đúng?",
        explanation: "li.sale chọn thẻ li có class sale (dấu . là class); khoảng trắng rồi span.price chọn thẻ span class price nằm bên trong. Dấu # dành cho id nên li#sale không khớp gì (kết quả rỗng); span.sale không tồn tại (class sale nằm trên li); price không phải tên thẻ. Ba lệnh sai đều trả về list rỗng.",
        options: [
        T("soup.select(\"li.sale > price\")"),
        T("soup.select(\"li.sale span.price\")", true),
        T("soup.select(\"li span.sale\")"),
        T("soup.select(\"li#sale span.price\")", false, "more_css_id_class"),
      ],
      },
      {
        type: "mcq",
        prompt: "```python\nfrom bs4 import BeautifulSoup\n\nhtml = \"\"\"<ul id=\"items\">\n<li class=\"item\"><a href=\"/p/1\">Pen</a> <span class=\"price\">3.5</span></li>\n<li class=\"item\"><a href=\"/p/2\">Book</a> <span class=\"price\">12</span></li>\n<li class=\"item sale\"><a href=\"/p/3\">Bag</a> <span class=\"price\">20</span></li>\n</ul>\"\"\"\nsoup = BeautifulSoup(html, \"html.parser\")\n\nprint(soup.find(\"span\").get(\"href\"))\n```\n\nĐoạn code in ra gì?",
        explanation: "Thẻ span đầu tiên (giá 3.5) chỉ có class, không có thuộc tính href. .get(\"href\") trả về None khi thiếu thuộc tính, không báo lỗi. Ngược lại soup.find(\"span\")[\"href\"] (dùng ngoặc vuông) mới báo KeyError.",
        options: [
        T("None", true),
        T("Một chuỗi rỗng"),
        T("Báo KeyError", false, "more_bs_get_raises"),
        T("/p/1"),
      ],
      },
      {
        type: "mcq",
        prompt: "```python\nfrom bs4 import BeautifulSoup\n\nhtml = \"\"\"<ul id=\"items\">\n<li class=\"item\"><a href=\"/p/1\">Pen</a> <span class=\"price\">3.5</span></li>\n<li class=\"item\"><a href=\"/p/2\">Book</a> <span class=\"price\">12</span></li>\n<li class=\"item sale\"><a href=\"/p/3\">Bag</a> <span class=\"price\">20</span></li>\n</ul>\"\"\"\nsoup = BeautifulSoup(html, \"html.parser\")\n\nprice = soup.select_one(\"span.price\").text\nprint(price * 2)\n```\n\nĐoạn code in ra gì?",
        explanation: ".text luôn trả về chuỗi: price là \"3.5\" (str), và \"3.5\" * 2 là phép lặp chuỗi cho \"3.53.5\". Muốn nhân đôi giá trị số phải ép kiểu trước: float(price) * 2 = 7.0.",
        options: [
        T("Báo TypeError"),
        T("7.0", false, "more_bs_text_number"),
        T("7", false, "more_bs_text_number"),
        T("3.53.5", true),
      ],
      },
      {
        type: "mcq",
        prompt: "Trang web bạn cần lấy dữ liệu có cung cấp một API công khai trả đúng dữ liệu đó. Nên làm gì?",
        explanation: "Nên ưu tiên API: dữ liệu có cấu trúc (JSON), ổn định và được dịch vụ cho phép rõ ràng. HTML có thể đổi bố cục bất cứ lúc nào và scrape dễ vướng điều khoản. Scrape chỉ là phương án khi không có API và việc thu thập được phép.",
        options: [
        T("Vẫn scrape HTML vì như vậy nhanh hơn viết code gọi API", false, "scrape_rules"),
        T("Scrape HTML trước, chỉ thử API khi bị chặn", false, "scrape_rules"),
        T("Dùng API, vì dữ liệu có cấu trúc và được cho phép rõ ràng", true),
        T("Hai cách như nhau nên chọn ngẫu nhiên"),
      ],
      },
    ],
  },
];


// ─────────────────────────────────────────────────────────────────────────
// Runner
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

function validate() {
  const seen = new Set<string>();
  for (const m of MORE) {
    for (const q of m.questions) {
      const where = `${m.match}: "${q.prompt.slice(0, 50)}…"`;
      const right = q.options.filter((o) => o.correct).length;
      if (right !== 1) throw new Error(`${where} has ${right} correct options`);
      if (q.type === "mcq" && q.options.length !== 4) throw new Error(`${where} mcq needs 4 options`);
      if (q.type === "true_false" && q.options.length !== 2) throw new Error(`${where} true_false needs 2 options`);
      if (!q.explanation.trim()) throw new Error(`${where} has no explanation`);
      if (new Set(q.options.map((o) => o.label)).size !== q.options.length) throw new Error(`${where} has duplicate option labels`);
      if (seen.has(q.prompt)) throw new Error(`${where} duplicates another new question`);
      seen.add(q.prompt);
    }
  }
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  validate();

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  // Resolve every lesson and its quiz first, so a typo fails before anything is written.
  const resolved = [];
  for (const m of MORE) {
    const lessons = await prisma.lesson.findMany({
      where: { module: { courseId: course.id }, title: m.match },
      include: {
        quizzes: {
          where: { cuepointOnly: false },
          include: { questions: { select: { id: true, prompt: true, orderIndex: true, skillTags: { select: { skillId: true } } } } },
        },
      },
    });
    if (lessons.length !== 1) throw new Error(`lesson "${m.match}": found ${lessons.length}`);
    const lesson = lessons[0]!;
    if (lesson.quizzes.length !== 1) throw new Error(`lesson "${m.match}": expected one quiz, found ${lesson.quizzes.length}`);
    const quiz = lesson.quizzes[0]!;
    const skillId = quiz.questions.flatMap((q) => q.skillTags).map((t) => t.skillId)[0];
    if (!skillId) throw new Error(`lesson "${m.match}": no skill tag on its existing questions`);
    resolved.push({ m, quiz, skillId });
  }

  const total = MORE.reduce((s, m) => s + m.questions.length, 0);
  if (dryRun) {
    console.log(`DRY RUN — ${total} questions over ${MORE.length} lessons\n`);
    for (const { m, quiz } of resolved) {
      const have = new Set(quiz.questions.map((q) => q.prompt));
      const fresh = m.questions.filter((q) => !have.has(rich(q.prompt))).length;
      console.log(`  ${m.match.padEnd(58)} quiz now ${String(quiz.questions.length).padStart(2)}  +${fresh}`);
    }
    return;
  }

  const misIds = new Map<string, string>();
  for (const [key, mis] of Object.entries(MORE_MIS)) {
    const row = await prisma.misconception.upsert({
      where: { code: mis.code },
      update: { name: mis.name, description: mis.description },
      create: mis,
    });
    misIds.set(key, row.id);
  }
  const existingMis = new Map((await prisma.misconception.findMany({ select: { id: true, code: true } })).map((r) => [r.code, r.id]));
  const misIdOf = (key: string | undefined): { misconceptionId: string } | Record<string, never> => {
    if (!key) return {};
    const code = EXISTING_MIS_CODES[key];
    const id = misIds.get(key) ?? (code ? existingMis.get(code) : undefined);
    if (!id) throw new Error(`unknown misconception key: ${key}`);
    return { misconceptionId: id };
  };

  let added = 0;
  for (const { m, quiz, skillId } of resolved) {
    const have = new Set(quiz.questions.map((q) => q.prompt));
    let next = Math.max(-1, ...quiz.questions.map((q) => q.orderIndex)) + 1;
    let n = 0;
    for (const q of m.questions) {
      const prompt = rich(q.prompt);
      if (have.has(prompt)) continue;
      await createQuestion(
        actor,
        quiz.id,
        {
          type: q.type,
          prompt,
          explanation: q.explanation,
          points: 1,
          orderIndex: next++,
          options: q.options.map((o) => ({ label: o.label, isCorrect: o.correct ?? false, ...misIdOf(o.mis) })),
          skillIds: [skillId],
        },
        prisma,
      );
      n++;
    }
    added += n;
    console.log(`${m.match} — +${n}`);
  }
  console.log(`\nAdded ${added} questions.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
