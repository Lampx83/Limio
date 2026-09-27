import Link from "next/link";
import {
  Check,
  ClipboardCheck,
  GraduationCap,
  PenLine,
  Presentation,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
} from "lucide-react";
import { LimeSliceIcon, WatermelonSliceIcon } from "@/components/BrandIcons";

// Trang chủ trước đăng nhập. Hướng tới cả giáo viên lẫn học viên: hero nói chung,
// hai thẻ đối tượng (xanh chanh = dạy, hồng = học), ba bước "nhịp dạy – chỗ học",
// rồi CTA. Mọi số liệu trong mockup là minh hoạ, không phải dữ liệu thật.
function AiBadge({ className = "" }: { className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md border border-token bg-white/80 px-1.5 py-0.5 text-[11px] font-semibold leading-none tracking-wide text-muted ${className}`}
    >
      <Sparkles className="h-3 w-3 text-brand-600" aria-hidden />
      AI
    </span>
  );
}

export default function LandingPage() {
  return (
    <main>
      <Hero />
      <Audiences />
      <HowItWorks />
      <Plans />
      <Promises />
      <FinalCta />
    </main>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden">
      <div
        className="absolute inset-0 -z-10 bg-hero-grid opacity-60"
        style={{ backgroundSize: "24px 24px" }}
        aria-hidden
      />
      <div
        className="absolute -left-24 -top-24 -z-10 h-96 w-96 rounded-full bg-brand-200/60 blur-3xl"
        aria-hidden
      />
      <div
        className="absolute -right-24 top-10 -z-10 h-96 w-96 rounded-full bg-pink-200/50 blur-3xl"
        aria-hidden
      />

      <div
        className="absolute bottom-0 left-1/3 -z-10 h-64 w-64 rounded-full bg-amber-100/50 blur-3xl"
        aria-hidden
      />

      <div className="mx-auto grid max-w-6xl items-center gap-12 px-6 pb-16 pt-16 sm:pt-24 lg:grid-cols-[1.05fr_0.95fr] lg:gap-8 lg:pb-24">
        <div className="animate-fade-in-up text-center lg:text-left">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/70 px-3.5 py-1.5 text-sm font-medium text-brand-700 shadow-sm backdrop-blur">
            <Sparkles className="h-4 w-4 text-pink-500" aria-hidden />
            Teach in Flow · Fresh to Know
          </span>
          <h1 className="h-display text-[2.75rem] font-extrabold leading-[1.08] sm:text-6xl">
            <span className="block">Dạy đúng nhịp,</span>
            <span className="relative block pb-3">
              <span className="relative inline-block">
                <span className="text-gradient">học đúng chỗ</span>
                <svg
                  className="absolute -bottom-3 left-0 h-3.5 w-full text-pink-400/80"
                  viewBox="0 0 200 14"
                  preserveAspectRatio="none"
                  aria-hidden
                >
                  {/* Nét cong dạng lưỡi liềm: dày ở giữa, thon nhọn hai đầu cho mềm. */}
                  <path
                    d="M3 5 Q 100 17 197 2 Q 100 10 3 5 Z"
                    fill="currentColor"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
            </span>
          </h1>
          <div className="mx-auto mt-7 max-w-md space-y-3 text-left text-lg lg:mx-0">
            <p className="flex gap-3">
              <span className="mt-1 h-7 w-1 shrink-0 rounded-full bg-brand-500" aria-hidden />
              <span>
                <b className="font-semibold text-brand-700">Giáo viên</b>{" "}
                <span className="text-muted">soạn bài, mở lớp, thi cử gọn gàng.</span>
              </span>
            </p>
            <p className="flex gap-3">
              <span className="mt-1 h-7 w-1 shrink-0 rounded-full bg-pink-500" aria-hidden />
              <span>
                <b className="font-semibold text-pink-700">Học viên</b>{" "}
                <span className="text-muted">biết mình vững chỗ nào, cần ôn gì tiếp.</span>
              </span>
            </p>
          </div>
          <div className="mt-9 flex flex-wrap items-center justify-center gap-3 lg:justify-start">
            <Link href="/register" className="btn-primary btn-lg !rounded-full shadow-md transition-transform hover:-translate-y-0.5">
              Tạo tài khoản →
            </Link>
            <Link href="/catalog" className="btn-secondary btn-lg !rounded-full transition-transform hover:-translate-y-0.5">
              Khám phá khóa học
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {["Dạy, học, thi một chỗ", "Có AI hỗ trợ"].map((t) => (
              <li
                key={t}
                className="flex items-center gap-1.5 rounded-full border border-token bg-white/70 px-3 py-1 text-sm text-muted"
              >
                <Check className="h-4 w-4 text-brand-600" aria-hidden />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <HeroMock />
      </div>
    </section>
  );
}

// Mockup thẻ phản hồi — minh hoạ cách Limio chỉ ra "đúng chỗ" cho học viên và
// cho cả lớp. Số liệu giả, có nhãn "Minh hoạ" để không bị đọc thành dữ liệu thật.
function HeroMock() {
  const topics = [
    { name: "Phân số cơ bản", pct: 92, tone: "bg-brand-500" },
    { name: "So sánh phân số", pct: 74, tone: "bg-brand-400" },
    { name: "Quy đồng mẫu số", pct: 38, tone: "bg-pink-500" },
  ];
  return (
    <div className="relative mx-auto w-full max-w-md animate-fade-in-up" aria-label="Minh hoạ phản hồi cá nhân hoá">
      <LimeSliceIcon
        className="gs-float pointer-events-none absolute -left-8 -top-10 z-10 hidden h-20 w-20 -rotate-12 drop-shadow-md sm:block"
        aria-hidden
      />
      <WatermelonSliceIcon
        className="gs-float pointer-events-none absolute -bottom-8 -right-6 z-10 hidden h-24 w-24 rotate-12 drop-shadow-md sm:block"
        aria-hidden
      />
      <div
        className="absolute inset-0 -z-10 translate-x-3 translate-y-3 rotate-[5deg] rounded-[2rem] bg-brand-200/70"
        aria-hidden
      />
      <div className="relative rotate-[-2deg] rounded-[2rem] border border-token bg-[rgb(var(--surface))] p-5 shadow-card-hover transition-transform duration-300 hover:rotate-0 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-meta">Bài kiểm tra</p>
            <p className="text-base font-semibold">Phân số — Chương 3</p>
          </div>
          <div className="flex items-center gap-2">
            <span className="chip-success">Đã chấm</span>
            <span className="inline-flex items-center gap-1 rounded-full bg-pink-100 px-2.5 py-0.5 text-xs font-semibold text-pink-700">
              <Sparkles className="h-3 w-3" aria-hidden />
              +20 XP
            </span>
          </div>
        </div>

        <ul className="mt-5 space-y-4">
          {topics.map((t) => (
            <li key={t.name}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{t.name}</span>
                <span className="text-muted">{t.pct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                <div className={`h-full rounded-full ${t.tone}`} style={{ width: `${t.pct}%` }} />
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex items-start gap-3 rounded-2xl rounded-bl-md bg-pink-50 p-3.5 text-sm">
          <Target className="mt-0.5 h-5 w-5 shrink-0 text-pink-600" aria-hidden />
          <p>
            <AiBadge className="mr-1.5 align-[2px]" />
            <span className="font-semibold">Ôn lại “Quy đồng mẫu số”</span>{" "}
            <span className="text-muted">
              trước khi sang bài tiếp. Limio đã mở sẵn bài 3 cho bạn.
            </span>
          </p>
        </div>

        <div className="mt-3 ml-4 flex items-start gap-3 rounded-2xl rounded-br-md bg-brand-50 p-3.5 text-sm">
          <Presentation className="mt-0.5 h-5 w-5 shrink-0 text-brand-700" aria-hidden />
          <p>
            <AiBadge className="mr-1.5 align-[2px]" />
            <span className="font-semibold">Góc nhìn giáo viên:</span>{" "}
            <span className="text-muted">12/30 bạn cùng vướng ở “Quy đồng mẫu số”.</span>
          </p>
        </div>

        <p className="mt-4 text-center text-xs text-faint">Minh hoạ</p>
      </div>

    </div>
  );
}

function Audiences() {
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="h-display text-3xl font-bold sm:text-4xl">
          Dạy và học, mỗi bên một lối đi
        </h2>
        <p className="mt-3 text-muted">
          Cùng một hệ thống, nhưng giáo viên và học viên thấy đúng những gì họ
          cần.
        </p>
      </div>

      <div className="mt-12 grid gap-8 md:grid-cols-2 md:gap-10">
        <AudienceCard
          tone="lime"
          icon={<PenLine className="h-6 w-6" aria-hidden />}
          badge="Dành cho giáo viên"
          title="Soạn bài, mở lớp, thi cử ở một chỗ"
          desc="Xây khoá học theo bài, giao bài tập, tổ chức đợt thi và giảng trực tiếp. AI hỗ trợ gợi ý chấm và chữa bài, giúp bạn biết cả lớp đang vướng ở đâu mà bớt phải chấm tay từng bài."
          bullets={[
            "Khoá học, bài tập và ngân hàng câu hỏi",
            "Đợt thi, ca thi, phòng thi",
            "Limio-Live: dạy học trực tiếp, tương tác",
            "Thống kê chủ đề cả lớp còn yếu",
            "AI hỗ trợ soạn phản hồi và vấn đáp",
          ]}
          cta={{ href: "/register/instructor", label: "Đăng ký tài khoản giáo viên" }}
        />
        <AudienceCard
          tone="pink"
          icon={<GraduationCap className="h-6 w-6" aria-hidden />}
          badge="Dành cho học viên"
          title="Biết mình cần ôn gì tiếp theo"
          desc="Mỗi lần làm bài, Limio chỉ ra chủ đề còn yếu và gợi ý học lại đúng bài, thay vì bắt học lại từ đầu."
          bullets={[
            "Gợi ý bài cần ôn theo mức thành thạo",
            "Phản hồi riêng sau mỗi bài làm",
            "Trợ lý AI hỗ trợ giải đáp khi bí",
            "XP, huy hiệu và đấu trường giữ lửa học",
          ]}
          cta={{ href: "/catalog", label: "Tìm khóa học" }}
        />
      </div>
    </section>
  );
}

function AudienceCard({
  tone,
  icon,
  badge,
  title,
  desc,
  bullets,
  cta,
  className = "",
}: {
  className?: string;
  tone: "lime" | "pink";
  icon: React.ReactNode;
  badge: string;
  title: string;
  desc: string;
  bullets: string[];
  cta: { href: string; label: string };
}) {
  const t =
    tone === "lime"
      ? {
          wrap: "bg-gradient-to-br from-brand-50 to-brand-100/70 border-brand-200",
          blob: "bg-brand-300",
          icon: "bg-brand-500 text-white",
          badge: "text-brand-700",
          check: "text-brand-600",
          link: "text-brand-700 hover:text-brand-800",
        }
      : {
          wrap: "bg-gradient-to-br from-pink-50 to-pink-100/70 border-pink-200",
          blob: "bg-pink-300",
          icon: "bg-pink-500 text-white",
          badge: "text-pink-700",
          check: "text-pink-600",
          link: "text-pink-700 hover:text-pink-800",
        };
  return (
    <div
      className={`group relative flex flex-col overflow-hidden rounded-[2rem] border p-7 transition-transform duration-300 hover:-translate-y-1 sm:p-9 ${
        tone === "lime" ? "hover:-rotate-1" : "hover:rotate-1"
      } ${t.wrap} ${className}`}
    >
      <div
        className={`pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-60 blur-2xl ${t.blob}`}
        aria-hidden
      />
      <span className={`relative flex h-14 w-14 items-center justify-center rounded-[1.25rem] shadow-sm transition-transform group-hover:rotate-6 ${t.icon} ${tone === "lime" ? "-rotate-6" : "rotate-6"}`}>
        {icon}
      </span>
      <p className={`mt-5 text-sm font-semibold uppercase tracking-wide ${t.badge}`}>{badge}</p>
      <h3 className="h-display mt-1 text-2xl font-bold">{title}</h3>
      <p className="mt-3 text-muted">{desc}</p>
      <ul className="mt-6 space-y-2.5 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex items-start gap-2.5">
            <Check className={`mt-0.5 h-4 w-4 shrink-0 ${t.check}`} aria-hidden />
            <span>{b}</span>
          </li>
        ))}
      </ul>
      <Link href={cta.href} className={`mt-8 inline-flex items-center gap-1 text-sm font-semibold ${t.link}`}>
        {cta.label} →
      </Link>
    </div>
  );
}

function HowItWorks() {
  const steps = [
    {
      icon: <PenLine className="h-5 w-5" aria-hidden />,
      title: "Giáo viên dạy",
      desc: "Soạn bài, giao bài tập, mở đợt thi. Mỗi bài học tự thành một chủ đề để theo dõi.",
    },
    {
      icon: <ClipboardCheck className="h-5 w-5" aria-hidden />,
      title: "Học viên làm bài",
      desc: "Học và làm bài theo nhịp của mình, ở bất kỳ đâu.",
    },
    {
      icon: <Target className="h-5 w-5" aria-hidden />,
      title: "Limio chỉ đúng chỗ",
      desc: "Học viên biết cần ôn gì. Giáo viên biết cả lớp vướng ở đâu. AI hỗ trợ phân tích và diễn giải.",
    },
  ];
  return (
    <section className="border-y border-token bg-[rgb(var(--surface-muted))]">
      <div className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="h-display text-3xl font-bold sm:text-4xl">Một nhịp, ba bước</h2>
          <p className="mt-3 text-muted">
            Dạy đúng nhịp ở đầu, học đúng chỗ ở cuối, và phản hồi nối hai đầu lại.
          </p>
        </div>
        <ol className="relative mt-12 grid gap-8 md:grid-cols-3 md:gap-6">
          <svg
            className="absolute left-[16.6%] right-[16.6%] top-2 hidden h-10 w-[66.8%] md:block"
            viewBox="0 0 400 40"
            fill="none"
            preserveAspectRatio="none"
            aria-hidden
          >
            <defs>
              <linearGradient id="how-line" x1="0" x2="1">
                <stop offset="0" stopColor="#84CC16" />
                <stop offset="1" stopColor="#EC4899" />
              </linearGradient>
            </defs>
            <path
              d="M0 24 C 50 4, 100 4, 150 22 S 250 40, 300 20 S 370 6, 400 20"
              stroke="url(#how-line)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray="2 9"
              vectorEffect="non-scaling-stroke"
            />
          </svg>
          {steps.map((s, i) => (
            <li key={s.title} className={`relative text-center ${i === 1 ? "md:mt-8" : ""}`}>
              <span
                className={`relative mx-auto flex h-14 w-14 items-center justify-center rounded-[1.25rem] text-white shadow-md ${
                  i === 0 ? "-rotate-6" : i === 1 ? "rotate-3" : "rotate-6"
                } ${
                  i === 2 ? "bg-pink-500" : i === 1 ? "bg-brand-600" : "bg-brand-500"
                }`}
              >
                {s.icon}
              </span>
              <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-faint">
                Bước {i + 1}
              </p>
              <h3 className="mt-1 text-lg font-semibold">{s.title}</h3>
              <p className="mx-auto mt-2 max-w-xs text-sm text-muted">{s.desc}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// Chỉ hiện gói miễn phí. Gói trả phí chưa công bố nên chưa hiện giá; số hạn mức AI
// cũng chưa chốt nên chỉ ghi có hạn mức, không ghi con số.
function Plans() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-4 pt-16 sm:pt-20">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="h-display text-3xl font-bold sm:text-4xl">Bắt đầu dạy với gói miễn phí</h2>
        <p className="mt-3 text-muted">Đăng ký tài khoản giáo viên, được duyệt là dạy được ngay.</p>
      </div>
      <div className="mx-auto mt-10 max-w-md rounded-3xl border border-brand-200 bg-white p-8 shadow-card-hover">
        <div className="flex items-baseline justify-between">
          <h3 className="text-xl font-bold">Giáo viên</h3>
          <span className="chip-brand">Miễn phí</span>
        </div>
        <ul className="mt-6 space-y-2.5 text-sm">
          {[
            "Khoá học, bài tập và ngân hàng câu hỏi",
            "Đợt thi, ca thi, phòng thi",
            "Thống kê chủ đề cả lớp còn yếu",
          ].map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <span>{b}</span>
            </li>
          ))}
          {["Limio-Live: dạy học trực tiếp", "Vấn đáp AI"].map((b) => (
            <li key={b} className="flex items-start gap-2.5">
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
              <span>
                {b}{" "}
                <span className="ml-1 rounded-full bg-brand-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-brand-800">
                  Trial
                </span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 flex items-start gap-2 rounded-2xl bg-[rgb(var(--surface-muted))] p-3.5 text-sm text-muted">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-brand-600" aria-hidden />
          Tài khoản miễn phí có hạn mức AI token cho các tính năng AI hỗ trợ.
        </p>
        <Link href="/register/instructor" className="btn-primary btn-lg mt-7 w-full">
          Đăng ký tài khoản giáo viên
        </Link>
      </div>
    </section>
  );
}

function Promises() {
  const items = [
    {
      icon: <Sparkles className="h-5 w-5" aria-hidden />,
      t: "Phản hồi từ dữ liệu học thật",
      d: "Gợi ý dựa trên kết quả làm bài, AI chỉ hỗ trợ diễn giải.",
    },
    {
      icon: <Trophy className="h-5 w-5" aria-hidden />,
      t: "Trò chơi hoá có kiểm soát",
      d: "Thưởng cho việc học thật, chống cày điểm.",
    },
    {
      icon: <ShieldCheck className="h-5 w-5" aria-hidden />,
      t: "Dữ liệu của bạn, do bạn quyết",
      d: "Hồ sơ học tập được bảo vệ, có thể xuất hoặc xoá.",
    },
  ];
  return (
    <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
      <div className="grid gap-4 sm:grid-cols-3">
        {items.map((f, i) => (
          <div
            key={f.t}
            className={`card-hover !rounded-3xl transition-transform hover:rotate-0 ${
              i === 0 ? "sm:-rotate-1" : i === 1 ? "sm:mt-4 sm:rotate-1" : "sm:-rotate-1"
            }`}
          >
            <span className={`flex h-11 w-11 items-center justify-center rounded-2xl ${i === 1 ? "bg-pink-100 text-pink-700" : "bg-brand-100 text-brand-700"}`}>
              {f.icon}
            </span>
            <h3 className="mt-4 text-base font-semibold">{f.t}</h3>
            <p className="mt-1 text-sm text-muted">{f.d}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-24">
      <div className="relative overflow-hidden rounded-3xl bg-brand-gradient p-10 text-center text-white shadow-card-hover sm:p-14">
        <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="absolute -bottom-12 -left-8 h-56 w-56 rounded-full bg-accent-400/30 blur-3xl" aria-hidden />
        <LimeSliceIcon
          className="pointer-events-none absolute -left-6 top-6 hidden h-24 w-24 -rotate-12 opacity-90 md:block"
          aria-hidden
        />
        <WatermelonSliceIcon
          className="pointer-events-none absolute -right-4 bottom-4 hidden h-28 w-28 rotate-12 opacity-90 md:block"
          aria-hidden
        />
        <h2 className="relative h-display text-3xl font-bold sm:text-4xl">
          Dạy hay học, bắt đầu từ hôm nay
        </h2>
        <p className="relative mx-auto mt-3 max-w-xl text-white/90">
          Giáo viên tạo khoá học đầu tiên, học viên vào lớp
          đầu tiên, và Limio lo phần còn lại.
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/register"
            className="btn-lg rounded-xl bg-white px-6 py-3 text-sm font-semibold text-brand-700 shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
          >
            Đăng ký ngay
          </Link>
          <Link
            href="/catalog"
            className="btn-lg rounded-xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/20"
          >
            Xem danh mục khoá học
          </Link>
        </div>
      </div>
    </section>
  );
}
