/**
 * Cấu hình "space nào hiện ở /catalog" (Admin → Section catalog). Lưu ở SiteSetting `catalog.spaces`:
 *  - vắng / rỗng / hỏng  → TỰ ĐỘNG: hiện mọi space đang bật, xếp theo tên;
 *  - JSON mảng slug      → CHỌN TAY: đúng các space đó theo thứ tự đó (mảng rỗng = ẩn cả mục "Không gian học liệu").
 * Hàm thuần ở đây để test; đọc/ghi DB nằm ở catalogSpaces.ts và API admin.
 */
export const CATALOG_SPACES_KEY = "catalog.spaces";
export const MAX_CATALOG_SPACES = 24;
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** null = tự động; mảng = chọn tay (có thể rỗng). Dữ liệu hỏng coi như tự động để trang không bao giờ vỡ. */
export function parseCatalogSpacesSetting(raw: string | null | undefined): string[] | null {
  if (!raw || !raw.trim()) return null;
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return null;
    return normalizeSlugs(v);
  } catch {
    return null;
  }
}

/** Làm sạch danh sách slug: chuỗi hợp lệ, bỏ trùng, giữ thứ tự, tối đa `MAX_CATALOG_SPACES`. */
export function normalizeSlugs(list: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of list) {
    const s = typeof x === "string" ? x.trim() : "";
    if (!s || s.length > 80 || !SLUG_RE.test(s) || seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= MAX_CATALOG_SPACES) break;
  }
  return out;
}

/** Giá trị lưu: tự động → chuỗi rỗng; chọn tay → JSON mảng slug. */
export function serializeCatalogSpacesSetting(selection: string[] | null): string {
  return selection === null ? "" : JSON.stringify(normalizeSlugs(selection));
}

/** Áp lựa chọn lên danh sách space đang bật: tự động giữ nguyên; chọn tay thì theo đúng thứ tự đã chọn và bỏ slug không còn là space đang bật. */
export function applyCatalogSpaceSelection<T extends { slug: string }>(all: T[], selection: string[] | null): T[] {
  if (selection === null) return all;
  const bySlug = new Map(all.map((s) => [s.slug, s]));
  return selection.map((slug) => bySlug.get(slug)).filter((s): s is T => !!s);
}
