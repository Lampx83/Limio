import { prisma } from "@feedbackme/db";

// 6-char uppercase alphanumeric — bỏ ký tự dễ nhầm (0, O, 1, I, L).
// Cùng bảng chữ với board.ts (giữ UX join-code nhất quán toàn app).
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

export async function generateUniqueGameCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const exists = await prisma.gameSession.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique game code after 10 attempts");
}
