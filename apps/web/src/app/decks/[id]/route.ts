import { NextResponse } from "next/server";
import { buildDeckHtml, loadDeck } from "@/lib/slideDeck/decks";

export const runtime = "nodejs";

/**
 * Bộ slide tương tác (khung SmartDoc) để nhúng vào bài học bằng khối `embed` (`/decks/<mã>`). Nội dung là tệp JSON do
 * Limio soạn trong `src/content/decks/`, không nhận gì từ người dùng ngoài mã bộ slide (đã kiểm chữ thường/số/gạch).
 */
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const deck = loadDeck(params.id);
  if (!deck) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return new NextResponse(buildDeckHtml(deck), {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
