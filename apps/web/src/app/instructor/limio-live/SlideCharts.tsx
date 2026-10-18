"use client";

import { useId, type CSSProperties, type ReactNode } from "react";
import {
  chartAltText,
  chartLabelLimit,
  formatValue,
  isNum,
  isSingleSeries,
  niceTicks,
  numericColumns,
  spreadLabels,
  textWidth,
  wrapLines,
  type ChartConfig,
  type ChartSeries,
  type ChartType,
} from "@/lib/limioLiveCharts";

// Bộ vẽ hai bố cục "Bảng" và "Biểu đồ" trên khung 1280 × 720 (SlideLayouts.tsx co theo khung chứa).
// Biểu đồ là SVG thuần theo biến màu của giao diện (--sa, --sa2, --smuted...), nên đọc được ở mọi giao
// diện sáng và tối. Hai chuỗi số luôn khác nhau cả ở hoa văn (đặc / kẻ sọc, nét liền / nét đứt, chấm tròn /
// chấm vuông), không chỉ khác màu. Mọi chữ từ 26 px trở lên.

const LBL = 26; // cỡ chữ nhỏ nhất trên slide
const LH = 32; // khoảng cách dòng của nhãn nhiều dòng
const delay = (i: number): CSSProperties => ({ ["--i" as string]: i }) as CSSProperties;

type TextOpts = { px?: number; w?: number; fill?: string; anchor?: "start" | "middle" | "end"; className?: string; style?: CSSProperties };
function Txt({ x, y, children, px = LBL, w = 400, fill = "var(--stext)", anchor = "start", className, style }: TextOpts & { x: number; y: number; children: ReactNode }) {
  return (
    <text x={x} y={y} fontSize={px} fontWeight={w} fill={fill} textAnchor={anchor} className={className} style={style}>
      {children}
    </text>
  );
}
function Lines({ x, y, lines, ...o }: TextOpts & { x: number; y: number; lines: string[] }) {
  return (
    <>
      {lines.map((l, k) => (
        <Txt key={k} x={x} y={y + k * LH} {...o}>
          {l}
        </Txt>
      ))}
    </>
  );
}

/** Hoa văn kẻ sọc: chuỗi thứ hai (và lát thứ 3–4 của biểu đồ tròn) khác hẳn khi in đen trắng hay giao diện đơn sắc. */
function Patterns({ uid }: { uid: string }) {
  return (
    <defs>
      {(["sa", "sa2"] as const).map((v) => (
        <pattern key={v} id={`${uid}-${v}`} patternUnits="userSpaceOnUse" width="14" height="14" patternTransform="rotate(45)">
          <rect width="14" height="14" fill={`var(--${v})`} fillOpacity="0.2" />
          <rect width="6" height="14" fill={`var(--${v})`} />
        </pattern>
      ))}
    </defs>
  );
}
const seriesFill = (k: number, uid: string) => (k === 0 ? "var(--sa)" : `url(#${uid}-sa2)`);
const seriesStroke = (k: number) => (k === 0 ? "none" : "var(--sa2)");

/** Hàng trên cùng: chú giải có mẫu hoa văn (chỉ cột/thanh hai chuỗi) và "Đơn vị: …" (đơn vị khác %). */
function TopRow({ c, uid, w }: { c: ChartConfig; uid: string; w: number }): { h: number; node: ReactNode } {
  const two = c.series.length === 2 && (c.chartType === "bar" || c.chartType === "hbar");
  const unit = c.unit.trim();
  const cap = unit && unit !== "%" ? `Đơn vị: ${unit}` : "";
  if (!two && !cap) return { h: 0, node: null };
  let x = 0;
  const items = two
    ? c.series.map((s, k) => {
        const name = s.name || `Chuỗi ${k + 1}`;
        const node = (
          <g key={k}>
            <rect x={x} y={6} width={40} height={28} rx={6} fill={seriesFill(k, uid)} stroke={seriesStroke(k)} strokeWidth={3} />
            <Txt x={x + 56} y={30}>
              {name}
            </Txt>
          </g>
        );
        x += 56 + textWidth(name, LBL) + 44;
        return node;
      })
    : null;
  return {
    h: 52,
    node: (
      <>
        {items}
        {cap && (
          <Txt x={w} y={30} anchor="end" fill="var(--smuted)">
            {cap}
          </Txt>
        )}
      </>
    ),
  };
}

function roundedBar(x: number, y0: number, y1: number, w: number, r: number): string {
  const up = y1 <= y0;
  r = Math.min(r, w / 2, Math.abs(y1 - y0));
  const s = up ? 1 : -1;
  return `M${x},${y0} V${y1 + s * r} Q${x},${y1} ${x + r},${y1} H${x + w - r} Q${x + w},${y1} ${x + w},${y1 + s * r} V${y0} Z`;
}
function roundedHBar(y: number, x0: number, x1: number, h: number, r: number): string {
  const right = x1 >= x0;
  r = Math.min(r, h / 2, Math.abs(x1 - x0));
  const s = right ? 1 : -1;
  return `M${x0},${y} H${x1 - s * r} Q${x1},${y} ${x1},${y + r} V${y + h - r} Q${x1},${y + h} ${x1 - s * r},${y + h} H${x0} Z`;
}

const allValues = (S: ChartSeries[]) => S.flatMap((s) => s.values).filter(isNum);

function BarChart({ c, w, h, uid }: { c: ChartConfig; w: number; h: number; uid: string }) {
  const n = c.labels.length;
  const S = c.series;
  const top = TopRow({ c, uid, w });
  const all = allValues(S);
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const span = hi - lo || 1;
  const band = w / n;
  const lbl = c.labels.map((l) => wrapLines(l, band - 14, LBL, 2));
  const labH = Math.max(1, ...lbl.map((x) => x.length)) * LH + 16;
  const plotTop = top.h + 46;
  const plotBot = h - labH - (lo < 0 ? 40 : 0);
  const y = (v: number) => plotTop + ((hi - v) / span) * (plotBot - plotTop);
  const groupW = Math.min(band * 0.66, S.length === 2 ? 210 : 150);
  const barW = S.length === 2 ? (groupW - 10) / 2 : groupW;
  const valPx = S.length === 2 ? 26 : 30;
  return (
    <>
      {top.node}
      <line x1={0} x2={w} y1={y(0)} y2={y(0)} stroke="var(--smuted)" strokeOpacity={0.45} strokeWidth={3} />
      {c.labels.map((_, i) => {
        const gx = i * band + (band - groupW) / 2;
        return (
          <g key={i}>
            {S.map((s, k) => {
              const v = s.values[i];
              if (!isNum(v)) return null;
              const x = gx + k * (barW + 10);
              const y1 = y(v);
              return (
                <g key={k}>
                  <path
                    d={roundedBar(x, y(0), y1, barW, 12)}
                    fill={seriesFill(k, uid)}
                    stroke={seriesStroke(k)}
                    strokeWidth={3}
                    className={`ch-grow ${v >= 0 ? "ch-up" : "ch-down"}`}
                    style={delay(i)}
                  />
                  <Txt x={x + barW / 2} y={v >= 0 ? y1 - 14 : y1 + 34} anchor="middle" w={700} px={valPx} className="ch-fade" style={delay(i)}>
                    {formatValue(v, c.unit)}
                  </Txt>
                </g>
              );
            })}
            <Lines x={i * band + band / 2} y={h - labH + 34} lines={lbl[i]!} anchor="middle" fill="var(--smuted)" />
          </g>
        );
      })}
    </>
  );
}

function HBarChart({ c, w, h, uid }: { c: ChartConfig; w: number; h: number; uid: string }) {
  const n = c.labels.length;
  const S = c.series;
  const top = TopRow({ c, uid, w });
  const all = allValues(S);
  const lo = Math.min(0, ...all);
  const hi = Math.max(0, ...all);
  const span = hi - lo || 1;
  const labW = Math.min(w * 0.36, Math.max(...c.labels.map((l) => Math.min(textWidth(l, LBL), w * 0.36))) + 8);
  const valW = Math.max(0, ...all.map((v) => textWidth(formatValue(v, c.unit), 30))) + 18;
  const negW = lo < 0 ? valW : 0;
  const x0 = labW + 24 + negW;
  const x1 = w - valW;
  const x = (v: number) => x0 + ((v - lo) / span) * (x1 - x0);
  const rowH = (h - top.h - 8) / n;
  const thick = S.length === 2 ? Math.min(rowH * 0.36, 34) : Math.min(rowH * 0.58, 56);
  const valPx = S.length === 2 ? 26 : 30;
  return (
    <>
      {top.node}
      <line x1={x(0)} x2={x(0)} y1={top.h} y2={h} stroke="var(--smuted)" strokeOpacity={0.45} strokeWidth={3} />
      {c.labels.map((l, i) => {
        const cy = top.h + 8 + i * rowH + rowH / 2;
        const ls = wrapLines(l, labW, LBL, 2);
        const gh = S.length * thick + (S.length - 1) * 8;
        return (
          <g key={i}>
            <Lines x={labW} y={cy - (ls.length - 1) * (LH / 2) + 9} lines={ls} anchor="end" />
            {S.map((s, k) => {
              const v = s.values[i];
              if (!isNum(v)) return null;
              const by = cy - gh / 2 + k * (thick + 8);
              return (
                <g key={k}>
                  <path d={roundedHBar(by, x(0), x(v), thick, 10)} fill={seriesFill(k, uid)} stroke={seriesStroke(k)} strokeWidth={3} className="ch-grow ch-right" style={delay(i)} />
                  <Txt x={v >= 0 ? x(v) + 14 : x(v) - 14} y={by + thick / 2 + 10} anchor={v >= 0 ? "start" : "end"} w={700} px={valPx} className="ch-fade" style={delay(i)}>
                    {formatValue(v, c.unit)}
                  </Txt>
                </g>
              );
            })}
          </g>
        );
      })}
    </>
  );
}

function LineChart({ c, w, h, uid }: { c: ChartConfig; w: number; h: number; uid: string }) {
  const n = c.labels.length;
  const S = c.series;
  const top = TopRow({ c, uid, w });
  const all = allValues(S);
  let lo = Math.min(...all);
  const hi = Math.max(...all);
  // Số dương mà nhỏ nhất chưa tới nửa lớn nhất: trục bắt đầu từ 0 cho khỏi phóng đại chênh lệch.
  if (lo >= 0 && lo <= hi * 0.5) lo = 0;
  const ticks = niceTicks(lo, hi, 5);
  const tlo = ticks[0]!;
  const thi = ticks[ticks.length - 1]!;
  const tickW = Math.max(...ticks.map((t) => textWidth(formatValue(t, c.unit), LBL)));
  const two = S.length === 2;
  const ends = S.map((s, k) => {
    let j = s.values.length - 1;
    while (j >= 0 && !isNum(s.values[j])) j--;
    return { j, v: j >= 0 ? (s.values[j] as number) : null, k, name: s.name || `Chuỗi ${k + 1}` };
  });
  const endW = Math.max(...ends.map((e) => Math.max(textWidth(isNum(e.v) ? formatValue(e.v, c.unit) : "", 30), two ? textWidth(e.name, LBL) : 0))) + 26;
  const left = tickW + 20;
  const right = w - endW;
  const band = (right - left) / n;
  const lbl = c.labels.map((l) => wrapLines(l, band - 8, LBL, 2));
  const labH = Math.max(1, ...lbl.map((x) => x.length)) * LH + 14;
  const plotTop = top.h + 20;
  const plotBot = h - labH;
  const y = (v: number) => plotTop + ((thi - v) / (thi - tlo || 1)) * (plotBot - plotTop);
  const x = (i: number) => left + band * i + band / 2;
  const ys = spreadLabels(
    ends.map((e) => (isNum(e.v) ? y(e.v) : plotTop)),
    two ? 70 : 34,
    plotTop,
    plotBot,
  );
  return (
    <>
      {top.node}
      {ticks.map((t) => (
        <g key={t}>
          <line x1={left} x2={right} y1={y(t)} y2={y(t)} stroke="var(--scardb)" strokeWidth={2} />
          <Txt x={tickW} y={y(t) + 9} anchor="end" fill="var(--smuted)">
            {formatValue(t, c.unit)}
          </Txt>
        </g>
      ))}
      {c.labels.map((_, i) => (
        <Lines key={i} x={x(i)} y={h - labH + 34} lines={lbl[i]!} anchor="middle" fill="var(--smuted)" />
      ))}
      {S.map((s, k) => {
        let d = "";
        let pen = false;
        s.values.forEach((v, i) => {
          if (!isNum(v)) {
            pen = false;
            return;
          }
          d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)} `;
          pen = true;
        });
        const col = k ? "var(--sa2)" : "var(--sa)";
        return (
          <g key={k} className="ch-fade" style={delay(k * 3)}>
            <path d={d} fill="none" stroke={col} strokeWidth={6} strokeLinejoin="round" strokeLinecap="round" strokeDasharray={k ? "14 10" : undefined} />
            {s.values.map((v, i) =>
              !isNum(v) ? null : k ? (
                <rect key={i} x={x(i) - 9} y={y(v) - 9} width={18} height={18} fill={col} />
              ) : (
                <circle key={i} cx={x(i)} cy={y(v)} r={9.5} fill={col} />
              ),
            )}
          </g>
        );
      })}
      {/* Nhãn cuối mỗi đường thay cho chú giải: số, và tên chuỗi khi có hai chuỗi. */}
      {ends.map((e, k) =>
        !isNum(e.v) ? null : (
          <g key={k} className="ch-fade" style={delay(k * 3 + 2)}>
            {two ? (
              <>
                <Txt x={right + 18} y={ys[k]! - 6} fill="var(--smuted)">
                  {e.name}
                </Txt>
                <Txt x={right + 18} y={ys[k]! + 28} w={700} px={30}>
                  {formatValue(e.v, c.unit)}
                </Txt>
              </>
            ) : (
              <Txt x={x(e.j) + 20} y={ys[k]! + 10} w={700} px={30}>
                {formatValue(e.v, c.unit)}
              </Txt>
            )}
          </g>
        ),
      )}
    </>
  );
}

function PieChart({ c, w, h, uid, donut }: { c: ChartConfig; w: number; h: number; uid: string; donut: boolean }) {
  const s = c.series[0]!;
  const items = c.labels.map((l, i) => ({ l, v: Math.max(0, s.values[i] ?? 0) })).filter((x) => x.v > 0);
  const total = items.reduce((a, b) => a + b.v, 0) || 1;
  const r = Math.max(60, Math.min(h / 2 - 20, 205));
  const cx = w / 2;
  const cy = h / 2;
  const ri = donut ? r * 0.58 : 0;
  const fills = ["var(--sa)", "var(--sa2)", `url(#${uid}-sa)`, `url(#${uid}-sa2)`, "var(--ssoft)", "var(--ssoft2)"];
  // Số liệu đã là phần trăm cộng lại thành 100 thì ghi đúng số đó; còn lại tính tỉ lệ từ tổng.
  const asIs = c.unit.trim() === "%" && Math.abs(total - 100) < 1.5;
  let a = -Math.PI / 2;
  const slices = items.map((it, i) => {
    const sweep = (it.v / total) * Math.PI * 2;
    const a1 = a + sweep;
    const m = a + sweep / 2;
    const dx = Math.cos(m) * 5;
    const dy = Math.sin(m) * 5;
    const big = sweep > Math.PI ? 1 : 0;
    const P = (rad: number, ang: number) => `${(cx + dx + rad * Math.cos(ang)).toFixed(1)},${(cy + dy + rad * Math.sin(ang)).toFixed(1)}`;
    const d =
      items.length === 1
        ? `M${cx - r},${cy} a${r},${r} 0 1 0 ${2 * r},0 a${r},${r} 0 1 0 ${-2 * r},0` +
          (donut ? ` M${cx - ri},${cy} a${ri},${ri} 0 1 1 ${2 * ri},0 a${ri},${ri} 0 1 1 ${-2 * ri},0` : "")
        : donut
          ? `M${P(r, a)} A${r},${r} 0 ${big} 1 ${P(r, a1)} L${P(ri, a1)} A${ri},${ri} 0 ${big} 0 ${P(ri, a)} Z`
          : `M${P(0, 0)} L${P(r, a)} A${r},${r} 0 ${big} 1 ${P(r, a1)} Z`;
    a = a1;
    return { d, m, it, i, pct: asIs ? it.v : Math.round((it.v / total) * 100) };
  });
  // Nhãn trực tiếp hai bên, có đường dẫn tới lát; không dùng chú giải màu.
  const labels: ReactNode[] = [];
  for (const sgn of [1, -1] as const) {
    const L = slices.filter((x) => (Math.cos(x.m) >= 0 ? 1 : -1) === sgn);
    const ys = spreadLabels(
      L.map((x) => cy + (r + 22) * Math.sin(x.m)),
      74,
      30,
      h - 40,
    );
    L.forEach((x, k) => {
      const ex = cx + (r + 4) * Math.cos(x.m);
      const ey = cy + (r + 4) * Math.sin(x.m);
      const ox = cx + sgn * (r + 34);
      const tx = cx + sgn * (r + 52);
      const ly = ys[k]!;
      const anchor = sgn > 0 ? "start" : "end";
      const extra = c.unit.trim() && c.unit.trim() !== "%" ? ` · ${formatValue(x.it.v)}` : "";
      labels.push(
        <g key={x.i} className="ch-fade" style={delay(x.i + 2)}>
          <polyline points={`${ex.toFixed(1)},${ey.toFixed(1)} ${ox.toFixed(1)},${ly.toFixed(1)} ${(tx - sgn * 8).toFixed(1)},${ly.toFixed(1)}`} fill="none" stroke="var(--smuted)" strokeWidth={2} />
          <Txt x={tx} y={ly - 4} anchor={anchor}>
            {wrapLines(x.it.l, w / 2 - r - 60, LBL, 1)[0]}
          </Txt>
          <Txt x={tx} y={ly + 30} anchor={anchor} w={700} px={30}>
            {`${formatValue(x.pct)}%${extra}`}
          </Txt>
        </g>,
      );
    });
  }
  const unit = c.unit.trim();
  return (
    <>
      <Patterns uid={uid} />
      {slices.map((x) => (
        <path
          key={x.i}
          d={x.d}
          fill={fills[x.i % fills.length]}
          fillRule="evenodd"
          stroke={x.i >= 4 ? "var(--smuted)" : undefined}
          strokeOpacity={x.i >= 4 ? 0.5 : undefined}
          strokeWidth={x.i >= 4 ? 2 : undefined}
          className="ch-fade"
          style={delay(x.i)}
        />
      ))}
      {labels}
      {donut && unit && unit !== "%" && (
        <>
          <Txt x={cx} y={cy + 6} anchor="middle" w={800} px={54} style={{ fontFamily: "var(--sfont-head)" }}>
            {formatValue(total)}
          </Txt>
          <Txt x={cx} y={cy + 44} anchor="middle" fill="var(--smuted)">
            {unit}
          </Txt>
        </>
      )}
    </>
  );
}

/** Dữ liệu biểu đồ đã bớt theo loại: số nhãn tối đa, tròn chỉ một chuỗi. */
export function chartForDrawing(cfg: Record<string, any>): ChartConfig {
  const chartType: ChartType = cfg.chartType ?? "bar";
  const series0: ChartSeries[] = Array.isArray(cfg.series) && cfg.series.length ? cfg.series : [{ name: "", values: [] }];
  const series = isSingleSeries(chartType) ? series0.slice(0, 1) : series0;
  const max = chartLabelLimit(chartType, series.length);
  const labels: string[] = (Array.isArray(cfg.labels) ? cfg.labels : []).slice(0, max);
  return {
    chartType,
    labels,
    series: series.map((s) => ({ name: s.name ?? "", values: labels.map((_, i) => (isNum(s.values?.[i]) ? s.values[i] : null)) })),
    unit: typeof cfg.unit === "string" ? cfg.unit : "",
  };
}

export function ChartView({ cfg, width, height }: { cfg: Record<string, any>; width: number; height: number }) {
  const uid = `ch${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const c = chartForDrawing(cfg);
  const ok = c.labels.length >= 2 && c.series.some((s) => s.values.some(isNum));
  if (!ok) {
    return (
      <div className="ch-empty a" style={{ height }}>
        Nhập ít nhất hai nhãn có số để vẽ biểu đồ
      </div>
    );
  }
  const H = Math.round(height);
  const props = { c, w: width, h: H, uid };
  return (
    <svg width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={chartAltText(c)}>
      {c.chartType !== "line" && c.chartType !== "pie" && c.chartType !== "donut" && <Patterns uid={uid} />}
      {c.chartType === "bar" && <BarChart {...props} />}
      {c.chartType === "hbar" && <HBarChart {...props} />}
      {c.chartType === "line" && <LineChart {...props} />}
      {c.chartType === "pie" && <PieChart {...props} donut={false} />}
      {c.chartType === "donut" && <PieChart {...props} donut />}
    </svg>
  );
}

/** Bảng: cột toàn số căn phải; hàng tiêu đề để trống thì không vẽ. Cỡ chữ do nơi gọi tính (tableFontSize). */
export function TableView({ head, rows, px }: { head: string[]; rows: string[][]; px: number }) {
  const cols = Math.max(head.length, ...rows.map((r) => r.length), 1);
  const num = numericColumns(rows, cols);
  const showHead = head.some((h) => h.trim());
  return (
    <div className="tbl card a" style={delay(1)}>
      <table style={{ fontSize: px }}>
        {showHead && (
          <thead>
            <tr>
              {Array.from({ length: cols }, (_, j) => (
                <th key={j} scope="col" className={num[j] ? "num" : undefined}>
                  {head[j] ?? ""}
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="a" style={delay(i + 2)}>
              {Array.from({ length: cols }, (_, j) => (
                <td key={j} className={num[j] ? "num" : undefined}>
                  {r[j] ?? ""}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
