// Lọc bài giảng Limio-Live trước khi đưa ra link xem công khai (/bai-giang/<mã>). Trang đó không cần đăng nhập,
// nên mọi thứ trả về ở đây coi như ai cũng đọc được — kể cả trong dữ liệu trang, không chỉ phần nhìn thấy.
// Vì vậy lọc ở máy chủ, theo nguyên tắc: slide tương tác chỉ giữ các khoá được liệt kê; slide nội dung bỏ các
// khoá meta (ghi chú giảng, dấu vết AI). Slide "ẩn khi trình chiếu" bị bỏ hẳn.

export type PublicSlideType = "content" | "quiz" | "poll" | "word_cloud" | "collaborate_board" | "whiteboard";

export interface PublicSlide {
  id: string;
  type: PublicSlideType;
  config: Record<string, unknown>;
}

/** Khoá meta của slide nội dung (xem pickMeta trong limioLiveSlides) — không bao giờ ra ngoài. */
const CONTENT_PRIVATE_KEYS = ["presenterNote", "hidden", "outlineId", "aiGenerated", "editedByUser"] as const;

const str = (v: unknown): string => (typeof v === "string" ? v : "");

function optionTexts(v: unknown): { text: string }[] {
  if (!Array.isArray(v)) return [];
  // Chỉ chép chữ của lựa chọn: cờ `correct` (đáp án đúng) ở lại máy chủ.
  return v.map((o) => ({ text: str((o as { text?: unknown } | null)?.text) }));
}

function publicConfig(type: PublicSlideType, raw: Record<string, unknown>): Record<string, unknown> {
  switch (type) {
    case "content": {
      const out: Record<string, unknown> = { ...raw };
      for (const k of CONTENT_PRIVATE_KEYS) delete out[k];
      return out;
    }
    case "quiz":
    case "poll":
      return { question: str(raw.question), options: optionTexts(raw.options) };
    case "word_cloud":
      return { prompt: str(raw.prompt) };
    case "collaborate_board":
      return {
        title: str(raw.title),
        prompt: str(raw.prompt),
        mode: str(raw.mode) || "free",
        columns: Array.isArray(raw.columns) ? raw.columns.filter((c): c is string => typeof c === "string") : [],
      };
    case "whiteboard":
      return { title: str(raw.title) };
  }
}

const TYPES = new Set<string>(["content", "quiz", "poll", "word_cloud", "collaborate_board", "whiteboard"]);

/** Slide theo thứ tự trình chiếu (đầu vào đã sắp), đã lọc để đưa ra link công khai. */
export function toPublicSlides(slides: { id: string; type: string; config: unknown }[]): PublicSlide[] {
  const out: PublicSlide[] = [];
  for (const s of slides) {
    if (!TYPES.has(s.type)) continue;
    const raw = s.config && typeof s.config === "object" && !Array.isArray(s.config) ? (s.config as Record<string, unknown>) : {};
    if (raw.hidden === true) continue;
    const type = s.type as PublicSlideType;
    out.push({ id: s.id, type, config: publicConfig(type, raw) });
  }
  return out;
}

/** Tên tệp PDF gợi ý khi in: tiêu đề bài, bỏ ký tự hệ điều hành không cho đặt tên. */
export function pdfTitle(deckTitle: string): string {
  const t = deckTitle.replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
  return t || "Bai giang";
}
