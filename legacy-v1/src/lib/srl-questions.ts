// Bộ câu hỏi SRL rút gọn dựa trên MSLQ (Pintrich) + Zimmerman 3-phase model
// Mỗi câu thang Likert 1-5. 3 thang đo: Forethought, Performance, Self-Reflection.

export type SRLPhaseDim = "forethought" | "performance" | "reflection";

export interface SRLQuestion {
  id: string;
  dim: SRLPhaseDim;
  text: string;
  reverse?: boolean;
}

export const SRL_QUESTIONS: SRLQuestion[] = [
  // Forethought (lập kế hoạch, đặt mục tiêu)
  { id: "f1", dim: "forethought", text: "Trước khi học, tôi đặt ra mục tiêu cụ thể cho buổi học." },
  { id: "f2", dim: "forethought", text: "Tôi lập kế hoạch các bước cần làm trước khi bắt đầu một bài tập." },
  { id: "f3", dim: "forethought", text: "Tôi cân nhắc thời gian và tài nguyên cần thiết trước khi học." },
  { id: "f4", dim: "forethought", text: "Tôi tin mình có thể hoàn thành tốt nhiệm vụ học tập." },

  // Performance (giám sát, kiểm soát trong khi học)
  { id: "p1", dim: "performance", text: "Trong khi học, tôi tự kiểm tra mức độ hiểu bài của mình." },
  { id: "p2", dim: "performance", text: "Tôi điều chỉnh chiến lược học khi nhận ra mình không hiểu." },
  { id: "p3", dim: "performance", text: "Tôi tự nhắc mình tập trung khi bị phân tâm." },
  { id: "p4", dim: "performance", text: "Tôi ghi chú và tóm tắt lại những điểm quan trọng khi học." },

  // Self-Reflection (đánh giá sau khi học)
  { id: "r1", dim: "reflection", text: "Sau khi học xong, tôi đánh giá xem mình đã đạt mục tiêu chưa." },
  { id: "r2", dim: "reflection", text: "Tôi suy nghĩ xem chiến lược nào hiệu quả, chiến lược nào không." },
  { id: "r3", dim: "reflection", text: "Tôi rút kinh nghiệm để cải thiện cho lần học sau." },
  { id: "r4", dim: "reflection", text: "Tôi quy thành công/thất bại học tập cho nỗ lực của bản thân." },
];

export interface SRLScore {
  total: number;
  forethought: number;
  performance: number;
  reflection: number;
}

export function scoreSRL(answers: Record<string, number>): SRLScore {
  const groups: Record<SRLPhaseDim, number[]> = {
    forethought: [],
    performance: [],
    reflection: [],
  };
  for (const q of SRL_QUESTIONS) {
    const v = answers[q.id];
    if (typeof v !== "number" || v < 1 || v > 5) continue;
    const score = q.reverse ? 6 - v : v;
    groups[q.dim].push(score);
  }
  const mean = (arr: number[]) =>
    arr.length === 0 ? 0 : arr.reduce((a, b) => a + b, 0) / arr.length;
  const forethought = mean(groups.forethought);
  const performance = mean(groups.performance);
  const reflection = mean(groups.reflection);
  const total = (forethought + performance + reflection) / 3;
  return {
    total: Number(total.toFixed(2)),
    forethought: Number(forethought.toFixed(2)),
    performance: Number(performance.toFixed(2)),
    reflection: Number(reflection.toFixed(2)),
  };
}

export function srlLevel(score: number): "low" | "medium" | "high" {
  if (score < 3) return "low";
  if (score < 4) return "medium";
  return "high";
}
