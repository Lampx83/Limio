# -*- coding: utf-8 -*-
"""Ghép các mảnh học liệu thành một manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/ky-nang-mem/src/build.py                 # cả khoá đang có
    python3 docs/hoc-lieu/ky-nang-mem/src/build.py --module 1      # chỉ một module

Soạn bằng Python chứ không viết thẳng JSON vì thân bài là văn xuôi dài: chuỗi
`r\"\"\"…\"\"\"` giữ nguyên xuống dòng và dấu nháy, còn JSON thì bắt escape từng ký
tự — sửa một câu trong bài phải đếm dấu gạch chéo.

Module nào soạn xong thì thêm vào MODULES. Module đầu tiên nhập bằng lệnh
thường (tạo khoá mới); các module sau nhập kèm `--into <courseId>` để nối vào
khoá đã có thay vì dựng lại từ đầu.
"""

import argparse
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))

import course  # noqa: E402
import m1_l1, m1_l2, m1_l3  # noqa: E402

MODULES = {
    1: {
        "title": "Module 1 · Giá trị sống",
        "description": (
            "Nền móng của cả khoá: bạn coi trọng điều gì, dựa vào đâu để thấy vững, và giữ được "
            "điều đó tới đâu khi phải trả giá. Ba bài đi từ phân biệt giá trị với mục tiêu, qua "
            "trọng tâm cuộc sống và vòng tròn ảnh hưởng, tới bản tuyên ngôn sứ mệnh cá nhân dùng "
            "được để từ chối."
        ),
        "lessons": [m1_l1.LESSON, m1_l2.LESSON, m1_l3.LESSON],
    },
}

# Lộ trình cả khoá — chín kỹ năng khớp Kho KNM, cộng Tư duy phản biện.
ROADMAP = [
    (1, "Giá trị sống"),
    (2, "Tư duy tích cực"),
    (3, "Tư duy phản biện"),
    (4, "Quản lý thời gian"),
    (5, "Giao tiếp hiệu quả"),
    (6, "Kỹ năng lắng nghe"),
    (7, "Thuyết trình hiệu quả"),
    (8, "Nghệ thuật thuyết phục"),
    (9, "Kỹ năng cá nhân trong làm việc nhóm"),
    (10, "Viết CV và phỏng vấn xin việc"),
]


def build(module_numbers):
    picked = [MODULES[n] for n in module_numbers]
    return {
        "course": course.COURSE,
        "misconceptions": course.MISCONCEPTIONS,
        "feedbackTemplates": course.FEEDBACK_TEMPLATES,
        "modules": picked,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--module", type=int, action="append", help="số thứ tự module, lặp được")
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-ky-nang-mem.json")
    args = ap.parse_args()

    numbers = sorted(args.module or MODULES.keys())
    missing = [n for n in numbers if n not in MODULES]
    if missing:
        done = ", ".join(str(n) for n in sorted(MODULES))
        sys.exit(f"Module chưa soạn: {missing}. Hiện có: {done}")

    manifest = build(numbers)
    args.out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    lessons = sum(len(m["lessons"]) for m in manifest["modules"])
    questions = sum(
        len(l.get("quiz", {}).get("questions", [])) for m in manifest["modules"] for l in m["lessons"]
    )
    print(f"→ {args.out}")
    print(
        f"  {len(manifest['modules'])} module · {lessons} bài · {questions} câu hỏi · "
        f"{len(manifest['misconceptions'])} lỗi tư duy · {len(manifest['feedbackTemplates'])} mẫu phản hồi"
    )
    todo = [f"{n}. {t}" for n, t in ROADMAP if n not in MODULES]
    if todo:
        print("  còn lại: " + " · ".join(todo))


if __name__ == "__main__":
    main()
