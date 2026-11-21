/**
 * Giao diện bài học cho khoá tiếng Trung (kiểu giáo trình HSK): đầu bài có con dấu, các mục đánh số (Hội thoại · Từ mới · Ngữ pháp · Luyện tập).
 * Bài học HSK nhập từ sách là một dãy khối cố định (khối tiêu đề, hội thoại, bảng từ mới, khung 小语讲堂, rồi các bài luyện), nên nhận diện khối theo nội dung
 * lúc hiển thị, không cần nhập lại bài. Chỉ dùng khi khoá có chế độ ngoại ngữ và ngôn ngữ là tiếng Trung.
 */

import { authoredKind, isAuthoredLesson, planAuthored, type AuthoredKind, type AuthoredSeg } from "./hskAuthored";

export type HskKind = "intro" | "intro-brief" | "dialogue" | "vocab" | "grammar" | "activity" | "goals" | "pair" | "other" | AuthoredKind;

export interface HskSection {
  zh: string;
  vi: string;
}

/** Tên mục theo loại khối. Số thứ tự không cố định: bài không có hội thoại thì Từ mới là mục 01. */
export const HSK_SECTIONS: Record<Exclude<HskKind, "intro" | "intro-brief" | "other" | AuthoredKind> | "practice", HskSection> = {
  dialogue: { zh: "对话", vi: "Hội thoại" },
  vocab: { zh: "生词", vi: "Từ mới" },
  grammar: { zh: "小语讲堂", vi: "Lớp học của Tiểu Ngữ" },
  activity: { zh: "课堂活动", vi: "Hoạt động trên lớp" },
  goals: { zh: "目标", vi: "Mục tiêu" },
  pair: { zh: "双人对话", vi: "Thảo luận theo cặp" },
  practice: { zh: "练习", vi: "Luyện tập" },
};

interface ItemLike {
  type: string;
  payload: unknown;
}

const htmlOf = (item: ItemLike): string => {
  const h = (item.payload as { html?: unknown } | null)?.html;
  return typeof h === "string" ? h : "";
};

/** Loại của một khối trong thân bài. `index` là vị trí trong danh sách khối của bài (khối đầu tiên dạng văn bản là khối tiêu đề). */
export function classifyHskItem(item: ItemLike, index: number): HskKind {
  if (item.type === "dialogue") return "dialogue";
  if (item.type !== "richtext") return "other";
  const html = htmlOf(item);
  if (/小语讲堂/.test(html)) return "grammar";
  if (/课堂活动/.test(html)) return "activity";
  if (/<h2\b[^>]*>(?:(?!<\/h2>)[\s\S])*目标/.test(html)) return "goals";
  if (index > 0 && /两人一组/.test(html)) return "pair";
  if (/生词/.test(html) && /<table/i.test(html)) return "vocab";
  return index === 0 ? "intro" : "other";
}

/** Loại từng khối + số mục (1, 2, …) cho khối đầu tiên của mỗi loại hội thoại / từ mới / ngữ pháp. */
export function planHskSections(items: ItemLike[], startNo = 0, forceAuthored = false): {
  kinds: HskKind[];
  headAt: Map<number, { no: number; section: HskSection }>;
  count: number;
  /** Bài tác giả soạn (xem hskAuthored.ts): đoạn của từng khối chữ, mỗi đoạn có tiêu đề mục đánh số hoặc nhãn nhỏ riêng. Bài sách thì rỗng. */
  segs: Map<number, AuthoredSeg[]>;
} {
  if (forceAuthored || isAuthoredLesson(items)) {
    const kinds: HskKind[] = items.map((it) => (it.type === "dialogue" ? "dialogue" : it.type !== "richtext" ? "other" : authoredKind(htmlOf(it))));
    const { segs, count } = planAuthored(items, kinds, startNo);
    return { kinds, headAt: new Map(), count, segs };
  }
  const kinds = items.map((it, i) => classifyHskItem(it, i));
  // Khối tiêu đề đứng ngay trước hội thoại (câu dẫn + yêu cầu "Nghe hai lần…") thuộc mục Hội thoại: hiện thành dải nhắc dưới tiêu đề mục.
  kinds.forEach((k, i) => {
    if (k === "intro" && kinds[i + 1] === "dialogue") kinds[i] = "intro-brief";
  });
  const headAt = new Map<number, { no: number; section: HskSection }>();
  const seen = new Set<HskKind>();
  let no = 0;
  kinds.forEach((k, i) => {
    if ((k === "dialogue" || k === "vocab" || k === "grammar" || k === "activity" || k === "goals" || k === "pair") && !seen.has(k)) {
      seen.add(k);
      no += 1;
      headAt.set(kinds[i - 1] === "intro-brief" ? i - 1 : i, { no, section: HSK_SECTIONS[k] });
    }
  });
  return { kinds, headAt, count: no, segs: new Map() };
}

/** Tên bài trong sách có dạng "Bài khoá 1 · 课文1": phần tiếng Việt, rồi phần chữ Hán. */
export function splitLessonTitle(title: string): { vi: string; han: string } {
  const i = title.indexOf(" · ");
  if (i < 0) return { vi: title.trim(), han: "" };
  const a = title.slice(0, i).trim();
  const b = title.slice(i + 3).trim();
  const HAN = /[㐀-鿿]/;
  return HAN.test(a) && !HAN.test(b) ? { vi: b, han: a } : { vi: a, han: b };
}

/** Phụ đề trong ngoặc kép của tên bài ("课文1「看房那天」" → "「看房那天」"), rỗng nếu không có. */
export function lessonSubtitle(han: string): string {
  return /\s*([「『“"][^」』”"]*[」』”"])\s*$/.exec(han)?.[1] ?? "";
}

/** Con dấu: chữ Hán của tên bài, số (nếu có) xuống dòng dưới ("课文" / "1"). */
export function sealParts(han: string): { top: string; bottom: string } {
  // Tên bài có phụ đề trong ngoặc kép kiểu 「…」 ("课文1「看房那天」"): con dấu chỉ lấy phần nhãn bài ("课文" / "1").
  const label = han.replace(/\s*[「『“"][^」』”"]*[」』”"]\s*$/, "").trim() || han.trim();
  const m = /^([^\d]*?)\s*(\d+)?$/.exec(label);
  return { top: (m?.[1] ?? label).trim(), bottom: m?.[2] ?? "" };
}

/** Chữ Hán mờ ở nền đầu bài: chữ Hán đầu tiên của tên bài (课文1 → 课, 热身 → 热, 综合练习 → 综). */
export function watermarkChar(han: string): string {
  return /[㐀-鿿]/.exec(han)?.[0] ?? "";
}

/** Tách một đoạn chữ thường thành các đoạn chữ Hán và không phải chữ Hán, để tô màu riêng chữ Hán. */
export function splitHanRuns(text: string): Array<{ text: string; han: boolean }> {
  const out: Array<{ text: string; han: boolean }> = [];
  for (const m of text.matchAll(/([㐀-鿿][㐀-鿿\s/／、，]*[㐀-鿿]|[㐀-鿿])|([^㐀-鿿]+)/g)) {
    out.push({ text: m[0], han: m[1] !== undefined });
  }
  return out;
}

/** Dải tiêu đề tên bài của sách: <h2> nền gradient, chữ đầu là nhãn bài ("课文1", "热身", "综合练习"). Tên bài đã có ở đầu bài nên bỏ. */
const BANNER_H2 = /<h2\b[^>]*>(?:(?!<\/h2>)[\s\S])*?linear-gradient(?:(?!<\/h2>)[\s\S])*?<\/h2>/gi;
const BANNER_LABEL = /^\s*(?:课文|热身|综合练习|课堂活动)/;
const PAGE_REF = /<p\b[^>]*text-align:\s*right[^>]*>\s*Student[’']s Book\s*·\s*page\s*[\d–-]+\s*<\/p>/gi;

/** Khối tiêu đề của sách: bỏ dải tiêu đề cam (đầu bài đã hiện tên bài) và dòng "Student's Book · page N". Phần còn lại (câu dẫn, yêu cầu) giữ nguyên. */
export function hskIntroHtml(html: string): string {
  return html
    .replace(BANNER_H2, (m) => (BANNER_LABEL.test(m.replace(/<[^>]+>/g, "")) ? "" : m))
    .replace(PAGE_REF, "");
}

/** Các khối khác: chỉ bỏ dòng "Student's Book · page N" (thông tin trang sách, không cần ở giao diện này). */
export function hskDropPageRef(html: string): string {
  return html.replace(PAGE_REF, "");
}


/**
 * Khoá nào dùng giao diện bài học HSK: danh sách slug khoá trong cài đặt hệ thống (`SiteSetting`), không có thì không khoá nào dùng.
 * Chọn theo slug (giống nhau giữa dev và prod) thay vì mã khoá. Giá trị là mảng JSON hoặc các slug cách nhau bằng dấu phẩy/khoảng trắng/xuống dòng.
 */
export const HSK_DECOR_SLUGS_KEY = "lesson_decor.hsk_slugs";

function hskEntries(raw: string | null | undefined): string[] {
  const v = (raw ?? "").trim();
  if (!v) return [];
  if (v.startsWith("[")) {
    try {
      const a: unknown = JSON.parse(v);
      return Array.isArray(a) ? a.filter((x): x is string => typeof x === "string").map((x) => x.trim()).filter(Boolean) : [];
    } catch {
      return [];
    }
  }
  return v.split(/[\s,;]+/).map((x) => x.trim()).filter(Boolean);
}

/** Danh sách slug (bỏ phần ngôn ngữ ":en" / ":vi" nếu có). */
export function parseHskDecorSlugs(raw: string | null | undefined): string[] {
  return hskEntries(raw).map((e) => e.split(":")[0]!);
}

export function isHskDecorCourse(slug: string, raw: string | null | undefined): boolean {
  return parseHskDecorSlugs(raw).includes(slug);
}

/**
 * Ngôn ngữ giảng giải của khoá (tiêu đề mục, nhãn…): mặc định "vi"; ghi "slug:en" trong cài đặt cho bản tiếng Anh.
 * Khoá chưa có trường ngôn ngữ giảng giải riêng nên đặt ở đây, cùng chỗ chọn khoá dùng giao diện HSK.
 */
export function hskDecorLang(slug: string, raw: string | null | undefined): "vi" | "en" {
  const e = hskEntries(raw).find((x) => x.split(":")[0] === slug);
  return e?.split(":")[1]?.toLowerCase() === "en" ? "en" : "vi";
}

/**
 * HTML nhập sẵn từ sách có màu cam của bộ sách viết cứng trong thuộc tính style (rgb(232,89,33)). Đổi sang màu chính của khoá (--brand) để giao diện chỉ có một bảng màu;
 * khoá đặt màu bộ sách thì --brand chính là màu đó nên không đổi gì.
 */
export function hskRecolor(html: string): string {
  return html
    .replace(/rgba\(\s*232\s*,\s*89\s*,\s*33\s*,\s*([\d.]+)\s*\)/gi, "rgb(var(--brand) / $1)")
    .replace(/rgb\(\s*232\s*,\s*89\s*,\s*33\s*\)/gi, "rgb(var(--brand))")
    // Đỏ mận của dải mục tiêu bài (rgb(120,0,52)) → hồng đậm của giao diện, đi với xanh chính thành dải xanh–hồng như logo Limio.
    .replace(/rgb\(\s*120\s*,\s*0\s*,\s*52\s*\)/gi, "rgb(var(--hk-pink-deep))");
}

/** Nhãn "生词 TỪ MỚI" của khối từ mới (tên mục đã nằm ở tiêu đề mục 02). */
export function hskDropVocabLabel(html: string): string {
  return html.replace(/<div\b[^>]*>\s*生词\s*(?:TỪ MỚI|Từ mới|NEW WORDS)?\s*<\/div>/i, "");
}
