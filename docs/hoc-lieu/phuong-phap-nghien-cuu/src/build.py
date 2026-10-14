# -*- coding: utf-8 -*-
"""Ghép các mảnh học liệu thành một manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/phuong-phap-nghien-cuu/src/build.py

Một module duy nhất ("Phương pháp nghiên cứu & Viết luận văn"), nhiều bài —
cùng quy ước với khoá Nhập môn NCKH. Bài mới soạn thêm thì thêm vào danh sách
`LESSONS` dưới đây, theo đúng thứ tự học.
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
import m6  # noqa: E402

LESSONS = [m1.LESSON, m2.LESSON, m3.LESSON, m4.LESSON, m5.LESSON, m6.LESSON]

MODULE = {
    "title": "Phương pháp nghiên cứu & Viết luận văn",
    "description": (
        "Toàn bộ quy trình đưa một đề tài luận văn đã có từ khung lý thuyết tới bản luận văn hoàn "
        "chỉnh, dùng đúng đề tài của từng học viên xuyên suốt: (1) khung lý thuyết và giả thuyết, "
        "(2) tổng quan tài liệu hệ thống, (3) thiết kế nghiên cứu, (4) thu thập và xử lý dữ liệu, "
        "(5) viết luận văn 5 chương, (6) đạo đức nghiên cứu."
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
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-phuong-phap-nghien-cuu.json")
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
