import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { getRegisterEnabled } from "@/lib/site-settings";
import JsonLd from "@/components/JsonLd";
import SpaceRegisterDialog from "@/components/space/SpaceRegisterDialog";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import { spaceHomePath } from "@/lib/space/resolve";
import { resolveSpaceLang } from "@/lib/space/lang";
import type { SpaceConfig, SpaceCourseEntry, SpaceLang } from "@/lib/space/types";

export type SpaceSearchParams = { lang?: string | string[] };

/** Metadata cho trang chủ space: link gửi đi mang nhận diện của space, không phải của Limio. */
export function spaceMetadata(cfg: SpaceConfig, searchParams: SpaceSearchParams): Metadata {
  const lang = resolveSpaceLang(searchParams.lang, cfg);
  const c = cfg.copy[lang];
  const home = spaceHomePath(cfg);
  const base = pageMetadata({
    title: c.metaTitle,
    description: c.metaDescription,
    // Canonical về bản gốc, không kèm ?lang — các ngôn ngữ cùng một trang.
    path: home,
    image: `${home}/og`,
    locale: lang === "vi" ? "vi_VN" : "en_US",
  });
  return {
    ...base,
    title: { absolute: `${c.metaTitle} | ${cfg.titleSuffix}` },
    openGraph: { ...base.openGraph, title: c.metaTitle, siteName: `${cfg.name} × ${cfg.titleSuffix}` },
    twitter: { ...base.twitter, title: c.metaTitle },
  };
}

/*
 * Trang chủ của một space (trường/dự án). Màu lấy từ cfg.palette qua biến CSS --sp* đặt ở thẻ ngoài cùng; chữ Inter
 * (đã nạp ở layout gốc). Header/footer Limio được ẩn — trang tự có thanh đầu mang logo của space.
 */
interface LiveCourse {
  title: string;
  personalizationEnabled: boolean;
}

async function getLiveCourses(courses: SpaceCourseEntry[]): Promise<Map<string, LiveCourse>> {
  try {
    const rows = await prisma.course.findMany({
      where: { slug: { in: courses.map((c) => c.slug) }, status: "published" },
      select: { slug: true, title: true, personalizationEnabled: true },
    });
    return new Map(rows.map((r) => [r.slug, { title: r.title, personalizationEnabled: r.personalizationEnabled }]));
  } catch {
    // Trang giới thiệu không được hỏng chỉ vì DB chập chờn: coi như chưa khoá nào mở.
    return new Map();
  }
}

function hexRgb(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
}

export default async function SpaceHome({ cfg, searchParams }: { cfg: SpaceConfig; searchParams: SpaceSearchParams }) {
  const lang = resolveSpaceLang(searchParams.lang, cfg);
  const c = cfg.copy[lang];
  const [live, session, registerEnabled] = await Promise.all([getLiveCourses(cfg.courses), auth(), getRegisterEnabled()]);
  const openCount = live.size;
  const loggedIn = !!session?.user?.id;
  const showRegister = !loggedIn && registerEnabled;
  const home = spaceHomePath(cfg);
  const p = cfg.palette;

  return (
    <div
      lang={lang}
      className="min-h-screen bg-white text-[#1B2733]"
      style={
        {
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          colorScheme: "light",
          "--sp": p.primary,
          "--sp-dark": p.dark,
          "--sp-soft": p.soft,
          "--sp-accent": p.accent,
          "--sp-accent2": p.accent2,
          "--sp-soft-rgb": hexRgb(p.soft),
        } as React.CSSProperties
      }
    >
      {/* Trang đứng riêng với nhận diện của space: ẩn thanh đầu/chân trang của Limio (cách đã dùng cho phòng thi). */}
      <style>{"[data-app-chrome]{display:none !important}"}</style>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: c.breadcrumbHome, path: "/" },
            { name: cfg.name, path: home },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: c.metaTitle,
            numberOfItems: openCount,
            itemListElement: cfg.courses
              .filter((m) => live.has(m.slug))
              .map((m, i) => ({
                "@type": "ListItem",
                position: i + 1,
                url: absoluteUrl(`/catalog/${m.slug}`),
                name: live.get(m.slug)!.title,
              })),
          },
        ]}
      />

      <SiteHeader cfg={cfg} lang={lang} />
      <Hero cfg={cfg} lang={lang} openCount={openCount} />

      <section id="courses" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-14 lg:px-6 lg:py-20">
        <SectionTitle>{c.coursesTitle}</SectionTitle>
        {c.coursesSub && <p className="mt-3 max-w-2xl text-[#4B5B6B]">{c.coursesSub}</p>}
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cfg.courses.map((m, i) => (
            <CourseCard key={m.slug} index={i} lang={lang} cfg={cfg} course={m} live={live.get(m.slug) ?? null} />
          ))}
        </ul>
        {cfg.courses.length === 0 && <p className="mt-8 text-[#6B7A89]">{c.comingSoon}</p>}
      </section>

      <section className="bg-[rgb(var(--sp-soft-rgb)/0.40)]">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
          <SectionTitle>{c.principlesTitle}</SectionTitle>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {c.principles.map((pr, i) => (
              <li key={pr.word}>
                <span
                  className={`inline-block px-3 py-1 text-sm font-bold ${
                    i === 0
                      ? "bg-[var(--sp-accent)] text-[color:var(--sp)]"
                      : i === 1
                        ? "bg-[var(--sp-accent2)] text-white"
                        : "bg-[var(--sp)] text-white"
                  }`}
                >
                  {pr.word}
                </span>
                <h3 className="mt-4 text-lg font-bold leading-snug text-[color:var(--sp)]">{pr.t}</h3>
                <p className="mt-2 leading-relaxed text-[#4B5B6B]">{pr.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
        <SectionTitle>{c.stepsTitle}</SectionTitle>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {c.steps.map((st, i) => (
            <li key={st.t} className="flex gap-4 border border-[color:var(--sp-soft)] p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[var(--sp)] text-lg font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-base font-bold leading-tight text-[color:var(--sp)]">{st.t}</span>
                <span className="mt-1 block text-sm text-[#4B5B6B]">{st.d}</span>
              </span>
            </li>
          ))}
        </ol>
        {showRegister && (
          <div className="mt-8">
            <SpaceRegisterDialog lang={lang} label={c.register} intro={c.registerIntro} backPath={home} />
          </div>
        )}
      </section>

      <footer className="border-t-4 border-[color:var(--sp)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[#4B5B6B] lg:px-6">
          <p>
            {c.footnote}{" "}
            {cfg.siteUrl && (
              <a
                href={cfg.siteUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-semibold text-[color:var(--sp)] underline-offset-2 hover:underline"
              >
                {cfg.siteLabel ?? cfg.siteUrl}
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </p>
          <p className="text-xs text-[#6B7A89]">
            {c.poweredBy}{" "}
            <Link href="/" className="font-semibold text-[color:var(--sp)] underline-offset-2 hover:underline">
              Limio
            </Link>
          </p>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-3 text-3xl font-extrabold leading-tight tracking-tight text-[color:var(--sp)] sm:text-4xl">
      <span className="h-8 w-1.5 shrink-0 bg-[var(--sp-accent)]" aria-hidden />
      {children}
    </h2>
  );
}

function SiteHeader({ cfg, lang }: { cfg: SpaceConfig; lang: SpaceLang }) {
  const c = cfg.copy[lang];
  const other: SpaceLang = lang === "en" ? "vi" : "en";
  const canSwitch = cfg.langs.length > 1;
  return (
    <header className="border-b border-[color:var(--sp-soft)] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:px-6">
        {/* Logo trường + logo đối tác: cách nhau rộng và có vạch ngăn để mỗi logo có khoảng trống an toàn riêng. */}
        <div className="flex min-w-0 items-center gap-5 sm:gap-10">
          {cfg.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.logoUrl} alt={cfg.logoAlt} className="h-9 w-auto min-w-0 sm:h-14" />
          )}
          {cfg.logoUrl && cfg.partnerLogoUrl && <span className="h-10 w-px shrink-0 bg-[#B2B2B2] sm:h-14" aria-hidden />}
          {cfg.partnerLogoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={cfg.partnerLogoUrl} alt={cfg.partnerLogoAlt} className="h-12 w-auto shrink-0 sm:h-[72px]" />
          )}
          {!cfg.logoUrl && !cfg.partnerLogoUrl && (
            <span className="text-2xl font-extrabold text-[color:var(--sp)]">{cfg.name}</span>
          )}
        </div>
        {canSwitch && (
          <Link
            href={spaceHomePath(cfg, other, cfg.defaultLang)}
            hrefLang={other}
            lang={other}
            aria-label={c.switchLabel}
            title={c.switchTo}
            className="block shrink-0 transition-opacity hover:opacity-80"
          >
            <Flag lang={other} />
            <span className="sr-only">{c.switchTo}</span>
          </Link>
        )}
      </div>
    </header>
  );
}

/** Cờ của ngôn ngữ sẽ chuyển sang: Việt Nam cho "vi", Vương quốc Anh cho "en". */
function Flag({ lang }: { lang: SpaceLang }) {
  const cls = "block h-6 w-9 shadow-[0_0_0_1px_rgba(0,0,0,0.12)] sm:h-7 sm:w-[42px]";
  if (lang === "vi") {
    return (
      <svg viewBox="0 0 30 20" className={cls} aria-hidden>
        <rect width="30" height="20" fill="#DA251D" />
        <polygon
          fill="#FFFF00"
          points="15.00,3.80 16.39,8.08 20.90,8.08 17.25,10.73 18.64,15.02 15.00,12.37 11.36,15.02 12.75,10.73 9.10,8.08 13.61,8.08"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 60 40" className={cls} aria-hidden>
      <rect width="60" height="40" fill="#012169" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#fff" strokeWidth="8" />
      <path d="M0,0 L60,40 M60,0 L0,40" stroke="#C8102E" strokeWidth="3" />
      <path d="M30,0 V40 M0,20 H60" stroke="#fff" strokeWidth="13" />
      <path d="M30,0 V40 M0,20 H60" stroke="#C8102E" strokeWidth="8" />
    </svg>
  );
}

function Hero({ cfg, lang, openCount }: { cfg: SpaceConfig; lang: SpaceLang; openCount: number }) {
  const c = cfg.copy[lang];
  const stats = [...cfg.stats[lang]];
  if (openCount > 0) stats.push({ n: String(openCount), label: c.statsOpen.replace("{n}", "").trim() });
  return (
    <>
      <section className="bg-[var(--sp)] text-white">
        <div
          className={`mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:px-6 lg:py-20 ${
            cfg.heroVisualUrl ? "lg:grid-cols-[1.15fr_0.85fr] lg:gap-14" : ""
          }`}
        >
          <div>
            <p className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--sp-soft)]">
              <span className="h-1 w-10 bg-[var(--sp-accent)]" aria-hidden />
              {c.eyebrow}
            </p>
            <h1 className="mt-5 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
              {c.heroLead} <span className="text-[color:var(--sp-accent)]">{c.heroAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--sp-soft)]">{c.intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#courses"
                className="bg-[var(--sp-accent)] px-6 py-3 text-sm font-bold text-[color:var(--sp)] transition-colors hover:bg-white"
              >
                {c.browse} ↓
              </a>
              {cfg.siteUrl && (
                <a
                  href={cfg.siteUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 border border-white/70 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
                >
                  {c.aboutProject}
                  <ArrowUpRight className="h-4 w-4" aria-hidden />
                </a>
              )}
            </div>
          </div>
          {cfg.heroVisualUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.heroVisualUrl}
              alt=""
              className="mx-auto hidden aspect-square w-full max-w-[22rem] sm:block lg:max-w-none"
            />
          )}
        </div>
      </section>

      {stats.length > 0 && (
        <section className="bg-[var(--sp-soft)]">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:grid-cols-4 lg:px-6">
            {stats.map((st) => (
              <div key={st.label} className="px-2 py-5 sm:px-4">
                <dt className="sr-only">{st.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[color:var(--sp)]">{st.n}</span>
                  <span className="text-sm font-medium text-[#1B2733]">{st.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}
    </>
  );
}

function CourseCard({
  index,
  lang,
  cfg,
  course,
  live,
}: {
  index: number;
  lang: SpaceLang;
  cfg: SpaceConfig;
  course: SpaceCourseEntry;
  live: LiveCourse | null;
}) {
  const c = cfg.copy[lang];
  const isLive = live !== null;
  const title = live?.title ?? course.title;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {course.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={course.iconUrl}
            alt=""
            width={64}
            height={64}
            className={`h-16 w-16 border border-[color:var(--sp-soft)] ${isLive ? "" : "opacity-60 grayscale"}`}
          />
        ) : (
          <span
            aria-hidden
            className={`flex h-16 w-16 items-center justify-center bg-[var(--sp-soft)] text-2xl font-extrabold text-[color:var(--sp)] ${
              isLive ? "" : "opacity-60 grayscale"
            }`}
          >
            {String(index + 1).padStart(2, "0")}
          </span>
        )}
        <span className="flex flex-col items-end gap-2">
          <span className="text-sm font-bold tabular-nums text-[#B2B2B2]">{String(index + 1).padStart(2, "0")}</span>
          {isLive ? (
            <span className="inline-flex items-center gap-1 bg-[var(--sp)] px-2.5 py-1 text-xs font-bold text-white">
              <Check className="h-3 w-3" aria-hidden />
              {c.openNow}
            </span>
          ) : (
            <span className="border border-[#B2B2B2] px-2.5 py-1 text-xs font-bold text-[#6B7A89]">{c.comingSoon}</span>
          )}
        </span>
      </div>

      <h3 className="mt-5 text-lg font-bold leading-snug text-[color:var(--sp)]">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-[#1B2733]">{course.topic[lang]}</p>

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[color:var(--sp-accent2)]">{c.youWillBeAbleTo}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#4B5B6B]">{course.outcome[lang]}</p>

      <div className="mt-auto flex items-center gap-2 border-t border-[color:var(--sp-soft)] pt-4 text-sm">
        {isLive ? (
          <>
            {live.personalizationEnabled && (
              <span className="bg-[var(--sp-soft)] px-2 py-0.5 text-[11px] font-bold text-[color:var(--sp)]">AI feedback</span>
            )}
            <span className="ml-auto font-bold text-[color:var(--sp)] group-hover:underline">{c.viewCourse} →</span>
          </>
        ) : (
          <span className="text-[#6B7A89]">{c.comingSoon}</span>
        )}
      </div>
    </>
  );

  return (
    <li>
      {isLive ? (
        <Link
          href={`/catalog/${course.slug}`}
          prefetch={false}
          className="group flex h-full flex-col border border-t-4 border-[color:var(--sp-soft)] border-t-[color:var(--sp)] bg-white p-6 transition-shadow hover:shadow-lg"
        >
          {body}
        </Link>
      ) : (
        <div className="flex h-full flex-col border border-t-4 border-[color:var(--sp-soft)] border-t-[#B2B2B2] bg-white p-6">{body}</div>
      )}
    </li>
  );
}
