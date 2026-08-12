/**
 * Build the interactive lecture series for "Fundamental of Machine Learning"
 * from the recorded videos.
 *
 * Per lecture: a reading (markdown) → the video with in-video cuepoint quizzes
 * that pause playback until answered correctly → an end-of-lesson quiz → a
 * practice assignment.
 *
 *   Introduction.mp4      -> replaces the video on the existing "Course Overview"
 *   Chapter 1.mp4         -> new lecture at the top of Module 1   (5 cuepoints)
 *   Chapter 2.mp4         -> new lecture at the top of Module 2   (5 cuepoints)
 *   Chapter 3.mp4         -> new lecture at the top of Module 3   (4 cuepoints)
 *   Practical session.mp4 -> new lesson at the end of Module 3    (4 cuepoints)
 *
 * Cuepoint timestamps were chosen from a frame-by-frame map of each video so a
 * question always lands just after its concept finishes, never mid-explanation.
 *
 *   tsx scripts/seed-ml-lectures.ts <video-dir> [--dry-run]
 *
 * Idempotent: a lecture that already carries a video is skipped whole. Blobs are
 * written through the storage adapter, so point UPLOADS_ROOT at a staging dir
 * when targeting prod and copy the tree onto the server volume afterwards.
 *
 * Note on cuepoints: the gating player only mounts for signed-in learners, and
 * only grades `mcq` / `true_false`. Every cuepoint question below is therefore
 * mcq or true_false — any other type would let the learner straight through.
 */
import { randomBytes } from "node:crypto";
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

const COURSE_SLUG = "fundamental-of-machine-learning";
const MAX_VIDEO_BYTES = 500 * 1024 * 1024;

// ─────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────

interface Opt {
  label: string;
  correct?: boolean;
  /** Misconception code — only meaningful on a wrong option. */
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
  skill: string;
}

interface Cue {
  atSec: number;
  /** Only mcq / true_false gate playback — see file header. */
  q: Q & { type: "mcq" | "true_false" };
}

interface Lecture {
  file: string;
  moduleIndex: number;
  /**
   * "top" = first lesson in the module, "end" = last, `{ after }` = straight
   * after the named lesson. Chapter 1 uses `after` so the short course intro
   * keeps its place ahead of the 49-minute lecture.
   */
  position: "top" | "end" | { after: string };
  title: string;
  description: string;
  body: string;
  durationSec: number;
  skill: { code: string; name: string; description: string };
  cuepoints: Cue[];
  quiz: { title: string; description: string; questions: Q[] };
  assignment: {
    title: string;
    description: string;
    pedagogicalIntent:
      | "summarizing"
      | "mapping"
      | "drawing"
      | "imagining"
      | "self_explaining"
      | "teaching"
      | "enacting";
    responseFormat: "text" | "file" | "image" | "audio" | "video" | "concept_map" | "mixed";
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Skills — one per lecture, plus finer-grained ones the questions tag.
// ─────────────────────────────────────────────────────────────────────────

const SKILLS: Record<string, { code: string; name: string; description: string }> = {
  foundations: {
    code: "ml.lecture.foundations",
    name: "Nền tảng học máy: vòng lặp huấn luyện và hàm mất mát",
    description:
      "Cách một mô hình học từ dữ liệu qua dự đoán, hàm mất mát và cập nhật tham số.",
  },
  taxonomy: {
    code: "ml.concept.taxonomy",
    name: "Phân nhóm thuật toán học máy",
    description:
      "Supervised, unsupervised, reinforcement learning; phân biệt regression và classification.",
  },
  features: {
    code: "ml.concept.feature_types",
    name: "Các loại đặc trưng",
    description:
      "Đặc trưng số và đặc trưng hạng mục; nominal, ordinal, boolean.",
  },
  preprocessing: {
    code: "ml.concept.preprocessing",
    name: "Tiền xử lý dữ liệu",
    description:
      "Missing values, sai định dạng, normalization (Min-Max), standardization (z-score), one-hot encoding.",
  },
  algorithms: {
    code: "ml.lecture.algorithms",
    name: "Thuật toán học máy cốt lõi",
    description:
      "Hồi quy tuyến tính, hồi quy logistic, cây quyết định, bootstrapping và SVM.",
  },
  trees: {
    code: "ml.concept.decision_trees",
    name: "Cây quyết định và Gini impurity",
    description:
      "Cấu trúc cây quyết định và tiêu chí chọn thuộc tính chia nhánh bằng Gini impurity.",
  },
  svm: {
    code: "ml.concept.svm",
    name: "Support Vector Machine",
    description: "Siêu phẳng lề cực đại, support vectors, và kernel trick.",
  },
  evaluation: {
    code: "ml.lecture.evaluation",
    name: "Đánh giá mô hình",
    description:
      "Ma trận nhầm lẫn, precision, recall, F1, và các sai số hồi quy.",
  },
  imbalance: {
    code: "ml.concept.imbalanced_data",
    name: "Dữ liệu mất cân bằng",
    description:
      "Vì sao accuracy đánh lừa trên tập dữ liệu mất cân bằng giữa các lớp.",
  },
  practical: {
    code: "ml.lecture.practical",
    name: "Thực hành quy trình học máy với Scikit-learn",
    description:
      "Chuẩn bị dữ liệu, chia tập, chuẩn hoá, huấn luyện, dự đoán và đánh giá bằng Scikit-learn.",
  },
  leakage: {
    code: "ml.concept.data_leakage",
    name: "Rò rỉ dữ liệu khi chuẩn hoá",
    description:
      "Vì sao tham số chuẩn hoá chỉ được học từ tập train và áp lên tập test.",
  },
};

// Misconceptions — attached to specific wrong answers so a real quiz attempt
// records the diagnosis (cuepoint grading does not feed this loop).
const MISCONCEPTIONS: Record<string, { code: string; name: string; description: string }> = {
  accuracy_always_good: {
    code: "ml_accuracy_always_good",
    name: "Coi accuracy cao là mô hình tốt",
    description:
      "Học viên cho rằng accuracy cao luôn nghĩa là mô hình tốt, bỏ qua trường hợp dữ liệu mất cân bằng khi mô hình chỉ đoán lớp đa số.",
  },
  norm_vs_std: {
    code: "ml_normalization_vs_standardization",
    name: "Nhầm normalization với standardization",
    description:
      "Học viên nhầm công thức Min-Max (đưa về [0,1]) với z-score (trung bình 0, độ lệch chuẩn 1).",
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

// ─────────────────────────────────────────────────────────────────────────
// Lecture content
// ─────────────────────────────────────────────────────────────────────────

const LECTURES: Lecture[] = [
  // ══════════════════════════ CHAPTER 1 ══════════════════════════
  {
    file: "Chapter 1.mp4",
    moduleIndex: 0,
    position: { after: "Course Overview" },
    title: "Bài giảng 1: Nền tảng học máy và chuẩn bị dữ liệu",
    description:
      "Máy học như thế nào, các loại dữ liệu và đặc trưng, và toàn bộ khâu tiền xử lý trước khi huấn luyện.",
    durationSec: 2916,
    skill: SKILLS.foundations,
    body:
      "## Bài giảng 1 — Nền tảng học máy và chuẩn bị dữ liệu\n\n" +
      "Bài giảng đầy đủ cho Module 1 (khoảng 49 phút). Video sẽ **tự dừng ở 5 điểm** để bạn trả lời một câu hỏi ngắn — trả lời đúng mới xem tiếp được.\n\n" +
      "### Nội dung theo thứ tự\n\n" +
      "| Phút | Nội dung |\n" +
      "|---|---|\n" +
      "| 00:00 | AI, Machine Learning, Deep Learning và Data Science liên quan thế nào |\n" +
      "| 04:00 | Máy học ra sao: Data → Model → Prediction → Loss → Update |\n" +
      "| 07:30 | Các loại dữ liệu: bảng, văn bản, ảnh, âm thanh |\n" +
      "| 14:00 | Ba nhóm thuật toán: supervised, unsupervised, reinforcement |\n" +
      "| 21:00 | Các loại đặc trưng: numerical, categorical (nominal / ordinal / boolean) |\n" +
      "| 27:30 | Thuật ngữ: sample, feature vector, label |\n" +
      "| 31:00 | Vấn đề chất lượng dữ liệu: thiếu giá trị, sai định dạng |\n" +
      "| 37:30 | Chuẩn hoá đặc trưng số: Min-Max và z-score |\n" +
      "| 44:00 | One-hot encoding cho đặc trưng hạng mục |\n" +
      "| 47:30 | Tổng kết pipeline học máy 9 bước |\n\n" +
      "### Hai công thức cần nhớ\n\n" +
      "**Normalization (Min-Max)** — đưa giá trị về đoạn [0, 1]:\n\n" +
      "> x_new = (x_old − x_min) / (x_max − x_min)\n\n" +
      "**Standardization (z-score)** — đưa về trung bình 0, độ lệch chuẩn 1:\n\n" +
      "> x_new = (x_old − mean) / std\n\n" +
      "Hai phép này **không thay thế nhau**: Min-Max giữ nguyên hình dạng phân phối trong một khoảng cố định, z-score thì không giới hạn khoảng nhưng chịu ảnh hưởng ít hơn từ giá trị ngoại lai co giãn.\n\n" +
      "### Cách học hiệu quả\n\n" +
      "Xem video trước, trả lời các câu hỏi chèn giữa video, rồi làm quiz cuối bài. Các bài lý thuyết còn lại trong module đi sâu hơn vào từng bước tiền xử lý.",
    cuepoints: [
      {
        atSec: 450,
        q: {
          type: "mcq",
          prompt:
            "Trong vòng lặp huấn luyện vừa xem (Data → Model → Prediction → Loss function → Update), hàm mất mát (loss function) đóng vai trò gì?",
          explanation:
            "Loss function đo khoảng cách giữa dự đoán của mô hình và giá trị thật (ground truth). Giá trị loss đó chính là tín hiệu để cập nhật lại tham số mô hình — không có nó thì mô hình không biết mình sai ở đâu.",
          skill: "foundations",
          options: [
            { label: "Sinh thêm dữ liệu huấn luyện mới cho mô hình" },
            {
              label:
                "Đo sai lệch giữa dự đoán và giá trị thật, làm tín hiệu để cập nhật mô hình",
              correct: true,
            },
            { label: "Quyết định loại dữ liệu đầu vào được phép dùng" },
            { label: "Triển khai mô hình đã huấn luyện lên môi trường thật" },
          ],
        },
      },
      {
        atSec: 1240,
        q: {
          type: "mcq",
          prompt:
            'Bài toán "dự đoán nhiệt độ ngày mai là bao nhiêu độ" thuộc nhóm nào?',
          explanation:
            "Đầu ra là một giá trị số liên tục (84°F) nên đây là bài toán regression. Nếu câu hỏi đổi thành “ngày mai nóng hay lạnh” — đầu ra là nhãn — thì mới là classification.",
          skill: "taxonomy",
          options: [
            { label: "Regression (hồi quy)", correct: true },
            {
              label: "Classification (phân loại)",
              mis: "regression_vs_classification",
            },
            { label: "Clustering (gom cụm)" },
            { label: "Reinforcement Learning" },
          ],
        },
      },
      {
        atSec: 1640,
        q: {
          type: "mcq",
          prompt:
            "Cỡ cốc cà phê S – M – L là loại đặc trưng nào?",
          explanation:
            "S, M, L là các hạng mục CÓ thứ tự (S < M < L) nên là ordinal. Nominal là hạng mục không thứ tự (ví dụ màu sắc), boolean chỉ có hai giá trị đúng/sai.",
          skill: "features",
          options: [
            { label: "Numerical (đặc trưng số)" },
            { label: "Nominal (hạng mục không thứ tự)" },
            { label: "Ordinal (hạng mục có thứ tự)", correct: true },
            { label: "Boolean" },
          ],
        },
      },
      {
        atSec: 2240,
        q: {
          type: "mcq",
          prompt:
            "Trong bảng dữ liệu giá nhà, một dòng bị bỏ trống ô square_feet. Đây là vấn đề gì của dữ liệu?",
          explanation:
            "Ô trống là missing value. Wrong data format là khi giá trị có mặt nhưng sai kiểu/định dạng — ví dụ ngày ghi “2025-12-10” lẫn với “09/12/25”, hay tiền ghi “60$” lẫn với “$45”.",
          skill: "preprocessing",
          options: [
            { label: "Wrong data format (sai định dạng)" },
            { label: "Missing value (thiếu giá trị)", correct: true },
            { label: "One-hot encoding" },
            { label: "Feature vector" },
          ],
        },
      },
      {
        atSec: 2840,
        q: {
          type: "mcq",
          prompt:
            "Công thức x_new = (x_old − x_min) / (x_max − x_min) là phép biến đổi nào, và đưa giá trị về khoảng nào?",
          explanation:
            "Đây là Normalization theo kiểu Min-Max, đưa mọi giá trị về đoạn [0, 1]. Công thức z-score (x − mean)/std mới là Standardization, cho trung bình 0 và độ lệch chuẩn 1 chứ không giới hạn trong [0, 1].",
          skill: "preprocessing",
          options: [
            {
              label: "Standardization — cho trung bình 0, độ lệch chuẩn 1",
              mis: "norm_vs_std",
            },
            { label: "Normalization (Min-Max) — đưa giá trị về đoạn [0, 1]", correct: true },
            { label: "One-hot encoding — sinh ra các cột nhị phân 0/1" },
            { label: "Log transform — nén các giá trị lớn" },
          ],
        },
      },
    ],
    quiz: {
      title: "Kiểm tra Bài giảng 1 — Nền tảng và tiền xử lý",
      description:
        "5 câu tổng hợp toàn bộ Bài giảng 1. Làm sau khi đã xem hết video.",
      questions: [
        {
          type: "true_false",
          prompt:
            "Deep Learning là một nhánh con của Machine Learning, và Machine Learning là một nhánh con của AI.",
          explanation:
            "Đúng — theo sơ đồ Venn ở đầu bài giảng: Computer Science ⊃ AI ⊃ Machine Learning ⊃ Deep Learning.",
          skill: "foundations",
          options: [
            { label: "Đúng", correct: true },
            { label: "Sai" },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Bài toán nào sau đây KHÔNG thuộc supervised learning?",
          explanation:
            "Gom cụm khách hàng theo hành vi không có nhãn cho trước — đó là unsupervised learning. Ba bài toán còn lại đều có nhãn đúng để học theo.",
          skill: "taxonomy",
          options: [
            { label: "Dự đoán giá nhà từ diện tích và vị trí" },
            { label: "Phân loại email là spam hay không spam" },
            {
              label: "Gom cụm khách hàng theo hành vi mua sắm khi chưa có nhãn nào",
              correct: true,
            },
            { label: "Dự đoán một bệnh nhân có mắc tiểu đường hay không" },
          ],
        },
        {
          type: "fill_in",
          prompt:
            "Kỹ thuật biến cột màu sắc (black, blue, white, green) thành 4 cột nhị phân 0/1 gọi là gì? (viết tiếng Anh, không dấu gạch nối cũng được)",
          explanation:
            "One-hot encoding — mỗi hạng mục thành một cột riêng, chỉ đúng một cột mang giá trị 1 trên mỗi dòng.",
          skill: "preprocessing",
          options: [
            { label: "one-hot encoding", correct: true },
            { label: "one hot encoding", correct: true },
            { label: "onehot encoding", correct: true },
            { label: "one-hot", correct: true },
          ],
        },
        {
          type: "numerical",
          prompt:
            "Cột grade có giá trị nhỏ nhất là 0 và lớn nhất là 10. Sau khi chuẩn hoá Min-Max, giá trị 8 trở thành bao nhiêu? (nhập số thập phân)",
          explanation:
            "(8 − 0) / (10 − 0) = 0.8 — đúng như ví dụ trong bài giảng.",
          skill: "preprocessing",
          extra: { expected: 0.8, tolerance: 0.01 },
        },
        {
          type: "ordering",
          prompt:
            "Sắp xếp các bước sau theo đúng thứ tự trong pipeline học máy đã trình bày ở cuối bài giảng.",
          explanation:
            "Thu thập dữ liệu → tiền xử lý → chọn mô hình → huấn luyện → kiểm thử → triển khai. Không thể chọn mô hình khi dữ liệu còn bẩn, và không thể triển khai khi chưa kiểm thử.",
          skill: "foundations",
          options: [
            { label: "Data collection (thu thập dữ liệu)" },
            { label: "Data preprocessing (tiền xử lý)" },
            { label: "Model selection (chọn mô hình)" },
            { label: "Model training (huấn luyện)" },
            { label: "Model testing (kiểm thử)" },
            { label: "Model deployment (triển khai)" },
          ],
        },
      ],
    },
    assignment: {
      title: "Thực hành 1: Lập kế hoạch tiền xử lý cho một bộ dữ liệu thật",
      description:
        "Chọn một bộ dữ liệu dạng bảng bất kỳ (có thể lấy từ Kaggle, hoặc dữ liệu công việc/học tập của bạn) và viết một kế hoạch tiền xử lý.\n\n" +
        "Bài nộp cần nêu rõ:\n\n" +
        "1. **Mô tả dữ liệu** — bao nhiêu dòng, bao nhiêu cột, cột nào là nhãn (label) và vì sao.\n" +
        "2. **Phân loại đặc trưng** — liệt kê từng cột và ghi rõ là numerical hay categorical; nếu là categorical thì thuộc nominal, ordinal hay boolean.\n" +
        "3. **Vấn đề chất lượng** — chỉ ra ít nhất 2 vấn đề (thiếu giá trị, sai định dạng, giá trị ngoại lai...) và cách bạn định xử lý từng vấn đề.\n" +
        "4. **Chuẩn hoá** — với các cột số, bạn chọn Min-Max hay z-score? Giải thích lựa chọn dựa trên đặc điểm dữ liệu, không chỉ nói “vì nó phổ biến”.\n" +
        "5. **Mã hoá** — với các cột hạng mục, bạn mã hoá thế nào và tại sao.\n\n" +
        "Độ dài khoảng 400–800 từ. Chấm điểm dựa trên tính hợp lý của lập luận, không phải độ dài.",
      pedagogicalIntent: "mapping",
      responseFormat: "text",
    },
  },

  // ══════════════════════════ CHAPTER 2 ══════════════════════════
  {
    file: "Chapter 2.mp4",
    moduleIndex: 1,
    position: "top",
    title: "Bài giảng 2: Các thuật toán học máy cốt lõi",
    description:
      "Hồi quy tuyến tính, hồi quy logistic, cây quyết định với Gini, bootstrapping và SVM.",
    durationSec: 2184,
    skill: SKILLS.algorithms,
    body:
      "## Bài giảng 2 — Các thuật toán học máy cốt lõi\n\n" +
      "Bài giảng đầy đủ cho Module 2 (khoảng 36 phút), có **5 điểm dừng** để kiểm tra hiểu bài.\n\n" +
      "### Nội dung theo thứ tự\n\n" +
      "| Phút | Nội dung |\n" +
      "|---|---|\n" +
      "| 00:00 | Linear Regression — khớp đường thẳng, dự đoán lương theo kinh nghiệm |\n" +
      "| 04:00 | Logistic Regression — hàm sigmoid, ngưỡng 0.5, phân lớp Junior/Senior |\n" +
      "| 07:30 | Cây quyết định — root node, decision node, leaf node |\n" +
      "| 11:00 | Ví dụ duyệt vay ngân hàng — chọn thuộc tính chia nhánh bằng Gini |\n" +
      "| 21:00 | Bootstrapping — lấy mẫu có hoàn lại, nền tảng của Random Forest |\n" +
      "| 24:00 | SVM — lề cực đại và support vectors |\n" +
      "| 34:00 | Kernel trick — nâng chiều để tách tuyến tính |\n\n" +
      "### Hai ý dễ nhầm\n\n" +
      "**Logistic Regression là bài toán phân loại**, dù tên có chữ “regression”. Nó cho ra một *xác suất* trong khoảng (0, 1), rồi so với ngưỡng (thường 0.5) để quyết định nhãn.\n\n" +
      "**Gini càng thấp càng tốt.** Gini = 0 nghĩa là nhánh hoàn toàn thuần khiết — mọi mẫu cùng một nhãn, không cần chia tiếp. Thuật toán chọn thuộc tính nào cho Gini có trọng số nhỏ nhất.\n\n" +
      "### Công thức Gini\n\n" +
      "> Gini = 1 − Σ (pᵢ)²\n\n" +
      "Trong ví dụ duyệt vay, chia theo `age` cho Gini = (5/14)(0.48) + (4/14)(0) + (5/14)(0.48) = **0.343**.",
    cuepoints: [
      {
        atSec: 250,
        q: {
          type: "mcq",
          prompt:
            "Trong ví dụ Salary – Experience vừa xem, Linear Regression được dùng để làm gì?",
          explanation:
            "Linear Regression khớp một đường thẳng qua đám điểm dữ liệu để dự đoán một giá trị số liên tục — ở đây là mức lương ứng với số năm kinh nghiệm.",
          skill: "algorithms",
          options: [
            { label: "Phân loại nhân viên thành hai nhóm Junior và Senior" },
            {
              label: "Dự đoán một giá trị số liên tục (mức lương) từ số năm kinh nghiệm",
              correct: true,
            },
            { label: "Gom các nhân viên có đặc điểm giống nhau thành cụm" },
            { label: "Chọn thuộc tính tốt nhất để chia nhánh cây quyết định" },
          ],
        },
      },
      {
        atSec: 450,
        q: {
          type: "mcq",
          prompt:
            "Hàm sigmoid 1/(1 + e^−(ax+b)) trong Logistic Regression cho đầu ra nằm trong khoảng nào?",
          explanation:
            "Sigmoid nén mọi giá trị đầu vào về khoảng (0, 1), nên đầu ra đọc được như một xác suất. Sau đó mới so với ngưỡng 0.5 để quyết định nhãn — chính bước so ngưỡng này mới cho ra 0 hoặc 1.",
          skill: "algorithms",
          options: [
            { label: "(−∞, +∞) — không giới hạn" },
            { label: "(0, 1) — hiểu được như một xác suất", correct: true },
            { label: "Chỉ đúng hai giá trị 0 hoặc 1" },
            { label: "[−1, 1]" },
          ],
        },
      },
      {
        atSec: 650,
        q: {
          type: "mcq",
          prompt:
            "Trong cây quyết định, nút chứa kết quả cuối cùng (Accept / Reject) được gọi là gì?",
          explanation:
            "Leaf node là nút lá — nơi cây kết thúc và đưa ra kết luận. Root node là nút gốc trên cùng, decision node là các nút hỏi điều kiện ở giữa.",
          skill: "trees",
          options: [
            { label: "Root node (nút gốc)" },
            { label: "Decision node (nút quyết định)" },
            { label: "Leaf node (nút lá)", correct: true },
            { label: "Support vector" },
          ],
        },
      },
      {
        atSec: 1440,
        q: {
          type: "mcq",
          prompt:
            'Trong ví dụ duyệt vay, nhánh "middle" có 4 mẫu Yes và 0 mẫu No, nên gini = 0. Điều đó có nghĩa là gì?',
          explanation:
            "Gini = 0 nghĩa là nhánh hoàn toàn thuần khiết: mọi mẫu trong nhánh đều cùng một nhãn. Không còn gì để phân biệt nên không cần chia tiếp — nhánh này thành luôn một nút lá.",
          skill: "trees",
          options: [
            { label: "Nhánh đó không chứa mẫu dữ liệu nào" },
            {
              label:
                "Nhánh đó hoàn toàn thuần khiết — mọi mẫu cùng một nhãn, không cần chia tiếp",
              correct: true,
            },
            { label: "Nhánh đó hỗn tạp nhất, cần ưu tiên chia tiếp" },
            { label: "Dữ liệu trong nhánh đó bị lỗi" },
          ],
        },
      },
      {
        atSec: 2050,
        q: {
          type: "mcq",
          prompt: "Support vectors trong SVM là những điểm nào?",
          explanation:
            "Support vectors là các điểm nằm sát ranh giới phân lớp — chính chúng xác định vị trí siêu phẳng và độ rộng của lề. Bỏ đi một điểm ở xa thì siêu phẳng không đổi; bỏ một support vector thì đổi.",
          skill: "svm",
          options: [
            { label: "Toàn bộ điểm dữ liệu trong tập huấn luyện" },
            {
              label:
                "Các điểm nằm sát ranh giới, quyết định vị trí siêu phẳng và độ rộng lề",
              correct: true,
            },
            { label: "Các điểm nằm xa ranh giới nhất" },
            { label: "Các điểm bị mô hình phân loại sai" },
          ],
        },
      },
    ],
    quiz: {
      title: "Kiểm tra Bài giảng 2 — Thuật toán cốt lõi",
      description: "5 câu tổng hợp Bài giảng 2. Làm sau khi đã xem hết video.",
      questions: [
        {
          type: "true_false",
          prompt:
            "Mặc dù tên có chữ “regression”, Logistic Regression được dùng cho bài toán phân loại.",
          explanation:
            "Đúng. Logistic Regression cho ra xác suất rồi so ngưỡng để gán nhãn — đó là phân loại. Tên gọi đến từ việc nó hồi quy trên hàm logit.",
          skill: "algorithms",
          options: [
            { label: "Đúng", correct: true },
            { label: "Sai", mis: "regression_vs_classification" },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Bootstrapping tạo ra các tập con bằng cách nào?",
          explanation:
            "Lấy mẫu ngẫu nhiên CÓ hoàn lại — nên một phần tử có thể xuất hiện nhiều lần trong cùng một tập con, đúng như ví dụ {b, a, b, b} trong bài giảng.",
          skill: "algorithms",
          options: [
            { label: "Chia đều tập gốc thành các phần không giao nhau" },
            {
              label: "Lấy mẫu ngẫu nhiên có hoàn lại, nên một phần tử có thể lặp lại",
              correct: true,
            },
            { label: "Lấy mẫu ngẫu nhiên không hoàn lại" },
            { label: "Sắp xếp tập gốc rồi cắt theo thứ tự" },
          ],
        },
        {
          type: "numerical",
          prompt:
            "Một nhánh có 5 mẫu, trong đó 3 mẫu nhãn Yes và 2 mẫu nhãn No. Tính Gini của nhánh này theo công thức Gini = 1 − Σ(pᵢ)². (làm tròn 2 chữ số thập phân)",
          explanation:
            "p(Yes) = 3/5 = 0.6, p(No) = 2/5 = 0.4. Gini = 1 − (0.6² + 0.4²) = 1 − (0.36 + 0.16) = 0.48 — đúng bằng giá trị của nhánh young/senior trong ví dụ duyệt vay.",
          skill: "trees",
          extra: { expected: 0.48, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt:
            "Khi dữ liệu hai chiều không thể tách được bằng một đường thẳng, SVM xử lý thế nào?",
          explanation:
            "Kernel trick: ánh xạ dữ liệu lên không gian nhiều chiều hơn, nơi dữ liệu trở nên tách được bằng một siêu phẳng.",
          skill: "svm",
          options: [
            { label: "Bỏ bớt các điểm gây khó tách" },
            {
              label:
                "Ánh xạ dữ liệu lên không gian nhiều chiều hơn để tách bằng siêu phẳng (kernel trick)",
              correct: true,
            },
            { label: "Chuyển sang dùng cây quyết định" },
            { label: "Giảm số chiều của dữ liệu xuống một chiều" },
          ],
        },
        {
          type: "matching",
          prompt: "Ghép mỗi thuật toán với đặc trưng nhận dạng của nó.",
          explanation:
            "Mỗi thuật toán trong bài giảng có một hình ảnh đặc trưng riêng: đường thẳng khớp, đường cong sigmoid, cây rẽ nhánh, và lề cực đại.",
          skill: "algorithms",
          options: [
            { label: "Linear Regression", extra: { side: "left", pairKey: "lin" } },
            { label: "Khớp một đường thẳng để dự đoán giá trị liên tục", extra: { side: "right", pairKey: "lin" } },
            { label: "Logistic Regression", extra: { side: "left", pairKey: "log" } },
            { label: "Dùng hàm sigmoid cho ra xác suất rồi so ngưỡng", extra: { side: "right", pairKey: "log" } },
            { label: "Decision Tree", extra: { side: "left", pairKey: "tree" } },
            { label: "Rẽ nhánh theo điều kiện, chọn thuộc tính bằng Gini", extra: { side: "right", pairKey: "tree" } },
            { label: "SVM", extra: { side: "left", pairKey: "svm" } },
            { label: "Tìm siêu phẳng có lề lớn nhất giữa hai lớp", extra: { side: "right", pairKey: "svm" } },
          ],
        },
      ],
    },
    assignment: {
      title: "Thực hành 2: Chọn thuật toán cho bài toán của bạn",
      description:
        "Chọn **một** bài toán thực tế mà bạn quan tâm (trong công việc, ngành học, hoặc đời sống), rồi lập luận chọn thuật toán.\n\n" +
        "Bài nộp cần có:\n\n" +
        "1. **Mô tả bài toán** — đầu vào là gì, đầu ra cần dự đoán là gì.\n" +
        "2. **Xác định loại bài toán** — regression hay classification? Giải thích dựa trên bản chất đầu ra.\n" +
        "3. **Chọn 2 thuật toán ứng viên** trong số đã học (Linear/Logistic Regression, Decision Tree, Random Forest, SVM) và nêu ưu — nhược của từng cái *đối với bài toán cụ thể của bạn*.\n" +
        "4. **Quyết định cuối cùng** và lý do.\n" +
        "5. **Rủi ro** — nêu một tình huống có thể khiến lựa chọn của bạn hoạt động kém.\n\n" +
        "Yêu cầu quan trọng: lập luận phải gắn với đặc điểm dữ liệu và bài toán của bạn. Câu trả lời kiểu “Random Forest vì nó mạnh” sẽ bị trừ điểm.",
      pedagogicalIntent: "self_explaining",
      responseFormat: "text",
    },
  },

  // ══════════════════════════ CHAPTER 3 ══════════════════════════
  {
    file: "Chapter 3.mp4",
    moduleIndex: 2,
    position: "top",
    title: "Bài giảng 3: Đánh giá mô hình",
    description:
      "Ma trận nhầm lẫn, precision, recall, F1, dữ liệu mất cân bằng, và sai số hồi quy MAE, R².",
    durationSec: 1313,
    skill: SKILLS.evaluation,
    body:
      "## Bài giảng 3 — Đánh giá mô hình\n\n" +
      "Bài giảng đầy đủ cho Module 3 (khoảng 22 phút), có **4 điểm dừng**.\n\n" +
      "### Nội dung theo thứ tự\n\n" +
      "| Phút | Nội dung |\n" +
      "|---|---|\n" +
      "| 00:00 | Bài toán phân loại nhị phân — so sánh nhãn dự đoán với nhãn thật |\n" +
      "| 02:30 | Dữ liệu mất cân bằng — vì sao accuracy đánh lừa |\n" +
      "| 05:00 | Ma trận nhầm lẫn — TP, FP, FN, TN, lỗi loại I và loại II |\n" +
      "| 10:00 | Precision, Recall và F1 score |\n" +
      "| 13:00 | Chuyển sang hồi quy — Mean Absolute Error |\n" +
      "| 19:00 | Hệ số xác định R² |\n\n" +
      "### Ý quan trọng nhất của bài\n\n" +
      "Một tập dữ liệu gian lận thẻ có 99% giao dịch bình thường. Mô hình **luôn đoán “bình thường”** đạt accuracy 99% — nghe rất giỏi, nhưng bắt được **0 vụ gian lận**, tức là hoàn toàn vô dụng.\n\n" +
      "Đó là lý do phải nhìn precision và recall thay vì chỉ nhìn accuracy.\n\n" +
      "### Bốn ô của ma trận nhầm lẫn\n\n" +
      "| | Dự đoán + | Dự đoán − |\n" +
      "|---|---|---|\n" +
      "| **Thực tế +** | TP — True Positive | FN — False Negative (lỗi loại II) |\n" +
      "| **Thực tế −** | FP — False Positive (lỗi loại I) | TN — True Negative |\n\n" +
      "**F1 = 2 × P × R / (P + R)** — trung bình điều hoà, nên nếu một trong hai chỉ số thấp thì F1 bị kéo xuống mạnh. Đây là lý do dùng F1 thay vì trung bình cộng.",
    cuepoints: [
      {
        atSec: 300,
        q: {
          type: "mcq",
          prompt:
            "Tập dữ liệu giao dịch có 99% bình thường và 1% gian lận. Một mô hình luôn dự đoán “bình thường” sẽ đạt accuracy bao nhiêu, và vì sao đó vẫn là mô hình tồi?",
          explanation:
            "Accuracy 99% vì nó đúng với toàn bộ 99% giao dịch bình thường. Nhưng nó không bắt được một vụ gian lận nào — mà gian lận mới chính là thứ ta cần tìm. Đây là cái bẫy kinh điển của dữ liệu mất cân bằng.",
          skill: "imbalance",
          options: [
            {
              label: "99% — và đây là một mô hình tốt vì accuracy rất cao",
              mis: "accuracy_always_good",
            },
            {
              label:
                "99% — nhưng vô dụng vì không phát hiện được vụ gian lận nào (lớp thiểu số)",
              correct: true,
            },
            { label: "1% — vì chỉ đoán đúng lớp thiểu số" },
            { label: "50% — vì bài toán có hai lớp" },
          ],
        },
      },
      {
        atSec: 600,
        q: {
          type: "mcq",
          prompt:
            "Mô hình dự đoán một bức ảnh là “dog” (lớp +) nhưng thực tế đó là “cat”. Trường hợp này gọi là gì?",
          explanation:
            "Dự đoán dương (+) nhưng thực tế âm (−) là False Positive, còn gọi là lỗi loại I (Type I error). Ngược lại, dự đoán âm mà thực tế dương là False Negative — lỗi loại II.",
          skill: "evaluation",
          options: [
            { label: "True Positive" },
            { label: "True Negative" },
            { label: "False Positive (lỗi loại I)", correct: true },
            { label: "False Negative (lỗi loại II)" },
          ],
        },
      },
      {
        atSec: 800,
        q: {
          type: "mcq",
          prompt:
            "Vì sao F1 score dùng công thức 2PR/(P+R) thay vì trung bình cộng (P+R)/2?",
          explanation:
            "2PR/(P+R) là trung bình điều hoà. Nó bị kéo xuống mạnh khi một trong hai chỉ số thấp — ví dụ P = 1.0 và R = 0.0 cho F1 = 0, trong khi trung bình cộng vẫn là 0.5. Nhờ vậy F1 không cho phép “giấu” một chỉ số kém.",
          skill: "evaluation",
          options: [
            { label: "Vì công thức đó dễ tính hơn" },
            {
              label:
                "Vì đó là trung bình điều hoà — bị kéo xuống mạnh khi một trong hai chỉ số thấp",
              correct: true,
            },
            { label: "Vì nó luôn cho giá trị lớn hơn trung bình cộng" },
            { label: "Vì nó bỏ qua được lớp thiểu số" },
          ],
        },
      },
      {
        atSec: 1130,
        q: {
          type: "mcq",
          prompt:
            "Trong bài toán hồi quy dự đoán giá nhà, Mean Absolute Error (MAE) được tính thế nào?",
          explanation:
            "MAE lấy trị tuyệt đối của chênh lệch giữa giá trị thật và giá trị dự đoán ở từng điểm, rồi lấy trung bình — đúng như công thức chia 3 trong ví dụ ba căn nhà.",
          skill: "evaluation",
          options: [
            { label: "Tổng bình phương chênh lệch giữa giá trị thật và dự đoán" },
            {
              label:
                "Trung bình của trị tuyệt đối chênh lệch giữa giá trị thật và dự đoán",
              correct: true,
            },
            { label: "Chênh lệch lớn nhất giữa giá trị thật và dự đoán" },
            { label: "Tỉ lệ phần trăm số dự đoán đúng" },
          ],
        },
      },
    ],
    quiz: {
      title: "Kiểm tra Bài giảng 3 — Đánh giá mô hình",
      description: "5 câu tổng hợp Bài giảng 3. Làm sau khi đã xem hết video.",
      questions: [
        {
          type: "numerical",
          prompt:
            "Một mô hình cho TP = 30, FP = 12, FN = 24, TN = 88. Tính Precision = TP/(TP+FP). (làm tròn 2 chữ số thập phân)",
          explanation:
            "Precision = 30/(30+12) = 30/42 ≈ 0.71. Đây đúng là con số precision của lớp 1 trong buổi thực hành.",
          skill: "evaluation",
          extra: { expected: 0.71, tolerance: 0.02 },
        },
        {
          type: "numerical",
          prompt:
            "Vẫn với TP = 30, FP = 12, FN = 24, TN = 88. Tính Recall = TP/(TP+FN). (làm tròn 2 chữ số thập phân)",
          explanation:
            "Recall = 30/(30+24) = 30/54 ≈ 0.56. Recall thấp hơn precision nghĩa là mô hình bỏ sót nhiều ca dương thật.",
          skill: "evaluation",
          extra: { expected: 0.56, tolerance: 0.02 },
        },
        {
          type: "mcq",
          prompt:
            "Một mô hình chẩn đoán ung thư có precision cao nhưng recall thấp. Điều đó nghĩa là gì trên thực tế?",
          explanation:
            "Recall thấp = bỏ sót nhiều ca bệnh thật (FN cao). Trong y tế đây là loại lỗi nguy hiểm nhất, nên các bài toán sàng lọc bệnh thường ưu tiên recall hơn precision.",
          skill: "evaluation",
          options: [
            { label: "Mô hình báo động nhầm rất nhiều ca khoẻ mạnh" },
            {
              label:
                "Khi mô hình báo có bệnh thì thường đúng, nhưng nó bỏ sót nhiều ca bệnh thật",
              correct: true,
            },
            { label: "Mô hình hoạt động tốt đều ở cả hai mặt" },
            { label: "Mô hình không dự đoán được lớp âm" },
          ],
        },
        {
          type: "true_false",
          prompt:
            "Trên một tập dữ liệu mất cân bằng nghiêm trọng, accuracy vẫn là chỉ số đáng tin cậy nhất để đánh giá mô hình.",
          explanation:
            "Sai. Chính trên dữ liệu mất cân bằng thì accuracy đánh lừa mạnh nhất — mô hình chỉ cần luôn đoán lớp đa số là đã có accuracy rất cao.",
          skill: "imbalance",
          options: [
            { label: "Đúng", mis: "accuracy_always_good" },
            { label: "Sai", correct: true },
          ],
        },
        {
          type: "short_answer",
          prompt:
            "Chỉ số nào so sánh mô hình của bạn với baseline “luôn dự đoán bằng giá trị trung bình”, và bằng 1 khi mô hình dự đoán hoàn hảo? (viết ký hiệu, ví dụ dạng R2)",
          explanation:
            "R² (coefficient of determination — hệ số xác định). R² = 1 nghĩa là mô hình giải thích được toàn bộ phương sai; R² = 0 nghĩa là mô hình không tốt hơn việc luôn đoán giá trị trung bình.",
          skill: "evaluation",
          extra: { acceptedRegexes: ["^r\\s*[²2^]?\\s*2?$", "^r\\s*squared$", "^r\\s*bình\\s*phương$"] },
          options: [
            { label: "R2", correct: true },
            { label: "R²", correct: true },
            { label: "R^2", correct: true },
          ],
        },
      ],
    },
    assignment: {
      title: "Thực hành 3: Chọn chỉ số đánh giá cho ba tình huống",
      description:
        "Với **mỗi** tình huống dưới đây, hãy chọn chỉ số đánh giá phù hợp nhất và giải thích cái giá phải trả khi chọn sai.\n\n" +
        "1. **Sàng lọc ung thư** — mô hình gợi ý bệnh nhân nào cần làm thêm xét nghiệm chuyên sâu.\n" +
        "2. **Lọc thư rác** — mô hình quyết định email nào bị đẩy vào hộp spam.\n" +
        "3. **Dự đoán giá nhà** — mô hình đưa ra mức giá đề xuất cho người bán.\n\n" +
        "Với từng tình huống, trả lời:\n\n" +
        "- Chỉ số nào quan trọng nhất (accuracy, precision, recall, F1, MAE, R²...) và **vì sao**.\n" +
        "- Lỗi nào tốn kém hơn: false positive hay false negative? Mô tả hậu quả cụ thể cho người dùng thật.\n" +
        "- Nếu chỉ nhìn accuracy thì bạn có thể bị đánh lừa như thế nào?\n\n" +
        "Sau khi làm xong, hãy tự chấm mức độ tự tin của mình và viết phần suy ngẫm — phần này bắt buộc.",
      pedagogicalIntent: "self_explaining",
      responseFormat: "text",
    },
  },

  // ══════════════════════════ PRACTICAL ══════════════════════════
  {
    file: "Practical session.mp4",
    moduleIndex: 2,
    position: "end",
    title: "Thực hành: Xây dựng mô hình end-to-end với Scikit-learn",
    description:
      "Buổi thực hành trên Jupyter: từ file CSV thô đến mô hình đã đánh giá bằng classification report.",
    durationSec: 1670,
    skill: SKILLS.practical,
    body:
      "## Thực hành — Xây dựng mô hình end-to-end với Scikit-learn\n\n" +
      "Buổi thực hành đi hết một quy trình học máy hoàn chỉnh trên bộ dữ liệu `diabetes.csv` (768 dòng, 8 đặc trưng, nhãn `Outcome` 0/1). Khoảng 28 phút, có **4 điểm dừng**.\n\n" +
      "### Các bước trong video\n\n" +
      "| Phút | Bước |\n" +
      "|---|---|\n" +
      "| 00:00 | Xem dữ liệu thô trong Excel, xác định cột nhãn |\n" +
      "| 02:30 | Load bằng pandas, tách đặc trưng `x` và nhãn `y` |\n" +
      "| 06:00 | Chia train/test với `train_test_split` |\n" +
      "| 10:00 | Kiểm tra kết quả chia — 614 / 154 dòng |\n" +
      "| 17:00 | Chuẩn hoá bằng `StandardScaler` |\n" +
      "| 19:00 | Huấn luyện `RandomForestClassifier`, dự đoán |\n" +
      "| 22:30 | Đánh giá bằng `classification_report` |\n" +
      "| 26:00 | Đọc `confusion_matrix` |\n\n" +
      "### Code xương sống\n\n" +
      "```python\n" +
      "target = \"Outcome\"\n" +
      "x = data.drop(target, axis=1)\n" +
      "y = data[target]\n\n" +
      "from sklearn.model_selection import train_test_split\n" +
      "x_train, x_test, y_train, y_test = train_test_split(\n" +
      "    x, y, test_size=0.2, random_state=1009)\n\n" +
      "from sklearn.preprocessing import StandardScaler\n" +
      "scaler = StandardScaler()\n" +
      "x_train = scaler.fit_transform(x_train)   # fit CHỈ trên train\n" +
      "x_test = scaler.transform(x_test)         # test chỉ transform\n\n" +
      "from sklearn.ensemble import RandomForestClassifier\n" +
      "model = RandomForestClassifier(random_state=100)\n" +
      "model.fit(x_train, y_train)\n" +
      "y_pred = model.predict(x_test)\n\n" +
      "from sklearn.metrics import classification_report, confusion_matrix\n" +
      "print(classification_report(y_test, y_pred))\n" +
      "print(confusion_matrix(y_test, y_pred))\n" +
      "```\n\n" +
      "### Điểm dễ sai nhất\n\n" +
      "`fit_transform` chỉ dùng cho **tập train**. Tập test chỉ được `transform`. Nếu fit cả trên test, thông tin của tập test rò rỉ vào quá trình chuẩn hoá và kết quả đánh giá sẽ đẹp hơn thực tế — một lỗi rất khó phát hiện vì mô hình vẫn “chạy bình thường”.\n\n" +
      "### Kết quả thu được\n\n" +
      "Accuracy 0.77. Lớp 1 (có bệnh): precision 0.71, recall 0.56. Ma trận nhầm lẫn `[[88, 12], [24, 30]]`.\n\n" +
      "Hãy tự hỏi: với bài toán sàng lọc bệnh, recall 0.56 có chấp nhận được không?",
    cuepoints: [
      {
        atSec: 350,
        q: {
          type: "mcq",
          prompt:
            'Với `target = "Outcome"`, dòng lệnh nào tạo ra ma trận đặc trưng `x` (toàn bộ cột trừ cột nhãn)?',
          explanation:
            "`data.drop(target, axis=1)` bỏ đi một CỘT (axis=1) mang tên Outcome, giữ lại 8 cột đặc trưng. `axis=0` sẽ bỏ theo dòng, còn `data[target]` thì lấy đúng cột nhãn — đó là `y`, không phải `x`.",
          skill: "practical",
          options: [
            { label: 'x = data["Outcome"]' },
            { label: "x = data.drop(target, axis=1)", correct: true },
            { label: "x = data.drop(target, axis=0)" },
            { label: "x = data[target]" },
          ],
        },
      },
      {
        atSec: 620,
        q: {
          type: "mcq",
          prompt:
            "Dữ liệu có 768 dòng và ta chạy `train_test_split(x, y, test_size=0.2, random_state=1009)`. Tập test có bao nhiêu dòng, và `random_state` dùng để làm gì?",
          explanation:
            "768 × 0.2 ≈ 154 dòng. `random_state` cố định bộ sinh số ngẫu nhiên để lần nào chia cũng ra đúng kết quả đó — nhờ vậy thí nghiệm lặp lại được. Nó không ảnh hưởng gì tới chất lượng mô hình.",
          skill: "practical",
          options: [
            { label: "154 dòng — random_state quyết định độ chính xác của mô hình" },
            {
              label:
                "154 dòng — random_state cố định cách chia ngẫu nhiên để kết quả lặp lại được",
              correct: true,
            },
            { label: "614 dòng — random_state là số cây trong rừng" },
            { label: "768 dòng — random_state là seed của mô hình" },
          ],
        },
      },
      {
        atSec: 1160,
        q: {
          type: "mcq",
          prompt:
            "Vì sao dùng `scaler.fit_transform(x_train)` nhưng chỉ `scaler.transform(x_test)`?",
          explanation:
            "Tham số chuẩn hoá (mean, std) phải được học CHỈ từ tập train. Nếu fit cả trên test, thông tin của tập test rò rỉ vào mô hình và kết quả đánh giá không còn trung thực — mô hình trông giỏi hơn thực tế.",
          skill: "leakage",
          options: [
            { label: "Vì tập test không cần chuẩn hoá" },
            { label: "Vì fit_transform chỉ chạy được một lần trong mỗi phiên làm việc" },
            {
              label:
                "Vì tham số chuẩn hoá chỉ được học từ tập train, tránh rò rỉ thông tin từ tập test",
              correct: true,
            },
            {
              label: "Vì tập test nhỏ hơn nên không đủ dữ liệu để fit",
              mis: "fit_test",
            },
          ],
        },
      },
      {
        atSec: 1560,
        q: {
          type: "mcq",
          prompt:
            "Trong classification report, lớp 1 có precision 0.71 và recall 0.56 (support 54). Điều này nói lên gì về mô hình?",
          explanation:
            "Precision 0.71: khi mô hình nói “có bệnh” thì 71% là đúng. Recall 0.56: nhưng nó chỉ tìm ra được 56% số ca bệnh thật — tức bỏ sót gần một nửa. Với bài toán y tế, đây là điểm yếu nghiêm trọng.",
          skill: "evaluation",
          options: [
            { label: "Mô hình dự đoán lớp 1 gần như hoàn hảo" },
            {
              label:
                "Phần lớn dự đoán “lớp 1” là đúng, nhưng mô hình bỏ sót gần một nửa số ca lớp 1 thật",
              correct: true,
            },
            { label: "Mô hình báo nhầm lớp 1 quá nhiều lần" },
            {
              label: "Accuracy đã là 0.77 nên hai chỉ số này không quan trọng",
              mis: "accuracy_always_good",
            },
          ],
        },
      },
    ],
    quiz: {
      title: "Kiểm tra buổi thực hành — Scikit-learn",
      description:
        "6 câu về quy trình thực hành. Làm sau khi đã tự gõ lại code theo video.",
      questions: [
        {
          type: "ordering",
          prompt:
            "Sắp xếp các bước code theo đúng thứ tự thực hiện trong buổi thực hành.",
          explanation:
            "Tách x/y → chia train/test → chuẩn hoá → huấn luyện → dự đoán → đánh giá. Đặc biệt lưu ý: chia train/test phải làm TRƯỚC khi chuẩn hoá, nếu không sẽ rò rỉ dữ liệu.",
          skill: "practical",
          options: [
            { label: "x = data.drop(target, axis=1); y = data[target]" },
            { label: "train_test_split(x, y, test_size=0.2, random_state=1009)" },
            { label: "scaler.fit_transform(x_train); scaler.transform(x_test)" },
            { label: "model.fit(x_train, y_train)" },
            { label: "y_pred = model.predict(x_test)" },
            { label: "classification_report(y_test, y_pred)" },
          ],
        },
        {
          type: "fill_in",
          prompt:
            "Hàm nào của scikit-learn dùng để chia dữ liệu thành tập huấn luyện và tập kiểm thử? (viết đúng tên hàm)",
          explanation: "`train_test_split` từ `sklearn.model_selection`.",
          skill: "practical",
          options: [
            { label: "train_test_split", correct: true },
            { label: "train_test_split()", correct: true },
          ],
        },
        {
          type: "numerical",
          prompt:
            "Ma trận nhầm lẫn thu được là [[88, 12], [24, 30]] theo thứ tự [[TN, FP], [FN, TP]]. Có bao nhiêu ca bệnh thật (lớp 1) bị mô hình bỏ sót?",
          explanation:
            "Bỏ sót ca bệnh thật = False Negative = 24. Đây chính là lý do recall của lớp 1 chỉ đạt 30/(30+24) ≈ 0.56.",
          skill: "evaluation",
          extra: { expected: 24, tolerance: 0 },
        },
        {
          type: "true_false",
          prompt:
            "Nên gọi `scaler.fit_transform()` cho cả `x_train` lẫn `x_test` để hai tập được chuẩn hoá giống nhau.",
          explanation:
            "Sai — và đây là lỗi phổ biến nhất. Chỉ `x_train` được fit. Gọi fit trên `x_test` làm rò rỉ thông tin tập test vào quá trình chuẩn hoá.",
          skill: "leakage",
          options: [
            { label: "Đúng", mis: "fit_test" },
            { label: "Sai", correct: true },
          ],
        },
        {
          type: "mcq",
          prompt:
            "Nếu bỏ tham số `random_state` khỏi `train_test_split`, điều gì xảy ra?",
          explanation:
            "Mỗi lần chạy sẽ chia dữ liệu khác nhau, nên kết quả đánh giá dao động giữa các lần chạy. Mô hình không xấu đi, chỉ là thí nghiệm không còn lặp lại được — gây khó khi so sánh hai phương án.",
          skill: "practical",
          options: [
            { label: "Chương trình báo lỗi vì thiếu tham số bắt buộc" },
            {
              label:
                "Mỗi lần chạy chia dữ liệu khác nhau, kết quả dao động và không lặp lại được",
              correct: true,
            },
            { label: "Mô hình sẽ kém chính xác hơn hẳn" },
            { label: "Toàn bộ dữ liệu bị dùng làm tập huấn luyện" },
          ],
        },
        {
          type: "short_answer",
          prompt:
            "Tên lớp mô hình đã dùng trong buổi thực hành là gì? (viết đúng tên class trong scikit-learn)",
          explanation: "`RandomForestClassifier` từ `sklearn.ensemble`.",
          skill: "practical",
          extra: { acceptedRegexes: ["^random\\s*forest\\s*classifier$"] },
          options: [{ label: "RandomForestClassifier", correct: true }],
        },
      ],
    },
    assignment: {
      title: "Đồ án: Chạy lại toàn bộ quy trình trên dữ liệu của bạn",
      description:
        "Lặp lại đúng quy trình trong video nhưng trên **một bộ dữ liệu khác** do bạn chọn (Kaggle, UCI, hoặc dữ liệu thật của bạn).\n\n" +
        "Bài nộp gồm notebook (hoặc code dán vào phần trả lời) và phần phân tích:\n\n" +
        "1. **Dữ liệu** — nguồn, số dòng, số cột, cột nhãn.\n" +
        "2. **Chuẩn bị** — tách x/y, chia train/test (ghi rõ `test_size` và `random_state` bạn dùng), chuẩn hoá đúng cách.\n" +
        "3. **Mô hình** — huấn luyện ít nhất một mô hình, in ra `classification_report` (hoặc chỉ số hồi quy nếu bài toán của bạn là regression).\n" +
        "4. **Đọc kết quả** — với mỗi lớp, precision và recall nói lên điều gì? Mô hình sai kiểu nào nhiều nhất?\n" +
        "5. **Cải thiện** — đề xuất **một** thay đổi cụ thể để cải thiện chỉ số yếu nhất, và giải thích vì sao bạn tin nó sẽ giúp.\n\n" +
        "Đây là bài chuẩn bị trực tiếp cho Group Project (40% điểm học phần). Bạn cần tự đánh giá mức độ tự tin và viết suy ngẫm về phần khó nhất.",
      pedagogicalIntent: "enacting",
      responseFormat: "mixed",
    },
  },
];

const INTRO = { file: "Introduction.mp4", durationSec: 77 };

// ─────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────

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

const skillIds = new Map<string, string>();
const misIds = new Map<string, string>();

async function ensureSkills() {
  for (const [key, s] of Object.entries(SKILLS)) {
    const found = await prisma.skill.findUnique({ where: { code: s.code } });
    skillIds.set(key, found?.id ?? (await createSkill(s, prisma)).skillId);
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

/** Map our question shape onto CreateQuestionInput. */
function toQuestionInput(q: Q, orderIndex: number) {
  const skillId = skillIds.get(q.skill);
  if (!skillId) throw new Error(`unknown skill key: ${q.skill}`);
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
    prompt: q.prompt,
    ...(q.explanation ? { explanation: q.explanation } : {}),
    points: q.points ?? 1,
    orderIndex,
    ...(options ? { options } : {}),
    ...(q.extra ? { extra: q.extra } : {}),
    skillIds: [skillId],
  };
}

// ─────────────────────────────────────────────────────────────────────────

async function main() {
  const dir = process.argv[2];
  const dryRun = process.argv.includes("--dry-run");
  if (!dir) {
    console.error("usage: seed-ml-lectures.ts <video-dir> [--dry-run]");
    process.exit(1);
  }
  for (const f of [INTRO.file, ...LECTURES.map((l) => l.file)]) {
    if (!existsSync(join(dir, f))) throw new Error(`missing video: ${f}`);
  }

  const course = await prisma.course.findUnique({ where: { slug: COURSE_SLUG } });
  if (!course) throw new Error(`no course ${COURSE_SLUG}`);
  const owner = await prisma.courseInstructor.findFirst({
    where: { courseId: course.id, role: "owner" },
    select: { userId: true },
  });
  if (!owner) throw new Error("course has no owner");
  const actor = owner.userId;

  const modules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { orderIndex: "asc" },
  });

  if (dryRun) {
    console.log("DRY RUN\n");
    console.log(`Course Overview video -> ${INTRO.file}`);
    for (const l of LECTURES) {
      const where =
        typeof l.position === "object" ? `after "${l.position.after}"` : l.position;
      console.log(
        `\n${modules[l.moduleIndex]?.title} [${where}]\n  "${l.title}" <- ${l.file}` +
          `\n  cuepoints: ${l.cuepoints.map((c) => `${Math.floor(c.atSec / 60)}:${String(c.atSec % 60).padStart(2, "0")}`).join(", ")}` +
          `\n  quiz: ${l.quiz.questions.length} câu (${[...new Set(l.quiz.questions.map((q) => q.type))].join(", ")})` +
          `\n  assignment: ${l.assignment.title}`,
      );
    }
    const totalCues = LECTURES.reduce((s, l) => s + l.cuepoints.length, 0);
    const totalQs = LECTURES.reduce((s, l) => s + l.quiz.questions.length, 0);
    console.log(
      `\nTotal: ${LECTURES.length} bài giảng, ${totalCues} cuepoint, ${totalQs} câu quiz, ${LECTURES.length} bài tập`,
    );
    return;
  }

  await ensureSkills();
  await ensureMisconceptions();
  console.log(`skills: ${skillIds.size}, misconceptions: ${misIds.size}`);

  // ── Course Overview: swap in the real intro video ──────────────────────
  const overview = await prisma.lesson.findFirst({
    where: { title: "Course Overview", module: { courseId: course.id } },
    include: { contentItems: true },
  });
  if (!overview) throw new Error('no "Course Overview" lesson');
  const hasIntro = overview.contentItems.some(
    (c) => c.type === "video" && ((c.payload as { durationSec?: number })?.durationSec ?? 0) === INTRO.durationSec,
  );
  if (hasIntro) {
    console.log("Course Overview: intro already attached — skip");
  } else {
    const up = await uploadVideo(join(dir, INTRO.file), actor);
    for (const old of overview.contentItems.filter((c) => c.type === "video")) {
      console.log(`  removing old overview video: ${(old.payload as { url?: string })?.url}`);
      await prisma.contentItem.delete({ where: { id: old.id } });
    }
    await createContentItem(
      actor,
      overview.id,
      { type: "video", payload: { url: up.url, durationSec: INTRO.durationSec }, orderIndex: 1 },
      prisma,
    );
    console.log(`Course Overview <- ${INTRO.file} (${up.mb.toFixed(1)} MB)`);
  }

  // ── Lectures ──────────────────────────────────────────────────────────
  for (const plan of LECTURES) {
    const mod = modules[plan.moduleIndex];
    if (!mod) throw new Error(`module ${plan.moduleIndex} missing`);

    const existing = await prisma.lesson.findFirst({
      where: { moduleId: mod.id, title: plan.title },
      include: { contentItems: { select: { type: true } } },
    });
    if (existing?.contentItems.some((c) => c.type === "video")) {
      console.log(`skip (already built): ${plan.title}`);
      continue;
    }

    // Slot the lesson in. Shifting is done highest-first because
    // (moduleId, orderIndex) is unique and checked per statement.
    let orderIndex: number;
    if (plan.position === "top" || typeof plan.position === "object") {
      let insertAt = 0;
      if (typeof plan.position === "object") {
        const anchor = await prisma.lesson.findFirst({
          where: { moduleId: mod.id, title: plan.position.after },
          select: { orderIndex: true },
        });
        if (!anchor) throw new Error(`anchor lesson not found: ${plan.position.after}`);
        insertAt = anchor.orderIndex + 1;
      }
      const siblings = await prisma.lesson.findMany({
        where: { moduleId: mod.id, orderIndex: { gte: insertAt } },
        orderBy: { orderIndex: "desc" },
        select: { id: true, orderIndex: true },
      });
      for (const s of siblings) {
        await prisma.lesson.update({
          where: { id: s.id },
          data: { orderIndex: s.orderIndex + 1 },
        });
      }
      orderIndex = insertAt;
    } else {
      const max = await prisma.lesson.aggregate({
        where: { moduleId: mod.id },
        _max: { orderIndex: true },
      });
      orderIndex = (max._max.orderIndex ?? -1) + 1;
    }

    const { lessonId } = await createLesson(
      actor,
      mod.id,
      { title: plan.title, orderIndex, description: plan.description },
      prisma,
    );

    // 1. Reading
    await createContentItem(
      actor,
      lessonId,
      { type: "markdown", payload: { body: plan.body }, orderIndex: 0 },
      prisma,
    );

    // 2. Cuepoint quizzes must exist before the video payload can reference
    //    them — and both must land in the same run, or the orphan sweep on the
    //    next content save would collect them.
    const cues: Array<{ atSec: number; quizId: string }> = [];
    for (const c of plan.cuepoints) {
      const skillId = skillIds.get(c.q.skill);
      if (!skillId) throw new Error(`unknown skill: ${c.q.skill}`);
      const { quizId } = await createCuepointQuiz(
        actor,
        lessonId,
        {
          atSec: c.atSec,
          question: {
            type: c.q.type,
            prompt: c.q.prompt,
            ...(c.q.explanation ? { explanation: c.q.explanation } : {}),
            points: 1,
            options: c.q.options?.map((o) => ({
              label: o.label,
              isCorrect: o.correct ?? false,
              ...(o.mis ? { misconceptionId: misIds.get(o.mis) } : {}),
            })),
            skillIds: [skillId],
          },
        },
        prisma,
      );
      cues.push({ atSec: c.atSec, quizId });
    }

    // 3. Video carrying the cuepoints
    const up = await uploadVideo(join(dir, plan.file), actor);
    await createContentItem(
      actor,
      lessonId,
      {
        type: "video",
        payload: { url: up.url, durationSec: plan.durationSec, cuepoints: cues },
        orderIndex: 1,
      },
      prisma,
    );

    // 4. End-of-lesson quiz
    const { quizId } = await createQuiz(
      actor,
      { courseId: course.id, lessonId },
      {
        title: plan.quiz.title,
        description: plan.quiz.description,
        passThresholdPct: 70,
        maxAttempts: 5,
        requireConfidence: true,
      },
      prisma,
    );
    for (const [i, q] of plan.quiz.questions.entries()) {
      await createQuestion(actor, quizId, toQuestionInput(q, i), prisma);
    }

    // 5. Practice assignment
    await createAssignment(
      actor,
      lessonId,
      {
        title: plan.assignment.title,
        description: plan.assignment.description,
        pedagogicalIntent: plan.assignment.pedagogicalIntent,
        responseFormat: plan.assignment.responseFormat,
        assessmentModes: ["instructor_graded", "self_assessed"],
        requireSelfRating: true,
        requireReflection: true,
        maxScore: 100,
      },
      prisma,
    );

    // 6. Skill tag (publish gate needs every lesson tagged)
    const lessonSkill = skillIds.get(
      Object.entries(SKILLS).find(([, v]) => v.code === plan.skill.code)?.[0] ?? "",
    );
    if (!lessonSkill) throw new Error(`no skill id for ${plan.skill.code}`);
    await tagLessonSkill(actor, lessonId, { skillId: lessonSkill }, prisma);

    console.log(
      `${mod.title} [${orderIndex}] "${plan.title}" — ${up.mb.toFixed(1)} MB, ` +
        `${cues.length} cuepoint, ${plan.quiz.questions.length} câu quiz, 1 bài tập`,
    );
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
