import { prisma } from "@feedbackme/db";
import { listSpaces, spaceHomePath } from "./resolve";

export interface CatalogSpaceCard {
  slug: string;
  name: string;
  href: string;
  logoUrl: string | null;
  /** Space dùng nhận diện Limio (lát chanh): không có logo riêng. */
  limioBrand: boolean;
  /** Số khoá của space đang xuất bản (đang mở). */
  openCount: number;
}

/**
 * Mọi space đang bật, để /catalog dẫn sang trang chủ của từng space. Space nào được bật (Organization.spaceEnabled, hoặc
 * space dựng sẵn) thì tự có mặt, không cấu hình thêm. Lỗi DB coi như chưa có space (danh mục không được hỏng vì mục phụ).
 */
export async function getCatalogSpaces(): Promise<CatalogSpaceCard[]> {
  try {
    const spaces = await listSpaces();
    if (spaces.length === 0) return [];
    const slugs = Array.from(new Set(spaces.flatMap((s) => s.courses.map((c) => c.slug))));
    const published = new Set(
      slugs.length
        ? (await prisma.course.findMany({ where: { slug: { in: slugs }, status: "published" }, select: { slug: true } })).map((c) => c.slug)
        : [],
    );
    return spaces
      .map((s) => ({
        slug: s.slug,
        name: s.name,
        href: spaceHomePath(s),
        logoUrl: s.logoUrl,
        limioBrand: s.limioBrand === true,
        openCount: s.courses.filter((c) => published.has(c.slug)).length,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "vi"));
  } catch {
    return [];
  }
}
