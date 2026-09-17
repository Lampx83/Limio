import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleName } from "@feedbackme/shared-types";
import { auth } from "@/lib/auth";
import { LimeSliceIcon, WatermelonSliceIcon } from "@/components/BrandIcons";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  // Logged-in users → role-appropriate dashboard. Default ưu tiên Instructor
  // (đa số task hằng ngày là dạy học), Admin chỉ là landing khi user thuần
  // admin — admin kiêm instructor sẽ vào /instructor/dashboard và tự nav sang
  // /admin/dashboard khi cần. Learner > Instructor > Admin fallback chain.
  const session = await auth();
  if (session?.user?.id) {
    const roles = session.user.roles ?? [];
    if (roles.includes(RoleName.Instructor)) redirect("/instructor/dashboard");
    if (roles.includes(RoleName.Admin)) redirect("/admin/dashboard");
    redirect("/me/dashboard");
  }

  return <LandingPage />;
}

function LandingPage() {
  return (
    <main>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="absolute inset-0 -z-10 bg-hero-grid opacity-60"
          style={{ backgroundSize: "24px 24px" }}
          aria-hidden
        />
        <div className="absolute inset-x-0 -top-32 -z-10 mx-auto h-96 max-w-3xl rounded-full bg-brand-gradient-soft blur-3xl opacity-70" aria-hidden />

        {/* Floating fruit decorations — only visible on larger screens */}
        <LimeSliceIcon
          className="pointer-events-none absolute left-6 top-24 hidden h-24 w-24 -rotate-12 opacity-90 drop-shadow-xl md:block lg:left-16 lg:h-32 lg:w-32"
          aria-hidden
        />
        <WatermelonSliceIcon
          className="pointer-events-none absolute right-6 top-32 hidden h-28 w-28 rotate-12 opacity-90 drop-shadow-xl md:block lg:right-16 lg:h-36 lg:w-36"
          aria-hidden
        />

        <div className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28 sm:pb-24">
          <div className="mx-auto max-w-3xl text-center animate-fade-in-up">
            <span className="chip-brand mb-5">
              <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />
              Limio · Learn your way
            </span>
            <h1 className="h-display text-4xl font-bold leading-tight sm:text-6xl">
              Học{" "}
              <span className="text-gradient">theo cách của bạn</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-muted">
              Limio biến kiến thức thành sơ đồ kỹ năng, theo dõi mức độ thành
              thạo của từng người học và đưa ra phản hồi đúng lúc — cùng trò
              chơi hoá (gamification) giữ lửa học mỗi ngày. Tươi như chanh.
            </p>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link href="/catalog" className="btn-primary btn-lg">
                Khám phá khóa học →
              </Link>
              <Link href="/register" className="btn-secondary btn-lg">
                Tạo tài khoản miễn phí
              </Link>
            </div>
          </div>

          {/* Stats strip */}
          <div className="mx-auto mt-16 grid max-w-3xl grid-cols-3 gap-3 sm:gap-6">
            {[
              { k: "3", v: "Module song song" },
              { k: "100%", v: "Event-sourced" },
              { k: "AI", v: "Tutor + Feedback" },
            ].map((s) => (
              <div key={s.v} className="card text-center">
                <div className="h-display text-2xl font-bold text-brand-600 sm:text-3xl">
                  {s.k}
                </div>
                <div className="mt-1 text-xs text-muted sm:text-sm">{s.v}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Three pillars */}
      <section className="mx-auto max-w-6xl px-6 py-16 sm:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="h-display text-3xl font-bold sm:text-4xl">
            Ba module, một trải nghiệm
          </h2>
          <p className="mt-3 text-muted">
            LMS Core, Feedback Engine, Gamification — kết nối qua tag chủ đề
            và dòng sự kiện (event stream), không coupling chặt.
          </p>
        </div>

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          <Pillar
            tone="brand"
            badge="LMS Core"
            title="Khóa học có cấu trúc"
            desc="Module → Lesson → Quiz → Assignment. Hỗ trợ video, SCORM, H5P, LTI 1.3 từ Phase 0."
            bullets={["Course versioning", "Forum & discussion", "Certificate"]}
          />
          <Pillar
            tone="accent"
            badge="Feedback Engine"
            title="Hiểu từng learner"
            desc="BKT learner model + tag chủ đề cho biết bạn yếu chỗ nào, gợi ý lộ trình adaptive."
            bullets={[
              "Bayesian Knowledge Tracing",
              "Misconception detection",
              "AI tutor chat",
            ]}
          />
          <Pillar
            tone="success"
            badge="Gamification"
            title="Học là cuộc chơi"
            desc="XP, level, streak, badge, quest và tournament — anti-farming bằng adaptive reward sizing."
            bullets={["XP & level", "Skill badge", "Leaderboard & tournament"]}
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-2xl bg-brand-gradient p-10 text-center text-white shadow-card-hover sm:p-14">
          <div className="absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
          <div className="absolute -bottom-12 -left-8 h-56 w-56 rounded-full bg-accent-400/30 blur-3xl" aria-hidden />
          <h2 className="relative h-display text-3xl font-bold sm:text-4xl">
            Bắt đầu hành trình học tập hôm nay
          </h2>
          <p className="relative mx-auto mt-3 max-w-xl text-white/85">
            Đăng ký miễn phí, enroll khóa đầu tiên, và để Limio chỉ cho bạn
            chính xác cần học gì tiếp theo.
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
              className="btn-lg rounded-xl border border-white/30 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur transition-all hover:bg-white/20"
            >
              Xem catalog
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function Pillar({
  tone,
  badge,
  title,
  desc,
  bullets,
}: {
  tone: "brand" | "accent" | "success";
  badge: string;
  title: string;
  desc: string;
  bullets: string[];
}) {
  const toneMap = {
    brand: {
      chip: "chip-brand",
      ring: "from-brand-500/20 to-brand-500/0",
      dot: "bg-brand-500",
    },
    accent: {
      chip: "chip-accent",
      ring: "from-accent-400/20 to-accent-400/0",
      dot: "bg-accent-500",
    },
    success: {
      chip: "chip-success",
      ring: "from-success-500/20 to-success-500/0",
      dot: "bg-success-500",
    },
  } as const;
  const t = toneMap[tone];
  return (
    <div className="card-hover relative overflow-hidden">
      <div
        className={`absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${t.ring} blur-2xl`}
        aria-hidden
      />
      <span className={t.chip}>{badge}</span>
      <h3 className="mt-4 text-lg font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted">{desc}</p>
      <ul className="mt-4 space-y-1.5 text-sm">
        {bullets.map((b) => (
          <li key={b} className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${t.dot}`} />
            <span className="text-muted">{b}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
