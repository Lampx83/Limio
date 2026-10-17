"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import {
  LESSON_WRITING_HINTS,
  LESSON_WRITING_LABELS,
  LESSON_WRITING_MODES,
  type LessonLook,
  type LessonOutline,
  type LessonWritingMode,
  type SourcePara,
} from "@feedbackme/shared-types";
import { apiUrl } from "@/lib/apiUrl";
import { orphanParas, outlineProblems } from "@/lib/lessonOutline";
import { assignPara, ignoreParas } from "@/lib/lessonOutlineEdit";
import LessonLookMenu from "@/components/lesson/LessonLookMenu";
import SourceStep from "./SourceStep";
import OutlinePane, { Objectives } from "./OutlinePane";
import { OutlinePreview, SourceView } from "./PreviewPane";

interface Draft {
  id: string;
  sourceName: string;
  sourceKind: string;
  sourceParas: SourcePara[];
  outline: LessonOutline;
  look: LessonLook | null;
  writing: LessonWritingMode;
  addObjectivesSummary: boolean;
  confirmedAt: string | null;
}

type SaveState = "saved" | "dirty" | "saving" | "error";

/**
 * "Tạo bài từ tài liệu": bước 1 Tài liệu → bước 2 Dàn ý (sửa, chốt) → bước 3
 * Bài học (AI viết bài — Mốc 3). Màn hai cột: dàn ý bên trái, xem trước hoặc
 * tài liệu gốc bên phải; điện thoại thì chuyển qua lại bằng hai thẻ.
 */
export default function LessonStudio({
  courseId,
  lessonId,
  lessonTitle,
  initialDraftId,
}: {
  courseId: string;
  lessonId: string;
  lessonTitle: string;
  initialDraftId: string | null;
}) {
  const router = useRouter();
  const [draftId, setDraftId] = useState<string | null>(initialDraftId);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [save, setSave] = useState<SaveState>("saved");
  const backHref = `/instructor/courses/${courseId}?tab=content&lesson=${lessonId}`;

  return (
    // Chiếm trọn phần dưới thanh đầu trang (cao 4rem), không phụ thuộc lề của khung trang
    // giảng viên: mỗi cột tự cuộn, thanh bước và thanh chốt luôn trong tầm mắt.
    <div className="fixed inset-x-0 bottom-0 top-16 z-20 flex flex-col bg-[rgb(var(--bg))]">
      <header className="flex h-14 shrink-0 items-center gap-3 border-b border-token bg-[rgb(var(--surface))] px-3 sm:px-5">
        <Link href={backHref} className="inline-flex min-w-0 items-center gap-1 rounded-lg px-2 py-1 text-sm text-muted hover:bg-[rgb(var(--surface-muted))]">
          <ChevronLeft className="h-4 w-4 shrink-0" aria-hidden />
          <span className="max-w-[12rem] truncate">{lessonTitle}</span>
        </Link>
        <span className="hidden font-semibold md:inline">Tạo bài từ tài liệu</span>
        <Steps step={draftId ? 2 : 1} />
        <span className="ml-auto w-24 text-right text-xs text-faint">
          {draftId && (save === "saving" ? "Đang lưu…" : save === "error" ? <span className="text-danger-600">Chưa lưu được</span> : save === "dirty" ? "" : "Đã lưu")}
        </span>
      </header>

      {draftId ? (
        <Studio
          draftId={draftId}
          warnings={warnings}
          onSave={setSave}
          onRestart={async () => {
            if (!window.confirm("Bỏ dàn ý này và bắt đầu lại với tài liệu khác?")) return;
            await fetch(apiUrl(`/api/lesson-drafts/${draftId}`), { method: "DELETE" });
            setDraftId(null);
            setWarnings([]);
            router.refresh();
          }}
        />
      ) : (
        <div className="flex-1 overflow-y-auto">
        <SourceStep
          lessonId={lessonId}
          onDone={(id, w) => {
            setWarnings(w);
            setDraftId(id);
          }}
        />
        </div>
      )}
    </div>
  );
}

function Steps({ step }: { step: 1 | 2 | 3 }) {
  const items = ["Tài liệu", "Dàn ý", "Bài học"];
  return (
    <ol className="mx-auto hidden items-center gap-1.5 sm:flex" aria-label="Các bước">
      {items.map((label, i) => {
        const n = (i + 1) as 1 | 2 | 3;
        const done = n < step;
        const on = n === step;
        return (
          <li key={label} className="flex items-center gap-1.5">
            {i > 0 && <span className="h-px w-6 bg-[rgb(var(--border))]" aria-hidden />}
            <span
              aria-current={on ? "step" : undefined}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-medium ${
                on ? "bg-[rgb(var(--surface-muted))] text-[rgb(var(--text))]" : done ? "text-brand-700" : "text-faint"
              }`}
            >
              <span
                className={`grid h-5 w-5 place-items-center rounded-full text-[11px] font-bold ${
                  done ? "bg-brand-600 text-white" : on ? "bg-[rgb(var(--text))] text-[rgb(var(--surface))]" : "border border-current"
                }`}
              >
                {done ? <Check className="h-3 w-3" /> : n}
              </span>
              {label}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Studio({
  draftId,
  warnings,
  onSave,
  onRestart,
}: {
  draftId: string;
  warnings: string[];
  onSave: (s: SaveState) => void;
  onRestart: () => void;
}) {
  const url = apiUrl(`/api/lesson-drafts/${draftId}`);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [tab, setTab] = useState<"preview" | "source">("preview");
  const [mobilePane, setMobilePane] = useState<"outline" | "preview">("outline");
  const [reviewed, setReviewed] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [confirmErr, setConfirmErr] = useState<string[] | null>(null);
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Draft;
      })
      .then((d) => alive && setDraft(d))
      .catch(() => alive && setLoadErr("Không mở được bản nháp. Hãy tải lại trang."));
    return () => {
      alive = false;
    };
  }, [url]);

  const flush = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const body = pending.current;
    if (Object.keys(body).length === 0) return true;
    pending.current = {};
    onSave("saving");
    try {
      const r = await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error(String(r.status));
      onSave("saved");
      return true;
    } catch {
      // Giữ lại để lần sau gửi kèm — không mất thay đổi vì một lần lỗi mạng.
      pending.current = { ...body, ...pending.current };
      onSave("error");
      return false;
    }
  }, [onSave, url]);

  /** Sửa tại chỗ: cập nhật ngay trên màn hình, gửi lên sau 800 ms không gõ. */
  const patch = useCallback(
    (p: Partial<Pick<Draft, "outline" | "look" | "writing" | "addObjectivesSummary">>) => {
      setDraft((d) => {
        if (!d) return d;
        const contentChange = p.outline !== undefined || p.writing !== undefined || p.addObjectivesSummary !== undefined;
        return { ...d, ...p, confirmedAt: contentChange ? null : d.confirmedAt };
      });
      if (p.outline !== undefined || p.writing !== undefined || p.addObjectivesSummary !== undefined) setReviewed(false);
      pending.current = { ...pending.current, ...p };
      onSave("dirty");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flush(), 800);
    },
    [flush, onSave],
  );

  useEffect(() => {
    const beforeUnload = (e: BeforeUnloadEvent) => {
      if (Object.keys(pending.current).length) {
        void flush();
        e.preventDefault();
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [flush]);

  const orphans = useMemo(() => (draft ? orphanParas(draft.outline, draft.sourceParas) : []), [draft]);
  const problems = useMemo(() => (draft ? outlineProblems(draft.outline, draft.sourceParas) : []), [draft]);

  if (loadErr) return <p className="banner-danger m-6">{loadErr}</p>;
  if (!draft) {
    return (
      <div className="grid flex-1 place-items-center text-sm text-muted">
        <Loader2 className="h-5 w-5 animate-spin" aria-label="Đang tải dàn ý" />
      </div>
    );
  }

  const outline = draft.outline;
  const first = outline.lessons[0]!;
  const sectionCount = outline.lessons.reduce((n, l) => n + l.sections.length, 0);
  const assignedWords = outline.lessons.reduce(
    (n, l) =>
      n +
      l.sections.reduce((m, s) => m + s.paras.reduce((k, i) => {
        const p = draft.sourceParas[i];
        return k + (p && "t" in p ? p.t.split(/\s+/).length : 0);
      }, 0), 0),
    0,
  );
  // Ước lượng thô để giảng viên có khái niệm trước khi tạo bài (đọc vào + viết ra).
  const tokenEstimate = Math.max(2000, Math.round((assignedWords * 3.2 + sectionCount * 500) / 500) * 500);

  async function confirm() {
    setConfirming(true);
    setConfirmErr(null);
    pending.current = { ...pending.current, confirm: true };
    if (timer.current) clearTimeout(timer.current);
    const body = pending.current;
    pending.current = {};
    try {
      const r = await fetch(url, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const d = (await r.json().catch(() => ({}))) as { confirmedAt?: string; problems?: string[] };
      if (!r.ok) {
        setConfirmErr(d.problems ?? ["Chưa chốt được dàn ý. Vui lòng thử lại."]);
        return;
      }
      setDraft((x) => (x ? { ...x, confirmedAt: d.confirmedAt ?? new Date().toISOString() } : x));
    } finally {
      setConfirming(false);
    }
  }

  const showSource = (sectionId: string | null) => {
    setActiveId(sectionId);
    setTab("source");
    setMobilePane("preview");
  };

  return (
    <>
      {/* Điện thoại: chuyển giữa dàn ý và xem trước. */}
      <div className="flex shrink-0 gap-1 border-b border-token bg-[rgb(var(--surface))] p-1.5 lg:hidden">
        {(["outline", "preview"] as const).map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMobilePane(p)}
            className={`flex-1 rounded-lg py-1.5 text-sm font-semibold ${mobilePane === p ? "bg-[rgb(var(--surface-muted))]" : "text-muted"}`}
          >
            {p === "outline" ? "Dàn ý" : "Xem trước"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(24rem,46fr)_54fr]">
        {/* ---------- Cột trái: dàn ý ---------- */}
        <section className={`flex min-h-0 flex-col border-token bg-[rgb(var(--surface))] lg:border-r ${mobilePane === "outline" ? "" : "hidden lg:flex"}`}>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
            <div>
              <input
                value={first.title}
                onChange={(e) =>
                  patch({ outline: { ...outline, lessons: outline.lessons.map((l, i) => (i === 0 ? { ...l, title: e.target.value } : l)) } })
                }
                placeholder="Tên bài học"
                aria-label="Tên bài học"
                className="w-full rounded-lg border border-transparent bg-transparent px-1.5 py-1 text-xl font-bold tracking-tight hover:bg-[rgb(var(--surface-muted))] focus:border-brand-300 focus:bg-[rgb(var(--surface))] focus:outline-none"
              />
              <p className="mt-0.5 px-1.5 text-xs text-faint">
                <b className="font-semibold text-muted">{sectionCount}</b> mục
                {outline.lessons.length > 1 && (
                  <>
                    {" "}
                    trong <b className="font-semibold text-muted">{outline.lessons.length}</b> bài
                  </>
                )}{" "}
                · từ <b className="font-semibold text-muted">{draft.sourceParas.length}</b> đoạn của {draft.sourceName}
              </p>
            </div>

            {warnings.length > 0 && (
              <ul className="banner-info space-y-0.5 text-xs">
                {warnings.map((w, i) => (
                  <li key={i}>{w}</li>
                ))}
              </ul>
            )}

            <Objectives
              objectives={first.objectives}
              onChange={(objectives) =>
                patch({ outline: { ...outline, lessons: outline.lessons.map((l, i) => (i === 0 ? { ...l, objectives } : l)) } })
              }
            />

            <OutlinePane
              outline={outline}
              paras={draft.sourceParas}
              orphans={orphans}
              activeId={activeId}
              onChange={(o) => patch({ outline: o })}
              onActivate={setActiveId}
              onShowSource={showSource}
            />

            <button type="button" onClick={onRestart} className="text-xs text-faint underline hover:text-[rgb(var(--text))]">
              Dùng tài liệu khác
            </button>
          </div>

          {/* ---------- Thanh chốt ---------- */}
          {/* Chừa lề trái cho nút menu tròn của trang giảng viên (góc dưới trái). */}
          <div className="shrink-0 space-y-2.5 border-t border-token bg-[rgb(var(--surface))] py-3 pl-16 pr-4 sm:pr-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg bg-[rgb(var(--surface-muted))] p-0.5" role="radiogroup" aria-label="Cách viết">
                {LESSON_WRITING_MODES.map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="radio"
                    aria-checked={draft.writing === m}
                    onClick={() => patch({ writing: m })}
                    className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                      draft.writing === m ? "bg-[rgb(var(--surface))] text-[rgb(var(--text))] shadow-sm" : "text-muted"
                    }`}
                  >
                    {LESSON_WRITING_LABELS[m]}
                  </button>
                ))}
              </div>
              <span className="hidden text-xs text-faint sm:inline">{LESSON_WRITING_HINTS[draft.writing]}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
              <label className="inline-flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={draft.addObjectivesSummary}
                  onChange={(e) => patch({ addObjectivesSummary: e.target.checked })}
                  className="h-4 w-4 accent-[rgb(101,163,13)]"
                />
                Thêm Mục tiêu và Tổng kết
              </label>
              <span className="text-faint">Dự kiến khoảng {tokenEstimate.toLocaleString("vi-VN")} token khi tạo bài</span>
            </div>
            {(confirmErr ?? (reviewed && problems.length ? problems : null))?.map((p, i) => (
              <p key={i} className="text-xs text-amber-700 dark:text-amber-300">
                {p}
              </p>
            ))}
            {draft.confirmedAt ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                  <Check className="h-4 w-4" aria-hidden /> Đã chốt dàn ý
                </span>
                <button type="button" disabled className="btn-primary ml-auto" title="Bước AI viết bài có ở bản tiếp theo">
                  Tạo bài
                </button>
              </div>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm">
                  <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} className="h-4 w-4 accent-[rgb(101,163,13)]" />
                  Tôi đã xem dàn ý
                </label>
                <button
                  type="button"
                  onClick={confirm}
                  disabled={!reviewed || problems.length > 0 || confirming}
                  className="btn-primary ml-auto"
                  title={problems.length ? problems.join(" ") : undefined}
                >
                  {confirming && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  Chốt dàn ý
                </button>
              </div>
            )}
          </div>
        </section>

        {/* ---------- Cột phải: xem trước / tài liệu gốc ---------- */}
        <section className={`flex min-h-0 flex-col ${mobilePane === "preview" ? "" : "hidden lg:flex"}`}>
          <div className="relative flex items-center gap-1 border-b border-token bg-[rgb(var(--bg))] px-3 py-2 sm:px-5">
            {(["preview", "source"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold sm:px-3 ${
                  tab === t ? "bg-[rgb(var(--surface))] shadow-sm ring-1 ring-[rgb(var(--border))]" : "text-muted"
                }`}
              >
                {t === "preview" ? "Xem trước" : "Tài liệu gốc"}
                {t === "source" && orphans.length > 0 && (
                  <span className="ml-1.5 rounded-full bg-amber-100 px-1.5 text-[11px] text-amber-800">{orphans.length}</span>
                )}
              </button>
            ))}
            <div className="ml-auto">
              <LessonLookMenu value={draft.look} onChange={(look) => patch({ look })} />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {tab === "preview" ? (
              <OutlinePreview outline={outline} paras={draft.sourceParas} look={draft.look} activeId={activeId} />
            ) : (
              <SourceView
                paras={draft.sourceParas}
                sourceName={draft.sourceName}
                outline={outline}
                activeId={activeId}
                orphans={orphans}
                onAssign={(para, sectionId) => patch({ outline: assignPara(outline, para, sectionId) })}
                onIgnore={(ps) => patch({ outline: ignoreParas(outline, ps) })}
                onRestore={(para) => patch({ outline: { ...outline, ignoredParas: outline.ignoredParas.filter((n) => n !== para) } })}
              />
            )}
          </div>
        </section>
      </div>
    </>
  );
}
