import { unstable_cache } from "next/cache";
import { prisma } from "@feedbackme/db";
import { builtinMicro4Asia, builtinMicro4AsiaEnabled, MICRO4ASIA_SLUG } from "./builtin";
import { buildSpaceConfig, dropForeignCourses, isValidSpaceSlug, normalizeStored } from "./settings";
import type { SpaceBrand, SpaceConfig, SpaceLang } from "./types";

async function loadSpaces(): Promise<SpaceConfig[]> {
  let out: SpaceConfig[] = [];
  try {
    const orgs = await prisma.organization.findMany({
      where: { spaceEnabled: true, spaceSlug: { not: null } },
      select: { id: true, spaceSlug: true, name: true, brandingLogoUrl: true, space: true },
    });
    const built = orgs
      .filter((o) => isValidSpaceSlug(o.spaceSlug))
      .map((o) => ({
        orgId: o.id,
        cfg: buildSpaceConfig({
          slug: o.spaceSlug!,
          orgName: o.name,
          orgLogoUrl: o.brandingLogoUrl,
          stored: normalizeStored(o.space),
        }),
      }));
    // Mỗi space chỉ được "nhận" khoá thuộc trường của nó (hoặc khoá chưa có chủ / chưa tồn tại).
    const slugs = Array.from(new Set(built.flatMap((b) => b.cfg.courses.map((c) => c.slug))));
    const owners = new Map<string, string | null>(
      slugs.length
        ? (
            await prisma.course.findMany({ where: { slug: { in: slugs } }, select: { slug: true, organizationId: true } })
          ).map((c) => [c.slug, c.organizationId] as [string, string | null])
        : [],
    );
    out = built.map(({ orgId, cfg }) => ({ ...cfg, courses: dropForeignCourses(cfg.courses, owners, orgId) }));
  } catch {
    // DB chập chờn: vẫn phục vụ cấu hình dựng sẵn thay vì làm hỏng mọi trang.
  }
  if (builtinMicro4AsiaEnabled() && !out.some((s) => s.slug === MICRO4ASIA_SLUG)) out.push(builtinMicro4Asia());
  return out;
}

// Chạy ở mọi request vào /catalog, /learn, /s → cache ngắn; quản trị đổi space thì revalidateTag("spaces").
const listSpacesCached = unstable_cache(loadSpaces, ["spaces-v1"], { revalidate: 60, tags: ["spaces"] });

export async function listSpaces(): Promise<SpaceConfig[]> {
  return listSpacesCached();
}

export async function getSpaceBySlug(slug: string): Promise<SpaceConfig | null> {
  return (await listSpaces()).find((s) => s.slug === slug) ?? null;
}

/** Space chứa khoá có slug này (khoá đầu tiên khớp). */
export async function getSpaceForCourseSlug(courseSlug: string): Promise<SpaceConfig | null> {
  return (await listSpaces()).find((s) => s.courses.some((c) => c.slug === courseSlug)) ?? null;
}

/**
 * Space áp dụng cho một đường dẫn: trang chủ space (/s/<slug>, /micro4asia) hoặc trang của một khoá thuộc space
 * (/catalog/<slug>, /learn/<slug>/…). Đường dẫn khác ⇒ null, giao diện Limio nguyên bản.
 */
export async function getSpaceForPath(pathname: string): Promise<SpaceConfig | null> {
  const seg = pathname.split("/").filter(Boolean);
  if (seg.length === 0) return null;
  try {
    const first = seg[0]!;
    if (first === "s" && seg[1]) return await getSpaceBySlug(decodeURIComponent(seg[1]));
    if (first === MICRO4ASIA_SLUG) return await getSpaceBySlug(MICRO4ASIA_SLUG);
    if ((first === "catalog" || first === "learn") && seg[1]) {
      return await getSpaceForCourseSlug(decodeURIComponent(seg[1]));
    }
  } catch {
    // slug hỏng (decodeURIComponent) hoặc DB lỗi: coi như ngoài space.
  }
  return null;
}

/** Đường dẫn trang chủ của space. Space dựng sẵn giữ URL ngắn /micro4asia. */
export function spaceHomePath(cfg: Pick<SpaceConfig, "slug">, lang?: SpaceLang, defaultLang: SpaceLang = "en"): string {
  const base = cfg.slug === MICRO4ASIA_SLUG ? "/micro4asia" : `/s/${cfg.slug}`;
  return lang && lang !== defaultLang ? `${base}?lang=${lang}` : base;
}

export function toBrand(cfg: SpaceConfig): SpaceBrand {
  return {
    slug: cfg.slug,
    name: cfg.name,
    logoUrl: cfg.logoUrl,
    logoAlt: cfg.logoAlt,
    partnerLogoUrl: cfg.partnerLogoUrl,
    partnerLogoAlt: cfg.partnerLogoAlt,
    homeHref: spaceHomePath(cfg),
    poweredByLabel: cfg.copy[cfg.defaultLang].poweredBy,
    coursesLabel: cfg.copy[cfg.defaultLang].coursesTitle,
  };
}
