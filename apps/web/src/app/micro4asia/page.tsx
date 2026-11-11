import type { Metadata } from "next";
import Link from "next/link";
import { ArrowUpRight, Check } from "lucide-react";
import { prisma } from "@feedbackme/db";
import { auth } from "@/lib/auth";
import { getRegisterEnabled } from "@/lib/site-settings";
import JsonLd from "@/components/JsonLd";
import { absoluteUrl, breadcrumbJsonLd, pageMetadata } from "@/lib/seo";
import {
  M4A_COPY,
  M4A_COURSES,
  M4A_SITE_URL,
  resolveM4aLang,
  type M4aIcon,
  type M4aLang,
} from "@/lib/micro4asia";

// Cần DB để biết khoá nào đã published, giống /catalog.
export const dynamic = "force-dynamic";

type SearchParams = { lang?: string | string[] };

export function generateMetadata({ searchParams }: { searchParams: SearchParams }): Metadata {
  const lang = resolveM4aLang(searchParams.lang);
  const c = M4A_COPY[lang];
  return pageMetadata({
    title: c.metaTitle,
    description: c.metaDescription,
    // Canonical về bản gốc, không kèm ?lang — hai ngôn ngữ cùng một trang.
    path: "/micro4asia",
    locale: lang === "vi" ? "vi_VN" : "en_US",
  });
}

/*
 * Trang này đi theo bộ nhận diện NEU (Design/Thương hiệu NEU, sổ tay 2026), không theo giao diện Limio:
 *  - Màu: chủ đạo #00528C; bổ trợ #C41212 (đỏ), #FFC101 (vàng), #B2B2B2 (xám), #FFFFFF. #D6EEFB và #69A8CB
 *    là hai tông nhạt có trong chính bộ key visual.
 *  - Chữ: Inter (font chủ đạo của sổ tay), đã nạp sẵn ở layout gốc qua biến --font-inter.
 *  - Logo: cụm logo ngang NEU (biểu tượng + tên trường song ngữ) đứng cạnh logo Micro4Asia vì logo đối tác có tên
 *    thương hiệu (mục 1.8); giữa hai logo chừa khoảng trống rộng và một vạch ngăn.
 *  - Key visual: khung 4×4 nền tối làm hình hero, từng ô nền sáng làm biểu tượng cho từng khoá.
 */
const BLUE = "#00528C";
const YELLOW = "#FFC101";

// Ô key visual (nền sáng) dùng làm biểu tượng cho từng vi tín chỉ.
const TILE: Record<M4aIcon, string> = {
  math: "/brand/neu/kv-light/11-cham-tam-giac.svg",
  code: "/brand/neu/kv-light/02-banh-rang.svg",
  clean: "/brand/neu/kv-light/07-hoa-tiet-zigzag.svg",
  chart: "/brand/neu/kv-light/04-bieu-do-tang-truong.svg",
  ml: "/brand/neu/kv-light/03-chip-ai.svg",
  prompt: "/brand/neu/kv-light/08-hai-nguoi.svg",
};

interface LiveCourse {
  title: string;
  personalizationEnabled: boolean;
}

async function getLiveCourses(): Promise<Map<string, LiveCourse>> {
  try {
    const rows = await prisma.course.findMany({
      where: { slug: { in: M4A_COURSES.map((c) => c.slug) }, status: "published" },
      select: { slug: true, title: true, personalizationEnabled: true },
    });
    return new Map(rows.map((r) => [r.slug, { title: r.title, personalizationEnabled: r.personalizationEnabled }]));
  } catch {
    // Trang giới thiệu không được hỏng chỉ vì DB chập chờn: coi như chưa khoá nào mở.
    return new Map();
  }
}

export default async function Micro4AsiaPage({ searchParams }: { searchParams: SearchParams }) {
  const lang = resolveM4aLang(searchParams.lang);
  const c = M4A_COPY[lang];
  const [live, session, registerEnabled] = await Promise.all([getLiveCourses(), auth(), getRegisterEnabled()]);
  const openCount = live.size;
  const loggedIn = !!session?.user?.id;
  const showRegister = !loggedIn && registerEnabled;

  return (
    <div
      lang={lang}
      className="min-h-screen bg-white text-[#1B2733]"
      style={{ fontFamily: "var(--font-inter), system-ui, sans-serif", colorScheme: "light" }}
    >
      {/* Trang đứng riêng với nhận diện NEU: ẩn thanh đầu/chân trang của Limio (cách đã dùng cho phòng thi). */}
      <style>{"[data-app-chrome]{display:none !important}"}</style>
      <JsonLd
        data={[
          breadcrumbJsonLd([
            { name: c.breadcrumbHome, path: "/" },
            { name: "MICRO4ASIA", path: "/micro4asia" },
          ]),
          {
            "@context": "https://schema.org",
            "@type": "ItemList",
            name: c.metaTitle,
            numberOfItems: openCount,
            itemListElement: M4A_COURSES.filter((m) => live.has(m.slug)).map((m, i) => ({
              "@type": "ListItem",
              position: i + 1,
              url: absoluteUrl(`/catalog/${m.slug}`),
              name: live.get(m.slug)!.title,
            })),
          },
        ]}
      />

      <SiteHeader lang={lang} />
      <Hero lang={lang} openCount={openCount} />

      <section id="courses" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-14 lg:px-6 lg:py-20">
        <SectionTitle>{c.coursesTitle}</SectionTitle>
        <p className="mt-3 max-w-2xl text-[#4B5B6B]">{c.coursesSub}</p>
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {M4A_COURSES.map((m, i) => (
            <CourseCard key={m.slug} index={i} lang={lang} course={m} live={live.get(m.slug) ?? null} />
          ))}
        </ul>
      </section>

      <section className="bg-[#D6EEFB]/40">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
          <SectionTitle>{c.principlesTitle}</SectionTitle>
          <ul className="mt-10 grid gap-8 md:grid-cols-3">
            {c.principles.map((p, i) => (
              <li key={p.word}>
                <span
                  className={`inline-block px-3 py-1 text-sm font-bold ${
                    i === 0 ? "bg-[#FFC101] text-[#00528C]" : i === 1 ? "bg-[#C41212] text-white" : "bg-[#00528C] text-white"
                  }`}
                >
                  {p.word}
                </span>
                <h3 className="mt-4 text-lg font-bold leading-snug text-[#00528C]">{p.t}</h3>
                <p className="mt-2 leading-relaxed text-[#4B5B6B]">{p.d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
        <SectionTitle>{c.stepsTitle}</SectionTitle>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {c.steps.map((s, i) => (
            <li key={s.t} className="flex gap-4 border border-[#D6EEFB] p-5">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center bg-[#00528C] text-lg font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-base font-bold leading-tight text-[#00528C]">{s.t}</span>
                <span className="mt-1 block text-sm text-[#4B5B6B]">{s.d}</span>
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-3">
          {showRegister && (
            <Link
              href="/register"
              className="bg-[#00528C] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0E4877]"
            >
              {c.register} →
            </Link>
          )}
          <Link
            href="/catalog"
            className={
              showRegister
                ? "border border-[#00528C] px-6 py-3 text-sm font-bold text-[#00528C] transition-colors hover:bg-[#D6EEFB]/60"
                : "bg-[#00528C] px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-[#0E4877]"
            }
          >
            {c.allCourses}
          </Link>
        </div>
      </section>

      <footer className="border-t-4 border-[#00528C]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-[#4B5B6B] lg:px-6">
          <p>
            {c.footnote}{" "}
            <a
              href={M4A_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-0.5 font-semibold text-[#00528C] underline-offset-2 hover:underline"
            >
              micro4asia.eu
              <ArrowUpRight className="h-3.5 w-3.5" aria-hidden />
            </a>
          </p>
          <p className="text-xs text-[#6B7A89]">
            {c.poweredBy}{" "}
            <Link href="/" className="font-semibold text-[#00528C] underline-offset-2 hover:underline">
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
    <h2 className="flex items-center gap-3 text-3xl font-extrabold leading-tight tracking-tight text-[#00528C] sm:text-4xl">
      <span className="h-8 w-1.5 shrink-0 bg-[#FFC101]" aria-hidden />
      {children}
    </h2>
  );
}

function SiteHeader({ lang }: { lang: M4aLang }) {
  const c = M4A_COPY[lang];
  const other: M4aLang = lang === "en" ? "vi" : "en";
  return (
    <header className="border-b border-[#D6EEFB] bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:px-6">
        {/* Logo NEU + logo đối tác: cách nhau rộng và có vạch ngăn để mỗi logo có khoảng trống an toàn riêng. */}
        <div className="flex min-w-0 items-center gap-5 sm:gap-10">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/neu/neu-logo-ngang.svg"
            alt="Đại học Kinh tế Quốc dân – National Economics University"
            width={1019}
            height={193}
            className="h-9 w-auto min-w-0 sm:h-14"
          />
          <span className="h-10 w-px shrink-0 bg-[#B2B2B2] sm:h-14" aria-hidden />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/micro4asia/logo.png"
            alt="MICRO4ASIA"
            width={112}
            height={160}
            className="h-12 w-auto shrink-0 sm:h-[72px]"
          />
        </div>
        <Link
          href={other === "vi" ? "/micro4asia?lang=vi" : "/micro4asia"}
          hrefLang={other}
          lang={other}
          aria-label={c.switchLabel}
          className="shrink-0 border border-[#00528C] px-3 py-1.5 text-sm font-semibold text-[#00528C] transition-colors hover:bg-[#00528C] hover:text-white"
        >
          {c.switchTo}
        </Link>
      </div>
    </header>
  );
}

function Hero({ lang, openCount }: { lang: M4aLang; openCount: number }) {
  const c = M4A_COPY[lang];
  const stats = [
    { n: "6", label: c.statsCredentials },
    { n: "15", label: c.statsSessions },
    { n: "EN", label: c.statsLanguage },
    { n: String(openCount), label: c.statsOpen(openCount).replace(/^\d+\s*/, "") },
  ].filter((s, i, all) => !(i === all.length - 1 && openCount === 0));
  return (
    <>
      <section className="bg-[#00528C] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-6 lg:py-20">
          <div>
            <p className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#D6EEFB]">
              <span className="h-1 w-10 bg-[#FFC101]" aria-hidden />
              {c.eyebrow}
            </p>
            <h1 className="mt-5 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
              {c.heroLead} <span className="text-[#FFC101]">{c.heroAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[#D6EEFB]">{c.intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <a
                href="#courses"
                className="bg-[#FFC101] px-6 py-3 text-sm font-bold text-[#00528C] transition-colors hover:bg-white"
              >
                {c.browse} ↓
              </a>
              <a
                href={M4A_SITE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 border border-white/70 px-6 py-3 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                {c.aboutProject}
                <ArrowUpRight className="h-4 w-4" aria-hidden />
              </a>
            </div>
          </div>
          {/* Key visual NEU 2026 (nền tối), nguyên khung 4×4 — không cắt, không đổi màu. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/brand/neu/kv-dark/00-nguyen-khung.svg"
            alt=""
            width={992}
            height={992}
            className="mx-auto hidden aspect-square w-full max-w-[22rem] sm:block lg:max-w-none"
          />
        </div>
      </section>

      <section className="bg-[#D6EEFB]">
        <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:grid-cols-4 lg:px-6">
          {stats.map((s) => (
            <div key={s.label} className="px-2 py-5 sm:px-4">
              <dt className="sr-only">{s.label}</dt>
              <dd className="flex items-baseline gap-2">
                <span className="text-3xl font-extrabold text-[#00528C]">{s.n}</span>
                <span className="text-sm font-medium text-[#1B2733]">{s.label}</span>
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </>
  );
}

function CourseCard({
  index,
  lang,
  course,
  live,
}: {
  index: number;
  lang: M4aLang;
  course: (typeof M4A_COURSES)[number];
  live: LiveCourse | null;
}) {
  const c = M4A_COPY[lang];
  const isLive = live !== null;
  const title = live?.title ?? course.title;
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={TILE[course.icon]}
          alt=""
          width={64}
          height={64}
          className={`h-16 w-16 border border-[#D6EEFB] ${isLive ? "" : "opacity-60 grayscale"}`}
        />
        <span className="flex flex-col items-end gap-2">
          <span className="text-sm font-bold tabular-nums text-[#B2B2B2]">{String(index + 1).padStart(2, "0")}</span>
          {isLive ? (
            <span className="inline-flex items-center gap-1 bg-[#00528C] px-2.5 py-1 text-xs font-bold text-white">
              <Check className="h-3 w-3" aria-hidden />
              {c.openNow}
            </span>
          ) : (
            <span className="border border-[#B2B2B2] px-2.5 py-1 text-xs font-bold text-[#6B7A89]">{c.comingSoon}</span>
          )}
        </span>
      </div>

      <h3 className="mt-5 text-lg font-bold leading-snug text-[#00528C]">{title}</h3>
      <p className="mt-1 text-sm font-semibold text-[#1B2733]">{course.topic[lang]}</p>

      <p className="mt-4 text-xs font-bold uppercase tracking-wider text-[#C41212]">{c.youWillBeAbleTo}</p>
      <p className="mt-1 text-sm leading-relaxed text-[#4B5B6B]">{course.outcome[lang]}</p>

      <div className="mt-auto flex items-center gap-2 border-t border-[#D6EEFB] pt-4 text-sm">
        {isLive ? (
          <>
            {live.personalizationEnabled && (
              <span className="bg-[#D6EEFB] px-2 py-0.5 text-[11px] font-bold text-[#00528C]">AI feedback</span>
            )}
            <span className="ml-auto font-bold text-[#00528C] group-hover:underline">{c.viewCourse} →</span>
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
          className="group flex h-full flex-col border border-t-4 border-[#D6EEFB] border-t-[#00528C] bg-white p-6 transition-shadow hover:shadow-lg"
        >
          {body}
        </Link>
      ) : (
        <div className="flex h-full flex-col border border-t-4 border-[#D6EEFB] border-t-[#B2B2B2] bg-white p-6">{body}</div>
      )}
    </li>
  );
}
