export type GenerativeActivityType =
  | "summarizing"
  | "mapping"
  | "drawing"
  | "imagining"
  | "self_explaining"
  | "teaching"
  | "enacting";

export type ResponseFormat =
  | "text"
  | "file"
  | "image"
  | "audio"
  | "video"
  | "concept_map"
  | "mixed";

export type AssessmentMode =
  | "instructor_graded"
  | "self_assessed"
  | "ai_assessed"
  | "peer_reviewed";

interface Preset {
  label: string;
  description: string;
  promptTemplate: string;
  responseFormat: ResponseFormat;
  /** P0 only ships text-based formats; non-text shown but flagged "sắp ra mắt". */
  available: boolean;
}

export const GENERATIVE_PRESETS: Record<GenerativeActivityType, Preset> = {
  summarizing: {
    label: "Tóm tắt",
    description: "Người học viết/nói lại nội dung bằng lời mình",
    promptTemplate:
      "Hãy tóm tắt nội dung bài học bằng lời của riêng bạn (khoảng 150–250 từ). Không sao chép nguyên văn; tập trung vào ý chính và cách bạn hiểu.",
    responseFormat: "text",
    available: true,
  },
  self_explaining: {
    label: "Tự giải thích",
    description: "Người học giải thích vì sao điều đó đúng/xảy ra",
    promptTemplate:
      "Giải thích vì sao kết quả/khái niệm này đúng. Trình bày lập luận từng bước; nếu có ví dụ, hãy đưa ra một ví dụ cụ thể.",
    responseFormat: "text",
    available: true,
  },
  imagining: {
    label: "Tưởng tượng",
    description: "Người học tưởng tượng/hình dung tình huống mô tả",
    promptTemplate:
      "Hình dung tình huống mô tả trong bài. Mô tả lại bằng lời những gì bạn thấy/nghe/cảm nhận, và cho biết chi tiết nào giúp bạn hiểu khái niệm rõ hơn.",
    responseFormat: "text",
    available: true,
  },
  mapping: {
    label: "Vẽ sơ đồ",
    description: "Người học tạo concept map / knowledge map / matrix",
    promptTemplate:
      "Vẽ sơ đồ tư duy / concept map cho nội dung này. Tải lên file ảnh hoặc đường dẫn (Miro, draw.io...). Trong phần văn bản, mô tả ngắn gọn các nút chính và quan hệ.",
    responseFormat: "mixed",
    available: true,
  },
  drawing: {
    label: "Vẽ minh hoạ",
    description: "Người học vẽ tay/digital để biểu diễn nội dung",
    promptTemplate:
      "Vẽ minh hoạ cho khái niệm/quá trình này. Tải lên ảnh bản vẽ; viết 2–3 câu giải thích ý tưởng đằng sau hình.",
    responseFormat: "mixed",
    available: true,
  },
  teaching: {
    label: "Dạy lại",
    description: "Người học dạy nội dung cho người khác (thật hoặc mô phỏng)",
    promptTemplate:
      "Hãy dạy lại nội dung này như thể bạn đang giải thích cho một người chưa biết gì. Tải lên video (1–3 phút) hoặc viết kịch bản dạy.",
    responseFormat: "mixed",
    available: true,
  },
  enacting: {
    label: "Diễn thực hành",
    description: "Người học thực hiện hành động/cử chỉ minh hoạ",
    promptTemplate:
      "Thực hiện thao tác/hành động minh hoạ cho khái niệm. Quay video ngắn hoặc mô tả bằng văn bản các bước bạn đã làm.",
    responseFormat: "mixed",
    available: true,
  },
};

/** True when the response format implies an uploaded artifact alongside text. */
export function requiresUpload(format: ResponseFormat): boolean {
  return format !== "text";
}

/** Accept-attr for the file input. Wider than enforced server-side; server is the gate. */
export function acceptForFormat(format: ResponseFormat): string | undefined {
  switch (format) {
    case "image":
      return "image/*";
    case "audio":
      return "audio/*";
    case "video":
      return "video/*";
    case "concept_map":
      return "image/*,application/pdf,application/json";
    case "mixed":
      return "image/*,audio/*,video/*,application/pdf";
    case "file":
      return undefined;
    default:
      return undefined;
  }
}

export const GENERATIVE_TYPE_OPTIONS: Array<{
  value: GenerativeActivityType;
  label: string;
  available: boolean;
}> = (
  Object.keys(GENERATIVE_PRESETS) as GenerativeActivityType[]
).map((v) => ({
  value: v,
  label: GENERATIVE_PRESETS[v].label,
  available: GENERATIVE_PRESETS[v].available,
}));
