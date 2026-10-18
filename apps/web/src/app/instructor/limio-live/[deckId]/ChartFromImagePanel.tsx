"use client";

// Màn đối chiếu "Vẽ lại thành biểu đồ" trong cửa sổ sửa slide (docs/tieu-chi/bieu-do-kho-doc-pptx.md, V2–V10; bản mẫu
// docs/mockup/ve-lai-bieu-do-tu-hinh.html). Hình gốc một bên, bảng số AI đọc một bên; giảng viên đối chiếu từng dòng.
// Số AI đọc chỉ sống trong state của component này: đóng màn là mất, và chỉ applyRedraw (khi đã đối chiếu hết) dựng
// được cấu hình slide.

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, ArrowLeft, Check, CheckCircle2, Loader2, Plus, X, ZoomIn } from "lucide-react";
import { apiUrl } from "@/lib/apiUrl";
import { CHART_MAX_STORED_LABELS, type ChartType } from "@/lib/limioLiveCharts";
import {
  addRow,
  applyRedraw,
  canApply,
  confirmRow,
  editCell,
  initRedraw,
  pendingRows,
  previewChart,
  removeRow,
  setChartType,
  toggleRow,
  type ChartReading,
  type RedrawDraft,
} from "@/lib/limioLiveChartFromImage";
import { MAX_LEN } from "@/lib/limioLiveSlides";
import { LayoutSlideView } from "../SlideLayouts";
import { slideBgFor } from "../slideThemes";

type Cfg = Record<string, any>;

const TYPES: Array<[ChartType, string]> = [
  ["bar", "Cột dọc"],
  ["hbar", "Thanh ngang"],
  ["line", "Đường"],
  ["pie", "Tròn"],
  ["donut", "Vành khuyên"],
];
const TYPE_LABEL = Object.fromEntries(TYPES) as Record<ChartType, string>;

const FAIL: Record<string, string> = {
  not_chart: "Hình này không giống biểu đồ có số đọc được.",
  too_many_labels: `Biểu đồ trong hình có nhiều hơn ${CHART_MAX_STORED_LABELS} cột hoặc mục, bố cục Biểu đồ của Limio không chứa hết.`,
  too_many_series: "Biểu đồ trong hình có nhiều hơn hai chuỗi số, bố cục Biểu đồ của Limio chỉ vẽ tối đa hai chuỗi.",
};

type Phase = { k: "loading" } | { k: "failed"; reason: string } | { k: "ready" };

export default function ChartFromImagePanel({
  deckId,
  slideId,
  config,
  themeId,
  onBack,
  onApply,
}: {
  deckId: string;
  slideId: string;
  /** Cấu hình slide Chữ và hình hiện tại (tiêu đề, ý, imageUrl, meta). */
  config: Cfg;
  themeId?: string | null;
  onBack: () => void;
  /** Đã đối chiếu hết và bấm thay: slide biểu đồ và slide "(tiếp)" mang các ý cũ (nếu có). */
  onApply: (chart: Cfg, cont: Cfg | null) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ k: "loading" });
  const [draft, setDraft] = useState<RedrawDraft | null>(null);
  const [zoomed, setZoomed] = useState(false);
  const [aiType, setAiType] = useState<ChartType | null>(null);
  /** Hình không ghi số ở ít nhất một ô (AI ước lượng theo trục): cảnh báo giữ suốt màn, kể cả khi đã sửa hết. */
  const [hadEstimates, setHadEstimates] = useState(false);
  const tbody = useRef<HTMLTableSectionElement>(null);

  // Một lần đọc cho mỗi lần mở màn (mở lại thì đọc lại, V10). Lời gọi giữ trong ref: StrictMode ở chế độ dev chạy
  // effect hai lần, không được gọi AI (và tính token) hai lần.
  const request = useRef<Promise<{ ok: boolean; body: { reading?: ChartReading; error?: string } }> | null>(null);
  useEffect(() => {
    let alive = true;
    request.current ??= fetch(apiUrl(`/api/instructor/limio-live/decks/${deckId}/slides/${slideId}/chart-from-image`), { method: "POST" })
      .then(async (res) => ({ ok: res.ok, body: (await res.json().catch(() => ({}))) as { reading?: ChartReading; error?: string } }))
      .catch(() => ({ ok: false, body: { error: "ai_failed" } }));
    request.current.then(({ ok, body }) => {
      if (!alive) return;
      if (ok && body.reading) {
        setDraft(initRedraw(body.reading, typeof config.title === "string" ? config.title : ""));
        setAiType(body.reading.chartType);
        setHadEstimates(body.reading.series.some((se) => se.values.some((v, i) => v !== null && !se.printed[i])));
        setPhase({ k: "ready" });
      } else setPhase({ k: "failed", reason: body.error ?? "ai_failed" });
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deckId, slideId]);

  const preview = useMemo(() => (draft ? previewChart(draft) : null), [draft]);
  const pending = draft ? pendingRows(draft) : 0;
  const ready = draft ? canApply(draft) : false;

  const apply = () => {
    if (!draft) return;
    const out = applyRedraw(draft, config);
    if (out) onApply(out.chart, out.cont);
  };
  const focusNext = (i: number) =>
    requestAnimationFrame(() => tbody.current?.querySelectorAll("tr")[i + 1]?.querySelector<HTMLInputElement>("input[data-num]")?.focus());

  const image = (
    <div className="md:sticky md:top-0 md:self-start">
      <div className="mb-1 flex items-center justify-between text-[13px] text-faint">
        <b className="text-muted">Hình gốc</b>
        <span>Bấm để phóng to</span>
      </div>
      <button
        type="button"
        onClick={() => setZoomed(true)}
        aria-label="Phóng to hình gốc"
        className="group relative block w-full overflow-hidden rounded-xl border border-token bg-white"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={config.imageUrl} alt="Hình gốc của slide" className="max-h-[220px] w-full object-contain md:max-h-[60vh]" />
        <ZoomIn size={18} className="absolute right-2 top-2 rounded bg-white/90 p-0.5 text-muted opacity-0 group-hover:opacity-100" aria-hidden />
      </button>
    </div>
  );

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="chart-from-image">
      <div className="flex shrink-0 items-center gap-2 border-b border-token px-4 py-2.5">
        <button type="button" className="btn-secondary h-9" onClick={onBack}>
          <ArrowLeft size={16} /> Quay lại nội dung
        </button>
        <h2 className="flex-1 text-center text-lg font-bold">Vẽ lại thành biểu đồ</h2>
        <span className="hidden w-[150px] sm:block" aria-hidden />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.08fr)]">
          {image}

          <div className="grid content-start gap-3.5">
            {phase.k === "loading" && (
              <div role="status" className="grid gap-3">
                <p className="banner-info flex items-center gap-2 text-sm">
                  <Loader2 size={16} className="animate-spin" aria-hidden /> AI đang đọc số trong hình… thường mất 10–20 giây. Slide chưa thay đổi gì.
                </p>
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-9 animate-pulse rounded-lg bg-[rgb(var(--surface-muted))]" />
                ))}
              </div>
            )}

            {phase.k === "failed" && (
              <div className="grid gap-3">
                <p role="alert" className="banner-danger flex items-start gap-2 text-sm">
                  <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    <b>{FAIL[phase.reason] ?? "Chưa đọc được hình lúc này. Thầy cô thử lại sau."}</b> Slide giữ nguyên hình.
                    {phase.reason in FAIL && " Nếu đây đúng là biểu đồ, thầy cô có thể đổi slide sang bố cục Biểu đồ và gõ số theo tài liệu gốc."}
                  </span>
                </p>
                <div className="flex justify-end">
                  <button type="button" className="btn-secondary" onClick={onBack}>
                    Quay lại nội dung
                  </button>
                </div>
              </div>
            )}

            {phase.k === "ready" && draft && (
              <>
                {hadEstimates ? (
                  <p className="banner-warning flex items-start gap-2 text-sm">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      <b>Hình không ghi số trên một số cột.</b> AI ước lượng các số đó theo vạch chia của trục (dấu ≈), có thể lệch vài
                      đơn vị. Nếu có tài liệu gốc, hãy gõ lại số đúng; chưa có thì giữ hình.
                    </span>
                  </p>
                ) : (
                  <p className="banner-info flex items-start gap-2 text-sm">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0" aria-hidden />
                    <span>
                      AI chép các số ghi trên hình. Nhìn hình gốc, kiểm từng dòng rồi bấm <b>Khớp</b>; sửa số nào thì dòng đó tính là đã
                      kiểm. Nhấn Enter trong một ô để khớp và sang dòng sau.
                    </span>
                  </p>
                )}

                <label className="grid gap-1 text-[13px] font-semibold text-muted">
                  Tiêu đề slide
                  <input
                    className="input text-[15px] font-normal text-[rgb(var(--text))]"
                    value={draft.title}
                    maxLength={MAX_LEN.title}
                    onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  />
                </label>

                <div className="grid gap-1 text-[13px] font-semibold text-muted">
                  <span>Loại biểu đồ{aiType ? ` (AI nhận ra: ${TYPE_LABEL[aiType].toLowerCase()})` : ""}</span>
                  <div role="group" aria-label="Loại biểu đồ" className="flex flex-wrap gap-1.5">
                    {TYPES.map(([t, label]) => (
                      <button
                        key={t}
                        type="button"
                        aria-pressed={draft.chartType === t}
                        onClick={() => setDraft(setChartType(draft, t))}
                        className={`rounded-lg border px-2.5 py-1 text-[13px] ${
                          draft.chartType === t ? "border-brand-600 bg-brand-soft font-bold text-[rgb(var(--text))]" : "border-token font-normal hover:bg-[rgb(var(--surface-muted))]"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-[13px] font-semibold text-muted">
                    Đơn vị
                    <input
                      className="input text-[15px] font-normal text-[rgb(var(--text))]"
                      value={draft.unit}
                      maxLength={MAX_LEN.unit}
                      placeholder="%, điểm, học viên"
                      onChange={(e) => setDraft({ ...draft, unit: e.target.value })}
                    />
                  </label>
                  {draft.seriesNames.map((n, k) => (
                    <label key={k} className="grid gap-1 text-[13px] font-semibold text-muted">
                      {draft.seriesNames.length > 1 ? `Tên chuỗi ${k + 1}` : "Tên chuỗi số"}
                      <input
                        className="input text-[15px] font-normal text-[rgb(var(--text))]"
                        value={n}
                        maxLength={MAX_LEN.seriesName}
                        onChange={(e) => setDraft({ ...draft, seriesNames: draft.seriesNames.map((x, j) => (j === k ? e.target.value : x)) })}
                      />
                    </label>
                  ))}
                </div>

                <table className="w-full border-separate border-spacing-0 text-sm" aria-label="Số liệu đọc từ hình">
                  <thead>
                    <tr className="text-left text-xs text-faint">
                      <th className="px-1.5 pb-1.5 font-semibold">Nhãn</th>
                      {draft.seriesNames.map((n, k) => (
                        <th key={k} className="px-1.5 pb-1.5 font-semibold">
                          {draft.seriesNames.length > 1 ? n || `Chuỗi ${k + 1}` : "Giá trị"}
                        </th>
                      ))}
                      <th className="w-[96px] pb-1.5">
                        <span className="sr-only">Đối chiếu</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody ref={tbody}>
                    {draft.rows.map((r, i) => {
                      const cell = `input w-full ${r.ok ? "" : "!border-amber-400 !bg-amber-50 dark:!bg-amber-950/30"}`;
                      const onEnter = (e: React.KeyboardEvent) => {
                        if (e.key !== "Enter") return;
                        e.preventDefault();
                        setDraft((d) => (d ? confirmRow(d, i) : d));
                        focusNext(i);
                      };
                      return (
                        <tr key={i} data-row-ok={r.ok ? "1" : "0"}>
                          <td className="p-[3px]">
                            <input
                              className={cell}
                              aria-label={`Nhãn dòng ${i + 1}`}
                              value={r.label}
                              maxLength={MAX_LEN.chartLabel}
                              onChange={(e) => setDraft(editCell(draft, i, { label: e.target.value }))}
                              onKeyDown={onEnter}
                            />
                          </td>
                          {r.values.map((v, k) => (
                            <td key={k} className="p-[3px] align-top">
                              <input
                                data-num
                                className={`${cell} text-right tabular-nums`}
                                inputMode="decimal"
                                aria-label={`Giá trị dòng ${i + 1}${r.values.length > 1 ? `, chuỗi ${k + 1}` : ""}`}
                                value={v}
                                onChange={(e) => setDraft(editCell(draft, i, { value: [k, e.target.value] }))}
                                onKeyDown={onEnter}
                              />
                              {r.estimated[k] && !r.ok && <span className="block text-right text-[11px] font-bold text-amber-800 dark:text-amber-300">≈ ước lượng</span>}
                            </td>
                          ))}
                          <td className="whitespace-nowrap p-[3px] align-top">
                            <button
                              type="button"
                              aria-pressed={r.ok}
                              aria-label={`${r.ok ? "Bỏ khớp" : "Khớp"} dòng ${i + 1}`}
                              onClick={() => setDraft(toggleRow(draft, i))}
                              className={`h-9 min-w-[82px] rounded-lg border px-2 text-[13px] font-bold ${
                                r.ok ? "border-brand-600 bg-brand-soft text-brand-800" : "border-amber-400 text-amber-800 dark:text-amber-300"
                              }`}
                            >
                              {r.ok ? (
                                <span className="inline-flex items-center gap-1">
                                  <Check size={14} aria-hidden /> Đã khớp
                                </span>
                              ) : (
                                "Khớp"
                              )}
                            </button>
                            {draft.rows.length > 2 && (
                              <button
                                type="button"
                                aria-label={`Xoá dòng ${i + 1}`}
                                className="ml-1 align-middle text-faint hover:text-red-600"
                                onClick={() => setDraft(removeRow(draft, i))}
                              >
                                <X size={14} />
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {draft.rows.length < CHART_MAX_STORED_LABELS && (
                  <button
                    type="button"
                    className="flex w-fit items-center gap-1 text-sm font-medium text-brand-700 hover:underline"
                    onClick={() => setDraft(addRow(draft))}
                  >
                    <Plus size={14} /> Thêm dòng
                  </button>
                )}

                <div className="flex items-center gap-2.5 text-sm text-muted">
                  <span data-testid="redraw-progress">
                    Đã đối chiếu {draft.rows.length - pending}/{draft.rows.length} dòng
                  </span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--surface-muted))]">
                    <i className="block h-full bg-brand-600 transition-[width]" style={{ width: `${((draft.rows.length - pending) / Math.max(1, draft.rows.length)) * 100}%` }} />
                  </span>
                </div>

                <div>
                  <p className="mb-1 text-[13px] text-faint">Biểu đồ sẽ thay hình (chỉ vẽ số của dòng đã đối chiếu)</p>
                  <div className="relative aspect-video w-full overflow-hidden rounded-xl border border-black/10" style={{ background: slideBgFor(themeId, true) }}>
                    {preview ? (
                      <div className="absolute inset-0 flex">
                        <LayoutSlideView config={preview} themeId={themeId} slideId={`${slideId}-redraw`} />
                      </div>
                    ) : (
                      <p className="absolute inset-0 grid place-items-center p-4 text-center text-sm text-faint">
                        Biểu đồ tròn vẽ khi đã đối chiếu hết các dòng.
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-token pt-3">
                  <span className="min-w-[240px] flex-1 text-[13px] text-faint" aria-live="polite">
                    {pending > 0
                      ? `Còn ${pending} dòng chưa đối chiếu. Đóng lúc này thì slide giữ nguyên hình và số AI đọc không được lưu.`
                      : ready
                        ? "Đã đối chiếu hết. Hình gốc vẫn được giữ để trả lại khi cần."
                        : "Cần ít nhất hai dòng có số."}
                  </span>
                  <button type="button" className="btn-secondary" onClick={onBack}>
                    Huỷ
                  </button>
                  <button type="button" className="btn-primary" disabled={!ready} onClick={apply}>
                    Thay hình bằng biểu đồ
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {zoomed && (
        <button
          type="button"
          aria-label="Đóng hình phóng to"
          onClick={() => setZoomed(false)}
          className="fixed inset-0 z-50 grid cursor-zoom-out place-items-center bg-black/80 p-4"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={config.imageUrl} alt="Hình gốc của slide, phóng to" className="max-h-full max-w-full rounded-lg bg-white object-contain" />
        </button>
      )}
    </div>
  );
}
