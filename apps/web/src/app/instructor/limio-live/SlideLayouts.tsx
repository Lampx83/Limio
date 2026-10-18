"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  BarChart3,
  BookOpen,
  Check,
  Compass,
  MessageCircle,
  Repeat,
  Route,
  Sparkles,
  Target,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  accentTail,
  dataSlideMetrics,
  fitFontSize,
  layoutRenderScale,
  resolveLayout,
  parseInline,
  stripInline,
  type LayoutColumn,
  type LayoutItem,
  type SlideIconId,
  type SlideLayoutId,
} from "@/lib/limioLiveSlides";
import { DATA_CONTENT_W, sourceLine, tableFontSize } from "@/lib/limioLiveCharts";
import { apiUrl } from "@/lib/apiUrl";
import { fitScaleForBox, frameHeightForContent, measureContentBox } from "@/lib/limioLiveFit";
import { brandCssVars, brandEffectiveThemeId, brandFrameBackground, contentScaleForLogo, logoPlacement, logoVisibleOn, slideRole } from "@/lib/limioLiveBrand";
import { MOTIF_SLOT_SIZE, type MotifSlot, type SlideArtId } from "@/lib/limioLiveMotifs";
import { motifSvgBody } from "@/lib/limioLiveMotifArt";
import { useLiveBrand } from "./liveBrandContext";
import { ChartView, TableView } from "./SlideCharts";
import { useSlideMotif } from "./liveMotifContext";
import { isDarkTheme, layoutThemeClass, motifOpacityFor, slideBgFor } from "./slideThemes";
import "./slideLayouts.css";

// Bộ vẽ slide Nội dung theo bố cục. Thiết kế ở khung 1280 × 720 rồi co theo khung chứa
// (giữ tỉ lệ, căn giữa) — cùng một cách ở trình chiếu, ảnh thu nhỏ và xem trước khi soạn.
// Nền do khung ngoài (giao diện bài giảng) quyết định; ở đây chỉ vẽ chữ và các khối.

const DESIGN_W = 1280;
const DESIGN_H = 720;

/** Biểu tượng của từng thẻ; dùng chung với trình sửa slide để chọn biểu tượng bằng hình. */
export const LAYOUT_ICONS: Record<SlideIconId, LucideIcon> = {
  target: Target,
  compass: Compass,
  route: Route,
  chat: MessageCircle,
  book: BookOpen,
  sparkle: Sparkles,
  users: Users,
  chart: BarChart3,
};

type Cfg = Record<string, any>;

/** Vẽ chữ có **in đậm** và *in nghiêng* (chỉ hai định dạng này, xem parseInline). */
function Inline({ text }: { text: string }) {
  return (
    <>
      {parseInline(text ?? "").map((r, i) => {
        let node: ReactNode = r.text;
        if (r.italic) node = <em key={`e${i}`}>{node}</em>;
        if (r.bold) node = <strong key={`b${i}`}>{node}</strong>;
        return <span key={i}>{node}</span>;
      })}
    </>
  );
}
// Trên máy chủ useLayoutEffect không chạy và báo cảnh báo; dùng useEffect ở đó (ở trình duyệt vẫn chạy trước khi vẽ).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;
const delay = (i: number): CSSProperties => ({ ["--i" as string]: i }) as CSSProperties;

/** Slide có dùng bố cục mới (không phải "classic")? */
export function isLayoutSlide(config: Cfg | undefined): boolean {
  return resolveLayout(config) !== "classic" && !config?.resource;
}

export function LayoutSlideView({
  config,
  themeId,
  slideId,
  animate = false,
  zoom = 1,
  frame = false,
}: {
  config: Cfg;
  themeId?: string | null;
  /** Slide đang vẽ (để biết thứ tự ô hình khi tự chọn hoa văn); bỏ trống ở ảnh mẫu. */
  slideId?: string;
  animate?: boolean;
  /** Thu phóng của người trình chiếu: nhân với tỉ lệ vừa khung; phóng to hơn khung thì cuộn được. */
  zoom?: number;
  /** Trình sửa: vẽ viền khung hình 16:9 trên nền trang; phần chữ nằm dưới viền là phần phải cuộn mới thấy. */
  frame?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  // Tự co: slide có chữ quá dài thì thu khối nội dung cho vừa khung 1280×720 thay vì để chữ tràn ra ngoài và bị cắt.
  // Khi người xem phóng to thì thôi co: chữ giữ cỡ thật, khung cao thêm cho vừa nội dung và cuộn để đọc tiếp.
  const zoomed = zoom > 1;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [fitK, setFitK] = useState(1);
  const [frameH, setFrameH] = useState(DESIGN_H);
  const configKey = JSON.stringify(config);
  // Thương hiệu của bài giảng: màu thay màu nhấn của giao diện; logo vẽ trong khung thiết kế (co cùng slide)
  // và nội dung thu nhỏ vừa đủ để chừa chỗ, không chồng chữ.
  const brand = useLiveBrand();
  const layout = resolveLayout(config);
  const showLogo = !!brand?.logoUrl && logoVisibleOn(brand.logoShow, slideRole(layout));
  const k = showLogo && brand ? contentScaleForLogo(brand.logoSize) : 1;
  const top = !!brand && brand.logoPos[0] === "t";
  useIsoLayoutEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    let alive = true;
    const run = () => {
      if (!alive) return;
      const box = measureContentBox(root);
      setFrameH(frameHeightForContent(box));
      // Hệ số co chỉ đo được khi khung đang ở 720 (nội dung căn giữa theo khung); đang phóng to thì giữ giá trị cũ.
      if (!zoomed) {
        // Có logo thì nội dung đã bị thu k lần và dịch xuống: đổi hộp đo về toạ độ cuối cùng trên khung rồi mới tính độ co.
        const dx = (DESIGN_W * (1 - k)) / 2;
        const dy = top ? DESIGN_H * (1 - k) : 0;
        setFitK(
          fitScaleForBox(
            box && k < 1 ? { top: box.top * k + dy, bottom: box.bottom * k + dy, left: box.left * k + dx, right: box.right * k + dx } : box,
          ),
        );
      }
    };
    run();
    // Phông chữ tải xong có thể đổi số dòng của chữ: đo lại một lần.
    void document.fonts?.ready.then(run);
    return () => {
      alive = false;
    };
  }, [configKey, zoomed, k, top]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // offsetWidth/Height gồm cả thanh cuộn: tỉ lệ vừa khung không đổi khi phóng to làm hiện thanh cuộn.
    const measure = () => {
      if (el.offsetWidth > 0 && el.offsetHeight > 0) {
        setFit(Math.min(el.offsetWidth / DESIGN_W, el.offsetHeight / DESIGN_H));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const scale = layoutRenderScale(fit, zoom);
  const slideH = zoomed ? frameH : DESIGN_H;
  const brandVars = brandCssVars(brand, isDarkTheme(themeId));
  // Nền xuyệt tông: bộ màu chữ mượn giao diện sáng/tối, nền vẽ ngay trên khung chứa để phủ kín khung slide.
  const effThemeId = brandEffectiveThemeId(brand, themeId);
  const frameBg = brandFrameBackground(brand, true);
  const motif = useSlideMotif(config, slideId);
  // Độ đậm an toàn của hoa văn ở góc, tính theo đúng nền và màu (kể cả màu thương hiệu) của slide này.
  const brandVarsKey = JSON.stringify(brandVars);
  const motifOpacity = useMemo(
    () => (motif ? motifOpacityFor(effThemeId, frameBg ?? slideBgFor(themeId, true), brandVars) : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [!!motif, effThemeId, frameBg, themeId, brandVarsKey],
  );
  const body = (
    <div ref={bodyRef} style={{ position: "absolute", inset: 0 }}>
      <LayoutBody layout={layout} c={config} motif={motif} />
    </div>
  );
  const slideStyle: CSSProperties = zoomed
    ? { position: "absolute", left: 0, top: 0, transformOrigin: "0 0", transform: `scale(${scale})`, height: slideH }
    : {
        position: "absolute",
        left: "50%",
        top: "50%",
        transformOrigin: "0 0",
        transform: `translate(${(-DESIGN_W * scale) / 2}px, ${(-DESIGN_H * scale) / 2}px) scale(${scale})`,
      };
  const slide = (
      <div
        className={`lslide ${layoutThemeClass(effThemeId)} ${animate ? "anim" : ""}`}
        style={{
          ...slideStyle,
          visibility: scale > 0 ? "visible" : "hidden",
          ...(frame ? { background: frameBg ?? slideBgFor(themeId, true), boxShadow: "0 10px 30px rgba(32, 36, 31, .14)" } : null),
          ...(brandVars as CSSProperties),
          ["--smo" as string]: motifOpacity,
        }}
      >
        <div style={{ position: "absolute", inset: 0, transformOrigin: "50% 50%", ...(fitK < 1 && !zoomed ? { transform: `scale(${fitK})` } : null) }}>
          {showLogo ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                transformOrigin: "0 0",
                transform: `translate(${(DESIGN_W * (1 - k)) / 2}px, ${top ? slideH * (1 - k) : 0}px) scale(${k})`,
              }}
            >
              {body}
            </div>
          ) : (
            body
          )}
        </div>
        {showLogo && brand?.logoUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={apiUrl(brand.logoUrl)}
            alt=""
            aria-hidden
            draggable={false}
            style={{ position: "absolute", zIndex: 5, width: "auto", maxWidth: 280, objectFit: "contain", ...logoPlacement(brand.logoPos, brand.logoSize) }}
          />
        )}
        {frame && (
          <>
            {/* Viền khung hình 16:9; dày theo tỉ lệ để luôn thấy rõ ở mọi mức thu phóng. */}
            <div
              aria-hidden
              style={{
                position: "absolute",
                left: 0,
                top: 0,
                width: DESIGN_W,
                height: DESIGN_H,
                zIndex: 6,
                pointerEvents: "none",
                boxShadow: `inset 0 0 0 ${Math.max(2, 2.5 / Math.max(scale, 0.1))}px rgba(95, 105, 125, .6)`,
              }}
            />
            {slideH > DESIGN_H && (
              <div
                aria-hidden
                style={{
                  position: "absolute",
                  left: 0,
                  top: DESIGN_H,
                  width: DESIGN_W,
                  bottom: 0,
                  zIndex: 6,
                  pointerEvents: "none",
                  background: "rgba(32, 36, 31, .08)",
                  color: "rgba(32, 36, 31, .55)",
                  fontSize: 22,
                  fontWeight: 600,
                  textAlign: "center",
                  display: "flex",
                  alignItems: "flex-end",
                  justifyContent: "center",
                  paddingBottom: 12,
                }}
              >
                Ngoài khung hình: khi chiếu phóng to phải cuộn mới thấy
              </div>
            )}
          </>
        )}
      </div>
  );
  return (
    <div
      ref={ref}
      className={`relative min-h-0 w-full flex-1 ${zoomed ? "overflow-auto" : "overflow-hidden"}`}
      style={frameBg && !frame ? { background: frameBg } : undefined}
    >
      {zoomed ? (
        // Phóng to hơn khung: ô chứa đúng cỡ slide đã phóng, căn giữa bằng margin auto (nhỏ hơn khung thì ở giữa,
        // lớn hơn thì bắt đầu từ mép và cuộn được).
        <div style={{ display: "flex", minWidth: "100%", minHeight: "100%" }}>
          <div style={{ position: "relative", flex: "none", margin: "auto", width: DESIGN_W * scale, height: slideH * scale }}>{slide}</div>
        </div>
      ) : (
        slide
      )}
    </div>
  );
}

function Title({
  text,
  className,
  maxPx,
  widthPx,
  maxLines,
  style,
}: {
  text: string;
  className?: string;
  maxPx: number;
  widthPx: number;
  maxLines: number;
  style?: CSSProperties;
}) {
  const { px } = fitFontSize(stripInline(text), { maxPx, widthPx, maxLines });
  return (
    <h2 className={`h a ${className ?? ""}`} style={{ fontSize: px, ...style }}>
      <Inline text={text} />
    </h2>
  );
}

function Glows({ a, b }: { a: CSSProperties; b: CSSProperties }) {
  return (
    <>
      <div className="glow" style={{ ...a, background: "var(--sglow1)" }} />
      <div className="glow" style={{ ...b, background: "var(--sglow2)" }} />
    </>
  );
}

/**
 * Hoa văn trang trí hoặc hình minh hoạ ở ô hình (limioLiveMotifs): SVG tự vẽ, màu theo biến giao diện. Thân SVG do mã của ta sinh ra từ
 * một mã hoa văn trong danh sách cố định, không chứa chữ của người dùng, nên chèn thẳng được.
 */
function SlideMotif({ motif, slot }: { motif: SlideArtId; slot: MotifSlot }) {
  const uid = `m${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const [w, h] = MOTIF_SLOT_SIZE[slot];
  const html = useMemo(
    () => `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${motifSvgBody(motif, w, h, uid)}</svg>`,
    [motif, w, h, uid],
  );
  return <div className={`motif m-${slot}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

type Motif = { motif: SlideArtId; slot: MotifSlot } | null;

/** Mỗi slide chỉ một lớp trang trí: có hoa văn thì bỏ hai vệt sáng mờ. */
function Decor({ motif, a, b }: { motif: Motif; a: CSSProperties; b: CSSProperties }) {
  return motif ? <SlideMotif motif={motif.motif} slot={motif.slot} /> : <Glows a={a} b={b} />;
}

function LayoutBody({ layout, c, motif }: { layout: SlideLayoutId; c: Cfg; motif: Motif }) {
  const items: LayoutItem[] = Array.isArray(c.items) ? c.items : [];
  const title: string = c.title ?? "";

  switch (layout) {
    case "cover": {
      const plain = stripInline(title);
      const { head, tail } = accentTail(plain);
      const { px } = fitFontSize(plain, { maxPx: 96, widthPx: 800, maxLines: 3 });
      return (
        <div className="ll-cover">
          <Decor
            motif={motif}
            a={{ width: 380, height: 380, left: -90, top: -100 }}
            b={{ width: 420, height: 420, right: -80, bottom: -140 }}
          />
          <div className="pad">
            <div style={{ maxWidth: 800 }}>
              <h1 className="h a" style={{ fontSize: px }}>
                {head}
                {tail && (
                  <>
                    {head ? " " : ""}
                    <span className="grad">{tail}</span>
                  </>
                )}
              </h1>
              {c.subtitle && (
                <p className="lead a" style={{ ...delay(1), marginTop: 30, maxWidth: 720 }}>
                  <Inline text={c.subtitle} />
                </p>
              )}
              {c.byline && (
                <p className="byline a" style={delay(2)}>
                  <Inline text={c.byline} />
                </p>
              )}
            </div>
          </div>
          {/* Hoa văn chiếm dải phải của bìa; không có hoa văn thì giữ chồng thẻ cũ. */}
          {!motif && (
            <div className="stack" aria-hidden="true">
              <i className="a-pop" style={delay(1)} />
              <i className="a-pop" style={delay(2)} />
              <i className="a-pop" style={delay(3)}>
                <MessageCircle size={120} strokeWidth={1.6} />
              </i>
            </div>
          )}
        </div>
      );
    }

    case "section": {
      // Bìa phần có mục lục (dàn ý theo mạch cấu trúc): trái là số và tên phần, phải là các phần của bài.
      const toc: string[] = Array.isArray(c.toc) ? c.toc.filter((t: unknown) => typeof t === "string") : [];
      const cur = Number(c.tocCurrent);
      if (toc.length >= 2 && cur >= 1 && cur <= toc.length) {
        const no = /^\d+$/.test(String(c.sectionNumber ?? "")) ? String(Number(c.sectionNumber)) : String(c.sectionNumber ?? cur);
        return (
          <div className="ll-section ll-section-toc">
            <Decor
              motif={motif}
              a={{ width: 460, height: 460, left: -160, top: -160 }}
              b={{ width: 380, height: 380, right: -120, bottom: -180 }}
            />
            <div className="pad">
              <div className="left">
                <div className="num a-pop">{no}</div>
                <Title text={title} maxPx={64} widthPx={540} maxLines={3} style={{ ...delay(1), marginTop: 26 }} />
                {c.subtitle && (
                  <p className="lead a" style={{ ...delay(2), marginTop: 22 }}>
                    <Inline text={c.subtitle} />
                  </p>
                )}
              </div>
              <ol className="toc">
                {toc.map((t, i) => {
                  const st = i + 1 < cur ? "done" : i + 1 === cur ? "now" : "next";
                  return (
                    <li key={i} className={`a ${st}`} style={delay(3 + i)} aria-current={st === "now" ? "step" : undefined}>
                      <span className="mk">{st === "done" ? <Check size={28} strokeWidth={3} aria-label="Đã học" /> : i + 1}</span>
                      <span>{t}</span>
                    </li>
                  );
                })}
              </ol>
            </div>
          </div>
        );
      }
      return (
        <div className="ll-section">
          <Decor
            motif={motif}
            a={{ width: 460, height: 460, right: -120, top: -120 }}
            b={{ width: 380, height: 380, right: 140, bottom: -200 }}
          />
          <div className="pad">
            {c.sectionNumber && <div className="num a-pop">{c.sectionNumber}</div>}
            <Title text={title} maxPx={84} widthPx={980} maxLines={2} style={{ ...delay(1) }} />
            {c.subtitle && (
              <p className="lead a" style={{ ...delay(2), marginTop: 22, maxWidth: 820 }}>
                <Inline text={c.subtitle} />
              </p>
            )}
          </div>
        </div>
      );
    }

    case "image": {
      const bullets: string[] = Array.isArray(c.bullets) ? c.bullets : [];
      return (
        <div className="ll-image">
          <div className="pad">
            <div className="tx">
              <Title text={title} maxPx={60} widthPx={560} maxLines={3} />
              <ul className="bul">
                {bullets.map((b, i) => (
                  <li key={i} className="a" style={delay(i + 1)}>
                    <Inline text={b} />
                  </li>
                ))}
              </ul>
            </div>
            <div className="art a-pop" style={delay(1)}>
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                motif && <SlideMotif motif={motif.motif} slot={motif.slot} />
              )}
            </div>
          </div>
        </div>
      );
    }

    case "cards":
      return (
        <div className="ll-cards">
          <div className="pad">
            <Title text={title} maxPx={72} widthPx={1088} maxLines={2} />
            <div className="row" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, 1fr)` }}>
              {items.map((it, i) => {
                const Icon = LAYOUT_ICONS[it.icon ?? "target"] ?? Target;
                return (
                  <div key={i} className="card it a" style={delay(i)}>
                    <span className="no">{i + 1}</span>
                    <div className="badge">
                      <Icon size={36} strokeWidth={2} />
                    </div>
                    <b>
                      <Inline text={it.heading} />
                    </b>
                    <p>
                      <Inline text={it.body} />
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

    case "compare": {
      const cols: LayoutColumn[] = Array.isArray(c.columns) ? c.columns : [];
      return (
        <div className="ll-compare">
          <div className="pad">
            <Title text={title} maxPx={72} widthPx={1088} maxLines={2} />
            <div className="cols">
              {cols.map((col, i) => (
                <div key={i} className={`card col ${col.tone === "bad" ? "bad" : "good"} a`} style={delay(i * 2)}>
                  <div className="ttl">
                    {col.tone === "bad" ? <X size={38} strokeWidth={2.6} /> : <Check size={38} strokeWidth={2.6} />}
                    <Inline text={col.heading} />
                  </div>
                  {col.points.map((p, k) => (
                    <div key={k} className="q">
                      <Inline text={p} />
                    </div>
                  ))}
                  {col.note && (
                    <div className="why">
                      <Inline text={col.note} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    case "steps":
      return (
        <div className="ll-steps">
          <div className="pad">
            <Title text={title} maxPx={72} widthPx={1088} maxLines={2} />
            <div className="row" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, 1fr)` }}>
              {items.map((it, i) => (
                <div key={i} className="st a-pop" style={delay(i * 2)}>
                  <div className="circ">{i + 1}</div>
                  <b>
                    <Inline text={it.heading} />
                  </b>
                  <p>
                    <Inline text={it.body} />
                  </p>
                </div>
              ))}
            </div>
            {c.footnote && (
              <div className="loop a" style={delay(items.length * 2)}>
                <Repeat size={30} /> <Inline text={c.footnote} />
              </div>
            )}
          </div>
        </div>
      );

    case "stats":
      return (
        <div className="ll-stats">
          <div className="pad">
            <Title text={title} maxPx={72} widthPx={1088} maxLines={2} />
            <div className="row" style={{ gridTemplateColumns: `repeat(${Math.max(items.length, 1)}, 1fr)` }}>
              {items.map((it, i) => (
                <div key={i} className="card st a" style={delay(i)}>
                  <div className="big grad">{it.heading}</div>
                  <p>
                    <Inline text={it.body} />
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "quote": {
      const q: string = c.quote ?? "";
      const qPlain = stripInline(q);
      const { head, tail } = accentTail(qPlain);
      const { px } = fitFontSize(qPlain, { maxPx: 66, widthPx: 1000, maxLines: 4 });
      return (
        <div className="ll-quote">
          <Decor
            motif={motif}
            a={{ width: 420, height: 420, left: -120, bottom: -160 }}
            b={{ width: 380, height: 380, right: -100, top: -120 }}
          />
          <div className="pad">
            <div className="mark a-pop">“</div>
            <div className="qt a" style={{ ...delay(1), fontSize: px }}>
              {head}
              {tail && (
                <>
                  {head ? " " : ""}
                  <span className="grad">{tail}</span>
                </>
              )}
            </div>
            {c.source && (
              <div className="who a" style={delay(3)}>
                <i />
                <Inline text={c.source} />
              </div>
            )}
          </div>
        </div>
      );
    }

    case "summary":
      return (
        <div className="ll-summary">
          <div className="pad">
            <Title text={title} maxPx={72} widthPx={1088} maxLines={2} />
            <div className="list">
              {items.map((it, i) => (
                <div key={i} className="card rowi a" style={delay(i)}>
                  <div className="tick">
                    <Check size={34} strokeWidth={2.8} />
                  </div>
                  <span>
                    <Inline text={it.heading} />
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "table":
    case "chart": {
      // Tiêu đề, khung dữ liệu và dòng nguồn: chiều cao khung tính trước (dataSlideMetrics) để SVG vẽ đúng cỡ chữ thật.
      const m = dataSlideMetrics(c);
      const src = sourceLine(c.source);
      const head: string[] = Array.isArray(c.head) ? c.head : [];
      const rows: string[][] = Array.isArray(c.rows) ? c.rows : [];
      return (
        <div className={layout === "table" ? "ll-table" : "ll-chart"}>
          <div className="pad">
            {title && <Title text={title} maxPx={m.titlePx} widthPx={DATA_CONTENT_W} maxLines={2} />}
            {layout === "table" ? (
              <TableView head={head} rows={rows} px={tableFontSize(head, rows, DATA_CONTENT_W - 20, m.boxH).px} />
            ) : (
              <ChartView cfg={c} width={DATA_CONTENT_W} height={m.boxH} />
            )}
            {src && (
              <p className="src a" style={delay(4)}>
                {src}
              </p>
            )}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}
