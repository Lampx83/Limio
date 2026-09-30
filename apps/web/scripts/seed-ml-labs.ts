/**
 * Four hands-on lessons for "Fundamental of Machine Learning".
 *
 * The recorded lectures do not teach MSE/RMSE (though the syllabus lists RMSE),
 * and four topics had no video at all: missing values, bias-variance,
 * cross-validation and hyperparameter tuning. Each lesson here is a reading with
 * code plus a 5-question quiz and its own skill. There is no video, so these are
 * plain lessons — and they are marked as labs in the title.
 *
 *   1.11 Thực hành: Xử lý giá trị thiếu và Pipeline     after 1.10
 *   1.12 Thực hành: Bias-variance qua thực nghiệm       after 1.11
 *   3.6  MSE và RMSE                                    after 3.5
 *   3.7  Thực hành: Kiểm định chéo và GridSearchCV      after 3.6
 *
 * Readings live in scripts/content/ml-labs/*.md. Every code block and every
 * expected value was run with scikit-learn / numpy before being written down.
 *
 *   tsx scripts/seed-ml-labs.ts [--dry-run]
 *
 * Idempotent: a lesson that already exists (by title) is skipped.
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
} from "@feedbackme/core-lms";

const COURSE_SLUG = "fundamental-of-machine-learning";
const CONTENT_DIR = join(__dirname, "content", "ml-labs");

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface Opt {
  label: string;
  correct?: boolean;
  mis?: string;
}

interface Q {
  type: "mcq" | "true_false" | "numerical" | "fill_in" | "ordering";
  prompt: string;
  explanation?: string;
  options?: Opt[];
  extra?: Record<string, unknown>;
  skill?: string;
}

interface SkillDef {
  code: string;
  name: string;
  description: string;
}

const T = (label: string, correct?: boolean, mis?: string): Opt => ({
  label,
  ...(correct ? { correct } : {}),
  ...(mis ? { mis } : {}),
});
const YES_NO = (yes: boolean): Opt[] => [T("Đúng", yes), T("Sai", !yes)];

// ── 4 bài thực hành mới cho khoá Fundamental of Machine Learning ──
// Đoạn không import/export. Dùng các kiểu/hàm có sẵn: Opt, Q, SkillDef, T, YES_NO.

/** Bọc code Python thành khối ```python … ``` (script sẽ đổi sang HTML). */
const LAB_PY = (code: string): string => "```python\n" + code + "\n```";

const LAB_SKILLS: Record<string, SkillDef> = {
  imputer: {
    code: "ml.micro.imputer_pipeline",
    name: "Điền giá trị thiếu và Pipeline",
    description:
      "Dùng SimpleImputer, Pipeline và ColumnTransformer; chỉ fit trên tập train và transform trên tập test để tránh rò rỉ dữ liệu.",
  },
  biasvar: {
    code: "ml.micro.biasvar_experiment",
    name: "Bias-variance qua thực nghiệm",
    description:
      "Khớp đa thức bậc thấp và bậc cao, so sánh sai số train với test để nhận ra underfitting (bias cao) và overfitting (variance cao).",
  },
  rmse: {
    code: "ml.micro.mse_rmse",
    name: "MSE và RMSE",
    description:
      "Tính MSE, RMSE bằng tay và bằng scikit-learn; hiểu đơn vị của RMSE và độ nhạy với ngoại lai so với MAE.",
  },
  cvgrid: {
    code: "ml.micro.cv_gridsearch",
    name: "Kiểm định chéo và GridSearchCV",
    description:
      "Đọc cách KFold chia fold, diễn giải cross_val_score (trung bình ± độ lệch chuẩn), đếm số lần huấn luyện của GridSearchCV và không dùng tập test để chọn siêu tham số.",
  },
};

const LAB_MISCONCEPTIONS: Record<string, { code: string; name: string; description: string }> = {
  lab_mean_median: {
    code: "ml_mean_median_confusion",
    name: "Nhầm median với mean",
    description:
      "Học viên tưởng SimpleImputer(strategy='median') cho ra giá trị trung bình cộng, hoặc không thấy rằng ngoại lai kéo mean lệch còn median thì không.",
  },
  lab_fit_on_test: {
    code: "ml_fit_transform_on_test",
    name: "Gọi fit hoặc fit_transform trên tập test",
    description:
      "Học viên cho rằng imputer/scaler nên 'thích nghi' với chính tập test bằng fit_transform, trong khi đúng ra chỉ fit trên train rồi transform test; nếu không, thống kê của test rò vào quy trình.",
  },
  lab_bias_variance_swap: {
    code: "ml_bias_variance_swap",
    name: "Nhầm underfitting với overfitting",
    description:
      "Học viên đảo chẩn đoán: sai số train rất thấp mà test cao là overfitting (variance cao); train và test đều cao mới là underfitting (bias cao).",
  },
  lab_train_error_good: {
    code: "ml_low_train_error_means_good",
    name: "Sai số train thấp nghĩa là mô hình tốt",
    description:
      "Học viên chỉ nhìn sai số train; mô hình học thuộc cả nhiễu vẫn có train gần 0. Phải so train với test, khoảng cách giữa hai con số mới là dấu hiệu.",
  },
  lab_complexity_better: {
    code: "ml_complexity_always_better",
    name: "Mô hình phức tạp hơn luôn tốt hơn",
    description:
      "Học viên tưởng tăng độ phức tạp (bậc đa thức, độ sâu cây) luôn cải thiện kết quả, quên rằng nó làm variance tăng và có thể làm sai số test xấu đi.",
  },
  lab_mse_unit: {
    code: "ml_mse_rmse_unit_confusion",
    name: "Nhầm đơn vị của MSE và RMSE",
    description:
      "Học viên không nhớ rằng MSE mang đơn vị bình phương của biến mục tiêu, còn RMSE (căn bậc hai) cùng đơn vị với biến mục tiêu nên diễn giải được trực tiếp.",
  },
  lab_mae_outlier: {
    code: "ml_mae_more_outlier_sensitive",
    name: "Tưởng MAE nhạy với ngoại lai hơn RMSE",
    description:
      "Học viên đảo chiều: RMSE bình phương sai số nên phạt lỗi lớn nặng hơn MAE, vì vậy RMSE mới là độ đo nhạy hơn với ngoại lai.",
  },
  lab_rmse_below_mae: {
    code: "ml_rmse_below_mae",
    name: "Tưởng RMSE nhỏ hơn hoặc bằng MAE",
    description:
      "Học viên tưởng RMSE có thể nhỏ hơn MAE. Thực tế RMSE luôn lớn hơn hoặc bằng MAE trên cùng dữ liệu, bằng nhau chỉ khi mọi sai số tuyệt đối đều như nhau.",
  },
  lab_kfold_shuffles: {
    code: "ml_kfold_shuffles_by_default",
    name: "Tưởng KFold mặc định xáo trộn dữ liệu",
    description:
      "Học viên cho rằng KFold tự chọn mẫu ngẫu nhiên; thực tế shuffle=False nên các fold là những đoạn liên tiếp, gây lỗi nghiêm trọng khi dữ liệu xếp theo nhãn.",
  },
  lab_ignore_std: {
    code: "ml_ignore_cv_std",
    name: "Chỉ nhìn trung bình mà bỏ qua độ lệch chuẩn",
    description:
      "Học viên đọc kết quả cross_val_score chỉ qua mean; độ lệch chuẩn lớn cho thấy điểm dao động mạnh giữa các fold, nên mean chưa đáng tin.",
  },
  lab_tune_on_test: {
    code: "ml_tune_on_test_set",
    name: "Chọn siêu tham số bằng tập test",
    description:
      "Học viên dùng điểm trên tập test để chọn mô hình hoặc siêu tham số rồi báo cáo chính điểm đó, khiến ước lượng trở nên quá lạc quan; test chỉ được dùng một lần ở bước cuối.",
  },
};

const LABS: Array<{
  key: string;
  title: string;
  description: string;
  file: string;
  skill: string;
  quiz: { title: string; description: string; questions: Q[] };
}> = [
  // ───────────────────────── 1.11 Imputer + Pipeline ─────────────────────────
  {
    key: "imputer",
    title: "1.11 Thực hành: Xử lý giá trị thiếu và Pipeline",
    description:
      "Điền giá trị thiếu bằng SimpleImputer, ghép với scaler trong Pipeline và ColumnTransformer, và tránh rò rỉ dữ liệu bằng nguyên tắc chỉ fit trên train.",
    file: "lab_imputer.md",
    skill: "imputer",
    quiz: {
      title: "Kiểm tra — Xử lý giá trị thiếu và Pipeline",
      description: "5 câu về SimpleImputer, rò rỉ dữ liệu và thứ tự fit/transform.",
      questions: [
        {
          type: "mcq",
          prompt:
            LAB_PY(`import numpy as np
from sklearn.impute import SimpleImputer

x_train = np.array([[1.0], [2.0], [np.nan], [9.0]])
imp = SimpleImputer(strategy="median").fit(x_train)
print(imp.statistics_)`) + "\n\nĐoạn code in ra gì?",
          explanation:
            "Median của các giá trị có mặt (1, 2, 9) là 2, nên statistics_ là [2.]. Mean mới cho [4.] vì (1 + 2 + 9) / 3 = 4; giá trị 9 kéo mean lên, còn median thì không bị kéo.",
          options: [
            T("[2.]", true),
            T("[4.]", false, "lab_mean_median"),
            T("[9.]"),
            T("[nan]"),
          ],
        },
        {
          type: "numerical",
          prompt:
            LAB_PY(`import numpy as np
from sklearn.impute import SimpleImputer

x_train = np.array([[1.0], [2.0], [np.nan], [9.0]])
x_test = np.array([[np.nan], [20.0]])

imp = SimpleImputer(strategy="mean").fit(np.vstack([x_train, x_test]))
print(imp.statistics_)`) +
            "\n\nMột bạn gộp train và test lại rồi mới `fit`. Giá trị in ra là bao nhiêu? (Nếu chỉ fit trên train thì con số sẽ là 4.)",
          explanation:
            "Các giá trị có mặt là 1, 2, 9 và 20: (1 + 2 + 9 + 20) / 4 = 8. Con số này đã bị giá trị 20 của tập test kéo lên so với 4 của riêng train. Đó chính là rò rỉ dữ liệu: imputer đã 'nhìn trộm' test.",
          extra: { expected: 8, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt:
            "Để điền ô trống của tập test, cách đúng là gọi `imputer.fit_transform(X_test)` để imputer thích nghi với chính dữ liệu test.",
          explanation:
            "Sai. Imputer phải được `fit` chỉ trên tập train; tập test và dữ liệu mới chỉ `transform` bằng giá trị đã học từ train. Nếu fit_transform trên test, ô trống bị điền theo thống kê của test, thứ bạn không có sẵn lúc triển khai (ở ví dụ trong bài, kết quả thành [20. 20.] thay vì [4. 20.]).",
          options: [T("Đúng", false, "lab_fit_on_test"), T("Sai", true)],
        },
        {
          type: "fill_in",
          prompt:
            "Viết tên lớp trong `sklearn.impute` dùng để điền giá trị thiếu bằng mean, median hoặc most_frequent (chỉ tên lớp).",
          explanation:
            "`SimpleImputer` — tham số `strategy` chọn cách điền: 'mean', 'median', 'most_frequent' hoặc 'constant'.",
          options: [
            { label: "SimpleImputer", correct: true },
            { label: "simpleimputer", correct: true },
            { label: "SimpleImputer()", correct: true },
            { label: "sklearn.impute.SimpleImputer", correct: true },
          ],
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các bước theo đúng thứ tự để xử lý giá trị thiếu mà không rò rỉ dữ liệu.",
          explanation:
            "Chia train/test trước hết; imputer (và scaler) học thống kê chỉ từ train; dùng chính các thống kê đó để biến đổi cả train lẫn test; cuối cùng mới huấn luyện mô hình. Điền hay chuẩn hoá trước khi chia là rò rỉ.",
          options: [
            T("Chia dữ liệu thành tập train và tập test"),
            T("fit imputer (và scaler) chỉ trên tập train"),
            T("transform tập train và tập test bằng chính imputer đó"),
            T("Huấn luyện mô hình trên tập train đã xử lý"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 1.12 Bias-variance thực nghiệm ─────────────────────────
  {
    key: "biasvar",
    title: "1.12 Thực hành: Bias-variance qua thực nghiệm",
    description:
      "Khớp đa thức bậc 1, 3, 9 trên dữ liệu tự sinh, so sánh sai số train với test để thấy underfitting và overfitting bằng con số.",
    file: "lab_biasvar.md",
    skill: "biasvar",
    quiz: {
      title: "Kiểm tra — Bias-variance qua thực nghiệm",
      description: "5 câu về chẩn đoán underfitting/overfitting từ sai số train và test.",
      questions: [
        {
          type: "mcq",
          prompt:
            "Một đa thức có sai số train (MSE) = 0.02 và sai số test = 0.90. Chẩn đoán phù hợp nhất là gì?",
          explanation:
            "Train rất thấp mà test cao hơn hẳn: mô hình đã học thuộc cả nhiễu của tập train, tức overfitting (variance cao). Underfitting mới là trường hợp cả train lẫn test đều cao.",
          options: [
            T("Overfitting (variance cao)", true),
            T("Underfitting (bias cao)", false, "lab_bias_variance_swap"),
            T("Mô hình đã vừa phải vì sai số train rất thấp", false, "lab_train_error_good"),
            T("Không chẩn đoán được nếu chưa biết bậc của đa thức"),
          ],
        },
        {
          type: "numerical",
          prompt:
            LAB_PY(`import numpy as np

x = np.linspace(0, 1, 10)
y = np.sin(2 * np.pi * x)
coef = np.polyfit(x, y, 9)
print(len(coef))`) + "\n\nĐoạn code in ra số nào?",
          explanation:
            "Đa thức bậc 9 có 10 hệ số (x⁹, x⁸, …, x, và hệ số tự do). Có đúng 10 hệ số cho 10 điểm nên đường cong đi qua mọi điểm, kể cả nhiễu — vì thế sai số train gần bằng 0 mà test vẫn có thể rất cao.",
          extra: { expected: 10, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt:
            "Đa thức bậc 9 có sai số train xấp xỉ 0 (thấp nhất trong các bậc đã thử), nên chắc chắn nó là mô hình tốt nhất khi gặp dữ liệu mới.",
          explanation:
            "Sai. Sai số train luôn giảm (hoặc giữ nguyên) khi tăng độ phức tạp, nên nó không nói lên chất lượng trên dữ liệu mới. Phải so với sai số test: trong thí nghiệm của bài, bậc 3 có test thấp hơn nhiều so với bậc 9.",
          options: [T("Đúng", false, "lab_train_error_good"), T("Sai", true)],
        },
        {
          type: "fill_in",
          prompt:
            "Hiện tượng mô hình quá đơn giản nên sai cả trên tập train lẫn tập test (bias cao) được gọi là gì? (thuật ngữ tiếng Anh)",
          explanation:
            "Underfitting. Ví dụ dùng một đường thẳng để khớp quan hệ hình sóng sin: đường thẳng không thể uốn theo quy luật nên cả hai sai số đều cao.",
          options: [
            { label: "underfitting", correct: true },
            { label: "Underfitting", correct: true },
            { label: "under-fitting", correct: true },
            { label: "under fitting", correct: true },
            { label: "high bias", correct: true },
            { label: "bias cao", correct: true },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Mô hình đa thức bậc 9 đang overfit với chỉ 10 mẫu huấn luyện. Cách nào phù hợp nhất để giảm variance?",
          explanation:
            "Thêm dữ liệu huấn luyện (hoặc giảm bậc đa thức) làm mô hình khó thuộc lòng nhiễu hơn. Trong bài, với cùng bậc 9, sai số test giảm dần khi số mẫu tăng 10 → 30 → 100. Tăng bậc thêm chỉ làm variance xấu hơn, còn báo cáo sai số train thì che mất vấn đề.",
          options: [
            T("Thu thập thêm mẫu huấn luyện, hoặc giảm bậc đa thức", true),
            T("Tăng bậc lên 15 để đường cong khớp train tốt hơn nữa", false, "lab_complexity_better"),
            T("Chỉ báo cáo sai số train vì đó là con số đẹp nhất", false, "lab_train_error_good"),
            T("Bỏ tập test đi để không còn thấy sai số test cao"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 3.6 MSE và RMSE ─────────────────────────
  {
    key: "rmse",
    title: "3.6 MSE và RMSE",
    description:
      "Định nghĩa, tính tay và gọi bằng scikit-learn; đơn vị của RMSE và độ nhạy với ngoại lai so với MAE.",
    file: "mse_rmse.md",
    skill: "rmse",
    quiz: {
      title: "Kiểm tra — MSE và RMSE",
      description: "5 câu về cách tính, đơn vị và độ nhạy với ngoại lai của MSE/RMSE.",
      questions: [
        {
          type: "numerical",
          prompt:
            LAB_PY(`import numpy as np
from sklearn.metrics import mean_squared_error

y_true = np.array([10, 20, 30, 40])
y_pred = np.array([12, 18, 30, 44])
print(mean_squared_error(y_true, y_pred))`) + "\n\nĐoạn code in ra giá trị nào?",
          explanation:
            "Sai số là 2, −2, 0, 4; bình phương lên là 4, 4, 0, 16, tổng 24. MSE = 24 / 4 = 6.0 (và RMSE = √6 ≈ 2.449).",
          extra: { expected: 6, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt:
            "Biến mục tiêu là giá nhà tính bằng tỷ đồng. Mô hình có RMSE = 0.7. Cách diễn giải nào đúng?",
          explanation:
            "RMSE là căn bậc hai của MSE nên trở về cùng đơn vị với biến mục tiêu: sai số điển hình khoảng 0.7 tỷ đồng. Chính MSE mới mang đơn vị bình phương (tỷ đồng²). '70% đúng' và '70% phương sai' là các thứ khác (accuracy, R²).",
          options: [
            T("Sai số điển hình của dự đoán khoảng 0.7 tỷ đồng", true),
            T("Sai số khoảng 0.7 tỷ đồng bình phương", false, "lab_mse_unit"),
            T("Mô hình đoán đúng 70% số căn nhà"),
            T("Mô hình giải thích được 70% phương sai của giá nhà"),
          ],
        },
        {
          type: "mcq",
          prompt:
            LAB_PY(`import numpy as np
from sklearn.metrics import mean_absolute_error, root_mean_squared_error

y_true = np.array([2.0, 3.0, 4.0, 5.0, 6.0])
a = np.array([2.5, 2.5, 4.0, 4.0, 7.0])
b = np.array([2.5, 2.5, 4.0, 4.0, 11.0])   # chỉ khác a ở phần tử cuối (lệch thêm 4)`) +
            "\n\nKhi chuyển từ dự đoán `a` sang `b`, điều nào đúng? (MAE của a, b lần lượt là 0.6 và 1.4; RMSE là 0.707 và 2.302.)",
          explanation:
            "MAE tăng 0.6 → 1.4 (khoảng 2.3 lần), còn RMSE tăng 0.707 → 2.302 (khoảng 3.3 lần), vì lỗi lớn bị bình phương. RMSE nhạy với ngoại lai hơn MAE.",
          options: [
            T("RMSE tăng mạnh hơn MAE (tính theo tỷ lệ)", true),
            T("MAE tăng mạnh hơn RMSE", false, "lab_mae_outlier"),
            T("MAE và RMSE tăng như nhau"),
            T("Cả hai không đổi vì chỉ có một phần tử thay đổi"),
          ],
        },
        {
          type: "fill_in",
          prompt:
            "Viết tên hàm trong `sklearn.metrics` (từ scikit-learn 1.4) tính RMSE trực tiếp, không cần bọc `np.sqrt`.",
          explanation:
            "`root_mean_squared_error(y_true, y_pred)`. Trước bản 1.4 người ta viết `np.sqrt(mean_squared_error(...))`.",
          options: [
            { label: "root_mean_squared_error", correct: true },
            { label: "root_mean_squared_error()", correct: true },
            { label: "sklearn.metrics.root_mean_squared_error", correct: true },
          ],
        },
        {
          type: "true_false",
          prompt: "Trên cùng một bộ dự đoán, RMSE luôn nhỏ hơn hoặc bằng MAE.",
          explanation:
            "Sai. RMSE luôn LỚN HƠN hoặc bằng MAE (trong bài: 0.707 so với 0.6; 2.302 so với 1.4). Chúng chỉ bằng nhau khi mọi sai số tuyệt đối đều như nhau. RMSE lớn hơn MAE càng nhiều thì càng có vài sai số rất lớn.",
          options: [T("Đúng", false, "lab_rmse_below_mae"), T("Sai", true)],
        },
      ],
    },
  },
  // ───────────────────────── 3.7 Cross-validation + GridSearchCV ─────────────────────────
  {
    key: "cvgrid",
    title: "3.7 Thực hành: Kiểm định chéo và GridSearchCV",
    description:
      "KFold chia fold thế nào, đọc cross_val_score, GridSearchCV với số lần huấn luyện = số tổ hợp × số fold, và không dùng tập test để chọn siêu tham số.",
    file: "lab_cvgrid.md",
    skill: "cvgrid",
    quiz: {
      title: "Kiểm tra — Kiểm định chéo và GridSearchCV",
      description: "5 câu về KFold, cross_val_score, GridSearchCV và quy trình không dùng tập test để tinh chỉnh.",
      questions: [
        {
          type: "mcq",
          prompt:
            LAB_PY(`import numpy as np
from sklearn.model_selection import KFold

X10 = np.arange(10).reshape(-1, 1)
tr, va = next(KFold(n_splits=3).split(X10))
print(va.tolist())`) + "\n\nĐoạn code in ra gì?",
          explanation:
            "KFold không xáo trộn nên cắt theo thứ tự. 10 mẫu chia 3 fold có cỡ 4, 3, 3, và fold đầu tiên là [0, 1, 2, 3]. Muốn chọn mẫu ngẫu nhiên phải đặt shuffle=True.",
          options: [
            T("[0, 1, 2, 3]", true),
            T("Ba chỉ số ngẫu nhiên, mỗi lần chạy một khác", false, "lab_kfold_shuffles"),
            T("[0, 1, 2]"),
            T("[0, 3, 6, 9]"),
          ],
        },
        {
          type: "numerical",
          prompt:
            LAB_PY(`from sklearn.model_selection import GridSearchCV
from sklearn.tree import DecisionTreeClassifier

grid = {"max_depth": [2, 4, 6], "min_samples_leaf": [1, 5, 10, 20]}
search = GridSearchCV(DecisionTreeClassifier(), grid, cv=5)
search.fit(X_train, y_train)      # X_train, y_train đã có sẵn`) +
            "\n\nKhi chạy `search.fit`, có tổng cộng bao nhiêu lần huấn luyện (chưa tính lần refit cuối cùng)?",
          explanation:
            "3 × 4 = 12 tổ hợp, mỗi tổ hợp chạy 5 fold: 12 × 5 = 60 lần huấn luyện. Nếu refit=True thì cộng thêm 1 lần huấn luyện lại tổ hợp tốt nhất trên toàn bộ train.",
          extra: { expected: 60, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt:
            "`cross_val_score` cho trung bình 0.80 và độ lệch chuẩn 0.15 (5 fold). Cách diễn giải nào hợp lý nhất?",
          explanation:
            "Độ lệch chuẩn 0.15 rất lớn so với trung bình: điểm nhảy mạnh giữa các fold, tức kết quả phụ thuộc nhiều vào cách chia dữ liệu nên con số 0.80 chưa đáng tin. Trung bình 0.80 với độ lệch nhỏ mới là mô hình ổn định.",
          options: [
            T("Kết quả dao động mạnh giữa các fold, con số 0.80 chưa đáng tin", true),
            T("Mô hình tốt vì trung bình 0.80 cao, độ lệch chuẩn không quan trọng", false, "lab_ignore_std"),
            T("Độ lệch chuẩn lớn chứng tỏ mô hình có độ chính xác cao"),
            T("Mô hình chắc chắn overfitting"),
          ],
        },
        {
          type: "true_false",
          prompt:
            "Sau khi GridSearchCV chạy xong, nên chấm từng tổ hợp siêu tham số trên tập test rồi chọn tổ hợp có điểm test cao nhất làm mô hình cuối.",
          explanation:
            "Sai. Chọn siêu tham số bằng tập test khiến điểm test không còn trung thực (bạn đã chọn mô hình khớp nhất với chính tập đó). Quy trình đúng: chia train/test, GridSearchCV chỉ trên train, chốt mô hình rồi chấm test đúng một lần.",
          options: [T("Đúng", false, "lab_tune_on_test"), T("Sai", true)],
        },
        {
          type: "fill_in",
          prompt:
            "Tham số nào của `GridSearchCV` (mặc định là True) khiến nó huấn luyện lại tổ hợp tốt nhất trên toàn bộ tập train để tạo `best_estimator_`? (tên tham số)",
          explanation:
            "`refit`. Với refit=True, sau khi chọn được best_params_ nó huấn luyện lại một lần trên toàn bộ dữ liệu đã đưa vào fit, và search.predict/search.score dùng mô hình này. Đặt refit=False thì không có best_estimator_.",
          options: [
            { label: "refit", correct: true },
            { label: "refit=True", correct: true },
            { label: "refit = True", correct: true },
          ],
        },
      ],
    },
  },
];
// ─────────────────────────────────────────────────────────────────────────
// Placement: which existing lesson each lab follows (matched by title prefix).
// ─────────────────────────────────────────────────────────────────────────

const AFTER: Record<string, { moduleIndex: number; anchorPrefix: string }> = {
  "1.11": { moduleIndex: 0, anchorPrefix: "1.10 " },
  "1.12": { moduleIndex: 0, anchorPrefix: "1.11 " },
  "3.6": { moduleIndex: 2, anchorPrefix: "3.5 " },
  "3.7": { moduleIndex: 2, anchorPrefix: "3.6 " },
};

function numberOf(title: string): string {
  const m = /^(\d+\.\d+)\s/.exec(title);
  if (!m) throw new Error(`lab title must start with a number: ${title}`);
  return m[1]!;
}

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

const skillIds = new Map<string, string>(); // LAB_SKILLS key -> id
const misIds = new Map<string, string>();

async function ensureSkills() {
  for (const [key, s] of Object.entries(LAB_SKILLS)) {
    const found = await prisma.skill.findUnique({ where: { code: s.code } });
    skillIds.set(key, found?.id ?? (await createSkill(s, prisma)).skillId);
  }
}

async function ensureMisconceptions() {
  for (const [key, m] of Object.entries(LAB_MISCONCEPTIONS)) {
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

async function openSlot(moduleId: string, insertAt: number) {
  const occupied = await prisma.lesson.findFirst({ where: { moduleId, orderIndex: insertAt }, select: { id: true } });
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

const read = (f: string) => readFileSync(join(CONTENT_DIR, f), "utf8").trimEnd();

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  // Fail early on anything malformed, before touching the database.
  for (const lab of LABS) {
    numberOf(lab.title);
    if (!AFTER[numberOf(lab.title)]) throw new Error(`no placement for ${lab.title}`);
    if (!LAB_SKILLS[lab.skill]) throw new Error(`${lab.title}: unknown skill key ${lab.skill}`);
    const body = read(lab.file);
    if (body.length < 1500) throw new Error(`${lab.file}: reading looks too short (${body.length} chars)`);
    for (const q of lab.quiz.questions) {
      if (q.type === "numerical") {
        if (typeof q.extra?.expected !== "number") throw new Error(`${lab.title}: numerical without expected`);
      } else if (q.type === "mcq" || q.type === "true_false") {
        const right = (q.options ?? []).filter((o) => o.correct).length;
        if (right !== 1) throw new Error(`${lab.title}: "${q.prompt.slice(0, 40)}…" has ${right} correct options`);
      } else if (q.type === "fill_in") {
        if (!(q.options ?? []).some((o) => o.correct)) throw new Error(`${lab.title}: fill_in without accepted answer`);
      }
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
  const modules = await prisma.module.findMany({ where: { courseId: course.id }, orderBy: { orderIndex: "asc" } });

  if (dryRun) {
    console.log("DRY RUN\n");
    for (const lab of LABS) {
      const a = AFTER[numberOf(lab.title)]!;
      console.log(`"${lab.title}"  reading ${read(lab.file).length} chars  quiz ${lab.quiz.questions.length} câu  → ${modules[a.moduleIndex]?.title}, sau "${a.anchorPrefix.trim()}"`);
    }
    return;
  }

  await ensureSkills();
  await ensureMisconceptions();

  for (const lab of LABS) {
    const a = AFTER[numberOf(lab.title)]!;
    const mod = modules[a.moduleIndex];
    if (!mod) throw new Error(`module ${a.moduleIndex} missing`);

    const existing = await prisma.lesson.findFirst({ where: { moduleId: mod.id, title: lab.title } });
    if (existing) {
      console.log(`skip (already built): ${lab.title}`);
      continue;
    }
    const anchor = await prisma.lesson.findFirst({
      where: { moduleId: mod.id, title: { startsWith: a.anchorPrefix } },
      select: { orderIndex: true, title: true },
    });
    if (!anchor) throw new Error(`anchor lesson "${a.anchorPrefix}…" not found in ${mod.title}`);
    const orderIndex = anchor.orderIndex + 1;
    await openSlot(mod.id, orderIndex);

    const { lessonId } = await createLesson(
      actor,
      mod.id,
      { title: lab.title, orderIndex, description: lab.description },
      prisma,
    );
    await createContentItem(actor, lessonId, { type: "markdown", payload: { body: read(lab.file) }, orderIndex: 0 }, prisma);

    const skillId = skillIds.get(lab.skill)!;
    const { quizId } = await createQuiz(
      actor,
      { courseId: course.id, lessonId },
      {
        title: lab.quiz.title,
        description: lab.quiz.description,
        passThresholdPct: 70,
        maxAttempts: 5,
        requireConfidence: true,
      },
      prisma,
    );
    for (const [i, q] of lab.quiz.questions.entries()) {
      await createQuestion(
        actor,
        quizId,
        {
          type: q.type,
          prompt: rich(q.prompt),
          ...(q.explanation ? { explanation: q.explanation } : {}),
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
          skillIds: [skillId],
        },
        prisma,
      );
    }
    await tagLessonSkill(actor, lessonId, { skillId }, prisma);
    console.log(`[${orderIndex}] "${lab.title}" — reading ${read(lab.file).length} chars, ${lab.quiz.questions.length} câu quiz`);
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
