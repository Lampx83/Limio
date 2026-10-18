// Cho nội dung slide bố cục vừa khung 1280×720 mà không phí chỗ. Slide có chữ dài thì giảm cỡ chữ theo bậc (biến CSS --fs,
// mọi cỡ chữ có sàn 26 px trong slideLayouts.css): khung, cột và thẻ giữ nguyên bề ngang nên chữ chảy lại thành ít dòng hơn.
// Chỉ khi chữ đã ở bậc cuối mà vẫn tràn mới thu cả khối (fitScaleForBox) như cách cũ. Logo chỉ đẩy đệm phía nó, không thu slide.
// Phần tính toán thuần (dễ test); phần đo DOM ở measureContentBox.

import { fitFontSize } from "./limioLiveSlides";

export const FIT_W = 1280;
export const FIT_H = 720;
/** Vùng an toàn: nội dung bình thường nằm trong đệm 72/96px nên không chạm tới các mép này. */
export const FIT_SAFE: SafeArea = { top: 40, bottom: 680, left: 48, right: 1232 };
/** Đệm trên/dưới của khung nội dung (.pad) trên khung thiết kế. */
export const PAD_Y = 72;
/** Các bậc hệ số cỡ chữ thử lần lượt khi nội dung tràn; bậc cuối đưa gần hết chữ thân bài về sàn 26 px. */
export const FONT_STEPS = [1, 0.93, 0.86, 0.8, 0.74, 0.68, 0.62] as const;
/** Co tối đa; nhỏ hơn nữa thì chữ khó đọc, để phần cảnh báo "slide dài" lo. */
export const FIT_MIN_SCALE = 0.55;

export interface ContentBox {
  top: number;
  bottom: number;
  left: number;
  right: number;
}
export type SafeArea = ContentBox;

/** Logo trên khung thiết kế: ở mép trên hay dưới, cao bao nhiêu, cách mép bao nhiêu. */
export interface LogoBand {
  pos: "t" | "b";
  heightPx: number;
  marginPx: number;
}
/** Khoảng hở tối thiểu giữa logo và chữ. */
const LOGO_GAP = 12;

/** Vùng an toàn khi có logo: phía có logo lùi vào tới dưới (hoặc trên) logo cộng khoảng hở. */
export function safeAreaFor(logo: LogoBand | null): SafeArea {
  if (!logo) return FIT_SAFE;
  const edge = logo.marginPx + logo.heightPx + LOGO_GAP;
  return logo.pos === "t"
    ? { ...FIT_SAFE, top: Math.max(FIT_SAFE.top, edge) }
    : { ...FIT_SAFE, bottom: Math.min(FIT_SAFE.bottom, FIT_H - edge) };
}

/** Khung nội dung dịch vào bao nhiêu ở phía có logo để chữ ở mép đệm (72 px) nằm dưới logo, cách thêm vài px. */
export function logoShiftPx(logo: LogoBand | null): number {
  if (!logo) return 0;
  return Math.max(0, logo.marginPx + logo.heightPx + LOGO_GAP + 4 - PAD_Y);
}

/**
 * Khung nội dung còn phải dịch thêm bao nhiêu px ở phía có logo để nội dung (đo ở chỗ hiện tại) thôi chạm dải của logo; 0 nếu
 * không chạm. Đo theo nội dung thật nên đúng cho mọi bố cục, kể cả bìa có đệm riêng: khối căn giữa như trích dẫn, mở phần
 * thường không chạm nên giữ nguyên chỗ. Khối căn giữa chỉ dời nửa khoảng dịch, nên bên gọi đo lại và cộng dồn vài lần.
 */
export function logoShiftFor(box: ContentBox | null, logo: LogoBand | null): number {
  if (!logo || !box) return 0;
  const safe = safeAreaFor(logo);
  return Math.max(0, Math.ceil(logo.pos === "t" ? safe.top - box.top : box.bottom - safe.bottom));
}
/** Khoảng dịch tối đa: không bao giờ nhường cho logo quá chừng này (phần còn lại do bậc cỡ chữ lo). */
export const LOGO_SHIFT_MAX = 120;

/** Nội dung có nằm trọn vùng an toàn không (hộp rỗng coi như vừa). */
export function boxFits(box: ContentBox | null, safe: SafeArea = FIT_SAFE): boolean {
  if (!box) return true;
  return box.top >= safe.top - 0.5 && box.bottom <= safe.bottom + 0.5 && box.left >= safe.left - 0.5 && box.right <= safe.right + 0.5;
}

export interface FontFit {
  /** Hệ số cỡ chữ đã chọn (1 = cỡ gốc). */
  fs: number;
  /** Nội dung ở hệ số đó có nằm trọn vùng an toàn không. */
  fits: boolean;
  /** Hộp nội dung đo ở hệ số đó. */
  box: ContentBox | null;
}

/**
 * Bậc cỡ chữ lớn nhất mà nội dung vừa vùng an toàn. `measureAt(fs)` đặt hệ số rồi đo lại (ở trình duyệt là đặt biến CSS --fs
 * và đọc offset). Không bậc nào vừa thì trả bậc cuối với fits = false để bên gọi thu cả khối.
 */
export function pickFontStep(measureAt: (fs: number) => ContentBox | null, safe: SafeArea = FIT_SAFE): FontFit {
  let last: FontFit = { fs: 1, fits: true, box: null };
  for (const fs of FONT_STEPS) {
    const box = measureAt(fs);
    last = { fs, fits: boxFits(box, safe), box };
    if (last.fits) return last;
  }
  return last;
}

/** Chọn giữa hai cách xếp (ví dụ một cột và hai cột): cách vừa khung với chữ lớn hơn; ngang nhau thì giữ cách đầu. */
export function betterFit(a: FontFit, b: FontFit): FontFit {
  if (a.fits !== b.fits) return a.fits ? a : b;
  return b.fs > a.fs ? b : a;
}

/**
 * Hệ số co (1 = giữ nguyên) để khối nội dung nằm trọn vùng an toàn khi co quanh tâm khung. Slide đã nằm gọn thì luôn là 1,
 * nên slide ngắn không bị đổi gì. Hộp rỗng hoặc không hợp lệ cho 1.
 */
export function fitScaleForBox(box: ContentBox | null, safe: SafeArea = FIT_SAFE): number {
  if (!box || ![box.top, box.bottom, box.left, box.right].every(Number.isFinite)) return 1;
  const cx = FIT_W / 2, cy = FIT_H / 2;
  let k = 1;
  const shrink = (extent: number, limit: number) => {
    // extent: khoảng cách từ tâm tới mép nội dung; limit: khoảng cách tối đa cho phép
    if (extent > limit && extent > 0) k = Math.min(k, limit / extent);
  };
  shrink(box.bottom - cy, safe.bottom - cy);
  shrink(cy - box.top, cy - safe.top);
  shrink(box.right - cx, safe.right - cx);
  shrink(cx - box.left, cx - safe.left);
  return Math.max(FIT_MIN_SCALE, Math.min(1, k));
}

/**
 * Chiều cao khung cần để nội dung nằm trọn khi người xem phóng to (không co chữ, chấp nhận cuộn): chiều cao thật của khối nội dung
 * cộng đệm 72px mỗi phía như bố cục thường. Không bao giờ thấp hơn khung chuẩn 720 nên slide ngắn không đổi.
 */
export function frameHeightForContent(box: ContentBox | null): number {
  if (!box || ![box.top, box.bottom].every(Number.isFinite)) return FIT_H;
  return Math.max(FIT_H, Math.ceil(box.bottom - box.top + 2 * 72));
}

/**
 * Đo hộp bao của nội dung trong `root` (khung 1280×720) theo toạ độ thiết kế bằng offsetLeft/offsetTop: các số này không
 * bị ảnh hưởng bởi transform (co theo khung, hiệu ứng xuất hiện), nên đo đúng ở mọi mức thu phóng. Bỏ qua khung gốc của bố cục, vầng sáng trang trí và
 * khung đệm phủ kín. null nếu không có phần tử nào đo được.
 */
export function measureContentBox(root: HTMLElement): ContentBox | null {
  let top = Infinity, bottom = -Infinity, left = Infinity, right = -Infinity;
  root.querySelectorAll<HTMLElement>("*").forEach((el) => {
    // Bỏ qua khung gốc của bố cục (con trực tiếp của root, luôn cao đủ cả khung), khung đệm phủ kín và phần trang trí
    // (vầng sáng, hoa văn, hình trang trí của bìa mang lớp .deco): chúng được phép chạm hoặc tràn mép khung, không phải
    // nội dung tràn, nên không được làm slide co lại.
    if (el.parentElement === root || el.classList.contains("pad") || el.closest(".glow, .motif, .deco")) return;
    const w = el.offsetWidth, h = el.offsetHeight;
    if (!w && !h) return; // phần tử SVG hoặc ẩn
    // Phần tử inline xuống nhiều dòng (đoạn chữ nhấn trong câu trích dẫn) có offsetLeft của dòng đầu nhưng offsetWidth của
    // cả khối dòng, nên hộp đo lệch ra ngoài khung dù chữ không tràn. Khối cha đã bao chúng: bỏ qua.
    if (getComputedStyle(el).display === "inline") return;
    let x = 0, y = 0, n: HTMLElement | null = el, reached = false;
    while (n) {
      if (n === root) { reached = true; break; }
      x += n.offsetLeft;
      y += n.offsetTop;
      n = n.offsetParent as HTMLElement | null;
    }
    if (!reached) return;
    top = Math.min(top, y);
    left = Math.min(left, x);
    bottom = Math.max(bottom, y + h);
    right = Math.max(right, x + w);
  });
  return Number.isFinite(top) ? { top, bottom, left, right } : null;
}

// ── Cỡ và bề rộng theo nội dung của từng bố cục ─────────────────────────────

/** Bề ngang vùng nội dung của bố cục thường (1280 trừ đệm 96 hai bên). */
export const CONTENT_W = FIT_W - 2 * 96;

/**
 * Cỡ tiêu đề: nếu cả câu vừa MỘT dòng ở cỡ ≥ 80% cỡ lớn nhất thì dùng một dòng, nhường chiều cao cho nội dung; không thì như
 * fitFontSize (cỡ lớn nhất vừa maxLines dòng).
 */
export function titleFontPx(text: string, o: { maxPx: number; widthPx: number; maxLines: number }): number {
  if (o.maxLines > 1) {
    const one = fitFontSize(text, { maxPx: o.maxPx, minPx: Math.round(o.maxPx * 0.8), widthPx: o.widthPx, maxLines: 1 });
    if (!one.overflow) return one.px;
  }
  return fitFontSize(text, o).px;
}

/** Khoảng cách giữa các thẻ và đệm ngang trong thẻ của bố cục Ba thẻ (khớp slideLayouts.css). */
export const CARD_GAP = 24;
export const CARD_PAD_X = 26;

/**
 * Cỡ tiêu đề thẻ: từ dài nhất (kể cả từ nối bằng gạch như "AI-Gamification") phải nằm trọn một dòng trong thẻ, vì tiêu đề thẻ
 * không được ngắt giữa từ. Ước lượng bề rộng chữ đậm ≈ 0,6 cỡ chữ mỗi ký tự; trong khoảng 28–40 px.
 */
export function cardHeadingPx(headings: string[], count: number): number {
  const n = Math.max(count, 1);
  const inner = (CONTENT_W - CARD_GAP * (n - 1)) / n - 2 * CARD_PAD_X;
  const longest = Math.max(1, ...headings.flatMap((h) => h.split(/\s+/).map((w) => w.length)));
  return Math.max(28, Math.min(40, Math.floor(inner / (longest * 0.6))));
}

/** Bề rộng ô hình của bố cục Chữ và hình: chữ càng dài, ô hình càng hẹp để cột chữ rộng ra. */
export function imageArtWidth(textLength: number): number {
  return textLength <= 160 ? 480 : textLength <= 280 ? 400 : 340;
}

/**
 * Không cho xuống dòng ngay sau dấu gạch nối giữa hai chữ ("STEM-Robotics"): chèn ký tự nối từ U+2060 (không hiện, không
 * chiếm chỗ) sau dấu gạch. Dấu gạch đứng riêng (" - ") giữ nguyên.
 */
export function keepHyphenated(text: string): string {
  return text.replace(/([\p{L}\p{N}])-(?=[\p{L}\p{N}])/gu, "$1-\u2060");
}
