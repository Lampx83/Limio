import type { ExamRun } from "@feedbackme/core-lms";

// Tách khỏi ExamRunsList ("use client") vì trang Lịch sử thi là server
// component: nó cần đọc nhãn/màu để vẽ tab, mà server không được chấm vào
// hằng số của một module client.

export type RunKind = "quick" | "field-test" | "formal";

export function runKind(r: Pick<ExamRun, "scale" | "purpose">): RunKind {
  if (r.scale === "formal") return "formal";
  return r.purpose === "field_test" ? "field-test" : "quick";
}

/**
 * Mỗi hình thức một màu — để lướt Lịch sử thi là tách được ba loại mà không
 * cần đọc chữ. Dùng đúng ba màu brand của Limio (lime của logo, hồng của
 * "ruột dưa hấu", cam vàng accent của nút Đấu trường) thay vì màu tự chọn.
 * Kỳ thi chính thức — loại trang trọng nhất — mang màu lime chủ đạo.
 * Class viết nguyên văn vì Tailwind chỉ sinh CSS cho chuỗi nó thấy trong code.
 */
export const RUN_KIND: Record<
  RunKind,
  { label: string; stripe: string; chip: string; icon: string }
> = {
  quick: {
    label: "Link thi nhanh",
    stripe: "bg-pink-500",
    chip: "bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-200",
    icon: "text-pink-500",
  },
  "field-test": {
    label: "Thử nghiệm câu hỏi",
    stripe: "bg-accent-500",
    chip: "bg-accent-50 text-accent-800 ring-1 ring-inset ring-accent-200",
    icon: "text-accent-600",
  },
  formal: {
    label: "Kỳ thi chính thức",
    stripe: "bg-brand-500",
    chip: "bg-brand-50 text-brand-800 ring-1 ring-inset ring-brand-200",
    icon: "text-brand-600",
  },
};
