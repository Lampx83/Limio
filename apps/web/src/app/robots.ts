import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/**
 * `/robots.txt`
 *
 * Nguyên tắc: chỉ mở những gì khách vãng lai thật sự xem được — landing,
 * catalog, trang chi tiết khoá học và bài học của khoá bật `publicAccess`.
 * Toàn bộ khu vực cần đăng nhập bị chặn vì với Googlebot chúng chỉ redirect về
 * `/signin`: hàng nghìn URL trùng nội dung, đốt sạch crawl budget đáng lẽ dành
 * cho khoá học.
 *
 * Ba lớp bổ sung cho nhau — mỗi lớp bịt điểm mù của lớp trước:
 *  1. robots.txt (file này) — "đừng crawl". Không đảm bảo "đừng index" nếu URL
 *     có backlink từ nơi khác.
 *  2. `middleware.ts` — gắn `X-Robots-Tag: noindex` cho cùng nhóm route, phủ
 *     được cả response API và file tải về (nơi không có thẻ <meta>).
 *  3. `generateMetadata` từng trang — quyết định dựa trên DB, thứ hai lớp trên
 *     không biết: một bài học chỉ được index khi khoá của nó `publicAccess`.
 */

const PRIVATE_PREFIXES = [
  "/api/",
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
  "/.well-known/",

  // Trong khu học tập chỉ nội dung bài học là công khai được (và chỉ khi khoá
  // bật publicAccess — `generateMetadata` của trang bài học tự chốt). Mọi thứ
  // tương tác thì luôn cần đăng nhập.
  "/learn/*/quizzes",
  "/learn/*/exams",
  "/learn/*/attempts",
  "/learn/*/certificate",
  "/learn/*/threads",
  "/learn/poll",
  "/learn/word-cloud",

  // Catalog đã lọc (`/catalog?q=…`) KHÔNG chặn ở đây: chặn crawl thì Google
  // không đọc được thẻ `noindex` mà `generateMetadata` của trang đó đặt, còn
  // link trong đó thì crawler vẫn cần đi tiếp để tìm ra từng khoá học.
];

export default function robots(): MetadataRoute.Robots {
  // Staging/preview không được lọt vào index — nếu không, bản staging sẽ cạnh
  // tranh từ khoá với chính production và Google có thể chọn nhầm bản để hiển thị.
  const isIndexable =
    process.env.NODE_ENV === "production" &&
    !/localhost|127\.0\.0\.1|\.vercel\.app|staging|preview/i.test(SITE_URL);

  if (!isIndexable) {
    return { rules: [{ userAgent: "*", disallow: "/" }] };
  }

  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: PRIVATE_PREFIXES,
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
