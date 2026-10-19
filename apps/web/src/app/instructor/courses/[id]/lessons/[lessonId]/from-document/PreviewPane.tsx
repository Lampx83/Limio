"use client";

import { useEffect, useMemo } from "react";
import {
  LESSON_BOX_LABELS,
  type LessonLook,
  type LessonOutline,
  type OutlineSection,
  type SourcePara,
} from "@feedbackme/shared-types";
import { lessonStyleVars } from "@/lib/lessonLook";
import { LESSON_FONT_VARIABLES } from "@/components/lesson/lessonFonts";
import "@/components/lesson/lessonLook.css";

/** Vạch xám thay cho phần chữ AI sẽ viết ở bước sau. */
function Sk({ w }: { w: number }) {
  return <span className="my-2 block h-2 rounded-full bg-current opacity-10" style={{ width: `${w}%` }} aria-hidden />;
}

function firstImage(s: OutlineSection, paras: SourcePara[]): { img: string; alt: string } | null {
  for (const n of s.paras) {
    const p = paras[n];
    if (p && "img" in p) return p;
  }
  return null;
}

/**
 * Bản xem trước theo dàn ý, vẽ bằng đúng lớp CSS và bảng màu của bài thật
 * (lessonLook.css) — giảng viên thấy hình dạng bài trước khi AI viết. Ý chính
 * hiện thành chữ, phần AI sẽ viết hiện thành vạch xám.
 */
export function OutlinePreview({
  outline,
  paras,
  look,
  activeId,
}: {
  outline: LessonOutline;
  paras: SourcePara[];
  look: LessonLook | null;
  activeId: string | null;
}) {
  useEffect(() => {
    if (!activeId) return;
    document.getElementById(`pv-${activeId}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId]);

  return (
    <div className="space-y-6 px-3 py-5 sm:px-6">
      {outline.lessons.map((lesson, li) => (
        <div key={lesson.id}>
          {outline.lessons.length > 1 && <p className="text-caption mb-2 text-center text-faint">Bài {li + 1}</p>}
          <article
            className={`prose prose-sm mx-auto max-w-3xl rounded-2xl p-5 shadow-sm sm:p-8 ${look ? `lesson-look ${LESSON_FONT_VARIABLES}` : "bg-[rgb(var(--surface))]"}`}
            style={look ? lessonStyleVars(look) : undefined}
            data-palette={look?.palette}
            data-font={look?.font}
          >
            <h1 style={{ marginBottom: "0.8em" }}>{lesson.title || "Bài học chưa có tên"}</h1>
            {lesson.objectives.length > 0 && (
              <div className="lesson-box" data-kind="objectives" data-title={LESSON_BOX_LABELS.objectives}>
                <ul>
                  {lesson.objectives.map((o, i) => (
                    <li key={i}>{o}</li>
                  ))}
                </ul>
              </div>
            )}
            {lesson.sections.map((s) => (
              <SectionPreview key={s.id} s={s} paras={paras} active={s.id === activeId} />
            ))}
            <div className="lesson-box" data-kind="summary" data-title={LESSON_BOX_LABELS.summary}>
              <Sk w={80} />
              <Sk w={60} />
            </div>
          </article>
        </div>
      ))}
      <p className="text-caption text-center text-faint">Bản xem trước theo dàn ý. Vạch xám là phần AI sẽ viết ở bước sau.</p>
    </div>
  );
}

function SectionPreview({ s, paras, active }: { s: OutlineSection; paras: SourcePara[]; active: boolean }) {
  const img = firstImage(s, paras);
  const usesParts = s.layout !== "text" && s.layout !== "image";
  const items = s.points.length ? s.points : ["", ""];
  return (
    <section
      id={`pv-${s.id}`}
      className={`lesson-section scroll-mt-24 rounded-md transition-shadow ${active ? "ring-2 ring-brand-300 ring-offset-8" : ""}`}
      data-layout={s.layout}
    >
      <h2>{s.title || "Mục chưa có tiêu đề"}</h2>
      {s.layout === "image" && (
        <figure className="lesson-figure">
          {img ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={img.img} alt={img.alt} />
          ) : (
            <div className="grid aspect-[4/3] place-items-center rounded-lg text-xs opacity-60" style={{ background: "var(--lk-s)" }}>
              Ảnh của mục
            </div>
          )}
          <figcaption>{img?.alt || "Chú thích ảnh và nguồn."}</figcaption>
        </figure>
      )}
      {!usesParts && (
        <>
          {s.points.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
          <Sk w={92} />
          <Sk w={70} />
        </>
      )}
      {usesParts &&
        items.map((p, i) => (
          <div key={i} className="lesson-part">
            {s.layout === "stats" ? <h3>…</h3> : s.layout === "faq" ? <h3>{p || "Câu hỏi"}</h3> : null}
            {s.layout !== "faq" && (p ? <p>{p}</p> : <Sk w={85} />)}
            <Sk w={60} />
          </div>
        ))}
      {s.boxes.map((k) => (
        <div key={k} className="lesson-box" data-kind={k} data-title={LESSON_BOX_LABELS[k]}>
          <Sk w={80} />
        </div>
      ))}
    </section>
  );
}

/**
 * Tài liệu gốc, đánh số đoạn. Đoạn của mục đang chọn tô xanh; đoạn chưa thuộc
 * mục nào tô vàng, kèm nút gán vào mục hoặc bỏ qua (D4); đoạn đã bỏ qua mờ đi.
 */
export function SourceView({
  paras,
  sourceName,
  outline,
  activeId,
  orphans,
  onAssign,
  onIgnore,
  onRestore,
  readOnly = false,
}: {
  /** Chỉ xem (bước Bài học): đoạn tô vàng là đoạn không thấy trong bài, không có nút sửa. */
  readOnly?: boolean;
  paras: SourcePara[];
  sourceName: string;
  outline: LessonOutline;
  activeId: string | null;
  orphans: number[];
  onAssign: (para: number, sectionId: string) => void;
  onIgnore: (paras: number[]) => void;
  onRestore: (para: number) => void;
}) {
  const owner = useMemo(() => {
    const m = new Map<number, string>();
    for (const l of outline.lessons) for (const s of l.sections) for (const n of s.paras) m.set(n, s.id);
    return m;
  }, [outline]);
  const sections = outline.lessons.flatMap((l, li) =>
    l.sections.map((s, si) => ({ id: s.id, label: `${outline.lessons.length > 1 ? `B${li + 1}.` : ""}${si + 1}. ${s.title || "Mục chưa có tiêu đề"}` })),
  );
  const orphanSet = new Set(orphans);
  const ignored = new Set(outline.ignoredParas);

  useEffect(() => {
    const first = document.querySelector("[data-para-hit='1'], [data-para-orphan='1']");
    first?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeId]);

  return (
    <div className="mx-auto max-w-3xl px-3 py-5 sm:px-6">
      <div className="rounded-2xl bg-[rgb(var(--surface))] p-4 shadow-sm sm:p-6">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <p className="min-w-0 flex-1 truncate font-semibold">{sourceName}</p>
          {orphans.length > 0 && !readOnly && (
            <button type="button" className="btn-secondary btn-sm" onClick={() => onIgnore(orphans)}>
              Bỏ qua {orphans.length} đoạn chưa thuộc mục nào
            </button>
          )}
        </div>
        <p className="text-caption mb-3 text-faint">
          {readOnly
            ? "Đoạn tô vàng là đoạn không thấy đủ trong bài đã viết — hãy đối chiếu trước khi áp dụng."
            : "Đoạn tô xanh thuộc mục đang chọn; đoạn tô vàng chưa thuộc mục nào — gán vào một mục hoặc bỏ qua."}
        </p>
        <ol className="space-y-0.5">
          {paras.map((p, i) => {
            const hit = !!activeId && owner.get(i) === activeId;
            const orphan = orphanSet.has(i);
            const isIgnored = ignored.has(i);
            return (
              <li
                key={i}
                data-para-hit={hit ? "1" : undefined}
                data-para-orphan={orphan && !activeId ? "1" : undefined}
                className={`grid grid-cols-[2.25rem_1fr] gap-2 rounded-lg px-2 py-1.5 text-sm ${
                  hit ? "bg-brand-soft" : orphan ? "bg-amber-50 dark:bg-amber-900/20" : ""
                } ${isIgnored ? "opacity-45" : ""}`}
              >
                <span className="pt-0.5 text-right text-xs tabular-nums text-faint">{i + 1}</span>
                <div className="min-w-0">
                  {"t" in p ? (
                    <p className={isIgnored ? "line-through" : ""}>{p.t}</p>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.img} alt={p.alt} className="max-h-40 rounded-md border border-token" />
                  )}
                  {orphan && !readOnly && (
                    <div className="mt-1 flex flex-wrap items-center gap-2">
                      <select
                        aria-label={`Gán đoạn ${i + 1} vào mục`}
                        defaultValue=""
                        onChange={(e) => e.target.value && onAssign(i, e.target.value)}
                        className="h-7 max-w-[16rem] rounded border border-token bg-[rgb(var(--surface))] px-1 text-xs"
                      >
                        <option value="">Gán vào mục…</option>
                        {sections.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="text-xs font-medium text-muted underline" onClick={() => onIgnore([i])}>
                        Bỏ qua
                      </button>
                    </div>
                  )}
                  {isIgnored && !readOnly && (
                    <button type="button" className="mt-1 text-xs font-medium text-muted underline" onClick={() => onRestore(i)}>
                      Đưa lại vào bài
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
