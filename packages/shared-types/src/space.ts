/**
 * SPACE (trang riêng + nhận diện thương hiệu của trường): quy ước slug dùng chung cho web (render) và core-lms (lưu,
 * kiểm tra quyền). Để ở shared-types vì hai bên đều cần mà core-lms không được import apps/web.
 */

/** Slug dùng ở URL /s/<slug>: chữ thường, số, gạch nối. */
const SPACE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Tên giữ chỗ để không đè route khác. */
const RESERVED_SPACE_SLUGS = new Set(["admin", "api", "new", "og", "s", "catalog", "learn", "me", "signin", "register"]);

/**
 * Slug dành riêng cho Platform Admin: space dựng sẵn trong code (micro4asia) và mọi space có URL ngắn riêng ở gốc site
 * (`SPACE_HOME_ALIAS` trong apps/web: /micro4asia, /hsk), vì trang ngắn đó đọc space theo slug từ DB nên ai giữ slug là giữ trang.
 * Thêm URL ngắn mới ⇒ thêm slug vào đây (test ở apps/web/src/lib/space/__tests__/space.test.ts bắt quên).
 */
export const BUILTIN_SPACE_SLUGS: readonly string[] = ["micro4asia", "hsk"];

export function isValidSpaceSlug(v: unknown): v is string {
  return typeof v === "string" && v.length >= 2 && v.length <= 40 && SPACE_SLUG_RE.test(v) && !RESERVED_SPACE_SLUGS.has(v);
}

export function isBuiltinSpaceSlug(v: string): boolean {
  return BUILTIN_SPACE_SLUGS.includes(v);
}
