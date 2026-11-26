import { prisma } from "@feedbackme/db";
import { listSpaces, spaceHomePath } from "./resolve";
import { getHskBooksByLevel, type HskBook } from "./hskBundles";
import { getSiteSetting } from "@/lib/site-settings";
import { CATALOG_SPACES_KEY, applyCatalogSpaceSelection, parseCatalogSpacesSetting } from "./catalogSpaceConfig";

/** Một khoá để xem trước trong thẻ space ở /catalog. */
export interface SpacePreviewCourse {
  slug: string;
  title: string;
  coverUrl: string;
  /** Giá bán lẻ hiện hành (gói rẻ nhất hoặc giá phẳng); 0 = miễn phí. */
  priceCents: number;
  originalPriceCents: number | null;
  currency: string;
}

export interface CatalogSpaceCard {
  slug: string;
  name: string;
  href: string;
  logoUrl: string | null;
  /** Space dùng nhận diện Limio (lát chanh): không có logo riêng. */
  limioBrand: boolean;
  /** Số khoá của space đang xuất bản (đang mở). */
  openCount: number;
  /** Vài khoá tiêu biểu (có ảnh bìa) để xem trước, tối đa `MAX_SPACE_PREVIEWS`. */
  previews: SpacePreviewCourse[];
}

export const MAX_SPACE_PREVIEWS = 5;

export interface PreviewCourseRow {
  slug: string;
  title: string;
  coverUrl: string | null;
  priceCents: number | null;
  originalPriceCents: number | null;
  currency: string;
  /** Giá gói đang bán rẻ nhất, nếu có. */
  planPriceCents: number | null;
  planCurrency: string | null;
}

/**
 * Chọn khoá xem trước cho một space (hàm thuần, có test): đi theo thứ tự khoá của space; space kiểu Limio mà cấp có quyển (hsk-N-quyen-k) thì
 * thay cấp đó bằng các quyển của nó (là thứ đang bán, có bìa sách); chỉ lấy khoá đã xuất bản VÀ có ảnh bìa (thẻ không bìa trông trống); tối đa 5.
 */
export function pickSpacePreviews(
  spaceCourseSlugs: string[],
  limioBrand: boolean,
  rows: ReadonlyMap<string, PreviewCourseRow>,
  booksByLevel: ReadonlyMap<number, HskBook[]>,
  max = MAX_SPACE_PREVIEWS,
): SpacePreviewCourse[] {
  const out: SpacePreviewCourse[] = [];
  spaceCourseSlugs.forEach((slug, i) => {
    const books = limioBrand ? booksByLevel.get(i + 1) : undefined;
    if (books && books.length > 0) {
      for (const b of books) {
        if (b.coverUrl) out.push({ slug: b.slug, title: b.title, coverUrl: b.coverUrl, priceCents: b.priceCents, originalPriceCents: b.originalPriceCents, currency: b.currency });
      }
      return;
    }
    const r = rows.get(slug);
    if (!r || !r.coverUrl) return;
    out.push({
      slug: r.slug,
      title: r.title,
      coverUrl: r.coverUrl,
      priceCents: r.planPriceCents ?? r.priceCents ?? 0,
      originalPriceCents: r.originalPriceCents,
      currency: r.planCurrency ?? r.currency,
    });
  });
  return out.slice(0, max);
}

/**
 * Mọi space đang bật, để /catalog dẫn sang trang chủ của từng space và xem trước vài khoá. Space nào được bật (Organization.spaceEnabled, hoặc
 * space dựng sẵn) thì tự có mặt, không cấu hình thêm. Lỗi DB coi như chưa có space (danh mục không được hỏng vì mục phụ).
 */
export async function getCatalogSpaces(): Promise<CatalogSpaceCard[]> {
  try {
    const [allSpaces, rawSelection] = await Promise.all([listSpaces(), getSiteSetting(CATALOG_SPACES_KEY).catch(() => null)]);
    // Admin chọn tay space nào hiện (và thứ tự); chưa chọn thì hiện mọi space đang bật.
    const selection = parseCatalogSpacesSetting(rawSelection);
    const spaces = selection === null ? allSpaces : applyCatalogSpaceSelection(allSpaces, selection);
    if (spaces.length === 0) return [];
    const slugs = Array.from(new Set(spaces.flatMap((s) => s.courses.map((c) => c.slug))));
    const dbRows = slugs.length
      ? await prisma.course.findMany({
          where: { slug: { in: slugs }, status: "published" },
          select: {
            slug: true,
            title: true,
            coverUrl: true,
            priceCents: true,
            originalPriceCents: true,
            currency: true,
            accessPlans: { where: { isActive: true }, orderBy: { priceCents: "asc" }, take: 1, select: { priceCents: true, currency: true } },
          },
        })
      : [];
    const rows = new Map<string, PreviewCourseRow>(
      dbRows.map((r) => [
        r.slug,
        {
          slug: r.slug,
          title: r.title,
          coverUrl: r.coverUrl,
          priceCents: r.priceCents,
          originalPriceCents: r.originalPriceCents,
          currency: r.currency,
          planPriceCents: r.accessPlans[0]?.priceCents ?? null,
          planCurrency: r.accessPlans[0]?.currency ?? null,
        },
      ]),
    );
    const booksByLevel = spaces.some((s) => s.limioBrand) ? await getHskBooksByLevel() : new Map<number, HskBook[]>();
    return spaces
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        href: spaceHomePath(s),
        logoUrl: s.logoUrl,
        limioBrand: s.limioBrand === true,
        openCount: s.courses.filter((c) => rows.has(c.slug)).length,
        previews: pickSpacePreviews(
          s.courses.map((c) => c.slug),
          s.limioBrand === true,
          rows,
          booksByLevel,
        ),
      }))
      // Tự động: xếp theo tên. Chọn tay: giữ đúng thứ tự admin đã đặt.
      .sort((a, b) => (selection === null ? a.name.localeCompare(b.name, "vi") : 0));
  } catch {
    return [];
  }
}

/** Mọi space đang bật (cho trang admin chọn space hiện ở /catalog). */
export async function listCatalogSpaceChoices(): Promise<Array<{ slug: string; name: string }>> {
  try {
    return (await listSpaces()).map((s) => ({ slug: s.slug, name: s.name })).sort((a, b) => a.name.localeCompare(b.name, "vi"));
  } catch {
    return [];
  }
}
