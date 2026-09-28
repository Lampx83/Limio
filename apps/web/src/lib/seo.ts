/**
 * SEO helpers — một nơi duy nhất biết "URL công khai của trang này là gì" và
 * dựng metadata/JSON-LD từ đó.
 *
 * Vì sao cần lớp này thay vì để Next tự lo:
 *  - App có thể chạy dưới một tiền tố (`basePath`, ví dụ `/limio`). Next KHÔNG
 *    tự chèn basePath vào `metadataBase`, canonical hay sitemap — tự ghép tay
 *    sẽ ra link 404 cho Googlebot mà dev không bao giờ thấy (dev basePath = "").
 *    Xem `lib/apiUrl.ts` cho cùng vấn đề ở phía client.
 *  - Origin production đọc từ `NEXTAUTH_URL` (đã có sẵn, không thêm biến mới);
 *    `SITE_URL` để override khi domain public khác domain callback của auth.
 *    Cố tình KHÔNG dùng tiền tố `NEXT_PUBLIC_`: Next inline biến đó lúc build,
 *    nên đặt trong `.env.prod` (runtime) sẽ không có tác dụng. File này chỉ chạy
 *    phía server nên biến thường là đúng loại.
 */

import type { Metadata } from "next";

export const SITE_NAME = "Limio";
export const SITE_TAGLINE = "Learn in Flow";
export const SITE_LOCALE = "vi_VN";

export const SITE_DESCRIPTION =
  "Limio là LMS thế hệ mới: skill graph, BKT learner model, AI tutor và " +
  "gamification. Học theo cách của bạn — fresh, focused, your own pace.";

const RAW_SITE_URL = (
  process.env.SITE_URL ||
  process.env.NEXTAUTH_URL ||
  "http://localhost:3000"
).replace(/\/+$/, "");

const BASE_PATH = (process.env.NEXT_PUBLIC_BASE_PATH || "").replace(/\/+$/, "");

/**
 * Origin + basePath, không có dấu `/` cuối.
 *
 * `NEXTAUTH_URL` đôi khi đã bao gồm basePath (`https://limio.vn/limio`), đôi khi
 * không (`https://limio.vn` + basePath `/limio`). Chỉ nối thêm khi chưa có, nếu
 * không sẽ ra `https://limio.vn/limio/limio`.
 */
export const SITE_URL = BASE_PATH && !RAW_SITE_URL.endsWith(BASE_PATH)
  ? `${RAW_SITE_URL}${BASE_PATH}`
  : RAW_SITE_URL;

/**
 * Ảnh chia sẻ mặc định (1200×630) — dùng khi trang không có ảnh riêng.
 *
 * Không có ảnh này thì link Limio dán vào Facebook/Zalo/Messenger ra một thẻ
 * trắng trơn, tỉ lệ click thấp hẳn. Ảnh tĩnh (không sinh động bằng `next/og`)
 * vì font mặc định của `ImageResponse` chỉ có Latin — tiếng Việt có dấu sẽ ra
 * ô vuông.
 */
export const DEFAULT_OG_IMAGE = "/og-default.png";

/** Đường dẫn nội bộ (`/catalog/abc`) → URL tuyệt đối để crawler dùng được. */
export function absoluteUrl(path = "/"): string {
  if (/^https?:\/\//i.test(path)) return path;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * Cắt mô tả về độ dài Google thực sự hiển thị (~160 ký tự), cắt ở ranh giới từ
 * để không đứt giữa chữ.
 */
export function truncateForMeta(text: string, max = 160): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/**
 * Metadata cho mọi trang riêng tư (dashboard, admin, phòng thi…).
 *
 * Những trang này đằng nào cũng redirect về `/signin` với khách vãng lai, nên
 * nếu để Google index thì kết quả tìm kiếm chỉ toàn trang đăng nhập trùng lặp —
 * vừa loãng thứ hạng, vừa tốn crawl budget cho nội dung công khai thật sự.
 * `middleware.ts` cũng gắn `X-Robots-Tag` cho cùng nhóm route này; hai lớp bổ
 * sung cho nhau vì header phủ được cả route API và file tải về.
 */
export const NOINDEX: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

type PageMetaInput = {
  title: string;
  description: string;
  /** Đường dẫn nội bộ, ví dụ `/catalog/prisma-101`. */
  path: string;
  /** URL ảnh OG riêng của trang; bỏ trống thì dùng ảnh mặc định của route. */
  image?: string | null;
  type?: "website" | "article";
  noIndex?: boolean;
  publishedTime?: Date | string | null;
  modifiedTime?: Date | string | null;
};

/** Dựng metadata đầy đủ (canonical + OG + Twitter) cho một trang công khai. */
export function pageMetadata({
  title,
  description,
  path,
  image,
  type = "website",
  noIndex = false,
  publishedTime,
  modifiedTime,
}: PageMetaInput): Metadata {
  const url = absoluteUrl(path);
  const desc = truncateForMeta(description);
  const images = [{ url: absoluteUrl(image || DEFAULT_OG_IMAGE), alt: title }];

  return {
    title,
    description: desc,
    // Canonical luôn tự trỏ về chính mình, kể cả trang noindex. Bỏ trống KHÔNG
    // có nghĩa là "không có canonical": metadata của Next kế thừa theo segment,
    // nên trang sẽ nhặt canonical của layout cha — `/catalog?q=python` từng khai
    // canonical là trang chủ.
    alternates: { canonical: url },
    // `noindex, follow`, không phải `nofollow`: bản catalog đã lọc hay bài học
    // sau tường đăng nhập không nên tự lên kết quả tìm kiếm, nhưng link bên
    // trong chúng vẫn là đường crawler tìm ra từng khoá học. Khu vực thật sự
    // riêng tư dùng `NOINDEX` (nofollow) ở layout.
    // Khai tường minh kể cả khi cho index — cùng lý do kế thừa ở trên.
    robots: {
      index: !noIndex,
      follow: true,
      googleBot: {
        index: !noIndex,
        follow: true,
        "max-image-preview": "large",
        "max-snippet": -1,
      },
    },
    openGraph: {
      type,
      url,
      title,
      description: desc,
      siteName: SITE_NAME,
      locale: SITE_LOCALE,
      images,
      ...(type === "article" && publishedTime
        ? { publishedTime: new Date(publishedTime).toISOString() }
        : {}),
      ...(type === "article" && modifiedTime
        ? { modifiedTime: new Date(modifiedTime).toISOString() }
        : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: images.map((i) => i.url),
    },
  };
}

/* ------------------------------------------------------------------ *
 * JSON-LD builders
 *
 * Schema.org giúp Google hiểu trang là *khoá học* chứ không phải bài blog —
 * điều kiện để hiện rich result (giá, cấp độ, nhà cung cấp) trên SERP.
 * ------------------------------------------------------------------ */

export function organizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "EducationalOrganization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl("/favicon.svg"),
    description: SITE_DESCRIPTION,
  };
}

export function webSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: `${SITE_NAME} — ${SITE_TAGLINE}`,
    url: SITE_URL,
    inLanguage: "vi-VN",
    publisher: { "@id": `${SITE_URL}/#organization` },
    // Cho phép Google hiện ô "sitelinks search box" trỏ thẳng vào catalog.
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${SITE_URL}/catalog?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

const SCHEMA_LEVEL: Record<string, string> = {
  beginner: "Beginner",
  intermediate: "Intermediate",
  advanced: "Advanced",
};

export function courseJsonLd(course: {
  slug: string;
  title: string;
  description: string;
  language?: string | null;
  level?: string | null;
  category?: string | null;
  coverUrl?: string | null;
  priceCents?: number | null;
  currency?: string | null;
  publishedAt?: Date | string | null;
  /** Khi admin tắt thanh toán toàn hệ thống, mọi khoá được khai là miễn phí. */
  paymentEnabled?: boolean;
  instructors?: string[];
}) {
  const url = absoluteUrl(`/catalog/${course.slug}`);
  const isPaid = course.paymentEnabled === true && (course.priceCents ?? 0) > 0;

  return {
    "@context": "https://schema.org",
    "@type": "Course",
    "@id": `${url}#course`,
    name: course.title,
    description: truncateForMeta(course.description, 500),
    url,
    inLanguage: course.language === "en" ? "en" : "vi-VN",
    ...(course.coverUrl ? { image: absoluteUrl(course.coverUrl) } : {}),
    ...(course.category ? { about: course.category } : {}),
    ...(course.level && SCHEMA_LEVEL[course.level]
      ? { educationalLevel: SCHEMA_LEVEL[course.level] }
      : {}),
    ...(course.publishedAt
      ? { datePublished: new Date(course.publishedAt).toISOString() }
      : {}),
    provider: {
      "@type": "EducationalOrganization",
      name: SITE_NAME,
      url: SITE_URL,
    },
    ...(course.instructors?.length
      ? { instructor: course.instructors.map((name) => ({ "@type": "Person", name })) }
      : {}),
    offers: {
      "@type": "Offer",
      category: isPaid ? "Paid" : "Free",
      price: isPaid ? (course.priceCents! / 100).toFixed(2) : "0",
      priceCurrency: isPaid ? (course.currency ?? "USD") : "VND",
      availability: "https://schema.org/InStock",
      url,
    },
    // Google yêu cầu `hasCourseInstance` cho rich result của Course. Khoá học
    // online tự học, vào lúc nào cũng được → mode Online, không có lịch cố định.
    hasCourseInstance: {
      "@type": "CourseInstance",
      courseMode: "Online",
      courseWorkload: "PT1H",
    },
  };
}
