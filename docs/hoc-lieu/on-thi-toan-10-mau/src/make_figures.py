#!/usr/bin/env python3
"""Vẽ đồ thị parabol y = x² − 5x + 6 thành SVG và đặt vào kho ảnh bài học của máy dev.

Bộ lọc HTML của trang bài (SafeHtml, USE_PROFILES.html) cắt <svg> nội tuyến, nên hình phải là TỆP ảnh nhúng bằng
![mô tả](/api/lesson-media/images/<tên>). Tên theo khuôn `<userId>-<ms>-<hex>.svg` để route ảnh tìm lại được theo
tháng. Chạy lại sinh tên mới; in URL để dán vào build.py (hằng FIG_PARABOLA).

    python3 -I docs/hoc-lieu/on-thi-toan-10-mau/src/make_figures.py <userId>
"""
import secrets
import sys
import time
from pathlib import Path

uid = sys.argv[1]
W, H = 480, 330
X0, X1, Y0, Y1 = -0.6, 5.6, -1.6, 6.8  # miền toán học hiển thị
ML, MR, MT, MB = 30, 20, 20, 46


def px(x):
    return ML + (x - X0) / (X1 - X0) * (W - ML - MR)


def py(y):
    return H - MB - (y - Y0) / (Y1 - Y0) * (H - MT - MB)


f = lambda x: x * x - 5 * x + 6
pts = []
n = 120
for i in range(n + 1):
    x = 0.0 + 5.0 * i / n
    pts.append(f"{px(x):.1f},{py(f(x)):.1f}")

parts = [f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" font-family="Helvetica, Arial, sans-serif">']
parts.append(f'<rect width="{W}" height="{H}" fill="#ffffff"/>')
for gx in range(0, 6):
    parts.append(f'<line x1="{px(gx):.1f}" y1="{py(Y0):.1f}" x2="{px(gx):.1f}" y2="{py(Y1):.1f}" stroke="#e2e8f0"/>')
for gy in range(-1, 7):
    parts.append(f'<line x1="{px(X0):.1f}" y1="{py(gy):.1f}" x2="{px(X1):.1f}" y2="{py(gy):.1f}" stroke="#e2e8f0"/>')
parts.append(f'<line x1="{px(X0):.1f}" y1="{py(0):.1f}" x2="{px(X1):.1f}" y2="{py(0):.1f}" stroke="#475569" stroke-width="1.6"/>')
parts.append(f'<line x1="{px(0):.1f}" y1="{py(Y0):.1f}" x2="{px(0):.1f}" y2="{py(Y1):.1f}" stroke="#475569" stroke-width="1.6"/>')
for gx in range(1, 6):
    parts.append(f'<text x="{px(gx):.1f}" y="{py(0) + 16:.1f}" font-size="13" fill="#475569" text-anchor="middle">{gx}</text>')
for gy in range(1, 7):
    parts.append(f'<text x="{px(0) - 8:.1f}" y="{py(gy) + 4:.1f}" font-size="13" fill="#475569" text-anchor="end">{gy}</text>')
parts.append(f'<text x="{px(X1) - 4:.1f}" y="{py(0) - 8:.1f}" font-size="14" fill="#0f172a" text-anchor="end" font-style="italic">x</text>')
parts.append(f'<text x="{px(0) + 8:.1f}" y="{py(Y1) + 12:.1f}" font-size="14" fill="#0f172a" font-style="italic">y</text>')
parts.append(f'<polyline points="{" ".join(pts)}" fill="none" stroke="#2563eb" stroke-width="3" stroke-linejoin="round"/>')
for x in (2, 3):
    parts.append(f'<circle cx="{px(x):.1f}" cy="{py(0):.1f}" r="5.5" fill="#dc2626"/>')
parts.append(f'<circle cx="{px(0):.1f}" cy="{py(6):.1f}" r="4.5" fill="#2563eb"/>')
# Nhãn nghiệm nằm DƯỚI trục (dưới hàng số), vì phía trên trục đường cong đi ngang qua nhãn.
parts.append(f'<text x="{px(2):.1f}" y="{py(0) + 34:.1f}" font-size="14" fill="#dc2626" text-anchor="middle" font-weight="600">x = 2</text>')
parts.append(f'<text x="{px(3):.1f}" y="{py(0) + 34:.1f}" font-size="14" fill="#dc2626" text-anchor="middle" font-weight="600">x = 3</text>')
parts.append(f'<text x="{px(4.0):.1f}" y="{py(f(4.65)):.1f}" font-size="14" fill="#2563eb" font-weight="600">y = x² − 5x + 6</text>')
parts.append("</svg>")

now = int(time.time() * 1000)
name = f"{uid}-{now}-{secrets.token_hex(8)}.svg"
t = time.gmtime(now / 1000)
dest = Path(__file__).resolve().parents[4] / "apps/web/uploads/public/lesson-media/images" / f"{t.tm_year}" / f"{t.tm_mon:02d}" / name
dest.parent.mkdir(parents=True, exist_ok=True)
dest.write_text("\n".join(parts), encoding="utf-8")
print(f"/api/lesson-media/images/{name}")
