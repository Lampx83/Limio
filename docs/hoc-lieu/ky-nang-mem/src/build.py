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
import m2_l1, m2_l2, m2_l3  # noqa: E402
import m3_l1, m3_l2, m3_l3  # noqa: E402
import m4_l1, m4_l2, m4_l3, m4_l4  # noqa: E402
import m5_l1, m5_l2, m5_l3  # noqa: E402
import m6_l1, m6_l2, m6_l3  # noqa: E402
import m7_l1, m7_l2, m7_l3  # noqa: E402

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
    2: {
        "title": "Module 2 · Tư duy tích cực",
        "description": (
            "Không phải học cách luôn vui, mà học cách giải thích sự việc sao cho mình còn nhìn thấy "
            "phương án và còn thử tiếp. Ba bài đi từ phân biệt tư duy tích cực với tích cực độc hại, "
            "qua kỹ thuật bẻ lại lối nghĩ méo, tới việc duy trì dài hạn — và ranh giới nơi tư duy "
            "tích cực không còn đủ, cần tới hỗ trợ chuyên môn."
        ),
        "lessons": [m2_l1.LESSON, m2_l2.LESSON, m2_l3.LESSON],
    },
    3: {
        "title": "Module 3 · Tư duy phản biện",
        "description": (
            "Kiểm chất lượng một lập luận — kể cả lập luận của chính mình. Ba bài: tách khẳng định "
            "khỏi bằng chứng và suy luận; nhận ra thiên lệch của người đọc và nguỵ biện của người "
            "nói; đánh giá nguồn trong môi trường mà ai cũng xuất bản được và máy sinh được nội dung "
            "trong vài giây."
        ),
        "lessons": [m3_l1.LESSON, m3_l2.LESSON, m3_l3.LESSON],
    },
    4: {
        "title": "Module 4 · Quản lý thời gian",
        "description": (
            "Thời gian không quản lý được — 24 giờ là cố định; thứ quản lý được là lựa chọn. Ba bài "
            "đi từ mục tiêu SMART và bốn thế hệ quản trị thời gian, qua ma trận Eisenhower cùng bảy "
            "kẻ cắp thời gian, tới kỹ thuật giữ khối tập trung: khung giờ vàng, chống đa nhiệm, gỡ "
            "trì hoãn và nói không mà không hỏng quan hệ."
        ),
        "lessons": [m4_l1.LESSON, m4_l2.LESSON, m4_l3.LESSON, m4_l4.LESSON],
    },
    5: {
        "title": "Module 5 · Giao tiếp hiệu quả",
        "description": (
            "Thông điệp chỉ tồn tại ở dạng người kia hiểu. Ba bài: mô hình truyền thông hai chiều "
            "cùng bốn loại nhiễu và cách xác nhận ý hiểu; phi ngôn ngữ, khoảng cách giao tiếp và "
            "quy tắc 7–38–55 hay bị dùng sai; cuối cùng là chọn kênh và viết cho người đọc, kèm "
            "công thức cho bốn tình huống khó nhất."
        ),
        "lessons": [m5_l1.LESSON, m5_l2.LESSON, m5_l3.LESSON],
    },
    6: {
        "title": "Module 6 · Kỹ năng lắng nghe",
        "description": (
            "Nghe là chuyện của tai, lắng nghe là chuyện của sự chú ý có chủ đích. Ba bài: năm mức "
            "độ lắng nghe và bốn mức phản hồi; bốn nhóm rào cản cùng năm thói quen làm hỏng việc "
            "nghe; và bốn tình huống khó nhất — nghe cấp trên khi chưa hiểu, nghe người đang phàn "
            "nàn, nghe người đang buồn, nghe người mình không đồng ý."
        ),
        "lessons": [m6_l1.LESSON, m6_l2.LESSON, m6_l3.LESSON],
    },
    7: {
        "title": "Module 7 · Thuyết trình hiệu quả",
        "description": (
            "Bài thuyết trình hỏng phần lớn từ lúc soạn, không phải lúc nói. Ba bài đi theo đúng "
            "trình tự làm việc: chọn một thông điệp và dựng cấu trúc cho đúng khán giả; thiết kế "
            "slide làm chỗ dựa thị giác thay vì tài liệu để đọc; rồi tập, đứng nói và xử lý bốn sự "
            "cố thường gặp."
        ),
        "lessons": [m7_l1.LESSON, m7_l2.LESSON, m7_l3.LESSON],
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
