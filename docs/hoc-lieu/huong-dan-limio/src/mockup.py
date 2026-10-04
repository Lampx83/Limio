# -*- coding: utf-8 -*-
"""Bộ hàm vẽ mockup giao diện Limio bằng HTML nội tuyến.

Vì sao tự vẽ thay vì chụp màn hình: ảnh chụp lỗi thời mỗi lần giao diện đổi, còn
mockup sửa một chỗ ở đây là mọi bài cùng cập nhật. Mockup cũng cho phép đánh số
các điểm cần bấm, thứ mà ảnh chụp không làm sạch được.

Quy tắc kỹ thuật (importer nhúng nguyên khối ```html vào bài):
- KHÔNG có dòng trống bên trong khối — trình phân tích Markdown cắt khối ở dòng trống.
- Màu nền/viền dùng rgba trong suốt, chữ kế thừa màu của trang, để chạy được trên cả
  nền sáng lẫn nền tối. Chỉ nút chính và vài điểm nhấn dùng màu đặc.
- Cỡ chữ trong mockup không nhỏ hơn 0.95rem để đọc được trên điện thoại.
- Mọi khối có thể cuộn ngang (overflow-x:auto) thay vì làm vỡ trang hẹp.
"""

import re

TEAL = "13,148,136"
BLUE = "59,130,246"
VIOLET = "139,92,246"
AMBER = "217,150,40"
ROSE = "225,29,72"
GREEN = "34,139,110"
GRAY = "127,127,127"

RULE = f"1px solid rgba({GRAY},.28)"
SOFT = f"rgba({GRAY},.07)"


def md(t: str) -> str:
    """Đổi **đậm** thành <strong> — khối HTML thô không đi qua bộ phân tích Markdown."""
    return re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", t)


def fence(html: str) -> str:
    """Bọc HTML thành khối ```html của bài. Xoá dòng trống để khối không bị cắt."""
    lines = [ln for ln in html.split("\n") if ln.strip()]
    return "```html\n" + "\n".join(lines) + "\n```"


# ── Khối bố cục ────────────────────────────────────────────────────────────────

def hero(kicker: str, title: str, sub: str, chips=(), hue=TEAL) -> str:
    """Biểu ngữ đầu bài: nền chuyển màu, tiêu đề lớn, vài nhãn thông tin."""
    chip_html = "".join(
        f'<span style="display:inline-block;padding:.22rem .7rem;margin:.25rem .4rem 0 0;border-radius:999px;'
        f'background:rgba({hue},.16);border:1px solid rgba({hue},.4);font-size:.95rem;font-weight:600">{c}</span>'
        for c in chips
    )
    return fence(
        f'<div style="margin:1.2rem 0;padding:1.7rem 1.6rem;border-radius:1rem;'
        f'background:linear-gradient(135deg,rgba({hue},.22),rgba({VIOLET},.14) 70%,rgba({BLUE},.10));'
        f'border:1px solid rgba({hue},.35)">'
        f'<div style="font-size:.95rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:rgb({hue})">{kicker}</div>'
        f'<div style="font-size:1.9rem;font-weight:800;line-height:1.25;margin:.35rem 0 .5rem">{title}</div>'
        f'<div style="font-size:1.2rem;line-height:1.7;opacity:.88;max-width:42rem">{md(sub)}</div>'
        f'<div>{chip_html}</div></div>'
    )


def window(title: str, body: str, url: str = "", caption: str = "", pad: str = "1rem 1.1rem") -> str:
    """Khung cửa sổ trình duyệt bao quanh một mockup. `body` là HTML đã dựng."""
    bar = (
        f'<div style="display:flex;align-items:center;gap:.4rem;padding:.55rem .8rem;'
        f'border-bottom:{RULE};background:rgba({GRAY},.10)">'
        f'<span style="width:.7rem;height:.7rem;border-radius:50%;background:rgb(237,106,94)"></span>'
        f'<span style="width:.7rem;height:.7rem;border-radius:50%;background:rgb(245,191,79)"></span>'
        f'<span style="width:.7rem;height:.7rem;border-radius:50%;background:rgb(97,197,84)"></span>'
        f'<span style="margin-left:.6rem;flex:1;padding:.18rem .7rem;border-radius:.4rem;background:rgba({GRAY},.12);'
        f'font-size:.95rem;opacity:.8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">{url or title}</span></div>'
    )
    cap = (
        f'<div style="font-size:1rem;opacity:.75;margin:.55rem 0 0;line-height:1.6">{caption}</div>' if caption else ""
    )
    return (
        f'<div style="margin:1.3rem 0">'
        f'<div style="border:{RULE};border-radius:.8rem;overflow:hidden;box-shadow:0 6px 24px rgba(0,0,0,.10)">{bar}'
        f'<div style="padding:{pad};overflow-x:auto">{body}</div></div>{cap}</div>'
    )


def mark(n: int, hue=ROSE) -> str:
    """Số đánh dấu tròn gắn vào một điểm trên mockup; khớp với `legend`."""
    return (
        f'<span style="display:inline-flex;align-items:center;justify-content:center;width:1.45rem;height:1.45rem;'
        f'border-radius:50%;background:rgb({hue});color:#fff;font-size:.9rem;font-weight:800;'
        f'margin:0 .35rem;flex:none;vertical-align:middle">{n}</span>'
    )


def legend(items, hue=ROSE) -> str:
    """Chú giải đánh số đặt dưới mockup: mỗi dòng giải thích một điểm."""
    rows = "".join(
        f'<div style="display:flex;gap:.6rem;align-items:flex-start;margin:.45rem 0">'
        f'{mark(i + 1, hue)}<div style="font-size:1.1rem;line-height:1.65">{md(t)}</div></div>'
        for i, t in enumerate(items)
    )
    return fence(f'<div style="margin:.4rem 0 1.2rem">{rows}</div>')


# ── Thành phần giao diện ──────────────────────────────────────────────────────

def btn(label: str, kind: str = "primary", n: int = 0) -> str:
    """Nút bấm. kind: primary (xanh đặc) | soft (viền) | danger. `n` > 0 thì gắn số."""
    if kind == "primary":
        st = f"background:rgb({TEAL});color:#fff;border:1px solid rgb({TEAL})"
    elif kind == "danger":
        st = f"background:rgba({ROSE},.12);color:rgb({ROSE});border:1px solid rgba({ROSE},.4)"
    else:
        st = f"background:rgba({GRAY},.06);border:{RULE}"
    num = mark(n) if n else ""
    return (
        f'<span style="display:inline-flex;align-items:center;gap:.2rem;white-space:nowrap">'
        f'<span style="display:inline-block;padding:.42rem .95rem;border-radius:.5rem;font-size:1rem;font-weight:600;{st}">{label}</span>{num}</span>'
    )


def chip(label: str, hue=GRAY, solid: bool = False) -> str:
    """Nhãn trạng thái nhỏ (Nháp, Đã xuất bản…)."""
    st = (
        f"background:rgb({hue});color:#fff" if solid else f"background:rgba({hue},.14);color:rgb({hue});border:1px solid rgba({hue},.4)"
    )
    if hue == GRAY:
        st = f"background:rgba({GRAY},.12);border:{RULE}"
    return (
        f'<span style="display:inline-block;padding:.15rem .6rem;border-radius:999px;font-size:.95rem;font-weight:600;{st}">{label}</span>'
    )


def field(label: str, value: str = "", hint: str = "", n: int = 0, w: str = "100%", area: bool = False) -> str:
    """Ô nhập có nhãn. `value` rỗng thì hiện gợi ý mờ."""
    shown = (
        f'<span style="opacity:.45">{hint}</span>' if not value else value
    )
    h = "4.2rem" if area else "auto"
    num = mark(n) if n else ""
    return (
        f'<div style="margin:.55rem 0;width:{w};max-width:100%">'
        f'<div style="font-size:1rem;font-weight:600;margin:0 0 .25rem;display:flex;align-items:center">{label}{num}</div>'
        f'<div style="min-height:{h};padding:.5rem .75rem;border-radius:.5rem;border:{RULE};background:rgba({GRAY},.05);'
        f'font-size:1.05rem">{shown}</div></div>'
    )


def check(label: str, on: bool = False, n: int = 0, note: str = "") -> str:
    """Ô chọn dạng hộp, có thể kèm dòng giải thích nhỏ."""
    box = (
        f'<span style="display:inline-flex;align-items:center;justify-content:center;width:1.15rem;height:1.15rem;'
        f'border-radius:.28rem;border:2px solid rgb({TEAL});background:{"rgb(" + TEAL + ")" if on else "transparent"};'
        f'color:#fff;font-size:.8rem;font-weight:800;flex:none;margin-top:.15rem">{"✓" if on else ""}</span>'
    )
    nt = f'<div style="font-size:.95rem;opacity:.7;margin-top:.1rem;line-height:1.5">{note}</div>' if note else ""
    return (
        f'<div style="display:flex;gap:.6rem;align-items:flex-start;margin:.55rem 0">{box}'
        f'<div style="font-size:1.05rem;line-height:1.5">{label}{mark(n) if n else ""}{nt}</div></div>'
    )


def radio(label: str, on: bool = False, note: str = "") -> str:
    """Ô chọn dạng tròn (chọn một trong nhiều)."""
    dot = (
        f'<span style="display:inline-block;width:1.15rem;height:1.15rem;border-radius:50%;border:2px solid rgb({TEAL});'
        f'background:{"radial-gradient(rgb(" + TEAL + ") 45%,transparent 50%)" if on else "transparent"};flex:none;margin-top:.15rem"></span>'
    )
    nt = f'<div style="font-size:.95rem;opacity:.7;margin-top:.1rem">{note}</div>' if note else ""
    return (
        f'<div style="display:flex;gap:.6rem;align-items:flex-start;margin:.5rem 0">{dot}'
        f'<div style="font-size:1.05rem;line-height:1.5">{label}{nt}</div></div>'
    )


def tabs(names, active: int = 0, n: int = 0) -> str:
    """Hàng tab ngang; tab `active` được gạch chân. `n` gắn số vào tab đang hoạt động."""
    out = ""
    for i, t in enumerate(names):
        on = i == active
        st = (
            f"border-bottom:3px solid rgb({TEAL});font-weight:700"
            if on
            else "border-bottom:3px solid transparent;opacity:.7"
        )
        num = mark(n) if (n and on) else ""
        out += f'<span style="padding:.5rem .85rem;font-size:1.05rem;white-space:nowrap;{st}">{t}{num}</span>'
    return f'<div style="display:flex;overflow-x:auto;border-bottom:{RULE};margin:0 0 .8rem">{out}</div>'


def card(title: str, body: str = "", hue=None, n: int = 0, w: str = "auto") -> str:
    """Thẻ nội dung có viền (dùng cho thẻ chọn kiểu, thẻ số liệu…)."""
    edge = f"border-left:4px solid rgb({hue});" if hue else ""
    num = mark(n) if n else ""
    return (
        f'<div style="flex:1 1 {w};min-width:11rem;padding:.85rem 1rem;border:{RULE};{edge}border-radius:.6rem;background:{SOFT}">'
        f'<div style="font-size:1.1rem;font-weight:700;display:flex;align-items:center">{title}{num}</div>'
        f'<div style="font-size:1rem;line-height:1.6;opacity:.85;margin-top:.25rem">{md(body)}</div></div>'
    )


def row_cards(*cards: str) -> str:
    """Xếp thẻ thành hàng, tự xuống dòng khi hẹp."""
    return f'<div style="display:flex;flex-wrap:wrap;gap:.7rem;margin:.6rem 0">{"".join(cards)}</div>'


def menu(items, active: int = -1, title: str = "") -> str:
    """Danh sách mục dọc kiểu thanh bên. `items` là các chuỗi; một mục có thể là (chuỗi, số)."""
    out = f'<div style="font-size:.9rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;opacity:.55;margin:0 0 .4rem">{title}</div>' if title else ""
    for i, it in enumerate(items):
        label, n = (it if isinstance(it, tuple) else (it, 0))
        on = i == active
        st = f"background:rgba({TEAL},.16);font-weight:700;color:rgb({TEAL})" if on else ""
        out += (
            f'<div style="display:flex;align-items:center;padding:.5rem .7rem;border-radius:.5rem;font-size:1.05rem;{st}">{label}{mark(n) if n else ""}</div>'
        )
    return f'<div style="min-width:12rem">{out}</div>'


def two_col(left: str, right: str, ratio: str = "14rem") -> str:
    """Hai cột (thanh bên + nội dung). `ratio` là bề rộng cột trái; màn hẹp thì cột phải
    tự xuống dưới cột trái thay vì làm tràn khung."""
    return (
        f'<div style="display:flex;flex-wrap:wrap;gap:1rem;align-items:flex-start">'
        f'<div style="flex:0 0 {ratio};max-width:100%">{left}</div>'
        f'<div style="flex:1 1 14rem;min-width:0">{right}</div></div>'
    )


def flow(steps, hue=TEAL) -> str:
    """Quy trình nằm ngang: các bước nối bằng mũi tên, xuống dòng khi hẹp."""
    parts = []
    for i, s in enumerate(steps):
        title, sub = (s if isinstance(s, tuple) else (s, ""))
        sub_html = f'<div style="font-size:.95rem;opacity:.75;margin-top:.15rem;line-height:1.45">{sub}</div>' if sub else ""
        parts.append(
            f'<div style="flex:1 1 9rem;min-width:9rem;padding:.8rem .9rem;border-radius:.7rem;'
            f'background:rgba({hue},.10);border:1px solid rgba({hue},.35)">'
            f'<div style="width:1.7rem;height:1.7rem;border-radius:50%;background:rgb({hue});color:#fff;font-weight:800;'
            f'display:flex;align-items:center;justify-content:center;font-size:1rem;margin-bottom:.4rem">{i + 1}</div>'
            f'<div style="font-size:1.1rem;font-weight:700;line-height:1.4">{title}</div>{sub_html}</div>'
        )
        if i < len(steps) - 1:
            parts.append('<div style="align-self:center;font-size:1.4rem;opacity:.45;flex:none">→</div>')
    return fence(f'<div style="display:flex;flex-wrap:wrap;gap:.5rem;align-items:stretch;margin:1.2rem 0">{"".join(parts)}</div>')


def try_now(title: str, steps, minutes: int = 2) -> str:
    """Hộp "Thử ngay" cuối bài: việc nhỏ làm được trong vài phút ở khoá của thầy/cô."""
    lis = "".join(
        f'<li style="margin:.45rem 0;padding-left:.2rem">{md(s)}</li>' for s in steps
    )
    return fence(
        f'<div style="margin:1.4rem 0;padding:1.2rem 1.3rem;border-radius:.9rem;border:2px dashed rgba({TEAL},.55);background:rgba({TEAL},.07)">'
        f'<div style="display:flex;align-items:center;gap:.6rem;flex-wrap:wrap">'
        f'<span style="font-size:1.4rem">▶</span>'
        f'<span style="font-size:1.35rem;font-weight:800">Thử ngay</span>'
        f'<span style="padding:.15rem .65rem;border-radius:999px;background:rgb({TEAL});color:#fff;font-size:.95rem;font-weight:700">khoảng {minutes} phút</span></div>'
        f'<div style="font-size:1.2rem;font-weight:600;margin:.55rem 0 .2rem">{title}</div>'
        f'<ol style="margin:.3rem 0 0;padding-left:1.4rem;font-size:1.15rem;line-height:1.7">{lis}</ol></div>'
    )


# ── Ảnh chụp màn hình thật (user chốt 2026-10-03: KHÔNG dựng mockup giao diện) ──────────
#
# Các hàm vẽ giao diện ở trên (window, menu, field, tabs…) KHÔNG dùng nữa cho hình giao diện;
# chỉ còn dùng cho khối trình bày không phải giao diện (hero, flow, card, try_now, legend).
# Hình giao diện là ảnh chụp thật, đặt ở apps/web/public/huong-dan-limio/<tên>.png và được
# chụp riêng theo danh sách SHOTS bên dưới (build.py ghi ra shots.json).

SHOTS: list[dict] = []


def shot(name: str, caption: str, need: str, marks=()) -> str:
    """Đặt một ảnh chụp thật vào bài. Trả về dòng Markdown ảnh (phải đứng một dòng riêng).

    name    tên tệp không đuôi, dạng "<chương>-<bài>-<ý>", ví dụ "1-2-bieu-mau-tao-khoa"
    caption chú thích hiện dưới ảnh, viết thuần Việt
    need    MÔ TẢ cho người chụp: trang nào (đường dẫn), trạng thái nào (đã điền gì, đang mở tab
            nào, cần có dữ liệu mẫu gì). Đủ cụ thể để chụp mà không phải hỏi lại.
    marks   danh sách chữ cho các điểm đánh số trên ảnh (số 1, 2, 3… theo thứ tự); người chụp
            sẽ vẽ vòng số lên đúng chỗ. Nên khớp với `legend([...])` đặt ngay dưới ảnh.
    """
    SHOTS.append({"name": name, "caption": caption, "need": need, "marks": list(marks)})
    # Dấu `"` trong chú thích làm hỏng cú pháp ![alt](url "chú thích") của importer; đổi sang “ ”.
    safe = re.sub(r'"([^"]*)"', "\u201c\\1\u201d", caption).replace('"', "\u201d").replace("]", ")").replace("[", "(")
    return f'![{safe}](/huong-dan-limio/{name}.png "{safe}")'
