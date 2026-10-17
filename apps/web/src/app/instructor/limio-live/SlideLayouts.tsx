"use client";

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
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
  fitFontSize,
  resolveLayout,
  type LayoutColumn,
  type LayoutItem,
  type SlideIconId,
  type SlideLayoutId,
} from "@/lib/limioLiveSlides";
import { layoutThemeClass } from "./slideThemes";
import "./slideLayouts.css";

// Bộ vẽ slide Nội dung theo bố cục. Thiết kế ở khung 1280 × 720 rồi co theo khung chứa
// (giữ tỉ lệ, căn giữa) — cùng một cách ở trình chiếu, ảnh thu nhỏ và xem trước khi soạn.
// Nền do khung ngoài (giao diện bài giảng) quyết định; ở đây chỉ vẽ chữ và các khối.

const DESIGN_W = 1280;
const DESIGN_H = 720;

const ICONS: Record<SlideIconId, LucideIcon> = {
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
const delay = (i: number): CSSProperties => ({ ["--i" as string]: i }) as CSSProperties;

/** Slide có dùng bố cục mới (không phải "classic")? */
export function isLayoutSlide(config: Cfg | undefined): boolean {
  return resolveLayout(config) !== "classic" && !config?.resource;
}

export function LayoutSlideView({
  config,
  themeId,
  animate = false,
}: {
  config: Cfg;
  themeId?: string | null;
  animate?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => {
      if (el.clientWidth > 0 && el.clientHeight > 0) {
        setScale(Math.min(el.clientWidth / DESIGN_W, el.clientHeight / DESIGN_H));
      }
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const layout = resolveLayout(config);
  return (
    <div ref={ref} className="relative min-h-0 w-full flex-1 overflow-hidden">
      <div
        className={`lslide ${layoutThemeClass(themeId)} ${animate ? "anim" : ""}`}
        style={{
          position: "absolute",
          left: "50%",
          top: "50%",
          transformOrigin: "0 0",
          transform: `translate(${(-DESIGN_W * scale) / 2}px, ${(-DESIGN_H * scale) / 2}px) scale(${scale})`,
          visibility: scale > 0 ? "visible" : "hidden",
        }}
      >
        <LayoutBody layout={layout} c={config} />
      </div>
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
  const { px } = fitFontSize(text, { maxPx, widthPx, maxLines });
  return (
    <h2 className={`h a ${className ?? ""}`} style={{ fontSize: px, ...style }}>
      {text}
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

function LayoutBody({ layout, c }: { layout: SlideLayoutId; c: Cfg }) {
  const items: LayoutItem[] = Array.isArray(c.items) ? c.items : [];
  const title: string = c.title ?? "";

  switch (layout) {
    case "cover": {
      const { head, tail } = accentTail(title);
      const { px } = fitFontSize(title, { maxPx: 96, widthPx: 800, maxLines: 3 });
      return (
        <div className="ll-cover">
          <Glows
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
                  {c.subtitle}
                </p>
              )}
              {c.byline && (
                <p className="byline a" style={delay(2)}>
                  {c.byline}
                </p>
              )}
            </div>
          </div>
          <div className="stack" aria-hidden="true">
            <i className="a-pop" style={delay(1)} />
            <i className="a-pop" style={delay(2)} />
            <i className="a-pop" style={delay(3)}>
              <MessageCircle size={120} strokeWidth={1.6} />
            </i>
          </div>
        </div>
      );
    }

    case "section":
      return (
        <div className="ll-section">
          <Glows
            a={{ width: 460, height: 460, right: -120, top: -120 }}
            b={{ width: 380, height: 380, right: 140, bottom: -200 }}
          />
          <div className="pad">
            {c.sectionNumber && <div className="num a-pop">{c.sectionNumber}</div>}
            <Title text={title} maxPx={84} widthPx={980} maxLines={2} style={{ ...delay(1) }} />
            {c.subtitle && (
              <p className="lead a" style={{ ...delay(2), marginTop: 22, maxWidth: 820 }}>
                {c.subtitle}
              </p>
            )}
          </div>
        </div>
      );

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
                    {b}
                  </li>
                ))}
              </ul>
            </div>
            <div className="art a-pop" style={delay(1)}>
              {c.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={c.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <ArtIllustration />
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
                const Icon = ICONS[it.icon ?? "target"] ?? Target;
                return (
                  <div key={i} className="card it a" style={delay(i)}>
                    <span className="no">{i + 1}</span>
                    <div className="badge">
                      <Icon size={36} strokeWidth={2} />
                    </div>
                    <b>{it.heading}</b>
                    <p>{it.body}</p>
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
                    {col.heading}
                  </div>
                  {col.points.map((p, k) => (
                    <div key={k} className="q">
                      {p}
                    </div>
                  ))}
                  {col.note && <div className="why">{col.note}</div>}
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
                  <b>{it.heading}</b>
                  <p>{it.body}</p>
                </div>
              ))}
            </div>
            {c.footnote && (
              <div className="loop a" style={delay(items.length * 2)}>
                <Repeat size={30} /> {c.footnote}
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
                  <p>{it.body}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    case "quote": {
      const q: string = c.quote ?? "";
      const { head, tail } = accentTail(q);
      const { px } = fitFontSize(q, { maxPx: 66, widthPx: 1000, maxLines: 4 });
      return (
        <div className="ll-quote">
          <Glows
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
                {c.source}
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
                  <span>{it.heading}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      );

    default:
      return null;
  }
}

/** Hình minh hoạ mặc định khi slide "Chữ và hình" chưa có ảnh. */
function ArtIllustration(): ReactNode {
  return (
    <svg viewBox="0 0 480 500" aria-hidden="true" style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <circle cx="400" cy="90" r="64" fill="var(--sa2)" opacity=".18" />
      <circle cx="70" cy="420" r="90" fill="var(--sa)" opacity=".14" />
      <rect x="60" y="250" width="70" height="150" rx="14" fill="var(--sa)" opacity=".45" />
      <rect x="160" y="190" width="70" height="210" rx="14" fill="var(--sa)" opacity=".7" />
      <rect x="260" y="120" width="70" height="280" rx="14" fill="var(--sa)" />
      <path d="M72 215 L195 150 L300 78" fill="none" stroke="var(--sa2)" strokeWidth="8" strokeLinecap="round" strokeDasharray="2 18" />
      <circle cx="300" cy="78" r="16" fill="var(--sa2)" />
      <g transform="translate(250 280)">
        <rect width="190" height="124" rx="26" fill="var(--scard)" stroke="var(--scardb)" strokeWidth="2" />
        <rect x="26" y="30" width="110" height="12" rx="6" fill="var(--sa)" opacity=".5" />
        <rect x="26" y="56" width="138" height="12" rx="6" fill="var(--sa)" opacity=".3" />
        <circle cx="152" cy="30" r="16" fill="var(--sok)" />
        <path d="M144 30l6 6 10-12" fill="none" stroke="#fff" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}
