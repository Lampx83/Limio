// Phần thuần của tích hợp Feedback Hub — an toàn để import từ component client (không đụng node:crypto).

/** Trang làm bài thi: ẩn nút nổi để thí sinh không bị xao nhãng hay mở khung nhập liệu giữa giờ thi. */
const EXAM_PREFIXES = ["/thi", "/exam-take", "/play", "/join"];
export const isExamPath = (pathname: string) =>
  EXAM_PREFIXES.some((p) => pathname === p || pathname.startsWith(`${p}/`));

/** Cookie vai trò đang dùng (khớp ACTIVE_ROLE_COOKIE ở lib/active-role.ts — file đó import next/headers nên client không dùng được). */
const ROLE_COOKIE = "fbm-active-role";

/**
 * Ngữ cảnh đính kèm mỗi góp ý để người đọc biết ngay "bài nào, khoá nào, ai đang dùng vai gì, màn hình cỡ nào"
 * mà không phải hỏi lại. `pathname` là đường dẫn đã bỏ basePath (usePathname / location trừ basePath).
 */
export function feedbackContext(pathname: string, role?: string | null, viewport?: string) {
  const extra: Record<string, string> = {};
  if (role) extra.role = role;
  if (viewport) extra.viewport = viewport;
  let contentRef: string | undefined;
  let m: RegExpMatchArray | null;
  if ((m = pathname.match(/^\/learn\/([^/]+)\/lessons\/([^/]+)/))) {
    extra.course = decodeURIComponent(m[1]!);
    contentRef = `lesson:${decodeURIComponent(m[2]!)}`;
  } else if ((m = pathname.match(/^\/learn\/([^/]+)\/threads\/([^/]+)/))) {
    extra.course = decodeURIComponent(m[1]!);
    contentRef = `thread:${decodeURIComponent(m[2]!)}`;
  } else if ((m = pathname.match(/^\/(?:learn|catalog)\/([^/]+)/))) {
    extra.course = decodeURIComponent(m[1]!);
    contentRef = `course:${extra.course}`;
  } else if ((m = pathname.match(/^\/instructor\/courses\/([^/]+)/))) {
    extra.area = "instructor";
    contentRef = `course:${decodeURIComponent(m[1]!)}`;
  }
  return { contentRef, extra };
}

export function readActiveRole(cookie: string): string | undefined {
  return cookie.split("; ").find((c) => c.startsWith(`${ROLE_COOKIE}=`))?.slice(ROLE_COOKIE.length + 1) || undefined;
}
