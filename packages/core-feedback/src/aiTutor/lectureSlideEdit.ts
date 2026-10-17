import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError, callJsonModel } from "./generators";
import { DRAFTS_SCHEMA, SLIDE_SPEC, type RawSlideDraft } from "./lectureSlides";
import { OUTLINE_MAX_SOURCE_CHARS } from "./lectureOutline";

/**
 * Nhờ AI sửa MỘT slide đã có (tiêu chí H8). Chỉ trả đề xuất; giảng viên xem bản so sánh rồi
 * mới chấp nhận, nên không bao giờ ghi thẳng vào slide. Dùng lại lược đồ và đặc tả trường của
 * bước sinh slide để đầu ra đi qua cùng một bộ kiểm tra (draftToSlide ở phía web).
 */

export const SLIDE_EDIT_ACTIONS = ["shorter", "example", "simpler", "to_quiz", "rewrite"] as const;
export type SlideEditAction = (typeof SLIDE_EDIT_ACTIONS)[number];

export interface SlideEditInput {
  action: SlideEditAction;
  /** Văn bản tài liệu gốc (có thể rỗng với bài soạn tay). */
  sourceText: string;
  deckTitle: string;
  /** Khoá đặc tả của slide đích: tên bố cục, hoặc "quiz". */
  targetKey: string;
  /** Nội dung hiện tại của slide (JSON, đã bỏ các khoá meta). */
  current: Record<string, unknown>;
  /** Dòng dàn ý gốc (dùng cho "rewrite"). */
  outlineTitle?: string;
  outlinePoints?: string[];
}

const ACTION_TEXT: Record<SlideEditAction, string> = {
  shorter:
    "Viết NGẮN GỌN hơn: giữ nguyên ý, số mục và thứ tự; mỗi câu ngắn hơn nhưng vẫn là câu hoàn chỉnh có chủ ngữ và vị ngữ.",
  example:
    "Thêm MỘT VÍ DỤ cụ thể vào nội dung hiện tại (lồng vào một mục hoặc một câu, không thêm mục mới, không đổi số mục). Ưu tiên ví dụ lấy từ tài liệu; nếu tài liệu không có ví dụ phù hợp, viết một ví dụ minh hoạ trung tính và KHÔNG bịa số liệu, tên người hay nguồn.",
  simpler:
    "Viết lại bằng từ ngữ ĐƠN GIẢN, dễ hiểu hơn cho người mới học; giữ nguyên ý, số mục và thứ tự; vẫn là câu hoàn chỉnh.",
  to_quiz:
    "Biến nội dung của slide này thành MỘT câu hỏi trắc nghiệm kiểm tra người học đã hiểu ý chính chưa. Phương án sai phải hợp lý, phản ánh hiểu lầm thường gặp.",
  rewrite:
    "Viết lại slide này từ đầu theo dàn ý gốc và tài liệu, bỏ qua nội dung hiện tại nếu cần; bám sát tiêu đề và ý chính của dàn ý.",
};

export function buildSlideEditPrompt(input: SlideEditInput): { system: string; user: string } {
  const system = `Bạn là giảng viên giàu kinh nghiệm, đang chỉnh sửa MỘT slide trong bài giảng tương tác.

Yêu cầu chỉnh sửa: ${ACTION_TEXT[input.action]}

Quy tắc bắt buộc:
1. Chỉ trả về MỘT slide, "index" là 0.
2. Văn phong khoa học, rõ ràng. Mọi mô tả, ý chính, giải thích phải là CÂU HOÀN CHỈNH có chủ ngữ và vị ngữ, kết thúc bằng dấu chấm. KHÔNG viết cụt.
3. Chỉ dùng thông tin có trong slide hiện tại và tài liệu. TUYỆT ĐỐI không bịa số liệu, tên người, trích dẫn hay nguồn nghiên cứu.
4. KHÔNG dùng emoji hay ký hiệu trang trí. Giữ nguyên thuật ngữ tiếng Anh nếu nội dung hiện tại dùng.
5. Chỉ điền các trường được yêu cầu cho bố cục đích; mọi trường khác để chuỗi rỗng hoặc mảng rỗng. Trường "notes": 2 đến 4 câu lời giảng cho giảng viên.
6. byline luôn để rỗng.

Trả về JSON đúng cấu trúc yêu cầu.`;
  const outline =
    input.outlineTitle || input.outlinePoints?.length
      ? `\n# Dòng dàn ý gốc\nTiêu đề: ${input.outlineTitle ?? ""}\nÝ chính: ${(input.outlinePoints ?? []).join(" | ")}\n`
      : "";
  const user = `# Bài giảng: ${input.deckTitle}

# Slide hiện tại (JSON)
${JSON.stringify(input.current).slice(0, 4000)}
${outline}
# Bố cục đích: "${input.targetKey}"
Điền: ${SLIDE_SPEC[input.targetKey] ?? SLIDE_SPEC.image}
${
  input.sourceText.trim()
    ? `\n# Tài liệu\n"""\n${input.sourceText.slice(0, OUTLINE_MAX_SOURCE_CHARS)}\n"""`
    : "\n(Không có tài liệu gốc; chỉ dùng nội dung slide hiện tại.)"
}`;
  return { system, user };
}

export async function generateSlideEdit(
  userId: string,
  input: SlideEditInput,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<RawSlideDraft> {
  if (!SLIDE_EDIT_ACTIONS.includes(input.action)) throw new AiGenerationError("validation_failed", "bad_action");
  // Như mọi generator: hết hạn mức thì dừng trước khi chạm mô hình.
  await assertWithinCaps(userId, db, "generator");

  const { system, user } = buildSlideEditPrompt(input);
  const { data, inputTokens, outputTokens } = await callJsonModel<{ slides: RawSlideDraft[] }>(
    openai,
    model,
    system,
    user,
    "lecture_slide_edit",
    DRAFTS_SCHEMA,
    2000,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  const first = Array.isArray(data?.slides) ? data.slides[0] : undefined;
  if (!first) throw new AiGenerationError("json_parse_failed", "slide_edit_shape");
  return first;
}
