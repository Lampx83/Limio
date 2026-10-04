# -*- coding: utf-8 -*-
"""Ghép các mảnh học liệu thành một manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/cong-bo-quoc-te/src/build.py

Một module duy nhất ("NCKH nâng cao & Công bố quốc tế"), nhiều bài — cùng quy
ước với các khoá kỹ năng nghiên cứu khác. Bài mới soạn thêm thì thêm vào danh
sách `LESSONS` dưới đây, theo đúng thứ tự học.
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
import m7  # noqa: E402

LESSONS = [m1.LESSON, m2.LESSON, m3.LESSON, m4.LESSON, m5.LESSON, m6.LESSON, m7.LESSON]

MODULE = {
    "title": "NCKH nâng cao & Công bố quốc tế",
    "description": (
        "Toàn bộ quy trình đưa một hướng nghiên cứu tới công bố quốc tế: (1) định vị nghiên cứu "
        "và đóng góp, (2) tổng quan tài liệu hệ thống đầy đủ, (3) phương pháp nghiên cứu nâng cao, "
        "(4) viết bài báo IMRaD và trả lời phản biện, (5) chọn venue và tránh tạp chí săn mồi, "
        "(6) dùng AI hỗ trợ viết có kiểm soát, (7) viết đề xuất xin tài trợ và networking."
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
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-cong-bo-quoc-te.json")
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
