/**
 * Build "Fundamental of Machine Learning" as micro-lessons.
 *
 * The four recorded lectures (Chapter 1–3 and the Practical session) were each
 * built as one long video. Too coarse for micro-credential delivery, so each is
 * cut on topic boundaries into short units that are self-contained and
 * separately assessable:
 *
 *   short video (2–8 min)  →  one in-video cuepoint quiz that pauses playback
 *   →  end-of-unit quiz (pass 70%)  →  its own skill, so mastery is recorded
 *      per unit and not just per lecture.
 *
 * Each chapter's units replace the old long lecture in the same place:
 *
 *   Chapter 1  -> units 1.x, straight after "Course Overview"  (Module 1)
 *   Chapter 2  -> units 2.x, at the top of Module 2
 *   Chapter 3  -> units 3.x, at the top of Module 3
 *   Practical  -> units 3.Tx, at the end of Module 3
 *
 * and each chapter closes with a capstone lesson carrying that chapter's
 * practice assignment, so no assignment is lost with the old lectures.
 *
 *   tsx scripts/seed-ml-micro.ts <video-dir> [--dry-run]
 *
 * <video-dir> holds the clips named in each unit (ch1_u01.mp4 …). Idempotent: a
 * lesson that already carries a video is skipped whole. Blobs go through the
 * storage adapter, so S3_* decides where they land. The old long lectures are
 * not touched here — remove them with scripts/delete-lesson.ts once the units
 * are confirmed.
 *
 * Note on cuepoints: the gating player only mounts for signed-in learners, and
 * only grades `mcq` / `true_false`, so every cuepoint question is one of those.
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

const COURSE_SLUG = "fundamental-of-machine-learning";
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
  skill: SkillDef;
  cue: Cue;
  quiz: { title: string; description: string; questions: Q[] };
}

interface SkillDef {
  code: string;
  name: string;
  description: string;
}

interface Capstone {
  title: string;
  description: string;
  body: string;
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

const T = (label: string, correct?: boolean, mis?: string): Opt => ({
  label,
  ...(correct ? { correct } : {}),
  ...(mis ? { mis } : {}),
});
const YES_NO = (yes: boolean): Opt[] => [T("Đúng", yes), T("Sai", !yes)];

// ─────────────────────────────────────────────────────────────────────────
// Existing misconceptions (from the long lectures)
// ─────────────────────────────────────────────────────────────────────────

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
// Content — one block per chapter
// ─────────────────────────────────────────────────────────────────────────

// ── Chapter 1: Nền tảng học máy và chuẩn bị dữ liệu (10 đơn vị) ──

const sk1 = (key: string, name: string, description: string): SkillDef => ({
  code: `ml.micro.${key}`,
  name,
  description,
});

const SKILLS_CH1: Record<string, SkillDef> = {
  howLearn: sk1("how_machines_learn", "Máy học như thế nào", "Nắm quan hệ AI ⊃ ML ⊃ DL, và vòng lặp huấn luyện Data → Model → Prediction → Loss → Update."),
  dataTypes: sk1("data_types", "Các loại dữ liệu", "Nhận biết dữ liệu dạng bảng, văn bản, hình ảnh và âm thanh."),
  labelGroups: sk1("labeled_data_and_learning_types", "Dữ liệu có nhãn và ba nhóm thuật toán", "Phân biệt dữ liệu có nhãn/chưa gán nhãn, và supervised, unsupervised, reinforcement learning."),
  supUnsup: sk1("supervised_unsupervised_tasks", "Regression, classification, clustering, association", "Phân biệt các bài toán trong supervised và unsupervised learning."),
  featureTypes: sk1("feature_types", "Các loại đặc trưng", "Phân biệt đặc trưng số (discrete/continuous) và hạng mục (nominal/ordinal/boolean)."),
  terms: sk1("dataset_terms_and_splitting", "Thuật ngữ bảng dữ liệu và chia tập", "Hiểu sample, feature, target label, feature vector và chia dữ liệu thành train/validation/test."),
  quality: sk1("data_quality", "Chất lượng dữ liệu", "Nhận ra thiếu giá trị, trùng lặp, sai định dạng, ngoại lai và vai trò của độ đa dạng dữ liệu."),
  scaling: sk1("numeric_scaling", "Chuẩn hoá đặc trưng số", "Áp dụng Min-Max normalization và z-score standardization."),
  encoding: sk1("categorical_encoding", "Mã hoá đặc trưng hạng mục", "Chọn ordinal encoding hay one-hot encoding cho đúng loại đặc trưng."),
  pipeline: sk1("ml_pipeline", "Pipeline học máy 9 bước", "Nắm thứ tự các bước từ thu thập dữ liệu tới triển khai mô hình."),
};

const MIS_CH1: Record<string, { code: string; name: string; description: string }> = {
  ch1_label_in_feature_vector: {
    code: "ml_label_in_feature_vector",
    name: "Đưa cột nhãn vào feature vector",
    description: "Học viên tính cả cột target/label (ví dụ price) vào feature vector hoặc vào số đặc trưng đầu vào.",
  },
  ch1_ordinal_for_nominal: {
    code: "ml_ordinal_encoding_for_nominal",
    name: "Dùng ordinal encoding cho đặc trưng không có thứ tự",
    description: "Học viên gán số 0, 1, 2... cho hạng mục không có thứ tự (như màu sắc), vô tình tạo ra thứ tự giả cho mô hình.",
  },
  ch1_missing_vs_format: {
    code: "ml_missing_vs_wrong_format",
    name: "Nhầm thiếu giá trị với sai định dạng",
    description: "Học viên xếp lỗi ô bỏ trống (missing value) và lỗi giá trị có mặt nhưng viết sai kiểu (wrong data format) vào cùng một loại.",
  },
};

const UNITS_CH1: Unit[] = [
  // ───────────────────────── 1.1 ─────────────────────────
  {
    key: "ch1_u01",
    file: "ch1_u01.mp4",
    title: "1.1 Máy học như thế nào",
    description: "AI, Machine Learning, Deep Learning và Data Science liên quan ra sao, và vòng lặp huấn luyện: Data → Model → Prediction → Loss → Update.",
    skill: SKILLS_CH1.howLearn!,
    body:
      "## 1.1 Máy học như thế nào\n\n" +
      "**Sau đơn vị này bạn sẽ:** đặt được Machine Learning vào bức tranh chung của AI và Data Science, và mô tả được cách một mô hình tự cải thiện qua từng vòng huấn luyện.\n\n" +
      "### Cần nhớ\n\n" +
      "- Sơ đồ Venn: Computer Science ⊃ AI ⊃ Machine Learning ⊃ Deep Learning; Data Science là lĩnh vực giao thoa với chúng.\n" +
      "- Data Science nằm ở giao của Computer Science, Mathematics & Statistics và Domain Knowledge.\n" +
      "- Con người học qua vòng: làm bài → nộp bài → giáo viên chấm theo đáp án → có kết quả → cải thiện.\n" +
      "- Máy học theo đúng khung đó: **Data → Model → Prediction → Loss function → Update**.\n" +
      "- **Loss function** (ví dụ MSE) so dự đoán với ground truth và cho ra loss value; loss value là tín hiệu để cập nhật lại mô hình.",
    cue: {
      atSec: 367,
      q: {
        type: "mcq",
        prompt: "Trong vòng lặp huấn luyện vừa xem (Data → Model → Prediction → Loss function → Update), hàm mất mát (loss function) đóng vai trò gì?",
        explanation: "Loss function đo khoảng cách giữa dự đoán của mô hình và giá trị thật (ground truth). Giá trị loss đó chính là tín hiệu để cập nhật lại mô hình — không có nó thì mô hình không biết mình sai ở đâu.",
        options: [
          T("Sinh thêm dữ liệu huấn luyện mới cho mô hình"),
          T("Đo sai lệch giữa dự đoán và giá trị thật, làm tín hiệu để cập nhật mô hình", true),
          T("Quyết định loại dữ liệu đầu vào được phép dùng"),
          T("Triển khai mô hình đã huấn luyện lên môi trường thật"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 1.1 — Máy học như thế nào",
      description: "4 câu về sơ đồ Venn, Data Science và vòng lặp huấn luyện.",
      questions: [
        {
          type: "true_false",
          prompt: "Deep Learning là một nhánh con của Machine Learning, và Machine Learning là một nhánh con của AI.",
          explanation: "Đúng — theo sơ đồ Venn: Computer Science ⊃ AI ⊃ Machine Learning ⊃ Deep Learning.",
          options: YES_NO(true),
        },
        {
          type: "mcq",
          prompt: "Theo sơ đồ Venn thứ hai của bài giảng, Data Science nằm ở giao của ba lĩnh vực nào?",
          explanation: "Data Science nằm ở vùng giao của Computer Science, Mathematics & Statistics và Domain Knowledge.",
          options: [
            T("Computer Science, Mathematics & Statistics, Domain Knowledge", true),
            T("AI, Machine Learning, Deep Learning"),
            T("Software Development, Research, Machine Learning"),
            T("Computer Science, AI, Deep Learning"),
          ],
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các thành phần của vòng lặp máy học theo đúng thứ tự trên sơ đồ “How machines learn”.",
          explanation: "Data đi vào Model, Model đưa ra Prediction, Loss function so Prediction với ground truth để ra loss value, cuối cùng Update cập nhật lại Model.",
          options: [T("Data (dữ liệu)"), T("Model (mô hình)"), T("Prediction (dự đoán)"), T("Loss function (so với ground truth)"), T("Update (cập nhật mô hình)")],
        },
        {
          type: "mcq",
          prompt: "Ở sơ đồ “How humans learn”, giáo viên chấm bài dựa trên lời giải (Solution). Ở phía máy, thành phần nào đóng vai trò tương ứng với Solution?",
          explanation: "Ground truth (giá trị thật) là “đáp án” mà loss function dùng để so với dự đoán của mô hình, giống như giáo viên so bài nộp với lời giải.",
          options: [T("Data"), T("Prediction"), T("Ground truth", true), T("Model")],
        },
      ],
    },
  },
  // ───────────────────────── 1.2 ─────────────────────────
  {
    key: "ch1_u02",
    file: "ch1_u02.mp4",
    title: "1.2 Các loại dữ liệu",
    description: "Bốn dạng dữ liệu phổ biến trong học máy: bảng, văn bản, hình ảnh và âm thanh.",
    skill: SKILLS_CH1.dataTypes!,
    body:
      "## 1.2 Các loại dữ liệu\n\n" +
      "**Sau đơn vị này bạn sẽ:** nhận ra một bộ dữ liệu thuộc dạng nào trong bốn dạng phổ biến.\n\n" +
      "### Cần nhớ\n\n" +
      "| Dạng | Ví dụ trong bài giảng |\n" +
      "|---|---|\n" +
      "| Bảng (tabular) | square_feet, num_floors, num_bedrooms, price (billion VND) |\n" +
      "| Văn bản | title, description, job_level (junior / senior / middle) |\n" +
      "| Hình ảnh | ảnh xếp theo lớp: airplane, automobile, bird, cat, deer |\n" +
      "| Âm thanh | các dạng sóng (waveform) |\n\n" +
      "- Dù là dạng nào, dữ liệu cũng cần được biểu diễn thành số trước khi đưa vào mô hình.",
    cue: {
      atSec: 332,
      q: {
        type: "mcq",
        prompt: "Một bộ dữ liệu gồm nhiều ảnh, xếp theo các lớp airplane, automobile, bird, cat, deer, thuộc dạng dữ liệu nào?",
        explanation: "Đó là dữ liệu hình ảnh — mỗi mẫu là một bức ảnh, có tên lớp đi kèm. Dữ liệu bảng gồm các hàng và cột số/chữ; dữ liệu âm thanh là các dạng sóng.",
        options: [T("Dữ liệu dạng bảng"), T("Dữ liệu văn bản"), T("Dữ liệu hình ảnh", true), T("Dữ liệu âm thanh")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.2 — Các loại dữ liệu",
      description: "4 câu về bảng, văn bản và âm thanh.",
      questions: [
        {
          type: "mcq",
          prompt: "Ví dụ dữ liệu văn bản trong bài giảng có những cột nào?",
          explanation: "Bảng ví dụ văn bản có ba cột: title (tên vị trí), description (mô tả công việc) và job_level (junior, senior, middle).",
          options: [T("title, description, job_level", true), T("square_feet, num_floors, price"), T("airplane, automobile, bird"), T("time, cost, outlier")],
        },
        {
          type: "numerical",
          prompt: "Bảng nhà ở có 4 căn với num_bedrooms lần lượt là 3, 2, 4, 3. Tổng số phòng ngủ của 4 căn là bao nhiêu?",
          explanation: "3 + 2 + 4 + 3 = 12.",
          extra: { expected: 12, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt: "Trong bảng dữ liệu nhà ở của bài giảng, cột price được tính theo đơn vị tỷ đồng (billion VND).",
          explanation: "Đúng — tiêu đề cột ghi price (billion VND), chẳng hạn 3.2 nghĩa là 3,2 tỷ đồng.",
          options: YES_NO(true),
        },
        {
          type: "mcq",
          prompt: "Dữ liệu âm thanh được minh hoạ trên slide dưới dạng nào?",
          explanation: "Slide vẽ âm thanh bằng các dạng sóng (waveform) — biên độ thay đổi theo thời gian.",
          options: [T("Các dạng sóng (waveform)", true), T("Các hàng và cột số"), T("Các đoạn văn bản"), T("Các bức ảnh xếp theo lớp")],
        },
      ],
    },
  },
  // ───────────────────────── 1.3 ─────────────────────────
  {
    key: "ch1_u03",
    file: "ch1_u03.mp4",
    title: "1.3 Dữ liệu có nhãn và ba nhóm thuật toán",
    description: "Khác biệt giữa dữ liệu chưa gán nhãn và có nhãn, và ba nhóm thuật toán: supervised, unsupervised, reinforcement.",
    skill: SKILLS_CH1.labelGroups!,
    body:
      "## 1.3 Dữ liệu có nhãn và ba nhóm thuật toán\n\n" +
      "**Sau đơn vị này bạn sẽ:** phân biệt dữ liệu có nhãn với chưa gán nhãn, và gọi tên ba nhóm thuật toán học máy.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Unlabeled data** là dữ liệu thô; người **annotator** gán nhãn (ví dụ cat, rabbit, sport) để thành **labeled data**.\n" +
      "- Ba nhóm thuật toán: **Supervised**, **Unsupervised**, **Reinforcement** Learning.\n" +
      "- Supervised Learning được minh hoạ bằng hình một giáo viên chỉ ra đáp án (dữ liệu có nhãn).\n" +
      "- Unsupervised Learning làm việc với dữ liệu chưa có nhãn, tìm cấu trúc như các cụm.\n" +
      "- Reinforcement Learning: một agent tương tác với environment qua state, action, reward.",
    cue: {
      atSec: 266,
      q: {
        type: "mcq",
        prompt: "Slide “Machine Learning algorithms” chia các thuật toán học máy thành ba nhóm nào?",
        explanation: "Ba nhóm là Supervised, Unsupervised và Reinforcement Learning. Regression, classification, clustering là các bài toán cụ thể nằm bên trong các nhóm đó, còn train/validation/test là cách chia dữ liệu.",
        options: [
          T("Supervised, Unsupervised, Reinforcement Learning", true),
          T("Regression, Classification, Clustering"),
          T("Linear regression, Logistic regression, SVM"),
          T("Train, Validation, Test"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 1.3 — Dữ liệu có nhãn và các nhóm thuật toán",
      description: "3 câu về annotator, supervised learning và reinforcement learning.",
      questions: [
        {
          type: "mcq",
          prompt: "Trên slide “Unlabeled data vs Labeled data”, người annotator làm nhiệm vụ gì?",
          explanation: "Annotator gán nhãn cho dữ liệu thô: ảnh mèo thành cat, ảnh thỏ thành rabbit, đoạn tin bóng đá thành sport.",
          options: [
            T("Gán nhãn cho dữ liệu chưa có nhãn", true),
            T("Huấn luyện mô hình trên dữ liệu"),
            T("Xoá các dòng dữ liệu bị thiếu"),
            T("Triển khai mô hình lên môi trường thật"),
          ],
        },
        {
          type: "mcq",
          prompt: "Bài toán nào sau đây KHÔNG thuộc supervised learning?",
          explanation: "Gom cụm khách hàng theo hành vi khi chưa có nhãn nào là unsupervised learning. Ba bài toán còn lại đều có nhãn đúng để học theo.",
          options: [
            T("Dự đoán giá nhà từ diện tích và vị trí"),
            T("Phân loại email là spam hay không spam"),
            T("Gom cụm khách hàng theo hành vi mua sắm khi chưa có nhãn nào", true),
            T("Dự đoán một bệnh nhân có mắc tiểu đường hay không"),
          ],
        },
        {
          type: "mcq",
          prompt: "Nhóm thuật toán nào được vẽ bằng một agent (learner) tương tác với environment thông qua state, action và reward?",
          explanation: "Đó là Reinforcement Learning: agent hành động trong environment, nhận reward và đổi state. Slide dùng hình robot và chiếc bánh để minh hoạ.",
          options: [T("Supervised Learning"), T("Unsupervised Learning"), T("Reinforcement Learning", true), T("Data preprocessing")],
        },
      ],
    },
  },
  // ───────────────────────── 1.4 ─────────────────────────
  {
    key: "ch1_u04",
    file: "ch1_u04.mp4",
    title: "1.4 Regression, classification, clustering, association",
    description: "Hai bài toán của supervised learning (regression, classification) và hai bài toán của unsupervised learning (clustering, association).",
    skill: SKILLS_CH1.supUnsup!,
    body:
      "## 1.4 Regression, classification, clustering, association\n\n" +
      "**Sau đơn vị này bạn sẽ:** xếp đúng một bài toán vào regression, classification, clustering hay association.\n\n" +
      "### Cần nhớ\n\n" +
      "| Nhóm | Bài toán | Ví dụ trên slide |\n" +
      "|---|---|---|\n" +
      "| Supervised | **Regression** — đầu ra là số liên tục | “Nhiệt độ ngày mai là bao nhiêu?” → 84°F |\n" +
      "| Supervised | **Classification** — đầu ra là nhãn | “Ngày mai nóng hay lạnh?” → HOT / COLD |\n" +
      "| Unsupervised | **Clustering** — gom các điểm thành cụm | Chấm trắng → các cụm có màu |\n" +
      "| Unsupervised | **Association** — tìm quy luật đi kèm | Nếu khách mua món #1 thì gợi ý món #2 |",
    cue: {
      atSec: 193,
      q: {
        type: "mcq",
        prompt: "Quy luật “nếu khách hàng mua món #1 thì gợi ý món #2” thuộc bài toán nào?",
        explanation: "Đây là association: tìm các món hay được mua cùng nhau để đưa ra gợi ý, không cần nhãn cho trước. Clustering thì gom các điểm dữ liệu thành cụm.",
        options: [T("Regression"), T("Classification"), T("Clustering"), T("Association", true)],
      },
    },
    quiz: {
      title: "Kiểm tra 1.4 — Các bài toán học máy",
      description: "4 câu về regression, classification, clustering và nhóm thuật toán.",
      questions: [
        {
          type: "fill_in",
          prompt: "Bài toán “dự đoán nhiệt độ ngày mai là bao nhiêu độ” (đầu ra là một số liên tục như 84°F) có tên là gì? (viết tiếng Anh)",
          explanation: "Đầu ra là giá trị số liên tục nên đây là regression (hồi quy).",
          options: [T("regression", true), T("Regression", true), T("hồi quy", true)],
        },
        {
          type: "true_false",
          prompt: "Câu hỏi “Ngày mai nóng (HOT) hay lạnh (COLD)?” là bài toán classification vì đầu ra là một nhãn.",
          explanation: "Đúng — đầu ra là một trong hai nhãn HOT hoặc COLD nên là classification. Nếu hỏi cụ thể là bao nhiêu độ thì mới là regression.",
          options: [T("Đúng", true), T("Sai", false, "regression_vs_classification")],
        },
        {
          type: "mcq",
          prompt: "Ở slide Clustering, các chấm trắng biến thành các chấm nhiều màu. Điều đó có nghĩa là gì?",
          explanation: "Clustering gom các điểm dữ liệu thành các cụm dựa trên mức độ giống nhau, mà không cần nhãn cho trước — mỗi màu là một cụm.",
          options: [
            T("Gom các điểm giống nhau vào từng cụm mà không cần nhãn", true),
            T("Dự đoán một giá trị số liên tục cho từng điểm"),
            T("Gán sẵn nhãn HOT hoặc COLD cho từng điểm"),
            T("Xoá các điểm bị thiếu giá trị"),
          ],
        },
        {
          type: "mcq",
          prompt: "Trên slide, hai bài toán Clustering và Association nằm dưới nhóm thuật toán nào?",
          explanation: "Clustering và Association nằm dưới Unsupervised Learning — làm việc với dữ liệu chưa có nhãn. Regression và Classification nằm dưới Supervised Learning.",
          options: [T("Supervised Learning"), T("Unsupervised Learning", true), T("Reinforcement Learning"), T("Data preprocessing")],
        },
      ],
    },
  },
  // ───────────────────────── 1.5 ─────────────────────────
  {
    key: "ch1_u05",
    file: "ch1_u05.mp4",
    title: "1.5 Các loại đặc trưng",
    description: "Đặc trưng số (discrete, continuous) và đặc trưng hạng mục (nominal, ordinal, boolean).",
    skill: SKILLS_CH1.featureTypes!,
    body:
      "## 1.5 Các loại đặc trưng\n\n" +
      "**Sau đơn vị này bạn sẽ:** gọi đúng tên loại của một đặc trưng — bước đầu tiên để chọn cách xử lý phù hợp.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Numerical**: đặc trưng là số — *discrete* (các giá trị rời rạc, như số nguyên) hoặc *continuous* (mọi giá trị trên trục số).\n" +
      "- **Categorical**: đặc trưng là hạng mục — *nominal* (không có thứ tự, như màu sắc), *ordinal* (có thứ tự, như cỡ cốc S < M < L), *boolean* (chỉ hai giá trị đúng/sai).",
    cue: {
      atSec: 286,
      q: {
        type: "mcq",
        prompt: "Cỡ cốc cà phê S – M – L là loại đặc trưng nào?",
        explanation: "S, M, L là các hạng mục CÓ thứ tự (S < M < L) nên là ordinal. Nominal là hạng mục không thứ tự (ví dụ màu sắc), boolean chỉ có hai giá trị đúng/sai.",
        options: [T("Numerical (đặc trưng số)"), T("Nominal (hạng mục không thứ tự)"), T("Ordinal (hạng mục có thứ tự)", true), T("Boolean")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.5 — Các loại đặc trưng",
      description: "4 câu về numerical, categorical, nominal và boolean.",
      questions: [
        {
          type: "mcq",
          prompt: "Số tầng của một căn nhà (1, 2, 3, ...) là loại đặc trưng nào?",
          explanation: "Số tầng là số nguyên, chỉ nhận các giá trị rời rạc nên là numerical – discrete. Continuous là các giá trị có thể nằm bất kỳ đâu trên trục số.",
          options: [T("Numerical – discrete", true), T("Numerical – continuous"), T("Categorical – nominal"), T("Categorical – boolean")],
        },
        {
          type: "true_false",
          prompt: "Đặc trưng continuous có thể nhận mọi giá trị trên trục số thực, còn đặc trưng discrete chỉ nhận các giá trị rời rạc như số nguyên.",
          explanation: "Đúng — slide vẽ discrete bằng các vạch số nguyên còn continuous là một trục liên tục.",
          options: YES_NO(true),
        },
        {
          type: "mcq",
          prompt: "Một căn nhà có vườn hay không (Yes / No) là loại đặc trưng nào?",
          explanation: "Chỉ có hai giá trị đúng/sai nên là boolean — một dạng categorical.",
          options: [T("Nominal"), T("Ordinal"), T("Boolean", true), T("Numerical – continuous")],
        },
        {
          type: "fill_in",
          prompt: "Loại đặc trưng hạng mục KHÔNG có thứ tự (ví dụ màu sắc) có tên là gì? (viết tiếng Anh)",
          explanation: "Đó là nominal. Có thứ tự thì là ordinal (như S < M < L).",
          options: [T("nominal", true), T("Nominal", true)],
        },
      ],
    },
  },
  // ───────────────────────── 1.6 ─────────────────────────
  {
    key: "ch1_u06",
    file: "ch1_u06.mp4",
    title: "1.6 Thuật ngữ bảng dữ liệu và chia tập",
    description: "Sample, feature, target label, feature vector trên một bảng dữ liệu, và cách chia dữ liệu thành train, validation, test.",
    skill: SKILLS_CH1.terms!,
    body:
      "## 1.6 Thuật ngữ bảng dữ liệu và chia tập\n\n" +
      "**Sau đơn vị này bạn sẽ:** đọc được một bảng dữ liệu bằng ngôn ngữ của học máy và biết dữ liệu được chia làm những phần nào.\n\n" +
      "### Cần nhớ\n\n" +
      "| Thuật ngữ | Là gì trên bảng |\n" +
      "|---|---|\n" +
      "| Sample (object, record, item, observation) | Một **dòng** |\n" +
      "| Feature (attribute) | Một **cột** đầu vào |\n" +
      "| Target / label | Cột cần dự đoán (ví dụ price) |\n" +
      "| Feature vector | Một dòng, **không tính** cột target |\n\n" +
      "- Dữ liệu được chia thành **Train set**, **Validation set** và **Test set**; Train set chiếm phần lớn nhất.",
    cue: {
      atSec: 373,
      q: {
        type: "mcq",
        prompt: "Slide “Data splitting” chia bảng dữ liệu thành những tập nào?",
        explanation: "Bảng được chia thành Train set (phần lớn nhất), Validation set và Test set.",
        options: [
          T("Train set, Validation set, Test set", true),
          T("Feature set, Label set, Sample set"),
          T("Train set, Deployment set, Missing set"),
          T("Numerical set, Categorical set, Boolean set"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 1.6 — Thuật ngữ và chia tập",
      description: "4 câu về target label, feature vector, số đặc trưng và tập train.",
      questions: [
        {
          type: "fill_in",
          prompt: "Trong bảng nhà ở (square_feet, type, city, has_garden, price), cột nào là target/label? (viết đúng tên cột)",
          explanation: "Slide tô cột price là target/label — giá trị mô hình cần dự đoán từ các cột còn lại.",
          options: [T("price", true), T("Price", true)],
        },
        {
          type: "mcq",
          prompt: "Với dòng cuối của bảng (square_feet = 65, type = Mid-range, city = Hanoi, has_garden = No, price = 2.9), feature vector gồm những giá trị nào?",
          explanation: "Feature vector là một dòng NHƯNG không tính cột target. Vì price là target nên feature vector chỉ gồm 65, Mid-range, Hanoi, No.",
          options: [
            T("65, Mid-range, Hanoi, No", true),
            T("65, Mid-range, Hanoi, No, 2.9", false, "ch1_label_in_feature_vector"),
            T("2.9", false, "ch1_label_in_feature_vector"),
            T("60, 40, 80, 65"),
          ],
        },
        {
          type: "numerical",
          prompt: "Bảng nhà ở có 5 cột: square_feet, type, city, has_garden, price (price là target). Có bao nhiêu feature (đặc trưng đầu vào)?",
          explanation: "5 cột trừ 1 cột target (price) còn 4 feature: square_feet, type, city, has_garden.",
          extra: { expected: 4, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt: "Trên slide “Data splitting”, tập nào chiếm số dòng nhiều nhất?",
          explanation: "Train set là khung lớn nhất trên slide — phần lớn dữ liệu dùng để huấn luyện, phần nhỏ còn lại dành cho Validation và Test.",
          options: [T("Train set", true), T("Validation set"), T("Test set"), T("Ba tập bằng nhau")],
        },
      ],
    },
  },
  // ───────────────────────── 1.7 ─────────────────────────
  {
    key: "ch1_u07",
    file: "ch1_u07.mp4",
    title: "1.7 Chất lượng dữ liệu",
    description: "Các vấn đề thường gặp của dữ liệu thô: thiếu giá trị, trùng lặp, sai định dạng, ngoại lai, và độ đa dạng của dữ liệu.",
    skill: SKILLS_CH1.quality!,
    body:
      "## 1.7 Chất lượng dữ liệu\n\n" +
      "**Sau đơn vị này bạn sẽ:** nhận ra và gọi tên các vấn đề của dữ liệu thô trước khi huấn luyện.\n\n" +
      "### Cần nhớ\n\n" +
      "| Vấn đề | Dấu hiệu trên slide |\n" +
      "|---|---|\n" +
      "| Missing values | Ô bị bỏ trống |\n" +
      "| Duplicated values | Các dòng gần như giống hệt nhau |\n" +
      "| Wrong data format | Giá trị có mặt nhưng viết khác kiểu: `2025-12-10` lẫn `09/12/25`, `60$` lẫn `$45` |\n" +
      "| Outlier | Điểm nằm xa hẳn phần còn lại và đường xu hướng |\n\n" +
      "- Slide “Variance in data” nhấn mạnh vai trò của độ đa dạng: nhóm gồm các mẫu khác nhau (khung xanh) được mô hình chú ý nhiều hơn nhóm gồm các mẫu giống hệt nhau (khung đỏ).",
    cue: {
      atSec: 377,
      q: {
        type: "mcq",
        prompt: "Cột Time có “09/12/25” và “11/12/25” nhưng lại lẫn “2025-12-10”; cột Cost có “$45” lẫn “60$”. Đây là vấn đề gì của dữ liệu?",
        explanation: "Các giá trị đều có mặt nhưng viết theo kiểu khác nhau — đó là wrong data format. Missing value là ô bị bỏ trống; outlier là giá trị nằm quá xa phần còn lại.",
        options: [
          T("Missing values (thiếu giá trị)", false, "ch1_missing_vs_format"),
          T("Duplicated values (trùng lặp)"),
          T("Wrong data format (sai định dạng)", true),
          T("Outlier (ngoại lai)"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 1.7 — Chất lượng dữ liệu",
      description: "4 câu về thiếu giá trị, ngoại lai, sai định dạng và trùng lặp.",
      questions: [
        {
          type: "fill_in",
          prompt: "Trong bảng giá nhà, một dòng bị bỏ trống ô square_feet. Vấn đề này của dữ liệu có tên là gì? (viết tiếng Anh)",
          explanation: "Ô trống là missing value. Wrong data format là khi giá trị có mặt nhưng sai kiểu hoặc định dạng.",
          options: [T("missing value", true), T("missing values", true), T("Missing value", true), T("Missing values", true), T("thiếu giá trị", true)],
        },
        {
          type: "mcq",
          prompt: "Trên biểu đồ có đường xu hướng màu xanh, chấm đỏ nằm xa hẳn các chấm xanh lá được gọi là gì?",
          explanation: "Điểm nằm xa hẳn phần còn lại của dữ liệu và đường xu hướng là outlier (giá trị ngoại lai).",
          options: [T("Missing value"), T("Outlier", true), T("Duplicated value"), T("Feature vector")],
        },
        {
          type: "true_false",
          prompt: "Trong bảng Time/Cost, “2025-12-10” và “60$” bị tô đỏ vì chúng viết theo định dạng khác so với các giá trị còn lại của cột (09/12/25, $45).",
          explanation: "Đúng — hai giá trị đó không cùng kiểu định dạng với các giá trị còn lại trong cột nên là wrong data format.",
          options: YES_NO(true),
        },
        {
          type: "mcq",
          prompt: "Trên slide “duplicated values”, hai dòng bị khoanh khung đỏ nét đứt cùng có những giá trị nào?",
          explanation: "Hai dòng cùng có square_feet = 60, location = Hanoi và price = 3.2 (chỉ num_floors khác nhau). Đó là dấu hiệu dòng bị trùng lặp.",
          options: [
            T("square_feet = 60, location = Hanoi, price = 3.2", true),
            T("square_feet = 45, location = HCM, price = 2.5"),
            T("square_feet = 80, location = Danang, price = 3.5"),
            T("Chúng không có giá trị nào giống nhau"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 1.8 ─────────────────────────
  {
    key: "ch1_u08",
    file: "ch1_u08.mp4",
    title: "1.8 Chuẩn hoá đặc trưng số",
    description: "Hai cách đưa đặc trưng số về cùng thang đo: Normalization (Min-Max) và Standardization (z-score).",
    skill: SKILLS_CH1.scaling!,
    body:
      "## 1.8 Chuẩn hoá đặc trưng số\n\n" +
      "**Sau đơn vị này bạn sẽ:** áp dụng được hai công thức chuẩn hoá và không nhầm chúng với nhau.\n\n" +
      "### Cần nhớ\n\n" +
      "**Normalization (Min-Max)** — đưa giá trị về đoạn [0, 1]:\n\n" +
      "> x_new = (x_old − x_min) / (x_max − x_min)\n\n" +
      "**Standardization (z-score)** — đưa về trung bình 0, độ lệch chuẩn 1:\n\n" +
      "> x_new = (x_old − mean) / std\n\n" +
      "- Ví dụ trên slide: cột grade (6, 1, 8, 0, 3, 10, 2) sau Min-Max thành (0.6, 0.1, 0.8, 0.0, 0.3, 1.0, 0.2).\n" +
      "- Sau z-score các giá trị có thể **âm** (−0.84, −1.14 ...) và không bị giới hạn trong [0, 1].\n" +
      "- Hai phép này **không thay thế nhau** — dùng phép nào phải nói được vì sao.",
    cue: {
      atSec: 251,
      q: {
        type: "mcq",
        prompt: "Công thức x_new = (x_old − mean) / std là phép biến đổi nào, và kết quả có đặc điểm gì?",
        explanation: "Đây là Standardization (z-score): cho trung bình 0 và độ lệch chuẩn 1, giá trị có thể âm và không giới hạn trong [0, 1]. Công thức Min-Max mới dùng x_min và x_max để đưa giá trị về [0, 1].",
        options: [
          T("Normalization (Min-Max) — đưa giá trị về đoạn [0, 1]", false, "norm_vs_std"),
          T("Standardization (z-score) — cho trung bình 0, độ lệch chuẩn 1", true),
          T("One-hot encoding — sinh ra các cột nhị phân 0/1"),
          T("Ordinal encoding — gán số theo thứ tự hạng mục"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 1.8 — Chuẩn hoá đặc trưng số",
      description: "4 câu về Min-Max và z-score.",
      questions: [
        {
          type: "numerical",
          prompt: "Một cột có giá trị nhỏ nhất là 20 và lớn nhất là 60. Sau khi chuẩn hoá Min-Max, giá trị 50 trở thành bao nhiêu? (nhập số thập phân)",
          explanation: "(50 − 20) / (60 − 20) = 30 / 40 = 0.75.",
          extra: { expected: 0.75, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt: "Công thức x_new = (x_old − x_min) / (x_max − x_min) là phép biến đổi nào, và đưa giá trị về khoảng nào?",
          explanation: "Đây là Normalization theo kiểu Min-Max, đưa mọi giá trị về đoạn [0, 1]. Công thức z-score (x − mean)/std mới là Standardization, cho trung bình 0 và độ lệch chuẩn 1 chứ không giới hạn trong [0, 1].",
          options: [
            T("Standardization — cho trung bình 0, độ lệch chuẩn 1", false, "norm_vs_std"),
            T("Normalization (Min-Max) — đưa giá trị về đoạn [0, 1]", true),
            T("One-hot encoding — sinh ra các cột nhị phân 0/1"),
            T("Log transform — nén các giá trị lớn"),
          ],
        },
        {
          type: "true_false",
          prompt: "Sau khi standardization (z-score), một số giá trị có thể âm, như −0.84 và −1.14 trong ví dụ cột grade.",
          explanation: "Đúng — z-score đưa trung bình về 0 nên những giá trị nhỏ hơn trung bình sẽ âm. Còn Min-Max thì mọi giá trị nằm trong [0, 1].",
          options: YES_NO(true),
        },
        {
          type: "numerical",
          prompt: "Một cột có mean = 5 và std = 2. Sau khi standardization (z-score), giá trị x = 9 trở thành bao nhiêu?",
          explanation: "(9 − 5) / 2 = 2.",
          extra: { expected: 2, tolerance: 0.01 },
        },
      ],
    },
  },
  // ───────────────────────── 1.9 ─────────────────────────
  {
    key: "ch1_u09",
    file: "ch1_u09.mp4",
    title: "1.9 Mã hoá đặc trưng hạng mục",
    description: "Ordinal encoding cho hạng mục có thứ tự và one-hot encoding cho hạng mục không có thứ tự.",
    skill: SKILLS_CH1.encoding!,
    body:
      "## 1.9 Mã hoá đặc trưng hạng mục\n\n" +
      "**Sau đơn vị này bạn sẽ:** chọn đúng cách mã hoá một đặc trưng hạng mục thành số.\n\n" +
      "### Cần nhớ\n\n" +
      "| Loại | Cách mã hoá | Ví dụ trên slide |\n" +
      "|---|---|---|\n" +
      "| Ordinal | **Ordinal encoding** — gán số theo thứ tự | XS → 0, S → 1, M → 2, L → 3, XL → 4 |\n" +
      "| Nominal | **One-hot encoding** — mỗi hạng mục một cột 0/1 | black, blue, white, green → 4 cột |\n\n" +
      "- Sau one-hot, mỗi dòng có **đúng một** cột bằng 1.\n" +
      "- Không dùng ordinal encoding cho màu sắc: 0, 1, 2, 3 sẽ tạo ra một thứ tự không có thật.",
    cue: {
      atSec: 229,
      q: {
        type: "mcq",
        prompt: "Với one-hot encoding trên slide (bốn cột ứng với black, blue, white, green), giá trị “green” được mã hoá thành dòng nào?",
        explanation: "Cột thứ tư ứng với green nên green thành (0, 0, 0, 1): đúng một cột bằng 1, các cột còn lại bằng 0.",
        options: [T("(1, 0, 0, 0)"), T("(0, 1, 0, 0)"), T("(0, 0, 1, 0)"), T("(0, 0, 0, 1)", true)],
      },
    },
    quiz: {
      title: "Kiểm tra 1.9 — Mã hoá hạng mục",
      description: "4 câu về ordinal encoding và one-hot encoding.",
      questions: [
        {
          type: "mcq",
          prompt: "Trên slide ordinal encoding, cỡ áo XL được mã hoá thành số nào?",
          explanation: "Thứ tự trên slide là XS → 0, S → 1, M → 2, L → 3, XL → 4.",
          options: [T("1"), T("3"), T("4", true), T("5")],
        },
        {
          type: "mcq",
          prompt: "Vì sao bài giảng dùng ordinal encoding cho cỡ áo (S, M, L) nhưng dùng one-hot encoding cho màu sắc?",
          explanation: "Cỡ áo có thứ tự nên gán 0, 1, 2... phản ánh đúng thứ tự. Màu sắc không có thứ tự — gán 0, 1, 2, 3 sẽ tạo ra thứ tự giả (ví dụ white “lớn hơn” black), nên phải dùng one-hot.",
          options: [
            T("Cỡ áo có thứ tự, còn màu sắc thì không — số hoá màu sẽ tạo thứ tự giả", true),
            T("Màu sắc cần ít cột hơn cỡ áo"),
            T("Ordinal encoding chỉ chạy được với chữ cái viết hoa"),
            T("Dùng ordinal encoding cho màu sắc cũng được, chỉ khác cách viết", false, "ch1_ordinal_for_nominal"),
          ],
        },
        {
          type: "numerical",
          prompt: "Một cột hạng mục có 6 giá trị khác nhau. Sau one-hot encoding, cột đó được thay bằng bao nhiêu cột?",
          explanation: "One-hot tạo một cột nhị phân cho mỗi hạng mục, nên 6 hạng mục cho 6 cột (như 4 màu cho 4 cột trên slide).",
          extra: { expected: 6, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt: "Sau one-hot encoding, mỗi dòng có đúng một cột mang giá trị 1 và các cột còn lại bằng 0.",
          explanation: "Đúng — mỗi dòng thuộc đúng một hạng mục, nên chỉ cột của hạng mục đó bằng 1.",
          options: YES_NO(true),
        },
      ],
    },
  },
  // ───────────────────────── 1.10 ─────────────────────────
  {
    key: "ch1_u10",
    file: "ch1_u10.mp4",
    title: "1.10 Pipeline học máy",
    description: "Chín bước của một quy trình học máy, từ thu thập dữ liệu tới triển khai mô hình.",
    skill: SKILLS_CH1.pipeline!,
    body:
      "## 1.10 Pipeline học máy\n\n" +
      "**Sau đơn vị này bạn sẽ:** kể được thứ tự chín bước của một dự án học máy hoàn chỉnh.\n\n" +
      "### Cần nhớ\n\n" +
      "1. Data collection\n" +
      "2. Statistics\n" +
      "3. Data preprocessing\n" +
      "4. Data visualization\n" +
      "5. Model selection\n" +
      "6. Model training\n" +
      "7. Model validation\n" +
      "8. Model testing\n" +
      "9. Model deployment\n\n" +
      "- Sơ đồ đi theo mũi tên: hàng trên từ trái sang phải, xuống hàng giữa đi từ phải sang trái, xuống hàng dưới lại đi từ trái sang phải.\n" +
      "- Không thể chọn mô hình khi dữ liệu còn bẩn, và không nên triển khai khi chưa kiểm thử.",
    cue: {
      atSec: 176,
      q: {
        type: "mcq",
        prompt: "Theo sơ đồ Machine Learning pipeline, bước nào đứng ngay sau Data preprocessing?",
        explanation: "Mũi tên đi từ Data preprocessing xuống Data visualization, rồi mới tới Model selection.",
        options: [T("Statistics"), T("Data visualization", true), T("Model selection"), T("Model training")],
      },
    },
    quiz: {
      title: "Kiểm tra 1.10 — Pipeline học máy",
      description: "4 câu về thứ tự và số bước của pipeline.",
      questions: [
        {
          type: "ordering",
          prompt: "Sắp xếp chín bước sau theo đúng thứ tự của Machine Learning pipeline trong bài giảng.",
          explanation: "Data collection → Statistics → Data preprocessing → Data visualization → Model selection → Model training → Model validation → Model testing → Model deployment. Không thể chọn mô hình khi dữ liệu còn bẩn, và không thể triển khai khi chưa kiểm thử.",
          options: [
            T("Data collection"),
            T("Statistics"),
            T("Data preprocessing"),
            T("Data visualization"),
            T("Model selection"),
            T("Model training"),
            T("Model validation"),
            T("Model testing"),
            T("Model deployment"),
          ],
        },
        {
          type: "mcq",
          prompt: "Bước cuối cùng của Machine Learning pipeline là gì?",
          explanation: "Sau khi kiểm thử, mô hình được đưa vào sử dụng thực tế ở bước Model deployment.",
          options: [T("Model testing"), T("Model deployment", true), T("Model validation"), T("Data visualization")],
        },
        {
          type: "numerical",
          prompt: "Machine Learning pipeline trong bài giảng gồm bao nhiêu bước?",
          explanation: "Có 9 bước: Data collection, Statistics, Data preprocessing, Data visualization, Model selection, Model training, Model validation, Model testing, Model deployment.",
          extra: { expected: 9, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt: "Bước nào nằm giữa Model training và Model testing trên sơ đồ?",
          explanation: "Thứ tự là Model training → Model validation → Model testing.",
          options: [T("Model selection"), T("Model validation", true), T("Model deployment"), T("Data preprocessing")],
        },
      ],
    },
  },
];

const CAPSTONE_CH1 = {
  title: "Thực hành tổng hợp: Lập kế hoạch tiền xử lý cho một bộ dữ liệu thật",
  description: "Bài thực hành gom các kỹ năng của 10 đơn vị Chapter 1 vào một kế hoạch tiền xử lý cho dữ liệu thật.",
  body:
    "## Thực hành tổng hợp: Lập kế hoạch tiền xử lý\n\n" +
    "Bài này gom kiến thức của Chapter 1 — loại dữ liệu, loại đặc trưng, chất lượng dữ liệu, chuẩn hoá và mã hoá — vào một kế hoạch tiền xử lý cho một bộ dữ liệu thật. Làm sau khi bạn đã hoàn thành các đơn vị 1.1 đến 1.10.\n\n" +
    "Đề bài nằm ở phần **Bài tập** bên dưới.",
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
    pedagogicalIntent: "mapping" as const,
    responseFormat: "text" as const,
  },
};


// ═══════════════════════════ CHAPTER 2 — Các thuật toán học máy cốt lõi ═══════════════════════════

const SKILLS_CH2: Record<string, SkillDef> = {
  linear: { code: "ml.micro.linear_regression", name: "Hồi quy tuyến tính", description: "Khớp đường thẳng (hoặc mặt phẳng) để dự đoán một giá trị số liên tục; phân biệt simple và multiple linear regression." },
  logistic: { code: "ml.micro.logistic_regression", name: "Hồi quy logistic và hàm sigmoid", description: "Hiểu sigmoid cho ra xác suất trong (0, 1), rồi so với ngưỡng để phân lớp." },
  tree: { code: "ml.micro.decision_tree", name: "Cấu trúc cây quyết định", description: "Nhận biết root node, decision node, leaf node và đi theo một nhánh của cây tới kết luận." },
  gini: { code: "ml.micro.gini_impurity", name: "Gini impurity và chọn thuộc tính chia", description: "Tính Gini của một nhánh, Gini có trọng số của một thuộc tính, và chọn thuộc tính có Gini nhỏ nhất." },
  forest: { code: "ml.micro.random_forest", name: "Bootstrapping và Random Forest", description: "Lấy mẫu có hoàn lại để tạo nhiều tập con, huấn luyện mỗi cây trên một tập và tổng hợp dự đoán." },
  svmIdea: { code: "ml.micro.svm_idea", name: "SVM: bài toán chọn đường phân lớp", description: "Hiểu vì sao nhiều đường thẳng cùng tách được hai lớp và cần tiêu chí để chọn ra một đường." },
  svmMargin: { code: "ml.micro.svm_margin", name: "SVM: lề cực đại và support vectors", description: "Siêu phẳng lề cực đại, biên lề, và vai trò của support vectors." },
  svmKernel: { code: "ml.micro.svm_kernel", name: "SVM: kernel trick", description: "Ánh xạ dữ liệu lên không gian nhiều chiều hơn để tách tuyến tính được." },
};

const MIS_CH2: Record<string, { code: string; name: string; description: string }> = {
  ch2_gini_high_better: {
    code: "ml_gini_higher_is_better",
    name: "Nghĩ Gini càng cao càng tốt",
    description: "Học viên cho rằng thuộc tính có Gini lớn nhất là thuộc tính nên chia, trong khi Gini đo độ lẫn tạp nên càng thấp càng thuần khiết.",
  },
  ch2_bootstrap_no_repeat: {
    code: "ml_bootstrap_no_repeat",
    name: "Nghĩ bootstrapping không lặp phần tử",
    description: "Học viên nhầm lấy mẫu có hoàn lại với chia tập hoặc lấy mẫu không hoàn lại, nên cho rằng một phần tử không thể xuất hiện hai lần.",
  },
  ch2_sigmoid_is_label: {
    code: "ml_sigmoid_outputs_label",
    name: "Nghĩ sigmoid cho thẳng nhãn 0 hoặc 1",
    description: "Học viên cho rằng đầu ra của sigmoid chỉ là 0 hoặc 1, bỏ qua bước so xác suất với ngưỡng để ra nhãn.",
  },
  ch2_rf_same_data: {
    code: "ml_forest_same_data",
    name: "Nghĩ mọi cây trong rừng học trên cùng một dữ liệu",
    description: "Học viên cho rằng các cây của Random Forest được huấn luyện trên toàn bộ tập train giống hệt nhau, nên không hiểu vì sao chúng khác nhau.",
  },
  ch2_svm_all_points: {
    code: "ml_svm_all_points_matter",
    name: "Nghĩ mọi điểm đều quyết định siêu phẳng của SVM",
    description: "Học viên cho rằng bỏ bất kỳ điểm nào cũng làm đổi siêu phẳng, thay vì chỉ các support vectors sát biên mới quyết định.",
  },
  ch2_kernel_reduce_dim: {
    code: "ml_kernel_reduces_dimension",
    name: "Nghĩ kernel trick giảm số chiều",
    description: "Học viên hiểu ngược kernel trick: cho rằng nó giảm chiều hoặc bỏ điểm, thay vì nâng dữ liệu lên không gian nhiều chiều hơn.",
  },
};

const UNITS_CH2: Unit[] = [
  // ───────────────────────── 2.1 ─────────────────────────
  {
    key: "ch2_u01",
    file: "ch2_u01.mp4",
    title: "2.1 Hồi quy tuyến tính",
    description: "Khớp một đường thẳng qua dữ liệu lương – kinh nghiệm, rồi mở rộng sang nhiều đặc trưng đầu vào.",
    skill: SKILLS_CH2.linear!,
    body:
      "## 2.1 Hồi quy tuyến tính\n\n" +
      "**Sau đơn vị này bạn sẽ:** giải thích Linear Regression làm gì, và phân biệt hồi quy đơn biến với hồi quy nhiều biến.\n\n" +
      "### Cần nhớ\n\n" +
      "- Linear Regression khớp một **đường thẳng** qua đám điểm để dự đoán một **giá trị số liên tục** — ví dụ mức lương theo số năm kinh nghiệm.\n" +
      "- **Simple** Linear Regression: một đặc trưng đầu vào, mô hình là một đường thẳng.\n" +
      "- **Multiple** Linear Regression: nhiều đặc trưng (ví dụ Experience và Education), mô hình là một mặt phẳng (siêu phẳng).\n\n" +
      "> y = ω₁x₁ + ω₂x₂ + … + ωₚxₚ + ω₀ + ε",
    cue: {
      atSec: 247,
      q: {
        type: "mcq",
        prompt: "Trong ví dụ Salary – Experience vừa xem, Linear Regression được dùng để làm gì?",
        explanation: "Linear Regression khớp một đường thẳng qua đám điểm dữ liệu để dự đoán một giá trị số liên tục — ở đây là mức lương ứng với số năm kinh nghiệm.",
        options: [
          T("Phân loại nhân viên thành hai nhóm Junior và Senior", false, "regression_vs_classification"),
          T("Dự đoán một giá trị số liên tục (mức lương) từ số năm kinh nghiệm", true),
          T("Gom các nhân viên có đặc điểm giống nhau thành cụm"),
          T("Chọn thuộc tính tốt nhất để chia nhánh cây quyết định"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.1 — Hồi quy tuyến tính",
      description: "3 câu về mục đích và dạng của Linear Regression.",
      questions: [
        {
          type: "mcq",
          prompt: "Dự đoán mức lương (một số liên tục) từ số năm kinh nghiệm là loại bài toán nào?",
          explanation: "Đầu ra là một giá trị số liên tục nên đây là bài toán regression, không phải classification.",
          options: [T("Regression", true), T("Classification", false, "regression_vs_classification"), T("Clustering"), T("Reinforcement learning")],
        },
        {
          type: "true_false",
          prompt: "Multiple Linear Regression dùng nhiều đặc trưng đầu vào x₁, x₂, …, xₚ trong cùng một công thức.",
          explanation: "Đúng — công thức y = ω₁x₁ + … + ωₚxₚ + ω₀ + ε có một hệ số ω cho mỗi đặc trưng; với hai đặc trưng mô hình là một mặt phẳng.",
          options: YES_NO(true),
        },
        {
          type: "numerical",
          prompt: "Một mô hình đơn giản y = ω₁x₁ + ω₀ có ω₁ = 2 và ω₀ = 3. Với x₁ = 4, giá trị dự đoán y là bao nhiêu?",
          explanation: "y = 2 · 4 + 3 = 11.",
          extra: { expected: 11, tolerance: 0.01 },
        },
      ],
    },
  },
  // ───────────────────────── 2.2 ─────────────────────────
  {
    key: "ch2_u02",
    file: "ch2_u02.mp4",
    title: "2.2 Hồi quy logistic",
    description: "Hàm sigmoid nén đầu ra về (0, 1) và ngưỡng 0.5 quyết định nhãn Junior hay Senior.",
    skill: SKILLS_CH2.logistic!,
    body:
      "## 2.2 Hồi quy logistic\n\n" +
      "**Sau đơn vị này bạn sẽ:** đọc được đồ thị sigmoid và hiểu vì sao Logistic Regression là thuật toán phân loại.\n\n" +
      "### Cần nhớ\n\n" +
      "- Logistic Regression là bài toán **phân loại**, dù tên có chữ “regression”.\n" +
      "- Nó dùng hàm **sigmoid** 1 / (1 + e^−(ax+b)) để cho ra một **xác suất** trong khoảng (0, 1).\n" +
      "- Sau đó so xác suất với **ngưỡng** (thường 0.5): trên ngưỡng là nhãn 1 (Senior), dưới ngưỡng là nhãn 0 (Junior).\n" +
      "- Chính bước so ngưỡng mới cho ra nhãn 0 hoặc 1, không phải sigmoid.",
    cue: {
      atSec: 192,
      q: {
        type: "mcq",
        prompt: "Hàm sigmoid 1/(1 + e^−(ax+b)) trong Logistic Regression cho đầu ra nằm trong khoảng nào?",
        explanation: "Sigmoid nén mọi giá trị đầu vào về khoảng (0, 1), nên đầu ra đọc được như một xác suất. Sau đó mới so với ngưỡng 0.5 để quyết định nhãn — chính bước so ngưỡng này mới cho ra 0 hoặc 1.",
        options: [
          T("(−∞, +∞) — không giới hạn"),
          T("(0, 1) — hiểu được như một xác suất", true),
          T("Chỉ đúng hai giá trị 0 hoặc 1", false, "ch2_sigmoid_is_label"),
          T("[−1, 1]"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.2 — Hồi quy logistic",
      description: "4 câu về sigmoid, ngưỡng và bản chất phân loại.",
      questions: [
        {
          type: "true_false",
          prompt: "Mặc dù tên có chữ “regression”, Logistic Regression được dùng cho bài toán phân loại.",
          explanation: "Đúng. Logistic Regression cho ra xác suất rồi so ngưỡng để gán nhãn — đó là phân loại.",
          options: [T("Đúng", true), T("Sai", false, "regression_vs_classification")],
        },
        {
          type: "numerical",
          prompt: "Với sigmoid 1 / (1 + e^−z), khi z = 0 thì đầu ra bằng bao nhiêu?",
          explanation: "e^0 = 1 nên đầu ra = 1 / (1 + 1) = 0.5 — đúng bằng mức ngưỡng thường dùng.",
          extra: { expected: 0.5, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt: "Với ngưỡng 0.5, một nhân viên có xác suất Senior do mô hình cho ra là 0.9 sẽ được gán nhãn nào?",
          explanation: "0.9 lớn hơn ngưỡng 0.5 nên nhãn là 1 (Senior).",
          options: [T("0 (Junior)"), T("1 (Senior)", true), T("Không gán được nhãn"), T("Nhãn 0.9")],
        },
        {
          type: "fill_in",
          prompt: "Giá trị 0.5 dùng để so với xác suất đầu ra rồi quyết định nhãn được gọi là gì? (một từ tiếng Việt hoặc tiếng Anh)",
          explanation: "Đó là ngưỡng (threshold): xác suất trên ngưỡng thì gán nhãn 1, dưới ngưỡng thì gán nhãn 0.",
          options: [T("ngưỡng", true), T("threshold", true), T("Ngưỡng", true), T("Threshold", true)],
        },
      ],
    },
  },
  // ───────────────────────── 2.3 ─────────────────────────
  {
    key: "ch2_u03",
    file: "ch2_u03.mp4",
    title: "2.3 Cây quyết định và bài toán duyệt vay",
    description: "Các loại nút trong cây quyết định, rồi bài toán duyệt vay ngân hàng với bốn thuộc tính ứng viên để chia nhánh.",
    skill: SKILLS_CH2.tree!,
    body:
      "## 2.3 Cây quyết định và bài toán duyệt vay\n\n" +
      "**Sau đơn vị này bạn sẽ:** gọi đúng tên các loại nút của cây và đọc được bảng đếm Yes/No khi chia theo từng thuộc tính.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Root node**: nút gốc trên cùng. **Decision node**: nút hỏi một điều kiện. **Leaf node**: nút lá, chứa kết luận cuối (Accept / Reject).\n" +
      "- Đi từ gốc xuống lá theo câu trả lời Yes/No cho ra một dự đoán.\n" +
      "- Ví dụ duyệt vay có 14 mẫu, nhãn `loan_approved`, và bốn thuộc tính: `age`, `income`, `is_student`, `credit_rating`.\n" +
      "- Với mỗi thuộc tính, ta đếm số mẫu Yes/No ở từng nhánh để so sánh độ “thuần” của cách chia.\n\n" +
      "| Chia theo `age` | Yes | No |\n" +
      "|---|---|---|\n" +
      "| young | 2 | 3 |\n" +
      "| middle | 4 | 0 |\n" +
      "| senior | 3 | 2 |",
    cue: {
      atSec: 402,
      q: {
        type: "mcq",
        prompt: "Trong bốn cách chia trên slide (age, income, student, credit), nhánh nào chứa mẫu thuộc đúng một nhãn duy nhất?",
        explanation: "Nhánh middle của age có 4 Yes và 0 No nên chỉ có một nhãn. Các nhánh còn lại của age, income, student và credit đều lẫn cả Yes và No.",
        options: [
          T("Nhánh low của income"),
          T("Nhánh middle của age", true),
          T("Nhánh yes của student"),
          T("Nhánh fair của credit"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.3 — Cây quyết định",
      description: "4 câu về loại nút, đường đi và bảng đếm.",
      questions: [
        {
          type: "mcq",
          prompt: "Trong cây quyết định, nút chứa kết quả cuối cùng (Accept / Reject) được gọi là gì?",
          explanation: "Leaf node là nút lá — nơi cây kết thúc và đưa ra kết luận. Root node là nút gốc trên cùng, decision node là các nút hỏi điều kiện ở giữa.",
          options: [T("Root node (nút gốc)"), T("Decision node (nút quyết định)"), T("Leaf node (nút lá)", true), T("Support vector")],
        },
        {
          type: "mcq",
          prompt: "Trong cây ví dụ tuyển sinh trên slide, nút “bachelor degree ?” nằm ở vị trí nào?",
          explanation: "Đó là nút trên cùng của cây, được slide gắn nhãn Root node (nút gốc).",
          options: [T("Root node (nút gốc)", true), T("Leaf node (nút lá)"), T("Một nhánh của Accept"), T("Support vector")],
        },
        {
          type: "true_false",
          prompt: "Trong ví dụ duyệt vay, cột loan_approved là nhãn mà mô hình cần dự đoán.",
          explanation: "Đúng — age, income, is_student, credit_rating là các đặc trưng đầu vào; loan_approved (yes/no) là nhãn đầu ra.",
          options: YES_NO(true),
        },
        {
          type: "ordering",
          prompt: "Trên cây tuyển sinh ở slide, sắp xếp theo thứ tự đi từ gốc xuống lá dọc đường: bachelor degree = Yes, Excellent degree = No, IELTS = Yes.",
          explanation: "Bắt đầu ở gốc “bachelor degree ?”, trả lời Yes tới “Excellent degree ?”, trả lời No tới “IELTS ?”, trả lời Yes thì tới lá Accept.",
          options: [T("bachelor degree ?"), T("Excellent degree ?"), T("IELTS ?"), T("Accept")],
        },
      ],
    },
  },
  // ───────────────────────── 2.4 ─────────────────────────
  {
    key: "ch2_u04",
    file: "ch2_u04.mp4",
    title: "2.4 Gini impurity",
    description: "Tính Gini của từng nhánh và Gini có trọng số của thuộc tính age để chọn cách chia tốt nhất.",
    skill: SKILLS_CH2.gini!,
    body:
      "## 2.4 Gini impurity\n\n" +
      "**Sau đơn vị này bạn sẽ:** tính được Gini của một nhánh và hiểu vì sao thuật toán chọn thuộc tính có Gini nhỏ nhất.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Gini càng thấp càng tốt.** Gini = 0 nghĩa là nhánh hoàn toàn thuần khiết — mọi mẫu cùng một nhãn, không cần chia tiếp.\n" +
      "- Thuật toán chọn thuộc tính cho Gini có trọng số nhỏ nhất.\n" +
      "- Gini của thuộc tính là trung bình có trọng số của Gini các nhánh, trọng số là tỉ lệ số mẫu của nhánh.\n\n" +
      "> Gini = 1 − Σ (pᵢ)²\n\n" +
      "Chia theo `age`: Gini = (5/14)·0.48 + (4/14)·0 + (5/14)·0.48 = **0.343**.",
    cue: {
      atSec: 227,
      q: {
        type: "mcq",
        prompt: 'Trong ví dụ duyệt vay, nhánh "middle" có 4 mẫu Yes và 0 mẫu No, nên gini = 0. Điều đó có nghĩa là gì?',
        explanation: "Gini = 0 nghĩa là nhánh hoàn toàn thuần khiết: mọi mẫu trong nhánh đều cùng một nhãn. Không còn gì để phân biệt nên không cần chia tiếp — nhánh này thành luôn một nút lá.",
        options: [
          T("Nhánh đó không chứa mẫu dữ liệu nào"),
          T("Nhánh đó hoàn toàn thuần khiết — mọi mẫu cùng một nhãn, không cần chia tiếp", true),
          T("Nhánh đó hỗn tạp nhất, cần ưu tiên chia tiếp", false, "ch2_gini_high_better"),
          T("Dữ liệu trong nhánh đó bị lỗi"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.4 — Gini impurity",
      description: "4 câu về ý nghĩa và cách tính Gini.",
      questions: [
        {
          type: "mcq",
          prompt: "Khi chọn thuộc tính để chia nhánh bằng Gini, thuật toán ưu tiên thuộc tính nào?",
          explanation: "Gini đo độ lẫn tạp nên càng thấp càng thuần khiết. Thuật toán chọn thuộc tính cho Gini có trọng số nhỏ nhất.",
          options: [T("Thuộc tính có Gini có trọng số lớn nhất", false, "ch2_gini_high_better"), T("Thuộc tính có Gini có trọng số nhỏ nhất", true), T("Thuộc tính có nhiều giá trị nhất"), T("Thuộc tính đứng đầu bảng")],
        },
        {
          type: "numerical",
          prompt: "Nhánh “young” của age có 2 mẫu Yes và 3 mẫu No. Tính Gini = 1 − Σ(pᵢ)² của nhánh này. (làm tròn 2 chữ số thập phân)",
          explanation: "p(Yes) = 2/5 = 0.4, p(No) = 3/5 = 0.6. Gini = 1 − (0.16 + 0.36) = 0.48, đúng giá trị ghi trên slide.",
          extra: { expected: 0.48, tolerance: 0.01 },
        },
        {
          type: "numerical",
          prompt: "Nhánh “low” của income có 3 mẫu Yes và 1 mẫu No. Tính Gini của nhánh này. (làm tròn 3 chữ số thập phân)",
          explanation: "p(Yes) = 3/4 = 0.75, p(No) = 1/4 = 0.25. Gini = 1 − (0.5625 + 0.0625) = 0.375.",
          extra: { expected: 0.375, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt: "Trong công thức Gini(age) = (5/14)·0.48 + (4/14)·0 + (5/14)·0.48, các phân số 5/14, 4/14, 5/14 là gì?",
          explanation: "Đó là trọng số: tỉ lệ số mẫu của mỗi nhánh (young 5, middle 4, senior 5) trên tổng 14 mẫu. Nhánh càng nhiều mẫu càng ảnh hưởng nhiều.",
          options: [T("Xác suất Yes của mỗi nhánh"), T("Tỉ lệ số mẫu của mỗi nhánh trên tổng 14 mẫu", true), T("Số lá của mỗi nhánh"), T("Độ sâu của mỗi nhánh")],
        },
      ],
    },
  },
  // ───────────────────────── 2.5 ─────────────────────────
  {
    key: "ch2_u05",
    file: "ch2_u05.mp4",
    title: "2.5 Bootstrapping và Random Forest",
    description: "Từ một cây đơn tới cả khu rừng: lấy mẫu có hoàn lại để tạo nhiều tập con, mỗi cây học một tập.",
    skill: SKILLS_CH2.forest!,
    body:
      "## 2.5 Bootstrapping và Random Forest\n\n" +
      "**Sau đơn vị này bạn sẽ:** mô tả bootstrapping và giải thích Random Forest khác một cây quyết định đơn ở chỗ nào.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Bootstrapping** = lấy mẫu ngẫu nhiên **có hoàn lại** từ tập gốc, nên một phần tử có thể xuất hiện nhiều lần (ví dụ {b, a, b, b}).\n" +
      "- **Random Forest** = nhiều cây quyết định, mỗi cây huấn luyện trên một tập bootstrap khác nhau.\n" +
      "- Dự đoán cuối (Prediction) được tổng hợp từ dự đoán của nhiều cây thay vì tin một cây.\n" +
      "- Nhiều cây khác nhau cùng “bỏ phiếu” giúp mô hình ổn định hơn một cây đơn.",
    cue: {
      atSec: 334,
      q: {
        type: "mcq",
        prompt: "Sơ đồ Random Forest trên slide cho thấy quy trình nào?",
        explanation: "Từ Training set, tạo nhiều tập con; mỗi tập huấn luyện một cây riêng; dự đoán cuối cùng (Prediction) được tổng hợp từ các cây.",
        options: [
          T("Một cây duy nhất huấn luyện trên toàn bộ Training set rồi đưa ra Prediction", false, "ch2_rf_same_data"),
          T("Nhiều tập con từ Training set, mỗi tập huấn luyện một cây, rồi tổng hợp thành Prediction", true),
          T("Training set bị chia thành các phần rời nhau, mỗi phần cho một nhãn khác nhau"),
          T("Mỗi cây được huấn luyện trên kết quả Prediction của cây trước đó"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.5 — Bootstrapping và Random Forest",
      description: "4 câu về lấy mẫu có hoàn lại và cấu trúc khu rừng.",
      questions: [
        {
          type: "mcq",
          prompt: "Bootstrapping tạo ra các tập con bằng cách nào?",
          explanation: "Lấy mẫu ngẫu nhiên CÓ hoàn lại — nên một phần tử có thể xuất hiện nhiều lần trong cùng một tập con, đúng như ví dụ {b, a, b, b} trong bài giảng.",
          options: [
            T("Chia đều tập gốc thành các phần không giao nhau", false, "ch2_bootstrap_no_repeat"),
            T("Lấy mẫu ngẫu nhiên có hoàn lại, nên một phần tử có thể lặp lại", true),
            T("Lấy mẫu ngẫu nhiên không hoàn lại", false, "ch2_bootstrap_no_repeat"),
            T("Sắp xếp tập gốc rồi cắt theo thứ tự"),
          ],
        },
        {
          type: "true_false",
          prompt: "Từ tập gốc {a, b, c, d, e, f, g}, tập con {c, c, f, g} là một kết quả hợp lệ của bootstrapping.",
          explanation: "Đúng — vì lấy mẫu có hoàn lại nên c có thể xuất hiện hai lần, như một trong bốn tập con ở slide.",
          options: [T("Đúng", true), T("Sai", false, "ch2_bootstrap_no_repeat")],
        },
        {
          type: "mcq",
          prompt: "Random Forest khác một Decision Tree đơn ở điểm cơ bản nào?",
          explanation: "Random Forest gồm nhiều cây, mỗi cây học trên một tập bootstrap, và dự đoán được tổng hợp từ tất cả các cây; Decision Tree đơn chỉ có một cây.",
          options: [T("Nó gồm nhiều cây và tổng hợp dự đoán của chúng", true), T("Nó chỉ có một cây nhưng sâu hơn"), T("Nó không dùng dữ liệu huấn luyện"), T("Nó chỉ dùng cho bài toán hồi quy")],
        },
        {
          type: "mcq",
          prompt: "Vì sao các cây trong Random Forest khác nhau, dù cùng một Training set gốc?",
          explanation: "Mỗi cây được huấn luyện trên một tập bootstrap khác nhau (lấy mẫu có hoàn lại), nên chúng học từ các phiên bản khác nhau của dữ liệu.",
          options: [T("Vì mỗi cây được huấn luyện trên một tập bootstrap khác nhau", true), T("Vì các cây học trên cùng một dữ liệu giống hệt nhau", false, "ch2_rf_same_data"), T("Vì mỗi cây có nhãn đầu ra khác nhau"), T("Vì các cây được vẽ bằng màu khác nhau")],
        },
      ],
    },
  },
  // ───────────────────────── 2.6 ─────────────────────────
  {
    key: "ch2_u06",
    file: "ch2_u06.mp4",
    title: "2.6 SVM: chọn đường phân lớp nào",
    description: "Hai đường thẳng khác nhau cùng tách được hai lớp dữ liệu, nên cần một tiêu chí để chọn đường tốt nhất.",
    skill: SKILLS_CH2.svmIdea!,
    body:
      "## 2.6 SVM: chọn đường phân lớp nào\n\n" +
      "**Sau đơn vị này bạn sẽ:** nêu được bài toán mà Support Vector Machine đặt ra trên dữ liệu hai lớp.\n\n" +
      "### Cần nhớ\n\n" +
      "- Dữ liệu ở đây có hai đặc trưng x₁, x₂ và hai lớp (chấm xanh lá, ngôi sao xanh ngọc).\n" +
      "- Có **nhiều hơn một** đường thẳng tách đúng hoàn toàn hai lớp — slide vẽ hai đường (cam và tím).\n" +
      "- Vì vậy chỉ “tách đúng” là chưa đủ: cần thêm một tiêu chí để chọn ra một đường.\n" +
      "- Với dữ liệu 2 chiều ranh giới là đường thẳng; với nhiều chiều hơn ranh giới là siêu phẳng.",
    cue: {
      atSec: 183,
      q: {
        type: "mcq",
        prompt: "Trên slide, đường cam và đường tím đều tách đúng hoàn toàn hai lớp. Điều này cho thấy gì?",
        explanation: "Có nhiều đường thẳng cùng phân tách đúng dữ liệu huấn luyện, nên cần một tiêu chí bổ sung để chọn ra đường tốt nhất — đó là vai trò của SVM.",
        options: [
          T("Chỉ có duy nhất một đường thẳng đúng, đường còn lại là sai"),
          T("Có nhiều đường cùng tách đúng, nên cần một tiêu chí để chọn ra một đường", true),
          T("Dữ liệu này không thể phân tách bằng đường thẳng"),
          T("Hai đường thẳng phải được trung bình lại thành một điểm"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.6 — Bài toán của SVM",
      description: "3 câu về dữ liệu hai lớp và các đường phân tách.",
      questions: [
        {
          type: "true_false",
          prompt: "Với dữ liệu hai lớp tách được như trên slide, có thể có nhiều hơn một đường thẳng phân tách đúng cả hai lớp.",
          explanation: "Đúng — slide vẽ hai đường (cam và tím) đều tách đúng, nên chỉ tách đúng thôi chưa đủ để chọn đường.",
          options: YES_NO(true),
        },
        {
          type: "numerical",
          prompt: "Slide dùng hai trục x₁ và x₂ cho dữ liệu SVM. Mỗi điểm dữ liệu có bao nhiêu đặc trưng?",
          explanation: "Có hai trục x₁, x₂ nên mỗi điểm có 2 đặc trưng.",
          extra: { expected: 2, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt: "Ranh giới phân lớp trong không gian hai chiều (như đồ thị x₁–x₂) là gì?",
          explanation: "Trong 2 chiều, siêu phẳng chính là một đường thẳng; trong 3 chiều nó là một mặt phẳng.",
          options: [T("Một đường thẳng (siêu phẳng 2 chiều)", true), T("Một điểm duy nhất"), T("Một khối lập phương"), T("Không có ranh giới")],
        },
      ],
    },
  },
  // ───────────────────────── 2.7 ─────────────────────────
  {
    key: "ch2_u07",
    file: "ch2_u07.mp4",
    title: "2.7 SVM: lề cực đại và support vectors",
    description: "SVM chọn siêu phẳng có lề lớn nhất; các điểm sát biên (support vectors) quyết định vị trí của nó.",
    skill: SKILLS_CH2.svmMargin!,
    body:
      "## 2.7 SVM: lề cực đại và support vectors\n\n" +
      "**Sau đơn vị này bạn sẽ:** giải thích lề cực đại và vai trò của support vectors.\n\n" +
      "### Cần nhớ\n\n" +
      "- SVM chọn **siêu phẳng** (đường màu hồng trên slide) sao cho **lề** — khoảng giữa hai đường vàng đứt nét — **lớn nhất**.\n" +
      "- **Support vectors** là các điểm nằm sát ranh giới (khoanh đỏ trên slide), chạm vào biên lề.\n" +
      "- Chính support vectors quyết định vị trí siêu phẳng và độ rộng lề.\n" +
      "- Bỏ một điểm ở xa ranh giới thì siêu phẳng không đổi; bỏ một support vector thì đổi.",
    cue: {
      atSec: 314,
      q: {
        type: "mcq",
        prompt: "Support vectors trong SVM là những điểm nào?",
        explanation: "Support vectors là các điểm nằm sát ranh giới phân lớp — chính chúng xác định vị trí siêu phẳng và độ rộng của lề. Bỏ đi một điểm ở xa thì siêu phẳng không đổi; bỏ một support vector thì đổi.",
        options: [
          T("Toàn bộ điểm dữ liệu trong tập huấn luyện", false, "ch2_svm_all_points"),
          T("Các điểm nằm sát ranh giới, quyết định vị trí siêu phẳng và độ rộng lề", true),
          T("Các điểm nằm xa ranh giới nhất"),
          T("Các điểm bị mô hình phân loại sai"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.7 — Lề cực đại và support vectors",
      description: "4 câu về lề, biên và support vectors.",
      questions: [
        {
          type: "mcq",
          prompt: "Nếu xoá một điểm nằm xa ranh giới (không phải support vector), siêu phẳng của SVM thay đổi thế nào?",
          explanation: "Siêu phẳng chỉ phụ thuộc vào các support vectors. Xoá một điểm ở xa không làm đổi nó.",
          options: [T("Không đổi", true), T("Luôn dịch chuyển một chút", false, "ch2_svm_all_points"), T("Biến mất", false, "ch2_svm_all_points"), T("Trở thành một đường cong")],
        },
        {
          type: "true_false",
          prompt: "SVM tìm siêu phẳng sao cho lề giữa hai lớp (khoảng giữa hai đường vàng đứt nét) là lớn nhất.",
          explanation: "Đúng — đó là ý tưởng lề cực đại (maximum margin) của SVM.",
          options: YES_NO(true),
        },
        {
          type: "numerical",
          prompt: "Trên slide, có bao nhiêu điểm được khoanh tròn đỏ là support vectors?",
          explanation: "Có 3 điểm được khoanh đỏ: hai chấm xanh lá và một ngôi sao xanh ngọc.",
          extra: { expected: 3, tolerance: 0.01 },
        },
        {
          type: "fill_in",
          prompt: "Tên gọi của các điểm nằm sát ranh giới, quyết định vị trí siêu phẳng của SVM là gì? (tiếng Anh, hai từ)",
          explanation: "Đó là support vectors — các điểm chạm biên lề.",
          options: [T("support vectors", true), T("support vector", true), T("Support Vectors", true), T("Support Vector", true)],
        },
      ],
    },
  },
  // ───────────────────────── 2.8 ─────────────────────────
  {
    key: "ch2_u08",
    file: "ch2_u08.mp4",
    title: "2.8 SVM: kernel trick",
    description: "Khi dữ liệu không tách được bằng đường thẳng, nâng nó lên không gian nhiều chiều hơn để tách bằng siêu phẳng.",
    skill: SKILLS_CH2.svmKernel!,
    body:
      "## 2.8 SVM: kernel trick\n\n" +
      "**Sau đơn vị này bạn sẽ:** giải thích kernel trick giúp SVM xử lý dữ liệu không tách tuyến tính thế nào.\n\n" +
      "### Cần nhớ\n\n" +
      "- Có dữ liệu mà hai lớp không thể tách bằng một đường thẳng trong không gian gốc (lớp này nằm giữa, bao quanh bởi lớp kia).\n" +
      "- **Kernel trick** ánh xạ dữ liệu lên một không gian **nhiều chiều hơn** (ví dụ từ mặt phẳng 2D lên khối 3D).\n" +
      "- Ở không gian mới, một **siêu phẳng** (mặt phẳng vàng trên slide) có thể tách hai lớp.\n" +
      "- Kernel trick **tăng** chiều để tách được, không phải giảm chiều hay bỏ điểm.",
    cue: {
      atSec: 237,
      q: {
        type: "mcq",
        prompt: "Mũi tên từ mặt phẳng bên trái sang khối lập phương bên phải trên slide biểu thị điều gì?",
        explanation: "Đó là bước ánh xạ dữ liệu lên không gian nhiều chiều hơn (2D lên 3D), nơi hai lớp có thể tách bằng một siêu phẳng — chính là kernel trick.",
        options: [
          T("Ánh xạ dữ liệu lên không gian nhiều chiều hơn để tách bằng siêu phẳng", true),
          T("Giảm số chiều của dữ liệu xuống còn một chiều", false, "ch2_kernel_reduce_dim"),
          T("Loại bỏ các điểm khó phân loại khỏi tập dữ liệu", false, "ch2_kernel_reduce_dim"),
          T("Chuyển dữ liệu sang cây quyết định"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 2.8 — Kernel trick",
      description: "4 câu về dữ liệu không tách tuyến tính và kernel trick.",
      questions: [
        {
          type: "mcq",
          prompt: "Ở mặt phẳng bên trái của slide, vì sao không thể tách hai lớp bằng một đường thẳng?",
          explanation: "Các chấm xanh lá nằm ở giữa và bị các ngôi sao bao quanh, nên không đường thẳng nào tách được hai lớp trong không gian 2 chiều này.",
          options: [T("Vì các chấm xanh lá nằm ở giữa và bị các ngôi sao bao quanh", true), T("Vì chỉ có một lớp dữ liệu"), T("Vì dữ liệu chưa được chuẩn hoá"), T("Vì đường thẳng chỉ dùng được trong 3 chiều")],
        },
        {
          type: "true_false",
          prompt: "Kernel trick giúp SVM bằng cách giảm số chiều của dữ liệu.",
          explanation: "Sai — kernel trick nâng dữ liệu lên không gian nhiều chiều hơn để tách được bằng siêu phẳng.",
          options: [T("Đúng", false, "ch2_kernel_reduce_dim"), T("Sai", true)],
        },
        {
          type: "mcq",
          prompt: "Trong không gian 3 chiều ở slide, ranh giới tách hai lớp có dạng gì?",
          explanation: "Trong 3 chiều, siêu phẳng là một mặt phẳng — miếng màu vàng trên slide tách các ngôi sao phía trên khỏi các chấm xanh lá phía dưới.",
          options: [T("Một mặt phẳng (siêu phẳng)", true), T("Một đường thẳng"), T("Một điểm"), T("Một vòng tròn")],
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các bước SVM xử lý dữ liệu không tách tuyến tính bằng kernel trick.",
          explanation: "Trước hết dữ liệu gốc không tách được; ánh xạ lên không gian nhiều chiều hơn; tìm siêu phẳng tách hai lớp ở đó; rồi dùng siêu phẳng này để phân lớp.",
          options: [T("Nhận thấy dữ liệu 2D không tách được bằng đường thẳng"), T("Ánh xạ dữ liệu lên không gian nhiều chiều hơn (ví dụ 3D)"), T("Tìm siêu phẳng tách hai lớp trong không gian mới"), T("Dùng siêu phẳng đó để phân lớp")],
        },
      ],
    },
  },
];

const CAPSTONE_CH2 = {
  title: "Thực hành tổng hợp: Chọn thuật toán cho bài toán của bạn",
  description: "Bài thực hành gom các thuật toán của 8 đơn vị vào một lập luận chọn thuật toán cho bài toán thực tế.",
  body:
    "## Thực hành tổng hợp: Chọn thuật toán cho bài toán của bạn\n\n" +
    "Bài này gom các thuật toán bạn đã học — Linear Regression, Logistic Regression, Decision Tree, Random Forest và SVM — vào một bài lập luận chọn thuật toán. Làm sau khi bạn đã hoàn thành các đơn vị 2.1 đến 2.8.\n\n" +
    "Đề bài nằm ở phần **Bài tập** bên dưới.",
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
    pedagogicalIntent: "self_explaining" as const,
    responseFormat: "text" as const,
  },
};


const SKILLS_CH3: Record<string, SkillDef> = {
  imbalance: {
    code: "ml.micro.accuracy_imbalance",
    name: "Accuracy và dữ liệu mất cân bằng",
    description: "Hiểu bài toán phân loại nhị phân, tính accuracy, và biết vì sao accuracy cao có thể đánh lừa khi dữ liệu mất cân bằng.",
  },
  confusion: {
    code: "ml.micro.confusion_matrix",
    name: "Ma trận nhầm lẫn",
    description: "Đọc ma trận nhầm lẫn 2×2: TP, FP, FN, TN và lỗi loại I, loại II.",
  },
  prf: {
    code: "ml.micro.precision_recall_f1",
    name: "Precision, Recall và F1 score",
    description: "Tính và diễn giải Precision, Recall và F1 từ ma trận nhầm lẫn.",
  },
  mae: {
    code: "ml.micro.mae",
    name: "Sai số tuyệt đối trung bình (MAE)",
    description: "Tính và diễn giải Mean Absolute Error cho bài toán hồi quy.",
  },
  r2: {
    code: "ml.micro.r_squared",
    name: "Hệ số xác định R²",
    description: "Hiểu R² như phép so sánh sai số của mô hình với sai số của baseline luôn đoán giá trị trung bình.",
  },
};

const MIS_CH3: Record<string, { code: string; name: string; description: string }> = {
  ch3_fp_fn_swap: {
    code: "ml_fp_fn_swap",
    name: "Nhầm False Positive với False Negative",
    description: "Học viên đảo vai trò của dự đoán và thực tế khi gọi tên ô của ma trận nhầm lẫn (nhầm lỗi loại I với loại II).",
  },
  ch3_precision_recall_swap: {
    code: "ml_precision_recall_swap",
    name: "Nhầm mẫu số của Precision và Recall",
    description: "Học viên dùng TP+FN làm mẫu số của Precision hoặc TP+FP làm mẫu số của Recall.",
  },
  ch3_f1_arithmetic_mean: {
    code: "ml_f1_arithmetic_mean",
    name: "Coi F1 là trung bình cộng của Precision và Recall",
    description: "Học viên tính F1 bằng (P+R)/2 thay vì 2PR/(P+R), nên không thấy F1 bị kéo xuống khi một chỉ số thấp.",
  },
};

const UNITS_CH3: Unit[] = [
  // ───────────────────────── 3.1 ─────────────────────────
  {
    key: "ch3_u01",
    file: "ch3_u01.mp4",
    title: "3.1 Accuracy và dữ liệu mất cân bằng",
    description: "Bài toán phân loại nhị phân, cách tính accuracy, và vì sao accuracy 99% vẫn có thể là mô hình vô dụng.",
    skill: SKILLS_CH3.imbalance!,
    body:
      "## 3.1 Accuracy và dữ liệu mất cân bằng\n\n" +
      "**Sau đơn vị này bạn sẽ:** tính được accuracy của một mô hình phân loại và nhận ra khi nào con số đó đánh lừa.\n\n" +
      "### Cần nhớ\n\n" +
      "- **Binary classification**: mô hình gán mỗi mẫu vào một trong hai lớp (ví dụ dog / cat); ta đánh giá bằng cách đối chiếu **nhãn dự đoán** với **nhãn thật**.\n" +
      "- **Accuracy** = tỉ lệ dự đoán đúng trên tổng số mẫu.\n" +
      "- Dữ liệu **mất cân bằng** có một lớp chiếm áp đảo (**majority class**) và một lớp rất hiếm (**minority class**) — ví dụ 99% giao dịch bình thường, 1% gian lận.\n" +
      "- Mô hình luôn đoán “bình thường” đạt accuracy 99% nhưng bắt được **0 vụ gian lận** — accuracy cao không có nghĩa là mô hình tốt.",
    cue: {
      atSec: 262,
      q: {
        type: "mcq",
        prompt:
          "Tập dữ liệu giao dịch có 99% bình thường và 1% gian lận. Một mô hình luôn dự đoán “bình thường” sẽ đạt accuracy bao nhiêu, và vì sao đó vẫn là mô hình tồi?",
        explanation:
          "Accuracy 99% vì nó đúng với toàn bộ 99% giao dịch bình thường. Nhưng nó không bắt được một vụ gian lận nào — mà gian lận mới chính là thứ ta cần tìm. Đây là cái bẫy kinh điển của dữ liệu mất cân bằng.",
        options: [
          T("99% — và đây là một mô hình tốt vì accuracy rất cao", false, "accuracy_always_good"),
          T("99% — nhưng vô dụng vì không phát hiện được vụ gian lận nào (lớp thiểu số)", true),
          T("1% — vì chỉ đoán đúng lớp thiểu số"),
          T("50% — vì bài toán có hai lớp"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.1 — Accuracy và dữ liệu mất cân bằng",
      description: "4 câu về phân loại nhị phân, accuracy và dữ liệu mất cân bằng.",
      questions: [
        {
          type: "numerical",
          prompt:
            "Trong ví dụ 7 ảnh dog/cat ở đầu bài, mô hình dự đoán: dog, cat, dog, dog, cat, cat, dog; nhãn thật là: dog, dog, cat, dog, cat, dog, dog. Tính accuracy (tỉ lệ dự đoán đúng, làm tròn 2 chữ số thập phân).",
          explanation:
            "So từng vị trí: đúng ở ảnh 1, 4, 5, 7 (4 ảnh), sai ở ảnh 2, 3, 6. Accuracy = 4/7 ≈ 0.57.",
          extra: { expected: 0.57, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt: "Trên một tập dữ liệu mất cân bằng nghiêm trọng, accuracy vẫn là chỉ số đáng tin cậy nhất để đánh giá mô hình.",
          explanation:
            "Sai. Chính trên dữ liệu mất cân bằng thì accuracy đánh lừa mạnh nhất — mô hình chỉ cần luôn đoán lớp đa số là đã có accuracy rất cao.",
          options: [T("Đúng", false, "accuracy_always_good"), T("Sai", true)],
        },
        {
          type: "fill_in",
          prompt: "Trong biểu đồ giao dịch, lớp “normal” chiếm 99% được slide gọi là majority class. Vậy lớp “fraudulent” chiếm 1% là lớp gì? (điền một từ: đa số hoặc thiểu số)",
          explanation: "Lớp chiếm tỉ lệ rất nhỏ là minority class — lớp thiểu số. Đây thường là lớp ta quan tâm nhất (gian lận, bệnh…).",
          options: [T("thiểu số", true), T("lớp thiểu số", true), T("minority", true), T("minority class", true)],
        },
        {
          type: "mcq",
          prompt: "Bài toán đoán mỗi ảnh là “dog” hay “cat” thuộc loại nào?",
          explanation:
            "Đầu ra là một nhãn thuộc hai lớp rời rạc nên đây là phân loại nhị phân (binary classification). Hồi quy mới là dự đoán giá trị liên tục như giá nhà.",
          options: [
            T("Hồi quy (regression)", false, "regression_vs_classification"),
            T("Phân loại nhị phân (binary classification)", true),
            T("Gom cụm (clustering)"),
            T("Học tăng cường (reinforcement learning)"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 3.2 ─────────────────────────
  {
    key: "ch3_u02",
    file: "ch3_u02.mp4",
    title: "3.2 Ma trận nhầm lẫn (Confusion Matrix)",
    description: "Bốn ô TP, FP, FN, TN của ma trận nhầm lẫn và cách gọi tên từng loại dự đoán.",
    skill: SKILLS_CH3.confusion!,
    body:
      "## 3.2 Ma trận nhầm lẫn (Confusion Matrix)\n\n" +
      "**Sau đơn vị này bạn sẽ:** xếp được từng dự đoán vào đúng ô TP, FP, FN hay TN.\n\n" +
      "### Cần nhớ\n\n" +
      "| | Dự đoán + | Dự đoán − |\n" +
      "|---|---|---|\n" +
      "| **Thực tế +** | TP — True Positive | FN — False Negative (lỗi loại II) |\n" +
      "| **Thực tế −** | FP — False Positive (lỗi loại I) | TN — True Negative |\n\n" +
      "- Lớp **+** là lớp ta quan tâm; lớp **−** là lớp còn lại.\n" +
      "- Từ đầu (**True/False**) cho biết dự đoán đúng hay sai; từ sau (**Positive/Negative**) là điều mô hình **dự đoán**.\n" +
      "- **FP** (báo nhầm) = lỗi loại I; **FN** (bỏ sót) = lỗi loại II.",
    cue: {
      atSec: 272,
      q: {
        type: "mcq",
        prompt:
          "Mô hình dự đoán một bức ảnh là “dog” (lớp +) nhưng thực tế đó là “cat”. Trường hợp này gọi là gì?",
        explanation:
          "Dự đoán dương (+) nhưng thực tế âm (−) là False Positive, còn gọi là lỗi loại I (Type I error). Ngược lại, dự đoán âm mà thực tế dương là False Negative — lỗi loại II.",
        options: [
          T("True Positive"),
          T("True Negative"),
          T("False Positive (lỗi loại I)", true),
          T("False Negative (lỗi loại II)", false, "ch3_fp_fn_swap"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.2 — Ma trận nhầm lẫn",
      description: "4 câu xếp dự đoán vào các ô của ma trận nhầm lẫn.",
      questions: [
        {
          type: "mcq",
          prompt:
            "Mô hình dự đoán một ảnh là “cat” (lớp −) nhưng thực tế đó là “dog” (lớp +). Đây là ô nào của ma trận nhầm lẫn?",
          explanation:
            "Dự đoán âm nhưng thực tế dương: mô hình bỏ sót một mẫu dương thật — False Negative, lỗi loại II.",
          options: [
            T("True Positive"),
            T("False Positive (lỗi loại I)", false, "ch3_fp_fn_swap"),
            T("False Negative (lỗi loại II)", true),
            T("True Negative"),
          ],
        },
        {
          type: "numerical",
          prompt:
            "Với 7 ảnh: dự đoán = dog, cat, dog, dog, cat, cat, dog; thực tế = dog, dog, cat, dog, cat, dog, dog (dog là lớp +). Có bao nhiêu ảnh là True Positive (dự đoán dog và thực tế dog)?",
          explanation: "Ảnh 1, 4 và 7 đều dự đoán dog và thực tế dog, nên TP = 3.",
          extra: { expected: 3, tolerance: 0.01 },
        },
        {
          type: "numerical",
          prompt:
            "Vẫn 7 ảnh trên (dự đoán = dog, cat, dog, dog, cat, cat, dog; thực tế = dog, dog, cat, dog, cat, dog, dog). Có bao nhiêu ảnh là False Negative?",
          explanation: "False Negative là dự đoán cat nhưng thực tế dog: ảnh 2 và ảnh 6, nên FN = 2.",
          extra: { expected: 2, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt: "False Positive được gọi là lỗi loại I (Type I error), còn False Negative là lỗi loại II (Type II error).",
          explanation: "Đúng — đúng như ghi chú màu đỏ trên ma trận: FP là Type I error, FN là Type II error.",
          options: YES_NO(true),
        },
      ],
    },
  },
  // ───────────────────────── 3.3 ─────────────────────────
  {
    key: "ch3_u03",
    file: "ch3_u03.mp4",
    title: "3.3 Precision, Recall và F1 score",
    description: "Ba chỉ số rút ra từ ma trận nhầm lẫn: Precision, Recall, F1 và bảng công thức tổng hợp.",
    skill: SKILLS_CH3.prf!,
    body:
      "## 3.3 Precision, Recall và F1 score\n\n" +
      "**Sau đơn vị này bạn sẽ:** tính được Precision, Recall, F1 từ ma trận nhầm lẫn và biết mỗi chỉ số trả lời câu hỏi gì.\n\n" +
      "### Cần nhớ\n\n" +
      "| Chỉ số | Công thức |\n" +
      "|---|---|\n" +
      "| Accuracy | (TP + TN) / All |\n" +
      "| Precision | TP / (TP + FP) |\n" +
      "| Recall | TP / (TP + FN) |\n" +
      "| F1 score | 2 × P × R / (P + R) |\n\n" +
      "- **Precision**: trong các mẫu mô hình báo là dương, bao nhiêu phần đúng là dương.\n" +
      "- **Recall**: trong các mẫu thật sự dương, mô hình tìm được bao nhiêu phần.\n" +
      "- **F1** gộp hai chỉ số bằng công thức 2PR/(P+R) nên nếu một trong hai thấp thì F1 bị kéo xuống mạnh — khác trung bình cộng.",
    cue: {
      atSec: 274,
      q: {
        type: "mcq",
        prompt:
          "Một mô hình có Precision = 1.0 nhưng Recall = 0. Dùng công thức F1 = 2 × P × R / (P + R), F1 của nó bằng bao nhiêu, và trung bình cộng (P+R)/2 sẽ cho bao nhiêu?",
        explanation:
          "F1 = 2 × 1.0 × 0 / (1.0 + 0) = 0, trong khi trung bình cộng vẫn là 0.5. Vì công thức F1 bị kéo xuống mạnh khi một trong hai chỉ số thấp nên nó không cho phép “giấu” một chỉ số kém.",
        options: [
          T("F1 = 0.5 và trung bình cộng = 0.5", false, "ch3_f1_arithmetic_mean"),
          T("F1 = 0 và trung bình cộng = 0.5", true),
          T("F1 = 1.0 và trung bình cộng = 0.5"),
          T("F1 = 0 và trung bình cộng = 0"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.3 — Precision, Recall và F1",
      description: "4 câu tính và diễn giải Precision, Recall.",
      questions: [
        {
          type: "numerical",
          prompt:
            "Một mô hình cho TP = 30, FP = 12, FN = 24, TN = 88. Tính Precision = TP/(TP+FP). (làm tròn 2 chữ số thập phân)",
          explanation: "Precision = 30/(30+12) = 30/42 ≈ 0.71.",
          extra: { expected: 0.71, tolerance: 0.01 },
        },
        {
          type: "numerical",
          prompt:
            "Vẫn với TP = 30, FP = 12, FN = 24, TN = 88. Tính Recall = TP/(TP+FN). (làm tròn 2 chữ số thập phân)",
          explanation: "Recall = 30/(30+24) = 30/54 ≈ 0.56. Recall thấp hơn precision nghĩa là mô hình bỏ sót nhiều ca dương thật.",
          extra: { expected: 0.56, tolerance: 0.01 },
        },
        {
          type: "mcq",
          prompt:
            "Một mô hình chẩn đoán ung thư có precision cao nhưng recall thấp. Điều đó nghĩa là gì trên thực tế?",
          explanation:
            "Recall = TP/(TP+FN) thấp nghĩa là FN cao — bỏ sót nhiều ca bệnh thật. Trong y tế đây là loại lỗi nguy hiểm nhất, nên bài toán sàng lọc bệnh thường ưu tiên recall hơn precision.",
          options: [
            T("Mô hình báo động nhầm rất nhiều ca khoẻ mạnh", false, "ch3_precision_recall_swap"),
            T("Khi mô hình báo có bệnh thì thường đúng, nhưng nó bỏ sót nhiều ca bệnh thật", true),
            T("Mô hình hoạt động tốt đều ở cả hai mặt"),
            T("Mô hình không dự đoán được lớp âm"),
          ],
        },
        {
          type: "fill_in",
          prompt: "Theo bảng công thức tổng hợp, mẫu số của Recall là TP + ? (điền tên ô của ma trận nhầm lẫn, ví dụ FP hoặc TN)",
          explanation: "Recall = TP / (TP + FN): mẫu số là toàn bộ mẫu thật sự dương, gồm TP và FN. (Mẫu số của Precision mới là TP + FP.)",
          options: [T("FN", true), T("fn", true), T("False Negative", true)],
        },
      ],
    },
  },
  // ───────────────────────── 3.4 ─────────────────────────
  {
    key: "ch3_u04",
    file: "ch3_u04.mp4",
    title: "3.4 Sai số tuyệt đối trung bình (MAE)",
    description: "Đánh giá mô hình hồi quy bằng Mean Absolute Error qua ví dụ dự đoán giá ba căn nhà.",
    skill: SKILLS_CH3.mae!,
    body:
      "## 3.4 Sai số tuyệt đối trung bình (MAE)\n\n" +
      "**Sau đơn vị này bạn sẽ:** tính và diễn giải Mean Absolute Error cho bài toán hồi quy.\n\n" +
      "### Cần nhớ\n\n" +
      "- Hồi quy dự đoán giá trị liên tục (ví dụ giá nhà) nên không dùng được ma trận nhầm lẫn; ta đo **độ lệch** giữa giá trị thật và giá trị dự đoán.\n" +
      "- **MAE** = (|sai số 1| + |sai số 2| + … ) / số mẫu. Ví dụ ba căn nhà: MAE = (|e₁| + |e₂| + |e₃|) / 3.\n" +
      "- Lấy **trị tuyệt đối** để sai số dương và âm không triệt tiêu nhau.\n" +
      "- MAE cùng đơn vị với giá trị cần dự đoán (ở ví dụ là tỷ đồng), nên dễ diễn giải: “trung bình dự đoán lệch bấy nhiêu”.",
    cue: {
      atSec: 278,
      q: {
        type: "mcq",
        prompt:
          "Trong bài toán hồi quy dự đoán giá nhà, Mean Absolute Error (MAE) được tính thế nào?",
        explanation:
          "MAE lấy trị tuyệt đối của chênh lệch giữa giá trị thật và giá trị dự đoán ở từng điểm, rồi lấy trung bình — đúng như công thức chia 3 trong ví dụ ba căn nhà.",
        options: [
          T("Tổng bình phương chênh lệch giữa giá trị thật và dự đoán"),
          T("Trung bình của trị tuyệt đối chênh lệch giữa giá trị thật và dự đoán", true),
          T("Chênh lệch lớn nhất giữa giá trị thật và dự đoán"),
          T("Tỉ lệ phần trăm số dự đoán đúng", false, "accuracy_always_good"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.4 — MAE",
      description: "4 câu tính và diễn giải MAE.",
      questions: [
        {
          type: "numerical",
          prompt:
            "Mô hình dự đoán giá ba căn nhà, sai số (giá thật − giá dự đoán) lần lượt là +1, −0,5 và −1,5 (đơn vị: tỷ đồng). Tính MAE.",
          explanation: "MAE = (|+1| + |−0,5| + |−1,5|) / 3 = (1 + 0,5 + 1,5) / 3 = 1 (tỷ đồng).",
          extra: { expected: 1, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt:
            "Nếu bỏ dấu trị tuyệt đối trong công thức MAE, thì sai số +1 tỷ ở căn nhà này và −1 tỷ ở căn nhà kia sẽ triệt tiêu nhau khi cộng lại.",
          explanation: "Đúng — (+1) + (−1) = 0 dù cả hai dự đoán đều lệch 1 tỷ. Trị tuyệt đối biến cả hai thành +1 nên không bị bù trừ.",
          options: YES_NO(true),
        },
        {
          type: "mcq",
          prompt: "MAE của mô hình dự đoán giá nhà (giá tính bằng tỷ đồng) được đo bằng đơn vị nào?",
          explanation: "MAE là trung bình của các độ lệch tuyệt đối nên cùng đơn vị với giá trị dự đoán — ở đây là tỷ đồng.",
          options: [T("Phần trăm (%)"), T("Tỷ đồng, cùng đơn vị với giá nhà", true), T("Không có đơn vị, luôn nằm trong khoảng 0 đến 1"), T("Tỷ đồng bình phương")],
        },
        {
          type: "mcq",
          prompt: "MAE dùng cho loại bài toán nào?",
          explanation: "Slide đánh dấu MAE với ghi chú Regression: MAE đo độ lệch của giá trị liên tục nên dùng cho hồi quy, còn phân loại dùng accuracy, precision, recall, F1.",
          options: [
            T("Hồi quy — dự đoán giá trị liên tục như giá nhà", true),
            T("Phân loại — dự đoán nhãn như dog/cat", false, "regression_vs_classification"),
            T("Cả hai như nhau"),
            T("Chỉ dùng cho dữ liệu mất cân bằng"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 3.5 ─────────────────────────
  {
    key: "ch3_u05",
    file: "ch3_u05.mp4",
    title: "3.5 Hệ số xác định R²",
    description: "R² so sánh sai số của mô hình với sai số của baseline luôn đoán giá trị trung bình.",
    skill: SKILLS_CH3.r2!,
    body:
      "## 3.5 Hệ số xác định R²\n\n" +
      "**Sau đơn vị này bạn sẽ:** giải thích được R² đo điều gì và đọc được giá trị của nó.\n\n" +
      "### Cần nhớ\n\n" +
      "- **R² = 1 − (sai số của mô hình) / (sai số của baseline)**.\n" +
      "- Tử số: các đoạn nối giá trị thật với **đường dự đoán** của mô hình (ô nét liền).\n" +
      "- Mẫu số: các đoạn nối giá trị thật với **đường trung bình** — baseline luôn đoán bằng giá trị trung bình (ô nét đứt).\n" +
      "- Mô hình dự đoán hoàn hảo ⇒ tử số = 0 ⇒ **R² = 1**; mô hình không hơn baseline ⇒ tử số = mẫu số ⇒ **R² = 0**.",
    cue: {
      atSec: 137,
      q: {
        type: "mcq",
        prompt:
          "Trong công thức R² = 1 − (tử số)/(mẫu số) trên slide, các ô nét liền ở tử số ứng với những đoạn thẳng nào?",
        explanation:
          "Tử số dùng các đoạn nối giá trị thật (Actual) tới đường dự đoán (Predicted) của mô hình — tức sai số của mô hình. Mẫu số dùng các đoạn nét đứt nối giá trị thật tới đường Mean, tức sai số của baseline “luôn đoán trung bình”.",
        options: [
          T("Các đoạn nối giá trị thật tới đường dự đoán của mô hình", true),
          T("Các đoạn nối giá trị thật tới đường trung bình (Mean)"),
          T("Khoảng cách giữa ba căn nhà trên trục hoành"),
          T("Chênh lệch giữa căn nhà đắt nhất và rẻ nhất"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.5 — R²",
      description: "4 câu về ý nghĩa và giá trị của R².",
      questions: [
        {
          type: "numerical",
          prompt: "Nếu mô hình dự đoán đúng hoàn toàn mọi điểm (tử số bằng 0), R² = 1 − 0/(mẫu số) bằng bao nhiêu?",
          explanation: "Tử số bằng 0 nên R² = 1 − 0 = 1: mô hình hoàn hảo.",
          extra: { expected: 1, tolerance: 0.01 },
        },
        {
          type: "numerical",
          prompt: "Nếu mô hình chỉ tốt bằng baseline luôn đoán giá trị trung bình (tử số bằng mẫu số), R² bằng bao nhiêu?",
          explanation: "Tử số = mẫu số nên tỉ số bằng 1 và R² = 1 − 1 = 0: mô hình không hơn gì việc luôn đoán trung bình.",
          extra: { expected: 0, tolerance: 0.01 },
        },
        {
          type: "fill_in",
          prompt: "Trong hình bên phải của slide R², đường ngang màu tím (Mean) là baseline luôn đoán bằng giá trị nào?",
          explanation: "Đó là đường trung bình của các giá trị thật (Mean). R² so sánh sai số của mô hình với sai số của baseline này.",
          options: [T("trung bình", true), T("giá trị trung bình", true), T("mean", true)],
        },
        {
          type: "true_false",
          prompt: "Khi các đoạn sai số của mô hình (tử số) nhỏ hơn nhiều so với các đoạn sai số tới đường trung bình (mẫu số), R² sẽ gần 1.",
          explanation: "Đúng — tỉ số tử/mẫu gần 0 nên R² = 1 − (số gần 0) gần 1, nghĩa là mô hình tốt hơn baseline rất nhiều.",
          options: YES_NO(true),
        },
      ],
    },
  },
];

const CAPSTONE_CH3 = {
  title: "Thực hành tổng hợp: Chọn chỉ số đánh giá cho ba tình huống",
  description: "Chọn chỉ số phù hợp (accuracy, precision, recall, F1, MAE, R²) cho ba bài toán thực tế và giải thích cái giá của lựa chọn sai.",
  body:
    "## Thực hành tổng hợp: Chọn chỉ số đánh giá\n\n" +
    "Bài này gom kiến thức của các đơn vị 3.1 đến 3.5: accuracy và dữ liệu mất cân bằng, ma trận nhầm lẫn, precision / recall / F1, và các chỉ số hồi quy MAE, R². Làm sau khi bạn đã hoàn thành cả năm đơn vị.\n\n" +
    "Đề bài nằm ở phần **Bài tập** bên dưới.",
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
    pedagogicalIntent: "self_explaining" as const,
    responseFormat: "text" as const,
  },
};


// ─────────────────────────────────────────────────────────────────────────
// Thực hành (Practical session.mp4, 27:50) — 6 đơn vị 3.T1 … 3.T6
// Video là bản ghi màn hình Jupyter Notebook trên bộ dữ liệu diabetes.csv.
// Ranh giới cắt theo từng bước công việc (mốc tuyệt đối, giây):
//   u01   0–381   Excel + nạp CSV + tách x, y
//   u02 381–618   train_test_split: test_size, random_state (chưa chạy)
//   u03 618–868   chạy phép chia, x_train/x_test, thí nghiệm bỏ random_state
//   u04 868–1188  StandardScaler (fit_transform / transform)
//   u05 1188–1392 RandomForestClassifier: fit, predict, gọi classification_report
//   u06 1392–1670 đọc classification_report và confusion_matrix
// ─────────────────────────────────────────────────────────────────────────

const SKILLS_PR: Record<string, SkillDef> = {
  load: {
    code: "ml.micro.load_csv_xy",
    name: "Nạp CSV bằng pandas và tách x, y",
    description: "Đọc file CSV bằng pandas, xác định cột nhãn và tách ma trận đặc trưng x khỏi nhãn y.",
  },
  split: {
    code: "ml.micro.train_test_split",
    name: "Chia train/test với train_test_split",
    description: "Dùng train_test_split với test_size và hiểu bốn đối tượng trả về.",
  },
  seed: {
    code: "ml.micro.random_state_repro",
    name: "random_state và tính lặp lại của phép chia",
    description: "Hiểu random_state cố định cách chia ngẫu nhiên để kết quả lặp lại được, không làm mô hình tốt hơn.",
  },
  scaler: {
    code: "ml.micro.standard_scaler",
    name: "Chuẩn hoá bằng StandardScaler",
    description: "Dùng fit_transform trên tập train và chỉ transform trên tập test để tránh rò rỉ dữ liệu.",
  },
  fitpredict: {
    code: "ml.micro.fit_predict",
    name: "Huấn luyện và dự đoán với RandomForestClassifier",
    description: "Huấn luyện mô hình bằng fit trên tập train, dự đoán bằng predict trên tập test và chuẩn bị đánh giá.",
  },
  report: {
    code: "ml.micro.read_report",
    name: "Đọc classification_report và confusion_matrix",
    description: "Đọc precision, recall, f1-score, support của từng lớp và đối chiếu với ma trận nhầm lẫn.",
  },
};

const MIS_PR: Record<string, { code: string; name: string; description: string }> = {
  pr_seed_quality: {
    code: "ml_random_state_improves_accuracy",
    name: "Tưởng random_state làm mô hình chính xác hơn",
    description:
      "Học viên cho rằng đổi hay đặt random_state sẽ cải thiện chất lượng mô hình, trong khi nó chỉ cố định cách chia ngẫu nhiên để thí nghiệm lặp lại được.",
  },
  pr_train_on_test: {
    code: "ml_fit_model_on_test_set",
    name: "Huấn luyện mô hình bằng tập test",
    description:
      "Học viên gọi fit trên x_test và y_test, làm mất ý nghĩa của tập kiểm thử vì mô hình đã nhìn thấy đáp án.",
  },
};

const UNITS_PR: Unit[] = [
  // ───────────────────────── 3.T1 ─────────────────────────
  {
    key: "pr_u01",
    file: "pr_u01.mp4",
    title: "3.T1 Nạp dữ liệu và tách x, y",
    description: "Xem file diabetes.csv, nạp bằng pandas rồi tách các cột đặc trưng x khỏi cột nhãn y.",
    skill: SKILLS_PR.load!,
    body:
      "## 3.T1 Nạp dữ liệu và tách x, y\n\n" +
      "**Sau đơn vị này bạn sẽ:** nạp một file CSV bằng pandas và tách được ma trận đặc trưng `x` khỏi nhãn `y`.\n\n" +
      "### Cần nhớ\n\n" +
      "- Bộ dữ liệu `diabetes.csv` có 9 cột: 8 cột đặc trưng (Pregnancies, Glucose, BloodPressure, SkinThickness, Insulin, BMI, DiabetesPedigreeFunction, Age) và cột nhãn `Outcome` (0/1).\n" +
      "- `pd.read_csv(\"diabetes.csv\")` cho ra DataFrame `768 rows × 9 columns`.\n" +
      "- `x = data.drop(target, axis=1)` bỏ **cột** `Outcome` (`axis=1` = theo cột), còn lại 8 cột đặc trưng.\n" +
      "- `y = data[target]` chỉ lấy đúng cột nhãn `Outcome`.",
    cue: {
      atSec: 374,
      q: {
        type: "mcq",
        prompt: 'Với `target = "Outcome"`, dòng lệnh nào tạo ra ma trận đặc trưng `x` (toàn bộ cột trừ cột nhãn)?',
        explanation:
          "`data.drop(target, axis=1)` bỏ đi một CỘT (axis=1) mang tên Outcome, giữ lại 8 cột đặc trưng. `axis=0` sẽ bỏ theo dòng, còn `data[target]` thì lấy đúng cột nhãn — đó là `y`, không phải `x`.",
        options: [
          T('x = data["Outcome"]'),
          T("x = data.drop(target, axis=1)", true),
          T("x = data.drop(target, axis=0)"),
          T("x = data[target]"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.T1 — Nạp dữ liệu và tách x, y",
      description: "4 câu về read_csv, drop và cột nhãn.",
      questions: [
        {
          type: "mcq",
          prompt: 'Với `target = "Outcome"`, dòng lệnh nào lấy ra nhãn `y`?',
          explanation: "`data[target]` lấy đúng cột Outcome. `drop(...)` cho ra phần còn lại (đặc trưng), không phải nhãn.",
          options: [
            T("y = data.drop(target, axis=1)"),
            T("y = data.drop(target, axis=0)"),
            T("y = data[target]", true),
            T('y = data["Age"]'),
          ],
        },
        {
          type: "true_false",
          prompt: "Sau khi tách, `x` có 8 cột đặc trưng còn `y` chỉ gồm cột `Outcome` gồm các giá trị 0 và 1.",
          explanation: "Đúng — `data` có 9 cột; bỏ cột `Outcome` còn 8 cột cho `x`, và `y` là chính cột đó (dtype int64).",
          options: YES_NO(true),
        },
        {
          type: "numerical",
          prompt: "`data` có `768 rows × 9 columns`. Sau `x = data.drop(target, axis=1)`, `x` có bao nhiêu cột?",
          explanation: "Bỏ đi một cột (Outcome) thì còn 9 − 1 = 8 cột. Số dòng vẫn là 768.",
          extra: { expected: 8, tolerance: 0.01 },
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các bước nạp dữ liệu theo đúng thứ tự thực hiện trong notebook.",
          explanation:
            "Phải import pandas trước, rồi đọc file thành `data`, rồi khai báo tên cột nhãn `target`, và cuối cùng mới bỏ cột đó để có `x`.",
          options: [
            T("import pandas as pd"),
            T('data = pd.read_csv("diabetes.csv")'),
            T('target = "Outcome"'),
            T("x = data.drop(target, axis=1)"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 3.T2 ─────────────────────────
  {
    key: "pr_u02",
    file: "pr_u02.mp4",
    title: "3.T2 Chia train/test với train_test_split",
    description: "Đọc từng đối số của train_test_split và hiểu bốn đối tượng mà hàm trả về.",
    skill: SKILLS_PR.split!,
    body:
      "## 3.T2 Chia train/test với train_test_split\n\n" +
      "**Sau đơn vị này bạn sẽ:** đọc được cell `train_test_split` và biết `test_size` quyết định điều gì.\n\n" +
      "### Cần nhớ\n\n" +
      "```python\n" +
      "from sklearn.model_selection import train_test_split\n\n" +
      "x_train, x_test, y_train, y_test = train_test_split(\n" +
      "    x, y,\n" +
      "    test_size=0.2,\n" +
      "    random_state=1009\n" +
      ")\n" +
      "```\n\n" +
      "- Đầu vào là **toàn bộ** `x` và `y`; đầu ra là **bốn** đối tượng theo thứ tự `x_train, x_test, y_train, y_test`.\n" +
      "- `test_size=0.2`: 20% số dòng làm tập test, 80% còn lại làm tập train.\n" +
      "- Với 768 dòng, tập test khoảng 154 dòng (768 × 0.2 = 153,6, sklearn làm tròn lên).\n" +
      "- Chia tập **trước** khi chuẩn hoá và huấn luyện, để tập test luôn là dữ liệu mô hình chưa thấy.",
    cue: {
      atSec: 230,
      q: {
        type: "mcq",
        prompt:
          "Cell chia dữ liệu có dòng `train_test_split(x, y, test_size=0.2, random_state=1009)`. Tham số `test_size=0.2` có nghĩa gì?",
        explanation:
          "`test_size=0.2` là tỉ lệ: 20% số dòng của dữ liệu được tách ra làm tập test, 80% còn lại là tập train. Nó không phải số dòng (20 dòng) và không liên quan đến số lần huấn luyện.",
        options: [
          T("Tập test chỉ có 0,2 dòng, gần như không có gì"),
          T("Tập test có đúng 20 dòng"),
          T("20% số dòng làm tập test, 80% còn lại làm tập train", true),
          T("Mô hình sẽ được huấn luyện lặp lại 0,2 lần"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.T2 — train_test_split",
      description: "4 câu về đối số và kết quả của train_test_split.",
      questions: [
        {
          type: "mcq",
          prompt: "`x_train, x_test, y_train, y_test = train_test_split(...)`. Nhãn dùng để huấn luyện mô hình nằm ở biến nào?",
          explanation:
            "`y_train` là nhãn tương ứng với `x_train`; thứ tự trả về là x_train, x_test, y_train, y_test. `y_test` là nhãn của tập kiểm thử, chỉ dùng để chấm điểm.",
          options: [T("x_train"), T("x_test"), T("y_train", true), T("y_test")],
        },
        {
          type: "numerical",
          prompt:
            "Dữ liệu có 768 dòng và `test_size=0.2`. Tập test có khoảng bao nhiêu dòng? (làm tròn tới số nguyên gần nhất)",
          explanation:
            "768 × 0,2 = 153,6. sklearn làm tròn lên nên tập test có 154 dòng (đúng như `154 rows × 8 columns` sẽ hiện ở đơn vị sau).",
          extra: { expected: 154, tolerance: 0.5 },
        },
        {
          type: "true_false",
          prompt: "Hàm `train_test_split(x, y, ...)` trả về bốn đối tượng: `x_train`, `x_test`, `y_train`, `y_test`.",
          explanation: "Đúng — hai đối tượng cho `x` (train và test) và hai cho `y` (train và test).",
          options: YES_NO(true),
        },
        {
          type: "fill_in",
          prompt: "Tên tham số quy định tỉ lệ dữ liệu dành cho tập test là gì? (viết đúng tên tham số)",
          explanation: "`test_size`, ví dụ `test_size=0.2`.",
          options: [T("test_size", true), T("test_size=", true), T("test_size=0.2", true)],
        },
      ],
    },
  },
  // ───────────────────────── 3.T3 ─────────────────────────
  {
    key: "pr_u03",
    file: "pr_u03.mp4",
    title: "3.T3 random_state và tính lặp lại",
    description: "Chạy phép chia, xem x_train/x_test, rồi bỏ random_state để thấy kết quả chia thay đổi mỗi lần.",
    skill: SKILLS_PR.seed!,
    body:
      "## 3.T3 random_state và tính lặp lại\n\n" +
      "**Sau đơn vị này bạn sẽ:** giải thích được vì sao ta đặt `random_state` khi chia dữ liệu.\n\n" +
      "### Cần nhớ\n\n" +
      "- Chia train/test là phép chia **ngẫu nhiên**; `random_state` cố định bộ sinh số ngẫu nhiên đó.\n" +
      "- Cùng `random_state=1009`, chạy lại cell hai lần cho `x_train` giống hệt (các dòng đầu có chỉ số 498, 705, 36, 199, 309).\n" +
      "- Khi comment `# random_state=1009`, lần chạy sau ra tập khác hẳn (dòng đầu 627, 506, 429, 661, 54).\n" +
      "- `random_state` **không** làm mô hình tốt hơn hay xấu đi; nó chỉ giúp thí nghiệm lặp lại được để so sánh công bằng.\n" +
      "- Sau thí nghiệm, đặt lại `random_state=1009` để các bước sau dùng đúng một bộ chia.",
    cue: {
      atSec: 243,
      q: {
        type: "mcq",
        prompt:
          "Chạy cell chia hai lần với `random_state=1009`, `x_train` cho các dòng đầu giống hệt nhau (498, 705, 36, …). Khi comment `# random_state=1009` rồi chạy lại, các dòng đầu đổi thành 627, 506, 429, …. Điều này cho thấy gì?",
        explanation:
          "Đặt `random_state` thì phép chia ngẫu nhiên luôn ra cùng kết quả; bỏ đi thì mỗi lần chạy chia khác nhau, nên kết quả đánh giá cũng dao động và thí nghiệm không lặp lại được.",
        options: [
          T("Có random_state thì mô hình luôn chính xác hơn", false, "pr_seed_quality"),
          T("Có random_state thì phép chia lặp lại được; bỏ đi thì mỗi lần chạy chia khác nhau", true),
          T("Bỏ random_state thì chương trình báo lỗi"),
          T("random_state quyết định tập train lấy bao nhiêu dòng"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.T3 — random_state",
      description: "4 câu về vai trò của random_state và thí nghiệm trong video.",
      questions: [
        {
          type: "mcq",
          prompt: "Nếu bỏ tham số `random_state` khỏi `train_test_split`, điều gì xảy ra?",
          explanation:
            "Mỗi lần chạy sẽ chia dữ liệu khác nhau, nên kết quả đánh giá dao động giữa các lần chạy. Mô hình không xấu đi, chỉ là thí nghiệm không còn lặp lại được — gây khó khi so sánh hai phương án.",
          options: [
            T("Chương trình báo lỗi vì thiếu tham số bắt buộc"),
            T("Mỗi lần chạy chia dữ liệu khác nhau, kết quả dao động và không lặp lại được", true),
            T("Mô hình sẽ kém chính xác hơn hẳn", false, "pr_seed_quality"),
            T("Toàn bộ dữ liệu bị dùng làm tập huấn luyện"),
          ],
        },
        {
          type: "true_false",
          prompt: "Với cùng `random_state=1009`, chạy lại cell `train_test_split` hai lần cho `x_train` giống hệt nhau.",
          explanation:
            "Đúng — trong video hai lần chạy đều cho `x_train` có các dòng đầu 498, 705, 36, 199, 309, vì `random_state` đã cố định cách chia.",
          options: YES_NO(true),
        },
        {
          type: "mcq",
          prompt: "Đặt `random_state=1009` thay vì `random_state=1` thì chất lượng mô hình thay đổi thế nào?",
          explanation:
            "`random_state` chỉ chọn một cách chia cụ thể để tái lập được; không có giá trị \"tốt hơn\" về bản chất. Nó không phải một siêu tham số cải thiện mô hình.",
          options: [
            T("1009 luôn cho mô hình tốt hơn vì số lớn hơn", false, "pr_seed_quality"),
            T("Giá trị nào cũng chỉ là một cách chia cố định, dùng để lặp lại thí nghiệm", true),
            T("Số càng nhỏ thì mô hình càng ít bị overfit", false, "pr_seed_quality"),
            T("Nó quyết định số cây trong rừng"),
          ],
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các bước của thí nghiệm trong video theo đúng thứ tự.",
          explanation:
            "Trước hết chạy phép chia có `random_state` và xem `x_train`; chạy lại thấy giống hệt; sau đó comment `random_state` và chạy lại thì `x_train` thay đổi.",
          options: [
            T("Chạy cell chia với random_state=1009 và xem x_train"),
            T("Chạy lại cell và thấy x_train giống hệt lần trước"),
            T("Comment dòng # random_state=1009"),
            T("Chạy lại cell và thấy x_train khác hẳn"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 3.T4 ─────────────────────────
  {
    key: "pr_u04",
    file: "pr_u04.mp4",
    title: "3.T4 Chuẩn hoá bằng StandardScaler",
    description: "Đọc tài liệu StandardScaler và áp dụng fit_transform cho train, transform cho test.",
    skill: SKILLS_PR.scaler!,
    body:
      "## 3.T4 Chuẩn hoá bằng StandardScaler\n\n" +
      "**Sau đơn vị này bạn sẽ:** chuẩn hoá đúng cách bằng `StandardScaler` mà không làm rò rỉ dữ liệu test.\n\n" +
      "### Cần nhớ\n\n" +
      "```python\n" +
      "from sklearn.preprocessing import StandardScaler\n\n" +
      "scaler = StandardScaler()\n" +
      "x_train = scaler.fit_transform(x_train)   # fit CHỈ trên train\n" +
      "x_test = scaler.transform(x_test)         # test chỉ transform\n" +
      "```\n\n" +
      "| | Công thức |\n" +
      "|---|---|\n" +
      "| Standardization (z-score) | `z = (x − u) / s` với `u` là trung bình, `s` là độ lệch chuẩn |\n\n" +
      "- `fit_transform` học mean/std **từ tập train** rồi áp lên chính nó; `transform` chỉ áp tham số đã học.\n" +
      "- Sau chuẩn hoá, `x_train` và `x_test` trở thành mảng NumPy, shape `(614, 8)` và `(154, 8)`.\n" +
      "- Nếu fit cả trên test, thông tin của tập test rò rỉ vào bước chuẩn hoá và kết quả đánh giá đẹp hơn thực tế.",
    cue: {
      atSec: 313,
      q: {
        type: "mcq",
        prompt: "Vì sao dùng `scaler.fit_transform(x_train)` nhưng chỉ `scaler.transform(x_test)`?",
        explanation:
          "Tham số chuẩn hoá (mean, std) phải được học CHỈ từ tập train. Nếu fit cả trên test, thông tin của tập test rò rỉ vào mô hình và kết quả đánh giá không còn trung thực — mô hình trông giỏi hơn thực tế.",
        options: [
          T("Vì tập test không cần chuẩn hoá"),
          T("Vì fit_transform chỉ chạy được một lần trong mỗi phiên làm việc"),
          T("Vì tham số chuẩn hoá chỉ được học từ tập train, tránh rò rỉ thông tin từ tập test", true),
          T("Vì tập test nhỏ hơn nên không đủ dữ liệu để fit", false, "fit_test"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.T4 — StandardScaler",
      description: "4 câu về công thức, fit/transform và thứ tự các bước.",
      questions: [
        {
          type: "mcq",
          prompt:
            "Trang tài liệu `StandardScaler` trong video ghi điểm chuẩn hoá của mẫu `x` là `z = (x − u) / s` (u là trung bình, s là độ lệch chuẩn). Công thức đó thuộc phương pháp nào?",
          explanation:
            "Trừ trung bình rồi chia độ lệch chuẩn là standardization (z-score): kết quả có trung bình 0 và độ lệch chuẩn 1. Min-Max mới là `(x − min) / (max − min)` đưa về [0, 1].",
          options: [
            T("Normalization (Min-Max), đưa dữ liệu về [0, 1]", false, "norm_vs_std"),
            T("Standardization (z-score), đưa về trung bình 0 và độ lệch chuẩn 1", true),
            T("One-hot encoding"),
            T("Điền giá trị thiếu bằng trung bình"),
          ],
        },
        {
          type: "true_false",
          prompt: "Nên gọi `scaler.fit_transform()` cho cả `x_train` lẫn `x_test` để hai tập được chuẩn hoá giống nhau.",
          explanation:
            "Sai — và đây là lỗi phổ biến nhất. Chỉ `x_train` được fit. Gọi fit trên `x_test` làm rò rỉ thông tin tập test vào quá trình chuẩn hoá.",
          options: [T("Đúng", false, "fit_test"), T("Sai", true)],
        },
        {
          type: "numerical",
          prompt:
            "Sau chuẩn hoá, `x_train` có shape `(614, 8)` và `x_test` có shape `(154, 8)`. Tổng số dòng của hai tập là bao nhiêu?",
          explanation: "614 + 154 = 768, đúng bằng số dòng của dữ liệu gốc: chuẩn hoá không thêm hay bớt dòng nào.",
          extra: { expected: 768, tolerance: 0.01 },
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các dòng code theo đúng thứ tự trong cell chuẩn hoá.",
          explanation:
            "Chia train/test trước; tạo scaler; fit_transform trên train (scaler học tham số ở đây); cuối cùng transform test bằng đúng scaler đó.",
          options: [
            T("x_train, x_test, y_train, y_test = train_test_split(x, y, test_size=0.2, random_state=1009)"),
            T("scaler = StandardScaler()"),
            T("x_train = scaler.fit_transform(x_train)"),
            T("x_test = scaler.transform(x_test)"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 3.T5 ─────────────────────────
  {
    key: "pr_u05",
    file: "pr_u05.mp4",
    title: "3.T5 Huấn luyện RandomForest và dự đoán",
    description: "Huấn luyện RandomForestClassifier bằng fit, dự đoán bằng predict và chuẩn bị gọi classification_report.",
    skill: SKILLS_PR.fitpredict!,
    body:
      "## 3.T5 Huấn luyện RandomForest và dự đoán\n\n" +
      "**Sau đơn vị này bạn sẽ:** huấn luyện một mô hình scikit-learn, dự đoán trên tập test và biết cần những gì để đánh giá.\n\n" +
      "### Cần nhớ\n\n" +
      "```python\n" +
      "from sklearn.ensemble import RandomForestClassifier\n\n" +
      "model = RandomForestClassifier(random_state=100)\n" +
      "model.fit(x_train, y_train)      # học từ tập train\n" +
      "y_pred = model.predict(x_test)   # dự đoán cho tập test\n\n" +
      "report = classification_report(y_test, y_pred, output_dict=True)\n" +
      "```\n\n" +
      "- Quy trình mỗi mô hình scikit-learn: **tạo đối tượng → `fit` → `predict`**.\n" +
      "- `fit` chỉ nhận dữ liệu train (`x_train`, `y_train`); mô hình không được nhìn thấy `y_test`.\n" +
      "- `y_pred` chứa một nhãn dự đoán cho **mỗi dòng** của `x_test` (154 dòng).\n" +
      "- `classification_report(y_test, y_pred)` so nhãn thật `y_test` với nhãn dự đoán `y_pred`.",
    cue: {
      atSec: 198,
      q: {
        type: "mcq",
        prompt:
          "Trong `classification_report(y_test, y_pred, output_dict=True)`, `y_test` và `y_pred` lần lượt là gì?",
        explanation:
          "`y_test` là nhãn thật của tập test (đáp án); `y_pred` là nhãn mà mô hình dự đoán cho `x_test` qua `model.predict(x_test)`. Báo cáo so hai thứ này với nhau.",
        options: [
          T("y_test là nhãn dự đoán, y_pred là nhãn thật"),
          T("Nhãn thật của tập test và nhãn mô hình dự đoán cho x_test", true),
          T("Nhãn của tập train và nhãn của tập test"),
          T("Hai bản sao của cùng một mảng nhãn"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.T5 — fit và predict",
      description: "4 câu về fit, predict và thứ tự các lệnh.",
      questions: [
        {
          type: "fill_in",
          prompt: "Phương thức nào của `model` dùng để huấn luyện mô hình trên dữ liệu train? (viết đúng tên phương thức)",
          explanation: "`fit`, ví dụ `model.fit(x_train, y_train)`.",
          options: [T("fit", true), T("fit()", true), T("model.fit", true), T("model.fit()", true)],
        },
        {
          type: "true_false",
          prompt: "Mô hình được huấn luyện bằng `model.fit(x_test, y_test)`.",
          explanation:
            "Sai — mô hình học từ tập train: `model.fit(x_train, y_train)`. Nếu học bằng tập test thì không còn dữ liệu \"chưa thấy\" để đánh giá trung thực.",
          options: [T("Đúng", false, "pr_train_on_test"), T("Sai", true)],
        },
        {
          type: "numerical",
          prompt: "`x_test` có `154 rows × 8 columns`. `y_pred = model.predict(x_test)` chứa bao nhiêu nhãn dự đoán?",
          explanation: "`predict` trả về một nhãn cho mỗi dòng của `x_test`, nên có 154 nhãn.",
          extra: { expected: 154, tolerance: 0.01 },
        },
        {
          type: "ordering",
          prompt: "Sắp xếp các lệnh theo đúng thứ tự thực hiện trong buổi thực hành.",
          explanation: "Huấn luyện (`fit`) → dự đoán (`predict`) → đánh giá (`classification_report`). Không thể đánh giá khi chưa có `y_pred`.",
          options: [
            T("model.fit(x_train, y_train)"),
            T("y_pred = model.predict(x_test)"),
            T("report = classification_report(y_test, y_pred, output_dict=True)"),
          ],
        },
      ],
    },
  },
  // ───────────────────────── 3.T6 ─────────────────────────
  {
    key: "pr_u06",
    file: "pr_u06.mp4",
    title: "3.T6 Đọc kết quả đánh giá",
    description: "Đọc bảng classification_report và confusion_matrix của mô hình vừa huấn luyện.",
    skill: SKILLS_PR.report!,
    body:
      "## 3.T6 Đọc kết quả đánh giá\n\n" +
      "**Sau đơn vị này bạn sẽ:** đọc precision, recall, f1-score, support của từng lớp và đối chiếu với ma trận nhầm lẫn.\n\n" +
      "### Cần nhớ\n\n" +
      "| Lớp | precision | recall | f1-score | support |\n" +
      "|---|---|---|---|---|\n" +
      "| 0 (không bệnh) | 0.79 | 0.88 | 0.83 | 100 |\n" +
      "| 1 (có bệnh) | 0.71 | 0.56 | 0.62 | 54 |\n" +
      "| accuracy | | | 0.77 | 154 |\n\n" +
      "- `confusion_matrix(y_test, y_pred)` cho `[[88, 12], [24, 30]]`, theo thứ tự `[[TN, FP], [FN, TP]]`.\n" +
      "- Lớp 1: precision 0.71 nghĩa là khi mô hình báo \"có bệnh\" thì 71% là đúng; recall 0.56 = 30 / (30 + 24) nghĩa là mô hình chỉ tìm ra 56% số ca bệnh thật.\n" +
      "- **Accuracy 0.77 che khuất điểm yếu của lớp 1** — với bài toán sàng lọc bệnh, bỏ sót gần một nửa số ca bệnh (24 ca) là nghiêm trọng.\n" +
      "- Hãy tự hỏi: recall 0.56 có chấp nhận được không?",
    cue: {
      atSec: 270,
      q: {
        type: "mcq",
        prompt:
          "`confusion_matrix(y_test, y_pred)` cho `[[88, 12], [24, 30]]` (hàng = nhãn thật 0 rồi 1; cột = nhãn dự đoán 0 rồi 1). Số `24` ở hàng thứ hai, cột thứ nhất có nghĩa gì?",
        explanation:
          "Hàng thứ hai là nhãn thật lớp 1 (có bệnh), cột thứ nhất là dự đoán lớp 0 (không bệnh). Vậy 24 là số ca có bệnh nhưng bị mô hình bỏ sót (False Negative) — đó cũng là lý do recall lớp 1 chỉ là 30/(30+24) ≈ 0.56.",
        options: [
          T("24 ca thật sự có bệnh nhưng mô hình dự đoán là không bệnh", true),
          T("24 ca không bệnh nhưng mô hình dự đoán là có bệnh"),
          T("24 ca có bệnh và mô hình dự đoán đúng"),
          T("24 ca không bệnh và mô hình dự đoán đúng"),
        ],
      },
    },
    quiz: {
      title: "Kiểm tra 3.T6 — Đọc classification report",
      description: "4 câu đọc bảng đánh giá và ma trận nhầm lẫn.",
      questions: [
        {
          type: "mcq",
          prompt:
            "Trong classification report, lớp 1 có precision 0.71 và recall 0.56 (support 54). Điều này nói lên gì về mô hình?",
          explanation:
            "Precision 0.71: khi mô hình nói “có bệnh” thì 71% là đúng. Recall 0.56: nhưng nó chỉ tìm ra được 56% số ca bệnh thật — tức bỏ sót gần một nửa. Với bài toán y tế, đây là điểm yếu nghiêm trọng.",
          options: [
            T("Mô hình dự đoán lớp 1 gần như hoàn hảo"),
            T("Phần lớn dự đoán “lớp 1” là đúng, nhưng mô hình bỏ sót gần một nửa số ca lớp 1 thật", true),
            T("Mô hình báo nhầm lớp 1 quá nhiều lần"),
            T("Accuracy đã là 0.77 nên hai chỉ số này không quan trọng", false, "accuracy_always_good"),
          ],
        },
        {
          type: "numerical",
          prompt:
            "Từ ma trận `[[88, 12], [24, 30]]` theo thứ tự `[[TN, FP], [FN, TP]]`, tính recall của lớp 1 = TP / (TP + FN). (làm tròn 2 chữ số thập phân)",
          explanation: "30 / (30 + 24) = 30 / 54 ≈ 0,56 — khớp với recall 0.56 của lớp 1 trong bảng report.",
          extra: { expected: 0.56, tolerance: 0.01 },
        },
        {
          type: "true_false",
          prompt: "Vì accuracy đạt 0.77, ta có thể kết luận mô hình phát hiện tốt các ca bệnh (lớp 1).",
          explanation:
            "Sai — accuracy gộp cả hai lớp và lớp 0 chiếm 100/154 dòng. Recall của lớp 1 chỉ là 0.56: mô hình bỏ sót 24 trong 54 ca bệnh thật.",
          options: [T("Đúng", false, "accuracy_always_good"), T("Sai", true)],
        },
        {
          type: "fill_in",
          prompt:
            "Cộng tất cả các ô của ma trận nhầm lẫn `[[88, 12], [24, 30]]` được số dòng của tập test. Đó là bao nhiêu?",
          explanation: "88 + 12 + 24 + 30 = 154, khớp với `support` 154 ở các dòng macro avg và weighted avg (100 + 54).",
          options: [T("154", true)],
        },
      ],
    },
  },
];

const CAPSTONE_PR = {
  title: "Thực hành tổng hợp: Chạy lại toàn bộ quy trình trên dữ liệu của bạn",
  description: "Bài đồ án gom sáu bước 3.T1 đến 3.T6 vào một quy trình học máy hoàn chỉnh trên dữ liệu của bạn.",
  body:
    "## Thực hành tổng hợp: Chạy lại toàn bộ quy trình trên dữ liệu của bạn\n\n" +
    "Bài này lặp lại đúng quy trình bạn vừa xem — nạp dữ liệu, tách `x` và `y`, chia train/test, chuẩn hoá, huấn luyện, dự đoán, đánh giá — nhưng trên **một bộ dữ liệu khác** do bạn chọn. Làm sau khi đã hoàn thành các đơn vị 3.T1 đến 3.T6.\n\n" +
    "Đề bài nằm ở phần **Bài tập** bên dưới. Đây là bài chuẩn bị trực tiếp cho Group Project.",
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
    pedagogicalIntent: "enacting" as const,
    responseFormat: "mixed" as const,
  },
};


// ─────────────────────────────────────────────────────────────────────────
// Groups — where each chapter's units go, and which existing skill tags its
// capstone (the lecture-level skills already exist from the long lectures).
// ─────────────────────────────────────────────────────────────────────────

interface Group {
  name: string;
  moduleIndex: number;
  /** "top" = first lesson of the module, "end" = last, `{ after }` = straight after the named lesson. */
  position: "top" | "end" | { after: string };
  units: Unit[];
  capstone: Capstone;
  capstoneSkillCode: string;
}

const GROUPS: Group[] = [
  {
    name: "Chapter 1",
    moduleIndex: 0,
    position: { after: "Course Overview" },
    units: UNITS_CH1,
    capstone: CAPSTONE_CH1,
    capstoneSkillCode: "ml.lecture.foundations",
  },
  {
    name: "Chapter 2",
    moduleIndex: 1,
    position: "top",
    units: UNITS_CH2,
    capstone: CAPSTONE_CH2,
    capstoneSkillCode: "ml.lecture.algorithms",
  },
  {
    name: "Chapter 3",
    moduleIndex: 2,
    position: "top",
    units: UNITS_CH3,
    capstone: CAPSTONE_CH3,
    capstoneSkillCode: "ml.lecture.evaluation",
  },
  {
    name: "Practical session",
    moduleIndex: 2,
    position: "end",
    units: UNITS_PR,
    capstone: CAPSTONE_PR,
    capstoneSkillCode: "ml.lecture.practical",
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

const ALL_SKILLS: SkillDef[] = [
  ...Object.values(SKILLS_CH1),
  ...Object.values(SKILLS_CH2),
  ...Object.values(SKILLS_CH3),
  ...Object.values(SKILLS_PR),
];

async function ensureSkills() {
  for (const s of ALL_SKILLS) {
    const found = await prisma.skill.findUnique({ where: { code: s.code } });
    skillIds.set(s.code, found?.id ?? (await createSkill(s, prisma)).skillId);
  }
  // Capstones reuse the lecture-level skills that already exist.
  for (const g of GROUPS) {
    const found = await prisma.skill.findUnique({ where: { code: g.capstoneSkillCode } });
    if (!found) throw new Error(`missing lecture skill: ${g.capstoneSkillCode}`);
    skillIds.set(g.capstoneSkillCode, found.id);
  }
}

async function ensureMisconceptions() {
  const all = { ...MISCONCEPTIONS, ...MIS_CH1, ...MIS_CH2, ...MIS_CH3, ...MIS_PR };
  for (const [key, m] of Object.entries(all)) {
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

function misIdOf(key: string | undefined): { misconceptionId: string } | Record<string, never> {
  if (!key) return {};
  const id = misIds.get(key);
  if (!id) throw new Error(`unknown misconception key: ${key}`);
  return { misconceptionId: id };
}

/** Map our question shape onto CreateQuestionInput. */
function toQuestionInput(q: Q, orderIndex: number, skillCode: string) {
  const options = q.options?.map((o) => ({
    label: o.label,
    // `ordering` grades by orderIndex and `matching` by extra.pairKey — for both
    // the service still wants the flag, and false is the documented convention.
    isCorrect: o.correct ?? false,
    ...misIdOf(o.mis),
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
    console.error("usage: seed-ml-micro.ts <video-dir> [--dry-run]");
    process.exit(1);
  }
  for (const g of GROUPS) {
    for (const u of g.units) {
      const f = join(dir, u.file);
      if (!existsSync(f)) throw new Error(`missing video: ${u.file}`);
      const dur = durationOf(f);
      if (u.cue.atSec >= dur - 5) {
        throw new Error(`${u.title}: cuepoint ${u.cue.atSec}s is not inside the ${dur}s clip`);
      }
      if (!u.skill?.code) throw new Error(`${u.title}: unit has no skill (bad SKILLS key?)`);
      const gradable = u.cue.q.type === "mcq" || u.cue.q.type === "true_false";
      if (!gradable) throw new Error(`${u.title}: cuepoint question must be mcq/true_false`);
      const right = (u.cue.q.options ?? []).filter((o) => o.correct).length;
      if (right !== 1) throw new Error(`${u.title}: cuepoint needs exactly one correct option (has ${right})`);
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

  const modules = await prisma.module.findMany({
    where: { courseId: course.id },
    orderBy: { orderIndex: "asc" },
  });

  if (dryRun) {
    console.log("DRY RUN\n");
    let total = 0;
    let cues = 0;
    for (const g of GROUPS) {
      const where = typeof g.position === "object" ? `after "${g.position.after}"` : g.position;
      console.log(`\n══ ${g.name} → ${modules[g.moduleIndex]?.title} [${where}]`);
      for (const u of g.units) {
        const dur = durationOf(join(dir, u.file));
        total += dur;
        cues++;
        console.log(
          `  "${u.title}" <- ${u.file} (${fmt(dur)})  cue ${fmt(u.cue.atSec)}  quiz ${u.quiz.questions.length} (${[...new Set(u.quiz.questions.map((q) => q.type))].join(",")})`,
        );
      }
      console.log(`  "${g.capstone.title}" (bài tập, không video)`);
    }
    console.log(`\nTổng: ${GROUPS.reduce((s, g) => s + g.units.length, 0)} đơn vị, ${fmt(total)} video, ${cues} cuepoint`);
    return;
  }

  await ensureSkills();
  await ensureMisconceptions();
  console.log(`skills: ${skillIds.size}, misconceptions: ${misIds.size}`);

  for (const g of GROUPS) {
    const mod = modules[g.moduleIndex];
    if (!mod) throw new Error(`module ${g.moduleIndex} missing`);
    console.log(`\n══ ${g.name} → ${mod.title}`);

    // Where the first lesson of this group goes; every later lesson follows the previous one.
    let prevTitle: string | null = null;
    const slotAfter = async (): Promise<number> => {
      if (prevTitle) {
        const a = await prisma.lesson.findFirstOrThrow({
          where: { moduleId: mod.id, title: prevTitle },
          select: { orderIndex: true },
        });
        return a.orderIndex + 1;
      }
      if (g.position === "top") return 0;
      if (g.position === "end") {
        const max = await prisma.lesson.aggregate({ where: { moduleId: mod.id }, _max: { orderIndex: true } });
        return (max._max.orderIndex ?? -1) + 1;
      }
      const a = await prisma.lesson.findFirst({
        where: { moduleId: mod.id, title: g.position.after },
        select: { orderIndex: true },
      });
      if (!a) throw new Error(`anchor lesson not found: ${g.position.after}`);
      return a.orderIndex + 1;
    };

    for (const u of g.units) {
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

      // Upload first: if the transfer dies, the worst case is an orphan blob the
      // sweep collects — not a half-built lesson on a live course.
      const filePath = join(dir, u.file);
      const up = await uploadVideo(filePath, actor);
      const durationSec = durationOf(filePath);

      const orderIndex = await slotAfter();
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
              ...misIdOf(o.mis),
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

    // Capstone: this chapter's practice assignment, no video.
    const cap = g.capstone;
    const capExisting = await prisma.lesson.findFirst({ where: { moduleId: mod.id, title: cap.title } });
    if (capExisting) {
      console.log(`skip (already built): ${cap.title}`);
    } else {
      const orderIndex = await slotAfter();
      await openSlot(mod.id, orderIndex);
      const { lessonId } = await createLesson(
        actor,
        mod.id,
        { title: cap.title, orderIndex, description: cap.description },
        prisma,
      );
      await createContentItem(actor, lessonId, { type: "markdown", payload: { body: cap.body }, orderIndex: 0 }, prisma);
      await createAssignment(
        actor,
        lessonId,
        {
          title: cap.assignment.title,
          description: cap.assignment.description,
          pedagogicalIntent: cap.assignment.pedagogicalIntent,
          responseFormat: cap.assignment.responseFormat,
          assessmentModes: ["instructor_graded", "self_assessed"],
          requireSelfRating: true,
          requireReflection: true,
          maxScore: 100,
        },
        prisma,
      );
      await tagLessonSkill(actor, lessonId, { skillId: skillIdOf(g.capstoneSkillCode) }, prisma);
      console.log(`[${orderIndex}] "${cap.title}" — 1 bài tập`);
    }
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
