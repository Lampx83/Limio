import "./hskLesson.css";
import { sealParts, splitHanRuns, splitLessonTitle, watermarkChar } from "@/lib/hskLesson";

/**
 * Đầu bài HSK: con dấu chữ Hán của tên bài, tên bài tiếng Việt, mô tả (chữ Hán tô hồng) và chữ Hán mờ ở nền.
 * Tên bài trong sách có dạng "Bài khoá 1 · 课文1": phần Việt làm tiêu đề, phần Hán lên con dấu.
 */
export default function HskHero({ unit, title, description, action, children }: { unit?: string; title: string; description?: string | null; action?: React.ReactNode; children?: React.ReactNode }) {
  const { vi, han } = splitLessonTitle(title);
  const seal = sealParts(han);
  const wm = watermarkChar(han);
  return (
    <div className="hsk-hero" data-wm={wm || undefined}>
      <div className="hsk-hero-row">
        {han && (
          <div className="hsk-seal" aria-hidden lang="zh-Hans" data-long={seal.top.length > 2 ? "true" : undefined}>
            <b>{seal.top}</b>
            {seal.bottom && <i>{seal.bottom}</i>}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {unit && <p className="hsk-kicker">{unit}</p>}
          <h1 className="hsk-title">{vi}</h1>
          {description && (
            <p className="hsk-desc">
              {splitHanRuns(description).map((r, i) =>
                r.han ? (
                  <span key={i} className="hsk-hz" lang="zh-Hans">
                    {r.text}
                  </span>
                ) : (
                  <span key={i}>{r.text}</span>
                ),
              )}
            </p>
          )}
        </div>
        {action}
      </div>
      {children && <div className="hsk-hero-tools">{children}</div>}
    </div>
  );
}
