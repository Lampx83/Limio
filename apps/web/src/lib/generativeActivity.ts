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
  /** Học viên phải nộp gì — hiện trên thẻ chọn dạng bài làm của giảng viên. */
  submission: string;
  /** Nhãn ô tải file trên form nộp bài (chỉ dùng khi responseFormat đòi file). */
  uploadLabel: string;
  promptTemplate: string;
  responseFormat: ResponseFormat;
  /** P0 only ships text-based formats; non-text shown but flagged "sắp ra mắt". */
  available: boolean;
}

export const GENERATIVE_PRESETS: Record<GenerativeActivityType, Preset> = {
  summarizing: {
    label: "Tóm tắt",
    description: "Học viên viết lại nội dung bằng lời của mình",
    submission: "Nộp: bài viết",
    uploadLabel: "Tải lên file bài làm",
    promptTemplate:
      "Hãy tóm tắt nội dung bài học bằng lời của riêng bạn (khoảng 150–250 từ). Không sao chép nguyên văn; tập trung vào ý chính và cách bạn hiểu.",
    responseFormat: "text",
    available: true,
  },
  self_explaining: {
    label: "Tự giải thích",
    description: "Học viên giải thích vì sao điều đó đúng hoặc vì sao xảy ra",
    submission: "Nộp: bài viết",
    uploadLabel: "Tải lên file bài làm",
    promptTemplate:
      "Giải thích vì sao kết quả/khái niệm này đúng. Trình bày lập luận từng bước; nếu có ví dụ, hãy đưa ra một ví dụ cụ thể.",
    responseFormat: "text",
    available: true,
  },
  imagining: {
    label: "Hình dung tình huống",
    description: "Học viên hình dung tình huống trong bài rồi mô tả lại",
    submission: "Nộp: bài viết",
    uploadLabel: "Tải lên file bài làm",
    promptTemplate:
      "Hình dung tình huống mô tả trong bài. Mô tả lại bằng lời những gì bạn thấy/nghe/cảm nhận, và cho biết chi tiết nào giúp bạn hiểu khái niệm rõ hơn.",
    responseFormat: "text",
    available: true,
  },
  mapping: {
    label: "Vẽ sơ đồ",
    description: "Học viên vẽ sơ đồ tư duy thể hiện các ý chính và quan hệ giữa chúng",
    submission: "Nộp: bài viết + ảnh/PDF sơ đồ hoặc link (bắt buộc)",
    uploadLabel: "Tải lên ảnh hoặc file sơ đồ",
    promptTemplate:
      "Vẽ sơ đồ tư duy / concept map cho nội dung này. Tải lên file ảnh hoặc đường dẫn (Miro, draw.io...). Trong phần văn bản, mô tả ngắn gọn các nút chính và quan hệ.",
    responseFormat: "mixed",
    available: true,
  },
  drawing: {
    label: "Vẽ minh hoạ",
    description: "Học viên vẽ tranh hoặc hình minh hoạ cho nội dung (vẽ tay hoặc trên máy)",
    submission: "Nộp: bài viết + ảnh bản vẽ hoặc link (bắt buộc)",
    uploadLabel: "Tải lên ảnh bản vẽ",
    promptTemplate:
      "Vẽ minh hoạ cho khái niệm/quá trình này. Tải lên ảnh bản vẽ; viết 2–3 câu giải thích ý tưởng đằng sau hình.",
    responseFormat: "mixed",
    available: true,
  },
  teaching: {
    label: "Dạy lại",
    description: "Học viên giảng lại nội dung cho người khác và nộp video hoặc kịch bản",
    submission: "Nộp: bài viết + video, PDF kịch bản hoặc link (bắt buộc)",
    uploadLabel: "Tải lên video dạy lại hoặc PDF kịch bản",
    promptTemplate:
      "Hãy dạy lại nội dung này như thể bạn đang giải thích cho một người chưa biết gì. Tải lên video (1–3 phút) hoặc file PDF kịch bản dạy, hoặc dán link. Trong ô nội dung, tóm tắt ý chính bạn đã dạy.",
    responseFormat: "mixed",
    available: true,
  },
  enacting: {
    label: "Thực hành minh hoạ",
    description: "Học viên làm một thao tác thực tế rồi nộp video hoặc ảnh các bước",
    submission: "Nộp: bài viết + video/ảnh thao tác hoặc link (bắt buộc)",
    uploadLabel: "Tải lên video hoặc ảnh thao tác",
    promptTemplate:
      "Thực hiện thao tác/hành động minh hoạ cho khái niệm. Quay video ngắn (hoặc chụp ảnh từng bước) rồi tải lên hoặc dán link. Trong ô nội dung, mô tả các bước bạn đã làm.",
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
