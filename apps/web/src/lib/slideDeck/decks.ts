import { readFileSync } from "node:fs";
import path from "node:path";
// Khung slide tương tác chép từ SmartDoc (docs/tieu-chi/slide-tuong-tac-smartdoc.md); chỉ dựng HTML, không đụng DOM.
import { dungTaiLieuSlide } from "./khungSlideHtml.js";

export interface DeckSlide {
  id: string;
  html: string;
  ghiChu?: string;
  loiGiang?: { buoc?: string[]; dungCuoi?: boolean };
}

export interface Deck {
  tieuDe: string;
  mau: string;
  ngonNgu: string;
  slides: DeckSlide[];
  nguoiGiang?: { xungHoHs?: string; phatAm?: Record<string, string> };
}

const DIR = path.join(process.cwd(), "src", "content", "decks");
const ID_RE = /^[a-z0-9-]{1,60}$/;

/** Mã bộ slide hợp lệ (chỉ chữ thường, số, gạch): không bao giờ ghép chuỗi lạ vào đường dẫn tệp. */
export const isDeckId = (id: string): boolean => ID_RE.test(id);

export function loadDeck(id: string): Deck | null {
  if (!isDeckId(id)) return null;
  try {
    return JSON.parse(readFileSync(path.join(DIR, `${id}.json`), "utf8")) as Deck;
  } catch {
    return null;
  }
}

/**
 * Tài liệu HTML đầy đủ của bộ slide. `kieu: "hoclieu"` là giao diện Học liệu của SmartDoc, ở đây dùng màu Limio, nền sáng.
 *
 * Thanh điều khiển đáy của khung: bài đọc bình thường cần nó để tự lật slide, còn lúc trình chiếu thanh phát của Limio
 * đã đè lên đó. Nên tài liệu mang sẵn CSS ẩn thanh (`anThanhDuoi`) nhưng KHÔNG bật; trình chiếu bật bằng cách đặt
 * `data-an-thanh` lên <html> của khung (cùng origin, xem useDeckBridge).
 */
export function buildDeckHtml(deck: Deck): string {
  // Slide chờ học viên làm (dungCuoi) mang cờ data-dung-cuoi để trình chiếu biết chỗ nào dừng giọng (useDeckBridge).
  const slides = deck.slides.map((s) =>
    s.loiGiang?.dungCuoi ? { ...s, html: s.html.replace(/^\s*<section\b/i, '<section data-dung-cuoi="1"') } : s,
  );
  return dungTaiLieuSlide(slides, {
    tieuDe: deck.tieuDe,
    mau: "limio",
    sang: true,
    ngonNgu: deck.ngonNgu === "en" ? "en" : "vi",
    kieu: "hoclieu",
    anThanhDuoi: true,
  }).replace(' data-an-thanh="1"', "");
}
