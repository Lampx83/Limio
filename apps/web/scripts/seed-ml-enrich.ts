/**
 * Enrich "Fundamental of Machine Learning":
 *   1. Nguyễn Hùng Việt becomes the course owner (the lecturer in the videos);
 *      the previous owner stays on as co-instructor so they keep edit rights.
 *   2. Course description gets a Vietnamese version above the English one.
 *   3. The 13 syllabus lessons — until now a paragraph of English each — are
 *      rewritten in Vietnamese with worked examples, code, and the mistakes
 *      learners actually make, and each gains a short quiz.
 *
 *   tsx scripts/seed-ml-enrich.ts [--dry-run]
 *
 * Idempotent: lessons are matched by their current title (English or the new
 * bilingual one), and a lesson that already has a quiz is left alone.
 */
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { prisma } from "@feedbackme/db";
import { RoleName } from "@feedbackme/shared-types";
import { createQuiz, createQuestion } from "@feedbackme/core-lms";

const COURSE_SLUG = "fundamental-of-machine-learning";
const BCRYPT_COST = 12;

const LECTURER = {
  email: "vietnh@neu.edu.vn",
  displayName: "Nguyễn Hùng Việt",
};

const DESCRIPTION_VI =
  "Khoá học trang bị kỹ năng học máy ứng dụng được ngay trong công việc, dùng Python và thư viện Scikit-learn. " +
  "Người học sẽ: áp dụng các kỹ thuật chuẩn bị dữ liệu và kiểm soát đánh đổi bias-variance để mô hình đạt hiệu năng tốt nhất; " +
  "cài đặt các thuật toán học máy cốt lõi gồm hồi quy tuyến tính, cây quyết định và máy vector hỗ trợ (SVM) cho cả bài toán phân loại lẫn hồi quy; " +
  "đánh giá và tinh chỉnh mô hình bằng các độ đo phù hợp, kiểm định chéo và tối ưu siêu tham số để đảm bảo độ tin cậy và độ chính xác.\n\n" +
  "Trường Công nghệ — Đại học Kinh tế Quốc dân. 2 tín chỉ — 30 giờ học (20 giờ trên lớp, 10 giờ tự học) trong 4 tuần. " +
  "Khai giảng tháng 02/2026. Học phần tiên quyết: Nhập môn lập trình; Lập trình cho khoa học dữ liệu; Nhập môn phân tích dữ liệu. " +
  "Đánh giá: Bài tập nhóm và thuyết trình (40%), Thi cuối kỳ (60%).\n\n" +
  "---\n\n";

interface Opt {
  label: string;
  correct?: boolean;
  mis?: string;
  extra?: Record<string, unknown>;
}
interface Q {
  type: "mcq" | "true_false" | "fill_in" | "numerical" | "ordering" | "short_answer";
  prompt: string;
  explanation?: string;
  options?: Opt[];
  extra?: Record<string, unknown>;
}
interface LessonPlan {
  /** Current title in the DB — how we find the row. */
  match: string;
  /** New bilingual title. */
  title: string;
  description: string;
  body: string;
  /** Skill code already tagged on this lesson; questions reuse it. */
  skillCode: string;
  quiz: { title: string; questions: Q[] };
}

const LESSONS: LessonPlan[] = [
  // ───────────────── Module 1 ─────────────────
  {
    match: "Handling Missing Values",
    title: "Xử lý giá trị thiếu (Handling Missing Values)",
    description: "Nhận diện, hiểu nguyên nhân và xử lý ô trống trong dữ liệu trước khi huấn luyện.",
    skillCode: "ml.data_prep.missing_values",
    body:
      "## Xử lý giá trị thiếu\n\n" +
      "Dữ liệu thật gần như luôn có ô trống. Bỏ qua chúng thì mô hình không chạy được; xử lý sai thì mô hình học phải thông tin bịa.\n\n" +
      "### Vì sao dữ liệu bị thiếu — và vì sao điều đó quan trọng\n\n" +
      "Không phải mọi ô trống đều giống nhau:\n\n" +
      "| Kiểu thiếu | Nghĩa là gì | Ví dụ |\n" +
      "|---|---|---|\n" +
      "| Thiếu ngẫu nhiên hoàn toàn | Ô trống không liên quan gì tới dữ liệu | Cảm biến mất điện vài phút |\n" +
      "| Thiếu có điều kiện | Xác suất thiếu phụ thuộc cột khác | Người thu nhập cao ngại khai thu nhập |\n" +
      "| Thiếu không ngẫu nhiên | Xác suất thiếu phụ thuộc chính giá trị bị thiếu | Bệnh nhân nặng bỏ dở khảo sát |\n\n" +
      "Hai kiểu sau nguy hiểm hơn: **bản thân việc thiếu đã mang thông tin**. Điền bừa vào đó là xoá mất tín hiệu.\n\n" +
      "### Ba cách xử lý phổ biến\n\n" +
      "**1. Xoá dòng** — chỉ nên dùng khi số dòng thiếu rất nhỏ (dưới ~5%) và thiếu ngẫu nhiên.\n\n" +
      "```python\n" +
      "data = data.dropna()              # xoá mọi dòng có bất kỳ ô trống nào\n" +
      "data = data.dropna(subset=[\"BMI\"])  # chỉ xét cột BMI\n" +
      "```\n\n" +
      "**2. Điền bằng thống kê (imputation)** — giữ lại dòng, thay ô trống bằng một giá trị đại diện.\n\n" +
      "```python\n" +
      "data[\"BMI\"] = data[\"BMI\"].fillna(data[\"BMI\"].median())   # số: median an toàn hơn mean\n" +
      "data[\"city\"] = data[\"city\"].fillna(data[\"city\"].mode()[0])  # hạng mục: giá trị hay gặp nhất\n" +
      "```\n\n" +
      "**Vì sao median thường tốt hơn mean:** mean bị kéo lệch bởi giá trị ngoại lai. Một căn biệt thự 100 tỷ trong tập giá nhà sẽ kéo mean lên cao, khiến mọi ô trống bị điền một giá trị phi thực tế. Median không bị vậy.\n\n" +
      "**3. Thêm cột đánh dấu** — khi việc thiếu tự nó có ý nghĩa:\n\n" +
      "```python\n" +
      "data[\"BMI_missing\"] = data[\"BMI\"].isna().astype(int)\n" +
      "data[\"BMI\"] = data[\"BMI\"].fillna(data[\"BMI\"].median())\n" +
      "```\n\n" +
      "Cách này giữ được cả hai: giá trị điền để mô hình chạy, và tín hiệu \"chỗ này vốn trống\".\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Tính median trên toàn bộ dữ liệu rồi mới chia train/test.** Khi đó median đã \"nhìn thấy\" tập test — rò rỉ dữ liệu. Phải chia trước, tính median trên tập train, rồi áp cùng giá trị đó cho tập test.\n\n" +
      "### Kiểm tra nhanh\n\n" +
      "```python\n" +
      "data.isna().sum()                       # đếm ô trống từng cột\n" +
      "data.isna().mean().sort_values()        # tỉ lệ thiếu, sắp xếp tăng dần\n" +
      "```",
    quiz: {
      title: "Kiểm tra: Xử lý giá trị thiếu",
      questions: [
        {
          type: "mcq",
          prompt:
            "Cột thu nhập trong tập dữ liệu có 30% ô trống, và người thu nhập cao thường bỏ trống nhiều hơn. Cách xử lý nào rủi ro nhất?",
          explanation:
            "Xoá hết dòng thiếu sẽ loại bỏ chủ yếu nhóm thu nhập cao, làm tập dữ liệu lệch hẳn — mô hình sẽ học trên một quần thể không còn giống thực tế. Đây là kiểu thiếu không ngẫu nhiên.",
          options: [
            { label: "Xoá toàn bộ dòng có ô trống ở cột thu nhập", correct: true },
            { label: "Điền bằng median của cột thu nhập" },
            { label: "Thêm cột đánh dấu thu_nhap_missing rồi điền median" },
            { label: "Giữ nguyên và dùng mô hình chấp nhận giá trị thiếu" },
          ],
        },
        {
          type: "true_false",
          prompt:
            "Nên tính median để điền ô trống trên toàn bộ dữ liệu, trước khi chia tập train và test.",
          explanation:
            "Sai. Tính trên toàn bộ dữ liệu nghĩa là median đã chứa thông tin của tập test — rò rỉ dữ liệu. Phải chia trước, tính median trên train rồi áp cho test.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Vì sao median thường được ưu tiên hơn mean khi điền ô trống cho cột số?",
          explanation:
            "Mean bị giá trị ngoại lai kéo lệch. Một vài giá trị cực lớn đủ để đẩy mean ra xa phần lớn dữ liệu, khiến giá trị điền vào trở nên phi thực tế. Median gần như không bị ảnh hưởng.",
          options: [
            { label: "Vì median luôn nhỏ hơn mean" },
            { label: "Vì median không bị giá trị ngoại lai kéo lệch", correct: true },
            { label: "Vì median tính nhanh hơn" },
            { label: "Vì median luôn là số nguyên" },
          ],
        },
        {
          type: "fill_in",
          prompt:
            "Viết phương thức pandas dùng để đếm số ô trống của từng cột (chỉ tên phương thức, ví dụ dạng abc().def()).",
          explanation: "`isna().sum()` — hoặc tương đương `isnull().sum()`.",
          options: [
            { label: "isna().sum()", correct: true },
            { label: "isnull().sum()", correct: true },
            { label: "df.isna().sum()", correct: true },
            { label: "data.isna().sum()", correct: true },
          ],
        },
      ],
    },
  },
  {
    match: "Feature Scaling and Encoding Categorical Variables",
    title: "Chuẩn hoá đặc trưng và mã hoá biến hạng mục (Feature Scaling & Encoding)",
    description: "Đưa đặc trưng số về cùng thang đo và biến hạng mục thành dạng mô hình hiểu được.",
    skillCode: "ml.data_prep.scaling_encoding",
    body:
      "## Chuẩn hoá đặc trưng và mã hoá biến hạng mục\n\n" +
      "Mô hình chỉ ăn số. Bài này lo hai việc: đưa các cột số về cùng thang, và biến các cột chữ thành số.\n\n" +
      "### Vì sao phải chuẩn hoá thang đo\n\n" +
      "Giả sử dự đoán giá nhà từ hai đặc trưng:\n\n" +
      "| Đặc trưng | Khoảng giá trị |\n" +
      "|---|---|\n" +
      "| Diện tích (m²) | 30 – 200 |\n" +
      "| Số phòng ngủ | 1 – 5 |\n\n" +
      "Với thuật toán tính khoảng cách (KNN, SVM) hoặc dùng gradient descent, cột diện tích sẽ **áp đảo** cột số phòng chỉ vì con số của nó lớn hơn — chứ không phải vì nó quan trọng hơn.\n\n" +
      "### Hai phép chuẩn hoá\n\n" +
      "**Normalization (Min-Max)** — ép về đoạn [0, 1]:\n\n" +
      "> x_new = (x − x_min) / (x_max − x_min)\n\n" +
      "**Standardization (z-score)** — đưa về trung bình 0, độ lệch chuẩn 1:\n\n" +
      "> x_new = (x − mean) / std\n\n" +
      "| | Min-Max | z-score |\n" +
      "|---|---|---|\n" +
      "| Khoảng kết quả | Cố định [0, 1] | Không giới hạn |\n" +
      "| Nhạy với ngoại lai | **Rất nhạy** — một giá trị cực lớn ép hết phần còn lại về gần 0 | Ít nhạy hơn |\n" +
      "| Hợp khi | Biết rõ biên trên/dưới, dữ liệu sạch | Có ngoại lai, phân phối gần chuẩn |\n\n" +
      "```python\n" +
      "from sklearn.preprocessing import StandardScaler, MinMaxScaler\n" +
      "scaler = StandardScaler()\n" +
      "x_train = scaler.fit_transform(x_train)   # học mean/std TỪ train\n" +
      "x_test  = scaler.transform(x_test)        # áp cùng mean/std đó lên test\n" +
      "```\n\n" +
      "### Mã hoá biến hạng mục\n\n" +
      "**One-hot encoding** cho biến *nominal* (không thứ tự) — mỗi hạng mục thành một cột 0/1:\n\n" +
      "```python\n" +
      "data = pd.get_dummies(data, columns=[\"city\"])\n" +
      "# city → city_Hanoi, city_HCM, city_Hue\n" +
      "```\n\n" +
      "**Ordinal encoding** cho biến *có thứ tự* — giữ lại quan hệ lớn/nhỏ:\n\n" +
      "```python\n" +
      "size_map = {\"S\": 0, \"M\": 1, \"L\": 2}\n" +
      "data[\"size\"] = data[\"size\"].map(size_map)\n" +
      "```\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Gán số cho biến nominal.** Nếu mã Hà Nội = 1, TP.HCM = 2, Huế = 3, mô hình sẽ hiểu rằng Huế > TP.HCM > Hà Nội và khoảng cách Hà Nội–Huế gấp đôi Hà Nội–TP.HCM. Đó là quan hệ hoàn toàn bịa ra. Với biến không thứ tự, phải dùng one-hot.",
    quiz: {
      title: "Kiểm tra: Chuẩn hoá và mã hoá",
      questions: [
        {
          type: "mcq",
          prompt:
            "Cột thành phố có 3 giá trị: Hà Nội, TP.HCM, Huế. Cách mã hoá nào đúng?",
          explanation:
            "Thành phố là biến nominal — không có thứ tự. Gán 1/2/3 sẽ tạo ra quan hệ lớn-nhỏ và khoảng cách hoàn toàn bịa. One-hot encoding tạo 3 cột nhị phân độc lập, không áp đặt thứ tự nào.",
          options: [
            { label: "Gán Hà Nội = 1, TP.HCM = 2, Huế = 3" },
            { label: "One-hot encoding thành 3 cột nhị phân", correct: true },
            { label: "Chuẩn hoá Min-Max về đoạn [0, 1]" },
            { label: "Bỏ cột đi vì không phải số" },
          ],
        },
        {
          type: "numerical",
          prompt:
            "Cột điểm có giá trị nhỏ nhất 0, lớn nhất 10. Sau chuẩn hoá Min-Max, giá trị 3 trở thành bao nhiêu? (số thập phân)",
          explanation: "(3 − 0) / (10 − 0) = 0.3.",
          extra: { expected: 0.3, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt:
            "Dữ liệu lương có vài giá trị cực lớn (CEO). Nên dùng phép chuẩn hoá nào và vì sao?",
          explanation:
            "Min-Max lấy giá trị lớn nhất làm mốc, nên một mức lương CEO cực cao sẽ ép toàn bộ lương nhân viên còn lại xuống sát 0 — mất hết khả năng phân biệt. z-score chịu ảnh hưởng của ngoại lai ít hơn nhiều.",
          options: [
            { label: "Min-Max, vì kết quả nằm gọn trong [0, 1]" },
            {
              label: "z-score, vì Min-Max sẽ bị giá trị cực lớn ép phần còn lại về sát 0",
              correct: true,
            },
            { label: "Không cần chuẩn hoá vì lương đã là số" },
            { label: "One-hot encoding" },
          ],
        },
        {
          type: "true_false",
          prompt: "Cỡ áo S – M – L nên được mã hoá bằng ordinal encoding chứ không phải one-hot.",
          explanation:
            "Đúng. S < M < L là quan hệ có thật, ordinal encoding giữ được thông tin đó. Dùng one-hot sẽ vứt bỏ thứ tự.",
          options: [
            { label: "Đúng", correct: true },
            { label: "Sai" },
          ],
        },
      ],
    },
  },
  {
    match: "Data Partitioning",
    title: "Chia tập dữ liệu (Data Partitioning)",
    description: "Vì sao phải tách dữ liệu, chia bao nhiêu, và cái bẫy khi dữ liệu mất cân bằng.",
    skillCode: "ml.data_prep.partitioning",
    body:
      "## Chia tập dữ liệu\n\n" +
      "### Vì sao không được đánh giá trên dữ liệu đã huấn luyện\n\n" +
      "Một mô hình học thuộc lòng toàn bộ tập huấn luyện sẽ đạt độ chính xác 100% trên chính tập đó — và có thể vô dụng với dữ liệu mới. Đó là **overfitting**. Muốn biết mô hình có thực sự học được quy luật hay không, phải kiểm tra trên dữ liệu nó **chưa từng thấy**.\n\n" +
      "### Chia thế nào\n\n" +
      "| Tập | Tỉ lệ thường dùng | Dùng để |\n" +
      "|---|---|---|\n" +
      "| Train | 60–80% | Huấn luyện mô hình |\n" +
      "| Validation | 10–20% | Chọn mô hình, chỉnh siêu tham số |\n" +
      "| Test | 10–20% | Đánh giá cuối cùng, **chỉ dùng một lần** |\n\n" +
      "Nếu chỉ chia hai phần (train/test) như trong buổi thực hành, hãy dùng kiểm định chéo trên tập train để thay vai trò của validation.\n\n" +
      "```python\n" +
      "from sklearn.model_selection import train_test_split\n" +
      "x_train, x_test, y_train, y_test = train_test_split(\n" +
      "    x, y, test_size=0.2, random_state=1009)\n" +
      "```\n\n" +
      "**`random_state`** cố định cách chia ngẫu nhiên. Nhờ nó, chạy lại mã cho ra đúng kết quả cũ — điều kiện bắt buộc để so sánh hai phương án một cách công bằng.\n\n" +
      "### Chia phân tầng (stratify) — bắt buộc khi dữ liệu mất cân bằng\n\n" +
      "Nếu chỉ 1% dữ liệu là gian lận, một lần chia ngẫu nhiên có thể đẩy gần hết ca gian lận vào tập train, để lại tập test gần như không có ca dương nào. Khi đó recall đo được là vô nghĩa.\n\n" +
      "```python\n" +
      "x_train, x_test, y_train, y_test = train_test_split(\n" +
      "    x, y, test_size=0.2, random_state=1009, stratify=y)\n" +
      "```\n\n" +
      "`stratify=y` giữ nguyên tỉ lệ các lớp ở cả hai tập.\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Dùng tập test nhiều lần để chỉnh mô hình.** Mỗi lần bạn xem kết quả test rồi quay lại sửa mô hình, tập test lại rò rỉ thêm một chút vào quyết định của bạn. Sau mười vòng như vậy, con số trên tập test không còn là ước lượng trung thực nữa. Hãy chỉnh trên validation, và chỉ chạm vào test đúng một lần cuối.",
    quiz: {
      title: "Kiểm tra: Chia tập dữ liệu",
      questions: [
        {
          type: "numerical",
          prompt:
            "Tập dữ liệu có 1000 dòng, chạy train_test_split với test_size=0.25. Tập train có bao nhiêu dòng?",
          explanation: "1000 × (1 − 0.25) = 750 dòng train, 250 dòng test.",
          extra: { expected: 750, tolerance: 0 },
        },
        {
          type: "mcq",
          prompt:
            "Dữ liệu phát hiện gian lận chỉ có 1% ca dương. Cần thêm tham số nào khi chia tập, và vì sao?",
          explanation:
            "`stratify=y` giữ đúng tỉ lệ 1% ở cả train lẫn test. Không có nó, tập test có thể gần như không chứa ca gian lận nào, khiến recall đo được hoàn toàn vô nghĩa.",
          options: [
            { label: "shuffle=False, để giữ nguyên thứ tự dữ liệu" },
            { label: "stratify=y, để giữ đúng tỉ lệ lớp ở cả hai tập", correct: true },
            { label: "random_state=0, để kết quả ổn định" },
            { label: "test_size=0.5, để tập test đủ lớn" },
          ],
        },
        {
          type: "true_false",
          prompt:
            "Có thể dùng tập test nhiều lần để so sánh và chỉnh mô hình cho tới khi đạt kết quả tốt nhất.",
          explanation:
            "Sai. Mỗi lần nhìn kết quả test rồi sửa mô hình là một lần tập test rò rỉ vào quyết định. Việc chỉnh phải làm trên tập validation; test chỉ dùng một lần cuối.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
      ],
    },
  },
  {
    match: "Foundations of Supervised Learning",
    title: "Nền tảng học có giám sát và đánh đổi Bias-Variance",
    description: "Học có giám sát là gì, và vì sao mô hình phức tạp hơn không phải lúc nào cũng tốt hơn.",
    skillCode: "ml.foundations.supervised",
    body:
      "## Nền tảng học có giám sát và đánh đổi Bias-Variance\n\n" +
      "### Học có giám sát\n\n" +
      "Ta đưa cho mô hình các cặp (đầu vào, đáp án đúng) và để nó tự tìm quy luật ánh xạ. \"Có giám sát\" nghĩa là mỗi mẫu huấn luyện đều có nhãn đúng đi kèm.\n\n" +
      "| Loại bài toán | Đầu ra | Ví dụ |\n" +
      "|---|---|---|\n" +
      "| Hồi quy (regression) | Số liên tục | Giá nhà, nhiệt độ ngày mai |\n" +
      "| Phân loại (classification) | Nhãn rời rạc | Spam / không spam, có bệnh / không |\n\n" +
      "### Bias và Variance\n\n" +
      "**Bias cao (underfitting)** — mô hình quá đơn giản để nắm được quy luật. Dùng đường thẳng để khớp một quan hệ cong: sai cả trên tập train lẫn test.\n\n" +
      "**Variance cao (overfitting)** — mô hình quá phức tạp, học thuộc cả nhiễu trong tập train. Gần như hoàn hảo trên train, tệ trên test.\n\n" +
      "| Dấu hiệu | Sai số train | Sai số test | Chẩn đoán |\n" +
      "|---|---|---|---|\n" +
      "| Cao | Cao | Cao | Underfitting (bias cao) |\n" +
      "| Lệch lớn | Rất thấp | Cao | Overfitting (variance cao) |\n" +
      "| Tốt | Thấp | Thấp, gần train | Vừa phải |\n\n" +
      "### Đánh đổi\n\n" +
      "Tăng độ phức tạp của mô hình thì bias giảm nhưng variance tăng. Mục tiêu không phải là triệt tiêu cái nào, mà tìm điểm cân bằng cho **tổng sai số trên dữ liệu mới** nhỏ nhất.\n\n" +
      "### Cách nhận biết và xử lý\n\n" +
      "**Nếu đang overfitting:** thêm dữ liệu, giảm số đặc trưng, giảm độ phức tạp (ví dụ giới hạn `max_depth` của cây), hoặc thêm regularization.\n\n" +
      "**Nếu đang underfitting:** thêm đặc trưng, dùng mô hình mạnh hơn, huấn luyện lâu hơn.\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Thấy accuracy trên tập train cao rồi kết luận mô hình tốt.** Con số đó gần như luôn đẹp, kể cả khi mô hình chỉ học thuộc lòng. Luôn so sánh train với test: khoảng cách giữa hai con số mới là thứ nói lên vấn đề.",
    quiz: {
      title: "Kiểm tra: Nền tảng và Bias-Variance",
      questions: [
        {
          type: "mcq",
          prompt:
            "Mô hình đạt accuracy 99% trên tập train nhưng chỉ 62% trên tập test. Đây là hiện tượng gì và nên làm gì?",
          explanation:
            "Khoảng cách lớn giữa train và test là dấu hiệu kinh điển của overfitting (variance cao). Hướng xử lý: giảm độ phức tạp mô hình, thêm dữ liệu, hoặc thêm regularization.",
          options: [
            { label: "Underfitting — cần mô hình phức tạp hơn" },
            { label: "Overfitting — cần giảm độ phức tạp hoặc thêm dữ liệu", correct: true },
            { label: "Mô hình đã tốt — 99% là rất cao" },
            { label: "Dữ liệu bị thiếu — cần điền giá trị" },
          ],
        },
        {
          type: "mcq",
          prompt: "Mô hình sai nhiều ở CẢ tập train lẫn tập test. Đây là dấu hiệu gì?",
          explanation:
            "Sai cao ở cả hai tập nghĩa là mô hình chưa nắm được quy luật — underfitting, bias cao. Cần mô hình mạnh hơn hoặc thêm đặc trưng, chứ không phải thêm dữ liệu.",
          options: [
            { label: "Overfitting" },
            { label: "Underfitting — mô hình quá đơn giản", correct: true },
            { label: "Dữ liệu bị rò rỉ" },
            { label: "Tập test quá nhỏ" },
          ],
        },
        {
          type: "true_false",
          prompt: "Mô hình càng phức tạp thì càng dự đoán tốt trên dữ liệu mới.",
          explanation:
            "Sai. Tăng độ phức tạp làm giảm bias nhưng tăng variance. Quá một điểm nào đó, mô hình bắt đầu học cả nhiễu và kết quả trên dữ liệu mới xấu đi.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
      ],
    },
  },
  {
    match: "The Machine Learning Pipeline",
    title: "Pipeline học máy trong Scikit-learn",
    description: "Gộp các bước tiền xử lý và mô hình thành một khối, tránh rò rỉ dữ liệu.",
    skillCode: "ml.sklearn.pipeline",
    body:
      "## Pipeline học máy trong Scikit-learn\n\n" +
      "### Vấn đề mà Pipeline giải quyết\n\n" +
      "Khi làm thủ công, bạn phải nhớ đúng thứ tự và đúng quy tắc: fit scaler trên train, transform test, rồi mới huấn luyện. Chỉ cần một lần quên là dữ liệu rò rỉ mà không có lỗi nào báo — mô hình vẫn chạy, kết quả vẫn đẹp, chỉ là sai.\n\n" +
      "`Pipeline` gộp mọi bước thành một đối tượng. Gọi `fit` một lần, thư viện tự áp đúng quy tắc cho từng bước.\n\n" +
      "```python\n" +
      "from sklearn.pipeline import Pipeline\n" +
      "from sklearn.preprocessing import StandardScaler\n" +
      "from sklearn.ensemble import RandomForestClassifier\n\n" +
      "pipe = Pipeline([\n" +
      "    (\"scaler\", StandardScaler()),\n" +
      "    (\"model\",  RandomForestClassifier(random_state=100)),\n" +
      "])\n\n" +
      "pipe.fit(x_train, y_train)      # scaler.fit_transform + model.fit\n" +
      "y_pred = pipe.predict(x_test)   # scaler.transform + model.predict\n" +
      "```\n\n" +
      "### Vì sao đây là cách an toàn hơn\n\n" +
      "Khi dùng chung với kiểm định chéo, Pipeline fit lại scaler **riêng cho từng fold**. Làm thủ công, người ta hay chuẩn hoá một lần trên toàn bộ tập train rồi mới chia fold — và thế là mỗi fold validation đã bị rò rỉ.\n\n" +
      "```python\n" +
      "from sklearn.model_selection import cross_val_score\n" +
      "scores = cross_val_score(pipe, x_train, y_train, cv=5)  # an toàn\n" +
      "```\n\n" +
      "### Xử lý cột số và cột hạng mục khác nhau\n\n" +
      "```python\n" +
      "from sklearn.compose import ColumnTransformer\n" +
      "from sklearn.preprocessing import OneHotEncoder\n\n" +
      "pre = ColumnTransformer([\n" +
      "    (\"num\", StandardScaler(), [\"age\", \"income\"]),\n" +
      "    (\"cat\", OneHotEncoder(handle_unknown=\"ignore\"), [\"city\"]),\n" +
      "])\n" +
      "pipe = Pipeline([(\"pre\", pre), (\"model\", RandomForestClassifier())])\n" +
      "```\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Chuẩn hoá dữ liệu trước khi đưa vào cross-validation.** Kết quả sẽ đẹp hơn thực tế và bạn sẽ không phát hiện ra, vì không có gì báo lỗi. Đưa scaler vào trong Pipeline là cách chắc chắn tránh được.",
    quiz: {
      title: "Kiểm tra: Pipeline Scikit-learn",
      questions: [
        {
          type: "mcq",
          prompt: "Lợi ích quan trọng nhất của việc đưa StandardScaler vào Pipeline là gì?",
          explanation:
            "Khi chạy cross-validation, Pipeline fit lại scaler riêng cho từng fold, nên fold validation không bị rò rỉ. Làm thủ công rất dễ chuẩn hoá một lần trên toàn bộ train rồi mới chia fold — và sai lầm này không báo lỗi.",
          options: [
            { label: "Giúp mô hình huấn luyện nhanh hơn" },
            {
              label: "Đảm bảo scaler được fit riêng cho từng fold, tránh rò rỉ dữ liệu",
              correct: true,
            },
            { label: "Tự động chọn thuật toán tốt nhất" },
            { label: "Giảm dung lượng bộ nhớ" },
          ],
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các bước theo đúng thứ tự trong một Pipeline điển hình.",
          explanation:
            "Xử lý giá trị thiếu → mã hoá/chuẩn hoá đặc trưng → huấn luyện mô hình → dự đoán. Mọi bước biến đổi dữ liệu phải xong trước khi mô hình nhìn thấy dữ liệu.",
          options: [
            { label: "Điền giá trị thiếu (imputer)" },
            { label: "Chuẩn hoá / mã hoá đặc trưng" },
            { label: "Huấn luyện mô hình" },
            { label: "Dự đoán trên dữ liệu mới" },
          ],
        },
        {
          type: "fill_in",
          prompt:
            "Lớp nào của scikit-learn cho phép áp các phép biến đổi KHÁC NHAU lên các nhóm cột khác nhau? (tên lớp)",
          explanation:
            "`ColumnTransformer` — ví dụ StandardScaler cho cột số và OneHotEncoder cho cột hạng mục.",
          options: [
            { label: "ColumnTransformer", correct: true },
            { label: "columntransformer", correct: true },
          ],
        },
      ],
    },
  },

  // ───────────────── Module 2 ─────────────────
  {
    match: "Linear Regression",
    title: "Hồi quy tuyến tính (Linear Regression)",
    description: "Mô hình nền tảng cho bài toán dự đoán giá trị liên tục.",
    skillCode: "ml.algo.linear_regression",
    body:
      "## Hồi quy tuyến tính\n\n" +
      "### Ý tưởng\n\n" +
      "Tìm một đường thẳng (hoặc mặt phẳng khi nhiều đặc trưng) khớp nhất với đám điểm dữ liệu:\n\n" +
      "> ŷ = w₁x₁ + w₂x₂ + … + wₙxₙ + b\n\n" +
      "Trong đó `w` là trọng số của từng đặc trưng và `b` là hệ số chặn. Mô hình học bằng cách tìm bộ `w`, `b` làm sai số nhỏ nhất — thường đo bằng MSE.\n\n" +
      "### Đọc được hệ số\n\n" +
      "Đây là điểm mạnh lớn nhất của hồi quy tuyến tính. Nếu mô hình dự đoán giá nhà cho ra hệ số của `diện tích` là 0.05 (tỷ đồng trên m²), ta hiểu ngay: **giữ nguyên các yếu tố khác, mỗi m² tăng thêm làm giá tăng 0.05 tỷ**. Rất ít mô hình cho ta câu giải thích rõ ràng như vậy.\n\n" +
      "```python\n" +
      "from sklearn.linear_model import LinearRegression\n" +
      "model = LinearRegression()\n" +
      "model.fit(x_train, y_train)\n" +
      "print(model.coef_)        # trọng số từng đặc trưng\n" +
      "print(model.intercept_)   # hệ số chặn\n" +
      "```\n\n" +
      "### Giả định cần biết\n\n" +
      "1. Quan hệ giữa đặc trưng và đầu ra là **tuyến tính**\n" +
      "2. Các quan sát độc lập nhau\n" +
      "3. Sai số có phương sai đều\n\n" +
      "Nếu quan hệ thực tế là đường cong, mô hình sẽ underfit dù bạn có bao nhiêu dữ liệu đi nữa.\n\n" +
      "### So sánh hệ số phải chuẩn hoá trước\n\n" +
      "Hệ số phụ thuộc đơn vị đo. Cột tính bằng mét sẽ có hệ số khác hẳn khi đổi sang centimet, dù ý nghĩa không đổi. Muốn so sánh mức độ quan trọng giữa các đặc trưng, phải chuẩn hoá chúng về cùng thang trước.\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Hiểu hệ số lớn là đặc trưng quan trọng, khi chưa chuẩn hoá.** Một cột đo bằng đồng và một cột đo bằng tỷ đồng sẽ cho hệ số lệch nhau chín chữ số, mà chẳng nói lên điều gì về tầm quan trọng.",
    quiz: {
      title: "Kiểm tra: Hồi quy tuyến tính",
      questions: [
        {
          type: "mcq",
          prompt:
            "Mô hình dự đoán giá nhà (tỷ đồng) có hệ số của đặc trưng diện tích là 0.05. Cách hiểu đúng là gì?",
          explanation:
            "Hệ số trong hồi quy tuyến tính đọc là: giữ nguyên mọi đặc trưng khác, mỗi đơn vị tăng của đặc trưng này làm đầu ra thay đổi bấy nhiêu. Ở đây: mỗi m² thêm làm giá tăng 0.05 tỷ.",
          options: [
            { label: "Diện tích chiếm 5% giá trị căn nhà" },
            {
              label: "Giữ nguyên các yếu tố khác, mỗi m² tăng thêm làm giá tăng 0.05 tỷ",
              correct: true,
            },
            { label: "Mô hình đúng 5% số lần" },
            { label: "Diện tích là đặc trưng quan trọng thứ 5" },
          ],
        },
        {
          type: "true_false",
          prompt:
            "Có thể so sánh trực tiếp độ lớn các hệ số để biết đặc trưng nào quan trọng hơn, kể cả khi chưa chuẩn hoá.",
          explanation:
            "Sai. Hệ số phụ thuộc đơn vị đo — đổi mét sang centimet là hệ số đổi 100 lần. Muốn so sánh phải chuẩn hoá các đặc trưng về cùng thang trước.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Quan hệ thật giữa đặc trưng và đầu ra là một đường cong rõ rệt. Hồi quy tuyến tính sẽ ra sao?",
          explanation:
            "Mô hình tuyến tính không thể biểu diễn quan hệ cong — nó sẽ underfit, sai cả trên train lẫn test, và thêm dữ liệu cũng không cứu được.",
          options: [
            { label: "Vẫn khớp tốt nếu có đủ dữ liệu" },
            { label: "Underfit — sai cả trên train lẫn test", correct: true },
            { label: "Overfit — thuộc lòng tập train" },
            { label: "Báo lỗi khi huấn luyện" },
          ],
        },
      ],
    },
  },
  {
    match: "Decision Trees",
    title: "Cây quyết định (Decision Trees)",
    description: "Mô hình rẽ nhánh theo điều kiện — dễ giải thích nhất trong các thuật toán.",
    skillCode: "ml.algo.decision_trees",
    body:
      "## Cây quyết định\n\n" +
      "### Cấu trúc\n\n" +
      "| Thành phần | Vai trò |\n" +
      "|---|---|\n" +
      "| Root node | Nút gốc — câu hỏi đầu tiên |\n" +
      "| Decision node | Nút hỏi điều kiện ở giữa |\n" +
      "| Leaf node | Nút lá — kết luận cuối cùng |\n\n" +
      "Điểm mạnh lớn nhất: bạn **đọc được đường đi** dẫn tới mỗi quyết định. Với hồ sơ vay bị từ chối, cây cho biết chính xác điều kiện nào đã loại — thứ mà ngân hàng bắt buộc phải giải thích được cho khách hàng.\n\n" +
      "### Chọn thuộc tính chia nhánh: Gini impurity\n\n" +
      "> Gini = 1 − Σ (pᵢ)²\n\n" +
      "Gini đo mức \"hỗn tạp\" của một nhánh:\n\n" +
      "- Nhánh có 4 Yes, 0 No → p(Yes) = 1 → Gini = 1 − 1² = **0** (thuần khiết)\n" +
      "- Nhánh có 3 Yes, 2 No → Gini = 1 − (0.6² + 0.4²) = **0.48**\n" +
      "- Nhánh 50/50 → Gini = 1 − (0.5² + 0.5²) = **0.5** (hỗn tạp nhất)\n\n" +
      "Thuật toán thử từng thuộc tính, tính Gini có trọng số của các nhánh con, rồi **chọn thuộc tính cho Gini nhỏ nhất**.\n\n" +
      "Trong ví dụ duyệt vay ở bài giảng: chia theo `age` cho Gini = (5/14)(0.48) + (4/14)(0) + (5/14)(0.48) = **0.343**.\n\n" +
      "```python\n" +
      "from sklearn.tree import DecisionTreeClassifier, plot_tree\n" +
      "model = DecisionTreeClassifier(max_depth=4, random_state=100)\n" +
      "model.fit(x_train, y_train)\n" +
      "plot_tree(model, feature_names=x.columns, filled=True)\n" +
      "```\n\n" +
      "### Điểm yếu chí mạng: rất dễ overfit\n\n" +
      "Cây không giới hạn độ sâu sẽ chia mãi cho tới khi mỗi lá chỉ còn một mẫu — tức học thuộc lòng. Accuracy trên train đạt 100%, trên test thì tệ.\n\n" +
      "Cách kiểm soát: `max_depth`, `min_samples_leaf`, `min_samples_split`.\n\n" +
      "### Từ một cây tới cả rừng\n\n" +
      "Random Forest huấn luyện nhiều cây trên các tập con lấy mẫu **có hoàn lại** (bootstrapping), rồi lấy biểu quyết đa số. Sai lầm ngẫu nhiên của từng cây triệt tiêu lẫn nhau, nên rừng ổn định hơn hẳn một cây đơn lẻ — đổi lại, mất phần lớn khả năng giải thích.\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Để cây mọc tự do rồi ngạc nhiên vì accuracy train bằng 100%.** Đó không phải mô hình giỏi, đó là bảng tra cứu.",
    quiz: {
      title: "Kiểm tra: Cây quyết định",
      questions: [
        {
          type: "numerical",
          prompt:
            "Một nhánh có 6 mẫu Yes và 6 mẫu No. Tính Gini = 1 − Σ(pᵢ)². (2 chữ số thập phân)",
          explanation:
            "p = 0.5 cho cả hai lớp. Gini = 1 − (0.25 + 0.25) = 0.5 — đây là mức hỗn tạp cao nhất có thể với 2 lớp.",
          extra: { expected: 0.5, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt: "Thuật toán chọn thuộc tính chia nhánh theo nguyên tắc nào?",
          explanation:
            "Chọn thuộc tính cho Gini có trọng số nhỏ nhất — tức chia ra được các nhánh thuần khiết nhất, phân biệt lớp tốt nhất.",
          options: [
            { label: "Chọn thuộc tính có Gini lớn nhất" },
            { label: "Chọn thuộc tính có Gini có trọng số nhỏ nhất", correct: true },
            { label: "Chọn thuộc tính có nhiều giá trị khác nhau nhất" },
            { label: "Chọn ngẫu nhiên để tránh thiên lệch" },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Cây quyết định đạt accuracy 100% trên tập train nhưng 68% trên test. Tham số nào nên chỉnh trước?",
          explanation:
            "Đây là overfitting kinh điển của cây. Giới hạn `max_depth` (hoặc tăng `min_samples_leaf`) buộc cây dừng sớm thay vì chia tới khi mỗi lá còn một mẫu.",
          options: [
            { label: "Tăng số đặc trưng đầu vào" },
            { label: "Giảm max_depth để hạn chế cây mọc quá sâu", correct: true },
            { label: "Tăng test_size" },
            { label: "Bỏ chuẩn hoá dữ liệu" },
          ],
        },
        {
          type: "true_false",
          prompt: "Bootstrapping trong Random Forest lấy mẫu ngẫu nhiên có hoàn lại.",
          explanation:
            "Đúng — vì có hoàn lại nên một phần tử có thể xuất hiện nhiều lần trong cùng một tập con, tạo ra sự đa dạng giữa các cây.",
          options: [
            { label: "Đúng", correct: true },
            { label: "Sai" },
          ],
        },
      ],
    },
  },
  {
    match: "Support Vector Machines",
    title: "Máy vector hỗ trợ (Support Vector Machines)",
    description: "Tìm ranh giới phân lớp có lề rộng nhất, và kỹ thuật kernel cho dữ liệu không tách tuyến tính.",
    skillCode: "ml.algo.svm",
    body:
      "## Máy vector hỗ trợ (SVM)\n\n" +
      "### Ý tưởng: không phải ranh giới nào cũng tốt như nhau\n\n" +
      "Giữa hai lớp dữ liệu có thể vẽ vô số đường thẳng phân tách. SVM chọn đường có **lề (margin) rộng nhất** — tức cách xa điểm gần nhất của cả hai lớp nhất có thể.\n\n" +
      "Vì sao lề rộng lại tốt? Vì nó tạo vùng đệm an toàn. Một điểm dữ liệu mới lệch đi một chút vẫn nằm đúng phía; với ranh giới sát rìa thì chỉ cần nhiễu nhỏ là phân loại sai.\n\n" +
      "### Support vectors\n\n" +
      "Chỉ những điểm **nằm sát ranh giới** mới quyết định vị trí siêu phẳng — đó là các support vector. Xoá một điểm ở xa, ranh giới không đổi; xoá một support vector, ranh giới đổi ngay.\n\n" +
      "Hệ quả thực tế: SVM chỉ phụ thuộc một phần nhỏ dữ liệu, nên tiết kiệm bộ nhớ khi dự đoán.\n\n" +
      "### Kernel trick\n\n" +
      "Khi dữ liệu không thể tách bằng một đường thẳng, SVM ánh xạ nó lên không gian nhiều chiều hơn, nơi tồn tại một siêu phẳng tách được. Điều tinh tế: thuật toán **không thực sự tính toạ độ ở không gian mới** — nó chỉ tính tích vô hướng qua hàm kernel, nên chi phí vẫn chấp nhận được.\n\n" +
      "| Kernel | Dùng khi |\n" +
      "|---|---|\n" +
      "| `linear` | Dữ liệu tách được tuyến tính, nhiều đặc trưng |\n" +
      "| `rbf` (mặc định) | Ranh giới cong, không biết trước dạng |\n" +
      "| `poly` | Quan hệ đa thức |\n\n" +
      "```python\n" +
      "from sklearn.svm import SVC\n" +
      "model = SVC(kernel=\"rbf\", C=1.0, gamma=\"scale\")\n" +
      "model.fit(x_train, y_train)\n" +
      "```\n\n" +
      "**Tham số C** kiểm soát đánh đổi: C lớn = phạt nặng lỗi phân loại, lề hẹp, dễ overfit. C nhỏ = chấp nhận vài lỗi để có lề rộng, tổng quát hoá tốt hơn.\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Quên chuẩn hoá dữ liệu trước khi dùng SVM.** SVM dựa trên khoảng cách, nên một đặc trưng có thang đo lớn sẽ áp đảo hoàn toàn các đặc trưng khác. Đây là thuật toán nhạy cảm với thang đo nhất trong các mô hình đã học.",
    quiz: {
      title: "Kiểm tra: SVM",
      questions: [
        {
          type: "mcq",
          prompt: "Vì sao SVM chọn siêu phẳng có lề rộng nhất thay vì bất kỳ đường tách nào?",
          explanation:
            "Lề rộng tạo vùng đệm: điểm dữ liệu mới lệch đi một chút vẫn nằm đúng phía. Ranh giới sát rìa thì chỉ cần nhiễu nhỏ đã phân loại sai — tức tổng quát hoá kém.",
          options: [
            { label: "Vì tính toán nhanh hơn" },
            { label: "Vì lề rộng tạo vùng đệm, chịu được nhiễu tốt hơn trên dữ liệu mới", correct: true },
            { label: "Vì dùng ít bộ nhớ hơn" },
            { label: "Vì luôn cho accuracy 100% trên train" },
          ],
        },
        {
          type: "true_false",
          prompt: "Bỏ đi một điểm dữ liệu nằm xa ranh giới sẽ làm siêu phẳng của SVM thay đổi.",
          explanation:
            "Sai. Chỉ các support vector — những điểm sát ranh giới — mới quyết định vị trí siêu phẳng. Điểm ở xa không ảnh hưởng.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
        {
          type: "mcq",
          prompt: "Bước tiền xử lý nào QUAN TRỌNG NHẤT trước khi dùng SVM?",
          explanation:
            "SVM dựa hoàn toàn trên khoảng cách giữa các điểm. Nếu một đặc trưng có thang đo lớn hơn hẳn, nó sẽ chi phối khoảng cách và các đặc trưng khác gần như bị bỏ qua.",
          options: [
            { label: "One-hot encoding cho mọi cột" },
            { label: "Chuẩn hoá đặc trưng về cùng thang đo", correct: true },
            { label: "Xoá hết giá trị ngoại lai" },
            { label: "Chuyển toàn bộ về số nguyên" },
          ],
        },
      ],
    },
  },
  {
    match: "Choosing Algorithms",
    title: "Chọn thuật toán: giả định và tình huống áp dụng",
    description: "Khi nào dùng thuật toán nào — dựa trên đặc điểm dữ liệu và yêu cầu bài toán.",
    skillCode: "ml.algo.selection",
    body:
      "## Chọn thuật toán: giả định và tình huống áp dụng\n\n" +
      "Biết ba thuật toán ít hữu ích hơn biết bài toán nào cần thuật toán nào.\n\n" +
      "### Bảng so sánh\n\n" +
      "| | Hồi quy tuyến tính | Cây quyết định | Random Forest | SVM |\n" +
      "|---|---|---|---|---|\n" +
      "| Giải thích được | **Rất tốt** | **Rất tốt** | Kém | Kém |\n" +
      "| Quan hệ phi tuyến | Không | Có | Có | Có (kernel) |\n" +
      "| Cần chuẩn hoá | Nên | Không | Không | **Bắt buộc** |\n" +
      "| Nhạy với ngoại lai | Cao | Thấp | Thấp | Trung bình |\n" +
      "| Dữ liệu nhỏ | Tốt | Dễ overfit | Tốt | Tốt |\n" +
      "| Dữ liệu rất lớn | Tốt | Tốt | Chậm dần | **Chậm** |\n\n" +
      "### Ba câu hỏi trước khi chọn\n\n" +
      "**1. Có bắt buộc giải thích được quyết định không?**\n\n" +
      "Ngân hàng từ chối hồ sơ vay, bệnh viện gợi ý chẩn đoán, quyết định tuyển dụng — những nơi này thường bị luật hoặc quy định buộc phải giải thích. Khi đó cây quyết định hoặc hồi quy tuyến tính thắng, kể cả khi độ chính xác thấp hơn vài phần trăm.\n\n" +
      "**2. Quan hệ trong dữ liệu tuyến tính hay không?**\n\n" +
      "Vẽ biểu đồ phân tán trước. Nếu thấy rõ đường cong, đừng bắt đầu bằng mô hình tuyến tính.\n\n" +
      "**3. Dữ liệu lớn cỡ nào?**\n\n" +
      "SVM chậm rõ rệt khi số mẫu lên tới hàng trăm nghìn. Với dữ liệu rất lớn, hồi quy tuyến tính hoặc mô hình cây thường thực tế hơn.\n\n" +
      "### Nguyên tắc làm việc\n\n" +
      "Luôn bắt đầu bằng một **baseline đơn giản** — hồi quy tuyến tính hoặc logistic. Nó cho bạn con số để so sánh. Nếu mô hình phức tạp không vượt được baseline một cách đáng kể, hãy chọn cái đơn giản: dễ triển khai, dễ bảo trì, dễ giải thích.\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Bắt đầu bằng mô hình mạnh nhất.** Không có baseline, bạn không biết mô hình phức tạp kia có thực sự đóng góp gì hay chỉ đang tốn tài nguyên.",
    quiz: {
      title: "Kiểm tra: Chọn thuật toán",
      questions: [
        {
          type: "mcq",
          prompt:
            "Ngân hàng cần mô hình duyệt vay và theo quy định phải giải thích được lý do từ chối cho khách hàng. Nên ưu tiên thuật toán nào?",
          explanation:
            "Cây quyết định cho phép đọc thẳng đường đi dẫn tới quyết định — đúng thứ cần để giải thích. Random Forest và SVM chính xác hơn nhưng gần như không giải thích được.",
          options: [
            { label: "Random Forest với 500 cây" },
            { label: "Cây quyết định giới hạn độ sâu", correct: true },
            { label: "SVM với kernel RBF" },
            { label: "Mạng nơ-ron sâu" },
          ],
        },
        {
          type: "mcq",
          prompt: "Vì sao nên luôn bắt đầu bằng một mô hình baseline đơn giản?",
          explanation:
            "Baseline cho bạn con số tham chiếu. Không có nó, bạn không biết mô hình phức tạp có thực sự tốt hơn hay chỉ tốn tài nguyên mà chẳng thêm được gì.",
          options: [
            { label: "Vì mô hình đơn giản luôn chính xác hơn" },
            {
              label: "Vì cần con số tham chiếu để biết mô hình phức tạp có đáng dùng không",
              correct: true,
            },
            { label: "Vì thư viện yêu cầu như vậy" },
            { label: "Vì mô hình phức tạp không chạy được nếu thiếu baseline" },
          ],
        },
        {
          type: "true_false",
          prompt: "SVM là lựa chọn tốt cho tập dữ liệu vài triệu dòng.",
          explanation:
            "Sai. SVM chậm rõ rệt khi số mẫu rất lớn. Với dữ liệu cỡ đó, mô hình tuyến tính hoặc mô hình cây thường thực tế hơn nhiều.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
      ],
    },
  },

  // ───────────────── Module 3 ─────────────────
  {
    match: "Evaluation Metrics",
    title: "Các độ đo đánh giá (Evaluation Metrics)",
    description: "Accuracy, precision, recall, F1 và các sai số hồi quy — chọn đúng độ đo cho bài toán.",
    skillCode: "ml.eval.metrics",
    body:
      "## Các độ đo đánh giá\n\n" +
      "### Ma trận nhầm lẫn — gốc của mọi độ đo phân loại\n\n" +
      "| | Dự đoán + | Dự đoán − |\n" +
      "|---|---|---|\n" +
      "| **Thực tế +** | TP | FN (lỗi loại II) |\n" +
      "| **Thực tế −** | FP (lỗi loại I) | TN |\n\n" +
      "### Bốn độ đo phân loại\n\n" +
      "| Độ đo | Công thức | Trả lời câu hỏi |\n" +
      "|---|---|---|\n" +
      "| Accuracy | (TP+TN)/tổng | Đoán đúng bao nhiêu phần trăm? |\n" +
      "| Precision | TP/(TP+FP) | Khi mô hình báo dương, bao nhiêu lần đúng? |\n" +
      "| Recall | TP/(TP+FN) | Trong số ca dương thật, mô hình tìm ra bao nhiêu? |\n" +
      "| F1 | 2PR/(P+R) | Cân bằng cả hai |\n\n" +
      "### Chọn độ đo theo cái giá của lỗi\n\n" +
      "Câu hỏi quyết định: **lỗi nào đắt hơn?**\n\n" +
      "| Bài toán | Lỗi đắt hơn | Ưu tiên |\n" +
      "|---|---|---|\n" +
      "| Sàng lọc ung thư | Bỏ sót ca bệnh (FN) | **Recall** |\n" +
      "| Lọc thư rác | Chặn nhầm mail quan trọng (FP) | **Precision** |\n" +
      "| Phát hiện gian lận | Cả hai đều tốn kém | **F1** |\n\n" +
      "**Vì sao F1 dùng trung bình điều hoà** chứ không phải trung bình cộng: với P = 1.0 và R = 0.0, trung bình cộng cho 0.5 (nghe được), còn F1 cho **0** — phản ánh đúng thực tế là mô hình vô dụng. F1 không cho phép giấu một chỉ số kém.\n\n" +
      "### Độ đo cho bài toán hồi quy\n\n" +
      "| Độ đo | Đặc điểm |\n" +
      "|---|---|\n" +
      "| MAE | Trung bình trị tuyệt đối sai số. Dễ hiểu, cùng đơn vị với đầu ra |\n" +
      "| MSE / RMSE | Bình phương sai số — **phạt nặng lỗi lớn** |\n" +
      "| R² | So với baseline \"luôn đoán trung bình\". Bằng 1 là hoàn hảo, 0 là không hơn gì baseline |\n\n" +
      "Chọn MAE khi mọi sai số đều tệ như nhau; chọn RMSE khi một sai số lớn nguy hiểm hơn nhiều sai số nhỏ.\n\n" +
      "```python\n" +
      "from sklearn.metrics import classification_report, confusion_matrix\n" +
      "print(classification_report(y_test, y_pred))\n" +
      "print(confusion_matrix(y_test, y_pred))\n" +
      "```\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Báo cáo mỗi accuracy.** Trên dữ liệu mất cân bằng, một mô hình luôn đoán lớp đa số đạt accuracy rất cao mà không phát hiện được ca nào thuộc lớp cần tìm.",
    quiz: {
      title: "Kiểm tra: Độ đo đánh giá",
      questions: [
        {
          type: "numerical",
          prompt:
            "Ma trận nhầm lẫn: TP=40, FP=10, FN=20, TN=130. Tính Recall = TP/(TP+FN). (2 chữ số thập phân)",
          explanation: "Recall = 40/(40+20) = 40/60 ≈ 0.67 — mô hình tìm được 67% số ca dương thật.",
          extra: { expected: 0.67, tolerance: 0.02 },
        },
        {
          type: "mcq",
          prompt:
            "Hệ thống lọc thư rác chặn nhầm email hợp đồng quan trọng của khách hàng. Nên ưu tiên độ đo nào?",
          explanation:
            "Chặn nhầm mail thật là false positive. Precision = TP/(TP+FP) đo trực tiếp tỉ lệ báo nhầm này — càng cao thì càng ít mail thật bị chặn.",
          options: [
            { label: "Recall — để bắt hết thư rác" },
            { label: "Precision — để hạn chế chặn nhầm mail thật", correct: true },
            { label: "Accuracy — vì tổng quát nhất" },
            { label: "MAE — vì đo sai số trung bình" },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Mô hình có Precision = 1.0 nhưng Recall = 0.0. F1 bằng bao nhiêu và điều đó cho thấy gì?",
          explanation:
            "F1 = 2(1)(0)/(1+0) = 0. Trung bình cộng sẽ cho 0.5 và che giấu vấn đề, còn F1 phản ánh đúng: mô hình không tìm được ca dương nào nên hoàn toàn vô dụng dù mỗi lần báo đều đúng.",
          options: [
            { label: "F1 = 0.5 — mô hình ở mức trung bình" },
            { label: "F1 = 0 — mô hình vô dụng vì không tìm được ca dương nào", correct: true },
            { label: "F1 = 1.0 — vì precision hoàn hảo" },
            { label: "Không tính được F1" },
          ],
        },
        {
          type: "mcq",
          prompt: "Khi nào nên chọn RMSE thay vì MAE cho bài toán hồi quy?",
          explanation:
            "RMSE bình phương sai số nên phạt rất nặng các lỗi lớn. Chọn nó khi một dự đoán lệch nhiều nguy hiểm hơn hẳn nhiều dự đoán lệch ít.",
          options: [
            { label: "Khi mọi sai số đều tệ như nhau" },
            { label: "Khi một sai số lớn nguy hiểm hơn nhiều sai số nhỏ", correct: true },
            { label: "Khi dữ liệu có nhiều giá trị thiếu" },
            { label: "Khi bài toán là phân loại" },
          ],
        },
      ],
    },
  },
  {
    match: "Cross-Validation",
    title: "Kiểm định chéo (Cross-Validation)",
    description: "Đánh giá đáng tin cậy hơn một lần chia train/test duy nhất.",
    skillCode: "ml.eval.cross_validation",
    body:
      "## Kiểm định chéo\n\n" +
      "### Vấn đề của một lần chia\n\n" +
      "Chia train/test một lần cho bạn **một** con số. Nhưng con số đó phụ thuộc vào việc dữ liệu rơi vào đâu. Đổi `random_state`, kết quả có thể nhảy từ 0.74 lên 0.81 — mà mô hình không hề thay đổi. Vậy con số nào là thật?\n\n" +
      "### K-Fold: chia K phần, xoay vòng\n\n" +
      "Với K = 5: chia dữ liệu thành 5 phần bằng nhau, rồi lặp 5 lần — mỗi lần lấy một phần làm validation, 4 phần còn lại để huấn luyện. Cuối cùng lấy trung bình 5 kết quả.\n\n" +
      "Mỗi mẫu dữ liệu đều được dùng để kiểm tra đúng một lần, và để huấn luyện K−1 lần.\n\n" +
      "```python\n" +
      "from sklearn.model_selection import cross_val_score\n" +
      "scores = cross_val_score(pipe, x_train, y_train, cv=5, scoring=\"f1\")\n" +
      "print(scores)                        # 5 con số\n" +
      "print(scores.mean(), scores.std())   # trung bình và độ dao động\n" +
      "```\n\n" +
      "**Độ lệch chuẩn cũng quan trọng như trung bình.** Trung bình 0.80 với độ lệch 0.02 là mô hình ổn định. Trung bình 0.80 với độ lệch 0.15 nghĩa là kết quả phụ thuộc mạnh vào việc chia dữ liệu — chưa đáng tin.\n\n" +
      "### Stratified K-Fold\n\n" +
      "Với bài toán phân loại, luôn dùng bản phân tầng để mỗi fold giữ đúng tỉ lệ các lớp. Scikit-learn tự làm điều này khi bạn truyền một bộ phân loại vào `cross_val_score`.\n\n" +
      "### Chọn K bao nhiêu\n\n" +
      "| K | Đánh đổi |\n" +
      "|---|---|\n" +
      "| 5 | Nhanh, thường đủ tốt — mặc định hợp lý |\n" +
      "| 10 | Ước lượng ổn định hơn, chậm gấp đôi |\n" +
      "| = số mẫu (LOO) | Ít thiên lệch nhất nhưng rất chậm, chỉ hợp dữ liệu nhỏ |\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Chuẩn hoá dữ liệu trước khi chạy cross-validation.** Khi đó scaler đã học từ toàn bộ dữ liệu, kể cả phần sẽ làm validation ở mỗi vòng — kết quả đẹp hơn thực tế. Cách tránh: bọc scaler và mô hình trong một `Pipeline` rồi truyền pipeline đó vào `cross_val_score`.",
    quiz: {
      title: "Kiểm tra: Kiểm định chéo",
      questions: [
        {
          type: "numerical",
          prompt:
            "Chạy 5-fold cross-validation trên tập 1000 dòng. Mỗi lần huấn luyện, mô hình học trên bao nhiêu dòng?",
          explanation:
            "Mỗi fold có 200 dòng làm validation, 4 fold còn lại = 800 dòng để huấn luyện.",
          extra: { expected: 800, tolerance: 0 },
        },
        {
          type: "mcq",
          prompt:
            "Cross-validation cho kết quả trung bình 0.80 với độ lệch chuẩn 0.15. Nên hiểu thế nào?",
          explanation:
            "Độ lệch chuẩn lớn nghĩa là kết quả dao động mạnh giữa các fold — mô hình chưa ổn định, con số 0.80 chưa đáng tin. Cần thêm dữ liệu hoặc mô hình ít nhạy hơn.",
          options: [
            { label: "Mô hình rất tốt vì trung bình cao" },
            {
              label: "Kết quả dao động mạnh giữa các fold — mô hình chưa ổn định, chưa đáng tin",
              correct: true,
            },
            { label: "Dữ liệu bị rò rỉ" },
            { label: "Cần giảm K xuống 2" },
          ],
        },
        {
          type: "true_false",
          prompt:
            "Nên chuẩn hoá toàn bộ dữ liệu trước, rồi mới đưa vào cross_val_score cho tiện.",
          explanation:
            "Sai. Làm vậy scaler học từ cả phần sẽ dùng làm validation ở mỗi vòng — rò rỉ dữ liệu, kết quả đẹp hơn thực tế. Hãy bọc scaler vào Pipeline rồi truyền pipeline vào cross_val_score.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
      ],
    },
  },
  {
    match: "Hyperparameter Tuning",
    title: "Tinh chỉnh siêu tham số (Hyperparameter Tuning)",
    description: "Grid search, random search và cách tránh tinh chỉnh quá đà.",
    skillCode: "ml.eval.hyperparameter_tuning",
    body:
      "## Tinh chỉnh siêu tham số\n\n" +
      "### Tham số và siêu tham số khác nhau ở đâu\n\n" +
      "| | Tham số (parameter) | Siêu tham số (hyperparameter) |\n" +
      "|---|---|---|\n" +
      "| Ai quyết định | Mô hình tự học từ dữ liệu | **Người dùng đặt trước** khi huấn luyện |\n" +
      "| Ví dụ | Hệ số `w` của hồi quy tuyến tính | `max_depth`, `C`, `n_estimators` |\n\n" +
      "### Grid Search\n\n" +
      "Liệt kê các giá trị muốn thử, thư viện chạy hết mọi tổ hợp và chọn cái tốt nhất theo cross-validation.\n\n" +
      "```python\n" +
      "from sklearn.model_selection import GridSearchCV\n\n" +
      "grid = {\n" +
      "    \"model__max_depth\": [3, 5, 10, None],\n" +
      "    \"model__n_estimators\": [100, 300],\n" +
      "}\n" +
      "search = GridSearchCV(pipe, grid, cv=5, scoring=\"f1\", n_jobs=-1)\n" +
      "search.fit(x_train, y_train)\n\n" +
      "print(search.best_params_)\n" +
      "print(search.best_score_)\n" +
      "```\n\n" +
      "**Lưu ý số lượng:** 4 × 2 = 8 tổ hợp, mỗi tổ hợp chạy 5 fold → **40 lần huấn luyện**. Lưới càng rộng, chi phí tăng theo cấp số nhân.\n\n" +
      "### Random Search — thường hiệu quả hơn\n\n" +
      "Thay vì thử hết, bốc ngẫu nhiên N tổ hợp. Nghe có vẻ kém hơn, nhưng thực tế thường tốt hơn với cùng ngân sách tính toán: phần lớn siêu tham số ít ảnh hưởng, nên grid search tiêu tốn rất nhiều lượt chạy để dò các giá trị chẳng thay đổi gì.\n\n" +
      "```python\n" +
      "from sklearn.model_selection import RandomizedSearchCV\n" +
      "search = RandomizedSearchCV(pipe, grid, n_iter=20, cv=5, random_state=1009)\n" +
      "```\n\n" +
      "### Cái bẫy lớn nhất\n\n" +
      "Nếu bạn tinh chỉnh dựa trên tập test rồi báo cáo kết quả trên chính tập đó, con số ấy **không còn trung thực** — bạn đã chọn mô hình khớp nhất với tập test. Quy trình đúng:\n\n" +
      "1. Chia train / test ngay từ đầu\n" +
      "2. Tinh chỉnh bằng cross-validation **chỉ trên tập train**\n" +
      "3. Chạy tập test đúng một lần, với mô hình đã chốt\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Quét lưới khổng lồ ngay từ đầu.** Hãy quét thô trên khoảng rộng trước để tìm vùng tốt, rồi mới quét mịn quanh vùng đó — tiết kiệm hàng giờ tính toán.",
    quiz: {
      title: "Kiểm tra: Tinh chỉnh siêu tham số",
      questions: [
        {
          type: "numerical",
          prompt:
            "GridSearchCV với lưới 3 giá trị max_depth × 4 giá trị n_estimators, chạy cv=5. Tổng cộng bao nhiêu lần huấn luyện mô hình?",
          explanation: "3 × 4 = 12 tổ hợp, mỗi tổ hợp 5 fold → 60 lần huấn luyện.",
          extra: { expected: 60, tolerance: 0 },
        },
        {
          type: "mcq",
          prompt: "Đâu là siêu tham số (hyperparameter), không phải tham số mô hình học được?",
          explanation:
            "`max_depth` do người dùng đặt trước khi huấn luyện. Hệ số hồi quy, trọng số và hệ số chặn là những giá trị mô hình tự học từ dữ liệu.",
          options: [
            { label: "Hệ số w của hồi quy tuyến tính" },
            { label: "max_depth của cây quyết định", correct: true },
            { label: "Hệ số chặn (intercept)" },
            { label: "Trọng số các support vector" },
          ],
        },
        {
          type: "true_false",
          prompt:
            "Có thể dùng tập test để chọn siêu tham số tốt nhất, rồi báo cáo luôn kết quả trên tập test đó.",
          explanation:
            "Sai. Khi đó bạn đã chọn mô hình khớp nhất với tập test, nên con số báo cáo lạc quan hơn thực tế. Tinh chỉnh phải làm bằng cross-validation trên tập train; tập test chỉ chạy một lần cuối.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
        {
          type: "mcq",
          prompt: "Vì sao Random Search thường hiệu quả hơn Grid Search với cùng ngân sách tính toán?",
          explanation:
            "Phần lớn siêu tham số ảnh hưởng ít. Grid search tiêu tốn rất nhiều lượt chạy để dò các giá trị gần như không thay đổi kết quả, còn random search phủ được khoảng rộng hơn của những siêu tham số thực sự quan trọng.",
          options: [
            { label: "Vì nó luôn tìm ra tổ hợp tối ưu tuyệt đối" },
            {
              label:
                "Vì phần lớn siêu tham số ít ảnh hưởng, random search phủ rộng hơn ở những cái thực sự quan trọng",
              correct: true,
            },
            { label: "Vì nó không cần cross-validation" },
            { label: "Vì nó dùng ít bộ nhớ hơn" },
          ],
        },
      ],
    },
  },
  {
    match: "Applying a Complete Machine Learning Workflow",
    title: "Áp dụng quy trình học máy hoàn chỉnh",
    description: "Ghép mọi bước thành một quy trình chạy được từ dữ liệu thô tới mô hình đã đánh giá.",
    skillCode: "ml.workflow.end_to_end",
    body:
      "## Áp dụng quy trình học máy hoàn chỉnh\n\n" +
      "Bài này nối lại tất cả những gì đã học thành một quy trình duy nhất.\n\n" +
      "### Chín bước\n\n" +
      "| # | Bước | Câu hỏi cần trả lời |\n" +
      "|---|---|---|\n" +
      "| 1 | Xác định bài toán | Dự đoán cái gì? Regression hay classification? |\n" +
      "| 2 | Thu thập dữ liệu | Đủ chưa? Có đại diện cho thực tế không? |\n" +
      "| 3 | Khám phá (EDA) | Phân phối ra sao? Thiếu bao nhiêu? Có ngoại lai không? |\n" +
      "| 4 | Chia train/test | Có cần stratify không? |\n" +
      "| 5 | Tiền xử lý | Điền thiếu, chuẩn hoá, mã hoá — **fit chỉ trên train** |\n" +
      "| 6 | Baseline | Mô hình đơn giản làm mốc so sánh |\n" +
      "| 7 | Huấn luyện & tinh chỉnh | Cross-validation trên tập train |\n" +
      "| 8 | Đánh giá cuối | Chạy tập test **một lần** |\n" +
      "| 9 | Diễn giải & triển khai | Mô hình sai kiểu gì? Sai đó có chấp nhận được không? |\n\n" +
      "### Mã khung đầy đủ\n\n" +
      "```python\n" +
      "import pandas as pd\n" +
      "from sklearn.model_selection import train_test_split, GridSearchCV\n" +
      "from sklearn.pipeline import Pipeline\n" +
      "from sklearn.impute import SimpleImputer\n" +
      "from sklearn.preprocessing import StandardScaler\n" +
      "from sklearn.ensemble import RandomForestClassifier\n" +
      "from sklearn.metrics import classification_report, confusion_matrix\n\n" +
      "data = pd.read_csv(\"data.csv\")\n" +
      "target = \"Outcome\"\n" +
      "x, y = data.drop(target, axis=1), data[target]\n\n" +
      "x_train, x_test, y_train, y_test = train_test_split(\n" +
      "    x, y, test_size=0.2, random_state=1009, stratify=y)\n\n" +
      "pipe = Pipeline([\n" +
      "    (\"imputer\", SimpleImputer(strategy=\"median\")),\n" +
      "    (\"scaler\",  StandardScaler()),\n" +
      "    (\"model\",   RandomForestClassifier(random_state=100)),\n" +
      "])\n\n" +
      "grid = {\"model__max_depth\": [5, 10, None], \"model__n_estimators\": [100, 300]}\n" +
      "search = GridSearchCV(pipe, grid, cv=5, scoring=\"f1\", n_jobs=-1)\n" +
      "search.fit(x_train, y_train)\n\n" +
      "y_pred = search.best_estimator_.predict(x_test)   # test chạy MỘT lần\n" +
      "print(classification_report(y_test, y_pred))\n" +
      "print(confusion_matrix(y_test, y_pred))\n" +
      "```\n\n" +
      "### Bước 9 là bước hay bị bỏ qua nhất\n\n" +
      "Có được `classification_report` chưa phải là xong. Hãy hỏi tiếp:\n\n" +
      "- Mô hình sai **kiểu nào** nhiều hơn — FP hay FN? Kiểu đó có chấp nhận được trong bối cảnh thật không?\n" +
      "- Nó sai trên **nhóm nào**? Một mô hình chính xác 85% tổng thể nhưng chỉ 60% trên một nhóm người dùng cụ thể là vấn đề công bằng, không phải vấn đề kỹ thuật.\n" +
      "- Dữ liệu thật khi triển khai có giống dữ liệu huấn luyện không?\n\n" +
      "### Lỗi thường gặp nhất\n\n" +
      "**Dừng lại ở con số accuracy.** Mô hình được dùng bởi người thật, để ra quyết định thật. Hiểu nó sai ở đâu quan trọng không kém việc nó đúng bao nhiêu phần trăm.",
    quiz: {
      title: "Kiểm tra: Quy trình hoàn chỉnh",
      questions: [
        {
          type: "ordering",
          prompt: "Sắp xếp các bước theo đúng thứ tự của một quy trình học máy hoàn chỉnh.",
          explanation:
            "Đặc biệt lưu ý: chia train/test phải làm TRƯỚC tiền xử lý, và đánh giá trên tập test là bước cuối cùng, chỉ chạy một lần.",
          options: [
            { label: "Khám phá dữ liệu (EDA)" },
            { label: "Chia train / test" },
            { label: "Tiền xử lý (fit trên train)" },
            { label: "Huấn luyện và tinh chỉnh bằng cross-validation" },
            { label: "Đánh giá trên tập test" },
            { label: "Diễn giải kết quả và triển khai" },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Mô hình đạt accuracy 85% tổng thể nhưng chỉ 60% trên nhóm người dùng nữ. Đây là vấn đề gì?",
          explanation:
            "Đây là vấn đề công bằng (fairness), không phải lỗi kỹ thuật. Con số tổng thể che giấu việc mô hình phục vụ một nhóm kém hơn hẳn — cần xem lại dữ liệu huấn luyện có đại diện đủ cho nhóm đó không.",
          options: [
            { label: "Không có vấn đề gì — 85% là đủ tốt" },
            {
              label: "Vấn đề công bằng — mô hình phục vụ một nhóm kém hơn hẳn, cần xem lại dữ liệu",
              correct: true,
            },
            { label: "Lỗi cú pháp trong code" },
            { label: "Cần tăng số vòng huấn luyện" },
          ],
        },
        {
          type: "true_false",
          prompt: "Trong quy trình chuẩn, tiền xử lý dữ liệu được thực hiện trước khi chia train/test.",
          explanation:
            "Sai. Phải chia trước rồi mới tiền xử lý, và các tham số tiền xử lý (median, mean, std) chỉ được học từ tập train. Làm ngược lại là rò rỉ dữ liệu.",
          options: [
            { label: "Đúng" },
            { label: "Sai", correct: true },
          ],
        },
      ],
    },
  },
];

// ─────────────────────────────────────────────────────────────────────────

async function ensureLecturer(): Promise<{ userId: string; password: string | null }> {
  const existing = await prisma.user.findUnique({ where: { email: LECTURER.email } });
  if (existing) return { userId: existing.id, password: null };

  const password = randomBytes(12).toString("base64url");
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const role = await prisma.role.findUniqueOrThrow({ where: { name: RoleName.Instructor } });
  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email: LECTURER.email,
        passwordHash,
        displayName: LECTURER.displayName,
        locale: "vi",
        timezone: "Asia/Ho_Chi_Minh",
        emailVerifiedAt: new Date(), // admin-provisioned, no verification mail sent
      },
    });
    await tx.authProvider.create({
      data: { userId: u.id, provider: "password", providerUserId: LECTURER.email },
    });
    await tx.userRole.create({ data: { userId: u.id, roleId: role.id } });
    return u;
  });
  return { userId: user.id, password };
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);

  if (dryRun) {
    console.log("DRY RUN\n");
    console.log(`owner -> ${LECTURER.displayName} <${LECTURER.email}>`);
    console.log(`description -> thêm bản tiếng Việt (${DESCRIPTION_VI.length} ký tự)`);
    for (const l of LESSONS) {
      console.log(
        `  "${l.match}" -> "${l.title}"\n    body ${l.body.length} ký tự, quiz ${l.quiz.questions.length} câu (${[...new Set(l.quiz.questions.map((q) => q.type))].join(", ")})`,
      );
    }
    console.log(
      `\nTổng: ${LESSONS.length} bài viết lại, ${LESSONS.reduce((s, l) => s + l.quiz.questions.length, 0)} câu quiz mới`,
    );
    return;
  }

  // ── 1. Lecturer becomes owner; previous owner stays as co-instructor ────
  const { userId: lecturerId, password } = await ensureLecturer();
  const currentOwner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
  });
  if (currentOwner && currentOwner.userId !== lecturerId) {
    // Demote first: a course should not momentarily have two owners.
    await prisma.courseInstructor.update({
      where: { id: currentOwner.id },
      data: { role: "co-instructor" },
    });
  }
  await prisma.courseInstructor.upsert({
    where: { courseId_userId: { courseId: course.id, userId: lecturerId } },
    update: { role: "owner" },
    create: { courseId: course.id, userId: lecturerId, role: "owner" },
  });
  console.log(`owner -> ${LECTURER.displayName}${password ? " (tài khoản mới)" : ""}`);

  // ── 2. Bilingual description ───────────────────────────────────────────
  if (!course.description.startsWith("Khoá học trang bị")) {
    await prisma.course.update({
      where: { id: course.id },
      data: { description: DESCRIPTION_VI + course.description },
    });
    console.log("description -> đã thêm bản tiếng Việt");
  } else {
    console.log("description -> đã có tiếng Việt, bỏ qua");
  }

  // ── 3. Rewrite lessons + add quizzes ───────────────────────────────────
  let rewritten = 0;
  let quizzed = 0;
  for (const plan of LESSONS) {
    const lesson = await prisma.lesson.findFirst({
      where: {
        module: { courseId: course.id },
        OR: [{ title: { startsWith: plan.match } }, { title: plan.title }],
      },
      include: {
        contentItems: { where: { type: "markdown" }, orderBy: { orderIndex: "asc" } },
        quizzes: { where: { cuepointOnly: false }, select: { id: true } },
      },
    });
    if (!lesson) {
      console.log(`  ⚠ không tìm thấy bài: ${plan.match}`);
      continue;
    }

    // Title + description + body. Updating the existing markdown item in place
    // keeps its LessonActivity row and ordering intact.
    await prisma.lesson.update({
      where: { id: lesson.id },
      data: { title: plan.title, description: plan.description },
    });
    const md = lesson.contentItems[0];
    if (md) {
      await prisma.contentItem.update({
        where: { id: md.id },
        data: { payload: { body: plan.body } },
      });
    }
    rewritten++;

    if (lesson.quizzes.length > 0) {
      console.log(`  ${plan.title} — đã có quiz, chỉ cập nhật bài đọc`);
      continue;
    }

    const skill = await prisma.skill.findUnique({ where: { code: plan.skillCode } });
    if (!skill) throw new Error(`missing skill ${plan.skillCode}`);
    const owner = lecturerId;
    const { quizId } = await createQuiz(
      owner,
      { courseId: course.id, lessonId: lesson.id },
      {
        title: plan.quiz.title,
        description: "Kiểm tra nhanh sau khi đọc xong bài.",
        passThresholdPct: 70,
        maxAttempts: 5,
        requireConfidence: true,
      },
      prisma,
    );
    for (const [i, q] of plan.quiz.questions.entries()) {
      await createQuestion(
        owner,
        quizId,
        {
          type: q.type,
          prompt: q.prompt,
          ...(q.explanation ? { explanation: q.explanation } : {}),
          points: 1,
          orderIndex: i,
          ...(q.options
            ? {
                options: q.options.map((o) => ({
                  label: o.label,
                  isCorrect: o.correct ?? false,
                  ...(o.extra ? { extra: o.extra } : {}),
                })),
              }
            : {}),
          ...(q.extra ? { extra: q.extra } : {}),
          skillIds: [skill.id],
        },
        prisma,
      );
    }
    quizzed++;
    console.log(`  ${plan.title} — ${plan.quiz.questions.length} câu quiz`);
  }

  console.log(`\n${rewritten} bài viết lại, ${quizzed} quiz mới.`);
  if (password) {
    console.log(`\nTài khoản ${LECTURER.email} — mật khẩu: ${password}`);
    console.log("Đổi ngay khi đăng nhập lần đầu.");
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
