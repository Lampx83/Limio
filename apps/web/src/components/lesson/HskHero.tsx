import "./hskLesson.css";
import { lessonSubtitle, sealParts, splitHanRuns, splitLessonTitle, watermarkChar } from "@/lib/hskLesson";

/**
 * Đầu bài HSK: con dấu chữ Hán của tên bài, tên bài tiếng Việt, mô tả (chữ Hán tô hồng) và chữ Hán mờ ở nền.
 * Tên bài trong sách có dạng "Bài khoá 1 · 课文1": phần Việt làm tiêu đề, phần Hán lên con dấu.
 */
/** Tên nhóm bài dạng "Bài 1 · 搬进新家 — Dọn về nhà mới" → số, tên Hán, tên Việt (không khớp thì giữ nguyên một chuỗi). */
export function splitUnitTitle(unit: string): { no: string; han: string; vi: string } | null {
  const m = /^(.+?)\s*·\s*(.+)$/.exec(unit.trim());
  if (!m) return null;
  const rest = m[2]!.trim();
  const d = /^(.*?)\s*[—–]\s*(.+)$/.exec(rest);
  if (d) return { no: m[1]!.trim(), han: d[1]!.trim(), vi: d[2]!.trim() };
  return /[㐀-鿿]/.test(rest) ? { no: m[1]!.trim(), han: rest, vi: "" } : { no: m[1]!.trim(), han: "", vi: rest };
}

export default function HskHero({ unit, title, description, action, children }: { unit?: string; title: string; description?: string | null; action?: React.ReactNode; children?: React.ReactNode }) {
  const { vi, han } = splitLessonTitle(title);
  const seal = sealParts(han);
  const wm = watermarkChar(han);
  const unitParts = unit ? splitUnitTitle(unit) : null;
  return (
    <div className="hsk-hero" data-wm={wm || undefined}>
      {unitParts && (
        <p className="hsk-unitbar" aria-label={unit}>
          <span className="hsk-kicker-no">{unitParts.no}</span>
          {unitParts.han && (
            <span className="hsk-kicker-zh" lang="zh-Hans">
              {unitParts.han}
            </span>
          )}
          {unitParts.vi && <span className="hsk-kicker-vi">{unitParts.vi}</span>}
        </p>
      )}
      <div className="hsk-hero-row">
        {han && (
          <div className="hsk-seal" aria-hidden lang="zh-Hans" data-long={seal.top.length > 2 ? "true" : undefined}>
            <b>{seal.top}</b>
            {seal.bottom && <i>{seal.bottom}</i>}
          </div>
        )}
        <div className="min-w-0 flex-1">
          {unit && !splitUnitTitle(unit) && <p className="hsk-kicker">{unit}</p>}
          <h1 className="hsk-title">
            {vi}
            {lessonSubtitle(han) && (
              <span className="hsk-title-sub" lang="zh-Hans">
                {lessonSubtitle(han)}
              </span>
            )}
          </h1>
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
