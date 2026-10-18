// Hình SVG của 16 hoa văn trang trí slide (xem limioLiveMotifs.ts) và 12 hình minh hoạ theo chủ đề cho ô hình. Tự vẽ bằng mã, không dùng ảnh ngoài nên
// không vướng bản quyền và không tốn tải mạng. Màu chỉ dùng biến giao diện (--sa, --sa2, --ssoft, --sglow1/2)
// nên tự đổi theo giao diện sáng/tối và theo màu thương hiệu.
//
// Mỗi hàm trả về phần thân SVG (chuỗi) cho vùng w × h. Số ngẫu nhiên có seed cố định theo hoa văn, nên một hoa văn
// luôn ra đúng một hình ở mọi nơi (trình sửa, trình chiếu, ảnh thu nhỏ). Id nội bộ (clipPath, gradient) viết là
// "__ID__", nơi vẽ thay bằng id duy nhất của phần tử để hai slide trên cùng trang không giẫm lên nhau.

import { isSlideIllustrationId, type SlideIllustrationId } from "@feedbackme/shared-types";
import { SLIDE_MOTIFS, type SlideArtId, type SlideMotifId } from "./limioLiveMotifs";

const A = "var(--sa)";
const B = "var(--sa2)";
const S = "var(--ssoft)";
const f = (n: number) => Math.round(n * 10) / 10;
const op = (n: number) => n.toFixed(2);

/** mulberry32: nhỏ, nhanh, đủ đều cho việc rải hình. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Gen = (w: number, h: number, R: () => number) => string;

const GEN: Record<SlideMotifId, Gen> = {
  song(w, h) {
    let s = "";
    const n = 9;
    const amp = Math.min(w, h) * 0.05;
    const lam = Math.max(w, h) * 0.55;
    for (let i = 0; i < n; i++) {
      const y0 = h * 0.12 + (i * h * 0.76) / (n - 1);
      let d = "";
      for (let x = -20; x <= w + 20; x += 8) d += (x === -20 ? "M" : "L") + f(x) + " " + f(y0 + amp * Math.sin((x / lam) * 2 * Math.PI + i * 0.45));
      const acc = i % 4 === 3;
      s += `<path d="${d}" fill="none" stroke="${acc ? B : A}" stroke-width="${acc ? 4 : 2.5}" stroke-opacity="${op(0.35 + (0.6 * i) / (n - 1))}" stroke-linecap="round"/>`;
    }
    return s;
  },
  khoi(w, h) {
    const m = Math.min(w, h);
    const rx = w * 0.27;
    const ry = h * 0.66;
    const rs = m * 0.3;
    let dots = "";
    for (let k = 0; k < 9; k++)
      dots += `<circle cx="${f(w * 0.78 + (k % 3) * m * 0.05)}" cy="${f(h * 0.08 + Math.floor(k / 3) * m * 0.05)}" r="${f(m * 0.012)}" fill="${A}"/>`;
    return (
      `<circle cx="${f(w * 0.68)}" cy="${f(h * 0.33)}" r="${f(m * 0.26)}" fill="${B}" fill-opacity=".3"/>` +
      `<circle cx="${f(w * 0.22)}" cy="${f(h * 0.2)}" r="${f(m * 0.07)}" fill="none" stroke="${A}" stroke-width="7"/>` +
      `<rect x="${f(rx - rs / 2)}" y="${f(ry - rs / 2)}" width="${f(rs)}" height="${f(rs)}" rx="${f(m * 0.04)}" transform="rotate(-12 ${f(rx)} ${f(ry)})" fill="none" stroke="${A}" stroke-width="6"/>` +
      `<path d="M${f(w * 0.52)} ${f(h * 0.92)} L${f(w * 0.76)} ${f(h * 0.56)} L${f(w * 0.95)} ${f(h * 0.92)} Z" fill="${A}" fill-opacity=".55"/>` +
      dots
    );
  },
  cham(w, h) {
    let s = "";
    const st = 26;
    const D = Math.hypot(w, h);
    for (let y = st / 2; y < h; y += st)
      for (let x = st / 2; x < w; x += st) {
        const t = 1 - Math.hypot(w - x, y) / D;
        s += `<circle cx="${f(x)}" cy="${f(y)}" r="3.4" fill="${A}" fill-opacity="${op(0.12 + 0.88 * t * t)}"/>`;
      }
    return s;
  },
  dongmuc(w, h) {
    let s = "";
    const cx = w * 0.62;
    const cy = h * 0.45;
    const Rm = Math.hypot(w, h) * 0.62;
    const n = 12;
    for (let k = 1; k <= n; k++) {
      const rk = (Rm * k) / n;
      let d = "";
      for (let j = 0; j < 96; j++) {
        const th = (j / 96) * 2 * Math.PI;
        const r = rk * (1 + 0.13 * Math.sin(3 * th + 0.9 + k * 0.18) + 0.06 * Math.sin(5 * th + 0.3 - k * 0.1) + 0.03 * Math.sin(8 * th + k * 0.4));
        d += (j ? "L" : "M") + f(cx + r * Math.cos(th)) + " " + f(cy + r * Math.sin(th));
      }
      const acc = k % 4 === 0;
      s += `<path d="${d}Z" fill="none" stroke="${acc ? B : A}" stroke-width="${acc ? 3.2 : 2}" stroke-opacity=".65"/>`;
    }
    return s;
  },
  cung(w, h, R) {
    let s = "";
    const c = Math.round(Math.min(w, h) / 5.2);
    for (let y = 0; y < h; y += c)
      for (let x = 0; x < w; x += c) {
        const p = R();
        if (p < 0.28) continue;
        const fill = p < 0.55 ? `fill="${A}" fill-opacity=".55"` : p < 0.75 ? `fill="${B}" fill-opacity=".45"` : `fill="${S}"`;
        const q = Math.floor(R() * 4);
        const sx = q & 1 ? -1 : 1;
        const sy = q & 2 ? -1 : 1;
        const cx = sx > 0 ? x : x + c;
        const cy = sy > 0 ? y : y + c;
        s += `<path d="M${cx} ${cy} L${cx + sx * c} ${cy} A${c} ${c} 0 0 ${sx * sy > 0 ? 1 : 0} ${cx} ${cy + sy * c} Z" ${fill}/>`;
      }
    return s;
  },
  diemnoi(w, h, R) {
    const pts: Array<[number, number, number]> = [];
    const cs = 96;
    for (let y = 0; y < h; y += cs) for (let x = 0; x < w; x += cs) pts.push([x + 14 + R() * (cs - 28), y + 14 + R() * (cs - 28), R()]);
    const seen = new Set<string>();
    let s = "";
    pts.forEach((p, i) => {
      pts
        .map((q, j) => [j, Math.hypot(p[0] - q[0], p[1] - q[1])] as const)
        .filter(([j]) => j !== i)
        .sort((a, b) => a[1] - b[1])
        .slice(0, 2)
        .forEach(([j]) => {
          const key = i < j ? `${i}-${j}` : `${j}-${i}`;
          if (seen.has(key)) return;
          seen.add(key);
          s += `<line x1="${f(p[0])}" y1="${f(p[1])}" x2="${f(pts[j]![0])}" y2="${f(pts[j]![1])}" stroke="${A}" stroke-width="2" stroke-opacity=".45"/>`;
        });
    });
    for (const p of pts) s += `<circle cx="${f(p[0])}" cy="${f(p[1])}" r="${f(3 + p[2] * 5)}" fill="${p[2] > 0.85 ? B : A}"/>`;
    return s;
  },
  soc(w, h) {
    const m = Math.min(w, h);
    const cx = w * 0.56;
    const cy = h * 0.46;
    const r = m * 0.4;
    let lines = "";
    for (let t = -2.2 * r; t <= 2.2 * r; t += 20)
      lines += `<line x1="${f(cx + t - 1.5 * r)}" y1="${f(cy + 1.5 * r)}" x2="${f(cx + t + 1.5 * r)}" y2="${f(cy - 1.5 * r)}"/>`;
    return (
      `<clipPath id="__ID__c"><circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}"/></clipPath>` +
      `<g clip-path="url(#__ID__c)" stroke="${A}" stroke-width="7" stroke-opacity=".55">${lines}</g>` +
      `<circle cx="${f(cx + m * 0.16)}" cy="${f(cy + m * 0.12)}" r="${f(r)}" fill="none" stroke="${B}" stroke-width="3"/>` +
      `<circle cx="${f(cx - m * 0.33)}" cy="${f(cy - m * 0.3)}" r="${f(m * 0.06)}" fill="${B}" fill-opacity=".6"/>`
    );
  },
  vet(w, h) {
    const m = Math.min(w, h);
    const g = (k: number, col: string, o: number) =>
      `<radialGradient id="__ID__g${k}"><stop offset="0" style="stop-color:${col};stop-opacity:${o}"/><stop offset="1" style="stop-color:${col};stop-opacity:0"/></radialGradient>`;
    return (
      g(1, "var(--sglow1)", 0.95) +
      g(2, "var(--sglow2)", 0.9) +
      g(3, A, 0.35) +
      `<ellipse cx="${f(w * 0.7)}" cy="${f(h * 0.3)}" rx="${f(m * 0.55)}" ry="${f(m * 0.45)}" fill="url(#__ID__g1)"/>` +
      `<ellipse cx="${f(w * 0.28)}" cy="${f(h * 0.74)}" rx="${f(m * 0.6)}" ry="${f(m * 0.5)}" fill="url(#__ID__g2)"/>` +
      `<circle cx="${f(w * 0.82)}" cy="${f(h * 0.84)}" r="${f(m * 0.32)}" fill="url(#__ID__g3)"/>`
    );
  },
  lucgiac(w, h, R) {
    let s = "";
    const r = 30;
    const hw = Math.sqrt(3) * r;
    for (let row = 0, y = 0; y < h + r; row++, y += 1.5 * r)
      for (let x = ((row % 2) * hw) / 2; x < w + hw; x += hw) {
        const pts = Array.from({ length: 6 }, (_, k) => {
          const a = (Math.PI / 180) * (60 * k - 90);
          return `${f(x + (r - 2) * Math.cos(a))},${f(y + (r - 2) * Math.sin(a))}`;
        }).join(" ");
        const p = R();
        const fill = p < 0.12 ? `fill="${A}" fill-opacity=".5"` : p < 0.2 ? `fill="${B}" fill-opacity=".4"` : `fill="none"`;
        s += `<polygon points="${pts}" ${fill} stroke="${A}" stroke-opacity=".4" stroke-width="2"/>`;
      }
    return s;
  },
  dongchay(w, h) {
    let s = "";
    const n = 16;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1);
      const acc = i % 5 === 2;
      s += `<path d="M-10 ${f(h * (0.5 + 0.45 * t))} C${f(w * 0.4)} ${f(h * (0.15 + 0.9 * t))} ${f(w * 0.55)} ${f(h * (-0.1 + 0.6 * t))} ${f(w + 10)} ${f(h * (0.05 + 0.4 * t))}" fill="none" stroke="${acc ? B : A}" stroke-width="${acc ? 3.5 : 2.2}" stroke-opacity="${op(0.3 + 0.55 * t)}"/>`;
    }
    return s;
  },
  banchi(w, h) {
    let s = "";
    const st = 22;
    const D = Math.hypot(w, h) * 0.85;
    for (let row = 0, y = st / 2; y < h; row++, y += st)
      for (let x = ((row % 2) * st) / 2; x < w + st; x += st) {
        const r = 8.5 * Math.pow(Math.max(0, 1 - Math.hypot(x - w * 0.95, y - h * 0.08) / D), 1.3);
        if (r > 0.7) s += `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${A}" fill-opacity=".8"/>`;
      }
    return s;
  },
  tamgiac(w, h, R) {
    let s = "";
    const c = 72;
    for (let y = 0; y < h; y += c)
      for (let x = 0; x < w; x += c) {
        const tris =
          R() < 0.5
            ? [[x, y, x + c, y, x, y + c], [x + c, y, x + c, y + c, x, y + c]]
            : [[x, y, x + c, y, x + c, y + c], [x, y, x + c, y + c, x, y + c]];
        for (const p of tris) {
          const b = R() < 0.1;
          s += `<polygon points="${p.join(",")}" fill="${b ? B : A}" fill-opacity="${op(b ? 0.22 + R() * 0.2 : 0.03 + R() * 0.26)}"/>`;
        }
      }
    return s;
  },
  vong(w, h) {
    const m = Math.min(w, h);
    const cx = w * 0.82;
    const cy = h * 0.8;
    const max = Math.hypot(w, h);
    let s = `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(m * 0.09)}" fill="${B}" fill-opacity=".55"/>`;
    for (let i = 0, r = m * 0.16; r < max; i++, r += m * 0.075)
      s +=
        i % 3 === 2
          ? `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${B}" stroke-width="4" stroke-dasharray="2 12" stroke-linecap="round" stroke-opacity=".7"/>`
          : `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="none" stroke="${A}" stroke-width="2.5" stroke-opacity="${op(Math.max(0.2, 0.75 - i * 0.05))}"/>`;
    return s;
  },
  gach(w, h, R) {
    let s = "";
    for (let y = 19; y < h; y += 38)
      for (let x = -R() * 60; x < w; ) {
        const len = 20 + R() * 100;
        const b = R() < 0.14;
        s += `<rect x="${f(x)}" y="${y - 5}" width="${f(len)}" height="10" rx="5" fill="${b ? B : A}" fill-opacity="${op(b ? 0.6 : 0.2 + R() * 0.35)}"/>`;
        x += len + 16 + R() * 30;
      }
    return s;
  },
  oke(w, h) {
    let minor = "";
    let major = "";
    let cells = "";
    const st = 24;
    const M = st * 4;
    for (let x = 0; x <= w; x += st) x % M ? (minor += `M${x} 0V${h}`) : (major += `M${x} 0V${h}`);
    for (let y = 0; y <= h; y += st) y % M ? (minor += `M0 ${y}H${w}`) : (major += `M0 ${y}H${w}`);
    // Một cụm ô bậc thang bám theo lưới lớn, lệch về góc trên phải.
    const gx = Math.floor((w * 0.6) / M) * M;
    const gy = Math.floor((h * 0.2) / M) * M;
    const cluster: Array<[number, number, number, number, string, number]> = [
      [0, 0, 4, 4, S, 1],
      [4, 0, 2, 2, A, 0.45],
      [4, 2, 2, 2, S, 1],
      [2, 4, 2, 2, B, 0.4],
      [0, 4, 2, 2, S, 1],
      [6, 0, 1, 1, A, 0.6],
      [4, 6, 1, 1, A, 0.6],
    ];
    for (const [x, y, cw, ch, col, o] of cluster)
      cells += `<rect x="${gx + x * st}" y="${gy + y * st}" width="${cw * st}" height="${ch * st}" fill="${col}" fill-opacity="${o}"/>`;
    return (
      cells +
      `<path d="${minor}" stroke="${A}" stroke-opacity=".16" stroke-width="1"/>` +
      `<path d="${major}" stroke="${A}" stroke-opacity=".35" stroke-width="1.6"/>`
    );
  },
  tia(w, h) {
    const ox = w * 0.06;
    const oy = h * 1.02;
    const L = Math.hypot(w, h) * 1.1;
    const m = Math.min(w, h);
    let s = "";
    for (let k = 0; k <= 22; k++) {
      const a = ((-88 + (k * 86) / 22) * Math.PI) / 180;
      s += `<line x1="${f(ox)}" y1="${f(oy)}" x2="${f(ox + L * Math.cos(a))}" y2="${f(oy + L * Math.sin(a))}" stroke="${A}" stroke-width="2.5" stroke-opacity="${k % 2 ? 0.55 : 0.25}"/>`;
    }
    for (const q of [0.35, 0.7, 1.05])
      s += `<circle cx="${f(ox)}" cy="${f(oy)}" r="${f(m * q)}" fill="none" stroke="${B}" stroke-width="4" stroke-dasharray="2 14" stroke-linecap="round" stroke-opacity=".7"/>`;
    return s;
  },
};

// ── Hình minh hoạ theo chủ đề (chỉ ở ô hình) ────────────────────────────────
// Vẽ trong khung cố định 464 × 500 (đúng cỡ ô hình), cùng một ngữ pháp cho cả bộ: một đĩa nền mờ màu --sglow1
// (lớp .ill-disc, giao diện tối làm nhạt hơn trong slideLayouts.css vì --sglow1 thường trùng --sa), vật thể chính
// tô --sa, điểm nhấn --sa2, mặt giấy và mặt đồng hồ --scard, nét đè lên khối màu nhấn --son. Nét 6–10 px, đầu nét
// tròn. Nội dung nằm trong vòng tròn bán kính ~180 quanh tâm (232, 250), nên ô vuông nhỏ cắt bớt trên dưới vẫn
// thấy trọn hình. Người là khối trừu tượng cùng cỡ, cùng chiều cao: không mặt, không tóc, không trang phục.

const IW = 464;
const IH = 500;
const CX = 232;
const CY = 250;
const C = "var(--scard)";
const ON = "var(--son)";
const G1 = "var(--sglow1)";
const G2 = "var(--sglow2)";
const disc = (r = 178, o = 0.24) => `<circle class="ill-disc" cx="${CX}" cy="${CY}" r="${r}" fill="${G1}" fill-opacity="${o}"/>`;
const ln = (x1: number, y1: number, x2: number, y2: number, col: string, w: number, o = 1) =>
  `<line x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}" stroke="${col}" stroke-width="${w}" stroke-opacity="${o}" stroke-linecap="round"/>`;
/** Đầu mũi tên tam giác tại `tip`, hướng theo vector (dx, dy). */
function arrowHead(tip: [number, number], dx: number, dy: number, size: number, col: string): string {
  const L = Math.hypot(dx, dy);
  const [ux, uy] = [dx / L, dy / L];
  const [px, py] = [-uy, ux];
  const [bx, by] = [tip[0] - ux * size, tip[1] - uy * size];
  const k = size * 0.62;
  return `<polygon points="${f(tip[0])},${f(tip[1])} ${f(bx + px * k)},${f(by + py * k)} ${f(bx - px * k)},${f(by - py * k)}" fill="${col}" stroke="${col}" stroke-width="4" stroke-linejoin="round"/>`;
}

/** Bánh răng n răng, có lỗ trục ở giữa (evenodd để lỗ thật sự trong suốt). */
function gear(cx: number, cy: number, R: number, r: number, n: number, col: string, hole: number): string {
  const step = (2 * Math.PI) / n;
  let d = "";
  for (let k = 0; k < n; k++) {
    const a = k * step - Math.PI / 2;
    const pts: Array<[number, number]> = [[a - step * 0.5, r], [a - step * 0.22, r], [a - step * 0.14, R], [a + step * 0.14, R], [a + step * 0.22, r]];
    pts.forEach(([t, rr], i) => {
      d += (k === 0 && i === 0 ? "M" : "L") + f(cx + rr * Math.cos(t)) + " " + f(cy + rr * Math.sin(t));
    });
  }
  return `<path d="${d}Z M${f(cx - hole)} ${cy}a${hole} ${hole} 0 1 0 ${2 * hole} 0a${hole} ${hole} 0 1 0 ${-2 * hole} 0Z" fill="${col}" fill-rule="evenodd"/>`;
}

function star(cx: number, cy: number, R: number, r: number, col: string): string {
  let d = "";
  for (let k = 0; k < 10; k++) {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r : R;
    d += (k ? "L" : "M") + f(cx + rr * Math.cos(a)) + " " + f(cy + rr * Math.sin(a));
  }
  return `<path d="${d}Z" fill="${col}" stroke="${col}" stroke-width="4" stroke-linejoin="round"/>`;
}

const ILL: Record<SlideIllustrationId, () => string> = {
  ketnoi() {
    const out: Array<[number, number]> = [[110, 142], [352, 124], [404, 282], [316, 404], [128, 384], [62, 258]];
    let s = disc();
    out.forEach((p, i) => {
      const q = out[(i + 1) % out.length]!;
      s += ln(p[0], p[1], q[0], q[1], A, 4, 0.32);
    });
    for (const p of out) s += ln(CX, CY, p[0], p[1], A, 7, 0.65);
    out.forEach((p, i) => {
      s += i % 2 ? `<circle cx="${p[0]}" cy="${p[1]}" r="17" fill="${B}"/>` : `<circle cx="${p[0]}" cy="${p[1]}" r="24" fill="${C}" stroke="${A}" stroke-width="7"/>`;
    });
    return s + `<circle cx="${CX}" cy="${CY}" r="42" fill="${A}"/><circle cx="${CX}" cy="${CY}" r="14" fill="${ON}"/>`;
  },
  connguoi() {
    // Người giữa vẽ sau cùng nên đứng trước hai người bên; cả ba cùng cỡ và cùng chiều cao.
    const fig = (x: number, y: number, col: string, o: number) =>
      `<g fill="${col}" fill-opacity="${o}"><circle cx="${x}" cy="${y - 170}" r="36"/><path d="M${x - 64} ${y}V${y - 58}A64 64 0 0 1 ${x + 64} ${y - 58}V${y}Z"/></g>`;
    return (
      disc() +
      `<clipPath id="__ID__p"><rect x="0" y="0" width="${IW}" height="372"/></clipPath>` +
      `<g clip-path="url(#__ID__p)">${fig(116, 372, B, 0.85)}${fig(348, 372, A, 0.5)}${fig(CX, 372, A, 1)}</g>` +
      `<rect x="40" y="370" width="384" height="12" rx="6" fill="${A}" fill-opacity=".4"/>`
    );
  },
  tunhien() {
    return (
      `<clipPath id="__ID__n"><circle cx="${CX}" cy="${CY}" r="178"/></clipPath><g clip-path="url(#__ID__n)">` +
      disc() +
      `<circle cx="306" cy="156" r="44" fill="${B}" fill-opacity=".75"/>` +
      `<path d="M30 370Q140 170 250 270Q330 200 440 310V480H30Z" fill="${A}" fill-opacity=".38"/>` +
      `<path d="M30 430Q170 280 320 360Q390 322 440 350V480H30Z" fill="${A}"/>` +
      `<path d="M150 430Q240 400 300 480H120Z" fill="${A}" fill-opacity=".55"/>` +
      `<rect x="146" y="270" width="10" height="56" rx="5" fill="${A}"/><circle cx="151" cy="258" r="36" fill="${B}"/>` +
      `<rect x="216" y="290" width="8" height="40" rx="4" fill="${A}"/><circle cx="220" cy="280" r="25" fill="${B}" fill-opacity=".8"/>` +
      `</g>`
    );
  },
  ytuong() {
    let s = disc();
    for (let k = 0; k < 7; k++) {
      const a = Math.PI * (1.05 + k * 0.15);
      s += ln(CX + 132 * Math.cos(a), 206 + 132 * Math.sin(a), CX + 168 * Math.cos(a), 206 + 168 * Math.sin(a), B, 9);
    }
    return (
      s +
      `<path d="M186 314C186 280 134 262 134 206A98 98 0 1 1 330 206C330 262 278 280 278 314Z" fill="${G1}" fill-opacity=".55" stroke="${A}" stroke-width="9" stroke-linejoin="round"/>` +
      `<path d="M196 238l18 26l18 -26l18 26l18 -26" fill="none" stroke="${B}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/>` +
      ln(214, 264, 214, 312, B, 6, 0.8) +
      ln(250, 264, 250, 312, B, 6, 0.8) +
      `<rect x="180" y="326" width="104" height="22" rx="11" fill="${A}"/><rect x="186" y="356" width="92" height="22" rx="11" fill="${A}"/>` +
      `<path d="M204 386h56a28 22 0 0 1 -56 0Z" fill="${A}"/>`
    );
  },
  sachhoc() {
    const left = "M232 166C186 138 112 132 58 148V376C112 360 186 366 232 394Z";
    const right = "M232 166C278 138 352 132 406 148V376C352 360 278 366 232 394Z";
    let s =
      disc() +
      `<path d="M44 168V396C108 380 186 386 232 416C278 386 356 380 420 396V168" fill="none" stroke="${A}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="${left}" fill="${C}" stroke="${A}" stroke-width="8" stroke-linejoin="round"/><path d="${right}" fill="${C}" stroke="${A}" stroke-width="8" stroke-linejoin="round"/>`;
    for (let i = 0; i < 5; i++) {
      const y = 196 + i * 34;
      s += ln(88, y - 4, 204, y + 8, A, 7, 0.35);
      if (i < 4) s += ln(260, y + 8, i === 1 ? 336 : 376, y - 4, i === 1 ? B : A, 7, i === 1 ? 0.9 : 0.35);
    }
    return s + `<path d="M344 132V222L360 206L376 222V134" fill="${B}" stroke="${B}" stroke-width="4" stroke-linejoin="round"/>`;
  },
  thoigian() {
    let s = disc(182, 0.2) + `<circle cx="${CX}" cy="${CY}" r="146" fill="${C}" stroke="${A}" stroke-width="12"/>`;
    for (let k = 0; k < 12; k++) {
      const a = (k * Math.PI) / 6;
      const big = k % 3 === 0;
      const r0 = big ? 104 : 114;
      s += ln(CX + r0 * Math.sin(a), CY - r0 * Math.cos(a), CX + 128 * Math.sin(a), CY - 128 * Math.cos(a), A, big ? 9 : 6, big ? 1 : 0.5);
    }
    const hand = (deg: number, len: number, col: string, w: number) => {
      const a = (deg * Math.PI) / 180;
      return ln(CX, CY, CX + len * Math.sin(a), CY - len * Math.cos(a), col, w);
    };
    s += hand(305, 66, A, 14) + hand(60, 98, B, 9) + `<circle cx="${CX}" cy="${CY}" r="14" fill="${A}"/>`;
    // Cung tiến độ theo chiều kim đồng hồ, kết thúc bằng đầu mũi tên tiếp tuyến.
    const t = 2.2;
    const e: [number, number] = [CX + 182 * Math.sin(t), CY - 182 * Math.cos(t)];
    return (
      s +
      `<path d="M${CX} ${CY - 182}A182 182 0 0 1 ${f(e[0])} ${f(e[1])}" fill="none" stroke="${B}" stroke-width="8" stroke-linecap="round" stroke-opacity=".85"/>` +
      arrowHead([e[0] + Math.cos(t) * 16, e[1] + Math.sin(t) * 16], Math.cos(t), Math.sin(t), 24, B)
    );
  },
  muctieu() {
    const [x, y] = [214, 270];
    let s =
      disc() +
      `<circle cx="${x}" cy="${y}" r="146" fill="none" stroke="${A}" stroke-width="24"/>` +
      `<circle cx="${x}" cy="${y}" r="98" fill="none" stroke="${A}" stroke-width="24" stroke-opacity=".5"/>` +
      `<circle cx="${x}" cy="${y}" r="50" fill="none" stroke="${A}" stroke-width="24"/>` +
      `<circle cx="${x}" cy="${y}" r="20" fill="${B}"/>`;
    const [tx, ty] = [402, 86];
    const L = Math.hypot(tx - x, ty - y);
    const [ux, uy] = [(tx - x) / L, (ty - y) / L];
    const [px, py] = [-uy, ux];
    s += ln(x + ux * 18, y + uy * 18, tx, ty, B, 10);
    for (const k of [0, 22]) {
      const [bx, by] = [tx - ux * k, ty - uy * k];
      s += `<path d="M${f(bx)} ${f(by)}L${f(bx + ux * 30 + px * 22)} ${f(by + uy * 30 + py * 22)}M${f(bx)} ${f(by)}L${f(bx + ux * 30 - px * 22)} ${f(by + uy * 30 - py * 22)}" stroke="${B}" stroke-width="8" stroke-linecap="round"/>`;
    }
    return s;
  },
  toancau() {
    const r = 140;
    let g = "";
    for (const rx of [r * 0.42, r * 0.82]) g += `<ellipse cx="${CX}" cy="${CY}" rx="${f(rx)}" ry="${r}" fill="none" stroke="${A}" stroke-width="5" stroke-opacity=".7"/>`;
    g += ln(CX, CY - r, CX, CY + r, A, 5, 0.7);
    for (const dy of [-r * 0.55, 0, r * 0.55]) g += ln(CX - r, CY + dy, CX + r, CY + dy, A, 5, 0.7);
    // Vệ tinh trên quỹ đạo elip nghiêng −18°.
    const [t, phi] = [-0.35, -0.314];
    const sx = CX + 206 * Math.cos(t) * Math.cos(phi) - 58 * Math.sin(t) * Math.sin(phi);
    const sy = CY + 206 * Math.cos(t) * Math.sin(phi) + 58 * Math.sin(t) * Math.cos(phi);
    return (
      disc() +
      `<clipPath id="__ID__g"><circle cx="${CX}" cy="${CY}" r="${r}"/></clipPath>` +
      `<circle cx="${CX}" cy="${CY}" r="${r}" fill="${A}" fill-opacity=".14"/>` +
      `<g clip-path="url(#__ID__g)">${g}</g>` +
      `<circle cx="${CX}" cy="${CY}" r="${r}" fill="none" stroke="${A}" stroke-width="9"/>` +
      `<ellipse cx="${CX}" cy="${CY}" rx="206" ry="58" transform="rotate(-18 ${CX} ${CY})" fill="none" stroke="${B}" stroke-width="7" stroke-linecap="round"/>` +
      `<circle cx="${f(sx)}" cy="${f(sy)}" r="17" fill="${B}"/>`
    );
  },
  dulieu() {
    const [rx, ry, hgt, gap] = [124, 38, 62, 16];
    let s = disc();
    for (let k = 2; k >= 0; k--) {
      const t = 128 + k * (hgt + gap);
      s += `<path d="M${CX - rx} ${t}V${t + hgt}A${rx} ${ry} 0 0 0 ${CX + rx} ${t + hgt}V${t}Z" fill="${A}" fill-opacity="${[1, 0.8, 0.6][k]}"/>`;
      s += `<circle cx="${CX + 78}" cy="${f(t + hgt * 0.62 + 14)}" r="8" fill="${ON}"/><circle cx="${CX + 50}" cy="${f(t + hgt * 0.62 + 18)}" r="8" fill="${ON}" fill-opacity=".6"/>`;
      s += `<ellipse cx="${CX}" cy="${t}" rx="${rx}" ry="${ry}" fill="${k ? A : B}" fill-opacity="${k ? 0.35 : 1}"/>`;
    }
    return s;
  },
  antoan() {
    return (
      disc() +
      `<path d="M232 84L370 136V246C370 336 306 394 232 424C158 394 94 336 94 246V136Z" fill="${A}" stroke="${A}" stroke-width="10" stroke-linejoin="round"/>` +
      `<path d="M168 256L214 302L302 204" fill="none" stroke="${ON}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  },
  tangtruong() {
    let s = disc() + ln(70, 392, 400, 392, A, 7, 0.55);
    const bars: Array<[number, number, number]> = [[96, 78, 0.4], [168, 132, 0.58], [240, 188, 0.78], [312, 256, 1]];
    for (const [x, h, o] of bars)
      s += `<path d="M${x} 386V${392 - h + 12}A12 12 0 0 1 ${x + 12} ${392 - h}H${x + 44}A12 12 0 0 1 ${x + 56} ${392 - h + 12}V386Z" fill="${A}" fill-opacity="${o}"/>`;
    const pts: Array<[number, number]> = [[84, 286], [160, 232], [222, 252], [300, 160], [376, 104]];
    s += `<polyline points="${pts.map((p) => p.join(",")).join(" ")}" fill="none" stroke="${B}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>`;
    const [p, q] = [pts[3]!, pts[4]!];
    return s + arrowHead([q[0] + 14, q[1] - 10], q[0] - p[0], q[1] - p[1], 34, B);
  },
  traodoi() {
    let s =
      disc() +
      `<path d="M96 116H258A36 36 0 0 1 294 152V234A36 36 0 0 1 258 270H138L96 312V270A36 36 0 0 1 60 234V152A36 36 0 0 1 96 116Z" fill="${A}"/>`;
    for (const [y, x2] of [[160, 254], [196, 230], [232, 190]] as const) s += ln(96, y, x2, y, ON, 11);
    s += `<path d="M212 236H368A36 36 0 0 1 404 272V346A36 36 0 0 1 368 382V420L330 382H212A36 36 0 0 1 176 346V272A36 36 0 0 1 212 236Z" fill="${B}"/>`;
    for (const x of [242, 290, 338]) s += `<circle cx="${x}" cy="309" r="14" fill="${ON}"/>`;
    return s;
  },
  khoahoc() {
    const flask = "M200 196L122 374Q112 402 142 404H322Q352 402 342 374L264 196Z";
    return (
      disc() +
      `<clipPath id="__ID__k"><path d="${flask}"/></clipPath>` +
      `<path d="${flask}" fill="${C}"/>` +
      `<g clip-path="url(#__ID__k)"><path d="M100 318Q166 294 232 318T364 318V420H100Z" fill="${A}"/>` +
      `<circle cx="196" cy="366" r="11" fill="${ON}" fill-opacity=".8"/><circle cx="262" cy="350" r="8" fill="${ON}" fill-opacity=".8"/><circle cx="236" cy="384" r="6" fill="${ON}" fill-opacity=".8"/></g>` +
      `<path d="${flask}" fill="none" stroke="${A}" stroke-width="9" stroke-linejoin="round"/>` +
      `<rect x="200" y="122" width="64" height="80" fill="${C}"/>` +
      ln(200, 124, 200, 198, A, 9) +
      ln(264, 124, 264, 198, A, 9) +
      `<rect x="182" y="106" width="100" height="22" rx="11" fill="${A}"/>` +
      `<circle cx="252" cy="78" r="12" fill="${B}"/><circle cx="214" cy="58" r="8" fill="${B}" fill-opacity=".7"/>`
    );
  },
  congnghe() {
    return (
      disc() +
      `<rect x="92" y="116" width="280" height="196" rx="20" fill="${A}"/>` +
      `<rect x="110" y="134" width="244" height="160" rx="8" fill="${ON}"/>` +
      `<path d="M182 182L148 214L182 246M282 182L316 214L282 246" fill="none" stroke="${B}" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/>` +
      ln(250, 172, 214, 256, A, 11) +
      `<path d="M62 324H402L428 358Q430 370 418 370H46Q34 370 36 358Z" fill="${A}" fill-opacity=".8"/>` +
      `<rect x="200" y="324" width="64" height="10" rx="5" fill="${ON}" fill-opacity=".7"/>`
    );
  },
  quytrinh() {
    return disc() + gear(194, 292, 112, 88, 10, A, 34) + gear(330, 160, 76, 58, 8, B, 22);
  },
  timkiem() {
    return (
      disc() +
      ln(286, 298, 382, 394, A, 34) +
      `<circle cx="206" cy="220" r="104" fill="${C}" stroke="${A}" stroke-width="18"/>` +
      `<path d="M146 196A64 64 0 0 1 196 152" fill="none" stroke="${B}" stroke-width="10" stroke-linecap="round"/>` +
      `<rect x="168" y="232" width="20" height="40" rx="5" fill="${A}" fill-opacity=".5"/><rect x="196" y="208" width="20" height="64" rx="5" fill="${A}" fill-opacity=".75"/><rect x="224" y="184" width="20" height="88" rx="5" fill="${B}"/>`
    );
  },
  suckhoe() {
    return (
      disc() +
      `<path d="M232 404C122 334 70 274 70 202C70 142 114 104 164 104C196 104 220 122 232 148C244 122 268 104 300 104C350 104 394 142 394 202C394 274 342 334 232 404Z" fill="${A}"/>` +
      `<path d="M96 240H168L194 194L226 298L256 214L274 240H368" fill="none" stroke="${ON}" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>`
    );
  },
  taichinh() {
    let s =
      disc() +
      `<g transform="rotate(-8 210 200)"><rect x="66" y="122" width="290" height="160" rx="18" fill="${A}" fill-opacity=".5"/>` +
      `<rect x="82" y="138" width="258" height="128" rx="10" fill="none" stroke="${ON}" stroke-width="5" stroke-opacity=".8"/>` +
      `<circle cx="211" cy="202" r="38" fill="none" stroke="${ON}" stroke-width="9"/><circle cx="116" cy="202" r="9" fill="${ON}"/><circle cx="306" cy="202" r="9" fill="${ON}"/></g>`;
    const [cx, rx, ry, hh] = [318, 76, 22, 24];
    for (let k = 0; k < 4; k++) {
      const t = 382 - k * 34;
      s += `<path d="M${cx - rx} ${t}V${t + hh}A${rx} ${ry} 0 0 0 ${cx + rx} ${t + hh}V${t}Z" fill="${A}"/><ellipse cx="${cx}" cy="${t}" rx="${rx}" ry="${ry}" fill="${B}"/>`;
    }
    return s + `<ellipse cx="${cx}" cy="280" rx="44" ry="11" fill="none" stroke="${ON}" stroke-width="5"/>`;
  },
  canbang() {
    const pan = (x: number) =>
      ln(x, 150, x - 48, 284, A, 5, 0.8) + ln(x, 150, x + 48, 284, A, 5, 0.8) + `<path d="M${x - 62} 284H${x + 62}A62 36 0 0 1 ${x - 62} 284Z" fill="${B}"/>`;
    return (
      disc() +
      ln(CX, 128, CX, 398, A, 12) +
      ln(100, 150, 364, 150, A, 12) +
      pan(100) +
      pan(364) +
      `<circle cx="${CX}" cy="122" r="18" fill="${B}"/>` +
      `<path d="M168 398H296Q310 398 314 410L318 422H146L150 410Q154 398 168 398Z" fill="${A}"/>`
    );
  },
  dothi() {
    let s = disc();
    const blocks: Array<[number, number, number, string, number]> = [[76, 84, 170, A, 0.5], [168, 94, 262, A, 1], [270, 76, 204, B, 0.9], [354, 50, 128, A, 0.4]];
    for (const [x, w, h, col, o] of blocks) s += `<rect x="${x}" y="${398 - h}" width="${w}" height="${h}" rx="6" fill="${col}" fill-opacity="${o}"/>`;
    for (let r = 0; r < 6; r++) for (let c = 0; c < 3; c++) s += `<rect x="${182 + c * 26}" y="${158 + r * 36}" width="14" height="20" rx="3" fill="${ON}" fill-opacity=".85"/>`;
    for (let r = 0; r < 4; r++) for (let c = 0; c < 2; c++) s += `<rect x="${290 + c * 28}" y="${218 + r * 36}" width="14" height="20" rx="3" fill="${ON}" fill-opacity=".85"/>`;
    return s + `<rect x="44" y="396" width="376" height="12" rx="6" fill="${A}" fill-opacity=".45"/>`;
  },
  lotrinh() {
    const road = "M100 418C100 330 336 360 336 278S146 214 226 150";
    return (
      disc() +
      `<path d="${road}" fill="none" stroke="${A}" stroke-width="44" stroke-linecap="round"/>` +
      `<path d="${road}" fill="none" stroke="${ON}" stroke-width="6" stroke-dasharray="16 18" stroke-linecap="round"/>` +
      ln(226, 150, 226, 66, A, 8) +
      `<path d="M230 68L304 90L230 112Z" fill="${B}" stroke="${B}" stroke-width="4" stroke-linejoin="round"/>`
    );
  },
  thanhtich() {
    return (
      disc() +
      `<path d="M152 140H120C100 140 96 162 100 180C106 208 130 224 158 228M312 140H344C364 140 368 162 364 180C358 208 334 224 306 228" fill="none" stroke="${A}" stroke-width="13" stroke-linecap="round"/>` +
      `<path d="M150 116H314V190C314 252 280 292 232 298C184 292 150 252 150 190Z" fill="${A}"/>` +
      star(232, 196, 38, 16, ON) +
      `<rect x="216" y="296" width="32" height="50" fill="${A}"/><rect x="170" y="342" width="124" height="22" rx="8" fill="${A}"/>` +
      `<rect x="148" y="364" width="168" height="34" rx="10" fill="${B}"/>`
    );
  },
  nangluong() {
    return (
      disc() +
      `<circle cx="${CX}" cy="${CY}" r="150" fill="none" stroke="${B}" stroke-width="8" stroke-dasharray="3 22" stroke-linecap="round"/>` +
      `<path d="M266 86L146 272H226L196 414L322 214H240Z" fill="${A}" stroke="${A}" stroke-width="10" stroke-linejoin="round"/>`
    );
  },
  nghethuat() {
    // Bảng màu có lỗ xỏ ngón (evenodd), các chấm màu lấy từ những biến khác --sa để nổi trên nền bảng.
    return (
      disc() +
      `<path d="M232 100C332 100 400 160 400 238C400 300 360 322 320 312C288 304 268 324 280 354C294 392 262 410 222 408C128 404 64 338 64 248C64 160 138 100 232 100ZM166 322a26 26 0 1 0 52 0a26 26 0 1 0 -52 0Z" fill="${A}" fill-rule="evenodd"/>` +
      `<circle cx="146" cy="214" r="24" fill="${B}"/><circle cx="214" cy="164" r="24" fill="${B}" fill-opacity=".5"/><circle cx="292" cy="172" r="24" fill="${ON}"/><circle cx="340" cy="236" r="22" fill="${G2}"/>`
    );
  },
};

/** Hình minh hoạ cho vùng w × h: vẽ ở khung 464 × 500 rồi thu phóng phủ kín vùng (như "slice"), giữ tâm. */
function illustrationBody(id: SlideIllustrationId, w: number, h: number): string {
  const body = ILL[id]();
  if (w === IW && h === IH) return body;
  const k = Math.max(w / IW, h / IH);
  return `<g transform="translate(${f((w - IW * k) / 2)} ${f((h - IH * k) / 2)}) scale(${Math.round(k * 10000) / 10000})">${body}</g>`;
}

const cache = new Map<string, string>();

/** Phần thân SVG của một hoa văn hoặc hình minh hoạ cho vùng w × h; id nội bộ thay "__ID__" bằng `idPrefix`. */
export function motifSvgBody(id: SlideArtId, w: number, h: number, idPrefix = "m"): string {
  const key = `${id}:${w}x${h}`;
  let body = cache.get(key);
  if (body === undefined) {
    body = isSlideIllustrationId(id) ? illustrationBody(id, w, h) : GEN[id as SlideMotifId](w, h, rng(SLIDE_MOTIFS.indexOf(id as SlideMotifId) * 7919 + 17));
    cache.set(key, body);
  }
  return body.includes("__ID__") ? body.replaceAll("__ID__", idPrefix) : body;
}
