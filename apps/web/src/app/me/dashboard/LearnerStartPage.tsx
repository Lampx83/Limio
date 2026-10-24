import { BookOpen, KeyRound, PlayCircle } from "lucide-react";
import JoinCodeBox from "@/components/learnerStart/JoinCodeBox";
import StartCourseLink from "@/components/learnerStart/StartCourseLink";
import StartSampleButton from "@/components/learnerStart/StartSampleButton";
import { courseLevelLabel } from "@/lib/courseLabels";
import type { StartCourseCard, StartSample } from "@/lib/learnerStart";

/**
 * Trang Bắt đầu — thay trang tổng quan cho học viên chưa có khoá nào (docs/hoc-vien/trang-dau-hoc-vien-AC.md).
 *
 * Đo prod 23/10/2026: 80% học viên mới tự vào đã đăng nhập rồi bỏ đi mà chưa vào đâu, trong khi ai có lớp thì
 * học ngay trong giờ đầu. Nên trang này chỉ làm một việc: đưa cho học viên một việc cụ thể để làm ngay —
 * nhập mã thầy cô gửi, học thử một bài, hoặc chọn một khoá. Không ô số 0, không bảng xếp hạng, không thẻ trống.
 */
export default function LearnerStartPage({
  name,
  sample,
  courses,
}: {
  name: string;
  sample: StartSample | null;
  courses: StartCourseCard[];
}) {
  const minutes = sample?.firstLesson.durationSec ? Math.max(1, Math.round(sample.firstLesson.durationSec / 60)) : null;

  return (
    <>
      <header>
        <span className="chip-brand">Học viên</span>
        <h1 className="mt-3 h-display text-3xl font-bold sm:text-4xl">
          Xin chào, <span className="text-gradient">{name}</span>
        </h1>
        <p className="mt-2 text-muted">Bắt đầu học trên Limio bằng một trong các cách dưới đây.</p>
      </header>

      {/* Mã từ thầy cô và học thử đứng cạnh nhau từ lg; dưới lg xếp một cột, ô nhập mã ngay sau lời chào. */}
      <div className={`mt-6 grid gap-4 ${sample ? "lg:grid-cols-2" : ""}`}>
        <section className="card" aria-labelledby="start-code-title">
          <div className="flex items-center gap-2">
            <KeyRound aria-hidden className="h-5 w-5 text-brand-600" />
            <h2 id="start-code-title" className="text-h3">
              Có mã từ thầy cô?
            </h2>
          </div>
          <p className="mt-1 text-sm text-muted">Nhập mã để vào lớp, vào thi hay tham gia trò chơi ngay.</p>
          <div className="mt-4">
            <JoinCodeBox />
          </div>
        </section>

        {sample && (
          <section className="card" aria-labelledby="start-sample-title">
            <div className="flex items-center gap-2">
              <PlayCircle aria-hidden className="h-5 w-5 text-brand-600" />
              <h2 id="start-sample-title" className="text-h3">
                Thử học ngay
              </h2>
            </div>
            <p className="mt-1 text-sm text-muted">
              Học một bài ngắn, làm bài kiểm tra và xem Limio phản hồi bài làm của bạn thế nào.
            </p>
            <div className="mt-4 rounded-xl border border-token p-4">
              <p className="text-meta text-faint">{sample.title}</p>
              <p className="mt-1 font-semibold">{sample.firstLesson.title}</p>
              {minutes && <p className="mt-1 text-sm text-muted">Khoảng {minutes} phút</p>}
              <div className="mt-4">
                <StartSampleButton
                  courseId={sample.id}
                  courseSlug={sample.slug}
                  lessonId={sample.firstLesson.id}
                />
              </div>
            </div>
          </section>
        )}
      </div>

      {courses.length > 0 && (
        <section className="mt-8" aria-labelledby="start-courses-title">
          <div className="flex items-center gap-2">
            <BookOpen aria-hidden className="h-5 w-5 text-brand-600" />
            <h2 id="start-courses-title" className="text-h3">
              Khoá đang mở
            </h2>
          </div>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {courses.map((c) => (
              <li key={c.id} className="card flex flex-col">
                <p className="font-semibold leading-snug">{c.title}</p>
                <p className="mt-1 text-sm text-muted">
                  {courseLevelLabel(c.level)} · {c.lessonCount} bài
                </p>
                <div className="mt-auto pt-4">
                  <StartCourseLink
                    href={`/catalog/${c.slug}`}
                    target="catalog_course"
                    courseId={c.id}
                    className="btn-secondary btn-sm"
                  >
                    Xem khoá
                  </StartCourseLink>
                </div>
              </li>
            ))}
          </ul>
          <StartCourseLink href="/catalog" target="catalog_all" className="link mt-4 inline-block text-sm">
            Xem tất cả trong Danh mục khoá học →
          </StartCourseLink>
        </section>
      )}
    </>
  );
}
