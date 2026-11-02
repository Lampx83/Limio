#!/usr/bin/env python3
"""Vẽ hình cho các đề và đặt vào kho ảnh bài học; ghi URL vào src/hinh/urls.json để build.py đọc.

Bộ lọc HTML của trang bài cắt <svg> nội tuyến nên hình phải là TỆP ảnh. Tên tệp theo khuôn `<userId>-<ms>-<hex>.svg`
để route ảnh tìm lại được theo tháng. Bản SVG gốc nằm ở src/hinh/ (kho ảnh không vào git). Toạ độ hình học tính từ đúng
cách dựng trong đề, và các tính chất phải chứng minh được kiểm bằng số trước khi vẽ.

    python3 docs/hoc-lieu/giai-de-toan-vao-10/src/make_figures.py <userId>
"""
import json
import math
import secrets
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
INK, MUTED, BLUE, RED, GREEN = "#0f172a", "#64748b", "#2563eb", "#dc2626", "#0d9488"


class V(tuple):
    def __add__(a, b): return V((a[0] + b[0], a[1] + b[1]))
    def __sub__(a, b): return V((a[0] - b[0], a[1] - b[1]))
    def __mul__(a, k): return V((a[0] * k, a[1] * k))
    def dot(a, b): return a[0] * b[0] + a[1] * b[1]
    def len(a): return math.hypot(a[0], a[1])


def angle(p, q, r):
    u, v = p - q, r - q
    return math.degrees(math.acos(max(-1, min(1, u.dot(v) / u.len() / v.len()))))


def dung_hinh(xa, t):
    """Đề Hà Nội 2026, câu IV.2. Đường tròn tâm O bán kính 1; xa là hoành độ của A; H chia AB theo tỉ lệ t."""
    B, C = V((-1.0, 0.0)), V((1.0, 0.0))
    A = V((xa, math.sqrt(1 - xa * xa)))
    H = A + (B - A) * t
    D = V((H[0], 0.0))
    E = A + (C - A) * ((H[0] - A[0]) / (C[0] - A[0]))
    d = H - C
    F = C + d * (-2 * C.dot(d) / d.dot(d))
    d2 = F - D
    M = D + d2 * ((A[1] - D[1]) / d2[1])
    d3 = M - B
    K = B + d3 * (-2 * B.dot(d3) / d3.dot(d3))
    N = B + d3 * ((H[0] - B[0]) / d3[0])
    I = V((H[0], A[1]))
    return dict(A=A, B=B, C=C, O=V((0.0, 0.0)), H=H, D=D, E=E, F=F, M=M, K=K, N=N, I=I)


def kiem_hinh():
    """Các kết luận của câu IV.2, thử trên nhiều vị trí của A và H. Sai ở đâu thì dừng, không vẽ."""
    for xa in (-0.15, -0.28, -0.45, -0.6, -0.8):
        for t in (0.1, 0.2, 0.3, 0.4, 0.45):
            p = dung_hinh(xa, t)
            A, B, C, H, D, E, M, K, N = (p[k] for k in "ABCHDEMKN")
            assert abs((A - E).len() * (B - C).len() - (E - H).len() * (A - B).len()) < 1e-9, "AE.BC = EH.AB"
            assert abs(angle(E, M, H) - 90) < 1e-6, "góc EMH vuông"
            assert abs((H - K).len() - (H - M).len()) < 1e-9, "HK = HM"
            assert abs((B - K).len() * (B - N).len() - (B - H).len() * (B - A).len()) < 1e-9, "BK.BN = BH.BA"
            assert B[0] < K[0] < M[0] < N[0], "thứ tự B, K, M, N"
            assert abs(angle(H, K, B) - angle(N, A, B)) < 1e-6, "góc BKH = góc BAN"


class Hinh:
    def __init__(self, scale, cx, cy, w, h):
        self.s, self.cx, self.cy = scale, cx, cy
        self.w, self.h = w, h
        self.out = [
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" font-family="Helvetica, Arial, sans-serif">',
            f'<rect width="{w}" height="{h}" fill="#ffffff"/>',
        ]

    def xy(self, p):
        return self.cx + p[0] * self.s, self.cy - p[1] * self.s

    def duong(self, a, b, mau=INK, rong=1.8, net=None):
        x1, y1, x2, y2 = *self.xy(a), *self.xy(b)
        dash = f' stroke-dasharray="{net}"' if net else ""
        self.out.append(f'<line x1="{x1:.1f}" y1="{y1:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{mau}" stroke-width="{rong}"{dash}/>')

    def tron(self, tam, r, mau=INK, rong=1.8, net=None):
        x, y = self.xy(tam)
        dash = f' stroke-dasharray="{net}"' if net else ""
        self.out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{r * self.s:.1f}" fill="none" stroke="{mau}" stroke-width="{rong}"{dash}/>')

    def vuong(self, dinh, huong1, huong2, mau=INK, canh=11):
        u, v = huong1 - dinh, huong2 - dinh
        u, v = u * (canh / self.s / u.len()), v * (canh / self.s / v.len())
        pts = [dinh + u, dinh + u + v, dinh + v]
        s = " ".join("{:.1f},{:.1f}".format(*self.xy(q)) for q in pts)
        self.out.append(f'<polyline points="{s}" fill="none" stroke="{mau}" stroke-width="1.4"/>')

    def diem(self, p, ten, dx=0, dy=0, mau=INK):
        x, y = self.xy(p)
        self.out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.4" fill="{mau}"/>')
        self.out.append(f'<text x="{x + dx:.1f}" y="{y + dy:.1f}" font-size="17" fill="{mau}" font-style="italic" font-weight="600" text-anchor="middle">{ten}</text>')

    def viet(self):
        return "\n".join(self.out + ["</svg>"])


# Vị trí nhãn (dx, dy) tính bằng điểm ảnh, đặt tay cho khỏi đè lên nét.
NHAN = dict(A=(12, -9), B=(-14, 6), C=(14, 6), O=(0, 22), H=(15, 8), D=(0, 22), E=(13, -6), F=(-15, 4), M=(-15, -5), K=(-15, 8), N=(0, -10), I=(-11, -8))


def hinh_nen(p, cy=320, h=590):
    v = Hinh(250, 300, cy, 600, h)
    v.tron(p["O"], 1)
    v.duong(p["B"], p["C"])
    v.duong(p["A"], p["B"])
    v.duong(p["E"], p["C"])
    v.duong(p["E"], p["D"])
    v.vuong(p["A"], p["B"], p["C"])
    v.vuong(p["D"], p["C"], p["E"])
    return v


def dat_ten(v, p, ten, mau=None):
    for k in ten:
        v.diem(p[k], k, *NHAN[k], mau=(mau or {}).get(k, INK))


def hinh_iv2a(p):
    v = hinh_nen(p)
    tam = (p["H"] + p["C"]) * 0.5
    v.tron(tam, (p["H"] - p["C"]).len() / 2, mau=BLUE, rong=2, net="7 5")
    v.duong(p["H"], p["C"], mau=BLUE, rong=2.2)
    dat_ten(v, p, "ABCOHDE", {"H": BLUE, "C": BLUE})
    return v


def hinh_iv2b(p):
    v = hinh_nen(p)
    v.duong(p["H"], p["F"], mau=MUTED)
    v.duong(p["H"], p["C"], mau=MUTED)
    v.duong(p["B"], p["F"], mau=MUTED)
    v.duong(p["A"], p["D"], mau=GREEN, rong=2)
    v.duong(p["D"], p["M"], mau=GREEN, rong=2)
    v.duong(p["A"], p["M"], mau=BLUE, rong=2)
    v.duong(p["M"], p["E"], mau=RED, rong=2)
    v.duong(p["M"], p["H"], mau=RED, rong=2)
    v.vuong(p["M"], p["E"], p["H"], mau=RED, canh=9)
    dat_ten(v, p, "ABCOHDEFMI", {"M": RED})
    return v


def hinh_iv2c(p):
    # N nằm cao hơn nên hình này phải chừa thêm khoảng trên.
    v = hinh_nen(p, cy=375, h=645)
    v.duong(p["H"], p["F"], mau=MUTED)
    v.duong(p["H"], p["C"], mau=MUTED)
    v.duong(p["D"], p["M"], mau=MUTED)
    v.duong(p["A"], p["M"], mau=MUTED)
    v.duong(p["E"], p["N"], mau=MUTED, net="5 4")
    v.duong(p["B"], p["N"], mau=BLUE, rong=2)
    v.duong(p["A"], p["N"], mau=GREEN, rong=2)
    v.duong(p["H"], p["K"], mau=RED, rong=2.2)
    v.duong(p["H"], p["M"], mau=RED, rong=2.2)
    v.tron(p["H"], (p["H"] - p["A"]).len(), mau=RED, rong=1.4, net="4 4")
    dat_ten(v, p, "ABCOHDEFMKN", {"K": RED, "M": RED, "H": RED})
    return v


def hinh_tru():
    """Xô hình trụ của câu IV.1."""
    w, h = 340, 330
    cx, rx, ry, top, bot = 160, 95, 24, 62, 268
    o = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}" font-family="Helvetica, Arial, sans-serif">',
         f'<rect width="{w}" height="{h}" fill="#ffffff"/>',
         f'<ellipse cx="{cx}" cy="{top}" rx="{rx}" ry="{ry}" fill="#eff6ff" stroke="{INK}" stroke-width="2"/>',
         f'<line x1="{cx - rx}" y1="{top}" x2="{cx - rx}" y2="{bot}" stroke="{INK}" stroke-width="2"/>',
         f'<line x1="{cx + rx}" y1="{top}" x2="{cx + rx}" y2="{bot}" stroke="{INK}" stroke-width="2"/>',
         f'<path d="M {cx - rx} {bot} A {rx} {ry} 0 0 0 {cx + rx} {bot}" fill="none" stroke="{INK}" stroke-width="2"/>',
         f'<path d="M {cx - rx} {bot} A {rx} {ry} 0 0 1 {cx + rx} {bot}" fill="none" stroke="{MUTED}" stroke-width="1.6" stroke-dasharray="6 5"/>',
         f'<line x1="{cx}" y1="{top}" x2="{cx + rx}" y2="{top}" stroke="{BLUE}" stroke-width="2.2"/>',
         f'<circle cx="{cx}" cy="{top}" r="3.2" fill="{BLUE}"/>',
         f'<text x="{cx + rx / 2}" y="{top + 22}" font-size="16" fill="{BLUE}" font-weight="600" text-anchor="middle">12 cm</text>',
         f'<line x1="{cx + rx + 22}" y1="{top}" x2="{cx + rx + 22}" y2="{bot}" stroke="{RED}" stroke-width="2"/>',
         f'<line x1="{cx + rx + 15}" y1="{top}" x2="{cx + rx + 29}" y2="{top}" stroke="{RED}" stroke-width="2"/>',
         f'<line x1="{cx + rx + 15}" y1="{bot}" x2="{cx + rx + 29}" y2="{bot}" stroke="{RED}" stroke-width="2"/>',
         f'<text x="{cx + rx + 31}" y="{(top + bot) / 2 + 5}" font-size="16" fill="{RED}" font-weight="600">25 cm</text>',
         "</svg>"]
    return "\n".join(o)


if __name__ == "__main__":
    kiem_hinh()
    p = dung_hinh(-0.28, 0.2)
    hinh = {
        "hn2026-tru": hinh_tru(),
        "hn2026-iv2a": hinh_iv2a(p).viet(),
        "hn2026-iv2b": hinh_iv2b(p).viet(),
        "hn2026-iv2c": hinh_iv2c(p).viet(),
    }
    uid = sys.argv[1] if len(sys.argv) > 1 else None
    urls = {}
    for ten, svg in hinh.items():
        (HERE / "hinh" / f"{ten}.svg").write_text(svg, encoding="utf-8")
        if uid:
            now = int(time.time() * 1000)
            name = f"{uid}-{now}-{secrets.token_hex(8)}.svg"
            t = time.gmtime(now / 1000)
            dest = HERE.parents[3] / "apps/web/uploads/public/lesson-media/images" / f"{t.tm_year}" / f"{t.tm_mon:02d}" / name
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_text(svg, encoding="utf-8")
            urls[ten] = f"/api/lesson-media/images/{name}"
    if uid:
        (HERE / "hinh" / "urls.json").write_text(json.dumps(urls, indent=2) + "\n", encoding="utf-8")
    print("đã vẽ", len(hinh), "hình; các tính chất câu IV.2 đúng trên mọi vị trí đã thử")
