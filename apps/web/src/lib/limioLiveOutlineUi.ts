// Dữ liệu và hàm thuần cho giao diện sửa dàn ý (danh sách gọn + cửa sổ sửa một slide).
// Tách khỏi React để test được; tên loại slide khớp bộ chọn loại slide trong trình sửa bài giảng.

import { LAYOUT_META } from "./limioLiveSlides";
import {
  OUTLINE_LIMITS,
  finalizeParts,
  newOutlineId,
  newPartId,
  slideStructureRole,
  type Outline,
  type OutlineKind,
  type OutlineLayout,
  type OutlinePart,
  type OutlineSlide,
  type PartRole,
} from "./limioLiveOutline";

export const OUTLINE_KIND_LABEL: Record<OutlineKind, string> = {
  content: "Nội dung",
  quiz: "Trắc nghiệm",
  poll: "Vote",
  word_cloud: "Word Cloud",
  collaborate_board: "Dán Note",
  draw_it: "Draw-it (vẽ)",
  whiteboard: "Whiteboard",
};

/** Thứ tự hiển thị trong lưới chọn: ba loại cộng tác trên bảng đứng đầu; nhóm chỉ hiện khi rê chuột. */
export const OUTLINE_KIND_GROUPS: ReadonlyArray<{ group: string; kinds: readonly OutlineKind[] }> = [
  { group: "Cộng tác trên bảng", kinds: ["collaborate_board", "draw_it", "whiteboard"] },
  { group: "Trình bày", kinds: ["content"] },
  { group: "Hỏi và lấy ý kiến", kinds: ["quiz", "poll", "word_cloud"] },
];
export const OUTLINE_KIND_ORDER: readonly OutlineKind[] = OUTLINE_KIND_GROUPS.flatMap((g) => g.kinds);
export const kindGroupOf = (k: OutlineKind): string => OUTLINE_KIND_GROUPS.find((g) => g.kinds.includes(k))!.group;

/** Nhãn của ô nhập chính: tiêu đề với slide nội dung, lời nhắc cho học viên với slide tương tác. */
export const OUTLINE_KIND_TITLE: Record<OutlineKind, string> = {
  content: "Tiêu đề",
  quiz: "Câu hỏi",
  poll: "Câu hỏi bình chọn",
  word_cloud: "Câu gợi ý cho học viên",
  collaborate_board: "Yêu cầu cho học viên",
  draw_it: "Yêu cầu vẽ",
  whiteboard: "Yêu cầu cho cả lớp",
};

export const OUTLINE_KIND_HINT: Record<Exclude<OutlineKind, "content">, string> = {
  quiz: "Học viên trả lời trên điện thoại. Các lựa chọn đáp án sẽ do AI soạn ở bước tạo slide, bạn sửa được sau.",
  poll: "Học viên bình chọn trên điện thoại. Các lựa chọn sẽ do AI soạn ở bước tạo slide, bạn sửa được sau.",
  word_cloud: "Học viên gõ một từ hoặc cụm từ; kết quả hiện thành đám mây từ trên màn chiếu.",
  collaborate_board: "Bảng cộng tác kiểu Padlet: học viên dán ghi chú lên một bảng chung, cả lớp cùng xem. Bảng được liên kết khi bạn trình chiếu.",
  draw_it: "Mỗi học viên tự vẽ một hình rồi đăng lên bảng chung. Phù hợp khi muốn mỗi người có một sản phẩm riêng.",
  whiteboard: "Cả lớp cùng vẽ lên một khung trắng chung; tên người vẽ hiện cạnh nét vẽ. Phù hợp khi cần phác một sơ đồ cùng nhau.",
};

export const OUTLINE_KIND_USE: Partial<Record<OutlineKind, string>> = {
  collaborate_board: "Dùng khi cần thu nhiều ý ngắn từ cả lớp (ví dụ: mỗi bạn nêu một ví dụ).",
  draw_it: "Dùng khi mỗi người cần tự thể hiện một hình dung bằng hình vẽ.",
  whiteboard: "Dùng khi cả lớp cùng phác một sơ đồ hoặc giải một bài trên một khung.",
};

export const isContentKind = (k: OutlineKind): boolean => k === "content";

// ── Bố cục của slide nội dung ───────────────────────────────────────────────

export const OUTLINE_LAYOUT_UI: Record<OutlineLayout, { label: string; hint: string; min: number; max: number; need: string }> = {
  cover: { label: LAYOUT_META.cover.label, hint: "Slide đầu: tiêu đề lớn và một dòng mô tả ngắn.", min: 1, max: 1, need: "1 ý" },
  section: { label: "Mở phần", hint: "Đánh dấu bắt đầu một phần lớn của bài.", min: 0, max: 1, need: "0 đến 1 ý" },
  image: { label: LAYOUT_META.image.label, hint: "Một ý chính kèm tối đa ba ý hỗ trợ; bên phải là hình minh hoạ.", min: 1, max: 3, need: "1 đến 3 ý" },
  cards: { label: LAYOUT_META.cards.label, hint: "Ba ý song song; mỗi thẻ có tiêu đề ngắn và một câu giải thích.", min: 3, max: 3, need: "3 ý" },
  compare: { label: LAYOUT_META.compare.label, hint: "Đối chiếu hai cách làm hoặc hai khái niệm.", min: 2, max: 2, need: "2 ý" },
  steps: { label: LAYOUT_META.steps.label, hint: "Một quy trình; mỗi ý là một bước.", min: 3, max: 5, need: "3 đến 5 ý" },
  stats: { label: LAYOUT_META.stats.label, hint: "Chỉ dùng khi con số có trong tài liệu gốc.", min: 2, max: 4, need: "2 đến 4 ý" },
  quote: { label: LAYOUT_META.quote.label, hint: "Một thông điệp hoặc câu trích có trong tài liệu.", min: 1, max: 1, need: "1 ý" },
  summary: { label: LAYOUT_META.summary.label, hint: "Slide nội dung cuối: những điều cần ghi nhớ.", min: 3, max: 5, need: "3 đến 5 ý" },
  table: { label: LAYOUT_META.table.label, hint: "Thông tin đối chiếu theo hàng và cột. AI lấy đúng chữ và số trong tài liệu.", min: 1, max: 3, need: "1 đến 3 ý" },
  chart: {
    label: LAYOUT_META.chart.label,
    hint: "Chỉ dùng khi các con số có trong tài liệu gốc. Mỗi ý một cặp “Nhãn: số”, ví dụ “Tuần 1: 62%”.",
    min: 2,
    max: 5,
    need: "2 đến 5 ý",
  },
};

export const OUTLINE_POINT_LABELS: Record<OutlineLayout, readonly string[]> = {
  cover: ["Mô tả ngắn"],
  section: ["Mô tả ngắn"],
  image: ["Ý chính", "Ý hỗ trợ 1", "Ý hỗ trợ 2", "Ý hỗ trợ 3"],
  cards: ["Thẻ 1", "Thẻ 2", "Thẻ 3"],
  compare: ["Cách làm A", "Cách làm B"],
  steps: ["Bước 1", "Bước 2", "Bước 3", "Bước 4", "Bước 5"],
  stats: ["Số liệu 1", "Số liệu 2", "Số liệu 3", "Số liệu 4"],
  quote: ["Thông điệp"],
  summary: ["Điều cần nhớ 1", "Điều cần nhớ 2", "Điều cần nhớ 3", "Điều cần nhớ 4", "Điều cần nhớ 5"],
  table: ["Bảng cho thấy", "Ý bổ sung 1", "Ý bổ sung 2"],
  chart: ["Số liệu 1", "Số liệu 2", "Số liệu 3", "Số liệu 4", "Số liệu 5"],
};

/** Bố cục mà mỗi ý gồm hai phần "Tiêu đề ngắn: câu giải thích" (dữ liệu vẫn là một chuỗi). */
export const SPLIT_POINT_LAYOUTS: ReadonlySet<OutlineLayout> = new Set<OutlineLayout>(["cards", "steps"]);

/** Tách "Tiêu đề: giải thích". Dấu hai chấm phải đứng trước khoảng trắng hoặc cuối chuỗi (không tách "tỷ lệ 3:1"). */
export function splitPoint(p: string): [string, string] {
  const m = /^(.{1,80}?):(?:\s+|$)/.exec(p);
  return m ? [m[1]!.trim(), p.slice(m[0].length)] : ["", p];
}

export function joinPoint(heading: string, body: string): string {
  const h = heading.trim();
  if (!h) return body;
  return `${h}: ${body}`;
}

/** Số ý có chữ so với yêu cầu của bố cục. */
export function pointStatus(layout: OutlineLayout, points: string[]): { n: number; ok: boolean; need: string } {
  const u = OUTLINE_LAYOUT_UI[layout];
  const n = points.filter((p) => p.trim()).length;
  return { n, ok: n >= u.min && n <= u.max, need: u.need };
}

// ── Danh sách gọn ───────────────────────────────────────────────────────────

/** Khoá hình vẽ cho một dòng: slide nội dung theo bố cục, slide tương tác theo loại. */
export function glyphKey(s: Pick<OutlineSlide, "kind" | "layout">): OutlineLayout | OutlineKind {
  return s.kind === "content" ? s.layout ?? "image" : s.kind;
}

/** Dòng phụ dưới tiêu đề ở danh sách: "Chữ và hình · 3 ý" hoặc tên loại slide. */
export function rowSubtitle(s: Pick<OutlineSlide, "kind" | "layout" | "points">): string {
  if (s.kind !== "content") return OUTLINE_KIND_LABEL[s.kind];
  const n = s.points.filter((p) => p.trim()).length;
  return `${OUTLINE_LAYOUT_UI[s.layout ?? "image"].label} · ${n} ý`;
}

// ── Đổi loại / bố cục ───────────────────────────────────────────────────────

/**
 * Đổi loại slide mà không mất nhầm dữ liệu: tiêu đề luôn được giữ (thành câu hỏi hoặc lời nhắc).
 * Sang loại tương tác thì bỏ bố cục và các ý; từ tương tác về nội dung thì bắt đầu bằng một ý trống.
 */
export function changeKind(s: OutlineSlide, kind: OutlineKind): Partial<OutlineSlide> {
  if (kind === s.kind) return {};
  if (kind === "content") return { kind, layout: "image", points: [""] };
  return { kind, layout: null, points: [] };
}

// ── Mạch cấu trúc: thao tác trên phần (hàm thuần, mọi kết quả đã qua finalizeParts) ──

/** Một đoạn liền nhau của danh sách slide thuộc cùng một phần, kèm số thứ tự nếu là phần Nội dung. */
export interface PartRun {
  part: OutlinePart;
  from: number;
  to: number;
  /** 1, 2, 3… với phần Nội dung; 0 với vai trò khác. */
  ordinal: number;
}

export function partRuns(o: Outline): PartRun[] {
  const out: PartRun[] = [];
  let n = 0;
  o.slides.forEach((s, i) => {
    const last = out[out.length - 1];
    if (last && last.part.id === s.partId) {
      last.to = i;
      return;
    }
    const part = o.parts.find((p) => p.id === s.partId);
    if (!part) return;
    out.push({ part, from: i, to: i, ordinal: part.role === "content" ? ++n : 0 });
  });
  return out;
}

/** Phần chỉ gồm một slide theo mạch: không có nút "Thêm slide vào phần này". */
export const SINGLE_SLIDE_ROLES: ReadonlySet<PartRole> = new Set<PartRole>(["cover", "objectives", "agenda"]);

export type MoveTarget = { over: string } | { start: string } | { end: string };

/**
 * Kéo thả: thả lên một slide thì đứng vào chỗ slide đó (như arrayMove) và thuộc phần của nó;
 * thả lên tên phần thì thành slide đầu của phần; thả lên cuối phần thì thành slide cuối của phần.
 */
export function moveSlide(o: Outline, id: string, target: MoveTarget): Outline {
  const from = o.slides.findIndex((s) => s.id === id);
  if (from < 0) return o;
  const moving = { ...o.slides[from]! };
  if ("over" in target) {
    const to = o.slides.findIndex((s) => s.id === target.over);
    if (to < 0 || to === from) return o;
    moving.partId = o.slides[to]!.partId;
    const slides = [...o.slides];
    slides.splice(from, 1);
    slides.splice(to, 0, moving);
    return finalizeParts({ ...o, slides });
  }
  const partId = "start" in target ? target.start : target.end;
  if (!o.parts.some((p) => p.id === partId)) return o;
  const slides = o.slides.filter((s) => s.id !== id);
  moving.partId = partId;
  let at: number;
  if ("start" in target) at = slides.findIndex((s) => s.partId === partId);
  else {
    at = -1;
    slides.forEach((s, i) => {
      if (s.partId === partId) at = i + 1;
    });
  }
  slides.splice(at < 0 ? slides.length : at, 0, moving);
  return finalizeParts({ ...o, slides });
}

export interface RemovedSlide {
  slide: OutlineSlide;
  index: number;
  part: OutlinePart | undefined;
}

/** Xoá ngay (không hỏi lại); trả kèm dữ liệu để Hoàn tác. Không xoá slide cuối cùng. */
export function removeSlide(o: Outline, id: string): { outline: Outline; removed: RemovedSlide | null } {
  const index = o.slides.findIndex((s) => s.id === id);
  if (index < 0 || o.slides.length <= 1) return { outline: o, removed: null };
  const slide = o.slides[index]!;
  return {
    outline: finalizeParts({ ...o, slides: o.slides.filter((s) => s.id !== id) }),
    removed: { slide, index, part: o.parts.find((p) => p.id === slide.partId) },
  };
}

/** Hoàn tác xoá: đặt slide về chỗ cũ; phần đã biến mất vì hết slide thì có lại. */
export function restoreSlide(o: Outline, r: RemovedSlide): Outline {
  if (o.slides.some((s) => s.id === r.slide.id)) return o;
  const slides = [...o.slides];
  slides.splice(Math.min(r.index, slides.length), 0, r.slide);
  const parts = r.part && !o.parts.some((p) => p.id === r.part!.id) ? [...o.parts, r.part] : o.parts;
  return finalizeParts({ ...o, slides, parts });
}

/** Thêm một slide nội dung trống vào cuối một phần. */
export function addSlideToPart(o: Outline, partId: string): { outline: Outline; id: string } {
  const id = newOutlineId();
  let at = -1;
  o.slides.forEach((s, i) => {
    if (s.partId === partId) at = i + 1;
  });
  const slides = [...o.slides];
  slides.splice(at < 0 ? slides.length : at, 0, { id, partId, kind: "content", layout: "image", title: "", points: [""] });
  return { outline: finalizeParts({ ...o, slides }), id };
}

/**
 * Thêm một phần Nội dung đứng trước Tổng kết (hoặc cuối bài). Buổi đủ mạch thì phần mới mở bằng
 * slide "Mở phần"; buổi ngắn thì bằng một slide nội dung trống.
 */
export function addContentPart(o: Outline, full: boolean, name = "Phần mới"): { outline: Outline; partId: string; slideId: string } {
  const partId = newPartId();
  const slideId = newOutlineId();
  const summary = o.parts.find((p) => p.role === "summary");
  const at = summary ? o.slides.findIndex((s) => s.partId === summary.id) : -1;
  const slide: OutlineSlide = full
    ? { id: slideId, partId, kind: "content", layout: "section", title: name, points: [] }
    : { id: slideId, partId, kind: "content", layout: "image", title: "", points: [""] };
  const slides = [...o.slides];
  slides.splice(at < 0 ? slides.length : at, 0, slide);
  return { outline: finalizeParts({ ...o, slides, parts: [...o.parts, { id: partId, role: "content", name }] }), partId, slideId };
}

export function renamePart(o: Outline, partId: string, name: string): Outline {
  const clean = name.trim().slice(0, OUTLINE_LIMITS.partName);
  if (!clean) return o;
  return finalizeParts({ ...o, parts: o.parts.map((p) => (p.id === partId ? { ...p, name: clean } : p)) });
}

/** Sửa một slide; sửa tiêu đề slide mở phần là đổi tên phần (hai chỗ luôn khớp nhau). */
export function patchSlide(o: Outline, id: string, p: Partial<OutlineSlide>): Outline {
  const s = o.slides.find((x) => x.id === id);
  if (!s) return o;
  const opener = p.title !== undefined && slideStructureRole(o, s) === "opener";
  const parts = opener ? o.parts.map((x) => (x.id === s.partId ? { ...x, name: p.title! } : x)) : o.parts;
  return finalizeParts({ ...o, parts, slides: o.slides.map((x) => (x.id === id ? { ...x, ...p } : x)) });
}
