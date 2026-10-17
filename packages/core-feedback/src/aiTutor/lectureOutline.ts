import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError, callJsonModel } from "./generators";

/**
 * Bước 1 của "tài liệu → bài giảng tương tác": đọc tài liệu và đề xuất DÀN Ý slide.
 * Chỉ trả dàn ý (tiêu đề, ý chính, bố cục, loại slide) — chưa viết nội dung chi tiết, nên
 * rẻ và giảng viên sửa được trước khi tốn token sinh slide.
 *
 * Kết quả là đề xuất thô; việc ép số slide, bố cục hợp lệ, độ dài, bỏ emoji nằm ở
 * apps/web/src/lib/limioLiveOutline.ts (normalizeOutline), không tin thẳng đầu ra mô hình.
 */

/** Số ký tự tối đa của tài liệu đưa vào một lần gọi (≈ 8–10 nghìn token). */
export const OUTLINE_MAX_SOURCE_CHARS = 24_000;
export const OUTLINE_MIN_SOURCE_CHARS = 200;

export const OUTLINE_CONTENT_LAYOUTS = ["cover", "section", "image", "cards", "compare", "steps", "stats", "quote", "summary"] as const;
/**
 * Loại slide trong dàn ý. "draw_it" là Dán Note ở chế độ vẽ; khi tạo slide nó thành collaborate_board
 * với mode "drawing" (xem limioLiveGenerate). Tên khớp với bộ chọn loại slide trong trình sửa bài giảng.
 */
export const OUTLINE_KINDS = ["content", "quiz", "poll", "word_cloud", "collaborate_board", "draw_it", "whiteboard"] as const;

export interface LectureOutlineInput {
  sourceText: string;
  /** Thời lượng buổi giảng (phút) — chỉ để nhắc mô hình; số slide do min/max quyết định. */
  minutes: number;
  minSlides: number;
  maxSlides: number;
  /** Cứ bấy nhiêu slide nội dung thì có một slide tương tác. */
  interactiveEvery: number;
}

export interface RawOutlineSlide {
  kind: (typeof OUTLINE_KINDS)[number];
  layout: string | null;
  title: string;
  points: string[];
}

export interface RawOutline {
  title: string;
  slides: RawOutlineSlide[];
}

const OUTLINE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" },
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          kind: { type: "string", enum: [...OUTLINE_KINDS] },
          layout: { type: ["string", "null"], enum: [...OUTLINE_CONTENT_LAYOUTS, null] },
          title: { type: "string" },
          points: { type: "array", items: { type: "string" } },
        },
        required: ["kind", "layout", "title", "points"],
      },
    },
  },
  required: ["title", "slides"],
};

export function buildOutlinePrompt(input: LectureOutlineInput): { system: string; user: string } {
  const system = `Bạn là giảng viên giàu kinh nghiệm, đang soạn DÀN Ý bài giảng tương tác từ một tài liệu.

Nhiệm vụ: đề xuất dàn ý từ ${input.minSlides} đến ${input.maxSlides} slide cho buổi giảng khoảng ${input.minutes} phút. Chỉ viết DÀN Ý (tiêu đề và ý chính), chưa viết nội dung chi tiết.

Quy tắc bắt buộc:
1. Slide đầu tiên có layout "cover" (bìa). Slide nội dung cuối cùng có layout "summary" (tóm tắt các điều cần ghi nhớ). Chia bài thành các phần hợp lý, dùng layout "section" để mở phần lớn nếu bài dài.
2. Cứ khoảng ${input.interactiveEvery} slide nội dung thì chen một slide tương tác (kind "quiz", "poll" hoặc "word_cloud") để kiểm tra hiểu bài hoặc khơi gợi ý kiến. Slide tương tác có layout null; "title" là câu hỏi hoặc câu gợi ý bằng một câu hoàn chỉnh; "points" để mảng rỗng. Không đặt slide tương tác ở đầu hoặc cuối bài.
   Ba loại cộng tác sau dùng tiết kiệm, tối đa một slide mỗi loại cho cả bài, và chỉ khi nội dung thật sự hợp (thay cho một slide tương tác thường, không cộng thêm):
   - "collaborate_board": cả lớp cùng dán ghi chú ngắn lên một bảng chung (thu ví dụ, vướng mắc, ý tưởng); "title" là lời mời học viên dán.
   - "draw_it": mỗi học viên vẽ một hình hoặc sơ đồ rồi đăng lên bảng; chỉ dùng khi nội dung có hình dung (quy trình, cấu trúc, mối quan hệ); "title" là yêu cầu vẽ.
   - "whiteboard": bảng trắng cho cả lớp cùng giải hoặc phác một bài toán, một tình huống; "title" là đề bài hoặc tình huống.
3. Slide nội dung (kind "content") chọn layout phù hợp nhất với nội dung:
   - "image": một ý chính kèm tối đa 3 ý hỗ trợ.
   - "cards": 3 ý song song (mỗi ý có tiêu đề ngắn và một câu giải thích).
   - "compare": đối chiếu 2 cách làm hoặc 2 khái niệm.
   - "steps": một quy trình 3 đến 5 bước.
   - "stats": 2 đến 4 con số nổi bật. CHỈ dùng khi các con số CÓ TRONG TÀI LIỆU; nếu không thì chọn layout khác.
   - "quote": một thông điệp hoặc câu trích dẫn có trong tài liệu.
4. "points": 1 đến 3 câu hoàn chỉnh, có chủ ngữ và vị ngữ, ngắn gọn (mỗi câu dưới 20 từ). Văn phong khoa học, rõ ràng. KHÔNG viết cụt (không chỉ liệt kê cụm từ). Với "cards" và "steps": mỗi phần tử của "points" có dạng "Tiêu đề ngắn: một câu giải thích đầy đủ.".
5. Chỉ dùng thông tin có trong tài liệu. TUYỆT ĐỐI không bịa số liệu, tên người, trích dẫn hay nguồn nghiên cứu.
6. KHÔNG dùng emoji hay ký hiệu trang trí. Viết bằng tiếng Việt (giữ nguyên thuật ngữ tiếng Anh nếu tài liệu dùng).
7. "title" của cả bài là một cụm danh từ ngắn nêu chủ đề.

Trả về JSON đúng cấu trúc yêu cầu.`;
  const user = `# Tài liệu
"""
${input.sourceText.slice(0, OUTLINE_MAX_SOURCE_CHARS)}
"""`;
  return { system, user };
}

export async function generateLectureOutline(
  userId: string,
  input: LectureOutlineInput,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<RawOutline> {
  const text = input.sourceText.trim();
  if (text.length < OUTLINE_MIN_SOURCE_CHARS) {
    throw new AiGenerationError("validation_failed", "too_short");
  }
  if (!(input.minSlides >= 3 && input.maxSlides >= input.minSlides && input.maxSlides <= 40)) {
    throw new AiGenerationError("validation_failed", "bad_slide_range");
  }
  // Như mọi generator: hết hạn mức thì dừng TRƯỚC khi chạm mô hình.
  await assertWithinCaps(userId, db, "generator");

  const { system, user } = buildOutlinePrompt({ ...input, sourceText: text });
  const { data, inputTokens, outputTokens } = await callJsonModel<RawOutline>(
    openai,
    model,
    system,
    user,
    "lecture_outline",
    OUTLINE_SCHEMA,
    3500,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  if (!data || typeof data.title !== "string" || !Array.isArray(data.slides)) {
    throw new AiGenerationError("json_parse_failed", "outline_shape");
  }
  return data;
}
