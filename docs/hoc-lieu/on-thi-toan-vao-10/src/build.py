#!/usr/bin/env python3
"""Sinh khoa-on-thi-toan-vao-10.json và các bộ slide của khoá "Ôn thi Toán vào 10".

Khoá gồm: bài "Bắt đầu", module "Luyện theo dạng" (mỗi dạng một bài, xếp theo câu của đề) và module "Giải đề mẫu" theo từng năm
(mỗi đề một bài). Đề mô phỏng nằm ở mục Luyện thi của trang khoá, không qua tệp này. Chi tiết và cách thêm bài ở README.

    python3 build.py --chi-deck     # ghi bộ slide; sau đó chạy build-deck-lecture.ts cho từng bộ
    python3 build.py                # ghi tệp nhập khoá
"""
import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import dang_bieu_thuc_nguyen as d_nguyen  # noqa: E402
import de_hanoi_2026 as de_hn26  # noqa: E402
import deck_hanoi_2026 as deck_hn26  # noqa: E402

OUT = HERE.parent / "khoa-on-thi-toan-vao-10.json"
DECKS = HERE.parents[3] / "apps/web/src/content/decks"
LOI_GIANG = HERE / "loi-giang"
# Giọng NEU TTS đọc khoảng ngần này ký tự mỗi phút, giống build-deck-course.ts. Giọng chưa tạo lúc nhập khoá nên phải ước lượng.
CHARS_PER_MINUTE = 1165

# Xếp theo câu của đề.
CAC_DANG = [d_nguyen]
# Năm mới nhất đứng trước. Mỗi đề gồm mô-đun lời giải và mô-đun slide.
CAC_NAM = [("Năm 2026", [(de_hn26, deck_hn26)])]

COURSE = {
    "title": "Ôn thi Toán vào 10",
    "slug": "on-thi-toan-vao-10",
    "description": (
        "Khoá ôn thi Toán vào lớp 10 theo đề Hà Nội. Em luyện từng dạng hay gặp cùng giảng viên ảo trên slide tương tác, "
        "rồi giải các đề mẫu: tự làm trước, đối chiếu từng bước sau, và có lời giải chi tiết để đọc lại."
    ),
    "language": "vi",
    "level": "beginner",
    "category": "Ôn thi",
    "personalizationEnabled": True,
}

BAT_DAU = {
    "title": "Cấu trúc đề và cách ôn",
    "durationMin": 5,
    "description": "Đề Toán vào 10 của Hà Nội gồm những gì, chia thời gian ra sao, và nên dùng khoá này thế nào.",
    "look": {"palette": "limio", "font": "modern"},
    "body": (
        "Đề Toán vào lớp 10 của Hà Nội là đề tự luận, làm trong 120 phút, thang điểm 10. Bảng dưới đây mô tả đề năm 2026. Cột thời gian là gợi ý của Limio, phần còn lại 10 phút dành để soát bài.\n\n"
        "| Câu | Điểm | Nội dung | Thời gian gợi ý |\n"
        "|---|---|---|---|\n"
        "| I | 1,5 | Thống kê và xác suất | 10 phút |\n"
        "| II | 1,5 | Biểu thức chứa căn | 15 phút |\n"
        "| III | 2,5 | Bài toán thực tế và hệ thức Viète | 25 phút |\n"
        "| IV | 4,0 | Hình khối và hình học đường tròn | 50 phút |\n"
        "| V | 0,5 | Câu phân loại | 10 phút |\n\n"
        "> [!ghi-nho] Bảng này được tổng hợp từ đề đã thi, không phải văn bản của Sở Giáo dục và Đào tạo Hà Nội. Đề năm sau có thể thay đổi, nên em hãy theo dõi thông báo chính thức.\n\n"
        "## Cách dùng khoá này\n\n"
        "Em bắt đầu với mục **Luyện theo dạng**. Mỗi bài dạy một dạng hay gặp, có bài tự làm ngay trên slide và phần luyện tập để biết mình đã vững chưa. Dạng nào chưa vững thì em làm lại trước khi sang dạng khác.\n\n"
        "Sau đó em sang mục **Giải đề mẫu**. Với mỗi đề, em chuẩn bị giấy bút và tự làm từng câu trước khi đối chiếu với lời giải, vì đọc một lời giải đúng rất dễ tạo cảm giác mình đã biết làm."
    ),
}


def doc_loi_giang(deck_id):
    tep = LOI_GIANG / f"{deck_id}.json"
    if not tep.exists():
        sys.exit(f"Thiếu {tep.name}. Chạy build-deck-lecture.ts cho bộ slide {deck_id} trước (xem README).")
    return json.loads(tep.read_text(encoding="utf-8"))


def so_phut(lecture):
    return max(1, round(sum(len(s["text"]) for s in lecture) / CHARS_PER_MINUTE))


def ghi_deck():
    for mod in [*CAC_DANG, *(dk for _, ds in CAC_NAM for _, dk in ds)]:
        (DECKS / f"{mod.ID}.json").write_text(json.dumps(mod.tao_deck(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def main():
    ghi_deck()
    if "--chi-deck" in sys.argv:
        return
    hinh = json.loads((HERE / "hinh" / "urls.json").read_text(encoding="utf-8"))
    de_all = [de for _, ds in CAC_NAM for de, _ in ds]
    for de in de_all:
        de.kiem_so()
    misc, tpl = {}, {}
    for mod in [*de_all, *CAC_DANG]:
        misc.update({c: (n, d) for c, n, d in mod.LOI_TU_DUY})
        tpl.update({c: (b, p) for c, b, p in mod.PHAN_HOI})

    def bai_dang(mod):
        lecture = doc_loi_giang(mod.ID)
        # Thời lượng gồm cả lúc học sinh tự làm ở các slide chờ, không chỉ thời gian nghe.
        return mod.tao_bai(lecture, so_phut(lecture) + 15)

    manifest = {
        "course": COURSE,
        "misconceptions": [{"code": c, "name": n, "description": d} for c, (n, d) in misc.items()],
        "feedbackTemplates": [{"misconception": c, "body": b, "priority": p} for c, (b, p) in tpl.items()],
        "modules": [
            {"title": "Bắt đầu", "description": "Cấu trúc đề và cách dùng khoá.", "lessons": [BAT_DAU]},
            {
                "title": "Luyện theo dạng",
                "description": "Mỗi bài là một dạng hay gặp, xếp theo câu của đề.",
                "lessons": [bai_dang(m) for m in CAC_DANG],
            },
            *[
                {
                    "title": f"Giải đề mẫu: {nam.lower()}",
                    "description": f"Các đề Toán vào lớp 10 của {nam.lower()}, tự làm rồi đối chiếu từng bước.",
                    "lessons": [de.tao_bai(hinh, doc_loi_giang(dk.ID), dk.ID) for de, dk in ds],
                }
                for nam, ds in CAC_NAM
            ],
        ],
    }
    OUT.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    bai = [l for m in manifest["modules"] for l in m["lessons"]]
    print("ghi", OUT.name, "—", len(bai), "bài,", sum(len(l.get("quiz", {}).get("questions", [])) for l in bai), "câu luyện,",
          [len(l.get("lecture", [])) for l in bai], "đoạn giảng")


if __name__ == "__main__":
    main()
