/**
 * Ví dụ minh hoạ hiện trong placeholder của các ô nhập câu hỏi, để GV thấy ngay
 * mỗi ô cần điền kiểu gì. Chỉ là gợi ý hiển thị — không bao giờ được lưu.
 */

export const PROMPT_EXAMPLE: Record<string, string> = {
  mcq: "VD: Thủ đô của Việt Nam là thành phố nào?",
  true_false: "VD: Hà Nội là thủ đô của Việt Nam.",
  fill_in: "VD: Thủ đô của Việt Nam là ...",
  short_answer: "VD: Thủ đô của Việt Nam là gì?",
  numerical: "VD: Chu vi hình vuông cạnh 5 cm là bao nhiêu?",
  ordering: "VD: Sắp xếp các bước giải phương trình bậc hai theo đúng thứ tự.",
  matching: "VD: Ghép mỗi nước với thủ đô của nước đó.",
  drag_drop_fill: "VD: Một đội bóng đá có 11 cầu thủ, thi đấu trong 2 hiệp.",
  essay: "VD: Phân tích ưu và nhược điểm của học tập trực tuyến.",
};

export const EXPLANATION_EXAMPLE: Record<string, string> = {
  mcq: "VD: Hà Nội là thủ đô từ năm 1010; Hồ Chí Minh là thành phố lớn nhất nhưng không phải thủ đô.",
  true_false: "VD: Đúng, Hà Nội là thủ đô của nước Việt Nam.",
  numerical: "VD: Chu vi hình vuông = 4 × cạnh = 4 × 5 = 20 cm.",
  ordering: "VD: Phải tính delta trước thì mới biết phương trình có nghiệm hay không.",
  matching: "VD: Mỗi nước chỉ có một thủ đô, hãy đối chiếu lại bảng các nước.",
  drag_drop_fill: "VD: Luật bóng đá quy định mỗi đội có 11 cầu thủ và 2 hiệp chính.",
};
const EXPLANATION_DEFAULT = "VD: Vì sao đáp án này đúng?";
export function explanationExample(type: string): string {
  return EXPLANATION_EXAMPLE[type] ?? EXPLANATION_DEFAULT;
}

const OPTION_EXAMPLES: Record<string, string[]> = {
  mcq: ["Hà Nội", "Thành phố Hồ Chí Minh", "Đà Nẵng", "Huế"],
  fill_in: ["Hà Nội", "Thủ đô Hà Nội"],
  short_answer: ["Hà Nội", "Thủ đô Hà Nội"],
  ordering: [
    "Bước 1: Xác định hệ số a, b, c",
    "Bước 2: Tính biệt thức delta",
    "Bước 3: Tìm nghiệm của phương trình",
    "Bước 4: Kiểm tra lại nghiệm",
  ],
};
/** Ví dụ cho đáp án thứ `i` (0-based) của loại `type`; rỗng nếu không có. */
export function optionExample(type: string, i: number): string | undefined {
  const list = OPTION_EXAMPLES[type];
  const v = list?.[i];
  return v ? `VD: ${v}` : undefined;
}

export const MATCHING_EXAMPLES: Array<[string, string]> = [
  ["Việt Nam", "Hà Nội"],
  ["Nhật Bản", "Tokyo"],
  ["Pháp", "Paris"],
  ["Thái Lan", "Bangkok"],
];

/** Đáp án gợi ý cho ô trống thứ n (1-based) trong câu kéo thả mẫu. */
export const DRAG_DROP_ANSWER_EXAMPLES = ["11", "2", "90"];
export const DRAG_DROP_DISTRACTOR_EXAMPLE = "10";

export const NUMERICAL_EXAMPLE = { expected: "VD: 20", tolerance: "VD: 0.1" };
