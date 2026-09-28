import { unstable_cache } from "next/cache";
import type { MetadataRoute } from "next";
import { prisma } from "@feedbackme/db";
import { absoluteUrl } from "@/lib/seo";

/**
 * `/sitemap.xml`
 *
 * Chỉ liệt kê URL mà khách chưa đăng nhập mở được và trả về 200:
 *  - landing + catalog
 *  - `/catalog/[slug]` của mọi khoá đã publish (trang giới thiệu luôn công khai)
 *  - `/learn/[slug]/lessons/[id]` chỉ của khoá `publicAccess` — khoá khác sẽ
 *    redirect về signin, đưa vào sitemap là tự khai báo link hỏng với Google.
 *
 * Sinh động từ DB nên khoá mới publish có mặt ngay, không cần deploy lại.
 */

// `force-dynamic` + `unstable_cache` thay vì `export const revalidate`: route
// này nằm ngoài cây layout nên không thừa hưởng `force-dynamic` của root, và
// Next sẽ cố prerender nó lúc build — đập vào Postgres trong lúc build image,
// đúng cái mà root layout đang tránh. Cache 1 giờ để crawler ghé liên tục cũng
// chỉ tốn một lượt query.
export const dynamic = "force-dynamic";

// Google bỏ qua sitemap > 50.000 URL. Khoá học thì không bao giờ tới ngưỡng đó,
// nhưng bài học của một trường lớn thì có — cắt ở đây để file luôn hợp lệ.
const MAX_LESSON_URLS = 20_000;

const getSitemapRows = unstable_cache(
  async () => {
    const [courses, publicLessons] = await Promise.all([
      prisma.course.findMany({
        where: { status: "published" },
        select: { slug: true, updatedAt: true, publishedAt: true, publicAccess: true },
        orderBy: { publishedAt: "desc" },
      }),
      prisma.lesson.findMany({
        where: {
          isHidden: false,
          module: { course: { status: "published", publicAccess: true } },
        },
        select: {
          id: true,
          updatedAt: true,
          module: { select: { course: { select: { slug: true } } } },
        },
        orderBy: { updatedAt: "desc" },
        take: MAX_LESSON_URLS,
      }),
    ]);
    return { courses, publicLessons };
  },
  ["sitemap-public-urls"],
  { revalidate: 3600, tags: ["sitemap"] },
);

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();

  const staticRoutes: MetadataRoute.Sitemap = [
    { url: absoluteUrl("/"), lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: absoluteUrl("/catalog"), lastModified: now, changeFrequency: "daily", priority: 0.9 },
  ];

  let courses: Awaited<ReturnType<typeof getSitemapRows>>["courses"] = [];
  let publicLessons: Awaited<ReturnType<typeof getSitemapRows>>["publicLessons"] = [];
  try {
    ({ courses, publicLessons } = await getSitemapRows());
  } catch (err) {
    // DB chập chờn thì trả sitemap tối thiểu còn hơn 500: Search Console đánh
    // dấu sitemap lỗi và ngừng đọc, mất luôn cả những URL vẫn còn tốt.
    console.error("[sitemap] không đọc được URL từ DB:", err);
  }

  const courseRoutes: MetadataRoute.Sitemap = courses.map((c) => ({
    url: absoluteUrl(`/catalog/${c.slug}`),
    lastModified: c.updatedAt ?? c.publishedAt ?? now,
    changeFrequency: "weekly",
    // Khoá mở công khai đọc được toàn bộ nội dung → giá trị SEO cao hơn hẳn
    // khoá chỉ có trang giới thiệu.
    priority: c.publicAccess ? 0.8 : 0.7,
  }));

  const lessonRoutes: MetadataRoute.Sitemap = publicLessons.map((l) => ({
    url: absoluteUrl(`/learn/${l.module.course.slug}/lessons/${l.id}`),
    lastModified: l.updatedAt ?? now,
    changeFrequency: "monthly",
    priority: 0.6,
  }));

  return [...staticRoutes, ...courseRoutes, ...lessonRoutes];
}
