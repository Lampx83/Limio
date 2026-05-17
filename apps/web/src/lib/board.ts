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
