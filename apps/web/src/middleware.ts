import { NextResponse, type NextRequest } from "next/server";

/**
 * Gắn `X-Robots-Tag: noindex, nofollow` cho mọi route riêng tư.
 *
 * Vì sao cần cả cái này khi đã có robots.txt: `Disallow` chỉ nói "đừng crawl".
 * Nếu một URL bị chặn lại có backlink (ai đó dán link phòng thi vào diễn đàn),
 * Google vẫn có thể index nó — với snippet rỗng, vì nó không được phép đọc nội
 * dung. `X-Robots-Tag` là chỉ thị "đừng index" thật sự, và vì là HTTP header nên
 * nó phủ được cả response JSON của `/api/*` lẫn file tải về — những chỗ không
 * thể nhét thẻ `<meta name="robots">`.
 *
 * Middleware chạy trên edge runtime: không đụng Prisma, không đọc session —
 * thuần chuỗi đường dẫn, để không thêm độ trễ vào mọi request.
 */

const PRIVATE_PREFIXES = [
  "/api",
  "/admin",
  "/org-admin",
  "/instructor",
  "/me",
  "/proctor",
  "/giam-thi",
  "/thi",
  "/exam",
  "/exam-take",
  "/play",
  "/join",
  "/enroll",
  "/signin",
  "/register",
  "/reset",
  "/reset-request",
  "/verify",
  "/leaderboard",
  "/tournaments",
];

/**
 * Đường dẫn bài học: `/learn/<slug>/lessons/<id>`. Đây là ngoại lệ duy nhất
 * trong khu `/learn` — nó *có thể* công khai, tuỳ cờ `publicAccess` của khoá.
 * Middleware chạy ở edge nên không hỏi được DB; nó chỉ nhường quyền quyết định,
 * còn `generateMetadata` của trang bài học mới chốt index hay không.
 */
const PUBLIC_LESSON_RE = /^\/learn\/[^/]+\/lessons\/[^/]+\/?$/;

function isPrivate(pathname: string): boolean {
  if (PUBLIC_LESSON_RE.test(pathname)) return false;
  if (pathname === "/learn" || pathname.startsWith("/learn/")) return true;
  return PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`),
  );
}

export function middleware(req: NextRequest) {
  const res = NextResponse.next();
  // `pathname` đã bỏ basePath, nên danh sách trên viết theo đường dẫn app —
  // giống mọi nơi khác trong codebase (xem `lib/apiUrl.ts`).
  if (isPrivate(req.nextUrl.pathname)) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  return res;
}

export const config = {
  // Bỏ qua asset tĩnh: chúng không bao giờ vào index dạng trang, chạy middleware
  // trên đó chỉ tốn invocation.
  matcher: ["/((?!_next/static|_next/image|favicon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};
