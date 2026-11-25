import { prisma } from "@feedbackme/db";
import { getBundleBySlug, type BundleView } from "@feedbackme/core-lms";
import type { SpaceConfig } from "./types";

/** Slug khoá HSK: `hsk-4-goc`, `hsk-4-quyen-1`, ... (mọi khoá bắt đầu bằng `hsk-<cấp>-`). */
const HSK_COURSE_SLUG = /^hsk-\d+-/;

/** Combo hiện ở trang /hsk khi MỌI khoá trong combo đều là khoá HSK. Hàm thuần, có test. */
export function isHskBundle(courseSlugs: string[]): boolean {
  return courseSlugs.length > 0 && courseSlugs.every((s) => HSK_COURSE_SLUG.test(s));
}

/**
 * Các combo đã xuất bản mà trang /hsk phải giới thiệu. Không cấu hình tay: xuất bản thêm combo HSK (vd cấp 5) là trang tự hiện.
 * Trang giới thiệu không được hỏng chỉ vì DB chập chờn: lỗi coi như chưa có combo.
 */
async function getHskBundles(): Promise<BundleView[]> {
  try {
    const rows = await prisma.courseBundle.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "asc" },
      select: { slug: true, items: { select: { course: { select: { slug: true } } } } },
    });
    const slugs = rows.filter((r) => isHskBundle(r.items.map((i) => i.course.slug))).map((r) => r.slug);
    const views = await Promise.all(slugs.map((s) => getBundleBySlug(s)));
    return views.filter((v): v is BundleView => v !== null && v.purchasable);
  } catch {
    return [];
  }
}

export function bundleDurationText(months: number | null, lang: "vi" | "en"): string {
  if (lang === "en") {
    if (months === null) return "Lifetime access";
    return months % 12 === 0 ? `${months / 12}-year access` : `${months}-month access`;
  }
  if (months === null) return "Truy cập vĩnh viễn";
  return months % 12 === 0 ? `Truy cập ${months / 12} năm` : `Truy cập ${months} tháng`;
}

/**
 * Combo hiển thị ở trang chủ một space. Chọn tay (`cfg.bundles`) thì hiện đúng các combo đó theo thứ tự, bỏ combo chưa xuất bản
 * hoặc còn khoá chưa xuất bản (không bán thứ không giao được). Chưa chọn tay: space kiểu Limio tự hiện combo toàn khoá HSK,
 * space khác không hiện. Lỗi DB coi như chưa có combo.
 */
export async function getSpaceBundles(cfg: Pick<SpaceConfig, "bundles" | "limioBrand">): Promise<BundleView[]> {
  if (cfg.bundles === undefined) return cfg.limioBrand ? getHskBundles() : [];
  try {
    const views = await Promise.all(cfg.bundles.map((s) => getBundleBySlug(s)));
    return views.filter((v): v is BundleView => v !== null && v.purchasable);
  } catch {
    return [];
  }
}

/** Slug quyển của một cấp: `hsk-4-quyen-2` → cấp 4, quyển 2. */
const HSK_BOOK_SLUG = /^hsk-(\d+)-quyen-(\d+)$/;

export function parseHskBookSlug(slug: string): { level: number; book: number } | null {
  const m = HSK_BOOK_SLUG.exec(slug);
  if (!m) return null;
  const level = Number(m[1]);
  const book = Number(m[2]);
  return level >= 1 && level <= 9 && book >= 1 ? { level, book } : null;
}

export interface HskBook {
  /** Số quyển trong cấp (1, 2, …). */
  book: number;
  slug: string;
  title: string;
  coverUrl: string | null;
  lessonCount: number;
  /** Giá bán lẻ hiện hành (gói rẻ nhất, hoặc giá phẳng); 0 = chưa có giá. */
  priceCents: number;
  originalPriceCents: number | null;
  currency: string;
}

/**
 * Các quyển (khoá `hsk-<cấp>-quyen-<n>` đã xuất bản) gom theo cấp, mỗi cấp xếp theo số quyển. Trang /hsk dùng để: khối cấp có
 * nhiều quyển thì bấm vào mở danh sách quyển. Lỗi DB coi như chưa có quyển nào.
 */
export async function getHskBooksByLevel(): Promise<Map<number, HskBook[]>> {
  try {
    const rows = await prisma.course.findMany({
      where: { status: "published", slug: { startsWith: "hsk-", contains: "-quyen-" } },
      select: {
        slug: true,
        title: true,
        coverUrl: true,
        priceCents: true,
        originalPriceCents: true,
        currency: true,
        accessPlans: { where: { isActive: true }, orderBy: { priceCents: "asc" }, take: 1, select: { priceCents: true, currency: true } },
        modules: { select: { _count: { select: { lessons: true } } } },
      },
    });
    const byLevel = new Map<number, HskBook[]>();
    for (const r of rows) {
      const parsed = parseHskBookSlug(r.slug);
      if (!parsed) continue;
      const plan = r.accessPlans[0];
      const list = byLevel.get(parsed.level) ?? [];
      list.push({
        book: parsed.book,
        slug: r.slug,
        title: r.title,
        coverUrl: r.coverUrl,
        lessonCount: r.modules.reduce((n, m) => n + m._count.lessons, 0),
        priceCents: plan ? plan.priceCents : (r.priceCents ?? 0),
        originalPriceCents: r.originalPriceCents,
        currency: plan ? plan.currency : r.currency,
      });
      byLevel.set(parsed.level, list);
    }
    const out = new Map<number, HskBook[]>();
    for (const [level, list] of byLevel) {
      out.set(level, list.sort((a, b) => a.book - b.book));
    }
    return out;
  } catch {
    return new Map();
  }
}
