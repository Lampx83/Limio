/**
 * Kiểu dùng chung của các ô nhập câu hỏi Sắp xếp / Ghép cặp / Kéo thả (QuestionInputs.tsx): dạng dữ liệu của Quiz. Đề thi dùng
 * chung các ô này qua lớp nối trong ExamQuestion (đổi từ config/đáp án của đề thi sang dạng này).
 */

export type QType =
  | "mcq"
  | "true_false"
  | "fill_in"
  | "ordering"
  | "matching"
  | "numerical"
  | "essay"
  | "short_answer"
  | "drag_drop_fill";

export interface Option {
  id: string;
  label: string;
  orderIndex: number;
  extra?: {
    side?: "left" | "right";
    pairKey?: string;
    blankIndex?: number | null;
  } | null;
}
export interface Question {
  id: string;
  type: QType;
  prompt: string;
  points: number;
  orderIndex: number;
  extra?: Record<string, unknown> | null;
  options: Option[];
  /** mcq với đúng 1 option đúng → hiện radio thay vì checkbox. Server tính
   *  sẵn (không lộ option nào đúng); mặc định false cho type khác mcq. */
  isSingleAnswer?: boolean;
}

export type Response =
  | string[]
  | string
  | number
  | Array<{ leftId: string; rightId: string }>
  // drag_drop_fill: map blank index (as string key) → option id placed.
  | { tokens: Record<string, string> };

export interface AnswerState {
  response: Response | null;
  confidence: number | null;
}
