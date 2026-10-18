import type OpenAI from "openai";
import { prisma, type PrismaClient } from "@feedbackme/db";
import { DEFAULT_MODEL, assertWithinCaps, recordAiUsage } from "./aiTutor";
import { AiGenerationError, callJsonModel } from "./generators";
import { OUTLINE_KINDS, OUTLINE_MAX_SOURCE_CHARS } from "./lectureOutline";

/**
 * Bước 3 của "tài liệu → bài giảng tương tác": viết NỘI DUNG từng slide theo dàn ý đã được
 * giảng viên xác nhận. Gọi theo LÔ vài slide một lần (một lần cho cả bài sẽ vượt giới hạn
 * đầu ra), mỗi lô mang theo toàn bộ dàn ý để các slide mạch lạc với nhau.
 *
 * Đầu ra là bản nháp thô; ép bố cục, độ dài, loại bỏ emoji và kiểm tra quiz nằm ở
 * apps/web/src/lib/limioLiveGenerate.ts — không tin thẳng đầu ra mô hình.
 */

export interface OutlineSlideInput {
  /** Vị trí 0-based trong dàn ý; mô hình trả lại đúng chỉ số này. */
  index: number;
  kind: (typeof OUTLINE_KINDS)[number];
  layout: string | null;
  title: string;
  points: string[];
  /** Vai trò trong mạch bài (cover, objectives, agenda, hook, content, summary) và nhãn phần, để mô hình giữ mạch. */
  role?: string;
  part?: string;
}

export interface SlideDraftsInput {
  sourceText: string;
  deckTitle: string;
  /** Toàn bộ dàn ý (ngữ cảnh) và các chỉ số cần viết ở lô này. */
  outline: OutlineSlideInput[];
  batch: number[];
}

export interface RawSlideDraft {
  index: number;
  title: string;
  subtitle: string;
  byline: string;
  sectionNumber: string;
  bullets: string[];
  items: Array<{ heading: string; body: string; icon: string }>;
  columns: Array<{ heading: string; tone: string; points: string[]; note: string }>;
  footnote: string;
  quote: string;
  source: string;
  question: string;
  options: Array<{ text: string; correct: boolean }>;
  prompt: string;
  notes: string;
  table: { head: string[]; rows: string[][] };
  chart: { type: string; labels: string[]; series: Array<{ name: string; values: number[] }>; unit: string };
}

const STR = { type: "string" };
const STR_ARR = { type: "array", items: STR };

export const DRAFTS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    slides: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          title: STR,
          subtitle: STR,
          byline: STR,
          sectionNumber: STR,
          bullets: STR_ARR,
          items: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { heading: STR, body: STR, icon: STR },
              required: ["heading", "body", "icon"],
            },
          },
          columns: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { heading: STR, tone: { type: "string", enum: ["bad", "good"] }, points: STR_ARR, note: STR },
              required: ["heading", "tone", "points", "note"],
            },
          },
          footnote: STR,
          quote: STR,
          source: STR,
          question: STR,
          options: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: { text: STR, correct: { type: "boolean" } },
              required: ["text", "correct"],
            },
          },
          prompt: STR,
          notes: STR,
          table: {
            type: "object",
            additionalProperties: false,
            properties: { head: STR_ARR, rows: { type: "array", items: STR_ARR } },
            required: ["head", "rows"],
          },
          chart: {
            type: "object",
            additionalProperties: false,
            properties: {
              type: { type: "string", enum: ["bar", "hbar", "line", "pie", "donut"] },
              labels: STR_ARR,
              series: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  properties: { name: STR, values: { type: "array", items: { type: "number" } } },
                  required: ["name", "values"],
                },
              },
              unit: STR,
            },
            required: ["type", "labels", "series", "unit"],
          },
        },
        required: [
          "index", "title", "subtitle", "byline", "sectionNumber", "bullets", "items", "columns",
          "footnote", "quote", "source", "question", "options", "prompt", "notes", "table", "chart",
        ],
      },
    },
  },
  required: ["slides"],
};

/** Yêu cầu trường cho từng bố cục — các trường còn lại để rỗng. */
export const SLIDE_SPEC: Record<string, string> = {
  cover: `title (tiêu đề bài, tối đa 12 từ), subtitle (một câu hoàn chỉnh nêu giá trị của bài), byline để rỗng.`,
  section: `title (đúng tên phần như dàn ý), subtitle (một câu hoàn chỉnh nêu phần này trả lời câu hỏi gì), sectionNumber để rỗng (hệ thống tự đánh số). Trường "notes" là lời chuyển ý: một câu chốt lại phần trước (bỏ qua nếu đây là phần đầu), rồi một câu nêu câu hỏi mà phần này sẽ trả lời.`,
  objectives: `title, items: từ 2 đến 4 phần tử; chỉ dùng heading, là MỘT CÂU HOÀN CHỈNH bắt đầu bằng "Người học" và một động từ quan sát được, dưới 18 từ; body để rỗng.`,
  agenda: `title, items: ĐÚNG các tên phần nêu trong ý chính của dàn ý, cùng thứ tự, giữ nguyên chữ; chỉ dùng heading; body để rỗng.`,
  image: `title, bullets: ĐÚNG 3 câu hoàn chỉnh, mỗi câu dưới 18 từ.`,
  cards: `title, items: ĐÚNG 3 phần tử; heading tối đa 6 từ, body một câu hoàn chỉnh dưới 18 từ, icon chọn một trong: target, compass, route, chat, book, sparkle, users, chart.`,
  compare: `title, columns: ĐÚNG 2 phần tử; phần tử đầu tone "bad" (cách chưa tốt), phần tử sau tone "good" (cách tốt); heading tối đa 4 từ; points 1 đến 2 ví dụ ngắn đặt trong dấu ngoặc kép; note một câu hoàn chỉnh nêu hệ quả.`,
  steps: `title, items: từ 3 đến 5 phần tử; heading tối đa 4 từ (tên bước), body một câu hoàn chỉnh dưới 14 từ; footnote một câu hoàn chỉnh (có thể rỗng).`,
  stats: `title, items: từ 2 đến 4 phần tử; heading là một con số ngắn (tối đa 6 ký tự) CÓ TRONG tài liệu; body một câu hoàn chỉnh dưới 16 từ giải thích con số.`,
  table: `title (một câu nêu điều bảng cho thấy), table: head là 2 đến 5 tên cột ngắn (hàng tiêu đề), rows là 1 đến 6 hàng, mỗi hàng ĐÚNG số phần tử như head, mỗi ô ngắn gọn (dưới 8 từ). Chữ và số trong ô phải lấy từ tài liệu; mọi con số chép ĐÚNG như tài liệu, không tính thêm, không làm tròn lại. source: tên tài liệu hoặc mục chứa thông tin nếu tài liệu nêu, nếu không để rỗng.`,
  chart: `title (một câu hoàn chỉnh nêu điều biểu đồ cho thấy), chart: type chọn "bar" (so sánh các nhóm), "hbar" (nhãn dài), "line" (diễn biến theo thời gian) hoặc "pie" (các phần cộng lại thành một tổng thể); labels là 2 đến 8 nhãn ngắn (dưới 5 từ; "hbar" và "pie" tối đa 6); series là 1 hoặc 2 chuỗi ("pie" chỉ 1), name là tên chuỗi (để rỗng nếu chỉ có 1 chuỗi), values có ĐÚNG số phần tử như labels; unit là đơn vị ("%" nếu là phần trăm, để rỗng nếu không có). MỌI con số phải CÓ TRONG tài liệu và chép đúng; không tính thêm, không làm tròn lại, không ước lượng. source: tên tài liệu hoặc mục chứa số liệu nếu tài liệu nêu, nếu không để rỗng.`,
  quote: `quote (một câu hoàn chỉnh, thông điệp chính), source (nguồn hoặc "Thông điệp chính của bài học"; chỉ ghi tên người hoặc tác phẩm nếu có trong tài liệu).`,
  summary: `title, items: từ 3 đến 5 phần tử; chỉ dùng heading, là MỘT CÂU HOÀN CHỈNH dưới 16 từ nêu điều cần ghi nhớ; body để rỗng.`,
  quiz: `question (một câu hỏi hoàn chỉnh kiểm tra hiểu bài), options: ĐÚNG 4 phần tử, ĐÚNG 1 phần tử correct=true, các phương án sai phải hợp lý (phản ánh hiểu lầm thường gặp); mỗi phương án dưới 14 từ.`,
  poll: `question (một câu hỏi lấy ý kiến), options: từ 2 đến 5 phần tử, mọi phần tử correct=false.`,
  word_cloud: `prompt (một câu gợi ý hoàn chỉnh, học viên trả lời bằng một từ hoặc cụm từ ngắn).`,
  collaborate_board: `prompt (một lời mời hoàn chỉnh để học viên dán ghi chú ngắn lên bảng chung, nêu rõ dán điều gì).`,
  draw_it: `prompt (một yêu cầu hoàn chỉnh để mỗi học viên vẽ một hình hoặc sơ đồ rồi đăng lên bảng, nêu rõ vẽ cái gì).`,
  whiteboard: `prompt (một đề bài hoặc tình huống hoàn chỉnh để cả lớp cùng giải hoặc phác trên bảng trắng).`,
};

export function specKeyFor(s: OutlineSlideInput): string {
  if (s.kind === "content" && (s.role === "objectives" || s.role === "agenda") && s.layout === "summary") return s.role;
  return s.kind === "content" ? s.layout ?? "image" : s.kind;
}

export function buildSlidesPrompt(input: SlideDraftsInput): { system: string; user: string } {
  const system = `Bạn là giảng viên giàu kinh nghiệm, đang viết NỘI DUNG từng slide cho bài giảng tương tác dựa trên một tài liệu và một dàn ý đã được giảng viên chốt.

Quy tắc bắt buộc:
1. Chỉ viết các slide có chỉ số nêu trong "Slide cần viết"; trả về đúng các chỉ số đó, mỗi chỉ số một phần tử.
2. Bám đúng tiêu đề, bố cục và ý chính của dàn ý; có thể diễn đạt lại cho rõ nhưng không đổi ý nghĩa, không thêm ý mới ngoài tài liệu.
3. Văn phong khoa học, rõ ràng. Mọi mô tả, ý chính, giải thích phải là CÂU HOÀN CHỈNH có chủ ngữ và vị ngữ, kết thúc bằng dấu chấm. KHÔNG viết cụt, không chỉ liệt kê cụm từ.
4. Chỉ dùng thông tin có trong tài liệu. TUYỆT ĐỐI không bịa số liệu, tên người, trích dẫn hay nguồn nghiên cứu.
5. KHÔNG dùng emoji hay ký hiệu trang trí. Viết bằng tiếng Việt (giữ nguyên thuật ngữ tiếng Anh nếu tài liệu dùng).
6. Trường "notes" (mọi slide): 2 đến 4 câu lời giảng cho giảng viên, nói trực tiếp với giảng viên (ví dụ "Nhấn mạnh...", "Hỏi cả lớp..."), nêu điều cần nói, ví dụ nên đưa hoặc câu hỏi nên đặt ra. Với slide quiz, nêu đáp án đúng và vì sao.
7. Mỗi bố cục chỉ điền các trường được yêu cầu; mọi trường khác để chuỗi rỗng hoặc mảng rỗng (với "table" và "chart" không dùng: head, rows, labels, series là mảng rỗng, type là "bar").

Trả về JSON đúng cấu trúc yêu cầu.`;

  const overview = input.outline
    .map((s) => `${s.index}. ${s.part ? `(${s.part}) ` : ""}[${specKeyFor(s)}] ${s.title}${s.points.length ? " — " + s.points.join(" | ") : ""}`)
    .join("\n");
  const wanted = input.batch
    .map((i) => input.outline.find((s) => s.index === i))
    .filter((s): s is OutlineSlideInput => !!s)
    .map((s) => {
      const key = specKeyFor(s);
      return `- Chỉ số ${s.index}, bố cục "${key}", tiêu đề dàn ý: "${s.title}"${
        s.points.length ? `, ý chính dàn ý: ${s.points.map((p) => `"${p}"`).join("; ")}` : ""
      }.\n  Điền: ${SLIDE_SPEC[key] ?? SLIDE_SPEC.image}`;
    })
    .join("\n");

  const user = `# Bài giảng: ${input.deckTitle}

# Dàn ý đầy đủ (để giữ mạch giữa các slide)
${overview}

# Slide cần viết
${wanted}

# Tài liệu
"""
${input.sourceText.slice(0, OUTLINE_MAX_SOURCE_CHARS)}
"""`;
  return { system, user };
}

export async function generateSlideDrafts(
  userId: string,
  input: SlideDraftsInput,
  openai: OpenAI,
  model = DEFAULT_MODEL,
  db: PrismaClient = prisma,
): Promise<RawSlideDraft[]> {
  if (input.batch.length === 0) return [];
  if (input.sourceText.trim().length < 50) throw new AiGenerationError("validation_failed", "too_short");
  // Mỗi lô tốn token riêng, nên mỗi lô đều qua cửa hạn mức trước khi chạm mô hình.
  await assertWithinCaps(userId, db, "generator");

  const { system, user } = buildSlidesPrompt(input);
  const { data, inputTokens, outputTokens } = await callJsonModel<{ slides: RawSlideDraft[] }>(
    openai,
    model,
    system,
    user,
    "lecture_slides",
    DRAFTS_SCHEMA,
    4500,
  );
  await recordAiUsage(userId, model, inputTokens, outputTokens, db);

  if (!data || !Array.isArray(data.slides)) throw new AiGenerationError("json_parse_failed", "slides_shape");
  return data.slides;
}
