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

/**
 * "Mẫu bài" — giảng viên chọn MỘT LẦN cho cả bài, thay cho việc chọn bố cục
 * và hộp ở từng mục (quyết định 2026-10-18: giảng viên ít việc hơn). Mẫu quyết
 * định khung các mục; cách trình bày từng mục do AI tự chọn theo quy tắc cố định.
 */
/**
 * Cách trình bày AI được tự chọn khi lập dàn ý — ít và dễ đoán (2026-10-18).
 * Trình soạn thảo vẫn có đủ 7 bố cục; ba bố cục còn lại chỉ do giảng viên chọn.
 */
export const OUTLINE_AUTO_LAYOUTS = ["text", "image", "steps", "faq"] as const satisfies readonly LessonLayoutKey[];

export const LESSON_TEMPLATE_KEYS = ["theory", "practice", "review"] as const;
export type LessonTemplateKey = (typeof LESSON_TEMPLATE_KEYS)[number];

export const LESSON_TEMPLATE_LABELS: Record<LessonTemplateKey, string> = {
  theory: "Bài lý thuyết",
  practice: "Bài hướng dẫn thực hành",
  review: "Bài ôn tập",
};

/** Khung bài hiện cho giảng viên khi chọn mẫu. */
export const LESSON_TEMPLATE_HINTS: Record<LessonTemplateKey, string> = {
  theory: "Mục tiêu → các mục nội dung theo tài liệu → Tổng kết",
  practice: "Mục tiêu → Chuẩn bị → Các bước → Lỗi thường gặp → Tổng kết",
  review: "Ý chính cần nhớ → Câu hỏi thường gặp → Tự kiểm tra",
};

export function isLessonTemplateKey(v: unknown): v is LessonTemplateKey {
  return typeof v === "string" && (LESSON_TEMPLATE_KEYS as readonly string[]).includes(v);
}

export interface LessonOutline {
  lessons: OutlineLesson[];
  /** Đoạn tài liệu giảng viên chủ động bỏ (lời chào, tài liệu tham khảo…). */
  ignoredParas: number[];
  /** Mẫu bài đã dùng để lập dàn ý. Thiếu = "theory" (bản nháp trước khi có mẫu). */
  template?: LessonTemplateKey;
  /**
   * true = tệp Word/Markdown được đưa thẳng vào MỘT bài, giữ nguyên định dạng của tệp
   * (tiêu đề, bảng, ảnh, danh sách), không qua AI và không có bước dàn ý.
   */
  keepFormat?: boolean;
}

/**
 * Số từ tối đa của MỘT bài học tạo từ tài liệu (khoảng 20 phút đọc). Vượt thì
 * không tự cắt thành nhiều bài: báo giảng viên để họ tự chia tệp theo ý mình.
 */
export const LESSON_MAX_WORDS = 4000;

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
  maxLessons: 1,
  maxSectionsPerLesson: 12,
  /** Số mục gợi ý mỗi bài cho AI (không phải trần cứng). */
  suggestSections: 5,
  maxObjectives: 5,
  maxPoints: 6,
  titleMax: 160,
  pointMax: 300,
} as const;

/**
 * Một mục do AI viết (Mốc 3), dạng có cấu trúc — máy chủ tự dựng HTML theo
 * các khối của bài (apps/web/src/lib/lessonRender.ts), AI không viết HTML.
 * Chữ được dùng **đậm** và *nghiêng*; ngoài ra là chữ thường.
 */
export interface SectionDraft {
  /** Các đoạn mở đầu mục, trước các phần. */
  intro: string[];
  parts: Array<{ title: string; paragraphs: string[]; bullets: string[] }>;
  boxes: Array<{ kind: OutlineBoxKind; title: string; paragraphs: string[] }>;
  /** Chú thích cho ảnh đầu tiên của mục (nếu mục có ảnh từ tài liệu). */
  imageCaption: string;
}

/** Bài AI đã viết từ dàn ý đã chốt, lưu trong bản nháp chờ "Áp dụng". */
export interface LessonDraftResult {
  /** HTML từng bài, cùng thứ tự với outline.lessons. */
  lessons: Array<{ title: string; html: string }>;
  /** Mục AI không viết được — đã dùng nguyên đoạn tài liệu (T5). */
  fallbackSections: string[];
  /** Cách "Giữ nguyên lời": đoạn tài liệu không thấy trong bài (T6), chỉ số từ 0. */
  missingParas: number[];
  writing: LessonWritingMode;
  generatedAt: string;
}
