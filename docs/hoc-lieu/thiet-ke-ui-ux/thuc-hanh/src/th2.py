from kit import *

# ---------------------------------------------------------------- sơ đồ giao diện Figma (UI3)
def badge(n, hue):
    r, t = HUE[hue]
    return f'<span style="display:inline-flex;align-items:center;justify-content:center;min-width:1.6rem;height:1.6rem;border-radius:.4rem;background:rgba({r},.18);color:{t};font-weight:700;font-size:.95rem">{n}</span>'

def ui_row(text):
    return f'<div style="font-size:.85rem;line-height:1.5;padding:.1rem .3rem;color:{MUTED}">{text}</div>'

figma_ui = (
    '<div style="overflow-x:auto;margin:.9rem 0">'
    f'<div style="min-width:620px;border:1px solid {RULE};border-radius:.6rem;overflow:hidden;display:flex;height:300px;font-size:.9rem">'
    # cột trái
    f'<div style="flex:0 0 24%;border-right:1px solid {RULE};padding:.5rem;background:rgba(13,148,136,.06)">'
    f'<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.4rem">{badge(1,"teal")}<strong style="font-size:.95rem">Trang &amp; lớp</strong></div>'
    + ui_row("<em>Pages</em>") + ui_row("00 Bìa") + ui_row("01 Nghiên cứu") + ui_row("<em>Layers</em>")
    + ui_row("▾ # Thẻ bài tập") + ui_row("&nbsp;&nbsp;&nbsp;T Tên bài tập") + ui_row("&nbsp;&nbsp;&nbsp;# Nhãn trạng thái") +
    '</div>'
    # khung vẽ
    '<div style="flex:1;position:relative;background:rgba(139,92,246,.05);padding:.5rem">'
    f'<div style="display:flex;align-items:center;gap:.4rem">{badge(2,"purple")}<strong style="font-size:.95rem">Khung vẽ (canvas)</strong></div>'
    f'<div style="position:absolute;left:12%;top:38%;width:76%;height:22%;border:1.5px solid rgba(139,92,246,.6);border-radius:.3rem;background:rgba(255,255,255,.6)"><div style="position:absolute;top:-1.3rem;left:0;font-size:.8rem;color:{MUTED}">Thẻ bài tập</div></div>'
    # thanh công cụ nổi
    f'<div style="position:absolute;left:50%;bottom:.6rem;transform:translateX(-50%);display:flex;align-items:center;gap:.35rem;border:1px solid {RULE};border-radius:.6rem;padding:.25rem .5rem;background:rgba(217,150,40,.12);white-space:nowrap">'
    f'{badge(3,"amber")}<span style="font-size:.85rem">↖ Chọn · # Frame · ▭ Hình · ✎ Bút · T Chữ · 💬 Bình luận</span></div>'
    '</div>'
    # cột phải
    f'<div style="flex:0 0 26%;border-left:1px solid {RULE};padding:.5rem;background:rgba(59,130,246,.06)">'
    f'<div style="display:flex;align-items:center;gap:.4rem;margin-bottom:.4rem">{badge(4,"blue")}<strong style="font-size:.95rem">Thuộc tính</strong></div>'
    + ui_row("<em>Design</em> · Prototype") + ui_row("W 343 &nbsp; H 92") + ui_row("Bo góc 12") + ui_row("Fill #FFFFFF") + ui_row("Stroke 1 · #E2E2E8") + ui_row("Chữ: cỡ 14 · đậm 500") +
    '</div>'
    '</div></div>'
)

ui_legend = table("teal", ["#", "Vùng", "Dùng để làm gì"], [
    ["1", "<strong>Trang &amp; lớp</strong> (cột trái)", "Mỗi file chia thành nhiều <em>page</em>; trong mỗi page, mọi thứ bạn vẽ là một <em>layer</em> xếp chồng lên nhau. Đặt tên lớp ở đây."],
    ["2", "<strong>Khung vẽ</strong> (giữa)", "Mặt phẳng vô hạn. Giữ <kbd>Space</kbd> + kéo để di chuyển, <kbd>Ctrl/⌘</kbd> + cuộn để phóng to, thu nhỏ."],
    ["3", "<strong>Thanh công cụ</strong> (nổi ở đáy khung vẽ)", "Chọn công cụ vẽ. Hầu hết đều có phím tắt — xem bảng bên dưới."],
    ["4", "<strong>Thuộc tính</strong> (cột phải)", "Chỉnh đúng con số cho thứ đang chọn: kích thước, màu nền, viền, bo góc, cỡ chữ. Thẻ <em>Prototype</em> để dành cho Bài 4.2."],
], big_cols=(1,))

concepts = table("teal", ["Khái niệm", "Nghĩa là gì", "Ví dụ trong bài hôm nay"], [
    ["<strong>File</strong>", "Một tài liệu Figma, có đường link riêng để chia sẻ.", "“Nhóm 03 – Hồ sơ thiết kế”"],
    ["<strong>Page</strong>", "Các trang bên trong một file — như tab trong bảng tính.", "00 Bìa, 01 Nghiên cứu…"],
    ["<strong>Frame</strong>", "Một khung có kích thước, nền và viền riêng; chứa các lớp khác bên trong.", "Màn hình điện thoại, tấm thẻ bài tập, cái nút"],
    ["<strong>Group</strong>", "Cái kẹp gom vài lớp để kéo đi cùng lúc. Không có nền, tự co theo nội dung.", "Ba dòng chữ muốn dời đi một lượt"],
    ["<strong>Layer</strong>", "Bất kỳ thứ gì nằm trên khung vẽ: frame, hình, chữ, ảnh.", "Tiêu đề, Hạn nộp, Nút Nộp bài"],
    ["<strong>Text / Shape</strong>", "Lớp chữ và lớp hình (chữ nhật, tròn, đường).", "Dòng “Hạn nộp: 23:59 …”"],
], big_cols=(0,))

frame_vs_group = aside("blue", "Ghi nhớ — frame hay group?",
    "Thứ gì <strong>có nền, có viền hoặc có kích thước riêng</strong> thì là <strong>frame</strong>: màn hình, tấm thẻ, cái nút, nhãn trạng thái. "
    "Group chỉ để gom tạm vài lớp. Lỗi hay gặp nhất của người mới: vẽ một hình chữ nhật, đặt chữ lên trên, rồi gom hai thứ thành group và gọi đó là “nút”. "
    "Nút ấy không co giãn được, không gắn được auto layout (Bài 4.3) và không nối prototype gọn được (Bài 4.2).")

shortcuts = table("teal", ["Phím", "Làm gì", "Phím", "Làm gì"], [
    ["<kbd>V</kbd>", "Chọn, di chuyển", "<kbd>Ctrl/⌘ D</kbd>", "Nhân bản"],
    ["<kbd>F</kbd>", "Vẽ frame", "<kbd>Ctrl/⌘ G</kbd>", "Gom thành group"],
    ["<kbd>R</kbd>", "Vẽ hình chữ nhật", "<kbd>Ctrl/⌘ Alt G</kbd>", "Bọc lớp đang chọn vào một frame"],
    ["<kbd>T</kbd>", "Viết chữ", "Giữ <kbd>Alt/⌥</kbd> + rê chuột", "Đo khoảng cách tới lớp bên cạnh"],
    ["<kbd>C</kbd>", "Để bình luận", "<kbd>Shift 1</kbd> / <kbd>Shift 2</kbd>", "Xem toàn bộ / phóng tới lớp đang chọn"],
    ["<kbd>Ctrl/⌘ R</kbd>", "Đổi tên lớp đang chọn", "<kbd>Ctrl/⌘ Alt S</kbd>", "Lưu một phiên bản có tên"],
])

# thẻ bài tập THẬT của Limio (components/lesson/LessonTasksTab.tsx · AssignmentCard, trạng thái đóng)
# — màu cố định vì đây là "ảnh" một giao diện, lấy đúng token của tailwind.config.ts / globals.css.
def limio_card(chip_text, chip_bg, chip_fg):
    return (
        '<div style="width:343px;max-width:100%;box-sizing:border-box;background:#FFFFFF;color:#030712;border:1px solid #E2E2E8;border-radius:12px;padding:20px;'
        'box-shadow:0 1px 2px rgba(16,24,40,.05);display:flex;align-items:center;justify-content:space-between;gap:12px;font-family:Inter, system-ui, sans-serif;margin:0 0 .7rem">'
        '<div style="display:flex;align-items:center;gap:12px;min-width:0">'
        '<div style="flex:0 0 36px;width:36px;height:36px;border-radius:8px;background:#FFFBEB;display:flex;align-items:center;justify-content:center;font-size:16px">📄</div>'
        '<div style="min-width:0">'
        '<div style="font-size:14px;font-weight:500;line-height:20px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">Phỏng vấn người học</div>'
        '<div style="font-size:12px;line-height:16px;color:#949EB2">Assignment · max 10đ · hạn 16/10 23:59</div>'
        '</div></div>'
        '<div style="display:flex;align-items:center;gap:8px;flex:0 0 auto">'
        f'<span style="display:inline-block;border-radius:999px;padding:2px 10px;font-size:11px;font-weight:600;line-height:16px;background:{chip_bg};color:{chip_fg};white-space:nowrap">{chip_text}</span>'
        '<span style="color:#949EB2;font-size:16px">›</span>'
        '</div></div>'
    )

card_mock = (
    '<div style="display:flex;flex-wrap:wrap;gap:1.4rem;align-items:flex-start;margin:.9rem 0">'
    '<div style="flex:0 1 343px;max-width:100%">'
    f'<div style="font-size:1rem;color:{MUTED};margin:0 0 .4rem">Ba trạng thái của cùng một thẻ:</div>'
    + limio_card("Chưa nộp", "#F4F4F8", "#475062")
    + limio_card("Đã nộp · chờ chấm", "#FFF8E6", "#B45309")
    + limio_card("✓ Đã chấm · 8/10", "#ECFDF5", "#047857")
    + '</div>'
    '<div style="flex:1 1 280px">'
    + table("amber", ["Thông số", "Giá trị"], [
        ["Frame ngoài cùng", "Rộng 343 — đúng bề ngang màn hình điện thoại 375 trừ lề hai bên. Cao theo nội dung: <strong>92</strong> ở trạng thái Chưa nộp (dòng phụ hai dòng), <strong>108</strong> ở hai trạng thái kia (nhãn dài hơn đẩy dòng phụ xuống ba dòng). Nền trắng, viền 1px #E2E2E8, bo góc 12"],
        ["Lề trong", "20 ở cả bốn phía"],
        ["Ô biểu tượng", "Frame 36 × 36, bo góc 8, nền #FFFBEB, emoji 📄 ở giữa"],
        ["Khoảng cách", "Ô biểu tượng → chữ: 12 · chữ → nhãn: 12 · nhãn → dấu ›: 8. Ô biểu tượng và nhãn căn giữa theo chiều dọc"],
        ["Chữ", "Tên bài 14, đậm 500, màu #030712 · dòng phụ 12, màu #949EB2"],
        ["Nhãn trạng thái", "Frame bo tròn hẳn, lề 10 × 2, chữ 11 đậm 600. Màu theo trạng thái — xem ba thẻ bên cạnh"],
    ]) +
    '</div></div>'
)

layer_tree = (
    '<div style="font-family:ui-monospace, SFMono-Regular, Menlo, monospace;font-size:1rem;line-height:1.7;margin:.4rem 0 0">'
    '# Thẻ bài tập — Chưa nộp<br>'
    '&nbsp;&nbsp;# Biểu tượng<br>'
    '&nbsp;&nbsp;&nbsp;&nbsp;T 📄<br>'
    '&nbsp;&nbsp;T Tên bài tập<br>'
    '&nbsp;&nbsp;T Dòng phụ<br>'
    '&nbsp;&nbsp;# Nhãn trạng thái<br>'
    '&nbsp;&nbsp;&nbsp;&nbsp;T Chưa nộp<br>'
    '&nbsp;&nbsp;T ›'
    '</div>'
)

part1 = part("teal", "Phần 1 — Làm quen Figma: dựng lại thẻ bài tập của Limio", "30 phút", "".join([
    p("Figma là công cụ thiết kế giao diện chạy ngay trên trình duyệt, nhiều người cùng sửa một file một lúc và thấy con trỏ của nhau. Trong khoá này bạn dùng Figma để dựng màn hình — và là công cụ chính của bài tập cuối kỳ."),
    p("Phần này làm <strong>cá nhân</strong>, trong một file nháp của riêng bạn. Mục tiêu là quen tay, không phải làm đẹp."),
    h3("Bốn vùng của màn hình làm việc · 5 phút", "teal"),
    figma_ui, ui_legend,
    h3("Sáu khái niệm cần phân biệt", "teal"),
    concepts, frame_vs_group,
    h3("Mười hai phím tắt đáng nhớ", "teal"),
    shortcuts,
    p("Trên máy Windows dùng <kbd>Ctrl</kbd> và <kbd>Alt</kbd>; trên máy Mac dùng <kbd>⌘</kbd> và <kbd>⌥</kbd>.", small=True, muted=True),
    h3("Bài tập: dựng lại thẻ bài tập của Limio · 25 phút", "teal"),
    p("Mở một bài học có bài tập trên Limio, chọn thẻ <em>Bài tập</em>: đây là cái thẻ bạn thấy. Dựng lại nó trong Figma, <strong>đúng thông số</strong> bên cạnh, đủ <strong>ba trạng thái</strong>. Bài tập nhóm của cả học phần là thiết kế lại trang của sinh viên trên Limio — nên bắt đầu bằng việc dựng lại đúng cái đang có."),
    card_mock,
    steps("teal", [
        ("1 · 2 phút", "Vào <em>Drafts</em>, tạo file Design mới tên <strong>“TH2 – Họ tên của bạn”</strong>."),
        ("2 · 5 phút", "Bấm <kbd>F</kbd>, vẽ frame rồi gõ W 343, H 92 ở cột phải. Đặt nền, viền, bo góc. Đổi tên lớp thành “Thẻ bài tập — Chưa nộp”."),
        ("3 · 6 phút", "Dựng ô biểu tượng (một frame nhỏ có emoji bên trong), rồi bấm <kbd>T</kbd> viết tên bài và dòng phụ. Chỉnh cỡ chữ, màu chữ theo bảng."),
        ("4 · 5 phút", "Dựng nhãn trạng thái và dấu ›. Nhãn là <strong>một frame có chữ bên trong</strong>, không phải hình chữ nhật cộng chữ gom group."),
    ]),
    steps("teal", [
        ("5 · 3 phút", "Chọn một lớp, giữ <kbd>Alt/⌥</kbd> rồi rê sang lớp kế bên: Figma hiện khoảng cách màu đỏ. Sửa cho đúng 12 và 8, lề trong đúng 20."),
        ("6 · 4 phút", "<kbd>Ctrl/⌘ D</kbd> nhân bản thẻ hai lần, sửa thành hai trạng thái còn lại. Đổi tên lớp cho khớp: “— Đã nộp”, “— Đã chấm”."),
    ]),
    aside("amber", "Hôm nay chưa dùng auto layout",
        "Nếu bạn đã biết auto layout, cứ để dành cho Bài 4.3. Đặt tay từng lớp một lần sẽ cho bạn thấy auto layout giải quyết đúng việc gì — và vì sao nó đáng học."),
    reveal("teal", "Bài thế nào là đạt? Bấm xem cây lớp mẫu",
        aside("teal", "Bài đạt khi",
            "Thẻ, ô biểu tượng và nhãn trạng thái đều là <strong>frame</strong> (biểu tượng <code>#</code> ở cột trái); "
            "không còn lớp nào mang tên mặc định kiểu “Rectangle 12”, “Frame 7”; khoảng cách đúng; có đủ ba trạng thái. "
            "Màu lệch một chút không sao — hôm nay không chấm độ đẹp." + layer_tree)),
    reveal("pink", "Dựng xong rồi? Thẻ này có ít nhất ba vấn đề — bấm để kiểm tra mắt mình",
        aside("pink", "Ba vấn đề có thật trên Limio",
            "<strong>1. Lẫn tiếng Anh.</strong> Dòng phụ ghi “Assignment · max 10đ” giữa một giao diện tiếng Việt, trong khi nút và nhãn ngay bên cạnh đều là tiếng Việt.<br>"
            "<strong>2. Dòng phụ khó đọc.</strong> Chữ #949EB2 cỡ 12 trên nền trắng chỉ đạt tương phản <strong>2,69 : 1</strong>, dưới ngưỡng 4,5 : 1 của WCAG cho chữ thường (Bài 5.2). Hạn nộp — thông tin quan trọng nhất của một bài tập — lại nằm đúng ở dòng mờ nhất.<br>"
            "<strong>3. Tên bài bị cắt.</strong> Trên điện thoại, nhãn trạng thái càng dài thì tên bài càng bị cắt cụt — “Phỏng vấn ng…” ở hai thẻ dưới. Lúc bài đã nộp, người học thấy rõ trạng thái nhưng không còn đọc được đó là bài nào.<br>"
            "Ghi ba điều này vào sổ: nếu nhóm chọn trang bài học hay trang nộp bài cho bài tập giữa kỳ, đây là chỗ bắt đầu tốt. Nhưng mới là nhận định của bạn — phải hỏi người dùng thật mới biết họ có thật sự vấp ở đó không.")),
]), open_=True)

# ---------------------------------------------------------------- PHẦN 2 · từ bản giấy lên Figma
SKETCH_FONT = "'Comic Sans MS','Chalkboard SE','Segoe Print',cursive"
WOBBLY = "255px 15px 225px 15px/15px 225px 15px 255px"  # viền hơi méo cho giống nét bút


def sk_card(title, due):
    return (
        f'<div style="border:2px solid #333;border-radius:{WOBBLY};padding:8px 10px;margin:8px 0">'
        f'<div style="display:flex;justify-content:space-between;align-items:center;gap:6px">'
        f'<span style="font-size:14px">{title}</span>'
        '<span style="flex:0 0 auto;white-space:nowrap;border:2px solid #333;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:700;background:#333;color:#FFFDF5">CHƯA NỘP</span>'
        '</div>'
        f'<div style="font-size:12px;margin-top:4px">{due}</div>'
        '</div>'
    )


def note(text):
    return f'<div style="color:#C92A2A;font-family:{SKETCH_FONT};font-size:.95rem;line-height:1.35;margin:.2rem 0 1rem">← {text}</div>'


paper_sketch = (
    '<div style="display:flex;flex-wrap:wrap;gap:1.2rem;align-items:flex-start;margin:.9rem 0">'
    f'<div style="flex:0 0 auto;width:260px;max-width:100%;box-sizing:border-box;background:#FFFDF5;color:#333;border:2.5px solid #333;border-radius:28px;padding:18px 14px 26px;font-family:{SKETCH_FONT};box-shadow:3px 4px 0 rgba(0,0,0,.12)">'
    f'<div style="display:flex;align-items:center;gap:8px;border-bottom:2px solid #333;padding-bottom:8px;font-size:16px;font-weight:700"><span>≡</span><span>Bài tập của tôi</span></div>'
    '<div style="font-size:11px;font-weight:700;letter-spacing:.06em;margin:12px 0 2px">CẦN LÀM (2)</div>'
    + sk_card("Phỏng vấn người học", "Hạn: còn 2 ngày · 16/10")
    + sk_card("Persona và hành trình", "Hạn: còn 5 ngày · 19/10")
    + f'<div style="border:2px dashed #333;border-radius:{WOBBLY};padding:8px 10px;margin:12px 0 0;font-size:13px;display:flex;justify-content:space-between"><span>ĐÃ NỘP (3)</span><span>›</span></div>'
    '</div>'
    '<div style="flex:1 1 220px;padding-top:2.6rem">'
    + note("chỉ còn bài <strong>chưa nộp</strong> ở trên cùng")
    + note("nhãn “Chưa nộp” đậm, nổi nhất trang<br>(Von Restorff)")
    + note("hạn nộp ghi “còn mấy ngày”,<br>không bắt người học tự tính")
    + note("bài đã nộp gập lại cho gọn")
    + '</div></div>'
)

screen_spec = table("purple", ["Thứ cần dựng", "Thông số"], [
    ["Frame điện thoại", "375 × 812, nền trắng, tên lớp “Bài tập của tôi — điện thoại”"],
    ["Thanh đầu", "Cao 56, chữ tiêu đề 18 đậm; đường kẻ dưới 1px #E2E2E8"],
    ["Lề hai bên", "16 — nên thẻ rộng đúng 343, khớp với thẻ ở Phần 1"],
    ["Tiêu đề nhóm", "“CẦN LÀM (2)”, “ĐÃ NỘP (3)”: chữ 12, in hoa, đậm, màu #475062"],
    ["Thẻ bài tập", "<strong>Chép thẻ từ Phần 1</strong> rồi sửa: dòng phụ thành “Hạn: còn 2 ngày · 16/10”; nhãn “Chưa nộp” nền #E11D48, chữ trắng đậm (tương phản 4,7 : 1). Hai thẻ cách nhau 12"],
    ["Nhóm đã nộp", "Một dòng cao 48 có viền: “ĐÃ NỘP (3)” bên trái, dấu › bên phải"],
], big_cols=(0,))

part2 = part("purple", "Phần 2 — Từ bản giấy lên Figma", "40 phút", "".join([
    p("Bài tập giữa kỳ, nhóm vẽ lại một trang Limio <strong>bằng giấy</strong>. Bài tập cuối kỳ, nhóm đưa chính bản giấy đó <strong>lên Figma</strong>. Phần này tập trước đúng việc ấy, trên một bản giấy mẫu."),
    p("Bản giấy bên dưới vẽ lại danh sách bài tập của sinh viên. Chữ đỏ là ghi chú của người vẽ — mỗi ghi chú là một quyết định thiết kế, có chỗ dẫn cả quy luật đã dùng."),
    paper_sketch,
    aside("teal", "Giấy trước, Figma sau",
        "Giấy dùng để thử ý tưởng: vẽ năm phút, sai thì vò đi, đưa ngay cho người khác bấm thử bằng ngón tay. Figma dùng khi ý tưởng đã qua được vòng thử đó. "
        "Vì vậy bản giấy không cần đúng tỉ lệ, còn bản Figma phải đúng từng con số — đừng đồ lại nét giấy, hãy đọc ý của nó rồi dựng theo thông số."),
    h3("Dựng màn hình này trên Figma", "purple"),
    screen_spec,
    steps("purple", [
        ("1 · 3 phút", "Trong file nháp <strong>TH2 – Họ tên</strong> của Phần 1, tạo page mới “Phần 2”. Bấm <kbd>F</kbd>, vẽ frame 375 × 812 và đặt tên."),
        ("2 · 4 phút", "Chụp màn hình bản giấy ở trên, kéo ảnh vào Figma, đặt <strong>bên cạnh</strong> frame để nhìn sang. Cuối kỳ, bạn sẽ chụp bản giấy của nhóm bằng điện thoại và làm y như vậy."),
        ("3 · 8 phút", "Dựng thanh đầu và hai tiêu đề nhóm."),
    ]),
    steps("purple", [
        ("4 · 12 phút", "Sang page Phần 1, chọn thẻ “Chưa nộp”, <kbd>Ctrl/⌘ C</kbd>, quay lại <kbd>Ctrl/⌘ V</kbd> vào frame. Sửa theo bảng thông số rồi nhân bản thành hai thẻ. <strong>Dùng lại</strong> thứ đã dựng là thói quen quan trọng nhất của Figma."),
        ("5 · 5 phút", "Dựng dòng “Đã nộp (3) ›” đã gập lại."),
        ("6 · 5 phút", "Đặt màn hình cạnh bản giấy, soát từng ghi chú đỏ. Ghi chú nào chưa làm được: bấm <kbd>C</kbd>, để một bình luận ngay chỗ đó nói vì sao."),
    ]),
    aside("amber", "Chỉ xám, cộng một màu nhấn",
        "Màn hình này chỉ dùng trắng, xám, đen và <strong>một</strong> màu đỏ cho nhãn “Chưa nộp”. Đó chính là quy luật Von Restorff: một thứ khác hẳn xung quanh thì được chú ý. "
        "Thêm màu thứ hai, thứ ba là các thứ bắt đầu tranh nhau sự chú ý. Màu sắc đầy đủ là việc của Bài 5.2."),
    reveal("purple", "Bài thế nào là đạt?",
        aside("purple", "Bài đạt khi",
            "Frame 375 × 812 đặt tên rõ; thẻ được <strong>chép từ Phần 1</strong> chứ không vẽ lại từ đầu; lề 16 và thẻ rộng 343; chỉ có một màu nhấn; "
            "mỗi ghi chú đỏ của bản giấy hoặc đã làm, hoặc có một bình luận nói vì sao chưa làm.")),
]))

# ---------------------------------------------------------------- PHẦN 3 · file nhóm cho bài cuối kỳ
pages_table = table("amber", ["Page", "Chứa gì", "Khi nào điền"], [
    ["<strong>00 Bìa</strong>", "Tên nhóm, thành viên và vai, trang Limio nhóm đã chọn, 3 quy luật được chia", "Hôm nay"],
    ["<strong>01 Từ giữa kỳ</strong>", "Ảnh chụp trang Limio hiện tại, ảnh bản giấy, kết quả hỏi 5 bạn, góp ý nhận được hôm thuyết trình", "Ngay sau buổi thuyết trình giữa kỳ"],
    ["<strong>02 Hệ thống thiết kế</strong>", "Màu, chữ, khoảng cách và các thành phần dùng chung, bám theo Limio", "Bài tập cuối kỳ — Mốc 1"],
    ["<strong>03 Giao diện</strong>", "Các màn hình hoàn chỉnh, bản điện thoại và máy tính, prototype bấm được", "Bài tập cuối kỳ — Mốc 1, 2"],
    ["<strong>04 Kiểm thử</strong>", "Kiểm thử với 5 người, đánh giá chéo của nhóm bạn, bản sửa trước/sau", "Bài tập cuối kỳ — Mốc 2"],
    ["<strong>05 Bàn giao</strong>", "Đặc tả cho lập trình viên, kế hoạch đo lường", "Bài tập cuối kỳ — Mốc 3"],
    ["<strong>06 Bản nộp cuối kỳ</strong>", "Case study để trình bày hôm bảo vệ", "Bảo vệ cuối kỳ"],
], big_cols=(0,))

part3 = part("amber", "Phần 3 — Dựng file nhóm cho bài tập cuối kỳ", "30 phút", "".join([
    p("Bài tập cuối kỳ làm trên <strong>một file Figma của cả nhóm</strong>. Dựng nó ngay hôm nay, khi mọi người còn ngồi cạnh nhau: tới lúc vào bài cuối kỳ, nhóm chỉ việc mở ra làm tiếp. Giảng viên chấm bằng chính file này, nên nó phải gọn ngay từ đầu."),
    h3("Bảy page cố định — đúng tên, đúng thứ tự", "amber"),
    pages_table,
    p("Page chưa tới lúc thì cứ tạo sẵn và để trống. Mở file ra là thấy ngay nhóm đang ở đâu.", small=True, muted=True),
    steps("amber", [
        ("Bước 1 · 8 phút", "Một bạn làm <strong>người giữ team</strong>: tạo team “Nhóm 03 – Lớp …”, trong đó tạo project “Bài tập nhóm”, rồi tạo file Design “Nhóm 03 – Hồ sơ thiết kế” <strong>trong project đó</strong> (không phải <em>Drafts</em>). Mời cả nhóm quyền <em>can edit</em>. Tạo đủ bảy page."),
        ("Bước 2 · 10 phút", "Ở page 00 Bìa, dựng một frame 1440 × 1024: tên nhóm, bảng thành viên và vai, trang Limio đã chọn, 3 quy luật được chia. Dùng đúng những gì vừa luyện ở Phần 1, 2."),
    ]),
    steps("amber", [
        ("Bước 3 · 7 phút", "Bấm <em>Share</em>, mời giảng viên vào team với quyền <em>can view</em>. Rồi mỗi người bấm <kbd>C</kbd>, để một bình luận trên trang bìa, <strong>@nhắc tên</strong> một bạn khác về một việc cụ thể; người được nhắc trả lời rồi bấm <em>Resolve</em>."),
        ("Bước 4 · 5 phút", "<kbd>Ctrl/⌘ Alt S</kbd> lưu phiên bản tên <strong>“TH2 – Dựng xong file”</strong>, ghi một dòng mô tả. Mở <em>Version history</em> kiểm tra nó đã nằm đó."),
    ]),
    aside("amber", "Cảnh báo — file trong Drafts là file của một người",
        "File để trong <em>Drafts</em> thuộc về đúng người tạo ra nó. Bạn ấy nghỉ học, đổi email hay hết hạn gói Education là cả nhóm mất file. "
        "File trong <strong>project của team</strong> thì thuộc về team. Lỡ tạo trong Drafts thì kéo nó vào project ngay."),
    aside("teal", "Vì sao phải đặt tên phiên bản",
        "Figma tự lưu liên tục, nhưng bản tự lưu không có tên — vài tuần sau không ai tìm lại được “bản hôm nộp mốc 1”. "
        "Phiên bản có tên cũng là bằng chứng về đóng góp: điểm cá nhân của bài tập cuối kỳ dựa một phần vào lịch sử phiên bản và bình luận."),
]))

# ---------------------------------------------------------------- PHẦN 4 · soát chéo
file_checklist = [
    "File nằm trong <strong>project của team</strong>, không nằm trong Drafts của ai.",
    "Đủ bảy page, đúng tên và đúng thứ tự.",
    "Trang bìa có tên nhóm, thành viên và vai, trang Limio đã chọn, 3 quy luật.",
    "Mọi thành viên có quyền sửa; giảng viên đã được mời quyền xem.",
    "Không còn lớp mang tên mặc định (“Frame 12”, “Rectangle 3”) trên trang bìa.",
    "Có ít nhất một bình luận @nhắc tên đã được trả lời và Resolve.",
    "Có phiên bản tên “TH2 – Dựng xong file” trong lịch sử phiên bản.",
]

part4 = part("blue", "Phần 4 — Soát chéo và nộp", "20 phút", "".join([
    p("Đổi link file với nhóm bên cạnh (nhóm 1 ↔ 2, 3 ↔ 4…). Bạn soát file của họ bằng <strong>chính tính năng bình luận của Figma</strong> — bình luận đặt đúng chỗ có vấn đề, không gửi qua tin nhắn."),
    steps("blue", [
        ("Bước 1 · 10 phút — Soát", "Đi qua danh sách bên dưới trên file của nhóm bạn. Mục nào chưa đạt: bấm <kbd>C</kbd>, đặt bình luận ngay chỗ đó, mở đầu bằng <strong>[Soát]</strong>, nói rõ thiếu gì."),
        ("Bước 2 · 7 phút — Sửa", "Quay về file nhà. Sửa theo từng bình luận <strong>[Soát]</strong> nhận được, xong cái nào bấm <em>Resolve</em> cái đó. Không đồng ý thì trả lời vì sao, đừng lặng lẽ bỏ qua."),
        ("Bước 3 · 3 phút — Nộp", "Nộp lên Limio theo mục “Sản phẩm nộp” cuối trang."),
    ]),
    h3("Danh sách soát file nhóm", "blue"),
    checklist(file_checklist),
    reveal("blue", "Bình luận soát thế nào là dùng được? Bấm xem ví dụ",
        aside("blue", "Ví dụ",
            "Chưa dùng được: <em>“[Soát] Bìa thiếu thông tin.”</em><br>"
            "Dùng được: <em>“[Soát] Bìa chưa ghi 3 quy luật nhóm được chia, và page 04 đang tên là ‘Page 5’.”</em>")),
]))

# ---------------------------------------------------------------- sản phẩm nộp
deliver = summary_box("Sản phẩm nộp và cách chấm", "".join([
    check("Link file nháp cá nhân <strong>TH2 – Họ tên</strong>: page Phần 1 (ba trạng thái thẻ) và page Phần 2 (màn hình từ bản giấy) — mỗi người tự nộp"),
    check("Link file nhóm <strong>Nhóm … – Hồ sơ thiết kế</strong> (quyền xem) — người giữ team nộp"),
    '<div style="height:.6rem"></div>',
    table("green", ["Tiêu chí", "Điểm"], [
        ["Phần 1 — thẻ bài tập: đúng frame, lớp có tên, khoảng cách đúng, đủ ba trạng thái", "25"],
        ["Phần 2 — màn hình từ bản giấy: đúng thông số, dùng lại thẻ Phần 1, một màu nhấn, ghi chú đỏ đã xử lý", "35"],
        ["Phần 3 — file nhóm: đạt danh sách soát ở Phần 4", "20"],
        ["Phần 4 — soát chéo: bình luận gửi nhóm bạn cụ thể, chỉ đúng chỗ; bình luận nhận được đã xử lý hoặc trả lời", "20"],
    ], big_cols=(0, 1)),
]))

refs = sources([
    'Figma Learn. <a href="https://help.figma.com/hc/en-us/articles/360041061214">Figma for Education</a> — điều kiện và cách xác minh gói Education.',
    'Figma Learn. <a href="https://help.figma.com/hc/en-us/articles/360041539473-Frames-in-Figma-Design">Frames in Figma Design</a> — frame khác group thế nào.',
    'Figma Learn. <a href="https://help.figma.com/hc/en-us/articles/360040328653-Use-Figma-products-with-a-keyboard">Use Figma products with a keyboard</a> — bảng phím tắt đầy đủ.',
    'Figma Learn. <a href="https://help.figma.com/hc/en-us/articles/1500005554982-Guide-to-sharing-and-permissions">Guide to files and folders</a> — Drafts, project và quyền sở hữu file.',
    'Figma Learn. <a href="https://help.figma.com/hc/en-us/articles/360039825314-Guide-to-comments-in-Figma">Guide to comments in Figma</a> và <a href="https://help.figma.com/hc/en-us/articles/360038006754-View-a-file-s-version-history">View a file’s version history</a>.',
    'Nielsen, J. (2003). <a href="https://www.nngroup.com/articles/paper-prototyping/">Paper Prototyping: Getting User Data Before You Code</a>. Nielsen Norman Group — vì sao vẽ giấy trước khi dựng trên máy.',
])

html = page(
    chips("⏱ 120 phút", "👥 Theo nhóm bài tập (4–5 người)", "💻 Mỗi người một laptop", "🎓 Tài khoản Figma Education"),
    h1("Bài thực hành 2 — Làm quen Figma, chuẩn bị cho bài tập cuối kỳ"),
    p("Học phần có hai bài tập nhóm. <strong>Giữa kỳ</strong>, nhóm vẽ lại một trang Limio <strong>bằng giấy</strong>. <strong>Cuối kỳ</strong>, nhóm đưa bản giấy đó <strong>lên Figma</strong> thành giao diện hoàn chỉnh. Buổi hôm nay là bước đệm cho bài cuối kỳ: tập Figma, tập chuyển một bản giấy lên Figma, và dựng sẵn file của nhóm. Các khối có tiêu đề màu bên dưới đều <strong>bấm được để mở/đóng</strong>; các danh sách tick được ngay trên màn hình."),
    objectives([
        "Dựng được một thành phần giao diện trong Figma bằng frame, chữ và hình, với lớp được đặt tên rõ ràng.",
        "Chuyển được một bản vẽ giấy thành màn hình điện thoại trên Figma, dùng lại thành phần đã dựng.",
        "Tổ chức được file nhóm cho bài tập cuối kỳ: cấu trúc, phân quyền, bình luận và phiên bản.",
    ]),
    h3("Chuẩn bị trước khi vào buổi học"),
    checklist([
        "<strong>Xác minh gói Figma Education trước buổi học ít nhất một tuần</strong> tại <em>figma.com/education/apply</em>, đăng nhập bằng <strong>email do trường cấp</strong>. Figma duyệt qua một đơn vị trung gian, có khi phải gửi thêm giấy tờ — để sát ngày là không kịp.",
        "Mang laptop. Figma chạy được trên trình duyệt Chrome hoặc Edge, hoặc cài ứng dụng máy tính. Điện thoại không dùng để dựng được.",
        "Nhóm đã đăng ký bài tập giữa kỳ (Bài 2.4): biết trang Limio nhóm chọn và 3 quy luật được chia.",
        "Ngồi theo nhóm bài tập.",
    ]),
    h2("Lịch trình 120 phút", "lich-trinh"),
    timeline([("teal", 30, "Làm quen Figma"), ("purple", 40, "Từ giấy lên Figma"), ("amber", 30, "Dựng file nhóm"), ("blue", 20, "Soát chéo, nộp")]),
    p("Phần 1 và 2 làm cá nhân, Phần 3 và 4 làm theo nhóm. Mở lần lượt từng phần khi đến giờ — đỡ rối mắt vì thấy hết nội dung buổi học cùng lúc.", small=True, muted=True),
    part1, part2, part3, part4,
    deliver,
    refs,
)

open(__import__("sys").argv[1], "w").write(html)
