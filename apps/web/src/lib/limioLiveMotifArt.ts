// Hình SVG của 16 hoa văn trang trí slide (xem limioLiveMotifs.ts). Tự vẽ bằng mã, không dùng ảnh ngoài nên
// không vướng bản quyền và không tốn tải mạng. Màu chỉ dùng biến giao diện (--sa, --sa2, --ssoft, --sglow1/2)
// nên tự đổi theo giao diện sáng/tối và theo màu thương hiệu.
//
// Mỗi hàm trả về phần thân SVG (chuỗi) cho vùng w × h. Số ngẫu nhiên có seed cố định theo hoa văn, nên một hoa văn
// luôn ra đúng một hình ở mọi nơi (trình sửa, trình chiếu, ảnh thu nhỏ). Id nội bộ (clipPath, gradient) viết là
// "__ID__", nơi vẽ thay bằng id duy nhất của phần tử để hai slide trên cùng trang không giẫm lên nhau.

import { SLIDE_MOTIFS, type SlideMotifId } from "./limioLiveMotifs";

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

const cache = new Map<string, string>();

/** Phần thân SVG của một hoa văn cho vùng w × h; id nội bộ thay "__ID__" bằng `idPrefix`. */
export function motifSvgBody(id: SlideMotifId, w: number, h: number, idPrefix = "m"): string {
  const key = `${id}:${w}x${h}`;
  let body = cache.get(key);
  if (body === undefined) {
    body = GEN[id](w, h, rng(SLIDE_MOTIFS.indexOf(id) * 7919 + 17));
    cache.set(key, body);
  }
  return body.includes("__ID__") ? body.replaceAll("__ID__", idPrefix) : body;
}
