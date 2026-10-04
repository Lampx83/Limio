# Bộ khối HTML dùng chung cho bài thực hành — sao đúng style của bai-thuc-hanh-1.html
# (SECTION_HUES / SECTION_TEXT_HUES của import-course.ts).

HUE = {
    "teal":   ("13,148,136", "rgb(12,141,129)"),
    "purple": ("139,92,246", "rgb(138,91,246)"),
    "amber":  ("217,150,40", "rgb(165,113,29)"),
    "blue":   ("59,130,246", "rgb(40,118,245)"),
    "pink":   ("219,90,140", "rgb(214,67,124)"),
    "green":  ("34,139,110", "rgb(28,120,94)"),
}
MUTED = "rgba(127,127,127,.95)"
RULE = "rgba(127,127,127,.32)"


def chips(*items):
    s = "".join(
        f'<span style="display:inline-block;padding:.2rem .6rem;border-radius:999px;border:1px solid {RULE};font-size:1rem;color:{MUTED}">{t}</span>'
        for t in items
    )
    return f'<div style="display:flex;flex-wrap:wrap;gap:.45rem;margin:0 0 1.2rem">{s}</div>'


def h1(text, hue="purple"):
    r, t = HUE[hue]
    return f'<h1 style="font-size:1.7rem;margin:0 0 .9rem;padding-bottom:.45rem;border-bottom:2px solid rgba({r},.38);color:{t}">{text}</h1>'


def h2(text, anchor, hue="pink"):
    r, t = HUE[hue]
    return f'<h2 id="muc-{anchor}" style="font-size:1.7rem;margin:2.4rem 0 .9rem;padding-bottom:.45rem;border-bottom:2px solid rgba({r},.38);color:{t}">{text}</h2>'


def h3(text, hue="pink"):
    r, t = HUE[hue]
    return f'<h3 style="font-size:1.42rem;margin:1.5rem 0 .4rem;padding-left:.75rem;border-left:3px solid rgba({r},.55);color:{t}">{text}</h3>'


def p(text, small=False, muted=False):
    size = "1rem" if small else "1.25rem"
    color = f";color:{MUTED}" if muted else ""
    return f'<p style="margin:.7rem 0;font-size:{size}{color}">{text}</p>'


def ul(items, ordered=False):
    tag = "ol" if ordered else "ul"
    li = "".join(f'<li style="margin:.3rem 0">{i}</li>' for i in items)
    return f'<{tag} style="margin:.7rem 0;padding-left:1.4rem;font-size:1.25rem;line-height:1.8">{li}</{tag}>'


def objectives(items):
    li = "".join(f'<li style="margin:.2rem 0">{i}</li>' for i in items)
    return (
        '<aside style="border-left:4px solid rgba(59,130,246,.55);background:rgba(59,130,246,.06);border-radius:0 .35rem .35rem 0;padding:.9rem 1.1rem;margin:1.1rem 0">'
        f'<div style="font-size:1rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:{MUTED};margin:0 0 .4rem">Mục tiêu bài học</div>'
        f'<ul style="margin:.3rem 0 0;padding-left:1.4rem;font-size:1.25rem;line-height:1.8">{li}</ul></aside>'
    )


def check(text, last=False):
    m = ".5rem 0 0" if last else ".5rem 0"
    return (
        f'<label style="display:flex;align-items:flex-start;gap:.7rem;cursor:pointer;margin:{m};font-size:1.25rem">'
        '<input type="checkbox" style="width:1.2rem;height:1.2rem;margin-top:.2rem;flex:0 0 auto">'
        f"<span>{text}</span></label>"
    )


def checklist(items):
    body = "".join(check(t, i == len(items) - 1) for i, t in enumerate(items))
    return f'<div style="border:1px solid {RULE};border-radius:.5rem;padding:1rem 1.2rem;margin:.7rem 0">{body}</div>'


def aside(hue, label, html, last=False):
    r, _ = HUE[hue]
    m = "1.1rem 0 0" if last else "1.1rem 0"
    return (
        f'<aside style="border-left:4px solid rgba({r},.6);background:rgba({r},.07);border-radius:0 .45rem .45rem 0;padding:.8rem 1rem;margin:{m}">'
        f'<div style="font-size:1rem;font-weight:700;letter-spacing:.04em;text-transform:uppercase;color:rgb({r});margin:0 0 .3rem">{label}</div>'
        f'<div style="font-size:1.25rem;line-height:1.8">{html}</div></aside>'
    )


def steps(hue, items):
    """items: [(nhãn, nội dung)] — các bước xếp ngang, tự xuống dòng ở màn hẹp."""
    r, t = HUE[hue]
    cells = "".join(
        f'<div style="flex:1;min-width:220px;border-left:3px solid rgba({r},.55);padding:.2rem 0 .2rem .8rem">'
        f'<div style="font-weight:700;color:{t}">{lab}</div>'
        f'<p style="margin:.4rem 0 0;font-size:1rem">{txt}</p></div>'
        for lab, txt in items
    )
    return f'<div style="display:flex;flex-wrap:wrap;gap:1rem;margin:.5rem 0 1rem">{cells}</div>'


def table(hue, headers, rows, big_cols=(), pad=".55rem .6rem"):
    """big_cols: chỉ số cột dùng cỡ 1.25rem; còn lại 1rem."""
    r, _ = HUE[hue]
    th = "".join(
        f'<th style="padding:.55rem .6rem;text-align:left;font-size:1rem;font-weight:600;background:rgba({r},.10);border-bottom:2px solid rgba({r},.35)">{h}</th>'
        for h in headers
    )
    trs = []
    for ri, row in enumerate(rows):
        border = f"border-bottom:1px solid {RULE};" if ri < len(rows) - 1 else ""
        tds = "".join(
            f'<td style="padding:{pad};{border}font-size:{"1.25rem" if ci in big_cols else "1rem"};line-height:1.7;vertical-align:top">{c}</td>'
            for ci, c in enumerate(row)
        )
        trs.append(f"<tr>{tds}</tr>")
    return (
        '<div style="overflow-x:auto"><table style="width:100%;border-collapse:collapse;margin:.7rem 0">'
        f'<thead><tr>{th}</tr></thead><tbody>{"".join(trs)}</tbody></table></div>'
    )


def part(hue, title, minutes, inner, open_=False):
    r, t = HUE[hue]
    o = " open" if open_ else ""
    return (
        f'<details{o} style="margin:1.5rem 0">'
        f'<summary style="display:flex;align-items:center;justify-content:space-between;gap:.75rem;list-style:none;cursor:pointer;background:rgba({r},.08);border-bottom:2px solid rgba({r},.38);border-radius:.5rem .5rem 0 0;padding:.7rem 1rem">'
        f'<span style="font-size:1.42rem;font-weight:700;color:{t}">▸ {title}</span>'
        f'<span style="display:inline-block;padding:.1rem .55rem;border-radius:999px;background:rgba({r},.14);color:{t};font-size:1rem;font-weight:600;white-space:nowrap">{minutes}</span>'
        "</summary>"
        f'<div style="border:1px solid {RULE};border-top:none;border-radius:0 0 .5rem .5rem;padding:1.1rem 1.2rem">{inner}</div>'
        "</details>"
    )


def reveal(hue, label, inner):
    """Khối nhỏ bấm mới mở — dùng cho ví dụ đã điền, mẹo."""
    _, t = HUE[hue]
    return (
        '<details style="margin:.7rem 0 1rem">'
        f'<summary style="cursor:pointer;list-style:none;font-size:1rem;font-weight:700;color:{t}">▸ {label}</summary>'
        f"{inner}</details>"
    )


def timeline(parts):
    """parts: [(hue, phút, nhãn)]"""
    total = sum(m for _, m, _ in parts)
    bars, labels = [], []
    for i, (hue, m, lab) in enumerate(parts):
        r, t = HUE[hue]
        w = f"{m / total * 100:.2f}%"
        bars.append(
            f'<div style="flex:0 0 {w};background:rgba({r},.16);color:{t};border-radius:.5rem;padding:.6rem .4rem;text-align:center;font-weight:700;font-size:1rem">{m}\'</div>'
        )
        pr = "padding-right:.4rem;" if i < len(parts) - 1 else ""
        labels.append(
            f'<div style="flex:0 0 {w};{pr}font-size:1rem;color:{MUTED}"><span style="display:inline-block;width:.6rem;height:.6rem;border-radius:.15rem;background:rgb({r});margin-right:.35rem"></span>{lab}</div>'
        )
    return (
        '<div style="overflow-x:auto">'
        f'<div style="display:flex;gap:.4rem;min-width:560px">{"".join(bars)}</div>'
        f'<div style="display:flex;min-width:560px;margin-top:.6rem">{"".join(labels)}</div>'
        "</div>"
    )


def summary_box(title, inner):
    return (
        '<aside style="border-left:4px solid rgba(34,139,110,.55);background:rgba(34,139,110,.06);border-radius:0 .35rem .35rem 0;padding:1rem 1.2rem;margin:1.5rem 0">'
        f'<div style="font-size:1rem;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:{MUTED};margin:0 0 .5rem">{title}</div>'
        f"{inner}</aside>"
    )


def sources(items):
    out = ['<h3 style="font-size:1.25rem;margin:1.5rem 0 .5rem">Nguồn tham khảo</h3>']
    out += [f'<p style="margin:.4rem 0;font-size:1rem">{s}</p>' for s in items]
    return "".join(out)


def page(*blocks):
    return (
        "<div style=\"font-size:1.25rem; line-height:1.8; font-family:Inter, ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;\">\n"
        + "\n\n".join(blocks)
        + "\n</div>\n"
    )
