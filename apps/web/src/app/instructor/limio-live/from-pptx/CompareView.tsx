"use client";

// Bước 3 của luồng nhập PowerPoint: đối chiếu slide gốc với dàn ý mới (tiêu chí P28–P31). Bấm một bên thì tô sáng bên kia;
// khung chi tiết dính đáy màn hình nói rõ ghi chú giảng được giữ thế nào. Bản mẫu: docs/mockup/nhap-powerpoint.html.

import { useEffect, useMemo, useState } from "react";
import { originLabel, partLabel, listVi, type Outline, type OutlineSlide } from "@/lib/limioLiveOutline";
import { OUTLINE_KIND_LABEL, OUTLINE_LAYOUT_UI, glyphKey } from "@/lib/limioLiveOutlineUi";
import { coverage, notesPlan, rowsUsingSlide, type ImportedSlide } from "@/lib/limioLivePptx";
import OutlineGlyph from "../[deckId]/outline/OutlineGlyph";

type Sel = { type: "row"; id: string } | { type: "orig"; n: number } | null;

const FLAG_LABEL: Record<string, string> = {
  smartart: "SmartArt",
  shapes: "sơ đồ hình khối",
  equation: "công thức",
  media: "video",
  object: "đối tượng nhúng",
  image_unsupported: "hình vẽ",
};

function origMeta(s: ImportedSlide): string {
  const ideas = s.paragraphs.filter((p) => p.level === 0).length + s.smartArt.filter((p) => p.level === 0).length;
  return [
    ideas ? `${ideas} ý` : "",
    s.tables.length ? "bảng" : "",
    s.charts.length ? "biểu đồ" : "",
    s.notes.trim() ? "có ghi chú" : "",
    s.imageCount ? `${s.imageCount} hình` : "",
    s.hidden ? "đang ẩn" : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function rowKindLabel(s: OutlineSlide): string {
  return s.kind === "content" ? OUTLINE_LAYOUT_UI[s.layout ?? "image"].label : OUTLINE_KIND_LABEL[s.kind];
}

export default function CompareView(props: {
  slides: ImportedSlide[];
  outline: Outline;
  mode: "keep" | "restructure";
  onAddBack: (n: number) => void;
  busy: boolean;
}) {
  const { slides, outline, mode } = props;
  const [sel, setSel] = useState<Sel>(null);
  const [view, setView] = useState<"orig" | "new">("new");
  useEffect(() => setSel(null), [outline]);

  const { used, unused } = useMemo(() => coverage(outline, slides.length), [outline, slides.length]);
  const byN = useMemo(() => new Map(slides.map((s) => [s.n, s])), [slides]);
  const groups = useMemo(() => {
    const out: Array<{ partId: string; rows: Array<{ s: OutlineSlide; no: number }> }> = [];
    outline.slides.forEach((s, i) => {
      const last = out[out.length - 1];
      if (last && last.partId === s.partId) last.rows.push({ s, no: i + 1 });
      else out.push({ partId: s.partId ?? "", rows: [{ s, no: i + 1 }] });
    });
    return out;
  }, [outline]);

  const litRows = new Set<string>();
  const litOrig = new Set<number>();
  if (sel?.type === "row") {
    litRows.add(sel.id);
    for (const n of outline.slides.find((s) => s.id === sel.id)?.origin?.slides ?? []) litOrig.add(n);
  } else if (sel?.type === "orig") {
    litOrig.add(sel.n);
    for (const s of rowsUsingSlide(outline, sel.n)) litRows.add(s.id);
  }

  // Đưa phần tử tương ứng ở cột bên kia vào tầm nhìn.
  useEffect(() => {
    const target = sel?.type === "row" ? [...litOrig][0] : sel?.type === "orig" ? [...litRows][0] : undefined;
    if (target === undefined) return;
    const el = document.querySelector(sel?.type === "row" ? `[data-o="${target}"]` : `[data-r="${target}"]`);
    el?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel]);

  const total = slides.length;
  const interactive = outline.slides.filter((s) => s.kind !== "content").length;

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">
        {mode === "keep"
          ? "Mỗi slide gốc thành slide mới theo đúng thứ tự. Bấm một slide để xem nó lấy từ đâu."
          : "AI đề xuất dàn ý theo mạch. Mỗi slide mới ghi rõ lấy từ slide gốc nào; slide ghi “mới” là do AI thêm. Bấm một slide để xem đối chiếu."}
      </p>

      <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 rounded-xl px-4 py-3 text-sm ${unused.length ? "banner-warning" : "banner-success"}`}>
        <b className="text-lg tabular-nums">
          {used.size}/{total}
        </b>
        <span>
          {unused.length
            ? ` slide gốc đã được dùng. ${unused.length} slide gốc chưa có trong dàn ý mới; thầy/cô xem lại bên dưới, thêm lại nếu cần.`
            : " slide gốc đều có trong dàn ý mới. Không có nội dung nào bị bỏ."}
        </span>
      </div>
      {unused.length > 0 && (
        <div className="grid gap-1.5">
          {unused.map((n) => {
            const s = byN.get(n)!;
            const meta = origMeta(s);
            return (
              <div key={n} className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-xl border border-token px-3 py-2 text-sm">
                <span className="min-w-[180px] flex-1">
                  <b>
                    Slide {n}: {s.title || "(không có tiêu đề)"}
                  </b>
                  {meta && <span className="text-muted"> · {meta}</span>}
                </span>
                <button type="button" className="btn-secondary" disabled={props.busy} onClick={() => props.onAddBack(n)}>
                  Thêm lại vào dàn ý
                </button>
              </div>
            );
          })}
        </div>
      )}

      <div className="inline-flex overflow-hidden rounded-lg border border-token text-sm min-[900px]:hidden" role="group" aria-label="Xem cột">
        {(["orig", "new"] as const).map((v) => (
          <button
            key={v}
            type="button"
            aria-pressed={view === v}
            onClick={() => setView(v)}
            className={`px-3 py-1.5 ${view === v ? "bg-brand-50 font-bold" : ""} ${v === "new" ? "border-l border-token" : ""}`}
          >
            {v === "orig" ? "Slide gốc" : "Dàn ý mới"}
          </button>
        ))}
      </div>

      <div className="grid items-start gap-4 min-[900px]:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className={view === "orig" ? "" : "max-[899px]:hidden"}>
          <div className="mx-1 mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-[15px] font-bold">Slide gốc</h3>
            <span className="text-[13px] text-muted">{total} slide trong file</span>
          </div>
          <ol className="rounded-2xl border border-token p-1.5">
            {slides.map((s) => {
              const isUsed = used.has(s.n);
              const flags = s.flags.map((f) => FLAG_LABEL[f]).filter(Boolean);
              return (
                <li
                  key={s.n}
                  data-o={s.n}
                  tabIndex={0}
                  onClick={() => setSel({ type: "orig", n: s.n })}
                  onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel({ type: "orig", n: s.n }))}
                  className={`grid cursor-pointer grid-cols-[26px_minmax(0,1fr)] items-center gap-x-2.5 rounded-xl border-2 px-2 py-1.5 ${
                    litOrig.has(s.n) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40" : "border-transparent hover:bg-[rgb(var(--surface-muted))]"
                  }`}
                >
                  <span className="text-right text-[13px] font-bold tabular-nums text-muted">{s.n}</span>
                  <span className="min-w-0">
                    <b className={`block truncate text-sm font-semibold ${isUsed ? "" : "text-muted line-through decoration-1"}`}>{s.title || "(không có tiêu đề)"}</b>
                    <small className="block truncate text-[12.5px] text-muted">
                      {!isUsed && <span className="font-semibold text-amber-800 dark:text-amber-300">Chưa dùng · </span>}
                      {origMeta(s)}
                      {flags.length > 0 && <span className="font-semibold text-amber-800 dark:text-amber-300"> · {flags.join(", ")}: chỉ lấy chữ</span>}
                    </small>
                  </span>
                </li>
              );
            })}
          </ol>
        </div>

        <div className={view === "new" ? "" : "max-[899px]:hidden"}>
          <div className="mx-1 mb-2 flex flex-wrap items-baseline justify-between gap-x-3">
            <h3 className="text-[15px] font-bold">Dàn ý mới</h3>
            <span className="text-[13px] text-muted">
              {outline.slides.length} slide · {interactive} tương tác
            </span>
          </div>
          <ol className="rounded-2xl border border-token p-1.5">
            {groups.map((g) => {
              const from = g.rows[0]!.no;
              const to = g.rows[g.rows.length - 1]!.no;
              return (
                <li key={g.partId + from}>
                  <div className="flex flex-wrap items-baseline gap-x-2.5 px-2 pb-0.5 pt-2.5">
                    <span className="text-[14.5px] font-bold">{partLabel(outline, g.partId)}</span>
                    <span className="text-[12.5px] text-muted">{from === to ? `slide ${from}` : `slide ${from}–${to}`}</span>
                  </div>
                  <ol>
                    {g.rows.map(({ s, no }) => {
                      const talk = s.kind !== "content";
                      return (
                        <li
                          key={s.id}
                          data-r={s.id}
                          tabIndex={0}
                          onClick={() => setSel({ type: "row", id: s.id })}
                          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), setSel({ type: "row", id: s.id }))}
                          className={`grid cursor-pointer grid-cols-[26px_42px_minmax(0,1fr)] items-center gap-x-2.5 rounded-xl border-2 px-2 py-1.5 ${
                            litRows.has(s.id)
                              ? "border-amber-400 bg-amber-50 dark:bg-amber-950/40"
                              : `border-transparent hover:bg-[rgb(var(--surface-muted))] ${talk ? "bg-blue-50 dark:bg-blue-950/30" : ""}`
                          }`}
                        >
                          <span className="text-right text-[13px] font-bold tabular-nums text-muted">{no}</span>
                          <OutlineGlyph k={glyphKey(s)} className={`h-7 w-[42px] ${talk ? "text-blue-700 dark:text-blue-300" : "text-muted"}`} />
                          <span className="min-w-0">
                            <b className="block truncate text-sm font-semibold">{s.title}</b>
                            <small className="block truncate text-[12.5px] text-muted">
                              {rowKindLabel(s)} ·{" "}
                              <span className={!s.origin || s.origin.how === "new" ? "font-semibold text-blue-700 dark:text-blue-300" : "font-semibold"}>
                                {s.origin ? originLabel(s.origin) : "mới"}
                              </span>
                              {(() => {
                                const plan = notesPlan(s, { slides });
                                return plan === "kept" || plan === "joined" ? <span className="text-green-800 dark:text-green-300"> · giữ ghi chú</span> : null;
                              })()}
                            </small>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                </li>
              );
            })}
          </ol>
        </div>
      </div>

      {sel && <Detail sel={sel} outline={outline} slides={slides} onClose={() => setSel(null)} />}
    </div>
  );
}

function Detail({ sel, outline, slides, onClose }: { sel: NonNullable<Sel>; outline: Outline; slides: ImportedSlide[]; onClose: () => void }) {
  const byN = new Map(slides.map((s) => [s.n, s]));
  const close = (
    <button type="button" className="btn-secondary float-right mb-1.5 ml-2.5 px-2.5 py-1 text-sm" onClick={onClose}>
      Đóng
    </button>
  );
  let body;
  if (sel.type === "row") {
    const no = outline.slides.findIndex((s) => s.id === sel.id) + 1;
    const s = outline.slides[no - 1];
    if (!s) return null;
    const srcs = s.origin?.slides ?? [];
    const plan = notesPlan(s, { slides });
    const withNotes = srcs.filter((n) => byN.get(n)?.notes.trim());
    const notes =
      plan === "kept"
        ? `Ghi chú giảng: giữ nguyên chữ ghi chú của slide ${listVi(withNotes)}.`
        : plan === "joined"
          ? `Ghi chú giảng: giữ nguyên chữ ghi chú của slide ${listVi(withNotes)}, nối theo thứ tự.`
          : plan === "ai"
            ? "Ghi chú giảng: AI viết mới vì đây là slide mới, thầy/cô sửa được."
            : "Slide gốc không có ghi chú giảng; ghi chú để trống.";
    body = (
      <>
        <h4 className="mb-1.5 text-[15px] font-bold">
          Slide mới {no}: {s.title}
        </h4>
        <div className="grid gap-3 min-[900px]:grid-cols-2">
          <div className="rounded-xl border border-token bg-[rgb(var(--surface))] px-3 py-2.5">
            <small className="mb-1 block text-xs font-bold text-muted">{s.origin?.how === "new" ? "Dựa trên slide gốc" : "Lấy từ slide gốc"}</small>
            {srcs.length ? (
              srcs.map((n) => (
                <p key={n} className="mb-1">
                  <b>
                    {n}. {byN.get(n)?.title || "(không có tiêu đề)"}
                  </b>
                  {byN.get(n) && origMeta(byN.get(n)!) ? <span className="text-muted"> ({origMeta(byN.get(n)!)})</span> : null}
                </p>
              ))
            ) : (
              <p className="text-muted">Không có, đây là slide AI thêm vào mạch bài.</p>
            )}
          </div>
          <div className="rounded-xl border border-token bg-[rgb(var(--surface))] px-3 py-2.5">
            <small className="mb-1 block text-xs font-bold text-muted">Slide mới</small>
            <p className="mb-1 font-semibold">{s.title}</p>
            <p className="text-muted">
              {s.kind === "content" ? `Bố cục ${rowKindLabel(s)}` : rowKindLabel(s)}
              {s.origin?.how === "merge" ? ". Các ý của những slide gốc được gộp; AI được yêu cầu không bỏ ý nào." : ""}
              {s.origin?.how === "same" || s.origin?.how === "back" ? ". Chữ và hình giữ nguyên từ slide gốc." : ""}
            </p>
          </div>
        </div>
        <p className="mt-2 text-[13px] text-muted">{notes}</p>
      </>
    );
  } else {
    const s = byN.get(sel.n);
    const rows = rowsUsingSlide(outline, sel.n);
    const nos = rows.map((r) => outline.slides.indexOf(r) + 1);
    body = (
      <>
        <h4 className="mb-1.5 text-[15px] font-bold">
          Slide gốc {sel.n}: {s?.title || "(không có tiêu đề)"}
        </h4>
        <p>
          {rows.length
            ? `Có mặt trong slide mới ${listVi(nos)}: ${rows.map((r) => `“${r.title}”`).join("; ")}.`
            : "Slide này chưa có trong dàn ý mới. Bấm “Thêm lại vào dàn ý” ở khung phía trên nếu cần giữ."}
        </p>
      </>
    );
  }
  return (
    <div className="sticky bottom-3 z-10 max-h-[45vh] overflow-auto rounded-2xl border border-token bg-[rgb(var(--surface-muted))] p-3.5 text-sm shadow-lg">
      {close}
      {body}
    </div>
  );
}
