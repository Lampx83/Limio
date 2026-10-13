from kit import *

# Thực hành 3 — Module 7: khám nghiệm các màn hình thật của Limio bằng bốn câu hỏi của Bài 7.1–7.4.
# Trang sinh viên: KHÔNG ghi sẵn điều "nên phát hiện" (xem ../huong-dan-giang-vien-thuc-hanh-3.md).
# Nhãn giao diện chép đúng chữ trong app: "Tổng quan của tôi", "Cài đặt tài khoản", "BXH tuần này",
# "Chủ đề cần ôn", "Ẩn khỏi bảng xếp hạng".

four_questions = table("purple", ["Bài", "Câu hỏi cần hỏi", "Dấu hiệu làm sai"], [
    ["<strong>7.1</strong> Người dùng và động lực", "Màn hình này phục vụ ai, và nó làm người học mệt hay chỉ làm họ đỡ phải suy nghĩ?",
     "Báo cáo giờ online làm nhà trường hài lòng, nhưng lại dạy người học mở ứng dụng cho đủ giờ."],
    ["<strong>7.2</strong> Tải nhận thức", "Trên màn hình này, có điều gì không phục vụ mục tiêu của bài học?",
     "Slide đầy chữ và đọc lại y nguyên lời giảng, hoặc video dài 40 phút chạy một mạch."],
    ["<strong>7.3</strong> Dữ liệu người học", "Chỉ số này đo việc học hay chỉ đo sự có mặt, ai được xem nó, và nó được giữ trong bao lâu?",
     "Nhóm vui mừng vì thời gian trên trang tăng, trong khi điểm sau hai tuần không thay đổi."],
    ["<strong>7.4</strong> Bối cảnh Việt Nam", "Người học có làm được việc chính bằng một ngón cái, khi mạng yếu và trên máy cũ hay không?",
     "Sản phẩm chỉ được thử trên máy đời mới, ở nơi có mạng tốt."],
], big_cols=(0,))

roles = table("teal", ["Vai", "Việc", "Đổi vai"], [
    ["<strong>Người cầm máy</strong>", "Thao tác trên điện thoại và đọc to điều mình nhìn thấy.", "Đổi người sau mỗi trạm."],
    ["<strong>Người ghi phiếu</strong>", "Ghi <strong>nguyên văn</strong> chữ trên màn hình, thay vì ghi lại bằng lời của mình.", "Đổi người sau mỗi trạm."],
    ["<strong>Người chụp và bấm giờ</strong>", "Chụp màn hình cho mỗi phát hiện và báo thời gian còn lại.", "Đổi người sau mỗi trạm."],
], big_cols=(0,))

# ------------------------------------------------------------------ phiếu mẫu in ra
sheet = table("pink", ["Trạm", "Màn hình đã soi", "Phát hiện (kèm ảnh số …)", "Gắn với nguyên tắc nào", "Hại người học ra sao"], [
    ["7.1", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
    ["7.2", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
    ["7.3", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
    ["7.4", "&nbsp;", "&nbsp;", "&nbsp;", "&nbsp;"],
], pad="1.4rem .6rem")

# ------------------------------------------------------------------ Trạm 1
st1 = part("pink", "Trạm 1 — Màn hình này phục vụ ai? (Bài 7.1)", "25 phút", "".join([
    aside("blue", "Giảng viên nói trước · 8 phút",
          "Giảng viên sẽ trình bày ba nhóm người dùng (người học, giảng viên, nhà trường), ba nhu cầu nuôi dưỡng động lực "
          "(tự chủ, năng lực, kết nối) và khái niệm ma sát mong muốn."),
    h3("Mở màn hình", "pink"),
    ul([
        "Bấm vào ảnh đại diện ở góc trên và chọn <strong>Tổng quan của tôi</strong>. Quan sát các khối <em>Khóa đã đăng ký</em>, <em>Huy hiệu gần đây</em>, <em>Chủ đề cần ôn</em> và <em>BXH tuần này</em>.",
        "Sau đó bấm vào ảnh đại diện, chọn <strong>Cài đặt tài khoản</strong> và kéo xuống mục <em>Quyền riêng tư</em>.",
    ]),
    h3("Việc 1 — Phân loại từng khối (8 phút)", "pink"),
    p("Với mỗi khối trên Tổng quan, nhóm trả lời ba câu hỏi sau và ghi kết quả vào một bảng nháp kẻ trên giấy:"),
    ul([
        "Khối này được sinh ra chủ yếu cho <strong>ai</strong>: người học, giảng viên hay nhà trường?",
        "Khối này đáp ứng nhu cầu nào của người học: <strong>tự chủ</strong>, <strong>năng lực</strong>, <strong>kết nối</strong>, hay không đáp ứng nhu cầu nào?",
        "Người học <strong>làm được gì</strong> khi nhìn vào khối đó: có một việc cụ thể để bấm vào, hay chỉ để nhìn?",
    ], ordered=True),
    h3("Việc 2 — Giữ, sửa, hay bỏ (9 phút)", "pink"),
    ul([
        "Nhóm chọn <strong>một</strong> khối mà mình thấy đáng bàn nhất, xếp nó vào giữ, sửa hoặc bỏ, và nêu lý do gắn với một trong ba nhu cầu.",
        "Ở <em>Cài đặt tài khoản → Quyền riêng tư</em>, hãy làm đúng theo những gì màn hình mô tả để đổi cài đặt <strong>Ẩn khỏi bảng xếp hạng</strong>. "
        "<strong>Bạn không cần lưu thay đổi thật.</strong> Hãy ghi lại từng bước bạn phải bấm và đếm số bước.",
    ]),
    aside("amber", "Câu hỏi chốt trạm",
          "Cơ chế này đang dạy người học <strong>học</strong>, hay đang dạy họ <strong>mở ứng dụng</strong>? Nhóm trả lời bằng một câu và một bằng chứng lấy từ màn hình."),
]), open_=True)

# ------------------------------------------------------------------ Trạm 2
st2 = part("teal", "Trạm 2 — Cái gì không phục vụ mục tiêu bài? (Bài 7.2)", "25 phút", "".join([
    aside("blue", "Giảng viên nói trước · 8 phút",
          "Giảng viên sẽ trình bày về trí nhớ làm việc hẹp, ba loại tải nhận thức và sáu nguyên tắc: nhất quán, chỉ dấu, không trùng lặp, gần nhau, chia đoạn và kênh phối hợp."),
    h3("Mở màn hình", "teal"),
    ul([
        "Trên <strong>điện thoại</strong>, hãy mở khoá này và chọn <strong>Bài 7.4</strong> (hoặc một bài dài khác do giảng viên chỉ định).",
        "Chụp <strong>ba ảnh màn hình</strong>: một ảnh lúc bài vừa mở, và hai ảnh sau mỗi lần cuộn thêm một màn hình.",
    ]),
    h3("Việc 1 — Kiểm kê (10 phút)", "teal"),
    p("Trên ảnh đầu tiên, hãy <strong>đánh số mọi thứ không phải là nội dung bài</strong>, chẳng hạn dải nhãn nhỏ, thanh dính, nút bấm, màu tô theo mục, mục lục và biểu tượng. "
      "Với mỗi thứ, hãy chọn một trong ba mức sau:"),
    ul([
        "<strong>Giúp tôi đạt mục tiêu bài</strong>: nếu bỏ đi thì tôi khó học hơn.",
        "<strong>Chỉ đang ở đó</strong>: nếu bỏ đi thì tôi không mất gì.",
        "<strong>Không chắc</strong>: nếu nhóm không thống nhất thì ghi cả hai ý kiến.",
    ]),
    p("Sau đó tính xem khoảng bao nhiêu phần trăm số thứ đã đánh số thuộc mức “chỉ đang ở đó”. Con số này chỉ cần là một ước chừng có lý do."),
    h3("Việc 2 — Gọi tên (7 phút)", "teal"),
    ul([
        "Chọn <strong>hai</strong> chỗ và gọi tên chúng theo sáu nguyên tắc. Một trong hai chỗ phải là chỗ <strong>đang làm đúng</strong>, vì mục đích là nhận xét chứ không chỉ chê.",
        "Trả lời câu hỏi: bạn là người mới hay đã quen với chủ đề của bài này? Một người <strong>hoàn toàn mới</strong> sẽ thấy màn hình này khác bạn ở chỗ nào?",
    ], ordered=True),
    aside("amber", "Câu hỏi chốt trạm",
          "Nếu chỉ được bỏ <strong>đúng một</strong> thứ trên màn hình đầu tiên, bạn sẽ bỏ thứ gì, và người học nào được hưởng lợi nhiều nhất?"),
]))

# ------------------------------------------------------------------ Trạm 3
st3 = part("purple", "Trạm 3 — Đo học hay đo có mặt? (Bài 7.3)", "25 phút", "".join([
    aside("blue", "Giảng viên nói trước · 8 phút",
          "Giảng viên sẽ trình bày bốn loại chỉ số (tương tác, hành vi học, kết quả học, chủ quan), ba câu hỏi phải trả lời trước khi thu một trường dữ liệu, và Luật 91/2025/QH15."),
    h3("Mở màn hình", "purple"),
    ul([
        "Quay lại <strong>Tổng quan của tôi</strong>. Lần này hãy nhìn vào <strong>các con số và nhãn</strong>: XP, chuỗi ngày, huy hiệu, BXH và <em>Chủ đề cần ôn</em>.",
    ]),
    h3("Việc 1 — Xếp loại chỉ số (5 phút)", "purple"),
    p("Với mỗi con số hoặc nhãn bạn thấy, hãy xếp nó vào một trong bốn loại: <strong>tương tác</strong> (chỉ cho biết người học có mặt), <strong>hành vi học</strong>, <strong>kết quả học</strong> hoặc <strong>chủ quan</strong>. "
      "Sau đó trả lời: loại nào chiếm nhiều chỗ nhất trên màn hình, và loại nào gần với việc học thật nhất?"),
    h3("Việc 2 — Ba câu cho một trường dữ liệu (6 phút)", "purple"),
    p("Hãy chọn <strong>một</strong> thứ mà Limio có thể đang ghi lại về bạn (ví dụ: thời điểm mở bài, câu trả lời từng câu quiz, thời gian ở mỗi câu hoặc loại thiết bị) và trả lời ba câu hỏi sau:"),
    ul([
        "Dữ liệu này dùng để làm gì? (Nếu câu trả lời là “biết đâu sau này cần” thì hãy ghi đúng như vậy.)",
        "Ai được xem dữ liệu này: bạn, giảng viên hay nhà trường?",
        "Dữ liệu được giữ trong bao lâu và được xoá bằng cách nào?",
    ], ordered=True),
    p("Hãy trả lời bằng cách <strong>tìm trong chính sản phẩm</strong> chứ không đoán. Nếu không tìm thấy, hãy ghi: “đã tìm ở … và không thấy”.", small=True, muted=True),
    h3("Việc 3 — Đi tìm dữ liệu của mình (6 phút)", "purple"),
    p("Giả sử bạn muốn <strong>xem toàn bộ dữ liệu</strong> mà Limio đang giữ về mình, rồi <strong>tải về</strong> hoặc <strong>xoá</strong> chúng. "
      "Hãy đi tìm thật và ghi lại bạn bấm vào đâu, bấm mấy lần và dừng lại ở đâu. Nếu sau 5 phút vẫn chưa thấy thì hãy dừng lại và ghi lại các chỗ đã tìm."),
    aside("amber", "Câu hỏi chốt trạm",
          "Nếu bạn là một học sinh lớp 10 đọc màn hình này, bạn có biết dữ liệu của mình đang được dùng vào việc gì không?"),
]))

# ------------------------------------------------------------------ Trạm 4
st4 = part("amber", "Trạm 4 — Mất mạng giữa chừng thì sao? (Bài 7.4)", "25 phút", "".join([
    aside("blue", "Giảng viên nói trước · 8 phút",
          "Giảng viên sẽ trình bày ba ràng buộc: điện thoại là thiết bị chính, mạng chập chờn là chuyện bình thường, và thiết bị rất đa dạng. Sau đó nhóm vẽ ba trạng thái: mạng tốt, mạng chậm và mất mạng."),
    aside("amber", "Chỉ làm trên bài thử",
          "Giảng viên sẽ cho cả lớp biết tên <strong>quiz thử</strong> và <strong>đề thi thử</strong>. "
          "<strong>Tuyệt đối không</strong> làm thí nghiệm này trên bài kiểm tra thật."),
    h3("Thí nghiệm", "amber"),
    p("Mỗi nhóm có ít nhất hai điện thoại: <strong>một máy làm quiz thử</strong> và <strong>một máy làm đề thi thử</strong>, chạy song song. Cả hai máy thực hiện cùng các bước sau:"),
    ul([
        "Mở bài, <strong>chọn hoặc nhập câu trả lời cho 3 câu</strong>, rồi đọc xem màn hình đang hiển thị thông tin gì.",
        "Bật <strong>chế độ máy bay</strong> và làm tiếp 1–2 câu. Hãy <strong>ghi nguyên văn</strong> mọi dòng chữ xuất hiện (nếu có).",
        "Khi vẫn đang mất mạng, hãy thử <strong>chuyển sang câu khác</strong> và thử <strong>bấm Nộp bài</strong> (chỉ với quiz thử), rồi quan sát chuyện gì xảy ra.",
        "<strong>Tắt chế độ máy bay</strong> và kiểm tra xem câu trả lời của 3 câu đầu còn không, cũng như hệ thống có tự làm gì hay không.",
        "Nếu còn thời gian, hãy làm thêm một vòng nữa: chọn 2 câu, bật chế độ máy bay, <strong>đóng hẳn trình duyệt</strong>, bật mạng lại rồi mở lại bài, và kiểm tra xem hai câu đó còn không.",
    ], ordered=True),
    h3("Ghi lại", "amber"),
    table("amber", ["", "Quiz thử", "Đề thi thử"], [
        ["Khi mất mạng, màn hình nói gì? (nguyên văn)", "&nbsp;", "&nbsp;"],
        ["Câu trả lời đang nằm ở đâu: máy tôi, máy chủ, hay không ở đâu cả?", "&nbsp;", "&nbsp;"],
        ["Khi có mạng lại, hệ thống tự phục hồi hay người học phải làm lại?", "&nbsp;", "&nbsp;"],
        ["Trong trường hợp tệ nhất, người học mất gì?", "&nbsp;", "&nbsp;"],
    ], big_cols=(0,), pad="1.1rem .6rem"),
    aside("amber", "Câu hỏi chốt trạm",
          "Hai màn hình làm bài này nằm trong <strong>cùng một sản phẩm</strong>. Chúng có cư xử giống nhau khi mất mạng không? Nếu khác nhau, người học có được báo trước không?"),
]))

# ------------------------------------------------------------------ Phần 5
st5 = part("green", "Phần 5 — Chọn một việc sửa trước", "10 phút", "".join([
    p("Bốn trạm cho nhóm một danh sách các phát hiện. Nguồn lực thực tế luôn có hạn, nên đội thiết kế chỉ sửa được <strong>một việc đầu tiên</strong>. Nhóm chọn việc đó theo ba tiêu chí sau:"),
    table("green", ["Tiêu chí", "Hỏi gì"], [
        ["<strong>Số người học gặp</strong>", "Bao nhiêu phần trăm người học sẽ gặp chỗ này, và họ gặp mỗi ngày hay chỉ khi mạng yếu?"],
        ["<strong>Hậu quả</strong>", "Mất bài làm nghiêm trọng hơn mất thời gian, và mất thời gian nghiêm trọng hơn việc chỉ gây khó chịu. Điều mất đi mà không lấy lại được là nặng nhất."],
        ["<strong>Chi phí sửa</strong>", "Đổi một dòng chữ khác với việc dựng lại cách lưu bài. Một việc rẻ mà hậu quả vừa phải vẫn có thể được chọn trước."],
    ], big_cols=(0,)),
    h3("Sản phẩm của phần này", "green"),
    ul([
        "<strong>Một tờ giấy</strong> vẽ màn hình <em>trước</em> (phần có vấn đề, được vẽ lại) và <em>sau</em> (bản nhóm đề xuất), kèm chú thích đánh số.",
        "<strong>Một phút trình bày</strong> theo ba câu: “Chúng tôi thấy … (bằng chứng: ảnh số …). Điều đó gây hại cho người học vì … (vi phạm nguyên tắc nào). Chúng tôi sửa bằng cách … và chọn việc này trước vì …”",
    ]),
]))

deliver = summary_box("Sản phẩm nộp và cách chấm", "".join([
    check("<strong>Phiếu khám nghiệm</strong> gồm bảng 4 trạm bên dưới, trong đó mỗi hàng có ảnh chụp đánh số và nguyên văn chữ trên màn hình."),
    check("<strong>Bản giấy trước và sau</strong> của việc nhóm chọn sửa trước (chụp ảnh)."),
    check("Một thành viên nộp bài cho cả nhóm, và mỗi người ghi 1–2 câu ở mục <strong>“Phần việc của tôi”</strong>."),
    '<div style="height:.6rem"></div>',
    sheet,
    '<div style="height:.6rem"></div>',
    table("green", ["Tiêu chí", "Điểm"], [
        ["Mỗi trạm (×4): có ảnh, có nguyên văn, gọi đúng nguyên tắc, và phát hiện lấy từ <strong>thao tác thật</strong> chứ không đoán", "15 × 4 = 60"],
        ["Việc sửa trước: nêu được vì sao việc này đứng trước các việc khác", "15"],
        ["Bản giấy trước và sau sửa đúng chỗ đã khám nghiệm", "15"],
        ["Một phút trình bày rõ ràng và đúng giờ", "10"],
    ], big_cols=(0, 1)),
    p("<strong>Bài đạt khi</strong> mỗi phát hiện cho biết bạn đã làm gì trên máy, thấy gì (bằng nguyên văn hoặc ảnh), và vì sao điều đó gây hại hoặc có lợi cho người học.",
      small=True),
]))

refs = sources([
    'Richard E. Mayer (2021). <em>Multimedia Learning</em>, 3rd ed., Cambridge University Press. Đây là nguồn của sáu nguyên tắc ở Trạm 2.',
    'Edward L. Deci &amp; Richard M. Ryan. <a href="https://selfdeterminationtheory.org/theory/">Self-Determination Theory</a>. Trang này trình bày ba nhu cầu ở Trạm 1.',
    'Nielsen Norman Group. <a href="https://www.nngroup.com/articles/analytics-user-experience/">Analytics and User Experience</a>. Bài viết bàn về việc số liệu nói được điều gì và không nói được điều gì (Trạm 3).',
    'Nielsen Norman Group. <a href="https://www.nngroup.com/articles/response-times-3-important-limits/">Response Times: The 3 Important Limits</a>. Đây là nền tảng cho phần bàn về mạng chậm (Trạm 4).',
    'Quốc hội. <em>Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15</em> (hiệu lực 01/01/2026); hướng dẫn thi hành nằm ở Nghị định 356/2025/NĐ-CP (Trạm 3).',
    'CAST. <a href="https://udlguidelines.cast.org/">Universal Design for Learning Guidelines</a>.',
    'Tư liệu bài giảng của khoá học: Bài 7.1, 7.2, 7.3 và 7.4.',
])

html = page(
    chips("⏱ 120 phút", "👥 Nhóm 3–4 người", "📱 Ít nhất 2 điện thoại mỗi nhóm", "✏️ Giấy, bút"),
    h1("Bài thực hành 3 — Khám nghiệm một màn hình Limio", "pink"),
    p("Module 7 bàn về những điểm khác biệt của sản phẩm giáo dục: người dùng, trí nhớ làm việc, dữ liệu và bối cảnh Việt Nam. "
      "Hôm nay bạn không làm bài tập về một sản phẩm tưởng tượng. Bạn đang ngồi trong một sản phẩm giáo dục thật, và bạn sẽ <strong>khám nghiệm chính nó</strong>."),
    p("Mỗi trạm áp dụng một câu hỏi rút ra từ một bài học lên một màn hình có thật. Những điều bạn tìm ra sẽ là đầu vào cho đồ án, chứ không nhằm mục đích chê bai sản phẩm."),
    objectives([
        "Áp dụng được bốn câu hỏi của Module 7 lên một màn hình thật và ghi lại phát hiện kèm chứng cứ (ảnh chụp, nguyên văn).",
        "Phân biệt được chỉ số đo sự có mặt với chỉ số đo việc học, và thử được sản phẩm trong điều kiện mất mạng.",
        "Chọn và bảo vệ được một việc sửa trước, dựa trên số người gặp, hậu quả và chi phí.",
    ]),
    h2("Lịch trình 120 phút", "lich-trinh", "pink"),
    timeline([("pink", 10, "Khởi động"), ("pink", 25, "Trạm 1 · 7.1"), ("teal", 25, "Trạm 2 · 7.2"),
              ("purple", 25, "Trạm 3 · 7.3"), ("amber", 25, "Trạm 4 · 7.4"), ("green", 10, "Chọn việc sửa")]),
    p("Mỗi trạm gồm 8 phút giảng viên trình bày và 17 phút nhóm thực hành. Các trạm được mở lần lượt khi đến giờ.", small=True, muted=True),
    h2("Khởi động: bốn câu hỏi", "bon-cau-hoi", "purple"),
    four_questions,
    h3("Phân vai trong nhóm", "teal"),
    roles,
    h3("Chuẩn bị", "pink"),
    checklist([
        "Bạn đã <strong>đăng nhập Limio trên điện thoại</strong> và vào được khoá học này.",
        "Mỗi nhóm có ít nhất <strong>hai điện thoại</strong> đủ pin. Nhóm chỉ có một máy thì làm quiz thử trước và đề thi thử sau.",
        "Có giấy A4 và bút. Phiếu khám nghiệm ở cuối trang có thể được kẻ lại trên giấy.",
    ]),
    st1, st2, st3, st4, st5,
    deliver,
    refs,
)

open(__import__("sys").argv[1], "w").write(html)
