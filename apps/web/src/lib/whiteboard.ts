import { prisma } from "@feedbackme/db";

// 6-char uppercase alphanumeric — bỏ ký tự dễ nhầm (0, O, 1, I, L). Giống lib/board.ts.
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return s;
}

export async function generateUniqueWhiteboardCode(): Promise<string> {
  for (let i = 0; i < 10; i++) {
    const code = randomCode();
    const exists = await prisma.whiteboard.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!exists) return code;
  }
  throw new Error("Could not generate unique whiteboard code after 10 attempts");
}

export const WHITEBOARD_CHANNEL_PREFIX = "whiteboard:";
export const channelForWhiteboard = (id: string) => `${WHITEBOARD_CHANNEL_PREFIX}${id}`;

// Reconcile logic là pure/isomorphic — xem lib/whiteboardReconcile.ts (file
// này KHÔNG "use client" nên import prisma ở trên vẫn an toàn, nhưng để
// component client dùng chung logic reconcile mà không kéo theo prisma vào
// bundle, hàm đó tách riêng).
export { reconcileWhiteboardElements, type WhiteboardElement } from "./whiteboardReconcile";
