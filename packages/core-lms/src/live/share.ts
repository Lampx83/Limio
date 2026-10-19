import { randomBytes } from "node:crypto";
import { PrismaClient, LiveSlide } from "@feedbackme/db";

/**
 * Link xem chỉ đọc của bài giảng: /bai-giang/<shareCode>. Ai có link cũng xem được (không đăng nhập),
 * nên mã phải khó đoán: 9 byte ngẫu nhiên = 12 ký tự base64url (72 bit).
 */
const SHARE_CODE_BYTES = 9;
const SHARE_CODE_RE = /^[A-Za-z0-9_-]{12}$/;

export type LiveDeckShareAction = "enable" | "rotate" | "disable";

function newShareCode(): string {
  return randomBytes(SHARE_CODE_BYTES).toString("base64url");
}

/**
 * Bật / tạo link mới / tắt chia sẻ — chỉ chủ bài giảng.
 * - enable: đã có mã thì giữ nguyên (bấm lại không làm chết link đã gửi đi).
 * - rotate: thay mã, link cũ hết hiệu lực ngay.
 * - disable: xoá mã; bật lại sau đó sẽ ra mã MỚI, link cũ không sống lại.
 */
export async function setLiveDeckSharing(
  deckId: string,
  userId: string,
  action: LiveDeckShareAction,
  db: PrismaClient
): Promise<{ shareCode: string | null }> {
  const deck = await db.liveDeck.findUnique({ where: { id: deckId }, select: { userId: true, shareCode: true } });
  if (!deck || deck.userId !== userId) {
    throw new Error("Not authorized to share this deck");
  }
  if (action === "enable" && deck.shareCode) return { shareCode: deck.shareCode };

  const shareCode = action === "disable" ? null : newShareCode();
  await db.liveDeck.update({ where: { id: deckId }, data: { shareCode } });
  return { shareCode };
}

export interface SharedLiveDeck {
  id: string;
  /** Chủ bài — để tầng web lấy thương hiệu của trường; không trả ra trình duyệt. */
  userId: string;
  ownerName: string;
  title: string;
  theme: string;
  brand: unknown;
  brandOff: boolean;
  brandTemplate: string | null;
  /** Hoa văn của cả bài (null = tự động theo deckId). */
  motif: string | null;
  /** Khung hình của các ô hình (null = tự động theo hoa văn). */
  imageFrame: string | null;
  updatedAt: Date;
  slides: Pick<LiveSlide, "id" | "type" | "config" | "orderIndex">[];
}

/**
 * Bài giảng theo mã chia sẻ, chỉ gồm các cột cần để dựng slide. Cố ý KHÔNG đọc outline, sourceText,
 * email chủ bài; còn lọc nội dung từng slide (ghi chú giảng, đáp án) là việc của tầng web (limioLiveShare).
 */
export async function getLiveDeckByShareCode(code: string, db: PrismaClient): Promise<SharedLiveDeck | null> {
  if (!SHARE_CODE_RE.test(code)) return null;
  const deck = await db.liveDeck.findUnique({
    where: { shareCode: code },
    select: {
      id: true,
      userId: true,
      title: true,
      theme: true,
      brand: true,
      brandOff: true,
      brandTemplate: true,
      motif: true,
      imageFrame: true,
      updatedAt: true,
      user: { select: { displayName: true } },
      slides: { orderBy: { orderIndex: "asc" }, select: { id: true, type: true, config: true, orderIndex: true } },
    },
  });
  if (!deck) return null;
  const { user, ...rest } = deck;
  return { ...rest, ownerName: user.displayName };
}
