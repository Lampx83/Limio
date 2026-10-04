from kit import *


def _assignment_card(n, hue, title, where, milestones, what, current):
    r, t = HUE[hue]
    border = f"2px solid rgba({r},.6)" if current else f"1px solid {RULE}"
    tag = (f'<span style="display:inline-block;margin-left:.5rem;padding:.05rem .5rem;border-radius:999px;background:rgba({r},.14);color:{t};font-size:.9rem;font-weight:600">Bạn đang đọc</span>'
           if current else "")
    return (
        f'<div style="flex:1 1 260px;border:{border};border-radius:.5rem;padding:.9rem 1rem">'
        f'<div style="font-size:1rem;font-weight:700;color:{t}">Bài tập nhóm {n}{tag}</div>'
        f'<div style="font-size:1.25rem;font-weight:700;margin:.2rem 0 .3rem">{title}</div>'
        f'<div style="font-size:1rem;color:{MUTED}">{where} · {milestones}</div>'
        f'<div style="font-size:1rem;margin-top:.4rem">{what}</div>'
        "</div>"
    )


def two_assignments(current):
    return (
        '<div style="margin:1.1rem 0">'
        f'<div style="font-size:1rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:{MUTED};margin:0 0 .5rem">Học phần có hai bài tập nhóm</div>'
        '<div style="display:flex;flex-wrap:wrap;gap:1rem">'
        + _assignment_card(1, "pink", "Giữa kỳ — Laws of UX trên Limio", "Bài 2.4", "Thuyết trình",
                           "Tìm hiểu 3 quy luật → soi một trang Limio → hỏi 5 bạn → <strong>vẽ lại bằng giấy</strong> → thuyết trình 10 phút.", current == 1)
        + _assignment_card(2, "blue", "Cuối kỳ — Đưa thiết kế vào Limio", "Bài 4.4", "Mốc 1–3",
                           "Đưa bản giấy giữa kỳ <strong>lên Figma</strong> thành giao diện hoàn chỉnh, bám hệ thống của Limio, kiểm thử với 5 người, bàn giao cho lập trình.", current == 2)
        + "</div>"
        f'<p style="margin:.6rem 0 0;font-size:1rem;color:{MUTED}">Cùng nhóm, cùng trang Limio. Bản giấy giữa kỳ là điểm xuất phát của bài cuối kỳ; Thực hành 2 (Bài 2.5) dựng sẵn file Figma của nhóm cho bài cuối kỳ.</p>'
        "</div>"
    )


def peer_table():
    return table("purple", ["Thành viên", "Đóng góp (1–5)", "Đúng hẹn (1–5)", "Chất lượng (1–5)", "Một việc cụ thể bạn ấy đã làm"],
                 [[f"Thành viên {i}", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"] for i in range(1, 6)], pad=".8rem .6rem")
