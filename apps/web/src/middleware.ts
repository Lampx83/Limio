import { NextResponse, type NextRequest } from "next/server";
import { applyAttributionCookie } from "@/lib/growth/edge";
import { languageHostRewrite } from "@/lib/languageHost";

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
  // Link xem bài giảng gửi tay (ai có link cũng xem), không phải trang cho công cụ tìm kiếm.
  "/bai-giang",
  // Khung slide tương tác nhúng vào bài học, không phải trang để index.
  "/decks",
];

/**
 * Đường dẫn bài học: `/learn/<slug>/lessons/<id>`. Đây là ngoại lệ duy nhất
 * trong khu `/learn` — nó *có thể* công khai, tuỳ cờ `publicAccess` của khoá.
 * Middleware chạy ở edge nên không hỏi được DB; nó chỉ nhường quyền quyết định,
 * còn `generateMetadata` của trang bài học mới chốt index hay không.
 */
const PUBLIC_LESSON_RE = /^\/learn\/[^/]+\/lessons\/[^/]+\/?$/;

/** Nhánh có thể thuộc một space: trang chủ space, catalog và khu học của khoá. */
const SPACE_PATH_RE = /^\/(?:s\/|micro4asia(?:\/|$)|catalog\/|learn\/)/;

const COURSE_SLUG_RE = /^\/(?:catalog|learn)\/([^/]+)/;

function isPrivate(pathname: string): boolean {
  if (PUBLIC_LESSON_RE.test(pathname)) return false;
  if (pathname === "/learn" || pathname.startsWith("/learn/")) return true;
  return PRIVATE_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`) || pathname.startsWith(`${p}?`),
  );
}

export function middleware(req: NextRequest) {
  // Tên miền riêng của Limio Language (LANGUAGE_HOST, tuỳ chọn): "/" được viết lại thành trang giới thiệu /language. Không còn
  // chế độ giao diện/cookie — xem docs/tieu-chi/limio-language-gop-menu.md (AC4).
  const rewriteTo = languageHostRewrite({
    host: req.headers.get("host"),
    languageHost: process.env.LANGUAGE_HOST,
    pathname: req.nextUrl.pathname,
  });
  // SPACE: layout gốc cần biết trang đang xem có thuộc space của trường nào không (để đổi màu/logo/chân trang).
  // Chỉ gắn header cho vài nhánh liên quan, để mọi trang khác không đổi gì.
  const reqHeaders = new Headers(req.headers);
  reqHeaders.delete("x-space-path"); // không tin giá trị do client gửi
  if (SPACE_PATH_RE.test(req.nextUrl.pathname)) reqHeaders.set("x-space-path", req.nextUrl.pathname);
  // I18N: slug khoá đang xem (để layout gốc chọn ngôn ngữ giao diện theo course.language).
  reqHeaders.delete("x-course-slug");
  const courseSlug = COURSE_SLUG_RE.exec(req.nextUrl.pathname)?.[1];
  if (courseSlug) {
    try {
      reqHeaders.set("x-course-slug", decodeURIComponent(courseSlug));
    } catch {
      /* slug hỏng mã hoá — bỏ qua, giao diện về mặc định */
    }
  }
  let res: NextResponse;
  if (rewriteTo) {
    const url = req.nextUrl.clone();
    url.pathname = rewriteTo;
    res = NextResponse.rewrite(url, { request: { headers: reqHeaders } });
  } else {
    res = NextResponse.next({ request: { headers: reqHeaders } });
  }
  // `pathname` đã bỏ basePath, nên danh sách trên viết theo đường dẫn app —
  // giống mọi nơi khác trong codebase (xem `lib/apiUrl.ts`).
  if (isPrivate(req.nextUrl.pathname)) {
    res.headers.set("X-Robots-Tag", "noindex, nofollow");
  }
  // Growth attribution (first-touch cookie). Tắt mặc định: không có
  // GROWTH_ATTRIBUTION_ENABLED=true thì nhánh này không làm gì cả. Xem
  // lib/growth/attribution.ts và docs/growth-events.md.
  if ((process.env.GROWTH_ATTRIBUTION_ENABLED ?? "").trim().toLowerCase() === "true") {
    applyAttributionCookie(req, res);
  }
  return res;
}

export const config = {
  // Bỏ qua asset tĩnh: chúng không bao giờ vào index dạng trang, chạy middleware
  // trên đó chỉ tốn invocation.
  matcher: ["/((?!_next/static|_next/image|favicon.svg|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|woff2?)$).*)"],
};
