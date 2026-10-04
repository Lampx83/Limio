# -*- coding: utf-8 -*-
"""Phần khung của khoá Phương pháp nghiên cứu & Viết luận văn: mô tả, danh
sách lỗi tư duy, lời phản hồi.

Khoá gồm 1 module, 6 bài, dành cho **học viên cao học** đang làm luận văn —
khác với khoá Nhập môn NCKH (SV đại học, NCKH lần đầu). Đi từ câu hỏi nghiên
cứu đã có sẵn (thường đã được giao hoặc tự chọn với giảng viên hướng dẫn) tới
bản luận văn hoàn chỉnh sẵn sàng bảo vệ: khung lý thuyết → tổng quan tài liệu
hệ thống → thiết kế nghiên cứu (định lượng/định tính/hỗn hợp ở mức cao hơn NCKH
SV) → thu thập và xử lý dữ liệu → viết luận văn 5 chương → đạo đức nghiên cứu.

Danh sách lỗi tư duy dưới đây lớn dần theo từng bài được soạn. Mã đặt tiền tố
`ppnc.` để không đụng mã của khoá khác trong cùng DB (Nhập môn NCKH dùng
`nckh.`, Kỹ năng mềm dùng `knm.`).
"""

COURSE = {
    "title": "NCKH 201 · Phương pháp nghiên cứu & Viết luận văn",
    "slug": "phuong-phap-nghien-cuu",
    "description": (
        "Khoá dành cho học viên cao học đang làm luận văn — đã có đề tài (do tự chọn hoặc được "
        "giao cùng giảng viên hướng dẫn), cần đưa đề tài đó qua trọn quy trình tới bản luận văn "
        "hoàn chỉnh sẵn sàng bảo vệ. Sáu bài đi đúng trình tự: dựng khung lý thuyết từ câu hỏi "
        "nghiên cứu; làm tổng quan tài liệu có hệ thống, không chỉ đọc rời rạc như ở NCKH sinh "
        "viên; chọn thiết kế nghiên cứu ở mức học thuật cao hơn — SEM/PLS-SEM cho định lượng, "
        "case study và phỏng vấn sâu cho định tính; thu thập và xử lý dữ liệu với SPSS/R (độ tin "
        "cậy, EFA, hồi quy); viết đúng cấu trúc luận văn 5 chương; và đạo đức nghiên cứu với dữ "
        "liệu người tham gia. "
        "Khoá dùng đúng đề tài luận văn thật của từng học viên xuyên suốt cả 6 bài — sản phẩm mỗi "
        "bài (khung lý thuyết, ma trận tổng quan, bảng hỏi, một chương luận văn) là bản dùng lại "
        "được ngay cho luận văn thật, không phải bài tập minh hoạ. Mỗi bài kết bằng một bài kiểm "
        "tra ngắn, phương án sai gắn mã lỗi tư duy để phản hồi chỉ đúng chỗ hiểu nhầm."
    ),
    "language": "vi",
    "level": "intermediate",
    "category": "Nghiên cứu khoa học",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Bài 1 · Từ câu hỏi nghiên cứu đến khung lý thuyết ────────────────────
    {
        "code": "ppnc.gap-is-my-interest",
        "name": "Coi khoảng trống là điều mình thấy thú vị, chưa xác nhận bằng tổng quan",
        "description": (
            "Khẳng định 'chưa ai nghiên cứu điều này' chỉ vì thấy chủ đề thú vị và chưa tìm thấy "
            "trong vài phút tìm kiếm, không dựa trên một tổng quan tài liệu có hệ thống. Ở mức "
            "luận văn, khoảng trống chỉ đứng được sau khi đã tìm và đọc một khối lượng tài liệu đủ "
            "rộng qua nhiều nguồn."
        ),
    },
    {
        "code": "ppnc.framework-is-diagram-only",
        "name": "Coi khung lý thuyết chỉ là một sơ đồ đẹp",
        "description": (
            "Dựng một sơ đồ hộp-và-mũi-tên cho khung lý thuyết mà không kèm đoạn giải thích cơ chế "
            "— tại sao biến này ảnh hưởng biến kia, qua kênh nào, dựa trên lý thuyết hoặc lập luận "
            "nào. Sơ đồ không kèm giải thích chỉ là hình trang trí, không phải một khung lý thuyết."
        ),
    },
    {
        "code": "ppnc.hypothesis-not-testable",
        "name": "Viết giả thuyết không đo được hoặc không thể bị bác bỏ",
        "description": (
            "Viết giả thuyết dạng niềm tin chung ('công nghệ luôn tốt cho việc học') không nêu "
            "biến cụ thể và không có kết quả dữ liệu nào có thể chứng minh nó sai. Giả thuyết "
            "nghiên cứu phải đo được và có thể bị bác bỏ bằng dữ liệu."
        ),
    },
    {
        "code": "ppnc.theory-borrowed-blindly",
        "name": "Mượn lý thuyết có sẵn mà không kiểm tra giả định có còn đúng",
        "description": (
            "Áp một lý thuyết (TAM, UTAUT, TPB...) vào bối cảnh nghiên cứu mới mà không giải thích "
            "lý thuyết đó giả định gì và liệu giả định đó còn đúng trong bối cảnh của mình không. "
            "Mượn lý thuyết đúng cách cần kiểm tra và điều chỉnh biến nếu bối cảnh khác với nơi lý "
            "thuyết được xây dựng ban đầu."
        ),
    },
    # ── Bài 3 · Thiết kế nghiên cứu ──────────────────────────────────────────
    {
        "code": "ppnc.regression-instead-of-sem",
        "name": "Chạy nhiều hồi quy riêng lẻ thay vì SEM cho mô hình có trung gian/điều tiết",
        "description": (
            "Kiểm định một khung lý thuyết có nhiều biến trung gian hoặc điều tiết bằng cách chạy "
            "từng hồi quy tuyến tính riêng lẻ cho mỗi đường dẫn. Cách này làm mất mối liên hệ giữa "
            "các đường dẫn trong toàn mô hình và tích lũy sai số qua từng bước ước lượng — SEM/"
            "PLS-SEM ước lượng toàn bộ mô hình đường dẫn cùng một lúc."
        ),
    },
    {
        "code": "ppnc.skip-measurement-model",
        "name": "Đọc mô hình cấu trúc trước khi kiểm mô hình đo",
        "description": (
            "Đọc kết quả path coefficient của mô hình cấu trúc trong PLS-SEM mà chưa kiểm độ tin "
            "cậy và độ giá trị của mô hình đo. Nếu thang đo chưa đạt tiêu chuẩn, các hệ số đường "
            "dẫn được tính từ dữ liệu không đáng tin, bất kể p-value nhỏ tới đâu."
        ),
    },
    {
        "code": "ppnc.fixed-sample-qualitative",
        "name": "Cố định cỡ mẫu định tính trước khi thu thập dữ liệu",
        "description": (
            "Quyết định trước một số cụ thể người tham gia phỏng vấn hoặc số ca nghiên cứu mà "
            "không dựa trên tiêu chí nào. Cỡ mẫu định tính nên được quyết định bởi bão hòa dữ liệu "
            "— điểm mà thu thập thêm không còn sinh ra thông tin mới — không phải một con số cố "
            "định từ trước."
        ),
    },
    {
        "code": "ppnc.mixed-is-just-both",
        "name": "Coi thiết kế hỗn hợp là làm cả hai phương pháp tách biệt",
        "description": (
            "Thực hiện cả khảo sát định lượng và phỏng vấn định tính nhưng trình bày hai phần kết "
            "quả cạnh nhau, không có chiến lược tích hợp cụ thể. Thiết kế hỗn hợp đúng nghĩa cần "
            "nói rõ kết quả định tính giải thích, xác nhận hoặc mở rộng kết quả định lượng ở điểm "
            "nào cụ thể."
        ),
    },
    # ── Bài 4 · Thu thập và xử lý dữ liệu ────────────────────────────────────
    {
        "code": "ppnc.skip-data-cleaning",
        "name": "Chạy phân tích chính mà không làm sạch dữ liệu trước",
        "description": (
            "Nhập dữ liệu xong chạy thẳng phân tích chính mà không kiểm dữ liệu thiếu, outlier, "
            "hoặc item đảo hướng. Phần mềm thống kê không tự phát hiện dữ liệu nhiễu — nó vẫn cho "
            "ra kết quả, nhưng kết quả đó tính trên dữ liệu chưa được làm sạch nên không đáng tin."
        ),
    },
    {
        "code": "ppnc.alpha-only-no-structure",
        "name": "Coi Cronbach's Alpha cao là đủ để khẳng định cấu trúc thang đo đúng",
        "description": (
            "Chỉ chạy Cronbach's Alpha và coi Alpha đạt ngưỡng là đủ chứng minh các item đo đúng "
            "cùng một cấu trúc nhân tố. Alpha chỉ đo tương quan nội bộ; cần EFA (hoặc CFA) để kiểm "
            "các item có thật sự load đúng vào cấu trúc như thiết kế, đặc biệt với thang đo mới "
            "hoặc đã điều chỉnh."
        ),
    },
    {
        "code": "ppnc.significant-equals-important",
        "name": "Nhầm ý nghĩa thống kê với ý nghĩa thực tế",
        "description": (
            "Kết luận một mối quan hệ 'có ảnh hưởng đáng kể' chỉ vì p < 0.05, không nhìn vào độ "
            "lớn của hệ số (effect size). Với mẫu đủ lớn, một hệ số rất nhỏ vẫn có thể đạt ý nghĩa "
            "thống kê mà không có ý nghĩa gì đáng chú ý trong thực tế."
        ),
    },
    {
        "code": "ppnc.one-coder-only",
        "name": "Một người mã hóa toàn bộ dữ liệu định tính không kiểm chứng",
        "description": (
            "Tự mã hóa hết dữ liệu phỏng vấn hoặc case study một mình, không có người thứ hai mã "
            "hóa độc lập để so sánh. Không có gì đảm bảo mã hóa đó không bị ảnh hưởng bởi kỳ vọng "
            "chủ quan có sẵn của người mã hóa duy nhất."
        ),
    },
    # ── Bài 5 · Viết luận văn và chuẩn bị bảo vệ ─────────────────────────────
    {
        "code": "ppnc.chapter1-written-once",
        "name": "Không sửa lại Chương 1 sau khi có kết quả",
        "description": (
            "Coi Chương 1 (mục tiêu, câu hỏi nghiên cứu) là viết một lần rồi để nguyên tới lúc "
            "nộp. Kết quả thật thường không khớp hoàn toàn với dự định ban đầu; Chương 1 cần được "
            "sửa lại sau khi hoàn thành Chương 4-5 để khớp với nội dung thật của luận văn."
        ),
    },
    {
        "code": "ppnc.discussion-repeats-results",
        "name": "Chương 5 chỉ lặp lại số liệu của Chương 4",
        "description": (
            "Viết Chương 5 (thảo luận, kết luận) bằng cách liệt kê lại các số liệu đã trình bày ở "
            "Chương 4 mà không thêm diễn giải ý nghĩa. Chương 5 phải giải thích kết quả đó đóng "
            "góp gì về lý thuyết và thực tiễn, không phải chỗ nhắc lại số liệu."
        ),
    },
    {
        "code": "ppnc.limitations-generic",
        "name": "Viết phần hạn chế chung chung, không nêu ảnh hưởng cụ thể",
        "description": (
            "Viết hạn chế bằng công thức chung như 'do thời gian và nguồn lực hạn chế' mà không "
            "nêu nó ảnh hưởng tới kết luận nào cụ thể. Hạn chế dùng được phải chỉ ra chính xác nó "
            "làm giảm giá trị của kết luận nào — khả năng khái quát hóa, chiều nhân quả, độ chính "
            "xác của một construct."
        ),
    },
    {
        "code": "ppnc.cross-sectional-causal-claim",
        "name": "Diễn giải nhân quả từ dữ liệu cắt ngang",
        "description": (
            "Viết kết quả path coefficient có ý nghĩa thống kê từ dữ liệu cắt ngang (thu thập một "
            "lần) như một quan hệ nhân quả ('X dẫn tới Y'). Dữ liệu cắt ngang không xác lập được "
            "trình tự thời gian, nên chỉ có thể khẳng định hai biến có liên hệ với nhau, không thể "
            "khẳng định chiều tác động."
        ),
    },
    # ── Bài 6 · Đạo đức nghiên cứu với dữ liệu người tham gia ────────────────
    {
        "code": "ppnc.ethics-is-paperwork",
        "name": "Coi đạo đức nghiên cứu là thủ tục giấy tờ",
        "description": (
            "Hiểu đạo đức nghiên cứu chỉ là các form cần điền để được phép thu thập dữ liệu, không "
            "phải trách nhiệm thật bảo vệ người tham gia khỏi tổn hại thể chất, tâm lý, xã hội và "
            "kinh tế."
        ),
    },
    {
        "code": "ppnc.consent-implied-by-participation",
        "name": "Coi việc tham gia là đã đồng ý, không cần thông tin đầy đủ trước",
        "description": (
            "Cho rằng người tham gia điền khảo sát là đã 'đồng ý', dù chưa được cung cấp đầy đủ "
            "thông tin về mục đích, rủi ro, và quyền rút khỏi nghiên cứu trước đó — nhất là khi "
            "khảo sát chạm tới chủ đề nhạy cảm."
        ),
    },
    {
        "code": "ppnc.anonymize-confuse-confidential",
        "name": "Nhầm ẩn danh với bảo mật",
        "description": (
            "Tuyên bố dữ liệu 'ẩn danh hoàn toàn' trong khi vẫn giữ thông tin hoặc tổ hợp đặc điểm "
            "có thể truy ngược ra một cá nhân cụ thể. Ẩn danh nghĩa là không ai truy ngược được "
            "danh tính; nếu nhà nghiên cứu vẫn biết và chỉ giữ kín, đó là bảo mật, không phải ẩn "
            "danh."
        ),
    },
    {
        "code": "ppnc.skip-ethics-review-informal",
        "name": "Nghĩ nghiên cứu quy mô nhỏ trong trường không cần xem xét đạo đức",
        "description": (
            "Cho rằng một khảo sát trong trường tự động được miễn yêu cầu đạo đức vì quy mô nhỏ "
            "hoặc bối cảnh học thuật. Dữ liệu nhạy cảm hoặc đối tượng dễ bị tổn thương vẫn cần "
            "được xem xét qua hội đồng đạo đức hoặc quy trình tương đương, bất kể quy mô nghiên "
            "cứu."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "ppnc.gap-is-my-interest",
        "body": (
            "Trước khi viết 'chưa ai nghiên cứu điều này', hãy tự hỏi: mình đã tìm ở nguồn nào "
            "(Google Scholar, Scopus, cơ sở dữ liệu chuyên ngành), và đã đọc đủ sâu để loại trừ các "
            "nghiên cứu gần giống chưa? Khoảng trống cần một tổng quan có hệ thống đứng sau nó, "
            "không phải một cảm giác."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.framework-is-diagram-only",
        "body": (
            "Thêm một đoạn văn giải thích cơ chế đi kèm sơ đồ: tại sao biến này ảnh hưởng biến kia, "
            "qua kênh nào, dựa trên lý thuyết hoặc lập luận nào. Nếu bỏ sơ đồ đi mà đoạn văn vẫn "
            "giải thích được đầy đủ, khung của bạn đang đứng vững; nếu không có đoạn văn nào để bỏ, "
            "sơ đồ chưa phải một khung lý thuyết."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.hypothesis-not-testable",
        "body": (
            "Viết lại giả thuyết với biến cụ thể và mối quan hệ đo được — thử hỏi: kết quả dữ liệu "
            "nào sẽ khiến giả thuyết này sai? Nếu không tưởng tượng được kết quả nào bác bỏ được "
            "nó, giả thuyết chưa đủ cụ thể."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.theory-borrowed-blindly",
        "body": (
            "Trước khi dùng lý thuyết này, viết ra: lý thuyết được xây cho loại đối tượng/bối cảnh "
            "nào, và bối cảnh của bạn khác gì. Nếu có khác biệt, giải thích rõ bạn điều chỉnh biến "
            "nào và vì sao — đừng áp thẳng nguyên bản gốc."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.regression-instead-of-sem",
        "body": (
            "Nếu khung lý thuyết của bạn có biến trung gian hoặc điều tiết, hãy chuyển sang SEM/"
            "PLS-SEM để ước lượng toàn bộ mô hình đường dẫn cùng lúc, thay vì chạy từng hồi quy "
            "riêng lẻ cho mỗi đường dẫn."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.skip-measurement-model",
        "body": (
            "Trước khi đọc path coefficient, kiểm lại độ tin cậy (Cronbach's Alpha, Composite "
            "Reliability) và độ giá trị (AVE, HTMT) của từng construct. Chỉ đọc kết quả mô hình "
            "cấu trúc sau khi mô hình đo đã đạt tiêu chuẩn."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.fixed-sample-qualitative",
        "body": (
            "Thay vì chốt trước một số cụ thể, theo dõi bão hòa dữ liệu trong quá trình thu thập: "
            "khi hai, ba người tham gia gần nhất không còn mang lại chủ đề mới, đó là điểm để dừng "
            "— ghi lại rõ điều này trong phần phương pháp."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.mixed-is-just-both",
        "body": (
            "Viết rõ một câu về chiến lược tích hợp: kết quả định tính của bạn giải thích, xác "
            "nhận hay mở rộng điều gì cụ thể từ kết quả định lượng? Nếu không trả lời được câu "
            "này, hai phần đang đứng tách biệt, chưa phải một thiết kế hỗn hợp."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.skip-data-cleaning",
        "body": (
            "Trước khi chạy phân tích chính, xem thống kê mô tả (min, max, mean, số dòng thiếu) "
            "cho từng biến. Một giá trị bất thường hoặc tỉ lệ thiếu cao thường lộ ra ngay ở bước "
            "này, trước khi nó làm sai kết quả phân tích phía sau."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.alpha-only-no-structure",
        "body": (
            "Chạy thêm EFA (nhìn vào ma trận factor loading) bên cạnh Cronbach's Alpha, đặc biệt "
            "nếu thang đo đã dịch hoặc điều chỉnh. Alpha cao không loại trừ khả năng các item đang "
            "tách thành nhiều nhân tố khác nhau."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.significant-equals-important",
        "body": (
            "Khi viết kết luận, luôn nêu cả p-value và độ lớn hệ số (beta, R²) trong cùng một câu, "
            "và tự hỏi: hệ số này có đủ lớn để đáng chú ý trong thực tế không, hay chỉ đạt p < 0.05 "
            "vì cỡ mẫu lớn?"
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.one-coder-only",
        "body": (
            "Mời một người thứ hai mã hóa độc lập một phần dữ liệu (ví dụ 20-30%), rồi so sánh "
            "nhãn với nhau. Chỗ hai người mã hóa khác nhau chính là nơi cần làm rõ định nghĩa mã, "
            "không phải điều nên bỏ qua."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.chapter1-written-once",
        "body": (
            "Sau khi hoàn thành Chương 4-5, đọc lại mục tiêu và câu hỏi ở Chương 1: chúng còn khớp "
            "với những gì luận văn thực sự trả lời được không? Nếu một giả thuyết không được ủng "
            "hộ hoặc có phát hiện ngoài dự kiến, sửa lại Chương 1 để phản ánh đúng nội dung thật."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.discussion-repeats-results",
        "body": (
            "Với mỗi số liệu ở Chương 4 được nhắc lại ở Chương 5, thêm một câu diễn giải: kết quả "
            "này đóng góp gì cho khung lý thuyết, hoặc ai nên làm gì khác đi vì kết quả này? Nếu "
            "không thêm được câu đó, đoạn văn đang lặp lại, chưa phải thảo luận."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.limitations-generic",
        "body": (
            "Viết lại mỗi hạn chế theo mẫu: 'Hạn chế X khiến kết luận Y không thể khẳng định được "
            "ở mức Z.' Nếu không điền được cả ba phần, hạn chế đang viết còn quá chung để hội đồng "
            "đánh giá."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.cross-sectional-causal-claim",
        "body": (
            "Với dữ liệu thu thập một lần, đổi mọi câu 'X dẫn tới/gây ra Y' thành 'X có liên hệ "
            "với Y', và thêm một câu ghi rõ thiết kế cắt ngang không xác lập được chiều tác động."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.ethics-is-paperwork",
        "body": (
            "Trước khi soạn form, tự hỏi: người tham gia nghiên cứu này có thể gặp tổn hại gì — "
            "tâm lý, xã hội, kinh tế? Thiết kế biện pháp bảo vệ cho đúng loại tổn hại đó, rồi mới "
            "viết form phản ánh các biện pháp đó, không phải ngược lại."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.consent-implied-by-participation",
        "body": (
            "Hiển thị đầy đủ thông tin về mục đích, rủi ro và quyền rút khỏi nghiên cứu **trước** "
            "câu hỏi đầu tiên, không phải sau. Với chủ đề nhạy cảm, người tham gia cần biết trước "
            "để quyết định có tiếp tục hay không."
        ),
        "priority": 10,
    },
    {
        "misconception": "ppnc.anonymize-confuse-confidential",
        "body": (
            "Kiểm lại: dữ liệu của bạn có giữ thông tin nào (email, số điện thoại, tổ hợp đặc điểm "
            "hiếm) có thể truy ngược ra một cá nhân không? Nếu có, gọi đúng tên là bảo mật, không "
            "phải ẩn danh, và nói rõ với người tham gia."
        ),
        "priority": 9,
    },
    {
        "misconception": "ppnc.skip-ethics-review-informal",
        "body": (
            "Hỏi giảng viên hướng dẫn hoặc khoa về yêu cầu đạo đức trước khi thu thập dữ liệu, đặc "
            "biệt nếu nghiên cứu chạm tới dữ liệu nhạy cảm hoặc đối tượng dễ bị tổn thương — quy mô "
            "nhỏ không tự động miễn trừ yêu cầu này."
        ),
        "priority": 9,
    },
]
