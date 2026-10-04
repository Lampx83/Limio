from kit import *

# Bản đơn giản (user chốt 2026-10-04): sản phẩm là MỘT buổi thuyết trình; vẽ lại bằng
# paper prototype, không dùng Figma. Nội dung khớp với ../mo-ta-bai-tap-giua-ky.txt (bản dán LMS).

slides = table("pink", ["Slide", "Nội dung"], [
    ["1", "Tên nhóm, thành viên, trang Limio đã chọn"],
    ["2 – 4", "Ba quy luật — mỗi quy luật một slide: nói gì, ví dụ đời thường, có luôn đúng không"],
    ["5", "Trang Limio hiện tại — ảnh chụp, khoanh chỗ tốt và chỗ chưa tốt"],
    ["6", "Kết quả hỏi 5 bạn — điều nhóm đoán đúng hay sai"],
    ["7", "Bản giấy — trước (Limio hiện tại) và sau (ảnh chụp từng màn hình giấy), kèm kết quả 2 bạn thử"],
    ["8", "Điều nhóm học được"],
    ["Phụ lục", "Bảng tóm tắt 5 bạn được hỏi (bạn số mấy, đã làm gì, đã nói gì) và 2 bạn đã bấm thử bản giấy. Không cần trình chiếu — để giảng viên đọc khi chấm"],
], big_cols=(0,))

rubric = table("green", ["Tiêu chí", "Điểm"], [
    ["Hiểu đúng 3 quy luật, có ví dụ, biết lúc nào quy luật không đúng", "20"],
    ["Tìm đúng chỗ trên Limio, có ảnh chụp, giải thích được vì sao", "20"],
    ["Có hỏi 5 người dùng thật và trình bày trung thực kết quả", "20"],
    ["Bản giấy sửa đúng chỗ đã tìm ra, có trước và sau, đã cho 2 bạn thử", "25"],
    ["Thuyết trình rõ ràng, đúng giờ, trả lời được câu hỏi", "15"],
], big_cols=(0, 1))

submit_table = table("blue", ["Ô trên trang nộp bài", "Nộp gì"], [
    ["<strong>Tệp tải lên</strong> (bắt buộc)", "Slide thuyết trình <strong>xuất ra PDF</strong>, có đủ: ảnh chụp trang Limio đã khoanh, ảnh chụp từng màn hình bản giấy (3–5 ảnh), và phụ lục ở slide cuối."],
    ["<strong>Ô nội dung</strong> (bắt buộc)", "Điền theo mẫu 3 dòng bên dưới."],
    ["<strong>Ô đường link</strong> (không bắt buộc)", "Video dưới 1 phút quay một bạn bấm thử bản giấy — <strong>chỉ quay tay và giấy, không quay mặt</strong>, xin phép trước. Để chế độ “bất kỳ ai có đường liên kết đều xem được”."],
], big_cols=(0,))

template_box = (
    f'<div style="border:1px solid {RULE};border-radius:.5rem;padding:.8rem 1rem;margin:.7rem 0;font-family:ui-monospace, SFMono-Regular, Menlo, monospace;font-size:1rem;line-height:1.8">'
    "Nhóm: …<br>"
    "3 quy luật: …<br>"
    "Trang Limio đã chọn: …"
    "</div>"
)

team_steps = steps("blue", [
    ("1 · Lập nhóm trên Limio",
     "Trưởng nhóm vào <strong>trang khoá học</strong>, ở khối <strong>“Nhóm của tôi”</strong> bấm <em>Tạo nhóm</em> → nhận <strong>mã nhóm 6 ký tự</strong> → gửi mã cho các bạn. Các bạn bấm <em>Vào nhóm bằng mã</em> rồi nhập mã. Làm xong trước hạn lập nhóm của giảng viên."),
    ("2 · Một bạn nộp cho cả nhóm",
     "Một thành viên bất kỳ mở bài tập này và nộp — <strong>cả nhóm có bài</strong>, không cần mỗi người nộp lại. Ai trong nhóm cũng nộp lại được; bài mới thay bài cũ cho cả nhóm."),
    ("3 · Mỗi người ghi “Phần việc của tôi”",
     "Sau khi nhóm đã nộp, <strong>mỗi thành viên</strong> mở bài tập và ghi 1–2 câu vào ô <strong>“Phần việc của tôi”</strong>: mình đã làm gì cho bài này. Giảng viên đọc ô này khi chấm, và có thể chỉnh điểm riêng cho từng người."),
])

paper_steps = steps("amber", [
    ("Vẽ", "Mỗi màn hình một tờ giấy, khung bằng màn hình điện thoại. Vẽ bằng bút, không cần đẹp, chỉ cần đọc được."),
    ("Cắt rời", "Phần thay đổi khi bấm — hộp thông báo, menu xổ xuống, nhãn đổi trạng thái — vẽ trên mẩu giấy riêng để đặt chồng lên."),
    ("Thử", "Bạn thử dùng ngón tay “bấm” lên giấy. Một thành viên đóng vai <strong>“máy tính”</strong>: bạn ấy bấm chỗ nào thì đổi sang tờ giấy tương ứng. Không giải thích, không mách nước."),
    ("Ghi lại", "Chỗ nào bạn thử lúng túng, bấm sai, hay hỏi “cái này là gì?”. Chụp ảnh bản giấy để đưa vào slide."),
])


def photo(src, page, alt, caption, credit, pos="center"):
    """Ảnh Commons: chú thích ghi tên file + tác giả + giấy phép, link về trang File (quy ước của khoá)."""
    return (
        f'<figure style="margin:0;border:1px solid {RULE};border-radius:.5rem;overflow:hidden">'
        f'<img src="{src}" alt="{alt}" loading="lazy" style="display:block;width:100%;aspect-ratio:4/3;object-fit:cover;object-position:{pos}">'
        f'<figcaption style="padding:.6rem .8rem;font-size:1rem;line-height:1.5">{caption}'
        f'<br><span style="font-size:.85rem;color:{MUTED}">Ảnh: <a href="{page}">{credit}</a></span></figcaption>'
        '</figure>'
    )


paper_photos = (
    '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:1rem;margin:1rem 0">'
    + photo("https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Paper_prototype_of_website_user_interface%2C_2015-04-16.jpg/960px-Paper_prototype_of_website_user_interface%2C_2015-04-16.jpg",
            "https://commons.wikimedia.org/wiki/File:Paper_prototype_of_website_user_interface,_2015-04-16.jpg",
            "Bản vẽ giấy trang khoá học, đặt trên bàn gỗ",
            "<strong>Vẽ.</strong> Bản giấy trang khoá học của Wiki Education: vẽ bằng bút, chữ viết tay, ghi chú bên lề. Không đẹp — nhưng đọc được.",
            "Sage Ross, CC BY-SA 4.0 (Wikimedia Commons)")
    + photo("https://upload.wikimedia.org/wikipedia/commons/thumb/9/9c/Paper_Prototype_on_iPad.jpg/960px-Paper_Prototype_on_iPad.jpg",
            "https://commons.wikimedia.org/wiki/File:Paper_Prototype_on_iPad.jpg",
            "Bản vẽ giấy đặt trên máy tính bảng, hai nút bấm là hai tờ giấy note",
            "<strong>Vẽ đúng cỡ thiết bị.</strong> Màn hình giấy đặt ngay trên máy tính bảng; hai nút là hai tờ giấy note — muốn đổi nút thì chỉ thay tờ note.",
            "Tobe101, CC BY-SA 4.0 (Wikimedia Commons)", "center 75%")
    + photo("https://upload.wikimedia.org/wikipedia/commons/2/24/ELivingCampus_Paper_Prototype.jpg",
            "https://commons.wikimedia.org/wiki/File:ELivingCampus_Paper_Prototype.jpg",
            "Bản vẽ giấy một trò chơi học tập, các mẩu giấy rời được đặt chồng lên",
            "<strong>Cắt rời.</strong> Bản giấy một trò chơi học tập: các lựa chọn là mẩu giấy rời, đặt chồng lên khi người thử chọn.",
            "Samuel Mann, CC BY 2.0 (Wikimedia Commons)")
    + photo("https://upload.wikimedia.org/wikipedia/commons/7/7b/TestingPaperPrototype.jpg",
            "https://commons.wikimedia.org/wiki/File:TestingPaperPrototype.jpg",
            "Người thử dùng ngón tay và bút lông thao tác trên một biểu mẫu vẽ giấy",
            "<strong>Thử.</strong> Ô nhập liệu phủ một lớp giấy bóng kính: người thử “gõ” bằng bút lông xoá được, ngón tay “bấm” lên giấy.",
            "d_jan, CC BY 2.0 (Wikimedia Commons)")
    + '</div>'
)

materials_photo = (
    '<div style="max-width:28rem;margin:.7rem 0">'
    + photo("https://upload.wikimedia.org/wikipedia/commons/8/8a/PaperPrototyping_Materialien.jpg",
            "https://commons.wikimedia.org/wiki/File:PaperPrototyping_Materialien.jpg",
            "Dụng cụ làm paper prototype: kéo, bút chì, bút dạ, bút nhớ, keo, băng dính",
            "<strong>Chuẩn bị.</strong> Kéo, bút chì, bút dạ, bút nhớ dòng, keo dán, băng dính — và giấy.",
            "d_jan, CC BY 2.0 (Wikimedia Commons)")
    + '</div>'
)


# Ảnh giảng viên gửi (2026-10-04). File gốc ở ../img/, đưa lên prod theo đường
# /api/lesson-media/images/<tên> (xem memory project_khoa_ui_ux: scp + docker cp).
DOIT_IMG = "/api/lesson-media/images/paper-prototype-doit-1791121100939-5e64fbb6.webp"

doit_figure = (
    f'<figure style="margin:1rem 0;border:1px solid {RULE};border-radius:.5rem;overflow:hidden">'
    f'<img src="{DOIT_IMG}" alt="Bản giấy hoàn chỉnh của một ứng dụng quản lý công việc trên điện thoại: khung điện thoại vẽ tay, các màn hình xếp thành dãy theo luồng, và nhiều mẩu giấy cắt rời" loading="lazy" style="display:block;width:100%;height:auto">'
    '<figcaption style="padding:.7rem .9rem;font-size:1rem;line-height:1.6">'
    '<strong>Một bản giấy trọn vẹn</strong> của ứng dụng quản lý công việc “DoIt!”. Để ý ba thứ: '
    '<strong>(1)</strong> khung điện thoại vẽ sẵn ở góc trái — từng màn hình được đặt vào khung khi thử; '
    '<strong>(2)</strong> các màn hình <strong>xếp thành dãy</strong> theo đúng thứ tự người dùng đi qua; '
    '<strong>(3)</strong> những <strong>mẩu cắt rời</strong> — bàn phím, chữ đã “gõ” sẵn, thanh sắp xếp và lọc, hộp hỏi “Bạn có chắc muốn huỷ?” — đặt chồng lên đúng lúc người thử bấm tới. '
    'Bản này có hơn hai mươi màn hình; bài của các bạn chỉ cần <strong>3–5</strong>.'
    f'<br><span style="font-size:.85rem;color:{MUTED}">Nguồn: tư liệu bài giảng của khoá học.</span>'
    '</figcaption></figure>'
)

faq = "".join([
    reveal("teal", "Có cần biết Figma không?", aside("teal", "Trả lời",
        "Không. Bài giữa kỳ vẽ hoàn toàn bằng giấy và bút.")),
    reveal("teal", "Bản giấy cần đẹp đến đâu?", aside("teal", "Trả lời",
        "Đọc được là đủ. Giấy để thử ý tưởng nhanh: vẽ năm phút, sai thì vẽ lại. Bản giấy càng đẹp, người thử càng ngại góp ý — và chính nhóm cũng càng tiếc không muốn sửa.")),
    reveal("teal", "Điều nhóm đoán bị sai thì sao?", aside("teal", "Trả lời",
        "Không bị trừ điểm. Cứ trình bày đúng như những gì các bạn được hỏi đã làm và nói. Phát hiện ra quy luật không đúng trong trường hợp của Limio cũng là một kết quả tốt — đó chính là phần “quy luật có luôn đúng không”.")),
    reveal("teal", "Quy luật được chia khó tìm ví dụ trên trang nhóm chọn thì sao?", aside("teal", "Trả lời",
        "Nói thẳng điều đó trong slide: “trên trang này, quy luật X không thấy rõ, vì…”. Biết lúc nào một quy luật không dùng được cũng là hiểu quy luật. Nhóm vẫn có thể tìm ví dụ ở một trang Limio khác cho quy luật đó.")),
    reveal("teal", "Ai được tính là “người dùng thật”?", aside("teal", "Trả lời",
        "Sinh viên đang học trên Limio, không phải thành viên của nhóm. Tốt nhất là có cả bạn không học khoá UI UX này — các bạn ấy chưa quen nhìn giao diện bằng con mắt nhà thiết kế.")),
])

html = page(
    chips("👥 Nhóm 4–5 người", "📐 3 quy luật × 1 trang Limio", "✏️ Vẽ lại bằng giấy", "🎤 Thuyết trình 10 phút"),
    h1("Bài tập nhóm giữa kỳ — Laws of UX trên Limio", "pink"),
    objectives([
        "Giải thích được 3 quy luật trong Laws of UX bằng ví dụ, và biết lúc nào chúng không đúng.",
        "Dùng được các quy luật để tìm chỗ tốt và chưa tốt trên một trang Limio, rồi kiểm tra lại với người dùng thật.",
        "Vẽ lại được một trang bằng giấy (paper prototype) và cho người khác bấm thử.",
    ]),

    h2("Bài tập này là gì?", "la-gi"),
    p("<strong>Laws of UX</strong> (lawsofux.com) là một bộ 30 quy luật về cách con người nhìn, nhớ và bấm trên màn hình. Ví dụ: “thứ gì khác hẳn xung quanh thì dễ được chú ý”, hay “càng nhiều lựa chọn thì càng lâu quyết định”."),
    p("Nhóm sẽ tìm hiểu 3 quy luật, rồi dùng chúng để <strong>“soi” một trang trên Limio</strong> — chính hệ thống các bạn đang học. Trang đó đã làm tốt chỗ nào, chưa tốt chỗ nào? Nếu chưa tốt thì sửa thế nào? Cách sửa được <strong>vẽ tay trên giấy</strong>. Sản phẩm cuối cùng là <strong>một bài thuyết trình 10 phút trước lớp</strong>."),
    aside("blue", "Một câu để nhớ",
        "<strong>Quy luật chỉ giúp ta đoán. Người dùng thật mới cho ta câu trả lời.</strong> Nói “Limio làm sai quy luật X” thì chưa đủ — phải hỏi người dùng xem họ có thật sự gặp khó ở đó không."),

    h2("Nhóm cần làm 5 việc", "nam-viec"),
    steps("pink", [
        ("1 · Tìm hiểu 3 quy luật", "Do giảng viên chia cho nhóm. Mỗi quy luật: nó nói gì? Ai tìm ra? Một ví dụ ngoài đời thường. Nó có luôn đúng không?"),
        ("2 · Chọn một trang Limio", "Một trang của sinh viên: tổng quan, bài học, nộp bài, làm bài kiểm tra, xem điểm và nhận xét, huy hiệu và bảng xếp hạng…"),
        ("3 · Soi trang đó", "Chụp màn hình, khoanh đỏ chỗ làm tốt và chỗ chưa tốt theo 3 quy luật. Viết ra điều nhóm đoán."),
    ]),
    steps("pink", [
        ("4 · Hỏi 5 bạn", "5 sinh viên, không phải thành viên nhóm, dùng thử trang đó. Điều nhóm đoán có đúng không?"),
        ("5 · Vẽ lại bằng giấy", "Vẽ 3–5 màn hình — đủ để người thử đi một mạch từ đầu tới cuối việc cần làm, và sửa đúng những chỗ đã tìm ra. Cho ít nhất 2 bạn bấm thử bản giấy."),
    ]),
    aside("teal", "Ví dụ cho việc 3 và 4",
        "Trên thẻ bài tập của Limio, nhãn “Chưa nộp” có màu xám nhạt — mờ nhất trong các nhãn, trong khi “Đã chấm” màu xanh lại nổi nhất. "
        "Theo quy luật <strong>Von Restorff</strong> (thứ khác hẳn xung quanh thì dễ được chú ý), nhóm đoán: <em>nhiều bạn không để ý mình còn bài chưa nộp</em>. "
        "Rồi nhóm nhờ 5 bạn tìm bài chưa nộp trong một bài học, xem các bạn ấy mất bao lâu và nhìn vào đâu trước. Đoán đúng hay sai đều được — miễn là trình bày đúng những gì thấy."),
    h3("Vẽ lại bằng giấy (paper prototype) như thế nào", "amber"),
    doit_figure,
    paper_steps,
    paper_photos,
    p("Chuẩn bị: giấy A4 hoặc bìa cứng, bút dạ, giấy note, kéo. Vẽ ở cỡ thật của điện thoại (khoảng 7 × 15 cm) để ngón tay “bấm” vừa.", small=True, muted=True),
    materials_photo,

    h2("Thuyết trình: 10 phút + 5 phút trả lời câu hỏi", "thuyet-trinh"),
    p("Gợi ý khoảng 8 slide:"),
    slides,
    aside("amber", "Mang bản giấy thật lên lớp",
        "Trong lúc thuyết trình, nhóm mời <strong>một bạn trong lớp lên “bấm thử”</strong> bản giấy khoảng 1 phút, một thành viên làm “máy tính”. "
        "Cả lớp sẽ thấy tận mắt bản vẽ của nhóm có dễ dùng không. Mọi thành viên đều phải nói trong buổi thuyết trình."),

    h2("Nộp gì, khi nào, chấm thế nào", "nop-cham"),
    p("Bài tập này <strong>nộp theo nhóm</strong> trên Limio. Hạn nộp: <strong>trước buổi thuyết trình</strong>, theo hạn ghi trên Limio."),
    team_steps,
    aside("blue", "Chưa có nhóm thì chưa nộp được",
        "Trang bài tập sẽ nhắc bạn vào nhóm trước. Khi giảng viên đã <strong>khoá danh sách nhóm</strong>, bạn không tự tạo, vào hay rời nhóm được nữa — cần đổi nhóm thì nhắn giảng viên."),
    h3("Bạn nộp cho nhóm điền những gì", "blue"),
    submit_table,
    template_box,
    aside("amber", "Limio không nhận file PowerPoint",
        "Ô tải tệp chỉ nhận PDF, ảnh, video, âm thanh. Xuất slide ra PDF trước khi nộp: "
        "PowerPoint — <em>File → Save As → PDF</em>; Google Slides — <em>Tệp → Tải xuống → PDF</em>; Canva — <em>Chia sẻ → Tải xuống → PDF</em>."),
    ul([
        "<strong>Lập nhóm xong</strong> thì giảng viên chia 3 quy luật cho từng nhóm.",
        "<strong>Hôm thuyết trình:</strong> mang theo bản giấy thật.",
    ]),
    rubric,

    h2("Lưu ý và câu hỏi thường gặp", "luu-y"),
    ul([
        "<strong>Chê Limio thoải mái, miễn là có lý do.</strong> Không ai bị trừ điểm vì chỉ ra chỗ chưa tốt của Limio.",
        "Không ghi tên thật của những bạn được hỏi. Chỉ chụp màn hình từ tài khoản của chính mình.",
        "Được dùng AI để tìm hiểu, nhưng <strong>không được bịa ra câu trả lời của người dùng</strong>.",
    ]),
    faq,
    sources([
        'Yablonski, J. <a href="https://lawsofux.com/">Laws of UX</a> — mỗi quy luật có phần “Origins” kể ai tìm ra và từ nghiên cứu nào.',
        'Nielsen, J. (2003). <a href="https://www.nngroup.com/articles/paper-prototyping/">Paper Prototyping: Getting User Data Before You Code</a>. Nielsen Norman Group.',
        'Nielsen Norman Group. <a href="https://www.nngroup.com/videos/paper-prototyping-101/">Paper Prototyping 101</a> (video ngắn) và <a href="https://www.nngroup.com/articles/paper-prototyping-cutout-kit/">Paper Prototyping: A Cutout Kit</a>.',
    ]),
)

open(__import__("sys").argv[1], "w").write(html)
