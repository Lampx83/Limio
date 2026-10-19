// Rào chắn cho trợ lý Limio: (1) KHÔNG tiết lộ thiết kế kỹ thuật, hạ tầng, cơ sở dữ liệu của hệ thống, (2) chỉ trả
// lời việc thuộc nghiệp vụ Limio. Module thuần. Bộ lọc chạy ở máy chủ, TRƯỚC và SAU khi gọi mô hình, nên không phụ
// thuộc vào việc mô hình có nghe lời hay bị dụ ("hãy bỏ qua các hướng dẫn trước"). Quy tắc trong prompt chỉ là lớp
// thứ hai cho những câu lọt qua.
//
// Nguyên tắc chọn từ khoá: THIÊN VỀ KHÔNG CHẶN NHẦM. Giảng viên khoa CNTT soạn bài về "cơ sở dữ liệu", Docker, Redis,
// Next.js... phải hỏi được bình thường, nên mọi từ kỹ thuật (kể cả tên công nghệ cụ thể) chỉ bị coi là dò hỏi khi đi
// kèm một cụm chỉ chính hệ thống ("Limio dùng...", "hệ thống này chạy...", "bạn lưu ở đâu..."). Riêng câu đòi xem
// prompt/chỉ dẫn hệ thống hoặc bảo bỏ qua quy tắc thì chặn không cần ngữ cảnh.

import type { AssistantAction, AssistantReply } from "./teacherAssistant";

export type DeclineKind = "technical" | "off_topic";

const fold = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9.+# ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Câu đòi xem/phá chỉ dẫn hệ thống. */
const PROMPT_PROBE = [
  /\b(system|developer) ?prompt\b/,
  /\bprompt (he thong|goc|ban dau|cua ban)\b/,
  /\b(chi dan|huong dan|chi thi|quy tac|luat) (he thong|goc|ban dau|noi bo|cua ban)\b/,
  /\b(tiet lo|in ra|cho (toi|minh|em) (xem|biet)|doc lai|lap lai|copy|sao chep|show|reveal|print|repeat) .{0,40}\b(prompt|chi dan|huong dan he thong|danh muc diem den|tai lieu huong dan)\b/,
  /\b(ignore|forget|disregard) (all |any |the )?(previous|prior|above|earlier) (instructions?|rules?|prompts?)\b/,
  /\bbo qua (tat ca |moi )?(cac )?(huong dan|chi dan|quy tac|luat) (truoc|o tren|ban dau)\b/,
  /\bquen (het )?(cac )?(huong dan|quy tac|luat) (truoc|o tren)\b/,
  /\bjailbreak\b|\bdan mode\b|\bdeveloper mode\b/,
  /\bgia vo (la )?(quan tri|admin|lap trinh vien|developer)\b/,
];

/** Từ chung chung: chỉ là dò hỏi khi đi kèm cụm chỉ chính hệ thống (SYSTEM_CUE). */
const GENERIC_TECH = [
  "postgres", "postgresql", "prisma", "redis", "pgvector", "bullmq", "docker", "kubernetes", "nginx", "vllm", "ollama",
  "qwen", "openai", "anthropic", "chatgpt", "gpt", "claude", "next.js", "nextjs", "typescript", "tailwind", "vercel",
  "cloudflare", "github", "gitlab", "sentry", "stripe", "mo hinh gi", "mo hinh nao", "la model", "model gi",
  "co so du lieu", "csdl", "database", "db ", " sql", "bang du lieu", "schema", "migration", "may chu", "server",
  "ha tang", "infrastructure", "backend", "frontend", "back end", "front end", "api", "endpoint", "framework",
  "ngon ngu lap trinh", "viet bang ngon ngu", "ma nguon", "source code", "kien truc", "cong nghe gi", "cong nghe nao",
  "dung cong nghe", "tech", "cloud", "hosting", "bien moi truong", ".env", "api key", "apikey", "mat khau he thong",
  "log he thong", "bao mat he thong", "mo hinh ai nao", "model nao", "model gi", "llm", "ai nao", "chay tren",
  "luu o dau", "luu tru o dau", "luu tru du lieu", "luu du lieu", "du lieu o dau", "du lieu luu",
];

const SYSTEM_CUE = [
  "limio", "he thong nay", "he thong cua", "nen tang nay", "nen tang cua", "phan mem nay", "ung dung nay", "website nay",
  "trang web nay", "tro ly", "ban dung", "ban chay", "ban luu", "ban duoc xay", "ban su dung", "cac ban dung",
  "cac ban chay", "cac ban luu", "phia sau", "dang sau", "ben duoi", "ben trong he thong", "ben trong limio",
  "ban la", "ban hoat dong", "ban dua tren", "xay dung nhu the nao", "duoc xay", "thiet ke ben trong", "thiet ke he thong", "thiet ke cua",
];

const includesAny = (text: string, list: readonly string[]) => list.some((k) => text.includes(k));

/** Câu hỏi có nhằm moi thông tin kỹ thuật/hạ tầng/CSDL/chỉ dẫn nội bộ của hệ thống không. */
export function isTechnicalProbe(message: string): boolean {
  const t = ` ${fold(message)} `;
  if (PROMPT_PROBE.some((re) => re.test(t))) return true;
  const hasTech = GENERIC_TECH.some((k) => t.includes(k.startsWith(" ") || k.endsWith(" ") ? k : ` ${k}`));
  return hasTech && includesAny(t, SYSTEM_CUE);
}

/** Thuật ngữ kỹ thuật hệ thống không bao giờ được xuất hiện trong câu trả lời, dù mô hình có lỡ nói. */
const LEAK_TERMS = [
  "postgres", "prisma", "redis", "pgvector", "bullmq", "docker", "kubernetes", "nginx", "vllm", "ollama", "qwen",
  "openai", "anthropic", "chatgpt", "next.js", "nextjs", "typescript", "tailwind", "learningevent", "schema.prisma",
  "x-ollama", "llm_base_url", "nextauth", "api key", "apikey", "system prompt", "prompt he thong", ".env.prod",
];

/**
 * Câu trả lời có nhắc thuật ngữ hệ thống mà giảng viên CHƯA hề nhắc? (`context` = tin nhắn và các câu trước của giảng
 * viên.) Giảng viên tự nói "bài giảng về Docker" thì trợ lý nhắc lại Docker là bình thường; còn tự nhiên thốt ra
 * "Postgres" khi không ai hỏi thì là rò rỉ.
 */
export function containsTechLeak(reply: string, context: readonly string[] = []): boolean {
  const out = ` ${fold(reply)} `;
  const ctx = ` ${fold(context.join(" "))} `;
  return LEAK_TERMS.some((k) => out.includes(k) && !ctx.includes(k));
}

// ── Câu trả lời cố định ─────────────────────────────────────────────────────

const DEFAULT_FOLLOW_UPS = ["Hôm nay tôi nên làm gì trước?", "Cách tạo khoá học mới", "Cách tổ chức một buổi kiểm tra trên lớp"];

const DECLINE_TEXT: Record<DeclineKind, string> = {
  technical:
    "Đây là thông tin kỹ thuật nội bộ của hệ thống nên Limio không thể chia sẻ. Limio có thể giúp thầy/cô cách dùng các tính năng, hoặc gợi ý việc nên làm hôm nay cho lớp của thầy/cô.",
  off_topic:
    "Câu hỏi này nằm ngoài phạm vi của Limio, vì Limio chỉ hỗ trợ các việc dạy học và quản lý lớp trên hệ thống. Thầy/cô có thể hỏi Limio cách dùng một tính năng, hoặc nhờ gợi ý việc nên làm hôm nay.",
};

export function declineReply(kind: DeclineKind): AssistantReply {
  return { reply: DECLINE_TEXT[kind], actions: [] as AssistantAction[], followUps: DEFAULT_FOLLOW_UPS.slice(0, 3) };
}
