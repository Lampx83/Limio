# -*- coding: utf-8 -*-
"""Ghép các bài thành manifest JSON cho `pnpm import:course`.

    python3 docs/hoc-lieu/tu-duy-phan-bien-ai/src/build.py

Cùng cách làm với khoá Kỹ năng mềm (xem `docs/hoc-lieu/ky-nang-mem/src/build.py`): soạn bằng Python vì thân
bài là văn xuôi dài, chuỗi r\"\"\"…\"\"\" giữ nguyên xuống dòng và dấu nháy. Khoá này còn dùng thêm `look`
(bảng màu), `sections` (bố cục thẻ / so sánh / các bước / hỏi đáp), `flashcards` (thẻ ghi nhớ) và câu hỏi
`drag_drop_fill` — các trường mà công cụ nhập hỗ trợ từ 24/10/2026.

Mỗi file bài `mX_lY.py` định nghĩa `LESSON`, và có thể định nghĩa thêm `MISCONCEPTIONS` / `FEEDBACK_TEMPLATES`
của riêng bài; build gộp chúng với danh sách chung trong `course.py`. Bài nào chưa có file thì bỏ qua, để soạn
dần từng bài vẫn build được.

`LESSON["lecture"]` (lời giảng theo mục) và `LESSON["podcast"]` (kịch bản hai người dẫn) đi cùng bài nhưng công
cụ nhập hiện bỏ qua; chúng dùng cho tính năng "Nghe giảng" / "Podcast" (xem README).
"""

import argparse
import importlib
import json
import sys
from pathlib import Path

SRC = Path(__file__).resolve().parent
sys.path.insert(0, str(SRC))

import course  # noqa: E402

MODULES = [
    {
        "title": "Module 1 · Đọc thông tin trong thời AI",
        "description": (
            "Module đầu tiên giúp bạn kiểm chứng một câu trả lời của AI trước khi dùng, tách một lập luận thành các "
            "phần để thấy chỗ yếu, và kiểm chứng một bức ảnh hay một tin lan truyền trong vài phút."
        ),
        "lessons": ["m1_l1", "m1_l2", "m1_l3"],
    },
    {
        "title": "Module 2 · Làm việc cùng AI",
        "description": (
            "Module thứ hai giúp bạn đặt câu hỏi cho AI để nhận về câu trả lời kiểm chứng được, nhận ra thiên kiến "
            "của AI và của chính mình, và dùng AI để học nhanh hơn mà vẫn giữ được phần tự suy nghĩ."
        ),
        "lessons": ["m2_l1", "m2_l2", "m2_l3"],
    },
]


def load_lessons():
    modules, misconceptions, templates = [], list(course.MISCONCEPTIONS), list(course.FEEDBACK_TEMPLATES)
    for m in MODULES:
        lessons = []
        for name in m["lessons"]:
            if not (SRC / f"{name}.py").exists():
                continue
            mod = importlib.import_module(name)
            lessons.append(mod.LESSON)
            misconceptions += getattr(mod, "MISCONCEPTIONS", [])
            templates += getattr(mod, "FEEDBACK_TEMPLATES", [])
        if lessons:
            modules.append({"title": m["title"], "description": m["description"], "lessons": lessons})
    codes = [x["code"] for x in misconceptions]
    dup = sorted({c for c in codes if codes.count(c) > 1})
    if dup:
        sys.exit(f"Mã lỗi tư duy bị trùng: {dup}")
    used = {
        o["misconception"]
        for m in modules
        for l in m["lessons"]
        for q in l.get("quiz", {}).get("questions", [])
        for o in q.get("options", [])
        if o.get("misconception")
    }
    missing = sorted(used - set(codes))
    if missing:
        sys.exit(f"Câu hỏi dùng mã lỗi tư duy chưa khai báo: {missing}")
    # Chỉ đưa vào DB những mã có câu hỏi dùng: bảng lỗi tư duy dùng chung cho mọi khoá, mã khai báo mà không ai
    # gắn chỉ là hàng thừa (và mẫu phản hồi của nó không bao giờ được gọi tới).
    unused = sorted(set(codes) - used)
    if unused:
        print(f"  bỏ {len(unused)} mã chưa câu hỏi nào dùng: {', '.join(unused)}")
    misconceptions = [x for x in misconceptions if x["code"] in used]
    templates = [t for t in templates if t["misconception"] in used]
    return modules, misconceptions, templates


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", type=Path, default=SRC.parent / "khoa-tu-duy-phan-bien-ai.json")
    args = ap.parse_args()

    modules, misconceptions, templates = load_lessons()
    manifest = {
        "course": course.COURSE,
        "misconceptions": misconceptions,
        "feedbackTemplates": templates,
        "modules": modules,
    }
    args.out.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")

    lessons = [l for m in modules for l in m["lessons"]]
    questions = sum(len(l.get("quiz", {}).get("questions", [])) for l in lessons)
    lectures = sum(1 for l in lessons if l.get("lecture"))
    podcasts = sum(1 for l in lessons if l.get("podcast"))
    print(f"→ {args.out}")
    print(
        f"  {len(modules)} module · {len(lessons)} bài · {questions} câu hỏi · {len(misconceptions)} lỗi tư duy · "
        f"{len(templates)} mẫu phản hồi · lời giảng {lectures}/{len(lessons)} · podcast {podcasts}/{len(lessons)}"
    )


if __name__ == "__main__":
    main()
