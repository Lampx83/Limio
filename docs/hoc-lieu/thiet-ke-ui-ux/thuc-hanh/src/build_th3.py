"""Dựng Thực hành 3 (Module 7) + manifest để đẩy lên Limio.

    python3 docs/hoc-lieu/thiet-ke-ui-ux/thuc-hanh/src/build_th3.py

Rồi đẩy (thêm --create ở lần đầu):
    pnpm update:lesson:prod -- --file docs/hoc-lieu/thiet-ke-ui-ux/thuc-hanh/bai-7.5-manifest.json \
        --owner joynguyen7@gmail.com --lesson "Bài 7.5" --create --dry-run
"""
import json, subprocess, sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
HTML = "phieu-kham-nghiem-module-7.html"
subprocess.run([sys.executable, str(SRC / "th3.py"), str(OUT / HTML)], cwd=SRC, check=True)

body = "```html\n" + (OUT / HTML).read_text().rstrip() + "\n```"
course = json.loads((OUT / "bai-1.6-manifest.json").read_text())["course"]
manifest = {"course": course, "modules": [
    {"title": "Module 7 · Đặc thù của sản phẩm giáo dục", "lessons": [
        {"title": "Bài 7.5 · Thực hành 3: Khám nghiệm một màn hình Limio",
         "description": "Buổi thực hành 120 phút: dùng bốn câu hỏi của Bài 7.1–7.4 để khám nghiệm các màn hình thật của Limio (Tổng quan của tôi, Cài đặt, bài học, quiz và đề thi khi mất mạng), rồi chọn một việc sửa trước và vẽ giấy.",
         "durationMin": 120, "body": body},
    ]},
]}
(OUT / "bai-7.5-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print("Đã dựng:", HTML, "+ bai-7.5-manifest.json")
