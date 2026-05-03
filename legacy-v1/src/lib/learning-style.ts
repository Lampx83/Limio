// Bảng câu hỏi rút gọn theo Felder-Silverman Learning Style (8 câu, 2 câu/chiều)
// Mỗi chiều cho điểm trong [-2, +2]; điểm âm = thiên hướng đầu tiên, dương = thứ hai.
// Active(-)/Reflective(+), Sensing(-)/Intuitive(+), Visual(-)/Verbal(+), Sequential(-)/Global(+)

export type LSDimension =
  | "active_reflective"
  | "sensing_intuitive"
  | "visual_verbal"
  | "sequential_global";

export interface LSQuestion {
  id: string;
  dimension: LSDimension;
  question: string;
  optionA: { text: string; value: -1 };
  optionB: { text: string; value: 1 };
}

export const LS_QUESTIONS: LSQuestion[] = [
  {
    id: "ar1",
    dimension: "active_reflective",
    question: "Khi học một chủ đề mới, bạn thường:",
    optionA: { text: "Thử làm bài tập / thảo luận với bạn ngay", value: -1 },
    optionB: { text: "Suy nghĩ kỹ một mình trước khi hành động", value: 1 },
  },
  {
    id: "ar2",
    dimension: "active_reflective",
    question: "Trong nhóm học tập, bạn thường:",
    optionA: { text: "Phát biểu, nêu ý tưởng đầu tiên", value: -1 },
    optionB: { text: "Lắng nghe, ghi chép rồi mới chia sẻ", value: 1 },
  },
  {
    id: "si1",
    dimension: "sensing_intuitive",
    question: "Bạn thấy hứng thú hơn khi học:",
    optionA: { text: "Sự kiện, ví dụ thực tế, ứng dụng cụ thể", value: -1 },
    optionB: { text: "Khái niệm trừu tượng, lý thuyết, đổi mới", value: 1 },
  },
  {
    id: "si2",
    dimension: "sensing_intuitive",
    question: "Khi giải bài tập, bạn thích:",
    optionA: { text: "Quy trình rõ ràng, từng bước đã được kiểm chứng", value: -1 },
    optionB: { text: "Tự tìm cách mới, sáng tạo lời giải", value: 1 },
  },
  {
    id: "vv1",
    dimension: "visual_verbal",
    question: "Bạn nhớ thông tin tốt nhất qua:",
    optionA: { text: "Hình ảnh, sơ đồ, biểu đồ, video", value: -1 },
    optionB: { text: "Văn bản, lời giảng, lời thảo luận", value: 1 },
  },
  {
    id: "vv2",
    dimension: "visual_verbal",
    question: "Khi giảng viên trình bày, bạn thích:",
    optionA: { text: "Các slide có sơ đồ và biểu đồ", value: -1 },
    optionB: { text: "Lời giảng và ví dụ kể chuyện", value: 1 },
  },
  {
    id: "sg1",
    dimension: "sequential_global",
    question: "Bạn hiểu bài tốt hơn khi:",
    optionA: { text: "Học theo trình tự bước-bước, có cấu trúc", value: -1 },
    optionB: { text: "Nhìn được tổng thể trước, rồi đi vào chi tiết", value: 1 },
  },
  {
    id: "sg2",
    dimension: "sequential_global",
    question: "Khi giải vấn đề lớn, bạn:",
    optionA: { text: "Tách thành các phần nhỏ, làm tuần tự", value: -1 },
    optionB: { text: "Nắm tổng quan, nhảy giữa các phần khi cần", value: 1 },
  },
];

export interface LSScore {
  active_reflective: number;
  sensing_intuitive: number;
  visual_verbal: number;
  sequential_global: number;
}

export function computeScore(answers: Record<string, -1 | 1>): LSScore {
  const sum: LSScore = {
    active_reflective: 0,
    sensing_intuitive: 0,
    visual_verbal: 0,
    sequential_global: 0,
  };
  for (const q of LS_QUESTIONS) {
    const v = answers[q.id];
    if (v === -1 || v === 1) sum[q.dimension] += v;
  }
  return sum;
}

export function describeStyle(score: LSScore): string {
  const parts: string[] = [];
  parts.push(score.active_reflective < 0 ? "Active (chủ động)" : score.active_reflective > 0 ? "Reflective (suy ngẫm)" : "Cân bằng Active/Reflective");
  parts.push(score.sensing_intuitive < 0 ? "Sensing (thực tế)" : score.sensing_intuitive > 0 ? "Intuitive (trực giác)" : "Cân bằng Sensing/Intuitive");
  parts.push(score.visual_verbal < 0 ? "Visual (hình ảnh)" : score.visual_verbal > 0 ? "Verbal (ngôn từ)" : "Cân bằng Visual/Verbal");
  parts.push(score.sequential_global < 0 ? "Sequential (tuần tự)" : score.sequential_global > 0 ? "Global (tổng thể)" : "Cân bằng Sequential/Global");
  return parts.join(" · ");
}
