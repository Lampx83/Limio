import type { LessonLayoutKey } from "./lessonLook";

/**
 * "Tạo bài từ tài liệu" — kiểu dữ liệu dùng chung giữa AI lập dàn ý
 * (core-feedback), dịch vụ lưu nháp (core-lms) và trang soạn (web). Chỉ khai
 * báo hình dạng và hằng số; việc làm sạch, kiểm tra nằm ở
 * apps/web/src/lib/lessonOutline.ts.
 */

/** Một đoạn của tài liệu gốc sau khi tách: chữ, hoặc một ảnh (giữ từ file Word). */
export type SourcePara = { t: string } | { img: string; alt: string };

/** Các hộp giảng viên dự kiến đặt trong một mục (Mục tiêu và Tổng kết là của cả bài). */
export const OUTLINE_BOX_KINDS = ["note", "example", "definition"] as const;
export type OutlineBoxKind = (typeof OUTLINE_BOX_KINDS)[number];

export interface OutlineSection {
  /** Định danh ổn định để kéo thả và sửa — không phải số thứ tự. */
  id: string;
  title: string;
  layout: LessonLayoutKey;
  /** Ý chính, mỗi ý một câu ngắn. */
  points: string[];
  boxes: OutlineBoxKind[];
  /** Chỉ số các đoạn tài liệu (bắt đầu từ 0) thuộc mục này. Mỗi đoạn thuộc tối đa một mục. */
  paras: number[];
}

/** Một bài học trong dàn ý. Tài liệu dài có thể được gợi ý tách thành nhiều bài. */
export interface OutlineLesson {
  id: string;
  title: string;
  objectives: string[];
  sections: OutlineSection[];
}

export interface LessonOutline {
  lessons: OutlineLesson[];
  /** Đoạn tài liệu giảng viên chủ động bỏ (lời chào, tài liệu tham khảo…). */
  ignoredParas: number[];
}

export const LESSON_WRITING_MODES = ["keep", "edit"] as const;
export type LessonWritingMode = (typeof LESSON_WRITING_MODES)[number];

export const LESSON_WRITING_LABELS: Record<LessonWritingMode, string> = {
  keep: "Giữ nguyên lời",
  edit: "Biên tập cho mạch lạc",
};

export const LESSON_WRITING_HINTS: Record<LessonWritingMode, string> = {
  keep: "Giữ câu chữ của tài liệu, chỉ sửa chính tả và sắp xếp.",
  edit: "Được viết lại câu cho mạch lạc, không đổi ý và số liệu.",
};

export function isLessonWritingMode(v: unknown): v is LessonWritingMode {
  return typeof v === "string" && (LESSON_WRITING_MODES as readonly string[]).includes(v);
}

/** Giới hạn của dàn ý — dùng chung cho lời nhắc AI và bước làm sạch. */
export const OUTLINE_LIMITS = {
  maxLessons: 6,
  maxSectionsPerLesson: 8,
  /** Quá số mục này trong một bài thì gợi ý tách bài (D5). */
  splitSuggestSections: 5,
  /** Hoặc quá số phút đọc này. */
  splitSuggestMinutes: 20,
  maxObjectives: 5,
  maxPoints: 6,
  titleMax: 160,
  pointMax: 300,
} as const;
