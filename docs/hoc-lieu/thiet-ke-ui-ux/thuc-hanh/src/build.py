"""Dựng lại Thực hành 2 + hai đề bài tập nhóm và manifest đẩy lên Limio.

    python3 docs/hoc-lieu/thiet-ke-ui-ux/thuc-hanh/src/build.py

Rồi đẩy từng bài (thêm --create ở lần đầu):
    pnpm update:lesson:prod -- --file docs/hoc-lieu/thiet-ke-ui-ux/thuc-hanh/bai-tap-nhom-manifest.json \
        --owner joynguyen7@gmail.com --lesson "Bài 2.4" --dry-run
"""
import json, subprocess, sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
OUT = SRC.parent
PAGES = {"th2.py": "bai-thuc-hanh-2.html", "gk.py": "de-giua-ky.html", "ck.py": "de-cuoi-ky.html"}
for script, html in PAGES.items():
    subprocess.run([sys.executable, str(SRC / script), str(OUT / html)], cwd=SRC, check=True)

def body(f):
    return "```html\n" + (OUT / f).read_text().rstrip() + "\n```"

course = json.loads((OUT / "bai-1.6-manifest.json").read_text())["course"]
manifest = {"course": course, "modules": [
    {"title": "Module 2 · Nghiên cứu người dùng", "lessons": [
        {"title": "Bài 2.4 · Đề bài tập nhóm giữa kỳ",
         "description": "Bài tập nhóm 1: tìm hiểu 3 quy luật trong Laws of UX, dùng chúng soi một trang của sinh viên trên Limio, hỏi 5 người dùng thật, vẽ lại bằng giấy (paper prototype) và thuyết trình 10 phút trước lớp.",
         "durationMin": 20, "body": body("de-giua-ky.html")},
        {"title": "Bài 2.5 · Thực hành 2: Làm quen Figma, chuẩn bị cho bài tập cuối kỳ",
         "description": "Buổi thực hành 120 phút, bước đệm cho bài tập cuối kỳ: làm quen Figma bằng cách dựng lại thẻ bài tập của Limio, tập chuyển một bản vẽ giấy thành màn hình điện thoại trên Figma, rồi dựng sẵn file nhóm có cấu trúc, phân quyền và phiên bản.",
         "durationMin": 120, "body": body("bai-thuc-hanh-2.html")},
    ]},
    {"title": "Module 4 · Wireframe và prototype", "lessons": [
        {"title": "Bài 4.4 · Đề bài tập nhóm cuối kỳ",
         "description": "Bài tập nhóm 2: đưa bản giấy giữa kỳ lên Figma thành giao diện hoàn chỉnh bám hệ thống thiết kế có sẵn của Limio — bản điện thoại và máy tính, kiểm thử với 5 người, đánh giá heuristic chéo, đặc tả bàn giao và kế hoạch đo lường.",
         "durationMin": 20, "body": body("de-cuoi-ky.html")},
    ]},
]}
(OUT / "bai-tap-nhom-manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=2))
print("Đã dựng:", ", ".join(PAGES.values()), "+ bai-tap-nhom-manifest.json")
