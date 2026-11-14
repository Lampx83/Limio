/**
 * "Thử nói tự do" với bạn ảo — phần thuần của giao diện (docs/tieu-chi/limio-language-noi-tu-do-voi-ban-ao.md): đọc cấu hình, đánh dấu cụm
 * mục tiêu đã dùng, dựng bản chữ để lưu (và để AI nhận xét) và khôi phục từ bản chữ đã lưu, lời nhắn lỗi.
 */

export const FREECHAT_MAX_CHARS = 300;
export const FREECHAT_MIN_FEEDBACK_TURNS = 2;

export interface FreeChatView {
  scenario: string;
  partnerRole: string;
  learnerRole: string;
  opening: string;
  targets: string[];
  maxTurns: number;
}

export interface ChatMsg {
  role: "learner" | "partner";
  text: string;
}

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown, max: number): string => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Đọc `config.freechat` từ dữ liệu không đáng tin; null nếu thiếu tình huống hoặc lời mở đầu. Số lượt kẹp vào 4–12 (mặc định 8). */
export function parseFreeChatView(config: unknown): FreeChatView | null {
  const fc = isObj(config) ? config.freechat : null;
  if (!isObj(fc)) return null;
  const scenario = str(fc.scenario, 600);
  const opening = str(fc.opening, FREECHAT_MAX_CHARS);
  if (!scenario || !opening) return null;
  const targets = Array.isArray(fc.targets) ? fc.targets.map((t) => str(t, 120)).filter(Boolean).slice(0, 10) : [];
  const turns = typeof fc.maxTurns === "number" && Number.isFinite(fc.maxTurns) ? Math.round(fc.maxTurns) : 8;
  return {
    scenario,
    partnerRole: str(fc.partnerRole, 60) || "Partner",
    learnerRole: str(fc.learnerRole, 60) || "You",
    opening,
    targets,
    maxTurns: Math.min(12, Math.max(4, turns)),
  };
}

const norm = (t: string) =>
  t
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, " ")
    .replace(/'/g, "")
    .replace(/\s+/g, " ")
    .trim();

/** Cụm mục tiêu có trong lời học viên không: bỏ dấu "…" và dấu câu ở cuối cụm, so dãy từ liền nhau (không phân biệt hoa thường, dấu câu, dấu nháy). */
export function phraseUsed(target: string, text: string): boolean {
  const stem = norm(target.replace(/(…|\.\.\.)+/g, " "));
  if (!stem) return false;
  return ` ${norm(text)} `.includes(` ${stem} `);
}

export function usedTargets(targets: string[], learnerTexts: string[]): boolean[] {
  return targets.map((t) => learnerTexts.some((x) => phraseUsed(t, x)));
}

/** Bản chữ để lưu làm câu trả lời: "[Free chat]" rồi mỗi dòng "Partner: …"/"Learner: …" (lời mở đầu là dòng đầu). */
export function transcriptOf(view: Pick<FreeChatView, "opening">, history: ChatMsg[]): string {
  const lines = [`Partner: ${view.opening}`, ...history.map((m) => `${m.role === "learner" ? "Learner" : "Partner"}: ${m.text}`)];
  return `[Free chat]\n${lines.join("\n")}`;
}

/** Số lượt học viên trong bản chữ đã lưu (số dòng "Learner:"). */
export function learnerTurnCount(text: string): number {
  return text.split(/\r?\n/).filter((l) => l.startsWith("Learner: ")).length;
}

/**
 * Đọc lại bản chữ đã lưu thành lịch sử (không gồm lời mở đầu) để tải lại trang không mất hội thoại. Không đọc được (sai dạng,
 * không xen kẽ, kết thúc bằng lượt của học viên) thì trả null.
 */
export function restoreChat(text: string, view: Pick<FreeChatView, "opening">): ChatMsg[] | null {
  if (!text.startsWith("[Free chat]")) return null;
  const lines = text.split(/\r?\n/).slice(1).filter((l) => l.trim());
  if (!lines.length || !lines[0]!.startsWith("Partner: ") || lines[0]!.slice(9).trim() !== view.opening) return null;
  const out: ChatMsg[] = [];
  for (const [i, l] of lines.slice(1).entries()) {
    const want = i % 2 === 0 ? "Learner: " : "Partner: ";
    if (!l.startsWith(want)) return null;
    out.push({ role: want === "Learner: " ? "learner" : "partner", text: l.slice(want.length).trim() });
  }
  return out.length && out.length % 2 === 0 ? out : out.length === 0 ? [] : null;
}

/** Lời nhắn lỗi tiếng Việt theo mã của máy chủ (hoặc "network"). Hội thoại và lời đã nhập vẫn còn, bấm gửi lại được. */
export function freeChatErrorMessage(code: string | null | undefined): string {
  switch (code) {
    case "openai_not_configured":
      return "Hệ thống chưa bật bạn ảo. Hãy thử lại sau.";
    case "daily_token_cap":
    case "no_token_budget":
    case "global_token_cap":
    case "rate_limited":
      return "Hạn mức AI đã hết nên bạn ảo chưa trả lời được. Hãy thử lại sau.";
    case "turn_limit":
      return "Hội thoại đã hết lượt. Bấm “Nhận xét bằng AI” hoặc “Bắt đầu lại”.";
    case "message_invalid":
      return `Lời nhắn cần từ 1 đến ${FREECHAT_MAX_CHARS} ký tự.`;
    case "openai_error":
    case "analysis_empty":
      return "Bạn ảo chưa trả lời được. Hãy thử gửi lại.";
    case "network":
      return "Mất kết nối. Hãy kiểm tra mạng rồi gửi lại.";
    default:
      return "Có lỗi khi gửi. Hãy thử lại.";
  }
}
