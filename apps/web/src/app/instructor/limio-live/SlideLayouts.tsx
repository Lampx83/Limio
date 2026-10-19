"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import {
  BarChart3,
  BookOpen,
  Check,
  Clock,
  Compass,
  GraduationCap,
  Heart,
  Lightbulb,
  MessageCircle,
  Repeat,
  Rocket,
  Route,
  Search,
  Settings,
  ShieldCheck,
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
  LIST_BOX,
  listFontSize,
  listWordPx,
  listTitleFit,
  MIN_FONT_PX,
  resolveLayout,
  stripInline,
  type LayoutColumn,
  type LayoutItem,
  type ListLine,
  type SlideIconId,
  type SlideLayoutId,
} from "@/lib/limioLiveSlides";
import { DATA_CONTENT_W, sourceLine, tableFontSize } from "@/lib/limioLiveCharts";
import { groupHeadPx, groupsFit, isNegativeAsk, numberOf, type SlideGroup } from "@/lib/limioLiveGroups";
import { autoGroupIcons } from "@/lib/limioLiveIcons";
import { apiUrl } from "@/lib/apiUrl";
import {
  betterFit,
  boxFits,
  cardHeadingPx,
  CONTENT_W,
  fitScaleForBox,
  frameHeightForContent,
  imageArtWidth,
  keepHyphenated,
  LOGO_SHIFT_MAX,
  logoShiftFor,
  logoShiftPx,
  measureContentBox,
  pickFontStep,
  safeAreaFor,
  titleFontPx,
  type FontFit,
  type LogoBand,
} from "@/lib/limioLiveFit";
import { brandCssVars, brandEffectiveThemeId, brandFrameBackground, logoBand, logoPlacement, logoVisibleOn, slideRole } from "@/lib/limioLiveBrand";
import { MOTIF_SLOT_SIZE, type MotifSlot, type SlideArtId } from "@/lib/limioLiveMotifs";
import { motifSvgBody } from "@/lib/limioLiveMotifArt";
import { slideImageSources } from "@/lib/limioLiveImage";
import { shortUrl } from "@/lib/limioLiveWebImages";
import { isSlideIllustrationId } from "@feedbackme/shared-types";
import { useLiveBrand } from "./liveBrandContext";
import { ChartView, TableView } from "./SlideCharts";
import { useSlideMotif } from "./liveMotifContext";
import { isDarkTheme, layoutThemeClass, motifOpacityFor, slideBgFor } from "./slideThemes";
import { CoverSlide } from "./CoverSlide";
import { Inline, delay } from "./slideInline";
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
  bulb: Lightbulb,
  shield: ShieldCheck,
  search: Search,
  gear: Settings,
  cap: GraduationCap,
  heart: Heart,
  rocket: Rocket,
  clock: Clock,
};

type Cfg = Record<string, any>;

// Trên máy chủ useLayoutEffect không chạy và báo cảnh báo; dùng useEffect ở đó (ở trình duyệt vẫn chạy trước khi vẽ).
const useIsoLayoutEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

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
  // Cho vừa khung 1280×720 mà không phí chỗ (limioLiveFit): chữ dài thì giảm cỡ chữ theo bậc (biến CSS --fs, sàn 26 px), khung,
  // cột và thẻ giữ nguyên bề ngang nên chữ chảy lại thành ít dòng hơn. Chỉ khi chữ đã ở bậc cuối mà vẫn tràn mới thu cả khối
  // (fitK) như trước. Khi người xem phóng to thì chữ giữ cỡ gốc: khung cao thêm cho vừa nội dung và cuộn để đọc tiếp.
  const zoomed = zoom > 1;
  const bodyRef = useRef<HTMLDivElement>(null);
  const [fitK, setFitK] = useState(1);
  const [fs, setFs] = useState(1);
  const [cols, setCols] = useState<1 | 2>(1);
  const [shift, setShift] = useState(0);
  const [frameH, setFrameH] = useState(DESIGN_H);
  const configKey = JSON.stringify(config);
  // Thương hiệu của bài giảng: màu thay màu nhấn của giao diện; logo vẽ trong khung thiết kế (co cùng slide). Logo chỉ chiếm
  // phần đệm ở phía của nó: khung nội dung dịch vào khi chữ chạm logo, không thu nhỏ cả slide.
  const brand = useLiveBrand();
  const layout = resolveLayout(config);
  const showLogo = !!brand?.logoUrl && logoVisibleOn(brand.logoShow, slideRole(layout));
  const band: LogoBand | null = showLogo && brand ? logoBand(brand.logoPos, brand.logoSize) : null;
  const bandKey = band ? `${band.pos}${band.heightPx}` : "";
  useIsoLayoutEffect(() => {
    const root = bodyRef.current;
    if (!root) return;
    let alive = true;
    const setVars = (f: number, sh: number) => {
      root.style.setProperty("--fs", String(f));
      root.style.setProperty("--lgt", band?.pos === "t" ? `${sh}px` : "0px");
      root.style.setProperty("--lgb", band?.pos === "b" ? `${sh}px` : "0px");
    };
    const run = () => {
      if (!alive) return;
      // Ở mỗi bậc cỡ chữ, dịch khung nội dung khỏi dải logo đúng phần bị lấn ở bậc đó (đo lại vì khối căn giữa chỉ dời nửa
      // khoảng dịch, nên cộng dồn vài lần). Tính riêng từng bậc để phần tràn do chữ dài không bị nhầm thành chỗ phải nhường cho logo.
      const shiftAt = (f: number) => {
        let sh = 0;
        setVars(f, 0);
        let box = measureContentBox(root);
        for (let i = 0; i < 6 && sh < LOGO_SHIFT_MAX; i++) {
          const more = logoShiftFor(box, band);
          if (!more) break;
          sh = Math.min(LOGO_SHIFT_MAX, sh + more);
          setVars(f, sh);
          box = measureContentBox(root);
        }
        return { sh, box };
      };
      if (zoomed) {
        // Đang phóng to: giữ chữ cỡ gốc, chỉ đo chiều cao khung; hệ số co giữ giá trị cũ.
        const z = shiftAt(1);
        setFrameH(frameHeightForContent(z.box));
        setFs(1);
        setShift(z.sh);
        return;
      }
      const safe = safeAreaFor(band);
      // Tóm tắt nhiều dòng: thử một cột rồi hai cột, giữ cách cho chữ lớn hơn.
      const list = root.querySelector<HTMLElement>(".ll-summary .list");
      const variants: Array<1 | 2> = list && list.children.length >= 4 ? [1, 2] : [1];
      let best: (FontFit & { sh: number; cols: 1 | 2 }) | null = null;
      for (const n of variants) {
        list?.classList.toggle("two", n === 2);
        const shifts = new Map<number, number>();
        const measureAt = (f: number) => {
          const r = shiftAt(f);
          shifts.set(f, r.sh);
          return r.box;
        };
        // Bìa có cỡ chữ riêng từng kiểu, không theo --fs: chỉ đo một lần.
        const r: FontFit =
          layout === "cover" ? (() => { const box = measureAt(1); return { fs: 1, fits: boxFits(box, safe), box }; })() : pickFontStep(measureAt, safe);
        if (!best || betterFit(best, r) !== best) best = { ...r, sh: shifts.get(r.fs) ?? 0, cols: n };
      }
      const b = best!;
      list?.classList.toggle("two", b.cols === 2);
      // Chiều cao khung khi phóng to (chữ cỡ gốc), rồi trả về bậc đã chọn.
      setFrameH(frameHeightForContent(shiftAt(1).box));
      setVars(b.fs, b.sh);
      setFs(b.fs);
      setCols(b.cols);
      setShift(b.sh);
      setFitK(b.fits ? 1 : fitScaleForBox(b.box, safe));
    };
    run();
    // Phông chữ tải xong có thể đổi số dòng của chữ: đo lại một lần.
    void document.fonts?.ready.then(run);
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configKey, zoomed, bandKey, layout]);

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
  const bodyVars = {
    "--fs": fs,
    "--lgt": band?.pos === "t" ? `${shift}px` : "0px",
    "--lgb": band?.pos === "b" ? `${shift}px` : "0px",
  } as CSSProperties;
  const body = (
    <div ref={bodyRef} style={{ position: "absolute", inset: 0, ...bodyVars }}>
      <LayoutBody
        layout={layout}
        c={config}
        motif={motif}
        cols={cols}
        dataReserve={band ? logoShiftPx(band) : 0}
        artPx={scale > 0 ? IMAGE_SLOT_W * scale * fitK : 0}
      />
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
          {body}
        </div>
        {typeof config.cite === "string" && config.cite && (
          // Dòng nguồn của bài soạn kèm trang tìm trên internet: góc dưới trái, chữ nhỏ nhất cho phép, không chồng nội dung.
          <div className="ll-cite">{config.cite}</div>
        )}
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

/** Cỡ chữ theo bậc --fs của slide, không dưới sàn (mặc định 26 px). */
const scaled = (px: number, floor = MIN_FONT_PX) => `max(${floor}px, calc(${px}px * var(--fs, 1)))`;

function Title({
  text,
  className,
  maxPx,
  widthPx,
  maxLines,
  oneLine = true,
  style,
}: {
  text: string;
  className?: string;
  maxPx: number;
  widthPx: number;
  maxLines: number;
  /** Vừa một dòng ở cỡ ≥ 80% thì dùng một dòng (titleFontPx); slide dữ liệu tắt vì chiều cao khung đã tính theo cỡ cũ. */
  oneLine?: boolean;
  style?: CSSProperties;
}) {
  const plain = stripInline(text);
  const px = oneLine ? titleFontPx(plain, { maxPx, widthPx, maxLines }) : fitFontSize(plain, { maxPx, widthPx, maxLines }).px;
  return (
    <h2 className={`h a ${className ?? ""}`} style={{ fontSize: scaled(px), ...style }}>
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
  // Hình minh hoạ vẽ bằng khối đặc nên trông nặng hơn hoa văn (vốn là nét mảnh, nhạt): lớp m-illus hạ độ đậm cả hình.
  const illus = isSlideIllustrationId(motif) ? " m-illus" : "";
  return <div className={`motif m-${slot}${illus}`} aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} />;
}

/**
 * Dòng nguồn ảnh dưới ô hình. Có trang nguồn (imageSourceUrl, http/https) thì là link mở trang đó ở thẻ mới; chặn lan sự kiện
 * để bấm link trong trình sửa không mở hộp sửa slide.
 */
function ImageCredit({ c }: { c: Cfg }) {
  const text = `Nguồn ảnh: ${c.imageCredit}`;
  const href = typeof c.imageSourceUrl === "string" && /^https?:\/\//i.test(c.imageSourceUrl) ? c.imageSourceUrl : null;
  return (
    <p className="img-credit" title={href ? `${text}\n${href}` : text}>
      {href ? (
        <a href={href} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
          {text}
        </a>
      ) : (
        text
      )}
    </p>
  );
}

type Motif = { motif: SlideArtId; slot: MotifSlot } | null;

/** Bề rộng ô hình của bố cục Chữ và hình trên khung thiết kế (cùng số với MOTIF_SLOT_SIZE.fill). */
const IMAGE_SLOT_W = MOTIF_SLOT_SIZE.fill[0];

/**
 * Ảnh riêng ở ô hình. Ảnh do máy chủ xử lý có srcset 480/960/bản hiển thị; `px` là bề rộng thật của ô trên màn
 * hình (đã nhân tỉ lệ thu phóng), nên dải slide thu nhỏ chỉ tải bản 480 còn máy chiếu lớn mới tải bản lớn.
 * Chưa đo được khung thì đoán theo bề rộng cửa sổ (ô hình chiếm khoảng 36% bề rộng slide).
 */
function SlideImage({ c, px }: { c: Cfg; px: number }) {
  const s = slideImageSources(String(c.imageUrl));
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={s.src}
      srcSet={s.srcSet}
      sizes={s.srcSet ? (px > 0 ? `${Math.ceil(px)}px` : "37vw") : undefined}
      width={s.width}
      height={s.height}
      alt={typeof c.imageAlt === "string" ? c.imageAlt : ""}
      decoding="async"
      style={{ width: "100%", height: "100%", objectFit: c.imageFit === "contain" ? "contain" : "cover" }}
    />
  );
}

/** Mỗi slide chỉ một lớp trang trí: có hoa văn thì bỏ hai vệt sáng mờ. */
function Decor({ motif, a, b }: { motif: Motif; a: CSSProperties; b: CSSProperties }) {
  return motif ? <SlideMotif motif={motif.motif} slot={motif.slot} /> : <Glows a={a} b={b} />;
}

function LayoutBody({
  layout,
  c,
  motif,
  cols = 1,
  dataReserve = 0,
  artPx,
}: {
  layout: SlideLayoutId;
  c: Cfg;
  motif: Motif;
  /** Tóm tắt: số cột bộ đo đã chọn. */
  cols?: 1 | 2;
  /** Slide dữ liệu: chỗ nhường cho logo, khung bảng/biểu đồ thấp đi chừng đó. */
  dataReserve?: number;
  /** Bề rộng thật (px màn hình) của ô hình, để chọn bản ảnh vừa đủ nét. */
  artPx: number;
}) {
  const items: LayoutItem[] = Array.isArray(c.items) ? c.items : [];
  const title: string = c.title ?? "";

  switch (layout) {
    case "cover":
      // Mười kiểu bìa (CoverSlide); hoa văn của bài nằm trong vùng riêng của từng kiểu, không theo chỗ đặt "side".
      return <CoverSlide c={c} motif={motif?.motif ?? null} />;

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
                <Title text={title} maxPx={64} widthPx={540} maxLines={3} style={{ ...delay(1), marginTop: "calc(26px * var(--fs, 1))" }} />
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
      // Chữ càng dài thì ô hình càng hẹp, cột chữ rộng ra (56 = khoảng cách giữa hai cột trong slideLayouts.css).
      const artW = imageArtWidth(stripInline(title).length + bullets.reduce((n, b) => n + stripInline(b).length, 0));
      return (
        <div className="ll-image" style={{ ["--artw" as string]: `${artW}px` }}>
          <div className="pad">
            <div className="tx">
              <Title text={title} maxPx={60} widthPx={CONTENT_W - 56 - artW} maxLines={3} />
              <ul className="bul">
                {bullets.map((b, i) => (
                  <li key={i} className="a" style={delay(i + 1)}>
                    <span>
                      <Inline text={b} />
                    </span>
                  </li>
                ))}
              </ul>
            </div>
            <div className="art a-pop" style={delay(1)}>
              {c.imageUrl ? <SlideImage c={c} px={artPx} /> : motif && <SlideMotif motif={motif.motif} slot={motif.slot} />}
            </div>
          </div>
          {c.imageUrl && c.imageCredit ? <ImageCredit c={c} /> : null}
        </div>
      );
    }

    case "list": {
      // Danh sách: mọi dòng cùng một cỡ chữ, tự co theo tổng độ dài (listFontSize, ≥ 26 px) để slide nhiều chữ vẫn vừa.
      const lines: ListLine[] = Array.isArray(c.lines) ? c.lines : [];
      const hasImg = typeof c.imageUrl === "string" && !!c.imageUrl;
      const words: string[] = Array.isArray(c.words) ? c.words : [];
      const fs = listFontSize(lines, title, hasImg, words);
      const tf = listTitleFit(title);
      return (
        <div className={`ll-list${hasImg ? " img" : ""}`}>
          <div className="pad">
            <div className="tx">
              {title && <Title text={title} maxPx={tf.px} widthPx={LIST_BOX.width} maxLines={Math.max(tf.lines, 1)} />}
              {lines.length > 0 && (
                <ul className="lst" style={{ fontSize: fs.px }}>
                  {lines.map((l, i) => (
                    <li key={i} className={`a${l.sub ? " sub" : ""}`} style={delay(Math.min(i, 8) + 1)}>
                      {/* Một khối chữ: dòng là flex (dấu đầu dòng + chữ), các đoạn đậm/tô màu không được thành cột riêng. */}
                      <span>
                        <Inline text={l.text} />
                      </span>
                    </li>
                  ))}
                </ul>
              )}
              {words.length > 0 && (
                <p className="words" style={{ fontSize: listWordPx(fs.px) }}>
                  {words.map((w, i) => (
                    <span key={i} className={`a-pop${i % 2 ? " alt" : ""}`} style={delay(Math.min(lines.length, 8) + 1 + Math.min(i, 6))}>
                      {w}
                    </span>
                  ))}
                </p>
              )}
            </div>
            {hasImg && (
              <div className="art a-pop" style={delay(1)}>
                <SlideImage c={c} px={0} />
              </div>
            )}
          </div>
          {hasImg && c.imageCredit ? <ImageCredit c={c} /> : null}
        </div>
      );
    }

    case "groups": {
      const groups: SlideGroup[] = Array.isArray(c.groups) ? c.groups : [];
      const lead: string = typeof c.lead === "string" ? c.lead : "";
      const gf = groupsFit({ title, lead, groups, icons: c.icons !== false });
      const pad2 = (n: number) => String(n + 1).padStart(2, "0");
      // Biểu tượng của từng nhóm: giảng viên chọn tay thì giữ, còn lại tự chọn theo từ khoá (P61).
      const icons = gf.icons ? autoGroupIcons(groups) : [];
      const badge = (i: number, size: number) => {
        const Ic = LAYOUT_ICONS[icons[i] ?? "compass"];
        return (
          <span className="gbd" style={{ width: size, height: size }} aria-hidden>
            <Ic size={Math.round(size * 0.5)} strokeWidth={2} />
          </span>
        );
      };
      const pts = (g: SlideGroup, px: number, from = 0) =>
        g.points.length > 0 && (
          <ul className="gp" style={{ fontSize: px }}>
            {g.points.map((p, k) => (
              <li key={k} className="a" style={delay(from + k + 1)}>
                <span>
                  <Inline text={p} />
                </span>
              </li>
            ))}
          </ul>
        );
      // Một nhóm: câu dẫn (hoặc tên nhóm) to ở trên, tiêu đề slide thành dòng nhãn nhỏ.
      if (gf.variant === "ask" || gf.variant === "stats") {
        const g = groups[0] ?? { heading: "", points: [] };
        const ask = lead || g.heading;
        const label = lead && g.heading ? `${title} · ${g.heading.replace(/[:：]\s*$/, "")}` : title;
                const negative = isNegativeAsk(ask);
        const nums = g.points.filter((p) => numberOf(p));
        const rest = g.points.filter((p) => !numberOf(p));
        return (
          <div className={`ll-groups v-${gf.variant}`}>
            <div className="pad">
              {label && <p className="lab a">{label}</p>}
              <h2 className="ask a" style={{ fontSize: gf.px }}>
                <span className="hl">
                  <Inline text={ask} />
                </span>
              </h2>
              {gf.variant === "stats" ? (
                <>
                  <div className="gstats" style={{ gridTemplateColumns: `repeat(${nums.length}, 1fr)` }}>
                    {nums.map((p, i) => (
                      <div key={i} className="gstat a-pop" style={delay(i + 1)}>
                        <span className="n">{numberOf(p)}</span>
                        <span className="d" style={{ fontSize: gf.px }}>
                          <Inline text={p} />
                        </span>
                      </div>
                    ))}
                  </div>
                  {rest.length > 0 && (
                    <div className="gchips">
                      {rest.map((p, i) => (
                        <div key={i} className="gchip a" style={{ ...delay(nums.length + i + 1), fontSize: Math.max(26, gf.px - 4) }}>
                          <Inline text={p} />
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className="grows" style={{ fontSize: gf.px }}>
                  {g.points.map((p, i) => (
                    <div key={i} className={`grow a${negative ? " x" : ""}`} style={delay(i + 1)}>
                      <span className="k">{negative ? "×" : i + 1}</span>
                      <span>
                        <Inline text={p} />
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      }
      return (
        <div className={`ll-groups v-${gf.variant}`}>
          <div className="pad">
            {title && <Title text={title} maxPx={52} widthPx={1152} maxLines={2} />}
            {lead && (
              <p className="glead a" style={delay(1)}>
                <Inline text={lead} />
              </p>
            )}
            {gf.variant === "cards" ? (
              <div className="gcards" style={{ gridTemplateColumns: `repeat(${Math.max(groups.length, 1)}, 1fr)` }}>
                {groups.map((g, i) => (
                  <div key={i} className={`gcard a${gf.icons ? " ic" : ""}`} style={delay(i + 1)}>
                    {gf.icons && (
                      <div className="gtop">
                        {badge(i, 76)}
                        <span className="no">{i + 1}</span>
                      </div>
                    )}
                    <b className="gh" style={{ fontSize: groupHeadPx(gf.px) }}>
                      {!gf.icons && <span className="no">{pad2(i)}</span>}
                      <span className="hl">
                        <Inline text={g.heading} />
                      </span>
                    </b>
                    {pts(g, gf.px, i)}
                  </div>
                ))}
              </div>
            ) : (
              <div className={`glist${gf.cols === 2 ? " c2" : ""}`}>
                {groups.map((g, i) => (
                  <div key={i} className="grp a" style={delay(i + 1)}>
                    <b className="gh" style={{ fontSize: groupHeadPx(gf.px) }}>
                      {gf.icons ? badge(i, 46) : <span className="no">{pad2(i)}</span>}
                      <span className="hl">
                        <Inline text={g.heading} />
                      </span>
                    </b>
                    {pts(g, gf.px, i)}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    case "cards":
      return (
        <div className="ll-cards" style={{ ["--hpx" as string]: `${cardHeadingPx(items.map((it) => stripInline(it.heading)), items.length)}px` }}>
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
                      <Inline text={keepHyphenated(it.heading)} />
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
                    <span>
                      <Inline text={col.heading} />
                    </span>
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
                    <Inline text={keepHyphenated(it.heading)} />
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
            <div className="qt a" style={{ ...delay(1), fontSize: scaled(px) }}>
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
                <span>
                  <Inline text={c.source} />
                </span>
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
            <div className={`list${cols === 2 ? " two" : ""}`}>
              {items.map((it, i) => {
                // Dòng có link (slide Nguồn tham khảo của bài có nguồn internet): số [n], tên trang, địa chỉ rút gọn; bấm mở
                // trang nguồn ở thẻ mới. Chặn lan sự kiện để bấm link trong trình sửa không mở hộp sửa slide.
                if (typeof it.href === "string" && it.href) {
                  const m = /^\s*\[(\d+)\]\s*/.exec(it.heading);
                  return (
                    <a
                      key={i}
                      href={it.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="refl a"
                      style={delay(i)}
                      title={it.href}
                    >
                      <span className="refn">{m ? `[${m[1]}]` : ""}</span>
                      <span className="reft">
                        <b>
                          <Inline text={m ? it.heading.slice(m[0].length) : it.heading} />
                        </b>
                        <small>{shortUrl(it.href)}</small>
                      </span>
                    </a>
                  );
                }
                return (
                  <div key={i} className="card rowi a" style={delay(i)}>
                    <div className="tick">
                      <Check size={34} strokeWidth={2.8} />
                    </div>
                    <span>
                      <Inline text={it.heading} />
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      );

    case "table":
    case "chart": {
      // Tiêu đề, khung dữ liệu và dòng nguồn: chiều cao khung tính trước (dataSlideMetrics) để SVG vẽ đúng cỡ chữ thật.
      const m = dataSlideMetrics(c, dataReserve);
      const src = sourceLine(c.source);
      const head: string[] = Array.isArray(c.head) ? c.head : [];
      const rows: string[][] = Array.isArray(c.rows) ? c.rows : [];
      const tf = tableFontSize(head, rows, DATA_CONTENT_W - 20, m.boxH);
      return (
        <div className={layout === "table" ? "ll-table" : "ll-chart"}>
          <div className="pad">
            {title && <Title text={title} maxPx={m.titlePx} widthPx={DATA_CONTENT_W} maxLines={2} oneLine={false} />}
            {layout === "table" ? (
              <TableView head={head} rows={rows} px={tf.px} padY={tf.padY} />
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
