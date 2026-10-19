// Ngôn ngữ của bài giảng ở phía máy chủ (docs/tieu-chi/ngon-ngu-slide.md, L4): bài đã có ngôn ngữ thì dùng; bài cũ (cột
// trống) thì nhận từ chữ của slide, dàn ý, tài liệu gốc ngay lần đầu cần, rồi ghi lại để lần sau không phải đoán.
import { prisma, type PrismaClient } from "@feedbackme/db";
import { inferDeckLanguage, sanitizeDeckLanguage, type DeckLanguage } from "./limioLiveLanguage";
import { sanitizeOutline } from "./limioLiveOutline";

export async function resolveDeckLanguage(deckId: string, db: PrismaClient = prisma): Promise<DeckLanguage | null> {
  const deck = await db.liveDeck.findUnique({
    where: { id: deckId },
    select: { language: true, outline: true, sourceText: true, slides: { select: { config: true }, orderBy: { orderIndex: "asc" } } },
  });
  if (!deck) return null;
  const set = sanitizeDeckLanguage(deck.language);
  if (set) return set;
  const outline = deck.outline ? sanitizeOutline(deck.outline) : null;
  const lang = inferDeckLanguage({
    slides: deck.slides.map((s) => s.config),
    outlineText: outline ? [outline.title, ...outline.slides.flatMap((s) => [s.title, ...s.points])].join("\n") : "",
    sourceText: deck.sourceText ?? "",
  });
  // Ghi lại chỉ khi nhận được; không ghi đè nếu giảng viên vừa chọn tay trong lúc đó.
  if (lang) await db.liveDeck.updateMany({ where: { id: deckId, language: null }, data: { language: lang } });
  return lang;
}
