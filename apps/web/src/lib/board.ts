import { prisma } from "@feedbackme/db";

// 6-char uppercase alphanumeric — bỏ ký tự dễ nhầm (0, O, 1, I, L).
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

// Generate unique join code. Retry tối đa 10 lần khi collision (xác suất cực thấp).
export async function generateUniqueBoardCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const exists = await prisma.interactiveBoard.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique board code after 10 attempts");
}

export const BOARD_CHANNEL_PREFIX = "board:";
export const channelForBoard = (id: string) => `${BOARD_CHANNEL_PREFIX}${id}`;

// Grid-theo-nhóm: giới hạn số cột + độ dài nhãn, tránh GV nhập rác/quá tải UI.
export const BOARD_MAX_COLUMNS = 12;
export const BOARD_COLUMN_LABEL_MAX_LEN = 30;

// Chuẩn hoá danh sách cột do GV nhập: trim, bỏ rỗng, khử trùng lặp (giữ thứ tự).
// Trả về null nếu vi phạm giới hạn (số lượng / độ dài) để route trả 400.
export function normalizeBoardColumns(input: unknown): string[] | null {
  if (!Array.isArray(input)) return null;
  if (input.length > BOARD_MAX_COLUMNS) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input) {
    if (typeof raw !== "string") return null;
    const label = raw.trim();
    if (!label) continue; // bỏ rỗng, không phải lỗi
    if (label.length > BOARD_COLUMN_LABEL_MAX_LEN) return null;
    if (seen.has(label)) continue;
    seen.add(label);
    out.push(label);
  }
  return out;
}
