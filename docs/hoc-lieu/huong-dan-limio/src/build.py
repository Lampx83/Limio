# -*- coding: utf-8 -*-
"""Gộp các file bài học thành manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/huong-dan-limio/src/build.py                 # cả khoá
    python3 docs/hoc-lieu/huong-dan-limio/src/build.py --module 2      # một module, để nhập nối
    python3 docs/hoc-lieu/huong-dan-limio/src/build.py --allow-missing # bỏ qua bài chưa viết
"""
import argparse, importlib, json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import course

# (số chương, tên chương, mô tả, [số bài])
PLAN = [
    (
        "Chương 1 · Dựng khoá học đầu tiên",
        "Từ lúc làm quen thanh điều hướng tới lúc khoá học được xuất bản và học viên vào học: "
        "tạo khoá, dựng chương và bài học, thêm nội dung, rồi mời học viên.",
        ["m1_l1", "m1_l2", "m1_l3", "m1_l4"],
    ),
    (
        "Chương 2 · Kiểm tra và đánh giá",
        "Hai hệ thống soạn câu hỏi của Limio và khi nào dùng hệ thống nào: bài kiểm tra cuối bài "
        "để ôn tập, ngân hàng câu hỏi và đề thi để tổ chức kỳ thi.",
        ["m2_l1", "m2_l2", "m2_l3"],
    ),
    (
        "Chương 3 · Bài tập và phản hồi cá nhân hoá",
        "Giao bài tập, viết tiêu chí chấm, chấm bài có AI gợi ý, và cách Limio chỉ cho từng học "
        "viên chỗ hiểu sai cùng bài nên học tiếp.",
        ["m3_l1", "m3_l2"],
    ),
    (
        "Chương 4 · Lớp học và theo dõi tiến độ",
        "Chia lớp, đặt hạn riêng cho từng lớp, tạo không khí thảo luận ngay trong bài học, và đọc "
        "số liệu để biết học viên nào cần được giúp.",
        ["m4_l1", "m4_l2", "m4_l3"],
    ),
]

ap = argparse.ArgumentParser(description="Sinh manifest khoá Hướng dẫn sử dụng Limio.")
ap.add_argument("--module", type=int, help="chỉ xuất một chương (1-4), để nhập nối bằng --into")
ap.add_argument("--out", help="đường dẫn tệp đầu ra")
ap.add_argument("--allow-missing", action="store_true", help="bỏ qua bài chưa có file")
args = ap.parse_args()

modules, missing = [], []
for title, desc, files in PLAN:
    lessons = []
    for name in files:
        try:
            lesson = importlib.import_module(name).LESSON
            # Khoá nói với giảng viên: importer mặc định xưng "bạn" nên phải ghi đè.
            lesson.setdefault("objectivesLead", "Học xong bài này, thầy/cô có thể:")
            lessons.append(lesson)
        except ModuleNotFoundError as e:
            if e.name != name:
                raise
            missing.append(name)
    if lessons:
        modules.append({"title": title, "description": desc, "lessons": lessons})

if missing and not args.allow_missing:
    sys.exit(f"Thiếu bài: {', '.join(missing)} (dùng --allow-missing để bỏ qua)")

if args.module:
    if not 1 <= args.module <= len(PLAN):
        ap.error(f"--module phải nằm trong 1..{len(PLAN)}")
    modules = [m for m in modules if m["title"] == PLAN[args.module - 1][0]]

manifest = {
    "course": course.COURSE,
    "misconceptions": course.MISCONCEPTIONS,
    "feedbackTemplates": course.FEEDBACK_TEMPLATES,
    "modules": modules,
}

default = f"module-{args.module}.json" if args.module else "khoa-huong-dan-limio.json"
out = args.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", default)
with open(out, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)

import mockup
shots_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "shots.json")
if not args.out:  # chỉ khi build thật; chạy thử của agent không ghi đè danh sách chung
    with open(shots_path, "w", encoding="utf-8") as f:
        json.dump(mockup.SHOTS, f, ensure_ascii=False, indent=1)

n_q = sum(len(l.get("quiz", {}).get("questions", [])) for m in modules for l in m["lessons"])
print(f"{len(modules)} chương · {sum(len(m['lessons']) for m in modules)} bài · {n_q} câu hỏi → {os.path.realpath(out)}")
print(f"{len(mockup.SHOTS)} ảnh chụp cần có")
if missing:
    print("Chưa viết:", ", ".join(missing))
