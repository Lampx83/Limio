"use client";

import { useEffect, useRef, useState, type ClipboardEvent, type ReactNode } from "react";
import { Plus, X } from "lucide-react";
import {
  CHART_MAX_STORED_LABELS,
  CHART_TYPES,
  CHART_TYPE_LABEL,
  TABLE_LIMITS,
  chartLabelLimit,
  isNum,
  isSingleSeries,
  parseClipboardGrid,
  parseNum,
  pasteIntoChart,
  pasteIntoTable,
  type ChartDraft,
  type ChartType,
} from "@/lib/limioLiveCharts";
import { MAX_LEN } from "@/lib/limioLiveSlides";

// Ô dữ liệu kiểu bảng tính cho hai bố cục Bảng và Biểu đồ. Chép một vùng ô trong Excel hoặc Google
// Sheets rồi dán vào ô bất kỳ: dữ liệu trải ra theo dòng và cột (tách theo tab và xuống dòng).

type Cfg = Record<string, any>;

const cellCls =
  "w-full min-w-[64px] border-0 bg-transparent px-2 py-1.5 text-sm outline-none focus:bg-[rgb(var(--surface))] focus:outline focus:outline-2 focus:-outline-offset-2 focus:outline-brand-600";
const thCls = "border-b border-r border-token bg-brand-soft p-0 last:border-r-0";
const tdCls = "border-b border-r border-token p-0 last:border-r-0";

/** Dòng báo ngắn sau khi dán (tự ẩn). */
function useFlash(): [string, (m: string) => void] {
  const [msg, setMsg] = useState("");
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(t.current), []);
  return [
    msg,
    (m: string) => {
      setMsg(m);
      clearTimeout(t.current);
      if (m) t.current = setTimeout(() => setMsg(""), 7000);
    },
  ];
}

function Flash({ msg }: { msg: string }) {
  if (!msg) return null;
  return (
    <p role="status" className="rounded-lg bg-brand-soft px-3 py-1.5 text-[13px] text-[rgb(var(--text))]">
      {msg}
    </p>
  );
}

const PASTE_HINT = "Dán thẳng từ Excel hoặc Google Sheets: chọn vùng ô, chép, rồi bấm vào một ô ở đây và dán.";

// ── Bảng ────────────────────────────────────────────────────────────────────

export function TableSheet({ d, onChange, onBlur }: { d: Cfg; onChange: (patch: Cfg, commitNow?: boolean) => void; onBlur: () => void }) {
  const head: string[] = d.head ?? [];
  const rows: string[][] = d.rows ?? [];
  const cells = [head, ...rows];
  const cols = head.length;
  const [flash, setFlash] = useFlash();

  const put = (next: string[][], commitNow = false) => onChange({ head: next[0] ?? [], rows: next.slice(1) }, commitNow);
  const setCell = (r: number, c: number, v: string) => put(cells.map((row, i) => (i === r ? row.map((x, j) => (j === c ? v : x)) : row)));
  const onPaste = (r: number, c: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const grid = parseClipboardGrid(e.clipboardData.getData("text/plain"));
    if (!grid) return;
    e.preventDefault();
    const res = pasteIntoTable(cells, grid, r, c, MAX_LEN.tableCell);
    put(res.cells, true);
    const notes = [
      res.droppedCols ? `bỏ ${res.droppedCols} cột vượt quá ${TABLE_LIMITS.maxCols} cột` : "",
      res.droppedRows ? `bỏ ${res.droppedRows} dòng vượt quá ${TABLE_LIMITS.maxRows} dòng` : "",
    ].filter(Boolean);
    setFlash(`Đã dán ${grid.length} dòng × ${Math.max(...grid.map((x) => x.length))} cột.${notes.length ? ` Lưu ý: ${notes.join("; ")}.` : ""}`);
  };

  return (
    <div className="grid gap-2">
      <span className="text-xs font-semibold text-muted">
        Nội dung bảng <span className="font-normal">(dòng đầu là hàng tiêu đề, để trống nếu không cần)</span>
      </span>
      <div className="overflow-x-auto rounded-xl border border-token">
        <table className="w-full min-w-[320px] border-collapse">
          <thead>
            <tr>
              <th className="w-7" />
              {head.map((_, j) => (
                <th key={j} className="px-1 pt-1 text-right">
                  {cols > TABLE_LIMITS.minCols && (
                    <button
                      type="button"
                      aria-label={`Xoá cột ${j + 1}`}
                      title={`Xoá cột ${j + 1}`}
                      className="text-faint hover:text-red-600"
                      onClick={() => put(cells.map((row) => row.filter((_, k) => k !== j)), true)}
                    >
                      <X size={13} />
                    </button>
                  )}
                </th>
              ))}
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {cells.map((row, i) => (
              <tr key={i}>
                <td className="w-7 border-b border-token text-center text-xs text-faint">{i === 0 ? "" : i}</td>
                {row.map((v, j) => {
                  const Cell = i === 0 ? "th" : "td";
                  const numeric = i > 0 && isNum(parseNum(v));
                  return (
                    <Cell key={j} className={i === 0 ? thCls : tdCls}>
                      <input
                        className={`${cellCls} ${i === 0 ? "font-bold" : ""} ${numeric ? "text-right tabular-nums" : ""}`}
                        value={v}
                        maxLength={MAX_LEN.tableCell}
                        aria-label={i === 0 ? `Tiêu đề cột ${j + 1}` : `Dòng ${i}, cột ${j + 1}`}
                        onChange={(e) => setCell(i, j, e.target.value)}
                        onBlur={onBlur}
                        onPaste={onPaste(i, j)}
                      />
                    </Cell>
                  );
                })}
                <td className="w-7 border-b border-token text-center">
                  {i > 0 && rows.length > TABLE_LIMITS.minRows && (
                    <button type="button" aria-label={`Xoá dòng ${i}`} className="p-1 text-faint hover:text-red-600" onClick={() => put(cells.filter((_, k) => k !== i), true)}>
                      <X size={14} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-1">
        <AddButton disabled={rows.length >= TABLE_LIMITS.maxRows} full={`Đã đủ ${TABLE_LIMITS.maxRows} dòng`} onClick={() => put([...cells, head.map(() => "")])}>
          Thêm dòng
        </AddButton>
        <AddButton disabled={cols >= TABLE_LIMITS.maxCols} full={`Đã đủ ${TABLE_LIMITS.maxCols} cột`} onClick={() => put(cells.map((row) => [...row, ""]))}>
          Thêm cột
        </AddButton>
      </div>
      <p className="text-[13px] text-muted">
        Tối đa {TABLE_LIMITS.maxCols} cột và {TABLE_LIMITS.maxRows} dòng dưới hàng tiêu đề, để chữ trên slide không nhỏ hơn 26 px. {PASTE_HINT}
      </p>
      <Flash msg={flash} />
    </div>
  );
}

function AddButton({ disabled, full, onClick, children }: { disabled: boolean; full: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="flex w-fit items-center gap-1 text-sm font-medium text-brand-700 hover:underline disabled:cursor-default disabled:font-normal disabled:text-faint disabled:no-underline"
    >
      {disabled ? full : (
        <>
          <Plus size={14} /> {children}
        </>
      )}
    </button>
  );
}

// ── Biểu đồ ─────────────────────────────────────────────────────────────────

const TYPE_GLYPH: Record<ChartType, ReactNode> = {
  bar: (<><rect x="4" y="12" width="6" height="11" rx="1" fill="currentColor" opacity=".55" /><rect x="14" y="6" width="6" height="17" rx="1" fill="currentColor" /><rect x="24" y="9" width="6" height="14" rx="1" fill="currentColor" opacity=".8" /></>),
  hbar: (<><rect x="3" y="3" width="24" height="5" rx="1" fill="currentColor" /><rect x="3" y="10.5" width="16" height="5" rx="1" fill="currentColor" opacity=".8" /><rect x="3" y="18" width="10" height="5" rx="1" fill="currentColor" opacity=".55" /></>),
  line: (<><polyline points="3,20 11,14 19,16 30,5" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinejoin="round" strokeLinecap="round" /><circle cx="30" cy="5" r="2.6" fill="currentColor" /></>),
  pie: (<><path d="M17 13 L17 2 A11 11 0 0 1 27.4 16.6 Z" fill="currentColor" /><path d="M17 13 L27.4 16.6 A11 11 0 1 1 17 2 Z" fill="currentColor" opacity=".45" /></>),
  donut: (<><circle cx="17" cy="13" r="8.5" fill="none" stroke="currentColor" strokeOpacity=".45" strokeWidth="5" /><path d="M17 4.5 A8.5 8.5 0 0 1 25.1 15.6" fill="none" stroke="currentColor" strokeWidth="5" /></>),
};
const TYPE_HINT: Record<ChartType, string> = {
  bar: "So sánh các nhóm; số ghi trên đầu cột.",
  hbar: "Hợp khi nhãn dài.",
  line: "Diễn biến theo thời gian.",
  pie: "Các phần của một tổng thể; một chuỗi số, tỉ lệ do hệ thống tính.",
  donut: "Như biểu đồ tròn, tổng ghi ở giữa.",
};

export function ChartSheet({ d, onChange, onBlur }: { d: Cfg; onChange: (patch: Cfg, commitNow?: boolean) => void; onBlur: () => void }) {
  const type: ChartType = (CHART_TYPES as readonly string[]).includes(d.chartType) ? d.chartType : "bar";
  const labels: string[] = d.labels ?? [];
  const series: ChartDraft["series"] = (d.series ?? []).map((s: { name?: string; values?: unknown[] }) => ({
    name: s.name ?? "",
    values: labels.map((_, i) => (s.values?.[i] == null ? "" : String(s.values[i]))),
  }));
  const single = isSingleSeries(type);
  const shown = single ? series.slice(0, 1) : series;
  const limit = chartLabelLimit(type, shown.length);
  const [flash, setFlash] = useFlash();

  const put = (next: ChartDraft, commitNow = false) => onChange({ labels: next.labels, series: next.series }, commitNow);
  const onPaste = (r: number, c: number) => (e: ClipboardEvent<HTMLInputElement>) => {
    const grid = parseClipboardGrid(e.clipboardData.getData("text/plain"));
    if (!grid) return;
    e.preventDefault();
    const res = pasteIntoChart({ labels, series }, grid, r, c, MAX_LEN.chartLabel);
    put(res, true);
    const lim = chartLabelLimit(type, single ? 1 : res.series.length);
    const notes = [
      res.droppedCols ? `bỏ ${res.droppedCols} cột thừa (tối đa hai chuỗi số)` : "",
      res.droppedRows ? `bỏ ${res.droppedRows} dòng vượt quá ${CHART_MAX_STORED_LABELS} dòng` : "",
      single && res.series.length > 1 ? "biểu đồ tròn chỉ vẽ chuỗi đầu" : "",
      res.labels.length > lim ? `biểu đồ này vẽ ${lim} dòng đầu` : "",
    ].filter(Boolean);
    setFlash(
      `Đã dán ${grid.length} dòng × ${Math.max(...grid.map((x) => x.length))} cột${res.usedHeader ? ", dòng đầu dùng làm tên chuỗi" : ""}.${notes.length ? ` Lưu ý: ${notes.join("; ")}.` : ""}`,
    );
  };
  const setLabel = (i: number, v: string) => put({ labels: labels.map((x, k) => (k === i ? v : x)), series });
  const setValue = (k: number, i: number, v: string) => put({ labels, series: series.map((s, j) => (j === k ? { ...s, values: s.values.map((x, m) => (m === i ? v : x)) } : s)) });
  const setName = (k: number, v: string) => put({ labels, series: series.map((s, j) => (j === k ? { ...s, name: v } : s)) });

  return (
    <div className="grid gap-3">
      <div className="grid gap-1.5">
        <span className="text-xs font-semibold text-muted">Loại biểu đồ</span>
        <div role="group" aria-label="Loại biểu đồ" className="grid grid-cols-5 gap-1.5">
          {CHART_TYPES.map((t) => (
            <button
              key={t}
              type="button"
              aria-pressed={t === type}
              onClick={() => onChange({ chartType: t }, true)}
              className={`grid justify-items-center gap-1 rounded-[10px] border px-0.5 pb-1.5 pt-2 text-[12.5px] leading-tight ${
                t === type ? "border-brand-600 bg-brand-soft font-bold text-[rgb(var(--text))]" : "border-token bg-[rgb(var(--surface))] text-muted hover:bg-[rgb(var(--surface-muted))]"
              }`}
            >
              <svg viewBox="0 0 34 26" className={`h-[22px] w-[30px] ${t === type ? "text-brand-700" : ""}`} aria-hidden="true">
                {TYPE_GLYPH[t]}
              </svg>
              {CHART_TYPE_LABEL[t]}
            </button>
          ))}
        </div>
        <p className="text-[13px] text-muted">
          {TYPE_HINT[type]} Tối đa {limit} dòng{single ? "" : shown.length === 2 && type === "bar" ? " khi có hai chuỗi" : ""}.
          {single && series.length > 1 ? " Chuỗi thứ hai được giữ lại nhưng không vẽ." : ""}
        </p>
      </div>

      <div className="grid gap-2">
        <span className="text-xs font-semibold text-muted">Số liệu</span>
        <div className="overflow-x-auto rounded-xl border border-token">
          <table className="w-full min-w-[300px] border-collapse">
            <thead>
              <tr>
                <th className={`${thCls} px-2 text-left text-sm font-semibold text-muted`}>Nhãn</th>
                {shown.map((s, k) => (
                  <th key={k} className={thCls}>
                    <div className="flex items-center">
                      <input
                        className={`${cellCls} font-bold`}
                        value={s.name}
                        maxLength={MAX_LEN.seriesName}
                        placeholder={shown.length === 2 ? `Tên chuỗi ${k + 1}` : "Tên chuỗi (tuỳ chọn)"}
                        aria-label={`Tên chuỗi số ${k + 1}`}
                        onChange={(e) => setName(k, e.target.value)}
                        onBlur={onBlur}
                        onPaste={onPaste(-1, k + 1)}
                      />
                      {k === 1 && (
                        <button
                          type="button"
                          aria-label="Bỏ chuỗi số thứ hai"
                          title="Bỏ chuỗi số thứ hai"
                          className="px-1.5 text-faint hover:text-red-600"
                          onClick={() => put({ labels, series: series.slice(0, 1) }, true)}
                        >
                          <X size={13} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-7 border-b border-token" />
              </tr>
            </thead>
            <tbody>
              {labels.map((l, i) => (
                <tr key={i} className={i >= limit ? "opacity-45" : undefined} title={i >= limit ? `Biểu đồ này chỉ vẽ ${limit} dòng đầu` : undefined}>
                  <td className={tdCls}>
                    <input
                      className={cellCls}
                      value={l}
                      maxLength={MAX_LEN.chartLabel}
                      aria-label={`Nhãn dòng ${i + 1}`}
                      onChange={(e) => setLabel(i, e.target.value)}
                      onBlur={onBlur}
                      onPaste={onPaste(i, 0)}
                    />
                  </td>
                  {shown.map((s, k) => {
                    const raw = s.values[i] ?? "";
                    const bad = Number.isNaN(parseNum(raw));
                    return (
                      <td key={k} className={tdCls}>
                        <input
                          className={`${cellCls} text-right tabular-nums ${bad ? "bg-red-500/10 ring-2 ring-inset ring-red-600" : ""}`}
                          value={raw}
                          inputMode="decimal"
                          aria-label={`Số của ${l || `dòng ${i + 1}`}${shown.length === 2 ? `, chuỗi ${k + 1}` : ""}`}
                          aria-invalid={bad || undefined}
                          title={bad ? "Không đọc được số" : undefined}
                          onChange={(e) => setValue(k, i, e.target.value)}
                          onBlur={onBlur}
                          onPaste={onPaste(i, k + 1)}
                        />
                      </td>
                    );
                  })}
                  <td className="w-7 border-b border-token text-center">
                    {labels.length > 2 && (
                      <button
                        type="button"
                        aria-label={`Xoá dòng ${i + 1}`}
                        className="p-1 text-faint hover:text-red-600"
                        onClick={() => put({ labels: labels.filter((_, k) => k !== i), series: series.map((s) => ({ ...s, values: s.values.filter((_, k) => k !== i) })) }, true)}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          <AddButton
            disabled={labels.length >= CHART_MAX_STORED_LABELS}
            full={`Đã đủ ${CHART_MAX_STORED_LABELS} dòng`}
            onClick={() => put({ labels: [...labels, ""], series: series.map((s) => ({ ...s, values: [...s.values, ""] })) })}
          >
            Thêm dòng
          </AddButton>
          {!single && series.length < 2 && (
            <AddButton disabled={false} full="" onClick={() => put({ labels, series: [...series, { name: "", values: labels.map(() => "") }] })}>
              Thêm chuỗi số thứ hai
            </AddButton>
          )}
        </div>
        <p className="text-[13px] text-muted">Ô số nhận cả kiểu 3,5 hay 1.250 và dấu % ở cuối; ô để trống thì không vẽ. {PASTE_HINT}</p>
        <Flash msg={flash} />
      </div>
    </div>
  );
}
