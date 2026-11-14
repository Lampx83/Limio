import { isValidSpaceSlug } from "@feedbackme/shared-types";
import { defaultSpaceCopy } from "./copy";
import { derivePalette, isHexColor } from "./theme";
import {
  SPACE_LANGS,
  type SpaceConfig,
  type SpaceCopy,
  type SpaceCourseEntry,
  type SpaceLang,
  type SpaceStat,
} from "./types";

/** Phần người quản trị lưu trong `Organization.space` — mọi trường đều tuỳ chọn, thiếu thì dùng mặc định. */
export interface SpaceStored {
  name?: string;
  titleSuffix?: string;
  primary?: string;
  accent?: string;
  /** Tuỳ chọn: ghi đè tông suy ra từ màu chủ đạo (dùng cho bộ màu thương hiệu chính xác như NEU). */
  dark?: string;
  soft?: string;
  accent2?: string;
  logoUrl?: string;
  logoAlt?: string;
  partnerLogoUrl?: string;
  partnerLogoAlt?: string;
  heroVisualUrl?: string;
  siteUrl?: string;
  siteLabel?: string;
  langs?: SpaceLang[];
  defaultLang?: SpaceLang;
  courses?: Array<{
    slug: string;
    title: string;
    iconUrl?: string;
    topic?: Partial<Record<SpaceLang, string>>;
    outcome?: Partial<Record<SpaceLang, string>>;
  }>;
  copy?: Partial<Record<SpaceLang, Partial<SpaceCopy>>>;
}

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/; // slug khoá học (khác slug space)

export { isValidSpaceSlug };

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  return t ? t.slice(0, max) : undefined;
}

/** URL ảnh/link: đường dẫn trong site hoặc https. Chặn `javascript:`/`data:` và `//host`. */
export function safeUrl(v: unknown): string | undefined {
  const s = str(v, 500);
  if (!s) return undefined;
  if (s.startsWith("/") && !s.startsWith("//")) return s;
  try {
    const u = new URL(s);
    return u.protocol === "https:" ? u.toString() : undefined;
  } catch {
    return undefined;
  }
}

function langRecord(v: unknown, max: number): Partial<Record<SpaceLang, string>> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const out: Partial<Record<SpaceLang, string>> = {};
  for (const l of SPACE_LANGS) {
    const s = str((v as Record<string, unknown>)[l], max);
    if (s) out[l] = s;
  }
  return Object.keys(out).length ? out : undefined;
}

const COPY_STRING_KEYS = [
  "metaTitle",
  "metaDescription",
  "eyebrow",
  "heroLead",
  "heroAccent",
  "intro",
  "browse",
  "aboutProject",
  "statsOpen",
  "coursesTitle",
  "coursesSub",
  "openNow",
  "comingSoon",
  "viewCourse",
  "youWillBeAbleTo",
  "principlesTitle",
  "stepsTitle",
  "register",
  "registerIntro",
  "footnote",
  "poweredBy",
] as const;

function normalizeCopy(v: unknown): Partial<SpaceCopy> | undefined {
  if (!v || typeof v !== "object") return undefined;
  const src = v as Record<string, unknown>;
  const out: Partial<SpaceCopy> = {};
  for (const k of COPY_STRING_KEYS) {
    const s = str(src[k], k === "intro" || k === "metaDescription" || k === "footnote" ? 600 : 200);
    if (s) (out as Record<string, string>)[k] = s;
  }
  if (Array.isArray(src.principles)) {
    const ps = src.principles
      .slice(0, 6)
      .map((p) => ({ word: str(p?.word, 30), t: str(p?.t, 120), d: str(p?.d, 300) }))
      .filter((p): p is { word: string; t: string; d: string } => !!p.word && !!p.t && !!p.d);
    if (ps.length) out.principles = ps;
  }
  if (Array.isArray(src.steps)) {
    const ss = src.steps
      .slice(0, 6)
      .map((s) => ({ t: str(s?.t, 120), d: str(s?.d, 300) }))
      .filter((s): s is { t: string; d: string } => !!s.t && !!s.d);
    if (ss.length) out.steps = ss;
  }
  return Object.keys(out).length ? out : undefined;
}

/** Làm sạch JSON đọc từ DB hoặc gửi từ form quản trị. Không bao giờ throw. */
export function normalizeStored(raw: unknown): SpaceStored {
  if (!raw || typeof raw !== "object") return {};
  const r = raw as Record<string, unknown>;
  const out: SpaceStored = {};
  const name = str(r.name, 60);
  if (name) out.name = name;
  const suffix = str(r.titleSuffix, 40);
  if (suffix) out.titleSuffix = suffix;
  if (isHexColor(r.primary)) out.primary = r.primary.toUpperCase();
  if (isHexColor(r.accent)) out.accent = r.accent.toUpperCase();
  for (const k of ["dark", "soft", "accent2"] as const) {
    const v = r[k];
    if (isHexColor(v)) out[k] = v.toUpperCase();
  }
  for (const k of ["logoUrl", "partnerLogoUrl", "heroVisualUrl", "siteUrl"] as const) {
    const u = safeUrl(r[k]);
    if (u) out[k] = u;
  }
  const la = str(r.logoAlt, 120);
  if (la) out.logoAlt = la;
  const pa = str(r.partnerLogoAlt, 120);
  if (pa) out.partnerLogoAlt = pa;
  const sl = str(r.siteLabel, 80);
  if (sl) out.siteLabel = sl;
  if (Array.isArray(r.langs)) {
    const langs = r.langs.filter((l): l is SpaceLang => l === "en" || l === "vi");
    if (langs.length) out.langs = Array.from(new Set(langs));
  }
  if (r.defaultLang === "en" || r.defaultLang === "vi") out.defaultLang = r.defaultLang;
  if (Array.isArray(r.courses)) {
    const seen = new Set<string>();
    const courses: NonNullable<SpaceStored["courses"]> = [];
    for (const c of r.courses.slice(0, 60)) {
      const slug = typeof c?.slug === "string" ? c.slug.trim() : "";
      const title = str(c?.title, 160);
      if (!slug || !SLUG_RE.test(slug) || slug.length > 120 || !title || seen.has(slug)) continue;
      seen.add(slug);
      courses.push({
        slug,
        title,
        iconUrl: safeUrl(c.iconUrl),
        topic: langRecord(c.topic, 160),
        outcome: langRecord(c.outcome, 400),
      });
    }
    out.courses = courses;
  }
  if (r.copy && typeof r.copy === "object") {
    const copy: NonNullable<SpaceStored["copy"]> = {};
    for (const l of SPACE_LANGS) {
      const c = normalizeCopy((r.copy as Record<string, unknown>)[l]);
      if (c) copy[l] = c;
    }
    if (Object.keys(copy).length) out.copy = copy;
  }
  return out;
}

/** Ghép cấu hình lưu của trường với mặc định → SpaceConfig đầy đủ, dùng thẳng để dựng trang. */
export function buildSpaceConfig(input: {
  slug: string;
  orgName: string;
  orgLogoUrl: string | null;
  stored: SpaceStored;
}): SpaceConfig {
  const { slug, orgName, orgLogoUrl, stored } = input;
  const name = stored.name ?? orgName;
  const langs = stored.langs?.length ? stored.langs : (["en", "vi"] as SpaceLang[]);
  const defaultLang = stored.defaultLang && langs.includes(stored.defaultLang) ? stored.defaultLang : langs[0]!;
  const courses: SpaceCourseEntry[] = (stored.courses ?? []).map((c) => ({
    slug: c.slug,
    title: c.title,
    iconUrl: c.iconUrl ?? null,
    topic: { en: c.topic?.en ?? c.topic?.vi ?? "", vi: c.topic?.vi ?? c.topic?.en ?? "" },
    outcome: { en: c.outcome?.en ?? c.outcome?.vi ?? "", vi: c.outcome?.vi ?? c.outcome?.en ?? "" },
  }));
  const copy = {} as Record<SpaceLang, SpaceCopy>;
  const stats = {} as Record<SpaceLang, SpaceStat[]>;
  for (const l of SPACE_LANGS) {
    copy[l] = { ...defaultSpaceCopy(l, name, orgName), ...(stored.copy?.[l] ?? {}) };
    stats[l] = [{ n: String(courses.length), label: l === "vi" ? "khoá học" : "courses" }];
  }
  return {
    slug,
    source: "db",
    name,
    titleSuffix: stored.titleSuffix ?? orgName,
    palette: derivePalette(stored.primary ?? "#2563EB", stored.accent ?? "#F59E0B", {
      dark: stored.dark,
      soft: stored.soft,
      accent2: stored.accent2,
    }),
    logoUrl: stored.logoUrl ?? orgLogoUrl,
    logoAlt: stored.logoAlt ?? orgName,
    partnerLogoUrl: stored.partnerLogoUrl ?? null,
    partnerLogoAlt: stored.partnerLogoAlt ?? "",
    heroVisualUrl: stored.heroVisualUrl ?? null,
    siteUrl: stored.siteUrl ?? null,
    siteLabel: stored.siteLabel ?? null,
    langs,
    defaultLang,
    stats,
    copy,
    courses,
  };
}

/**
 * Lớp phòng thủ khi dựng space từ DB: bỏ khoá đang thuộc trường KHÁC (organizationId khác và không rỗng), phòng khi
 * dữ liệu cũ hoặc cách khác lọt qua kiểm tra lúc lưu. Khoá chưa tồn tại (giữ chỗ) hoặc chưa có chủ thì giữ.
 */
export function dropForeignCourses<T extends { slug: string }>(
  courses: T[],
  ownerOf: ReadonlyMap<string, string | null>,
  orgId: string,
): T[] {
  return courses.filter((c) => {
    const owner = ownerOf.get(c.slug);
    return owner === undefined || owner === null || owner === orgId;
  });
}
