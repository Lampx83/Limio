import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError, callJsonModel } from "./generators";
import { intentBlock, sourceBlock, type LectureSourceKind } from "./lectureOutline";

/**
 * Bổ sung slide tương tác cho một dàn ý còn thiếu (docs/tieu-chi/tao-bai-giang-mot-o.md, M17–M18): dàn ý AI soạn chưa đủ
 * mức tối thiểu, hoặc bài PowerPoint "Giữ ý, làm đẹp lại" (slide gốc giữ nguyên, AI chỉ viết thêm tương tác). Mô hình chỉ
 * đề xuất vị trí, loại và câu hỏi; phía web chèn theo luật và câu hỏi đầy đủ được viết ở bước tạo slide như mọi dòng khác.
 */

export const TOPUP_KINDS = ["quiz", "poll", "word_cloud", "collaborate_board", "draw_it", "whiteboard"] as const;

export interface TopUpOutlineRow {
  index: number;
  kind: string;
  layout: string | null;
  title: string;
  /** Tên phần (có thể rỗng). */
  part?: string;
}

export interface InteractionTopUpInput {
  sourceText: string;
  sourceKind?: LectureSourceKind;
  intent?: string;
  outline: TopUpOutlineRow[];
  /** Số slide tương tác cần thêm. */
  need: number;
  /** Trong số đó, ít nhất bấy nhiêu loại chưa có trong bài. */
  needKinds: number;
  existingKinds: string[];
  /** Bài đã có bảng trắng: không được thêm nữa. */
  whiteboardUsed: boolean;
}

export interface RawTopUpRow {
  afterIndex: number;
  kind: string;
  title: string;
}

const TOPUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          afterIndex: { type: "integer" },
          kind: { type: "string", enum: [...TOPUP_KINDS] },
          title: { type: "string" },
        },
        required: ["afterIndex", "kind", "title"],
      },
    },
  },
  required: ["slides"],
};

export function buildInteractionTopUpPrompt(input: InteractionTopUpInput): { system: string; user: string } {
  const missing = TOPUP_KINDS.filter((k) => k !== "whiteboard" && !input.existingKinds.includes(k));
  const system = `Bạn là giảng viên giàu kinh nghiệm, đang thêm slide tương tác vào một dàn ý bài giảng đã có để người học tham gia nhiều hơn.

Nhiệm vụ: đề xuất ĐÚNG ${input.need} slide tương tác mới. Mỗi slide gồm "afterIndex" (chèn ngay sau slide có chỉ số đó trong dàn ý), "kind" (loại) và "title" (câu hỏi hoặc lời mời, một câu hoàn chỉnh, sát nội dung slide đứng trước).

Quy tắc bắt buộc:
1. Rải đều các slide mới qua các phần của bài. Chèn sau một slide nội dung vừa giảng xong một ý; không hai slide tương tác liền nhau, không chèn sau slide cuối, không chèn ngay sau slide bìa hay slide mở phần (layout "section").
2. ${input.needKinds > 0 ? `Trong các slide mới có ít nhất ${input.needKinds} loại chưa có trong bài (${missing.join(", ")}).` : "Chọn loại hợp với mục đích; tránh lặp mãi một loại."}
3. Mục đích của từng loại: "poll" hoặc "word_cloud" khơi điều người học đã biết hoặc cho họ dự đoán; "quiz" kiểm tra hiểu bài bằng một tình huống áp dụng, không hỏi thuộc lòng; "collaborate_board" mời cả lớp dán ghi chú ngắn (ví dụ, vướng mắc, ý tưởng); "draw_it" mời mỗi người vẽ một sơ đồ khi nội dung có hình dung.
4. ${input.whiteboardUsed ? `KHÔNG dùng "whiteboard": bài đã có một bảng trắng.` : `"whiteboard" hạn chế: tối đa 1, chỉ khi có bài toán hoặc tình huống cần cả lớp cùng giải.`}
5. Chỉ dựa vào nội dung của dàn ý và nguồn bên dưới; không đưa số liệu, tên người hay trích dẫn không có trong nguồn. KHÔNG dùng emoji. Viết cùng ngôn ngữ với dàn ý.

Trả về JSON đúng cấu trúc yêu cầu.`;
  const lines = input.outline
    .map((r) => `${r.index}. ${r.part ? `(${r.part}) ` : ""}[${r.kind}${r.layout ? `/${r.layout}` : ""}] ${r.title}`)
    .join("\n");
  const user = `# Dàn ý hiện có (chỉ số. (phần) [loại/bố cục] tiêu đề)
${lines}

${intentBlock(input.intent)}${sourceBlock(input.sourceKind ?? "document", input.sourceText)}`;
  return { system, user };
}

export async function generateInteractionTopUp(
  userId: string,
  input: InteractionTopUpInput,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<RawTopUpRow[]> {
  if (input.need <= 0 || input.outline.length < 3) return [];
  await assertWithinCaps(userId, db, "generator");
  const { system, user } = buildInteractionTopUpPrompt(input);
  const { data, inputTokens, outputTokens } = await callJsonModel<{ slides: RawTopUpRow[] }>(
    openai,
    model,
    system,
    user,
    "lecture_interaction_topup",
    TOPUP_SCHEMA,
    1500,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);
  if (!data || !Array.isArray(data.slides)) throw new AiGenerationError("json_parse_failed", "topup_shape");
  return data.slides;
}
