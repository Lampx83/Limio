from kit import *
from common import two_assignments, peer_table

# Thông số lấy thẳng từ mã nguồn Limio: apps/web/tailwind.config.ts, src/app/globals.css,
# src/components/ui/* và CLAUDE.md §4.6 / §4.6.1. Sửa ở đó thì sửa cả ở đây.
constraints = table("blue", ["Thứ phải bám", "Limio đang làm thế nào", "Học ở"], [
    ["<strong>Cỡ màn hình</strong>",
     "Dưới 640 px: một cột, nút hành động chính dính ở đáy màn hình. Từ 640: bắt đầu lưới 2 cột. Từ 1024: thanh bên hiện ra và nút hành động chuyển vào thanh bên; dưới 1024 thanh bên thu thành ngăn kéo. Thiết kế ở hai khung: <strong>375</strong> và <strong>1440</strong>.",
     "Bài 5.1"],
    ["<strong>Thang chữ</strong>",
     "Bảy bậc, không dùng cỡ tuỳ tiện cho tiêu đề. Điện thoại → máy tính: Tiêu đề lớn 36 → 48 · H1 30 → 36 · H2 24 → 30 · H3 20 → 24 · H4 18 · Nội dung 16 · Chữ phụ 14 · Chú thích 12. Phông Inter.",
     "Bài 5.3"],
    ["<strong>Màu</strong>",
     "Màu thương hiệu xanh mạ <code>#65A30D</code> cho nút chính; màu nhấn hổ phách <code>#F59E0B</code>; bốn màu nghĩa: thành công, cảnh báo, thông tin, nguy hiểm. Limio có <strong>chế độ tối</strong> — màu nào cũng phải có cặp sáng/tối.",
     "Bài 5.2"],
    ["<strong>Khối dùng chung</strong>",
     "Ô trống (khi chưa có dữ liệu), nhãn trạng thái (7 sắc thái), ngày giờ, ảnh đại diện, nút hành động dính đáy cho điện thoại, khung xương khi đang tải. <strong>Đã có khối thì dùng lại</strong>; muốn thêm khối mới phải nói được vì sao khối cũ không đủ.",
     "Bài 4.3, 5.3"],
    ["<strong>Thông báo</strong>",
     "Thành công và thông tin: có khung nền nhạt. Cảnh báo và lỗi: chữ đỏ, không khung.",
     "Bài 5.2"],
    ["<strong>Thuật ngữ</strong>",
     "Một khái niệm chỉ có một tên trên giao diện: <em>Đề thi</em>; <em>Đợt thi › Ca thi › Phòng thi</em>; <em>Lượt thi</em>; <em>Thí sinh</em> (vào bằng mã) khác <em>Học viên</em> (vào bằng tài khoản); <em>Ngân hàng câu hỏi</em>. Không trộn Anh – Việt.",
     "Bài 3.1"],
], big_cols=(0,))

milestones = table("blue", ["Mốc", "Khi nào", "Nộp gì", "Nằm ở page", "Tên phiên bản"], [
    ["<strong>1</strong>", "Sau Module 5",
     "Mở rộng bản giấy giữa kỳ thành cả luồng 5–8 màn hình; kiểm kê giao diện Limio; bộ hệ thống thiết kế mini (màu, chữ, khoảng cách, ít nhất 5 component có variant); giao diện hoàn chỉnh bản điện thoại, sáng và tối",
     "02 Hệ thống thiết kế · 03 Giao diện", "Mốc 1 – Xong giao diện"],
    ["<strong>2</strong>", "Sau Bài 6.2",
     "Prototype bấm được trọn luồng; kiểm thử với 5 sinh viên đang dùng Limio; đánh giá theo heuristic do một nhóm khác làm; bản sửa trước/sau; bản máy tính 1440",
     "03 Giao diện · 04 Kiểm thử", "Mốc 2 – Xong kiểm thử"],
    ["<strong>3</strong>", "Cuối học phần (sau Module 7)",
     "Đặc tả bàn giao và kế hoạch đo lường",
     "05 Bàn giao", "Mốc 3 – Bàn giao"],
    ["<strong>Bảo vệ</strong>", "Tuần cuối kỳ", "Trình bày 12 phút, trả lời 5 phút", "06 Bản nộp cuối kỳ", "Bảo vệ cuối kỳ"],
], big_cols=(0,))

handoff = table("amber", ["Mục", "Viết gì"], [
    ["<strong>Trạng thái</strong>", "Mỗi màn hình đủ năm trạng thái: bình thường · <strong>rỗng</strong> (chưa có gì) · <strong>đang tải</strong> · <strong>lỗi</strong> (mất mạng, nộp thất bại) · <strong>nội dung dài bất thường</strong> (tên bài hai dòng, 40 bài tập)."],
    ["<strong>Cỡ màn hình</strong>", "Bản 375 và bản 1440; ghi rõ cái gì thay đổi khi qua mốc 1024."],
    ["<strong>Chữ hiển thị</strong>", "Mọi nhãn nút, thông báo, câu báo lỗi đã chốt câu chữ — lập trình viên không phải tự nghĩ."],
    ["<strong>Tương tác</strong>", "Bấm vào đâu thì đi đâu; cái gì xảy ra trong lúc chờ."],
    ["<strong>Khả năng tiếp cận</strong>", "Tương phản đã đo (ghi con số), vùng chạm từ 44 px, thứ tự di chuyển bằng phím Tab."],
    ["<strong>Đo lường</strong>", "1–2 sự kiện cần ghi lại + 1 chỉ số về <strong>kết quả học</strong> — xem khung bên dưới."],
], big_cols=(0,))

rubric = table("green", ["Tiêu chí", "Điểm", "Đạt tốt khi", "Chưa đạt khi"], [
    ["Bố cục và thứ bậc thị giác", "15", "Nhìn một giây biết việc chính của màn hình là gì; lưới và khoảng cách nhất quán ở cả hai cỡ màn hình", "Mọi thứ cùng độ nổi; bản máy tính chỉ là bản điện thoại kéo giãn"],
    ["Màu, tương phản, khả năng tiếp cận", "15", "Mọi cặp chữ/nền đạt WCAG AA, có số đo; bản tối dùng được; vùng chạm đủ lớn", "Đo bằng mắt; chữ phụ mờ dưới ngưỡng; quên chế độ tối"],
    ["Hệ thống thiết kế, bám Limio", "15", "Dùng đúng thang chữ, màu, khối có sẵn, thuật ngữ của Limio; thay đổi nào cũng có lý do", "Tự đặt màu, cỡ chữ mới không giải thích; vẽ lại khối Limio đã có"],
    ["Kiểm thử và sửa", "20", "5 sinh viên đang dùng Limio; nhận và xử lý đánh giá heuristic của nhóm bạn; trước/sau rõ ràng", "Thử với người trong nhóm; bỏ qua góp ý heuristic không trả lời"],
    ["Đặc thù sản phẩm giáo dục", "15", "Chỉ ra được thiết kế giúp <strong>học</strong> tốt hơn ra sao (động lực – Bài 7.1, tải nhận thức – Bài 7.2), không chỉ giúp bấm nhiều hơn", "Thước đo duy nhất là “sinh viên dùng nhiều hơn”"],
    ["Bàn giao và đo lường", "10", "Đủ năm trạng thái, hai cỡ màn hình; sự kiện đặt tên đúng quy ước; có chỉ số kết quả học", "Chỉ có màn hình đẹp ở trạng thái bình thường"],
    ["Cách làm việc nhóm", "10", "File gọn, đủ page; đủ phiên bản theo mốc 1–3; bình luận đã xử lý", "Không có phiên bản theo mốc; bình luận bỏ ngỏ"],
], big_cols=(0, 1))

faq = "".join([
    reveal("teal", "Được đề xuất thay đổi chính hệ thống thiết kế của Limio không?", aside("teal", "Trả lời",
        "Được — và đó là việc nhà thiết kế thật vẫn làm. Ví dụ: chữ phụ của Limio (#949EB2 trên nền trắng) chỉ đạt 2,69 : 1. "
        "Muốn đổi thì phải (1) chỉ ra vấn đề bằng số đo hoặc bằng chứng người dùng, (2) đề xuất giá trị mới, (3) kiểm lại mọi chỗ đang dùng giá trị cũ. "
        "Điều không được làm là lặng lẽ dùng một màu khác.")),
    reveal("teal", "Lấy thông số của Limio ở đâu?", aside("teal", "Trả lời",
        "Bảng “Ràng buộc của Limio” ở trên là điểm xuất phát. Phần còn lại tự kiểm kê: chụp màn hình, gom các nút, nhãn, thẻ giống nhau vào một chỗ. "
        "Muốn biết đúng mã màu của một chữ: trên trình duyệt máy tính, bấm chuột phải vào chữ đó → <em>Inspect</em> (Kiểm tra) → xem mục <em>color</em>.")),
    reveal("teal", "Kiểm thử với 5 người có được dùng lại người đã được hỏi ở giữa kỳ không?", aside("teal", "Trả lời",
        "Tối đa 2 người. Người đã nghe nhóm kể về vấn đề thì không còn nhìn thiết kế bằng con mắt mới — ít nhất 3 người phải là người mới.")),
    reveal("teal", "Đánh giá theo heuristic chéo làm thế nào?", aside("teal", "Trả lời",
        "Giảng viên ghép cặp các nhóm. Nhóm đánh giá dùng 10 nguyên tắc và thang mức 0–4 như ở Thực hành 1 và Bài 6.2, ghi thành bình luận mở đầu bằng <strong>[Heuristic]</strong> ngay trên page 03 của nhóm bạn. "
        "Nhóm được đánh giá phải xử lý hoặc trả lời từng bình luận.")),
    reveal("teal", "Kết quả giữa kỳ cho thấy nhóm đi sai hướng thì sao?", aside("teal", "Trả lời",
        "Không đổi trang Limio, nhưng được thu hẹp hoặc chuyển hướng cách sửa — miễn là ghi rõ lý do ở page 06. Phát hiện mình sai bằng dữ liệu là một kết quả tốt, không phải một thất bại.")),
    reveal("teal", "Có được dùng AI không?", aside("teal", "Trả lời",
        "Được dùng để sinh nội dung mẫu (tên bài, đoạn văn giả) hay soát câu chữ — ghi rõ đã dùng ở đâu. <strong>Không</strong> được dùng AI tạo ra kết quả kiểm thử hay lời người dùng.")),
])

html = page(
    chips("👥 Cùng nhóm, cùng trang Limio", "📱 Điện thoại + 💻 máy tính", "📅 3 mốc + 1 buổi bảo vệ", "💯 Thang 100 điểm"),
    h1("Bài tập nhóm 2 · Cuối kỳ — Đưa thiết kế vào Limio", "blue"),
    two_assignments(current=2),
    objectives([
        "Hoàn thiện được giao diện bám đúng hệ thống thiết kế có sẵn của một sản phẩm thật.",
        "Kiểm chứng được thiết kế bằng kiểm thử với 5 người và đánh giá theo heuristic từ một nhóm khác.",
        "Bàn giao được thiết kế cho lập trình: đủ trạng thái, đủ cỡ màn hình, có kế hoạch đo lường.",
    ]),
    h2("Nhiệm vụ", "nhiem-vu"),
    p("Ở giữa kỳ, nhóm đã tìm ra chỗ chưa tốt trên một trang Limio, hỏi người dùng thật và vẽ lại bằng giấy. Cuối kỳ, nhóm đưa bản giấy đó <strong>lên Figma</strong> và biến nó thành thứ <strong>một lập trình viên của Limio cầm lên làm được ngay</strong>."),
    p("Điều khác hẳn so với giữa kỳ: bản giấy được vẽ tự do, còn bản cuối kỳ phải nằm <strong>bên trong một hệ thống đã có</strong> — màu đã chọn, cỡ chữ đã định, những khối giao diện người khác đã dựng. Nhà thiết kế ngoài đời hiếm khi được bắt đầu từ con số không; thiết kế mới phải đứng cạnh các trang cũ mà không lạc tông."),
    aside("teal", "Bắt đầu từ đâu",
        "Từ bản giấy giữa kỳ, kết quả các bạn bấm thử, và những câu hỏi, góp ý nhận được hôm thuyết trình — đã chép vào page 01 của file nhóm. Bản giấy có 3–5 màn hình: việc đầu tiên là soát xem nó đã phủ <strong>cả luồng</strong> chưa — người học đi từ đâu tới đâu, còn thiếu màn hình nào (lỗi, chưa có dữ liệu, đã xong). Màn hình còn thiếu thì phác bằng giấy trước, rồi mới dựng trên Figma."),
    h2("Ràng buộc của Limio", "rang-buoc"),
    p("Đây là hệ thống thiết kế Limio đang dùng, lấy thẳng từ mã nguồn. Thiết kế cuối kỳ phải bám theo — hoặc đề xuất thay đổi có lý do (xem câu hỏi thường gặp)."),
    constraints,
    aside("amber", "Một ví dụ ngay trong Limio",
        "Thẻ bài tập bạn dựng lại ở Thực hành 2 ghi “Assignment · max 10đ” — trái với chính quy tắc thuật ngữ trong bảng trên. Hệ thống thiết kế có quy tắc không có nghĩa là sản phẩm đã theo đúng. Tìm ra những chỗ lệch như vậy trong luồng của nhóm là một phần của bài."),
    h2("Ba mốc nộp và buổi bảo vệ", "moc-nop"),
    p("Làm trên file “Nhóm … – Hồ sơ thiết kế” đã dựng ở Thực hành 2 (Bài 2.5). Page 01 chứa những gì mang sang từ giữa kỳ; ba mốc dưới đây lần lượt điền page 02 tới 06."),
    milestones,
    h3("Đặc tả bàn giao gồm gì", "blue"),
    handoff,
    aside("purple", "Đo lường: tương tác không phải là học",
        "Limio ghi lại mọi hành vi học dưới dạng sự kiện, đặt tên theo khuôn <code>&lt;lĩnh vực&gt;.&lt;đối tượng&gt;.&lt;động từ quá khứ&gt;</code>. "
        "Ví dụ có thật: <code>feedback.remediation.clicked</code> — người học có bấm vào gợi ý ôn lại sau khi nhận phản hồi hay không. "
        "Nhưng bấm vào chưa phải là học được. Ví dụ với trang xem điểm và nhận xét, chỉ số kết quả học có thể là: <em>lần làm lại câu cùng chủ đề, tỉ lệ đúng có tăng không?</em> "
        "Mỗi nhóm đề xuất 1–2 sự kiện (ghi rõ mỗi sự kiện trả lời câu hỏi nào) và <strong>một</strong> chỉ số kết quả học như vậy (Bài 7.3)."),
    h3("Page 06: case study cuối kỳ", "blue"),
    p("Năm phần: <strong>vấn đề</strong> (trang Limio nào, sinh viên gặp khó gì) · <strong>bằng chứng</strong> (từ giữa kỳ và từ kiểm thử) · <strong>quyết định</strong> · <strong>thử và sửa</strong> · <strong>điều còn chưa biết</strong>. Phần “Quyết định” phải nói rõ thiết kế này <strong>bám hệ thống của Limio ở đâu, lệch ở đâu và vì sao</strong>. Đây là bản nhóm có thể đưa vào hồ sơ xin việc."),
    h2("Cách chấm", "cach-cham"),
    rubric,
    aside("purple", "Điểm cá nhân",
        "Điểm của mỗi người bằng điểm nhóm, điều chỉnh tối đa <strong>±2 điểm (thang 10)</strong> theo lịch sử phiên bản, bình luận trong file Figma và phiếu đánh giá chéo bên dưới. Phiếu nộp riêng, chỉ giảng viên đọc."),
    h3("Phiếu đánh giá chéo trong nhóm", "purple"),
    p("Chấm cả chính mình. Cột cuối là bắt buộc: không ghi được một việc cụ thể thì điểm đóng góp tối đa là 2.", small=True, muted=True),
    peer_table(),
    h2("Câu hỏi thường gặp", "cau-hoi"),
    faq,
    sources([
        'Frost, B. (2013). <a href="https://bradfrost.com/blog/post/interface-inventory/">Interface Inventory</a> — cách kiểm kê giao diện của một sản phẩm có sẵn.',
        'Fessenden, T. (2021). <a href="https://www.nngroup.com/articles/design-systems-101/">Design Systems 101</a>. Nielsen Norman Group.',
        'W3C. <a href="https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html">Understanding Success Criterion 1.4.3: Contrast (Minimum)</a>.',
        'Nielsen, J. (1994). <a href="https://www.nngroup.com/articles/ten-usability-heuristics/">10 Usability Heuristics for User Interface Design</a>. Nielsen Norman Group.',
        'Moran, K. (2019). <a href="https://www.nngroup.com/articles/usability-testing-101/">Usability Testing 101</a>. Nielsen Norman Group.',
        'Figma Learn. <a href="https://help.figma.com/hc/en-us/articles/360056440594-Create-and-use-variants">Create and use variants</a> và <a href="https://help.figma.com/hc/en-us/articles/15023124644247-Guide-to-Dev-Mode">Guide to Dev Mode</a> — dựng component và bàn giao từ Figma.',
    ]),
)

open(__import__("sys").argv[1], "w").write(html)
