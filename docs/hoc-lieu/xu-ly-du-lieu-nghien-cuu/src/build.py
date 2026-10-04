# -*- coding: utf-8 -*-
"""Ghép các mảnh học liệu thành một manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/xu-ly-du-lieu-nghien-cuu/src/build.py

Một module duy nhất ("Xử lý & Phân tích dữ liệu nghiên cứu"), nhiều bài — cùng
quy ước với các khoá kỹ năng nghiên cứu khác. Bài mới soạn thêm thì thêm vào
danh sách `LESSONS` dưới đây, theo đúng thứ tự học.
"""

import argparse
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))

import course  # noqa: E402
import m1  # noqa: E402
import m2  # noqa: E402
import m3  # noqa: E402
import m4  # noqa: E402
import m5  # noqa: E402

LESSONS = [m1.LESSON, m2.LESSON, m3.LESSON, m4.LESSON, m5.LESSON]

MODULE = {
    "title": "Xử lý & Phân tích dữ liệu nghiên cứu",
    "description": (
        "Thực hành công cụ trên một bộ dữ liệu khảo sát mẫu có lỗi thật, xuyên suốt cả khoá: "
        "(1) làm sạch dữ liệu, (2) thống kê mô tả và kiểm định giả thuyết, (3) EFA và độ tin cậy, "
        "(4) mã hoá dữ liệu định tính và độ tin cậy giữa người mã hoá, (5) trực quan hoá dữ liệu "
        "và đóng gói để tái lập kết quả."
    ),
    "lessons": LESSONS,
}


def build():
    return {
        "course": course.COURSE,
        "misconceptions": course.MISCONCEPTIONS,
        "feedbackTemplates": course.FEEDBACK_TEMPLATES,
        "modules": [MODULE],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-xu-ly-du-lieu-nghien-cuu.json")
    args = ap.parse_args()

    manifest = build()
    args.out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    lessons = len(MODULE["lessons"])
    questions = sum(len(l.get("quiz", {}).get("questions", [])) for l in MODULE["lessons"])
    print(f"→ {args.out}")
    print(
        f"  1 module · {lessons} bài · {questions} câu hỏi · "
        f"{len(manifest['misconceptions'])} lỗi tư duy · {len(manifest['feedbackTemplates'])} mẫu phản hồi"
    )


if __name__ == "__main__":
    main()
