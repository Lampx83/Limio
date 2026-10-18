// Hoa văn trang trí slide Limio-Live (mockup docs/mockup/hoa-van-slide.html). Module thuần: chọn hoa văn
// cho từng slide và tính độ đậm an toàn; hình SVG nằm ở limioLiveMotifArt.ts.
//
// Nguyên tắc: chỉ hình trừu tượng, chỉ ở chỗ trống của bốn bố cục (bìa, bìa phần, chữ và hình chưa có ảnh,
// trích dẫn), màu lấy hoàn toàn từ biến giao diện. Giảng viên không phải chọn: mỗi bài có một hoa văn chủ
// đạo suy ra từ mã bài giảng; muốn đổi thì đổi một lần cho cả bài (LiveDeck.motif) hoặc riêng một slide
// (config.motif).
//
// Riêng ô hình của Chữ và hình còn nhận được một trong 12 hình minh hoạ theo chủ đề (SLIDE_ILLUSTRATIONS, mockup
// docs/mockup/hinh-minh-hoa-chu-de.html), lưu chung ở config.motif của slide. Hình chỉ do AI chọn lúc sinh slide
// hoặc giảng viên chọn trong lưới; không bao giờ là lựa chọn của cả bài và không được đoán theo từ khoá.

import { SLIDE_ILLUSTRATION_LABELS, isSlideIllustrationId, type SlideIllustrationId } from "@feedbackme/shared-types";

/** Thứ tự này quyết định cách xoay vòng ở ô hình: hai hoa văn kề nhau trong danh sách trông khác hẳn nhau. */
export const SLIDE_MOTIFS = [
  "song",
  "khoi",
  "cham",
  "dongmuc",
  "cung",
  "diemnoi",
  "soc",
  "vet",
  "lucgiac",
  "dongchay",
  "banchi",
  "tamgiac",
  "vong",
  "gach",
  "oke",
  "tia",
] as const;
export type SlideMotifId = (typeof SLIDE_MOTIFS)[number];

/** Lựa chọn của cả bài (LiveDeck.motif): một hoa văn cụ thể, hoặc "none" = không dùng. Không lưu gì = tự động. */
export type MotifChoice = SlideMotifId | "none";
export const MOTIF_CHOICES = [...SLIDE_MOTIFS, "none"] as const;

/** Thứ vẽ được ở chỗ trang trí: hoa văn trừu tượng, hoặc hình minh hoạ (chỉ ở ô hình). */
export type SlideArtId = SlideMotifId | SlideIllustrationId;
/** Lựa chọn riêng của một slide (config.motif): như của cả bài, cộng thêm hình minh hoạ. */
export type SlideMotifChoice = MotifChoice | SlideIllustrationId;

export const MOTIF_LABELS: Record<SlideMotifId, string> = {
  song: "Sóng",
  khoi: "Khối hình học",
  cham: "Lưới chấm",
  dongmuc: "Đường đồng mức",
  cung: "Cung tròn",
  diemnoi: "Điểm nối",
  soc: "Sọc chéo",
  vet: "Vệt màu mềm",
  lucgiac: "Lục giác",
  dongchay: "Dòng chảy",
  banchi: "Chấm loang",
  tamgiac: "Khảm tam giác",
  vong: "Vòng đồng tâm",
  gach: "Nét gạch",
  oke: "Ô kẻ",
  tia: "Tia",
};

export const isMotifId = (v: unknown): v is SlideMotifId => typeof v === "string" && (SLIDE_MOTIFS as readonly string[]).includes(v);
export const isMotifChoice = (v: unknown): v is MotifChoice => v === "none" || isMotifId(v);
export const isSlideMotifChoice = (v: unknown): v is SlideMotifChoice => isMotifChoice(v) || isSlideIllustrationId(v);

/** Tên hiển thị của một hoa văn hoặc hình minh hoạ. */
export const slideArtLabel = (id: SlideArtId): string => (isSlideIllustrationId(id) ? SLIDE_ILLUSTRATION_LABELS[id] : MOTIF_LABELS[id]);

/**
 * Chỗ đặt hoa văn trên khung 1280×720:
 * - side: dải phải của bìa (chữ bìa rộng tối đa 800 px nên không qua x = 896, mặt nạ trong suốt tới đúng mốc đó);
 * - br / tr: một góc của bìa phần, trích dẫn (chữ dài có thể chạm tới, nên độ đậm bị chặn);
 * - fill: phủ ô hình của bố cục Chữ và hình khi chưa có ảnh (không có chữ).
 */
export type MotifSlot = "side" | "br" | "tr" | "fill";

/** Kích thước vùng vẽ (px trên khung thiết kế) của từng chỗ đặt. */
export const MOTIF_SLOT_SIZE: Record<MotifSlot, [number, number]> = {
  side: [480, 720],
  br: [600, 440],
  tr: [600, 440],
  fill: [464, 500],
};

/** Bố cục có chỗ cho hoa văn: dùng để quyết định có hiện mục "Hoa văn" trong trình sửa hay không. */
export const MOTIF_LAYOUTS = ["cover", "section", "image", "quote"] as const;

type Cfg = Record<string, unknown> | null | undefined;

/** Bìa phần có mục lục hợp lệ (cùng điều kiện với bộ vẽ SlideLayouts). */
function hasToc(c: Record<string, unknown>): boolean {
  const toc = Array.isArray(c.toc) ? c.toc.filter((t) => typeof t === "string") : [];
  const cur = Number(c.tocCurrent);
  return toc.length >= 2 && cur >= 1 && cur <= toc.length;
}

/** Chỗ đặt hoa văn của một slide theo bố cục; null = bố cục này không có hoa văn. */
export function motifSlot(config: Cfg): MotifSlot | null {
  const c = config ?? {};
  if (c.resource) return null;
  switch (c.layout) {
    case "cover":
      return "side";
    case "section":
      // Bìa phần có mục lục không có chỗ trống: góc nào cũng nằm dưới số, tên phần hoặc mục lục, hoa văn đè lên chữ
      // trông rối (giảng viên góp ý 2026-10-18). Giữ hai vệt sáng mờ như trước.
      return hasToc(c) ? null : "br";
    case "quote":
      return "tr";
    case "image":
      return typeof c.imageUrl === "string" && c.imageUrl.trim() ? null : "fill";
    default:
      return null;
  }
}

/** FNV-1a 32 bit: ổn định giữa máy chủ và trình duyệt, đủ rải đều cho 16 lựa chọn. */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Thứ tự của từng slide "Chữ và hình" chưa có ảnh trong bài (0, 1, 2…), theo thứ tự trình chiếu.
 * Dùng để các ô hình lần lượt nhận hoa văn khác nhau.
 */
export function motifImageOrdinals(slides: ReadonlyArray<{ id: string; type?: string; config?: unknown }>): Map<string, number> {
  const out = new Map<string, number>();
  let n = 0;
  for (const s of slides) {
    if (s.type && s.type !== "content") continue;
    if (motifSlot(s.config as Cfg) === "fill") out.set(s.id, n++);
  }
  return out;
}

/** Hoa văn chủ đạo mà chế độ tự động cho ra với một bài giảng (dùng cho bìa, bìa phần, trích dẫn). */
export function deckAutoMotif(deckId: string | null | undefined): SlideMotifId {
  return SLIDE_MOTIFS[hash32(deckId ?? "") % SLIDE_MOTIFS.length]!;
}

export interface ResolveMotifInput {
  deckId: string | null | undefined;
  /** LiveDeck.motif: null/undefined = tự động, "none" = tắt cả bài, hoặc một hoa văn chủ đạo. */
  deckChoice?: string | null;
  config: Cfg;
  /** Thứ tự của slide trong các ô hình của bài (motifImageOrdinals); không biết thì 0. */
  imageOrdinal?: number;
}

/**
 * Hoa văn và chỗ đặt của một slide, hoặc null nếu slide không có hoa văn.
 * Ưu tiên: lựa chọn riêng của slide > lựa chọn của cả bài > tự động.
 * Hình minh hoạ chọn riêng chỉ có hiệu lực ở ô hình; ở chỗ khác coi như slide không chọn gì (mã vẫn giữ trong config,
 * đổi lại bố cục thì hình trở lại).
 * Tự động: hoa văn chủ đạo = hash(mã bài) cho bìa, bìa phần, trích dẫn (cả bài trông như một bộ); ô hình thứ k
 * lấy trong 15 hoa văn còn lại với bước 4 (nguyên tố cùng nhau với 15), nên không trùng hoa văn chủ đạo,
 * đi hết 15 mới lặp và hai ô liền nhau không bao giờ giống nhau.
 */
export function resolveSlideMotif(input: ResolveMotifInput): { motif: SlideArtId; slot: MotifSlot } | null {
  const slot = motifSlot(input.config);
  if (!slot) return null;
  const own = (input.config ?? {}).motif;
  if (own === "none") return null;
  if (isMotifId(own)) return { motif: own, slot };
  if (slot === "fill" && isSlideIllustrationId(own)) return { motif: own, slot };
  if (input.deckChoice === "none") return null;
  const n = SLIDE_MOTIFS.length;
  const base = SLIDE_MOTIFS.indexOf(isMotifId(input.deckChoice) ? input.deckChoice : deckAutoMotif(input.deckId));
  if (slot !== "fill") return { motif: SLIDE_MOTIFS[base]!, slot };
  const k = Math.max(0, Math.floor(input.imageOrdinal ?? 0));
  return { motif: SLIDE_MOTIFS[(base + 1 + ((k * 4) % (n - 1))) % n]!, slot };
}

/**
 * Lựa chọn hoa văn/hình của slide sau khi viết lại từ dàn ý (slide chưa sửa tay). Đổi hoa văn không tính là sửa
 * tay nên phải giữ riêng: hoa văn hay "none" của slide cũ luôn giữ (AI không bao giờ chọn những thứ đó, nên chắc chắn
 * do giảng viên chọn); hình minh hoạ cũ nhường cho hình AI vừa chọn lại, không có thì giữ.
 */
export function motifAfterRegenerate(oldChoice: unknown, generated: unknown): SlideMotifChoice | undefined {
  const fresh = isSlideIllustrationId(generated) ? generated : undefined;
  if (!isSlideMotifChoice(oldChoice)) return fresh;
  return isSlideIllustrationId(oldChoice) && fresh ? fresh : oldChoice;
}

// ── Độ đậm an toàn cho chữ ────────────────────────────────────────────────
// Hoa văn ở góc có thể nằm dưới chữ. Độ đậm lớn nhất (--smo) phải giữ: chữ chính và chữ phụ ≥ 4.5:1,
// chữ màu nhấn (luôn ≥ 40 px, tức chữ lớn) ≥ 3:1, ở chỗ đậm nhất của hoa văn, trên cả hai đầu dải nền.

const rgb = (hex: string): [number, number, number] => {
  const h = hex.replace("#", "");
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
};
const lum = ([r, g, b]: [number, number, number]): number => {
  const f = (x: number) => {
    const v = x / 255;
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: [number, number, number], b: [number, number, number]): number => {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
};
const mix = (fg: [number, number, number], bg: [number, number, number], a: number): [number, number, number] =>
  fg.map((c, i) => c * a + bg[i]! * (1 - a)) as [number, number, number];

/** Các mã màu #RRGGBB trong một chuỗi nền (màu đơn hoặc linear-gradient). */
export const hexColorsIn = (bg: string): string[] => bg.match(/#[0-9A-Fa-f]{6}\b/g) ?? [];

/**
 * Độ đậm lớn nhất (bước 0,01, đã chừa 0,01) của hoa văn tô bằng `inks` để chữ trên mọi nền `bgs` vẫn đạt ngưỡng.
 * 0 nghĩa là không có độ đậm nào an toàn (ví dụ chữ đã sát ngưỡng ngay trên nền trơn).
 */
export function motifOpacityCap(p: { inks: string[]; bgs: string[]; text: string; muted: string; accent: string }): number {
  const ok = (a: number) =>
    p.bgs.every((bg) =>
      p.inks.every((ink) => {
        const m = mix(rgb(ink), rgb(bg), a);
        return ratio(rgb(p.text), m) >= 4.5 && ratio(rgb(p.muted), m) >= 4.5 && ratio(rgb(p.accent), m) >= 3;
      }),
    );
  if (!p.bgs.length || !ok(0)) return 0;
  let best = 0;
  for (let i = 1; i <= 100; i++) {
    if (!ok(i / 100)) break;
    best = i;
  }
  return Math.max(0, best - 1) / 100;
}
