/**
 * SPACE (trang riêng + nhận diện thương hiệu của trường): quy ước slug dùng chung cho web (render) và core-lms (lưu,
 * kiểm tra quyền). Để ở shared-types vì hai bên đều cần mà core-lms không được import apps/web.
 */

/** Slug dùng ở URL /s/<slug>: chữ thường, số, gạch nối. */
const SPACE_SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Tên giữ chỗ để không đè route khác. */
const RESERVED_SPACE_SLUGS = new Set(["admin", "api", "new", "og", "s", "catalog", "learn", "me", "signin", "register"]);

/** Space dựng sẵn trong code (không nằm trong DB): chỉ Platform Admin được dùng slug này cho space trong DB. */
export const BUILTIN_SPACE_SLUGS: readonly string[] = ["micro4asia"];

export function isValidSpaceSlug(v: unknown): v is string {
  return typeof v === "string" && v.length >= 2 && v.length <= 40 && SPACE_SLUG_RE.test(v) && !RESERVED_SPACE_SLUGS.has(v);
}

export function isBuiltinSpaceSlug(v: string): boolean {
  return BUILTIN_SPACE_SLUGS.includes(v);
}
