"use client";

import { useId, useMemo, type ReactNode } from "react";
import { accentTail, fitFontSize, resolveCoverStyle, stripInline, type CoverStyleId } from "@/lib/limioLiveSlides";
import type { SlideMotifId } from "@/lib/limioLiveMotifs";
import { motifSvgBody } from "@/lib/limioLiveMotifArt";
import { Inline, delay } from "./slideInline";

// Slide bìa: mười kiểu (COVER_STYLES), cùng bốn dòng chữ — tên đơn vị, tên bài, phụ đề, người trình bày.
// Bản mẫu đã duyệt: docs/mockup/bia-bai-giang.html. Hình thức nằm ở slideLayouts.css (.ll-cover, .cv-*).
// Mỗi kiểu có một vùng không chứa chữ để vẽ hoa văn của bài giảng (đậm hết cỡ, không dùng --smo); phần trang trí
// mang lớp .deco để bộ tự co bỏ qua khi đo nội dung (measureContentBox).

type Cfg = Record<string, any>;

/** Cỡ chữ tên bài của từng kiểu: tối đa, bề rộng khối chữ trên khung 1280 px, số dòng tối đa. */
const TITLE_FIT: Record<CoverStyleId, { maxPx: number; widthPx: number; maxLines: number }> = {
  block: { maxPx: 84, widthPx: 710, maxLines: 3 },
  formal: { maxPx: 72, widthPx: 980, maxLines: 3 },
  arch: { maxPx: 80, widthPx: 734, maxLines: 3 },
  band: { maxPx: 70, widthPx: 1060, maxLines: 3 },
  arc: { maxPx: 84, widthPx: 720, maxLines: 3 },
  tiles: { maxPx: 80, widthPx: 734, maxLines: 3 },
  tape: { maxPx: 64, widthPx: 852, maxLines: 3 },
  wave: { maxPx: 80, widthPx: 1000, maxLines: 2 },
  pillar: { maxPx: 84, widthPx: 784, maxLines: 3 },
  bubbles: { maxPx: 80, widthPx: 704, maxLines: 3 },
};
/** Tên bài dài được thu nhỏ tới mức này trước khi bộ tự co phải thu cả khối (giữ phụ đề, đơn vị ≥ 26 px). */
const TITLE_MIN_PX = 44;

const useUid = (p: string) => `${p}${useId().replace(/[^a-zA-Z0-9]/g, "")}`;

/** Hoa văn phủ kín ô chứa. Thân SVG do mã của ta sinh từ một mã hoa văn cố định (không có chữ người dùng). */
function MotifFill({ motif, w, h }: { motif: SlideMotifId | null; w: number; h: number }) {
  const uid = useUid("cv");
  const html = useMemo(
    () => (motif ? `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">${motifSvgBody(motif, w, h, uid)}</svg>` : ""),
    [motif, w, h, uid],
  );
  return motif ? <div className="mf" aria-hidden="true" dangerouslySetInnerHTML={{ __html: html }} /> : null;
}

const ON_ACCENT = "--sa:var(--son);--sa2:var(--son);--sglow1:var(--son);--sglow2:var(--son);--ssoft:color-mix(in srgb, var(--son) 28%, transparent)";

/** Dải sóng ở đáy kiểu Sóng: lớp nhạt, lớp đậm phủ hoa văn (cắt theo đường sóng), một đường sóng mảnh. */
function Waves({ motif }: { motif: SlideMotifId | null }) {
  const uid = useUid("wv");
  const html = useMemo(() => {
    const main = "M0 150 C 300 110, 540 190, 840 128 S 1190 32, 1280 52 L1280 230 L0 230 Z";
    return (
      `<path d="M0 118 C 320 70, 560 150, 860 92 S 1200 4, 1280 20 L1280 230 L0 230 Z" fill="var(--ssoft)"/>` +
      `<defs><clipPath id="${uid}c"><path d="${main}"/></clipPath>` +
      `<linearGradient id="${uid}g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="var(--sa)"/><stop offset="1" stop-color="var(--sa2)" stop-opacity=".85"/></linearGradient></defs>` +
      `<g clip-path="url(#${uid}c)"><rect width="1280" height="230" fill="url(#${uid}g)"/>` +
      (motif ? `<g style="${ON_ACCENT}"><svg viewBox="0 0 1280 230" width="1280" height="230" preserveAspectRatio="xMidYMid slice">${motifSvgBody(motif, 1280, 230, uid)}</svg></g>` : "") +
      `</g><path d="M0 96 C 320 52, 560 132, 860 72 S 1200 -14, 1280 2" fill="none" stroke="var(--sa2)" stroke-width="4" stroke-linecap="round"/>`
    );
  }, [motif, uid]);
  return <svg className="waves" viewBox="0 0 1280 230" aria-hidden="true" focusable="false" dangerouslySetInnerHTML={{ __html: html }} />;
}

function Arcs() {
  const a = Math.PI / 4.2;
  return (
    <svg className="arcs" viewBox="0 0 560 560" aria-hidden="true" focusable="false">
      <circle className="draw" style={delay(0)} cx="560" cy="560" r="462" fill="none" stroke="var(--sa)" strokeWidth="5" pathLength={1000} />
      <circle style={delay(1)} cx="560" cy="560" r="520" fill="none" stroke="var(--sa2)" strokeWidth="3" strokeDasharray="2 14" strokeLinecap="round" />
      <circle cx={560 - 462 * Math.cos(a)} cy={560 - 462 * Math.sin(a)} r="16" fill="var(--sa2)" />
    </svg>
  );
}

export function CoverSlide({ c, motif }: { c: Cfg; motif: SlideMotifId | null }) {
  const style = resolveCoverStyle(c);
  const plain = stripInline(String(c.title ?? ""));
  const { px } = fitFontSize(plain, { ...TITLE_FIT[style], minPx: TITLE_MIN_PX });
  // Kiểu Dải màu: tên bài nằm trên mảng màu đậm, không tô màu nhấn hai từ cuối.
  const { head, tail } = style === "band" ? { head: plain, tail: "" } : accentTail(plain);

  const org = c.org ? (
    <p className="org a" style={delay(0)}>
      <Inline text={c.org} />
    </p>
  ) : null;
  const title = (
    <h1 className="h a" style={{ ...delay(1), fontSize: px }}>
      {head}
      {tail && (
        <>
          {head ? " " : ""}
          <span className="grad">{tail}</span>
        </>
      )}
    </h1>
  );
  const sub = c.subtitle ? (
    <p className="sub a" style={delay(2)}>
      <Inline text={c.subtitle} />
    </p>
  ) : null;
  const by = c.byline ? (
    <p className="by a" style={delay(3)}>
      <Inline text={c.byline} />
    </p>
  ) : null;
  /** Ba nhóm chữ: đơn vị ở đầu, tên bài + phụ đề ở giữa, người trình bày ở cuối. */
  const text = (mid: ReactNode = <>{title}{sub}</>) => (
    <div className="pad">
      {org}
      <div className="mid">{mid}</div>
      {by}
    </div>
  );

  let body: ReactNode;
  switch (style) {
    case "formal":
      body = (
        <>
          <div className={`zone deco${motif ? "" : " on-accent"}`}>
            <MotifFill motif={motif} w={1280} h={720} />
          </div>
          <div className="sheet deco" />
          <div className="pad">
            {c.org && (
              <div className="a" style={delay(0)}>
                <p className="org">
                  <Inline text={c.org} />
                </p>
                <div className="rule" aria-hidden="true">
                  <i />
                  <b />
                  <i />
                </div>
              </div>
            )}
            <div className="mid">
              {title}
              {sub}
            </div>
            {by}
          </div>
        </>
      );
      break;
    case "arch":
      body = (
        <>
          <div className="ring deco" />
          <div className="zone deco">
            <MotifFill motif={motif} w={300} h={560} />
          </div>
          <div className="sun deco" />
          {text()}
        </>
      );
      break;
    case "band":
      body = (
        <>
          <div className="zone deco">
            <MotifFill motif={motif} w={1280} h={720} />
          </div>
          {text(
            <div className="stripe">
              {title}
              {sub}
            </div>,
          )}
        </>
      );
      break;
    case "arc":
      body = (
        <>
          <div className="zone deco on-accent">
            <MotifFill motif={motif} w={400} h={400} />
          </div>
          <Arcs />
          {text()}
        </>
      );
      break;
    case "tiles":
      body = (
        <>
          <div className="grid deco" aria-hidden="true">
            <div className="t t1" style={delay(0)}>
              <MotifFill motif={motif} w={150} h={150} />
            </div>
            <div className="t t2" style={delay(1)}>
              <i />
            </div>
            <div className="t t3" style={delay(2)} />
            <div className="t t4 on-accent" style={delay(3)}>
              <MotifFill motif={motif} w={150} h={150} />
            </div>
            <div className="t t5" style={delay(4)} />
            <div className="t t6" style={delay(5)}>
              <i />
            </div>
          </div>
          {text()}
        </>
      );
      break;
    case "tape":
      body = (
        <>
          <div className={`zone deco${motif ? "" : " on-accent"}`}>
            <MotifFill motif={motif} w={1280} h={720} />
          </div>
          <div className="card">
            <span className="tp tp1 deco" />
            <span className="tp tp2 deco" />
            {text()}
          </div>
          <div className="seal deco on-accent">
            <MotifFill motif={motif} w={190} h={190} />
          </div>
        </>
      );
      break;
    case "wave":
      body = (
        <>
          <Waves motif={motif} />
          {text()}
        </>
      );
      break;
    case "pillar":
      body = (
        <>
          <div className="zone deco">
            <MotifFill motif={motif} w={300} h={720} />
          </div>
          <div className="medal deco" />
          <div className="ring deco" />
          {text()}
        </>
      );
      break;
    case "bubbles":
      body = (
        <>
          <div className="b b1 deco" style={delay(0)}>
            <MotifFill motif={motif} w={320} h={320} />
          </div>
          <div className="b b2 deco" style={delay(1)} />
          <div className="b b3 deco" style={delay(2)} />
          <div className="b b4 deco on-accent" style={delay(3)}>
            <MotifFill motif={motif} w={224} h={224} />
          </div>
          <div className="b b5 deco" style={delay(4)} />
          <div className="b b6 deco" style={delay(5)} />
          {text()}
        </>
      );
      break;
    case "block":
    default:
      body = (
        <>
          <div className="zone deco">
            <MotifFill motif={motif} w={340} h={592} />
          </div>
          <div className="dot deco" />
          <div className="bar deco" />
          {text()}
        </>
      );
  }
  return <div className={`ll-cover cv-${style}`}>{body}</div>;
}
