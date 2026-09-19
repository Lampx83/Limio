# -*- coding: utf-8 -*-
"""Gộp các file bài học thành manifest JSON cho `pnpm import:course`."""
import json, os, sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import course, m1_l1, m1_l2, m1_l3, m1_l4, m1_l5, m1_l6, m1_l7
import m2_l1, m2_l2, m2_l3, m2_l4, m2_l5, m2_l6
import m3_l1, m3_l2, m3_l3, m3_l4, m3_l5, m3_l6
import m4_l1, m4_l2, m4_l3, m4_l4, m4_l5, m4_l6
import m5_l1, m5_l2, m5_l3, m5_l4, m5_l5, m5_l6

MODULES = [
    {
        "title": "Module 1 · Nền tảng thẩm định công nghệ giáo dục",
        "description": (
            "Trước khi dựng bất cứ thứ gì: lịch sử các làn sóng và bài học lặp lại, lý thuyết học tập "
            "làm nền, ba khung thẩm định của ngành, cách đọc bằng chứng hiệu quả, và khung pháp lý — "
            "hạ tầng Việt Nam mà mọi sản phẩm phải sống trong đó. Module khép lại bằng hồ sơ thẩm "
            "định và bản thử nghiệm kỹ thuật đầu tiên cho đồ án sách AR của học phần."
        ),
        "lessons": [m.LESSON for m in (m1_l1, m1_l2, m1_l3, m1_l4, m1_l5, m1_l6, m1_l7)],
    },
    {
        "title": "Module 2 · AI tạo sinh trong dạy và học",
        "description": (
            "Từ cơ chế bên trong mô hình ngôn ngữ tới việc đưa nó vào lớp học có kiểm soát: thiết kế và "
            "kiểm thử lời nhắc, trợ giảng và hệ dạy học thông minh, sinh học liệu và chấm bài có kiểm "
            "định, cùng khung liêm chính — thiên lệch — chính sách. Module khép lại bằng mốc 2 của đồ "
            "án: bản thảo nội dung sách AR có AI hỗ trợ, kèm nhật ký và biên bản kiểm chứng."
        ),
        "lessons": [m.LESSON for m in (m2_l1, m2_l2, m2_l3, m2_l4, m2_l5, m2_l6)],
    },
    {
        "title": "Module 3 · Học thích ứng và mô hình người học",
        "description": (
            "Bên trong cơ chế cá nhân hoá: phân rã nội dung thành thành phần tri thức, theo vết tri thức "
            "bằng BKT và các họ mô hình khác, lập lịch ôn giãn cách, và chính sách chọn nhiệm vụ kế tiếp "
            "— kèm những rủi ro đạo đức khi mỗi người học đi một đường riêng. Module khép lại bằng mốc 3 "
            "của đồ án: phần luyện tập thích ứng cho sách AR."
        ),
        "lessons": [m.LESSON for m in (m3_l1, m3_l2, m3_l3, m3_l4, m3_l5, m3_l6)],
    },
    {
        "title": "Module 4 · Phân tích học tập và dữ liệu người học",
        "description": (
            "Từ dữ liệu tới quyết định: vòng khép kín của phân tích học tập, thiết kế nhật ký sự kiện "
            "theo chuẩn, chọn chỉ số không bị lách, bảng điều khiển và cảnh báo sớm đọc đúng bằng tỉ lệ "
            "nền, cùng công bằng thuật toán và quản trị dữ liệu. Module khép lại bằng mốc 4 của đồ án: "
            "kế hoạch đo lường viết trước khi thu dữ liệu."
        ),
        "lessons": [m.LESSON for m in (m4_l1, m4_l2, m4_l3, m4_l4, m4_l5, m4_l6)],
    },
    {
        "title": "Module 5 · Công nghệ nhập vai, triển khai và bảo vệ đồ án",
        "description": (
            "Module khép lại học phần: phổ thực tại ảo cùng bằng chứng hiện có, nguyên tắc thiết kế học "
            "liệu nhập vai, xưởng kỹ thuật dựng và tối ưu bản AR, thử nghiệm với người học thật, đưa sản "
            "phẩm từ thí điểm vào vận hành, và buổi bảo vệ. Mốc 5 và mốc 6 của đồ án nằm ở đây."
        ),
        "lessons": [m.LESSON for m in (m5_l1, m5_l2, m5_l3, m5_l4, m5_l5, m5_l6)],
    },
]

import argparse

_ap = argparse.ArgumentParser(description="Sinh manifest học liệu cho khoá Các công nghệ giáo dục tiên tiến.")
_ap.add_argument("--module", type=int, help="chỉ xuất một module (1-5), để nhập nối bằng --into")
_ap.add_argument("--out", help="đường dẫn tệp đầu ra; mặc định suy từ --module")
_args = _ap.parse_args()

if _args.module:
    if not 1 <= _args.module <= len(MODULES):
        _ap.error(f"--module phải nằm trong 1..{len(MODULES)}")
    MODULES = [MODULES[_args.module - 1]]

manifest = {
    "course": course.COURSE,
    "misconceptions": course.MISCONCEPTIONS,
    "feedbackTemplates": course.FEEDBACK_TEMPLATES,
    "modules": MODULES,
}

_default = f"module-{_args.module}.json" if _args.module else "khoa-cngd-tien-tien.json"
out = _args.out or os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", _default)
with open(out, "w", encoding="utf-8") as f:
    json.dump(manifest, f, ensure_ascii=False, indent=1)

n_q = sum(len(l.get("quiz", {}).get("questions", [])) for m in MODULES for l in m["lessons"])
print(f"{len(MODULES)} module · {sum(len(m['lessons']) for m in MODULES)} bài · {n_q} câu hỏi → {os.path.realpath(out)}")
