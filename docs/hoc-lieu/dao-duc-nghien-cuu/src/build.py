# -*- coding: utf-8 -*-
"""Ghép các mảnh học liệu thành một manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/dao-duc-nghien-cuu/src/build.py

Một module duy nhất ("Đạo đức nghiên cứu khoa học"), 6 bài — cùng quy ước với
các khoá kỹ năng nghiên cứu khác. Bài mới soạn thêm thì thêm vào danh sách
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
    "title": "Đạo đức nghiên cứu khoa học",
    "description": (
        "Đào sâu đạo đức nghiên cứu ở những góc chưa dạy tại 3 khoá kia trong bộ kỹ năng nghiên "
        "cứu: (1) liêm chính học thuật — đạo văn, tự đạo văn, ngụy tạo/sửa dữ liệu, (2) quy trình "
        "hội đồng đạo đức đầy đủ, (3) đạo đức dữ liệu nghiên cứu kèm khung pháp lý Việt Nam, "
        "(4) xung đột lợi ích, (5) đạo đức dùng AI trong toàn bộ quy trình nghiên cứu, "
        "(6) văn hoá liêm chính và báo cáo sai phạm."
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
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-dao-duc-nghien-cuu.json")
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
