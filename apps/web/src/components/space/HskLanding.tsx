import Link from "next/link";
import { ArrowRight, ArrowUpRight, Headphones, Lock, Route, Sparkles } from "lucide-react";
import { LimeSliceIcon } from "@/components/BrandIcons";
import SpaceRegisterDialog from "@/components/space/SpaceRegisterDialog";
import { HSK_NUMERALS, HSK_PINYIN, HSK_UI } from "@/lib/hsk";
import { spaceHomePath } from "@/lib/space/resolve";
import type { SpaceConfig, SpaceCourseEntry, SpaceLang } from "@/lib/space/types";

/**
 * Trang chủ kiểu Limio cho space có `limioBrand` (hiện là /hsk): nền sáng, bo tròn, chanh → dưa hấu.
 * Server component; dữ liệu (khoá nào đang mở, có hiện nút đăng ký không) do SpaceHome truyền xuống.
 */
export interface HskLiveCourse {
  title: string;
  personalizationEnabled: boolean;
}

interface Props {
  cfg: SpaceConfig;
  lang: SpaceLang;
  live: Map<string, HskLiveCourse>;
  showRegister: boolean;
  /** JSON-LD và các phần không nhìn thấy do SpaceHome dựng. */
  children?: React.ReactNode;
}

const HAN_FONT = "'PingFang SC','Noto Sans SC','Hiragino Sans GB','Microsoft YaHei',sans-serif";

/** Màu từng chặng: chanh (sơ cấp) → lục đậm (trung cấp) → hồng dưa hấu (cao cấp). Class viết đủ để Tailwind quét được. */
const TONES = [
  {
    chip: "bg-lime-100 text-lime-800",
    numeral: "text-lime-300/70",
    bar: "from-lime-400 to-lime-600",
    btn: "bg-lime-600 hover:bg-lime-700 shadow-lime-600/30",
    ring: "hover:border-lime-300",
    dot: "bg-lime-500",
  },
  {
    chip: "bg-emerald-100 text-emerald-800",
    numeral: "text-emerald-300/70",
    bar: "from-emerald-500 to-emerald-700",
    btn: "bg-emerald-700 hover:bg-emerald-800 shadow-emerald-700/30",
    ring: "hover:border-emerald-300",
    dot: "bg-emerald-500",
  },
  {
    chip: "bg-pink-100 text-pink-800",
    numeral: "text-pink-300/70",
    bar: "from-pink-400 to-pink-600",
    btn: "bg-pink-600 hover:bg-pink-700 shadow-pink-600/30",
    ring: "hover:border-pink-300",
    dot: "bg-pink-500",
  },
] as const;

/** Ô trong lưới hero: sáng dần → đậm → hồng, đọc như một lộ trình đi lên. */
const TILE_STYLE = [
  "bg-lime-100 text-lime-900",
  "bg-lime-200 text-lime-900",
  "bg-lime-300 text-lime-950",
  "bg-emerald-600 text-lime-50",
  "bg-emerald-700 text-lime-50",
  "bg-emerald-800 text-lime-50",
  "bg-pink-300 text-pink-950",
  "bg-pink-400 text-pink-950",
  "bg-pink-500 text-white",
] as const;

function toneAt(n: number) {
  return TONES[n] ?? TONES[0];
}

function toneOf(i: number, total: number) {
  return toneAt(total === 9 ? Math.floor(i / 3) : 0);
}

export default function HskLanding({ cfg, lang, live, showRegister, children }: Props) {
  const c = cfg.copy[lang];
  const ui = HSK_UI[lang];
  const home = spaceHomePath(cfg);
  const firstLive = cfg.courses.find((m) => live.has(m.slug)) ?? null;
  const startHref = firstLive ? `/catalog/${firstLive.slug}` : "#courses";
  const stats = [...cfg.stats[lang]];
  if (live.size > 0) stats.push({ n: String(live.size), label: c.statsOpen.replace("{n}", "").trim() });
  const principleIcons = [Route, Headphones, Sparkles];

  // Bố cục theo trang M4A (/micro4asia): đầu trang → hero xanh → dải số liệu → lưới khoá → nguyên tắc → ba bước → chân trang.
  return (
    <div
      lang={lang}
      className="min-h-screen bg-white text-slate-800"
      style={
        {
          fontFamily: "var(--font-inter), system-ui, sans-serif",
          colorScheme: "light",
          "--sp": cfg.palette.primary,
          "--sp-dark": cfg.palette.dark,
          "--sp-soft": cfg.palette.soft,
          "--sp-accent": cfg.palette.accent,
          "--sp-accent2": cfg.palette.accent2,
        } as React.CSSProperties
      }
    >
      {/* Trang đứng riêng: ẩn thanh đầu/chân trang chung của Limio (trang tự có header riêng). */}
      <style>{"[data-app-chrome]{display:none !important}@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}"}</style>
      {children}

      {/* Đầu trang */}
      <header className="border-b border-[color:var(--sp-soft)] bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 lg:px-6">
          <Link href="/" className="group flex shrink-0 items-center gap-2" aria-label="Limio">
            <LimeSliceIcon className="h-9 w-9 shrink-0 transition-transform duration-300 group-hover:rotate-[30deg] sm:h-11 sm:w-11" />
            <span className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
              Lim<span className="text-pink-500">io</span>
            </span>
          </Link>
          {cfg.langs.length > 1 && <LangSwitch cfg={cfg} lang={lang} />}
        </div>
      </header>

      {/* Hero */}
      <section className="bg-[var(--sp)] text-white">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-14 lg:px-6 lg:py-20">
          <div className="motion-safe:animate-fade-in-up">
            <p className="flex items-center gap-3 text-sm font-semibold uppercase tracking-[0.14em] text-[color:var(--sp-soft)]">
              <span className="h-1 w-10 rounded-full bg-[var(--sp-accent)]" aria-hidden />
              {c.eyebrow}
            </p>
            <h1 className="mt-5 text-[2.5rem] font-extrabold leading-[1.1] tracking-tight sm:text-6xl">
              {c.heroLead} <span className="text-[color:var(--sp-accent)]">{c.heroAccent}</span>
            </h1>
            <p className="mt-6 max-w-xl text-lg leading-relaxed text-[color:var(--sp-soft)]">{c.intro}</p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link
                href={startHref}
                prefetch={false}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--sp-accent)] px-7 py-3.5 text-sm font-bold text-lime-950 shadow-lg shadow-black/20 transition-all hover:-translate-y-0.5 hover:bg-white"
              >
                {firstLive ? ui.ctaOpen : c.browse}
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <a
                href="#courses"
                className="inline-flex items-center gap-2 rounded-full border border-white/60 px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-white/10"
              >
                {c.browse} ↓
              </a>
            </div>
          </div>
          <HeroTiles />
        </div>
      </section>

      {/* Dải số liệu */}
      {stats.length > 0 && (
        <section className="bg-[var(--sp-soft)]">
          <dl className="mx-auto grid max-w-6xl grid-cols-2 gap-px px-4 sm:grid-cols-4 lg:px-6">
            {stats.map((st) => (
              <div key={st.label} className="px-2 py-5 sm:px-4">
                <dt className="sr-only">{st.label}</dt>
                <dd className="flex items-baseline gap-2">
                  <span className="text-3xl font-extrabold text-[color:var(--sp)]">{st.n}</span>
                  <span className="text-sm font-medium text-slate-800">{st.label}</span>
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* Lưới chín cấp */}
      <section id="courses" className="mx-auto max-w-6xl scroll-mt-4 px-4 py-14 lg:px-6 lg:py-20">
        <SectionTitle>{c.coursesTitle}</SectionTitle>
        {c.coursesSub && <p className="mt-3 max-w-2xl text-slate-600">{c.coursesSub}</p>}
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {cfg.courses.map((m, i) => (
            <LevelCard
              key={m.slug}
              index={i}
              total={cfg.courses.length}
              lang={lang}
              cfg={cfg}
              course={m}
              live={live.has(m.slug)}
              ai={live.get(m.slug)?.personalizationEnabled ?? false}
            />
          ))}
        </ul>
        {cfg.courses.length === 0 && <p className="mt-8 text-slate-500">{c.comingSoon}</p>}
      </section>

      {/* Nguyên tắc */}
      <section className="bg-[var(--sp-soft)]/40">
        <div className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
          <SectionTitle>{c.principlesTitle}</SectionTitle>
          <ul className="mt-10 grid gap-5 md:grid-cols-3">
            {c.principles.map((pr, i) => {
              const Icon = principleIcons[i % principleIcons.length] ?? Sparkles;
              return (
                <li key={pr.word} className="rounded-3xl bg-white p-7 shadow-card ring-1 ring-lime-100">
                  <span
                    className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                      i === 0 ? "bg-lime-400 text-lime-950" : i === 1 ? "bg-lime-700 text-white" : "bg-pink-500 text-white"
                    }`}
                  >
                    <Icon className="h-6 w-6" aria-hidden />
                  </span>
                  <p className="mt-5 text-xs font-bold uppercase tracking-[0.16em] text-lime-700">{pr.word}</p>
                  <h3 className="mt-2 text-lg font-bold leading-snug text-[color:var(--sp)]">{pr.t}</h3>
                  <p className="mt-2 leading-relaxed text-slate-600">{pr.d}</p>
                </li>
              );
            })}
          </ul>
        </div>
      </section>

      {/* Ba bước */}
      <section className="mx-auto max-w-6xl px-4 py-14 lg:px-6 lg:py-20">
        <SectionTitle>{c.stepsTitle}</SectionTitle>
        <ol className="mt-10 grid gap-6 md:grid-cols-3">
          {c.steps.map((st, i) => (
            <li key={st.t} className="flex gap-4 rounded-3xl border border-lime-100 bg-white p-6 shadow-card">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--sp)] text-lg font-bold text-white">
                {i + 1}
              </span>
              <span>
                <span className="block text-base font-bold leading-tight text-[color:var(--sp)]">{st.t}</span>
                <span className="mt-1 block text-sm text-slate-600">{st.d}</span>
              </span>
            </li>
          ))}
        </ol>
        {showRegister && (
          <div className="mt-8">
            <SpaceRegisterDialog
              lang={lang}
              label={c.register}
              intro={c.registerIntro}
              backPath={home}
              buttonClassName="rounded-full bg-[var(--sp)] px-7 py-3.5 text-sm font-bold text-white transition-colors hover:bg-[var(--sp-dark)]"
            />
          </div>
        )}
      </section>

      {/* Chân trang */}
      <footer className="border-t-4 border-[color:var(--sp)]">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-slate-600 lg:px-6">
          <p>{c.footnote}</p>
          <p className="text-xs text-slate-500">
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
      <span className="h-8 w-1.5 shrink-0 rounded-full bg-[var(--sp-accent)]" aria-hidden />
      {children}
    </h2>
  );
}

function LangSwitch({ cfg, lang }: { cfg: SpaceConfig; lang: SpaceLang }) {
  const c = cfg.copy[lang];
  const other: SpaceLang = lang === "en" ? "vi" : "en";
  return (
    <Link
      href={spaceHomePath(cfg, other, cfg.defaultLang)}
      hrefLang={other}
      lang={other}
      aria-label={c.switchLabel}
      title={c.switchTo}
      className="flex shrink-0 items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition-colors hover:border-lime-400"
    >
      <Flag lang={other} />
      <span className="hidden sm:inline">{c.switchTo}</span>
      <span className="sr-only sm:hidden">{c.switchTo}</span>
    </Link>
  );
}

/** Cờ của ngôn ngữ sẽ chuyển sang: Việt Nam cho "vi", Vương quốc Anh cho "en". */
function Flag({ lang }: { lang: SpaceLang }) {
  const cls = "block h-4 w-6 rounded-[3px] shadow-[0_0_0_1px_rgba(0,0,0,0.12)]";
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

/** Lưới 3×3 số Hán 一…九: mỗi ô là một cấp, đậm dần từ chanh sang lục rồi hồng. Chỉ để trang trí. */
function HeroTiles() {
  return (
    <div className="relative mx-auto w-full max-w-sm lg:max-w-md">
      <div className="relative grid grid-cols-3 gap-3 sm:gap-4">
        {HSK_NUMERALS.map((h, i) => (
          <a
            key={h}
            href={`#hsk-${i + 1}`}
            aria-label={`HSK ${i + 1}`}
            className={`relative aspect-square overflow-hidden rounded-[1.6rem] shadow-card ring-1 ring-white/15 transition-transform duration-300 hover:-translate-y-1 hover:rotate-[-2deg] ${TILE_STYLE[i]}`}
          >
            <span className="absolute left-2.5 top-2 text-[0.65rem] font-extrabold uppercase tracking-widest opacity-70">
              HSK {i + 1}
            </span>
            <span
              className="absolute inset-0 flex items-center justify-center pt-3 text-5xl leading-none sm:text-6xl"
              style={{ fontFamily: HAN_FONT, fontWeight: 600 }}
            >
              {h}
            </span>
            <span className="absolute bottom-2 right-3 text-[0.7rem] font-semibold italic opacity-70">{HSK_PINYIN[i]}</span>
            {i === 0 && <span className="absolute right-2.5 top-2.5 h-2.5 w-2.5 rounded-full bg-lime-600 ring-4 ring-lime-600/20" />}
          </a>
        ))}
      </div>
    </div>
  );
}

function LevelCard({
  index,
  total,
  lang,
  cfg,
  course,
  live,
  ai,
}: {
  index: number;
  total: number;
  lang: SpaceLang;
  cfg: SpaceConfig;
  course: SpaceCourseEntry;
  live: boolean;
  ai: boolean;
}) {
  const c = cfg.copy[lang];
  const ui = HSK_UI[lang];
  const tone = toneOf(index, total);
  const numeral = HSK_NUMERALS[index] ?? "";

  const body = (
    <>

      <div className="relative flex h-full flex-col">
        {live ? (
          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${tone.chip}`}>
            <span className={`h-2 w-2 rounded-full ${tone.dot} motion-safe:animate-pulse`} aria-hidden />
            {c.openNow}
          </span>
        ) : (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-500">
            <Lock className="h-3 w-3" aria-hidden />
            {c.comingSoon}
          </span>
        )}

        <div className="mt-5 flex items-end justify-between gap-3">
          <p className={`flex items-baseline gap-2 ${live ? "text-slate-900" : "text-slate-500"}`}>
            <span className="text-sm font-extrabold uppercase tracking-[0.2em]">{ui.level}</span>
            <span className="text-6xl font-extrabold leading-none tracking-tighter">{index + 1}</span>
          </p>
          <span
            className={`select-none text-6xl font-extrabold leading-none ${live ? tone.numeral : "text-slate-300/70"}`}
            style={{ fontFamily: HAN_FONT }}
            aria-hidden
          >
            {numeral}
          </span>
        </div>

        <h4 className={`mt-4 text-lg font-bold leading-snug ${live ? "text-slate-900" : "text-slate-600"}`}>{course.topic[lang]}</h4>

        <p className="mt-4 text-[0.7rem] font-extrabold uppercase tracking-[0.14em] text-slate-500">{c.youWillBeAbleTo}</p>
        <p className={`mt-1 text-sm leading-relaxed ${live ? "text-slate-600" : "text-slate-500"}`}>{course.outcome[lang]}</p>

        {live && (
          <div className="mt-auto flex items-center justify-between gap-3 pt-6">
            {ai ? (
              <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-full bg-pink-50 px-2.5 py-1 text-[11px] font-bold text-pink-700">
                <Sparkles className="h-3 w-3" aria-hidden />
                AI feedback
              </span>
            ) : (
              <span />
            )}
            <span
              className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg transition-transform group-hover:translate-x-0.5 ${tone.btn}`}
            >
              {c.viewCourse}
              <ArrowUpRight className="h-4 w-4" aria-hidden />
            </span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <li id={`hsk-${index + 1}`} className="scroll-mt-6 rounded-3xl transition-shadow target:[&>*]:ring-4 target:[&>*]:ring-lime-300">
      {live ? (
        <Link
          href={`/catalog/${course.slug}`}
          prefetch={false}
          className={`group relative block h-full overflow-hidden rounded-3xl border border-slate-200 bg-white p-6 shadow-card transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover ${tone.ring}`}
        >
          <span className={`absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r ${tone.bar}`} aria-hidden />
          {body}
        </Link>
      ) : (
        <div className="relative h-full overflow-hidden rounded-3xl border-2 border-dashed border-slate-200 bg-white/50 p-6">{body}</div>
      )}
    </li>
  );
}
