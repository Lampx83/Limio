"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronLeft, Loader2 } from "lucide-react";
import {
  LESSON_TEMPLATE_LABELS,
  LESSON_WRITING_HINTS,
  LESSON_WRITING_LABELS,
  LESSON_WRITING_MODES,
  type LessonDraftResult,
  type LessonLook,
  type LessonOutline,
  type LessonTemplateKey,
  type LessonWritingMode,
  type SourcePara,
} from "@feedbackme/shared-types";
import { apiUrl } from "@/lib/apiUrl";
import { orphanParas, outlineProblems } from "@/lib/lessonOutline";
import { assignPara, ignoreParas } from "@/lib/lessonOutlineEdit";
import LessonLookMenu from "@/components/lesson/LessonLookMenu";
import SourceStep from "./SourceStep";
import OutlinePane, { Objectives } from "./OutlinePane";
import TemplatePicker from "./TemplatePicker";
import { OutlinePreview, SourceView } from "./PreviewPane";
import { GenerationView, ResultView, type GenStep } from "./ResultPane";
import DirectPane from "./DirectPane";

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
  result: LessonDraftResult | null;
  /** "Làm lại từ dàn ý": Áp dụng sẽ THAY nội dung khối này. */
  targetContentItemId: string | null;
}

type Phase = "outline" | "generating" | "result";

const GEN_ERRORS: Record<string, string> = {
  no_token_budget: "Bạn đã dùng hết hạn mức AI. Chưa có bài nào được tạo; dàn ý vẫn được giữ.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Vui lòng thử lại sau.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
  outline_not_confirmed: "Dàn ý chưa được chốt.",
};

const REOUTLINE_ERRORS: Record<string, string> = {
  no_token_budget: "Bạn đã dùng hết hạn mức AI. Dàn ý cũ vẫn được giữ.",
  global_token_cap: "Hệ thống AI đang quá tải hôm nay. Dàn ý cũ vẫn được giữ.",
  openai_not_configured: "Hệ thống AI chưa được cấu hình. Vui lòng báo quản trị viên.",
};

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
  const [step, setStep] = useState<2 | 3>(2);
  const [direct, setDirect] = useState(false);
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
        <Steps step={draftId ? step : 1} direct={direct} />
        <span className="ml-auto w-24 text-right text-xs text-faint">
          {draftId && (save === "saving" ? "Đang lưu…" : save === "error" ? <span className="text-danger-600">Chưa lưu được</span> : save === "dirty" ? "" : "Đã lưu")}
        </span>
      </header>

      {draftId ? (
        <Studio
          draftId={draftId}
          warnings={warnings}
          onSave={setSave}
          onStep={setStep}
          onDirect={setDirect}
          onApplied={() => router.push(backHref)}
          onRestart={async () => {
            if (!window.confirm("Bỏ dàn ý này và bắt đầu lại với tài liệu khác?")) return;
            await fetch(apiUrl(`/api/lesson-drafts/${draftId}`), { method: "DELETE" });
            setDraftId(null);
            setDirect(false);
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

function Steps({ step, direct }: { step: 1 | 2 | 3; direct: boolean }) {
  // Tệp giữ nguyên định dạng không có bước dàn ý: Tài liệu → Xem trước.
  const items = direct ? ["Tài liệu", "Xem trước"] : ["Tài liệu", "Dàn ý", "Bài học"];
  return (
    <ol className="mx-auto hidden items-center gap-1.5 sm:flex" aria-label="Các bước">
      {items.map((label, i) => {
        const n = (direct && i === 1 ? 3 : i + 1) as 1 | 2 | 3;
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
  onStep,
  onDirect,
  onApplied,
  onRestart,
}: {
  draftId: string;
  warnings: string[];
  onSave: (s: SaveState) => void;
  onStep: (s: 2 | 3) => void;
  onDirect: (b: boolean) => void;
  onApplied: () => void;
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
  const [phase, setPhase] = useState<Phase>("outline");
  const [genSteps, setGenSteps] = useState<GenStep[]>([]);
  const [genTotal, setGenTotal] = useState(0);
  const [genErr, setGenErr] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const pending = useRef<Record<string, unknown>>({});
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        return (await r.json()) as Draft;
      })
      .then((d) => {
        if (!alive) return;
        setDraft(d);
        onDirect(!!d.outline.keepFormat);
        if (d.confirmedAt && d.result) setPhase("result");
      })
      .catch(() => alive && setLoadErr("Không mở được bản nháp. Hãy tải lại trang."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        return { ...d, ...p, confirmedAt: contentChange ? null : d.confirmedAt, result: contentChange ? null : d.result };
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

  useEffect(() => onStep(phase === "outline" ? 2 : 3), [phase, onStep]);

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

  if (draft.outline.keepFormat && draft.result) {
    return (
      <DirectPane
        draftId={draftId}
        sourceName={draft.sourceName}
        result={draft.result}
        look={draft.look}
        onLook={(look) => patch({ look })}
        onHtml={(html) =>
          setDraft((x) =>
            x && x.result ? { ...x, result: { ...x.result, lessons: [{ ...x.result.lessons[0]!, html }, ...x.result.lessons.slice(1)] } } : x,
          )
        }
        onApply={apply}
        applying={applying}
        error={genErr}
        onRestart={onRestart}
      />
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

  async function generate() {
    if (!(await flush())) return;
    setGenErr(null);
    setGenSteps([]);
    setGenTotal(0);
    setPhase("generating");
    setMobilePane("preview");
    try {
      const res = await fetch(apiUrl(`/api/lesson-drafts/${draftId}/generate`), { method: "POST" });
      if (!res.ok || !res.body) {
        const d = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(d.error ?? `http_${res.status}`);
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          const ev = JSON.parse(line) as { type: string; total?: number; label?: string; ok?: boolean; result?: LessonDraftResult; error?: string };
          if (ev.type === "start") setGenTotal(ev.total ?? 0);
          if (ev.type === "progress") setGenSteps((xs) => [...xs, { label: ev.label ?? "", ok: !!ev.ok }]);
          if (ev.type === "error") throw new Error(ev.error ?? "generate_failed");
          if (ev.type === "done" && ev.result) {
            const result = ev.result;
            setDraft((x) => (x ? { ...x, result } : x));
            setTab("preview");
            setPhase("result");
            return;
          }
        }
      }
      throw new Error("generate_failed");
    } catch (e) {
      const code = e instanceof Error ? e.message : String(e);
      setGenErr(GEN_ERRORS[code] ?? "AI chưa viết xong bài. Vui lòng thử lại sau ít phút.");
      setPhase(draft?.result ? "result" : "outline");
    }
  }

  async function apply() {
    setApplying(true);
    setGenErr(null);
    try {
      const r = await fetch(apiUrl(`/api/lesson-drafts/${draftId}/apply`), { method: "POST" });
      if (!r.ok) throw new Error(String(r.status));
      onApplied();
    } catch {
      setGenErr("Chưa áp dụng được. Vui lòng thử lại.");
      setApplying(false);
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
          <div
            className={`flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5 ${phase === "outline" ? "" : "pointer-events-none select-none opacity-55"}`}
            aria-disabled={phase !== "outline"}
          >
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

            <TemplateBar
              template={outline.template ?? "theory"}
              onReoutline={async (template) => {
                // Lưu cách viết, giao diện đang chờ; phần dàn ý sắp bị thay nên không cần.
                await flush();
                const res = await fetch(`${url}/reoutline`, {
                  method: "POST",
                  headers: { "content-type": "application/json" },
                  body: JSON.stringify({ template }),
                });
                await readNdjson(res);
                const r = await fetch(url);
                if (!r.ok) throw new Error("reload_failed");
                const d = (await r.json()) as Draft;
                setDraft(d);
                setActiveId(null);
                setReviewed(false);
                setConfirmErr(null);
              }}
            />

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
            {genErr && <p className="text-xs text-danger-600">{genErr}</p>}
            {draft.confirmedAt && phase === "result" ? (
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" className="btn-ghost btn-sm" onClick={() => setPhase("outline")}>
                  Quay lại dàn ý
                </button>
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => {
                    if (window.confirm(`Tạo lại toàn bộ bài? Lượt này dùng thêm khoảng ${tokenEstimate.toLocaleString("vi-VN")} token.`)) void generate();
                  }}
                >
                  Tạo lại
                </button>
                <button type="button" onClick={apply} disabled={applying} className="btn-primary ml-auto">
                  {applying && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {draft.targetContentItemId
                    ? "Áp dụng (thay nội dung bài)"
                    : outline.lessons.length > 1
                      ? `Áp dụng ${outline.lessons.length} bài học`
                      : "Áp dụng vào bài học"}
                </button>
              </div>
            ) : draft.confirmedAt ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-brand-700">
                  <Check className="h-4 w-4" aria-hidden /> Đã chốt dàn ý
                </span>
                {draft.result && phase === "outline" && (
                  <button type="button" className="text-xs font-medium text-brand-700 underline" onClick={() => setPhase("result")}>
                    Xem bài đã tạo
                  </button>
                )}
                <button type="button" onClick={generate} disabled={phase === "generating"} className="btn-primary ml-auto">
                  {phase === "generating" && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
                  {phase === "generating" ? "Đang viết bài…" : draft.result ? "Tạo lại bài" : "Tạo bài"}
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
            {(phase === "generating" ? ([] as const) : (["preview", "source"] as const)).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={`whitespace-nowrap rounded-lg px-2.5 py-1.5 text-sm font-semibold sm:px-3 ${
                  tab === t ? "bg-[rgb(var(--surface))] shadow-sm ring-1 ring-[rgb(var(--border))]" : "text-muted"
                }`}
              >
                {t === "preview" ? (phase === "result" ? "Bài học" : "Xem trước") : "Tài liệu gốc"}
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
            {phase === "generating" ? (
              <GenerationView steps={genSteps} total={genTotal} writing={LESSON_WRITING_LABELS[draft.writing]} />
            ) : phase === "result" && draft.result && tab === "preview" ? (
              <ResultView result={draft.result} look={draft.look} onShowParas={() => setTab("source")} />
            ) : phase === "result" && draft.result ? (
              <SourceView
                paras={draft.sourceParas}
                sourceName={draft.sourceName}
                outline={outline}
                activeId={null}
                orphans={draft.result.missingParas}
                readOnly
                onAssign={() => {}}
                onIgnore={() => {}}
                onRestore={() => {}}
              />
            ) : tab === "preview" ? (
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

/** Đọc luồng NDJSON tới sự kiện cuối; ném lỗi với mã lỗi của máy chủ. */
async function readNdjson(res: Response): Promise<void> {
  if (!res.ok || !res.body) {
    const d = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(d.error ?? `http_${res.status}`);
  }
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let nl: number;
    while ((nl = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, nl).trim();
      buf = buf.slice(nl + 1);
      if (!line) continue;
      const ev = JSON.parse(line) as { type: string; error?: string };
      if (ev.type === "error") throw new Error(ev.error ?? "generate_failed");
      if (ev.type === "done") return;
    }
  }
  throw new Error("generate_failed");
}

/**
 * Mẫu bài đang dùng, và đổi mẫu: AI lập lại dàn ý từ chính tài liệu đã tải
 * (không phải tải lại). Hỏi lại trước vì dàn ý đang sửa sẽ bị thay.
 */
function TemplateBar({
  template,
  onReoutline,
}: {
  template: LessonTemplateKey;
  onReoutline: (t: LessonTemplateKey) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<LessonTemplateKey>(template);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (!open) {
    return (
      <p className="flex items-center gap-2 px-1.5 text-xs text-muted">
        Mẫu bài: <b className="font-semibold text-[rgb(var(--text))]">{LESSON_TEMPLATE_LABELS[template]}</b>
        <button
          type="button"
          onClick={() => {
            setPick(template);
            setErr(null);
            setOpen(true);
          }}
          className="font-semibold text-brand-700 hover:underline"
        >
          Đổi mẫu
        </button>
      </p>
    );
  }

  return (
    <div className="space-y-2.5 rounded-xl border border-token bg-[rgb(var(--surface-muted))] p-3">
      <TemplatePicker value={pick} onChange={setPick} disabled={busy} compact />
      <p className="text-xs text-muted">
        AI sẽ đọc lại tài liệu và lập dàn ý mới theo mẫu đã chọn. Những gì bạn đã sửa trên dàn ý hiện tại sẽ được thay
        bằng dàn ý mới.
      </p>
      {err && <p className="text-xs text-danger-600">{err}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn-ghost text-sm">
          Huỷ
        </button>
        <button
          type="button"
          disabled={busy || pick === template}
          onClick={async () => {
            setBusy(true);
            setErr(null);
            try {
              await onReoutline(pick);
              setOpen(false);
            } catch (e) {
              const code = e instanceof Error ? e.message : String(e);
              setErr(REOUTLINE_ERRORS[code] ?? "AI chưa lập lại được dàn ý. Dàn ý cũ vẫn được giữ; vui lòng thử lại sau.");
            } finally {
              setBusy(false);
            }
          }}
          className="btn-primary inline-flex items-center gap-2 text-sm"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
          {busy ? "Đang lập lại dàn ý…" : "Lập lại dàn ý"}
        </button>
      </div>
    </div>
  );
}
