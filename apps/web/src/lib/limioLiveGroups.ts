// Bố cục Nhóm cho slide hai cấp (ý cha và ý con), tiêu chí P55–P59, bản mẫu docs/mockup/slide-hai-cap.html.
// Mọi hàm ở đây thuần (không đụng DOM, không import limioLiveSlides) để cả bộ vẽ, bộ nhập PowerPoint và test dùng chung:
// kiểu trình bày do NỘI DUNG quyết định, giảng viên không chọn.

export interface SlideGroup {
  heading: string;
  points: string[];
}

/** Phần nội dung của slide Nhóm mà bộ ước lượng cần. */
export interface GroupsContent {
  title?: string;
  /** Câu dẫn (câu hỏi) đứng trên nhóm; chỉ dùng ở kiểu Câu dẫn và các dòng, Số liệu. */
  lead?: string;
  groups: SlideGroup[];
}

export type GroupsVariant = "cards" | "list" | "ask" | "stats";

export const GROUPS_MAX = 6;
export const GROUP_POINTS_MAX = 5;
/** Kiểu Thẻ chỉ nhận nhóm ngắn: tên, số ý con, độ dài mỗi ý con. */
export const CARD_LIMITS = { minGroups: 2, maxGroups: 4, heading: 40, points: 4, point: 90 } as const;
/** Kiểu Số liệu: số ý con có con số, số ý còn lại (thành thanh ngắn). */
export const STATS_LIMITS = { minNumbers: 2, maxNumbers: 3, maxRest: 3 } as const;

const MIN_PX = 26;
/** Chữ thân (ý con) lấy cỡ lớn nhất còn vừa khung, tới 44 px: slide ít chữ không được để chữ bé giữa khoảng trống. */
const BODY_LADDER = Array.from({ length: 10 }, (_, i) => 44 - i * 2); // 44, 42, …, 26
/** Ý cha cùng cỡ chữ với ý con: phân cấp bằng màu nhấn, đậm và vệt tô màu, không bằng cỡ chữ (để chữ thân luôn to). */
export const groupHeadPx = (bodyPx: number): number => bodyPx;
/** Khung nội dung của slide Nhóm trên khung thiết kế 1280 × 720: lề 40/64 px, trong vùng an toàn của bộ đo (limioLiveFit.FIT_SAFE). */
const W = 1152;
const H = 628;
/** Chiều rộng trung bình của một ký tự theo cỡ chữ (chữ Việt có dấu, phông không chân). */
const CHAR = 0.52;

const plain = (s: string) => s.replace(/\*\*|==|\*/g, "");
const lines = (text: string, px: number, width: number) => Math.max(1, Math.ceil((plain(text).length * CHAR * px) / Math.max(40, width)));

/** Con số kèm đơn vị ở đầu ý con: "23%", "2,5 lần". Cắt nguyên văn từ ý con (không tính lại, không làm tròn). */
const NUMBER_RE = /(\d+(?:[.,]\d+)?)\s?(%|phần trăm|lần|times|x|×)(?![\p{L}])/iu;
export function numberOf(point: string): string | null {
  const m = NUMBER_RE.exec(point);
  if (!m) return null;
  const unit = m[2]!.toLowerCase() === "phần trăm" ? "%" : m[2]!;
  // "%" và "x" viết liền số; chữ ("lần", "times") cách một khoảng trắng.
  return /^[%x×]$/i.test(unit) ? `${m[1]}${unit}` : `${m[1]} ${unit}`;
}
export const numericPoints = (points: string[]): number => points.filter((p) => numberOf(p)).length;

/** Câu dẫn mang nghĩa phủ định ("…is not?", "không phải", "myths"): dấu đầu dòng là ×. */
const NEGATIVE_ASK = /(?<![\p{L}])(?:not|isn['’]t|aren['’]t|never|myths?|mistakes?|misconceptions?)(?![\p{L}])|không phải|hiểu lầm|ngộ nhận|sai lầm/iu;
export const isNegativeAsk = (text: string): boolean => NEGATIVE_ASK.test(text);

const w = (words: string) => `(?<![\\p{L}])(?:${words})(?![\\p{L}])`;
/** Tên nhóm "đi xuống" và "đi lên"; từ phủ định thắng ("mất lợi thế" là đi xuống dù có "lợi"). */
const DOWN = new RegExp(w("mất|giảm|trước|trước đây|chưa|yếu|hạn chế|nhược|bất lợi|khó khăn|cons?|before|decline|lose|losing|loss|weak|disadvantages?|negative|problems?|risks?|threats?|past"), "iu");
const UP = new RegExp(w("được|tăng|gia tăng|nay|hiện nay|sau|mạnh|ưu|lợi|lợi thế|pros?|after|gain|growing|strengths?|advantages?|positive|benefits?|solutions?|future|reality"), "iu");

/** Hai tên nhóm đối lập thì trả tông màu của từng nhóm (bad = đi xuống, good = đi lên); không đối lập thì null (P56). */
export function contrastTones(a: string, b: string): ["bad" | "good", "bad" | "good"] | null {
  const tone = (s: string): "bad" | "good" | null => (DOWN.test(s) ? "bad" : UP.test(s) ? "good" : null);
  const ta = tone(a);
  const tb = tone(b);
  return ta && tb && ta !== tb ? [ta, tb] : null;
}

export interface GroupsFit {
  variant: GroupsVariant;
  /** Cỡ chữ của ý con (px trên khung 1280 × 720, không dưới 26). */
  px: number;
  /** Số cột của Danh sách nhóm (1 hoặc 2); 1 với các kiểu khác. */
  cols: 1 | 2;
  /** Ngay cả kiểu cuối cùng (Danh sách nhóm một cột, 26 px) vẫn không vừa: người gọi chia slide. */
  overflow: boolean;
}

function titleBlock(title: string | undefined): number {
  const t = plain(title ?? "").trim();
  if (!t) return 0;
  const one = t.length * CHAR * 52 <= W;
  const px = one ? 52 : t.length <= 104 ? 44 : 38;
  return (one ? 1 : 2) * px * 1.2 + 20;
}

function cardsFit(c: GroupsContent): number | null {
  const n = c.groups.length;
  if (n < CARD_LIMITS.minGroups || n > CARD_LIMITS.maxGroups) return null;
  if (c.groups.some((g) => !g.points.length || plain(g.heading).length > CARD_LIMITS.heading || g.points.length > CARD_LIMITS.points || g.points.some((p) => plain(p).length > CARD_LIMITS.point))) return null;
  const colW = (W - 24 * (n - 1)) / n - 48;
  const avail = H - titleBlock(c.title);
  for (const px of BODY_LADDER) {
    const hp = groupHeadPx(px);
    const h = Math.max(
      ...c.groups.map((g) => 44 + 16 + lines(`00 ${g.heading}`, hp, colW) * hp * 1.25 + g.points.reduce((s, p) => s + lines(p, px, colW - 18) * px * 1.3 + 12, 0)),
    );
    if (h <= avail) return px;
  }
  return null;
}

function listFit(c: GroupsContent, cols: 1 | 2): number | null {
  const colW = cols === 2 ? (W - 48) / 2 : W;
  const avail = H - titleBlock(c.title) - (c.lead ? 70 : 0);
  for (const px of BODY_LADDER) {
    const hp = groupHeadPx(px);
    const heights = c.groups.map(
      (g) => lines(g.heading, hp, colW - 60) * hp * 1.2 + g.points.reduce((s, p) => s + lines(p, px, colW - 22) * px * 1.3 + 8, 0) + 18,
    );
    // Lưới xếp theo hàng (01 02 / 03 04 / 05): chiều cao = tổng chiều cao hàng, mỗi hàng lấy nhóm cao nhất.
    let h = 0;
    for (let k = 0; k < heights.length; k += cols) h += Math.max(...heights.slice(k, k + cols));
    if (h <= avail) return px;
  }
  return null;
}

/** Con số của kiểu Số liệu lớn hơn chữ thân một bậc cố định (dữ liệu nhấn, không phải phân cấp ý); đủ nhỏ để chữ giải thích vẫn to. */
export const STAT_NUMBER_PX = 64;

/** Câu dẫn cùng cỡ chữ với các dòng bên dưới (phân cấp bằng màu nhấn và vệt tô, không bằng cỡ chữ). */
function askFit(c: GroupsContent): number | null {
  const g = c.groups[0]!;
  const ask = c.lead || g.heading;
  for (const px of [52, 50, 48, 46, ...BODY_LADDER]) {
    const askH = lines(ask, px, W) * px * 1.25 + 24;
    const rows = g.points.reduce((s, p) => s + lines(p, px, W - 120) * px * 1.3 + 22, 0);
    if (34 + askH + rows <= H) return px;
  }
  return null;
}

function statsFit(c: GroupsContent): number | null {
  const g = c.groups[0]!;
  const nums = g.points.filter((p) => numberOf(p));
  const rest = g.points.filter((p) => !numberOf(p));
  if (nums.length < STATS_LIMITS.minNumbers || nums.length > STATS_LIMITS.maxNumbers || rest.length > STATS_LIMITS.maxRest) return null;
  const ask = c.lead || g.heading;
  const colW = (W - 24 * (nums.length - 1)) / nums.length - 48;
  const longest = rest.reduce((a, b) => (a.length > b.length ? a : b), "");
  for (const px of BODY_LADDER) {
    const askH = lines(ask, px, W) * px * 1.25 + 24;
    const cardH = Math.max(...nums.map((p) => STAT_NUMBER_PX * 1.05 + lines(p, px, colW) * px * 1.3 + 44));
    const chipPx = Math.max(MIN_PX, px - 4);
    const chipsH = Math.ceil(rest.length / 2) * (lines(longest, chipPx, (W - 24) / 2 - 48) * chipPx * 1.3 + 28 + 16);
    if (34 + askH + cardH + chipsH + 48 <= H) return px;
  }
  return null;
}

/**
 * Kiểu trình bày của một slide Nhóm theo nội dung (P55, P57), nhường dần khi không vừa ở 26 px:
 * một nhóm: Số liệu → Câu dẫn và các dòng; 2 đến 4 nhóm ngắn: Thẻ; còn lại Danh sách nhóm (hai cột khi từ 4 nhóm và còn vừa).
 * `overflow` chỉ true khi Danh sách nhóm một cột ở 26 px vẫn không vừa.
 */
export function groupsFit(c: GroupsContent): GroupsFit {
  const n = c.groups.length;
  const out = (variant: GroupsVariant, px: number, cols: 1 | 2 = 1): GroupsFit => ({ variant, px, cols, overflow: false });
  if (n === 1) {
    const s = statsFit(c);
    if (s) return out("stats", s);
    const a = askFit(c);
    if (a) return out("ask", a);
  } else if (n >= 2) {
    const k = cardsFit(c);
    if (k) return out("cards", k);
  }
  if (n >= 4) {
    const px = listFit(c, 2);
    if (px) return out("list", px, 2);
  }
  const px = listFit(c, 1);
  if (px) return out("list", px, 1);
  return { variant: "list", px: MIN_PX, cols: n >= 4 ? 2 : 1, overflow: true };
}
