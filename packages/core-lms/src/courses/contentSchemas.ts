import { z } from "zod";

/**
 * URL or same-origin path. Accepts either:
 *   - an absolute http(s) URL (`https://example.com/foo`)
 *   - a same-origin absolute path (`/api/lesson-media/videos/abc.mp4`)
 *
 * Used for content payloads where the file may be either externally
 * hosted (YouTube, Vimeo, partner CDN) OR uploaded to our own
 * storage and served via a relative API route.
 *
 * Strict-URL fields (e.g. transcript URLs, external_link, embed) keep
 * `z.string().url()` since those are always external.
 */
export const UrlOrPath = z.string().refine(
  (v) => v.startsWith("/") || /^https?:\/\//i.test(v),
  { message: "must be an absolute http(s) URL or same-origin path starting with /" },
);

/**
 * In-video cuepoint that gates further playback on a quiz pass. The
 * player pauses when `currentTime` first crosses `atSec`, shows the
 * referenced quiz's questions inline, and only resumes when the learner
 * answers all questions correctly. Forward-seeking past an unpassed
 * cuepoint is blocked.
 *
 * Only triggers for native <video> playback (uploaded files / direct
 * .mp4/.webm URLs). Provider-iframe videos (YouTube/Vimeo/Loom/...)
 * silently ignore cuepoints — pausing those would require each
 * provider's JS API.
 */
export const VideoCuepoint = z.object({
  atSec: z.number().nonnegative(),
  quizId: z.string().uuid(),
});

export const VideoPayload = z.object({
  url: UrlOrPath,
  /**
   * Nhãn hiện dưới khung phát: tên video và nguồn.
   *
   * Trình phát của YouTube/Vimeo có sẵn tiêu đề bên trong khung, nhưng nó biến
   * mất khi video bắt đầu chạy và không nói người học nên xem cái gì trong đó.
   */
  title: z.string().max(200).optional(),
  /** Một tới hai câu: video nói gì và vì sao nó nằm ở bài này. */
  caption: z.string().max(600).optional(),
  /**
   * A2.7 — có thể là link ngoài (mở tab mới) HOẶC path file .vtt/.srt tự
   * upload qua /api/lesson-media/transcripts (cùng-origin, không phải URL
   * tuyệt đối) — dùng UrlOrPath như field `url` ở trên vì cùng lý do.
   * Đuôi .vtt/.srt bật hộp transcript đồng bộ (chỉ video YouTube); URL khác
   * hoặc video khác YouTube thì giữ hành vi cũ — link "Xem transcript" tĩnh.
   */
  transcriptUrl: UrlOrPath.optional(),
  durationSec: z.number().int().positive().optional(),
  cuepoints: z.array(VideoCuepoint).max(20).optional(),
});

export const MarkdownPayload = z.object({
  body: z.string().min(1).max(200_000),
});

/**
 * Rich-text content authored via WYSIWYG editor (Tiptap). Stored as HTML
 * string — server-side validation only enforces non-empty + length cap;
 * actual sanitization happens at render time via DOMPurify on the client.
 */
export const RichTextPayload = z.object({
  html: z.string().min(1).max(200_000),
});

export const EmbedPayload = z.object({
  url: z.string().url(),
  height: z.number().int().positive().optional(),
});

export const FilePayload = z.object({
  url: UrlOrPath,
  filename: z.string().min(1).max(200),
  sizeBytes: z.number().int().nonnegative().optional(),
  mimeType: z.string().max(200).optional(),
});

export const ExternalLinkPayload = z.object({
  url: z.string().url(),
  title: z.string().max(200).optional(),
});

export const PdfPayload = z.object({
  url: UrlOrPath,
  // Optional title shown above the embedded viewer.
  title: z.string().max(200).optional(),
  // Optional total page count — used for analytics later, not for rendering.
  totalPages: z.number().int().positive().optional(),
});

/**
 * GV upload 1 file .html duy nhất, hiển thị trong lesson qua iframe sandbox.
 * `url` cùng dạng UrlOrPath với PdfPayload — hoặc file tự upload qua
 * /api/lesson-media/html (path cùng-origin), hoặc URL ngoài đã host sẵn.
 */
export const HtmlBlockPayload = z.object({
  url: UrlOrPath,
  title: z.string().max(200).optional(),
  // Mô tả rich-text hiển thị phía trên link mở tài nguyên — cùng cách soạn
  // và làm sạch với RichTextPayload.html ở trên (Tiptap + DOMPurify).
  body: z.string().max(200_000).optional(),
  // Chiều cao khung hiển thị (px). Không còn dùng để render (html_block giờ
  // là link mở tab mới, không nhúng iframe) — giữ lại cho payload cũ.
  heightPx: z.number().int().positive().max(4000).optional(),
});

/**
 * LANG G1 — bài nghe.
 *
 * `url` chặt hơn UrlOrPath: chỉ đường dẫn cùng-origin (file tự upload qua
 * /api/lesson-media/audio) hoặc https. Audio http trên trang https bị trình duyệt
 * chặn (mixed content) nên nhận vào chỉ là nhận một bài nghe sẽ im lặng. Đường
 * dẫn bắt đầu bằng `//` hay `/\` là protocol-relative — trỏ sang host khác dù
 * trông như đường dẫn nội bộ — nên bị loại.
 */
export const AudioUrl = z.string().refine(
  (v) => (v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\")) || /^https:\/\//i.test(v),
  { message: "must be an https URL or a same-origin path starting with a single /" },
);

export const AudioPayload = z.object({
  url: AudioUrl,
  title: z.string().max(200).optional(),
  caption: z.string().max(600).optional(),
  /** Văn bản thuần (không HTML). Hiển thị trong khối gấp lại được. */
  transcript: z.string().max(20_000).optional(),
  /**
   * false = không gửi lời thoại cho học viên (bài nghe-hiểu: lời thoại là đáp án).
   * Mặc định hiện. Phía hiển thị phải bỏ hẳn nội dung, không chỉ ẩn bằng CSS.
   */
  showTranscript: z.boolean().optional(),
  durationSec: z.number().int().positive().optional(),
});

/**
 * LANG G2 — khối từ vựng và hội thoại.
 *
 * Tên trường trung lập ngôn ngữ (`term`/`reading`/`meaning`) để dùng cho tiếng
 * Trung (chữ Hán/pinyin) lẫn tiếng Anh (từ/IPA). Toàn bộ là văn bản thuần — chỗ
 * hiển thị dùng text node, không bao giờ HTML.
 *
 * Mỗi dòng/lượt có `id` (uuid) ổn định để G4 gắn flashcard vào đúng từ qua các
 * lần sửa. Server gán id cho dòng chưa có (nhập qua API, import) và giữ nguyên id
 * đã có. Id trùng nhau trong cùng khối bị từ chối.
 */
const newId = () => globalThis.crypto.randomUUID();
const reqText = (max: number) => z.string().trim().min(1).max(max);
// "" từ form coi như không điền: bỏ khỏi payload cho gọn.
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v === "" ? undefined : v));

function uniqueIds(items: Array<{ id?: string }>, ctx: z.RefinementCtx) {
  const seen = new Set<string>();
  items.forEach((it, i) => {
    if (!it.id) return;
    if (seen.has(it.id)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "duplicate id", path: [i, "id"] });
    }
    seen.add(it.id);
  });
}

export const VocabItem = z.object({
  id: z.string().uuid().optional(),
  term: reqText(200),
  reading: optText(200),
  meaning: reqText(500),
  example: optText(1000),
  exampleReading: optText(1000),
  exampleMeaning: optText(1000),
  note: optText(500),
  audioUrl: AudioUrl.optional(),
});

export const VocabListPayload = z.object({
  title: optText(200),
  /** Nhãn cột phiên âm do giảng viên đặt ("Pinyin", "IPA"...); mặc định hiển thị "Phiên âm". */
  readingLabel: optText(40),
  items: z
    .array(VocabItem)
    .min(1)
    .max(300)
    .superRefine(uniqueIds)
    .transform((items) => items.map((it) => ({ ...it, id: it.id ?? newId() }))),
});

/** LANG K2 — mốc bắt đầu của lượt trong audio cả đoạn: giây, làm tròn 0,1; tối đa 6 giờ. */
const MAX_TURN_START_SEC = 6 * 60 * 60;
const StartSec = z
  .number()
  .finite()
  .min(0)
  .max(MAX_TURN_START_SEC)
  .transform((n) => Math.round(n * 10) / 10);

export const DialogueTurn = z.object({
  id: z.string().uuid().optional(),
  speaker: reqText(40),
  text: reqText(1000),
  reading: optText(1000),
  translation: optText(1000),
  audioUrl: AudioUrl.optional(),
  /** K2 — thời điểm lượt này bắt đầu trong `DialoguePayload.audioUrl`; thiếu = lượt chưa có mốc. */
  startSec: StartSec.optional(),
});

/** K2a.2 — các lượt CÓ mốc phải tăng dần theo thứ tự lượt (lượt không mốc ở giữa không cản). */
function increasingStartSec(turns: Array<{ startSec?: number }>, ctx: z.RefinementCtx) {
  let prev: { idx: number; sec: number } | null = null;
  turns.forEach((t, i) => {
    if (t.startSec === undefined) return;
    if (prev && t.startSec <= prev.sec) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [i, "startSec"],
        message: `Lượt ${i + 1} bắt đầu ${t.startSec === prev.sec ? "cùng lúc với" : "trước"} lượt ${prev.idx + 1}: mốc thời gian phải tăng dần theo thứ tự lượt.`,
      });
    }
    prev = { idx: i, sec: t.startSec };
  });
}

export const DialoguePayload = z.object({
  title: optText(200),
  caption: optText(600),
  readingLabel: optText(40),
  /** Audio cả bài (tuỳ chọn), ngoài audio riêng từng lượt. */
  audioUrl: AudioUrl.optional(),
  turns: z
    .array(DialogueTurn)
    .min(1)
    .max(100)
    .superRefine(uniqueIds)
    .superRefine(increasingStartSec)
    .transform((turns) => turns.map((t) => ({ ...t, id: t.id ?? newId() }))),
});

export const ScormPayload = z.object({
  packageId: z.string().uuid(),
  title: z.string().max(200).optional(),
  // Optional entry override — relative path inside the SCORM zip. Defaults to
  // the resource href in the manifest. Use to point at a specific page when
  // the manifest entry is a placeholder (e.g. CP samples).
  entryHref: z.string().max(500).optional(),
});

export const LtiPayload = z.object({
  toolId: z.string().uuid(),
  title: z.string().max(200).optional(),
  // Optional resource_link_id override — defaults to ContentItem.id at render time.
  resourceLinkId: z.string().max(200).optional(),
});

export const H5pPayload = z.object({
  packageId: z.string().uuid(),
  title: z.string().max(200).optional(),
});

/**
 * Ghi chú của giảng viên, hiển thị xen giữa nội dung nhưng chỉ cho người có
 * quyền sửa khoá. Cùng hình dạng với richtext để dùng lại đúng bộ soạn thảo và
 * đúng đường làm sạch HTML — khác nhau ở chỗ ai được nhìn thấy, không ở chỗ nó
 * chứa gì.
 */
export const TeacherNotePayload = z.object({
  html: z.string().min(1).max(200_000),
});

const PAYLOAD_BY_TYPE = {
  video: VideoPayload,
  markdown: MarkdownPayload,
  richtext: RichTextPayload,
  embed: EmbedPayload,
  file: FilePayload,
  external_link: ExternalLinkPayload,
  pdf: PdfPayload,
  scorm: ScormPayload,
  lti: LtiPayload,
  h5p: H5pPayload,
  teacher_note: TeacherNotePayload,
  html_block: HtmlBlockPayload,
  audio: AudioPayload,
  vocab_list: VocabListPayload,
  dialogue: DialoguePayload,
} as const;

export type ContentTypeKey = keyof typeof PAYLOAD_BY_TYPE;

/** Validate that a payload matches the schema for its content type. */
export function validateContentPayload(
  type: ContentTypeKey,
  rawPayload: unknown,
): Record<string, unknown> {
  const schema = PAYLOAD_BY_TYPE[type];
  return schema.parse(rawPayload) as Record<string, unknown>;
}
