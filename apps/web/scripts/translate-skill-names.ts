/**
 * Translate the learner-facing names of the ML/PDS skills into Vietnamese.
 *
 * Skill names became user-visible once the catalog started showing them instead
 * of the raw `code`, so English names now sit under Vietnamese lesson titles.
 * The `code` is untouched — it stays the stable machine identifier.
 *
 *   tsx scripts/translate-skill-names.ts [--dry-run]
 */
import { prisma } from "@feedbackme/db";

const NAMES: Record<string, string> = {
  // Fundamental of Machine Learning
  "ml.data_prep.missing_values": "Xử lý giá trị thiếu",
  "ml.data_prep.scaling_encoding": "Chuẩn hoá đặc trưng và mã hoá biến hạng mục",
  "ml.data_prep.partitioning": "Chia tập dữ liệu",
  "ml.foundations.supervised": "Nền tảng học có giám sát",
  "ml.foundations.bias_variance": "Đánh đổi bias-variance",
  "ml.sklearn.pipeline": "Pipeline học máy trong Scikit-learn",
  "ml.algo.linear_regression": "Hồi quy tuyến tính",
  "ml.algo.decision_trees": "Cây quyết định",
  "ml.algo.svm": "Máy vector hỗ trợ (SVM)",
  "ml.algo.selection": "Chọn thuật toán phù hợp",
  "ml.eval.metrics": "Các độ đo đánh giá mô hình",
  "ml.eval.cross_validation": "Kiểm định chéo",
  "ml.eval.hyperparameter_tuning": "Tinh chỉnh siêu tham số",
  "ml.workflow.end_to_end": "Quy trình học máy hoàn chỉnh",
  "ml.intro.overview": "Tổng quan học máy và khoa học dữ liệu",

  // Programming for Data Science
  "pds.intro.landscape": "Bức tranh chung ngành khoa học dữ liệu",
  "pds.python.basics": "Biến, kiểu dữ liệu và toán tử Python",
  "pds.python.control_flow": "Cấu trúc điều khiển: rẽ nhánh và vòng lặp",
  "pds.python.functions": "Hàm trong Python",
  "pds.python.oop": "Lập trình hướng đối tượng cơ bản",
  "pds.numpy.arrays": "Mảng NumPy",
  "pds.pandas.dataframes": "DataFrame trong Pandas",
  "pds.pandas.cleaning": "Làm sạch và biến đổi dữ liệu",
  "pds.pandas.eda": "Tổng hợp và khám phá dữ liệu trong Jupyter",
  "pds.web.rest_api": "Lấy dữ liệu qua RESTful API",
  "pds.web.scraping": "Thu thập dữ liệu web với BeautifulSoup",
};

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  let changed = 0;
  for (const [code, name] of Object.entries(NAMES)) {
    const skill = await prisma.skill.findUnique({ where: { code } });
    if (!skill) {
      console.log(`  ⚠ chưa có skill: ${code}`);
      continue;
    }
    if (skill.name === name) continue;
    console.log(`  ${code}\n    "${skill.name}"\n    -> "${name}"`);
    if (!dryRun) {
      await prisma.skill.update({ where: { code }, data: { name } });
    }
    changed++;
  }
  console.log(`\n${changed} skill ${dryRun ? "sẽ được" : "đã"} đổi tên.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
