# -*- coding: utf-8 -*-
"""Ghép các mảnh học liệu thành một manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/nhap-mon-nckh/src/build.py

Soạn bằng Python chứ không viết thẳng JSON vì thân bài là văn xuôi dài: chuỗi
`r\"\"\"…\"\"\"` giữ nguyên xuống dòng và dấu nháy, còn JSON thì bắt escape từng ký
tự — sửa một câu trong bài phải đếm dấu gạch chéo.

Toàn bộ 5 bài nằm trong **một module duy nhất** ("Nhập môn NCKH") — khoá này
gọn (mỗi bài tương đương một chủ đề trong lộ trình làm đề tài NCKH sinh viên:
đặt câu hỏi → đọc tài liệu → trích dẫn → thiết kế → viết), không cần chia
thành nhiều module như khoá Kỹ năng mềm. Bài mới soạn thêm thì thêm vào danh
sách `LESSONS` dưới đây, theo đúng thứ tự học.
"""

import argparse
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))

import course  # noqa: E402
import m1_l1  # noqa: E402
import m2_l1  # noqa: E402
import m3_l1  # noqa: E402
import m4_l1  # noqa: E402
import m5_l1  # noqa: E402

LESSONS = [m1_l1.LESSON, m2_l1.LESSON, m3_l1.LESSON, m4_l1.LESSON, m5_l1.LESSON]

MODULE = {
    "title": "Nhập môn NCKH",
    "description": (
        "Toàn bộ lộ trình làm một đề tài NCKH sinh viên lần đầu, từ đặt câu hỏi tới viết và trình "
        "bày, dùng một đề tài do người học tự chọn xuyên suốt cả 5 bài: (1) đặt câu hỏi nghiên cứu "
        "khả thi bằng khung FINER, (2) đọc tài liệu có hệ thống và tìm khoảng trống, (3) trích dẫn "
        "đúng và giữ liêm chính học thuật, (4) chọn thiết kế và thu thập dữ liệu, (5) viết báo cáo "
        "và trình bày trước hội đồng."
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
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-nhap-mon-nckh.json")
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
