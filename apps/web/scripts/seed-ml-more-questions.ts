/**
 * Extra multiple-choice questions for Fundamental of Machine Learning.
 *
 * A micro-credential needs a question pool large enough that a learner cannot
 * pass by memorising a handful of items. This adds mcq / true-false questions to
 * the end-of-lesson quiz of each lesson listed below, so that each course has at
 * least 150 multiple-choice questions in its lesson quizzes.
 *
 *   tsx scripts/seed-ml-more-questions.ts [--dry-run]
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

const COURSE_SLUG = "fundamental-of-machine-learning";

interface Opt { label: string; correct?: boolean; mis?: string }
interface Q { type: "mcq" | "true_false"; prompt: string; explanation: string; options: Opt[] }
const T = (label: string, correct?: boolean, mis?: string): Opt => ({ label, ...(correct ? { correct } : {}), ...(mis ? { mis } : {}) });
const YES_NO = (yes: boolean): Opt[] => [T("Đúng", yes), T("Sai", !yes)];

const EXISTING_MIS_CODES: Record<string, string> = {
  accuracy_always_good: "ml_accuracy_always_good",
  attr_shared: "py_instance_attribute_shared",
  biasvar: "ml.micro.biasvar_experiment",
  ch1_label_in_feature_vector: "ml_label_in_feature_vector",
  ch1_missing_vs_format: "ml_missing_vs_wrong_format",
  ch1_ordinal_for_nominal: "ml_ordinal_encoding_for_nominal",
  ch2_bootstrap_no_repeat: "ml_bootstrap_no_repeat",
  ch2_gini_high_better: "ml_gini_higher_is_better",
  ch2_kernel_reduce_dim: "ml_kernel_reduces_dimension",
  ch2_rf_same_data: "ml_forest_same_data",
  ch2_sigmoid_is_label: "ml_sigmoid_outputs_label",
  ch2_svm_all_points: "ml_svm_all_points_matter",
  ch3_f1_arithmetic_mean: "ml_f1_arithmetic_mean",
  ch3_fp_fn_swap: "ml_fp_fn_swap",
  ch3_precision_recall_swap: "ml_precision_recall_swap",
  confusion: "ml.micro.confusion_matrix",
  cvgrid: "ml.micro.cv_gridsearch",
  div_vs_floor: "py_true_vs_floor_division",
  fit_test: "ml_fit_on_test_set",
  fitpredict: "ml.micro.fit_predict",
  forest: "ml.micro.random_forest",
  gini: "ml.micro.gini_impurity",
  http_status: "http_status_class_confusion",
  imbalance: "ml.micro.accuracy_imbalance",
  imputer: "ml.micro.imputer_pipeline",
  inherit_vs_poly: "py_inheritance_vs_polymorphism",
  lab_bias_variance_swap: "ml_bias_variance_swap",
  lab_complexity_better: "ml_complexity_always_better",
  lab_fit_on_test: "ml_fit_transform_on_test",
  lab_ignore_std: "ml_ignore_cv_std",
  lab_kfold_shuffles: "ml_kfold_shuffles_by_default",
  lab_mae_outlier: "ml_mae_more_outlier_sensitive",
  lab_mean_median: "ml_mean_median_confusion",
  lab_mse_unit: "ml_mse_rmse_unit_confusion",
  lab_rmse_below_mae: "ml_rmse_below_mae",
  lab_train_error_good: "ml_low_train_error_means_good",
  lab_tune_on_test: "ml_tune_on_test_set",
  linear: "ml.micro.linear_regression",
  list_alias: "py_list_assignment_copies",
  load: "ml.micro.load_csv_xy",
  logistic: "ml.micro.logistic_regression",
  mae: "ml.micro.mae",
  norm_vs_std: "ml_normalization_vs_standardization",
  np_axis_swap: "np_axis_swap",
  pd_nan_zero: "pd_mean_counts_nan_as_zero",
  pr_seed_quality: "ml_random_state_improves_accuracy",
  pr_train_on_test: "ml_fit_model_on_test_set",
  prf: "ml.micro.precision_recall_f1",
  r2: "ml.micro.r_squared",
  regression_vs_classification: "ml_regression_vs_classification",
  report: "ml.micro.read_report",
  rmse: "ml.micro.mse_rmse",
  scaler: "ml.micro.standard_scaler",
  seed: "ml.micro.random_state_repro",
  split: "ml.micro.train_test_split",
  svmIdea: "ml.micro.svm_idea",
  svmKernel: "ml.micro.svm_kernel",
  svmMargin: "ml.micro.svm_margin",
  tree: "ml.micro.decision_tree",
};

// ── 37 câu trắc nghiệm bổ sung cho khoá Fundamental of Machine Learning ──
// Đoạn không import/export. Dùng các kiểu/hàm có sẵn: Opt, Q, T, YES_NO.
// Mọi con số / hành vi code đã được chạy thật trong ml_more_verify.py.
// Ghi chú: mã nguồn Python trong đề bọc bằng ```python ... ``` để hàm rich() đổi sang <pre><code>.

const MORE_MIS: Record<string, { code: string; name: string; description: string }> = {
  more_digits_are_numeric: {
    code: "ml_more_digits_are_numeric",
    name: "Thấy chữ số là coi đặc trưng số",
    description:
      "Học viên phân loại đặc trưng theo cách lưu (chữ số) chứ không theo ý nghĩa: mã tỉnh, mã số sinh viên, số điện thoại lưu bằng số nhưng chỉ định danh, không có thứ tự hay phép tính có nghĩa.",
  },
  more_supervised_no_labels: {
    code: "ml_more_supervised_without_labels",
    name: "Nghĩ supervised learning tự tìm được nhãn",
    description:
      "Học viên cho rằng thuật toán supervised có thể chạy trên dữ liệu chưa gán nhãn, bỏ qua bước gán nhãn (annotator) vốn là điều kiện đầu vào.",
  },
  more_duplicate_is_diversity: {
    code: "ml_more_duplicate_is_diversity",
    name: "Tưởng sao chép dòng làm dữ liệu đa dạng hơn",
    description:
      "Học viên nghĩ nhân bản các mẫu sẵn có làm tăng độ đa dạng của dữ liệu; thực tế nó chỉ tạo dòng trùng lặp, không thêm thông tin mới.",
  },
  more_minmax_divide_max: {
    code: "ml_more_minmax_divide_by_max",
    name: "Bỏ qua ảnh hưởng của ngoại lai lên Min-Max",
    description:
      "Học viên không thấy rằng một giá trị ngoại lai kéo giãn x_max − x_min, khiến các giá trị bình thường bị nén sát nhau gần 0 sau Min-Max (hoặc nhầm công thức thành x / x_max).",
  },
  more_validation_equals_test: {
    code: "ml_more_validation_equals_test",
    name: "Coi validation và testing là một bước",
    description:
      "Học viên dùng cùng một tập vừa để so sánh, điều chỉnh mô hình vừa để báo cáo điểm cuối, nên điểm báo cáo quá lạc quan; test phải là dữ liệu chưa dùng để học hay chọn.",
  },
  more_mae_scale_free: {
    code: "ml_more_mae_scale_free",
    name: "Tưởng MAE không phụ thuộc thang đo",
    description:
      "Học viên cho rằng MAE là tỉ lệ không đơn vị; thực tế MAE cùng đơn vị với biến mục tiêu nên đổi đơn vị thì MAE đổi theo, và không so được giữa các bài toán khác thang đo.",
  },
  more_r2_never_negative: {
    code: "ml_more_r2_never_negative",
    name: "Tưởng R² luôn nằm trong [0, 1]",
    description:
      "Học viên không nhận ra R² = 1 − (sai số mô hình)/(sai số baseline) có thể âm khi mô hình tệ hơn baseline luôn đoán trung bình.",
  },
  more_imputer_question_mark: {
    code: "ml_more_imputer_sees_question_mark",
    name: "Tưởng SimpleImputer tự nhận '?' là giá trị thiếu",
    description:
      "Học viên nghĩ imputer nhận ra các ký hiệu như '?', 'N/A' là ô trống; mặc định nó chỉ coi NaN là giá trị thiếu nên phải đổi các ký hiệu đó về NaN trước.",
  },
  more_data_fixes_all: {
    code: "ml_more_more_data_fixes_all",
    name: "Tưởng thêm dữ liệu chữa được mọi kiểu sai số",
    description:
      "Học viên nghĩ tăng số mẫu luôn giảm sai số test; thêm dữ liệu chủ yếu giảm variance (overfitting), còn bias cao do mô hình quá đơn giản thì cần tăng độ phức tạp.",
  },
  more_noise_removable: {
    code: "ml_more_noise_removable",
    name: "Tưởng có thể xoá hoàn toàn sai số do nhiễu",
    description:
      "Học viên cho rằng mô hình đủ mạnh hoặc đủ dữ liệu sẽ đưa sai số test về gần 0; phần nhiễu ngẫu nhiên của dữ liệu (irreducible error) không mô hình nào dự đoán được.",
  },
};

const MORE: Array<{ match: string; questions: Q[] }> = [
  // ═══════════════════════════ Chapter 1 ═══════════════════════════
  {
    match: "1.1 Máy học như thế nào",
    questions: [
      {
        type: "mcq",
        prompt:
          "Mô hình dự đoán giá một căn nhà là 3.0 tỷ đồng trong khi giá thật (ground truth) là 3.5 tỷ. Nếu loss function là bình phương sai lệch (như MSE tính trên một mẫu), loss value của mẫu này là bao nhiêu?",
        explanation:
          "Loss = (3.5 − 3.0)² = 0.5² = 0.25. Con số 0.5 chỉ là sai lệch chưa bình phương. Loss value càng nhỏ nghĩa là dự đoán càng gần ground truth; giá trị này là tín hiệu để bước Update chỉnh lại mô hình.",
        options: [T("0.5"), T("0.25", true), T("3.25"), T("0")],
      },
    ],
  },
  {
    match: "1.2 Các loại dữ liệu",
    questions: [
      {
        type: "true_false",
        prompt:
          "Dù là dữ liệu bảng, văn bản, hình ảnh hay âm thanh, trước khi đưa vào mô hình học máy chúng đều phải được biểu diễn thành số (ví dụ ảnh là lưới các giá trị điểm ảnh).",
        explanation:
          "Đúng. Mô hình chỉ tính toán trên số: ảnh là lưới giá trị điểm ảnh, âm thanh (waveform) là dãy biên độ theo thời gian, văn bản phải được mã hoá thành số, còn dữ liệu bảng thì cột hạng mục cũng cần mã hoá. Nói cách khác không có dạng dữ liệu nào được “đọc thẳng” mà không qua biểu diễn số.",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "1.3 Dữ liệu có nhãn và ba nhóm thuật toán",
    questions: [
      {
        type: "mcq",
        prompt:
          "Một công ty có 10.000 ảnh sản phẩm chụp từ dây chuyền nhưng chưa có nhãn nào. Họ muốn huấn luyện mô hình supervised để phân loại ảnh thành “đạt” và “lỗi”. Việc cần làm trước tiên là gì?",
        explanation:
          "Supervised learning học từ dữ liệu có nhãn, nên trước hết phải nhờ annotator gán nhãn “đạt”/“lỗi” cho ít nhất một phần số ảnh. Chạy thẳng thuật toán supervised khi chưa có nhãn thì không có “đáp án” để học; chuẩn hoá điểm ảnh không thay thế được nhãn; còn reinforcement learning dùng agent, state, action, reward chứ không phải cách xử lý dữ liệu chưa nhãn.",
        options: [
          T("Chạy thẳng thuật toán supervised, mô hình sẽ tự tìm ra nhãn", false, "more_supervised_no_labels"),
          T("Nhờ annotator gán nhãn “đạt”/“lỗi” cho (một phần) các ảnh", true),
          T("Chuyển sang reinforcement learning vì dữ liệu chưa có nhãn"),
          T("Chuẩn hoá giá trị điểm ảnh rồi huấn luyện luôn"),
        ],
      },
    ],
  },
  {
    match: "1.4 Regression, classification, clustering, association",
    questions: [
      {
        type: "mcq",
        prompt:
          "Nhóm A xây mô hình dự đoán nhiệt độ ngày mai là bao nhiêu độ C. Sau đó họ đổi yêu cầu thành “ngày mai có trên 30°C hay không?” (trả lời Có/Không), vẫn dùng các đặc trưng đầu vào như cũ. Bài toán bây giờ thuộc loại nào?",
        explanation:
          "Loại bài toán do bản chất đầu ra quyết định, không phải do đặc trưng đầu vào. Đầu ra bây giờ là một nhãn Có/Không nên đây là classification. Clustering và association là các bài toán của unsupervised learning, không có nhãn cho trước.",
        options: [
          T("Vẫn là regression vì dữ liệu đầu vào không đổi", false, "regression_vs_classification"),
          T("Clustering, vì các ngày được chia thành hai nhóm"),
          T("Classification, vì đầu ra giờ là một nhãn Có/Không", true),
          T("Association, vì hai nhãn đi kèm với nhiệt độ"),
        ],
      },
    ],
  },
  {
    match: "1.5 Các loại đặc trưng",
    questions: [
      {
        type: "true_false",
        prompt:
          "Đặc trưng “mã tỉnh/thành” (01 = Hà Nội, 48 = Đà Nẵng, 79 = TP.HCM) tuy được lưu bằng chữ số nhưng là đặc trưng categorical (nominal), không phải numerical.",
        explanation:
          "Đúng. Loại đặc trưng do ý nghĩa quyết định, không do cách lưu. Mã chỉ để định danh: 79 không “lớn hơn” hay “gấp” 48 theo nghĩa nào, cộng hay lấy trung bình các mã cũng vô nghĩa. Đây là nominal (không có thứ tự) và nên mã hoá bằng one-hot.",
        options: [T("Đúng", true), T("Sai", false, "more_digits_are_numeric")],
      },
    ],
  },
  {
    match: "1.6 Thuật ngữ bảng dữ liệu và chia tập",
    questions: [
      {
        type: "mcq",
        prompt:
          "Một bảng có 1.000 dòng được chia thành Train set, Validation set và Test set theo tỉ lệ 70% / 15% / 15%. Validation set có bao nhiêu dòng?",
        explanation:
          "1.000 × 15% = 150 dòng. Ba tập cộng lại phải đủ 1.000: 700 + 150 + 150. Con số 700 là của Train set (tập lớn nhất), còn 300 là tổng của Validation và Test.",
        options: [T("700"), T("300"), T("150", true), T("15")],
      },
    ],
  },
  {
    match: "1.7 Chất lượng dữ liệu",
    questions: [
      {
        type: "mcq",
        prompt:
          "Bộ ảnh huấn luyện có 5.000 ảnh mèo, tất cả chụp cùng một góc, cùng nền, cùng ánh sáng. Cách nào giúp tăng độ đa dạng của dữ liệu một cách có ích?",
        explanation:
          "Độ đa dạng đến từ những mẫu thật sự khác nhau, nên cần thu thêm ảnh ở nhiều góc chụp, nền và ánh sáng. Sao chép ảnh chỉ tạo các dòng trùng lặp (duplicated values) — không thêm thông tin mới; xoá các ảnh khác thường hay chỉ giữ ảnh giống nhau còn làm dữ liệu đơn điệu hơn.",
        options: [
          T("Sao chép mỗi ảnh hiện có thêm 10 lần để có 50.000 ảnh", false, "more_duplicate_is_diversity"),
          T("Chỉ giữ lại những ảnh giống nhau nhất để mô hình học ổn định"),
          T("Thu thêm ảnh mèo ở nhiều góc, nền và điều kiện ánh sáng khác nhau", true),
          T("Xoá các ảnh trông khác thường"),
        ],
      },
    ],
  },
  {
    match: "1.8 Chuẩn hoá đặc trưng số",
    questions: [
      {
        type: "mcq",
        prompt:
          "Cột thu nhập (triệu đồng) có các giá trị 10, 12, 11, 13 và 110 (một ngoại lai). Sau khi chuẩn hoá Min-Max, giá trị 13 thành khoảng bao nhiêu và điều đó cho thấy gì?",
        explanation:
          "x_min = 10 và x_max = 110 nên (13 − 10) / (110 − 10) = 0.03. Ngoại lai kéo giãn khoảng x_max − x_min, nên bốn giá trị bình thường bị nén sát nhau gần 0 và khó phân biệt. Con số 0.12 là 13/110 (quên trừ x_min), còn giá trị âm như khoảng −0.5 mới là của z-score (−0.46 ở cột này); Min-Max luôn cho kết quả trong [0, 1].",
        options: [
          T("Khoảng 0.12, vì Min-Max chia mỗi giá trị cho giá trị lớn nhất", false, "more_minmax_divide_max"),
          T("Khoảng −0.5, vì Min-Max đưa giá trị nhỏ hơn trung bình xuống âm", false, "norm_vs_std"),
          T("Khoảng 0.5, vì 13 nằm ở giữa khoảng [0, 1]"),
          T("Khoảng 0.03: các giá trị bình thường bị nén sát 0 do ngoại lai 110", true),
        ],
      },
    ],
  },
  {
    match: "1.9 Mã hoá đặc trưng hạng mục",
    questions: [
      {
        type: "mcq",
        prompt:
          "Một bảng có ba cột hạng mục: cỡ áo (XS, S, M, L, XL — có thứ tự), màu (black, blue, white, green) và có túi (Yes/No). Ta mã hoá cỡ áo bằng ordinal encoding, màu bằng one-hot, và có túi thành một cột 0/1. Ba cột gốc trở thành tổng cộng bao nhiêu cột số?",
        explanation:
          "Cỡ áo: 1 cột (ordinal, giá trị 0 đến 4). Màu: 4 cột one-hot. Có túi: 1 cột 0/1. Tổng 1 + 4 + 1 = 6 cột. 11 là kết quả nếu one-hot cả ba cột (5 + 4 + 2), còn 3 là nếu vẫn mỗi cột một số, tức mã hoá màu bằng 0, 1, 2, 3 và tạo thứ tự giả cho màu.",
        options: [
          T("3 — mỗi cột gốc thành một cột, màu mã hoá 0, 1, 2, 3", false, "ch1_ordinal_for_nominal"),
          T("6", true),
          T("11 — one-hot cả ba cột"),
          T("7 — có túi thành hai cột Yes và No"),
        ],
      },
    ],
  },
  {
    match: "1.10 Pipeline học máy",
    questions: [
      {
        type: "mcq",
        prompt:
          "Nhóm đã huấn luyện vài mô hình và dùng một tập dữ liệu riêng để so sánh, điều chỉnh chúng (Model validation). Trước khi triển khai, bước nào cho ước lượng chất lượng cuối cùng trên dữ liệu mà mô hình chưa từng dùng để học hay để chọn?",
        explanation:
          "Đó là Model testing: chấm mô hình đã chốt trên dữ liệu chưa dùng vào việc học hay chọn, để có con số trung thực trước khi Model deployment. Model validation chính là bước dùng dữ liệu để so sánh và điều chỉnh, nên điểm ở đó đã bị “nhìn thấy” khi chọn mô hình và thường quá lạc quan. Model selection và Statistics nằm trước bước huấn luyện.",
        options: [
          T("Model validation", false, "more_validation_equals_test"),
          T("Model selection"),
          T("Statistics"),
          T("Model testing", true),
        ],
      },
    ],
  },

  // ═══════════════════════════ Chapter 2 ═══════════════════════════
  {
    match: "2.1 Hồi quy tuyến tính",
    questions: [
      {
        type: "true_false",
        prompt:
          "Trong Multiple Linear Regression y = ω₁x₁ + ω₂x₂ + … + ωₚxₚ + ω₀ + ε, nếu mọi đặc trưng đều bằng 0 thì giá trị dự đoán (bỏ qua nhiễu ε) bằng đúng hệ số ω₀.",
        explanation:
          "Đúng. Khi x₁ = … = xₚ = 0, mọi số hạng ωᵢ·xᵢ đều bằng 0 và chỉ còn ω₀ (hệ số chặn, intercept). Đây cũng là chỗ đường thẳng hay mặt phẳng cắt trục y. Trong thực nghiệm với LinearRegression, dự đoán tại điểm gốc luôn trùng với intercept_.",
        options: YES_NO(true),
      },
    ],
  },
  {
    match: "2.2 Hồi quy logistic",
    questions: [
      {
        type: "mcq",
        prompt:
          "Logistic Regression cho xác suất Senior của một nhân viên là 0.8; với ngưỡng 0.5 nhãn dự đoán là Senior. Nếu giữ nguyên mô hình nhưng đổi ngưỡng thành 0.9, nhãn dự đoán của nhân viên này là gì?",
        explanation:
          "Nhãn 1 (Senior) chỉ được gán khi xác suất vượt ngưỡng. Với ngưỡng 0.9, xác suất 0.8 không vượt nên nhãn là 0 (Junior). Xác suất do sigmoid tính không đổi khi đổi ngưỡng, và bản thân sigmoid không cho ra nhãn: chính bước so với ngưỡng mới cho nhãn.",
        options: [
          T("Vẫn là Senior (nhãn 1), vì sigmoid đã cho ra nhãn 1", false, "ch2_sigmoid_is_label"),
          T("Junior (nhãn 0), vì 0.8 không vượt ngưỡng 0.9", true),
          T("Xác suất tự đổi thành 0.9 theo ngưỡng mới"),
          T("Không gán được nhãn vì 0.8 khác 0.9"),
        ],
      },
    ],
  },
  {
    match: "2.3 Cây quyết định và bài toán duyệt vay",
    questions: [
      {
        type: "mcq",
        prompt:
          "Bảng đếm khi chia 14 mẫu theo age là: young 2 Yes / 3 No, middle 4 Yes / 0 No, senior 3 Yes / 2 No. Nếu thay bằng cách chia theo income (một thuộc tính khác), tổng số mẫu Yes và tổng số mẫu No cộng qua tất cả các nhánh sẽ là bao nhiêu?",
        explanation:
          "Vẫn là 9 Yes và 5 No: mỗi mẫu rơi vào đúng một nhánh, nên chia theo thuộc tính nào thì tổng số mẫu mỗi nhãn cũng không đổi (2 + 4 + 3 = 9 Yes, 3 + 0 + 2 = 5 No). Điều thay đổi giữa các thuộc tính là mỗi nhãn được phân vào các nhánh ra sao, tức độ “thuần” của từng nhánh.",
        options: [
          T("7 Yes và 7 No, vì mỗi thuộc tính chia đôi các nhãn"),
          T("Nhiều hơn 9 Yes nếu income tách các mẫu tốt hơn age"),
          T("Chỉ biết sau khi tính Gini của income"),
          T("9 Yes và 5 No — mỗi mẫu rơi vào đúng một nhánh nên tổng không đổi", true),
        ],
      },
    ],
  },
  {
    match: "2.4 Gini impurity",
    questions: [
      {
        type: "mcq",
        prompt:
          "Có 10 mẫu (5 Yes, 5 No). Cách chia 1 cho hai nhánh 5 mẫu: nhánh trái 4 Yes / 1 No, nhánh phải 1 Yes / 4 No. Cách chia 2 cũng hai nhánh 5 mẫu: nhánh trái 3 Yes / 2 No, nhánh phải 2 Yes / 3 No. Theo Gini có trọng số, nên chọn cách nào?",
        explanation:
          "Cách 1: mỗi nhánh có Gini = 1 − (0.8² + 0.2²) = 0.32, nên Gini có trọng số = 0.5·0.32 + 0.5·0.32 = 0.32. Cách 2: mỗi nhánh có Gini = 1 − (0.6² + 0.4²) = 0.48 nên Gini có trọng số = 0.48. Thuật toán chọn Gini có trọng số nhỏ nhất nên chọn cách 1 (các nhánh thuần khiết hơn). Chọn cách 2 vì “Gini lớn hơn” là hiểu ngược: Gini đo độ lẫn tạp.",
        options: [
          T("Cách 2, vì Gini có trọng số 0.48 lớn hơn 0.32", false, "ch2_gini_high_better"),
          T("Hai cách như nhau vì cả hai đều chia thành hai nhánh 5 mẫu"),
          T("Cách 1, vì Gini có trọng số 0.32 nhỏ hơn 0.48 của cách 2", true),
          T("Cách 2, vì mỗi nhánh còn cả hai nhãn nên còn nhiều chỗ để chia tiếp"),
        ],
      },
    ],
  },
  {
    match: "2.5 Bootstrapping và Random Forest",
    questions: [
      {
        type: "mcq",
        prompt:
          "Một Random Forest phân loại gồm 5 cây, mỗi cây học trên một tập bootstrap riêng. Với một đơn vay mới, các cây dự đoán lần lượt: Accept, Reject, Accept, Accept, Reject. Kết quả tổng hợp theo đa số phiếu là gì?",
        explanation:
          "Accept có 3 phiếu, Reject có 2 phiếu, nên dự đoán của rừng là Accept. Các cây có thể bất đồng vì mỗi cây học trên một tập bootstrap khác nhau; chính việc tổng hợp nhiều cây “bỏ phiếu” làm mô hình ổn định hơn một cây đơn. Kết quả không phụ thuộc cây nào đứng cuối.",
        options: [
          T("Reject, vì cây cuối cùng dự đoán Reject"),
          T("Tình huống vô lý: mọi cây học cùng dữ liệu nên phải cho cùng một nhãn", false, "ch2_rf_same_data"),
          T("Accept (3 phiếu trên 5)", true),
          T("Không có kết quả, vì chỉ đưa ra được khi cả 5 cây đồng ý"),
        ],
      },
    ],
  },
  {
    match: "2.6 SVM: chọn đường phân lớp nào",
    questions: [
      {
        type: "mcq",
        prompt:
          "Hai đường thẳng đều tách đúng 100% điểm huấn luyện hai lớp. Đường P nằm giữa hai lớp, cách đều điểm gần nhất của mỗi lớp; đường Q nằm sát một vài điểm của lớp xanh. Vì sao P thường được ưa chuộng hơn Q khi gặp dữ liệu mới?",
        explanation:
          "Điểm mới thường hơi lệch so với các mẫu cũ. Với P (xa cả hai lớp), điểm lệch nhẹ vẫn nằm đúng phía; với Q (sát điểm lớp xanh), chỉ cần lệch chút là sang phía sai. Đây chính là trực giác dẫn tới tiêu chí lề lớn nhất của SVM. Cả P và Q đều phân đúng mọi điểm huấn luyện, nên không phải Q sai ở tập train, và số điểm mà đường đi qua không phải tiêu chí.",
        options: [
          T("Điểm mới lệch nhẹ vẫn đúng phía của P, còn với Q chỉ lệch chút là bị phân sai", true),
          T("Vì P có ít tham số hơn Q"),
          T("Vì Q phân sai một vài điểm huấn luyện"),
          T("Vì P đi qua nhiều điểm dữ liệu hơn Q"),
        ],
      },
    ],
  },
  {
    match: "2.7 SVM: lề cực đại và support vectors",
    questions: [
      {
        type: "mcq",
        prompt:
          "Dữ liệu một chiều: lớp A gồm x = 1 và x = 2; lớp B gồm x = 4 và x = 5. SVM lề cực đại đặt ranh giới ở đâu và điểm nào là support vectors?",
        explanation:
          "Lề lớn nhất đạt được khi ranh giới nằm chính giữa hai điểm gần nhau nhất của hai lớp là x = 2 và x = 4, tức tại x = 3; hai điểm này là support vectors. Hai điểm xa hơn (x = 1 và x = 5) không ảnh hưởng: bỏ x = 1 ranh giới vẫn ở x = 3, còn bỏ x = 2 thì ranh giới dịch tới x = 2.5. Vì vậy không phải cả bốn điểm đều là support vectors.",
        options: [
          T("Ranh giới ở x = 3; cả bốn điểm đều là support vectors", false, "ch2_svm_all_points"),
          T("Ranh giới ở x = 3; support vectors là x = 1 và x = 5 (hai điểm xa nhất)"),
          T("Ranh giới ở x = 2, ngay tại điểm lớp A gần nhất"),
          T("Ranh giới ở x = 3; support vectors là x = 2 và x = 4", true),
        ],
      },
    ],
  },
  {
    match: "2.8 SVM: kernel trick",
    questions: [
      {
        type: "mcq",
        prompt:
          "Dữ liệu một chiều: lớp A gồm x = −1, 0, 1; lớp B gồm x = −3 và x = 3. Không có ngưỡng nào trên trục x tách được hai lớp. Phép ánh xạ nào cho phép một đường thẳng tách chúng?",
        explanation:
          "Thêm chiều x² đưa mỗi điểm thành (x, x²): lớp A có x² ∈ {0, 1}, lớp B có x² = 9, nên đường ngang x² = 5 tách được hai lớp. Đây là ý tưởng của kernel trick: nâng dữ liệu lên không gian nhiều chiều hơn. Thêm chiều 2x thì các điểm vẫn nằm trên một đường thẳng nên vẫn không tách được; nhân x với 100 hay bỏ điểm không thay đổi tính không tách được (bỏ điểm còn là làm mất dữ liệu).",
        options: [
          T("Thêm chiều thứ hai bằng 2x, để điểm thành (x, 2x)"),
          T("Thêm chiều thứ hai bằng x², để điểm thành (x, x²)", true),
          T("Nhân mọi giá trị x với 100 để kéo giãn dữ liệu"),
          T("Bỏ hai điểm của lớp B để phần còn lại tách được", false, "ch2_kernel_reduce_dim"),
        ],
      },
    ],
  },

  // ═══════════════════════════ Chapter 3 ═══════════════════════════
  {
    match: "3.1 Accuracy và dữ liệu mất cân bằng",
    questions: [
      {
        type: "mcq",
        prompt:
          "Tập kiểm thử có 970 mẫu lớp đa số và 30 mẫu lớp thiểu số. Một mô hình đạt accuracy 97%. Kết luận nào hợp lý nhất?",
        explanation:
          "Một mô hình luôn đoán lớp đa số cũng đạt accuracy 970/1000 = 97% mà không bắt được mẫu thiểu số nào (recall bằng 0). Vì vậy 97% chưa chứng minh điều gì, cần xem thêm recall (và precision) của lớp thiểu số. Không thể suy ra recall bằng 97%: accuracy gộp cả hai lớp và bị lớp đa số chi phối.",
        options: [
          T("Mô hình rất tốt vì accuracy 97% gần như tuyệt đối", false, "accuracy_always_good"),
          T("Mô hình bắt được 97% số mẫu của lớp thiểu số"),
          T("Chưa kết luận được: luôn đoán lớp đa số cũng đạt 97%, cần xem recall của lớp thiểu số", true),
          T("Mô hình chắc chắn kém vì accuracy chưa đạt 100%"),
        ],
      },
    ],
  },
  {
    match: "3.2 Ma trận nhầm lẫn (Confusion Matrix)",
    questions: [
      {
        type: "mcq",
        prompt:
          "Bộ lọc spam (spam là lớp +) chạy trên 8 email. Thực tế: spam, spam, không, không, spam, không, không, không. Dự đoán: spam, không, spam, không, spam, spam, không, không. Có bao nhiêu email là False Positive?",
        explanation:
          "False Positive là email thật sự KHÔNG phải spam nhưng bị dự đoán là spam: email thứ 3 và thứ 6, nên FP = 2. Đếm đủ các ô: TP = 2 (email 1, 5), FN = 1 (email 2), FP = 2, TN = 3 (email 4, 7, 8). Con số 1 là FN (đảo vai trò dự đoán/thực tế), 3 là TN (cũng bằng số lỗi FP + FN), 5 là số email thật sự không phải spam (FP + TN).",
        options: [
          T("1", false, "ch3_fp_fn_swap"),
          T("2", true),
          T("3"),
          T("5"),
        ],
      },
    ],
  },
  {
    match: "3.3 Precision, Recall và F1 score",
    questions: [
      {
        type: "mcq",
        prompt:
          "Mô hình A có Precision = 0.9 và Recall = 0.3. Mô hình B có Precision = 0.6 và Recall = 0.6. Trung bình cộng của Precision và Recall của cả hai mô hình đều bằng 0.6. So sánh F1 của chúng ra sao?",
        explanation:
          "F1(A) = 2 × 0.9 × 0.3 / (0.9 + 0.3) = 0.54 / 1.2 = 0.45; F1(B) = 2 × 0.6 × 0.6 / 1.2 = 0.60. F1 của B cao hơn vì F1 bị kéo xuống mạnh khi một chỉ số thấp (Recall của A chỉ 0.3), còn trung bình cộng thì bằng nhau và che mất điều đó.",
        options: [
          T("F1 hai mô hình bằng nhau vì trung bình cộng bằng nhau", false, "ch3_f1_arithmetic_mean"),
          T("F1 của A cao hơn vì Precision 0.9 rất cao"),
          T("F1 của B cao hơn (0.60 so với 0.45): một chỉ số thấp kéo F1 của A xuống", true),
          T("F1 của A cao hơn vì F1 lấy chỉ số lớn hơn trong hai chỉ số"),
        ],
      },
    ],
  },
  {
    match: "3.4 Sai số tuyệt đối trung bình (MAE)",
    questions: [
      {
        type: "mcq",
        prompt:
          "Mô hình dự đoán giá nhà có MAE = 0.4 khi giá tính bằng tỷ đồng. Nếu cùng bộ dự đoán được đổi sang đơn vị triệu đồng (nhân giá với 1000), MAE mới là bao nhiêu?",
        explanation:
          "MAE cùng đơn vị với giá trị cần dự đoán nên nhân theo: 0.4 tỷ = 400 triệu, MAE mới là 400. MAE không phải tỉ lệ không đơn vị nên đổi đơn vị thì đổi theo (và không so sánh được giữa các bài toán khác thang đo). Con số 160.000 là kết quả của phép bình phương (kiểu MSE), không phải MAE.",
        options: [
          T("0.4, vì MAE không phụ thuộc đơn vị", false, "more_mae_scale_free"),
          T("400", true),
          T("0.0004"),
          T("160.000"),
        ],
      },
    ],
  },
  {
    match: "3.5 Hệ số xác định R²",
    questions: [
      {
        type: "mcq",
        prompt:
          "Ba căn nhà có giá thật 1, 3, 5 (tỷ đồng); mô hình dự đoán 3, 5, 7. Baseline luôn đoán giá trị trung bình (3). Dùng R² = 1 − (tổng bình phương sai số của mô hình) / (tổng bình phương sai số của baseline). R² bằng bao nhiêu và điều đó nói lên gì?",
        explanation:
          "Sai số mô hình: (1−3)² + (3−5)² + (5−7)² = 12. Sai số baseline: (1−3)² + (3−3)² + (5−3)² = 8. R² = 1 − 12/8 = −0.5. R² âm nghĩa là mô hình tệ hơn cả baseline luôn đoán trung bình; R² không bị giới hạn dưới bởi 0 (0 chỉ là mức “bằng baseline”). Con số 1.5 là tỉ số 12/8 chưa lấy “1 −”, còn 0.33 là 1 − 8/12 (đảo tử và mẫu).",
        options: [
          T("R² = 0.33: mô hình tốt hơn baseline một chút"),
          T("R² = 1.5: mô hình tốt hơn baseline 1.5 lần"),
          T("R² = 0, vì R² không bao giờ âm nên mức thấp nhất là 0", false, "more_r2_never_negative"),
          T("R² = −0.5: mô hình tệ hơn cả baseline luôn đoán trung bình", true),
        ],
      },
    ],
  },

  // ═══════════════════════════ Thực hành (3.T1 … 3.T6) ═══════════════════════════
  {
    match: "3.T1 Nạp dữ liệu và tách x, y",
    questions: [
      {
        type: "mcq",
        prompt:
          "`data` là DataFrame có cột nhãn `Outcome`. Bạn viết `x = data.drop(\"Outcome\")` (quên `axis=1`). Điều gì xảy ra?",
        explanation:
          "Mặc định `drop` tìm nhãn theo dòng (axis=0, tức index), không phải theo tên cột. Không có dòng nào có nhãn “Outcome” nên pandas báo KeyError. Muốn bỏ cột phải viết `data.drop(\"Outcome\", axis=1)` (hoặc `data.drop(columns=\"Outcome\")`). Câu lệnh không tự đoán ý bạn và cũng không sửa `data` tại chỗ.",
        options: [
          T("Chạy bình thường và x là bảng đã bỏ cột Outcome"),
          T("Chạy bình thường nhưng xoá luôn cột Outcome khỏi data"),
          T("Báo KeyError, vì pandas tìm “Outcome” trong nhãn các dòng chứ không phải tên cột", true),
          T("Xoá dòng đầu tiên của data"),
        ],
      },
    ],
  },
  {
    match: "3.T2 Chia train/test với train_test_split",
    questions: [
      {
        type: "mcq",
        prompt:
          "Bạn viết `x_train, y_train, x_test, y_test = train_test_split(x, y, test_size=0.2)` — đã đổi chỗ `y_train` và `x_test` so với thứ tự hàm trả về. Điều gì xảy ra?",
        explanation:
          "Hàm luôn trả về theo thứ tự x_train, x_test, y_train, y_test, còn Python chỉ gán theo vị trí chứ không nhìn tên biến. Vậy `y_train` thực chất là x_test (ma trận đặc trưng của tập test) và `x_test` thực chất là nhãn của tập train. Thử với 50 dòng, 2 cột: `y_train` có shape (10, 2) còn `x_test` có shape (40,). Không có lỗi ngay, nhưng bước huấn luyện hay đánh giá sau đó sẽ báo lỗi hoặc cho kết quả vô nghĩa.",
        options: [
          T("Không báo lỗi ngay, nhưng y_train thực chất là x_test còn x_test thực chất là y_train", true),
          T("Python nhận ra tên biến và tự xếp lại đúng chỗ"),
          T("Báo lỗi ngay vì tên biến không hợp lệ"),
          T("Kết quả vẫn đúng vì train và test cùng được chia từ một dữ liệu"),
        ],
      },
    ],
  },
  {
    match: "3.T3 random_state và tính lặp lại",
    questions: [
      {
        type: "mcq",
        prompt:
          "Cùng một mô hình RandomForestClassifier, Nam chia dữ liệu với `random_state=1` và đạt accuracy 0.79 trên tập test; Lan chia với `random_state=2` và đạt 0.83. Kết luận nào chặt chẽ nhất?",
        explanation:
          "Hai người dùng cùng một mô hình nhưng khác cách chia, nên chênh lệch có thể chỉ do tập test khác nhau. `random_state` không phải siêu tham số làm mô hình tốt hơn; nó chỉ cố định phép chia để lặp lại được. Muốn kết luận cần đánh giá lại trên nhiều cách chia (hoặc dùng kiểm định chéo) rồi so trung bình. Trong thực nghiệm ta thấy cùng mô hình mà đổi random_state thì accuracy thường đổi theo.",
        options: [
          T("random_state=2 làm mô hình tốt hơn, nên dùng làm chuẩn", false, "pr_seed_quality"),
          T("Mô hình của Nam bị lỗi vì random_state=1 quá nhỏ"),
          T("Chưa kết luận được: chênh lệch có thể chỉ do hai cách chia khác nhau, cần thử nhiều cách chia", true),
          T("Lan đúng hơn vì 0.83 lớn hơn 0.79, nên kết quả của Nam bị bỏ đi", false, "pr_seed_quality"),
        ],
      },
    ],
  },
  {
    match: "3.T4 Chuẩn hoá bằng StandardScaler",
    questions: [
      {
        type: "true_false",
        prompt:
          "Sau khi chạy `x_train = scaler.fit_transform(x_train)` và `x_test = scaler.transform(x_test)`, mỗi cột của x_test có trung bình đúng bằng 0.",
        explanation:
          "Sai. Trung bình 0 và độ lệch chuẩn 1 chỉ đúng với x_train, vì scaler học mean và std từ tập train. Tập test được biến đổi bằng cùng tham số đó nên trung bình của nó lệch khỏi 0. Ví dụ scaler học trên train [10, 20, 30] (mean 20, std ≈ 8.16) thì test có giá trị 40 thành khoảng 2.45. Nếu cố ép trung bình test về 0 bằng fit trên test thì thông tin của test rò rỉ vào bước chuẩn hoá.",
        options: [T("Đúng", false, "fit_test"), T("Sai", true)],
      },
    ],
  },
  {
    match: "3.T5 Huấn luyện RandomForest và dự đoán",
    questions: [
      {
        type: "mcq",
        prompt:
          "Bạn tạo `model = RandomForestClassifier(random_state=100)` rồi gọi ngay `y_pred = model.predict(x_test)` mà chưa gọi `fit`. Điều gì xảy ra?",
        explanation:
          "scikit-learn báo NotFittedError vì mô hình chưa học gì từ dữ liệu: `predict` chỉ dùng được sau `fit`. Nó không trả nhãn ngẫu nhiên và càng không tự fit trên x_test; nếu có làm vậy thì mô hình đã nhìn thấy tập kiểm thử. Thứ tự đúng: tạo đối tượng, `fit` trên train, rồi `predict`.",
        options: [
          T("Tự động fit trên x_test rồi dự đoán", false, "pr_train_on_test"),
          T("Trả về toàn nhãn 0 mà không báo lỗi"),
          T("Trả về các nhãn ngẫu nhiên, không báo lỗi"),
          T("Báo NotFittedError vì mô hình chưa được huấn luyện", true),
        ],
      },
    ],
  },
  {
    match: "3.T6 Đọc kết quả đánh giá",
    questions: [
      {
        type: "true_false",
        prompt:
          "Trong classification report của bài (ma trận nhầm lẫn `[[88, 12], [24, 30]]`), con số 54 ở cột support của lớp 1 là số mẫu mà mô hình dự đoán là lớp 1.",
        explanation:
          "Sai. Support là số mẫu THẬT SỰ thuộc lớp đó: 24 + 30 = 54 (hàng thứ hai của ma trận). Số mẫu mô hình DỰ ĐOÁN là lớp 1 là 12 + 30 = 42 (cột thứ hai), chính là mẫu số của precision = 30/42. Nhầm hai con số này dẫn tới nhầm mẫu số của precision với recall (recall dùng 54).",
        options: [T("Đúng", false, "ch3_precision_recall_swap"), T("Sai", true)],
      },
    ],
  },

  // ═══════════════════════════ 4 bài thực hành (mỗi bài 2 câu) ═══════════════════════════
  {
    match: "1.11 Thực hành: Xử lý giá trị thiếu và Pipeline",
    questions: [
      {
        type: "mcq",
        prompt:
          "```python\n" +
          [
            "import numpy as np, pandas as pd",
            "from sklearn.compose import ColumnTransformer",
            "from sklearn.impute import SimpleImputer",
            "from sklearn.pipeline import Pipeline",
            "from sklearn.preprocessing import OneHotEncoder, StandardScaler",
            "",
            "train = pd.DataFrame({",
            '    "tuoi": [20, 22, np.nan, 26, 24],',
            '    "thu_nhap": [10, np.nan, 14, 12, 11],',
            '    "thanh_pho": ["HN", "HN", "HCM", "DN", np.nan],',
            "})",
            "prep = ColumnTransformer([",
            '    ("num", Pipeline([("imp", SimpleImputer(strategy="median")),',
            '                      ("sc", StandardScaler())]), ["tuoi", "thu_nhap"]),',
            '    ("cat", Pipeline([("imp", SimpleImputer(strategy="most_frequent")),',
            '                      ("oh", OneHotEncoder())]), ["thanh_pho"]),',
            "])",
            "print(prep.fit_transform(train).shape)",
          ].join("\n") +
          "\n```\n\nĐoạn code in ra gì?",
        explanation:
          "Nhánh num giữ hai cột số (tuoi, thu_nhap) sau khi điền median và chuẩn hoá: 2 cột. Nhánh cat điền ô trống bằng giá trị phổ biến nhất (HN) rồi one-hot ba hạng mục DN, HCM, HN: 3 cột. Tổng 2 + 3 = 5 cột với 5 dòng nên shape là (5, 5). (5, 3) là nếu đếm mỗi cột gốc một cột; không có cột riêng cho giá trị thiếu vì đã được điền trước khi one-hot.",
        options: [T("(5, 3)"), T("(5, 5)", true), T("(5, 6)"), T("(4, 5)")],
      },
      {
        type: "true_false",
        prompt:
          "Trong một bảng, các ô thiếu được ghi bằng chuỗi `\"?\"`. Chạy `SimpleImputer(strategy=\"most_frequent\")` với cấu hình mặc định sẽ nhận ra `\"?\"` là giá trị thiếu và điền lại.",
        explanation:
          "Sai. Mặc định SimpleImputer chỉ coi NaN là giá trị thiếu (missing_values=np.nan). Với dữ liệu [\"a\", \"a\", \"?\"], kết quả vẫn là [\"a\", \"a\", \"?\"] — dấu hỏi được coi là một hạng mục bình thường. Cần đổi các ký hiệu như \"?\" hoặc \"N/A\" về NaN trước (hoặc truyền missing_values=\"?\").",
        options: [T("Đúng", false, "more_imputer_question_mark"), T("Sai", true)],
      },
    ],
  },
  {
    match: "1.12 Thực hành: Bias-variance qua thực nghiệm",
    questions: [
      {
        type: "mcq",
        prompt:
          "Bạn khớp một đường thẳng (đa thức bậc 1) lên dữ liệu có quy luật hình sóng sin và thấy sai số train và test đều cao, xấp xỉ nhau. Bạn thu thập thêm 100 lần số mẫu huấn luyện nhưng vẫn dùng bậc 1. Sai số test sẽ thay đổi thế nào và nên làm gì?",
        explanation:
          "Đây là bias cao (underfitting): đường thẳng không thể uốn theo sóng sin dù có bao nhiêu dữ liệu. Thực nghiệm mô phỏng cho thấy với 1000 mẫu, bậc 1 vẫn còn sai số test khoảng 0.29 (0.09 là nhiễu, phần còn lại là bias), trong khi bậc 3 đã xuống gần 0.10. Thêm dữ liệu chủ yếu giảm variance nên chỉ giúp overfitting; với underfitting cần tăng độ phức tạp của mô hình.",
        options: [
          T("Giảm mạnh xuống gần mức nhiễu, vì thêm dữ liệu luôn chữa được mọi kiểu sai", false, "more_data_fixes_all"),
          T("Gần như không giảm vì bias cao; nên tăng độ phức tạp (ví dụ bậc 3)", true),
          T("Tăng vọt vì đường thẳng bắt đầu học thuộc nhiễu", false, "lab_bias_variance_swap"),
          T("Không đổi, và vấn đề nằm ở tập test nên cần đổi tập test khác"),
        ],
      },
      {
        type: "true_false",
        prompt:
          "Dữ liệu có nhiễu ngẫu nhiên σ = 0.3, tức σ² = 0.09. Nếu mô hình đủ mạnh và có thật nhiều dữ liệu huấn luyện thì sai số test (MSE) có thể xuống gần 0.01.",
        explanation:
          "Sai. Phần nhiễu ngẫu nhiên không thể dự đoán nên sai số test không xuống dưới khoảng σ² = 0.09 (irreducible error). Thử nghiệm: dùng ngay hàm thật sin(2πx) làm mô hình cũng chỉ đạt MSE khoảng 0.09 trên dữ liệu mới, và đa thức bậc 9 với 20.000 mẫu cũng dừng ở mức đó. Mô hình tốt chỉ có thể tiến gần mức nhiễu, không thể vượt qua.",
        options: [T("Đúng", false, "more_noise_removable"), T("Sai", true)],
      },
    ],
  },
  {
    match: "3.6 MSE và RMSE",
    questions: [
      {
        type: "mcq",
        prompt:
          "```python\n" +
          [
            "import numpy as np",
            "from sklearn.metrics import mean_squared_error",
            "",
            "y_true = np.array([2, 4, 6, 8])",
            "y_base = np.full(4, y_true.mean())   # luôn đoán giá trị trung bình",
            "mse = mean_squared_error(y_true, y_base)",
            "print(mse, np.sqrt(mse).round(2))",
          ].join("\n") +
          "\n```\n\nĐoạn code in ra gì?",
        explanation:
          "Trung bình của y_true là 5 nên sai số là −3, −1, 1, 3; bình phương lên là 9, 1, 1, 9, tổng 20, và MSE = 20 / 4 = 5.0 (đúng bằng np.var(y_true): MSE của baseline luôn đoán trung bình chính là phương sai). RMSE = √5 ≈ 2.24. Kết quả “5.0 5.0” nhầm RMSE bằng MSE; “2.0 1.41” là kết quả nếu dùng MAE (= 2.0) thay cho MSE.",
        options: [
          T("5.0 5.0", false, "lab_mse_unit"),
          T("2.0 1.41"),
          T("2.24 5.0"),
          T("5.0 2.24", true),
        ],
      },
      {
        type: "mcq",
        prompt:
          "Với `y_true = [2, 4, 6, 8]` và `y_pred = [3, 3, 8, 8]`, `r2_score(y_true, y_pred)` bằng bao nhiêu?",
        explanation:
          "Sai số của mô hình là 1, −1, 2, 0 nên MSE = (1 + 1 + 4 + 0) / 4 = 1.5. Baseline luôn đoán trung bình có MSE = np.var(y_true) = 5.0. R² = 1 − 1.5 / 5.0 = 0.70. Con số 0.30 là tỉ số 1.5/5.0 chưa lấy “1 −”; 0.45 là 1 − RMSE/độ lệch chuẩn (so nhầm căn bậc hai); 1.5 chỉ là MSE.",
        options: [T("0.30"), T("0.45"), T("1.50"), T("0.70", true)],
      },
    ],
  },
  {
    match: "3.7 Thực hành: Kiểm định chéo và GridSearchCV",
    questions: [
      {
        type: "true_false",
        prompt:
          "Với `KFold(n_splits=5)` trên 100 mẫu, mỗi mẫu nằm trong tập validation đúng một lần và nằm trong tập train đúng bốn lần.",
        explanation:
          "Đúng. K-fold chia dữ liệu thành K phần rời nhau; lượt nào một phần làm validation thì K − 1 phần còn lại làm train. Vậy mỗi mẫu làm validation đúng 1 lần và làm train K − 1 = 4 lần (mỗi lần train có 80 mẫu, validation 20 mẫu). Đã đếm bằng cách chạy KFold trên 100 chỉ số.",
        options: YES_NO(true),
      },
      {
        type: "mcq",
        prompt:
          "Bạn muốn chuẩn hoá đặc trưng rồi đánh giá bằng kiểm định chéo. Vì sao nên viết `cross_val_score(make_pipeline(StandardScaler(), model), X, y, cv=5)` thay vì chuẩn hoá cả `X` trước rồi mới truyền vào `cross_val_score`?",
        explanation:
          "Trong Pipeline, ở mỗi fold scaler được fit lại chỉ trên phần train của fold đó (đã kiểm tra: 5 lần fit, mỗi lần 80 mẫu trên 100) rồi mới transform phần validation. Nếu chuẩn hoá cả X trước, mean và std đã tính cả trên phần validation nên thông tin của nó rò rỉ vào từng fold, điểm CV trở nên lạc quan. Pipeline không làm chạy nhanh hơn, và cũng không dùng thống kê của toàn bộ dữ liệu.",
        options: [
          T("Để chuẩn hoá chỉ phải tính một lần nên cross_val_score chạy nhanh hơn"),
          T("Để scaler dùng mean và std của toàn bộ dữ liệu cho nhất quán giữa các fold", false, "lab_fit_on_test"),
          T("Không có khác biệt về nguyên tắc: chuẩn hoá trước hay trong Pipeline đều như nhau"),
          T("Mỗi fold scaler được fit lại chỉ trên phần train của fold, nên validation không rò rỉ", true),
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
