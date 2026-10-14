# -*- coding: utf-8 -*-
"""Phần khung của khoá Xử lý & Phân tích dữ liệu nghiên cứu: mô tả, danh sách
lỗi tư duy, lời phản hồi.

Khoá gồm 1 module, nhiều bài, dùng chung cho **học viên cao học và nghiên cứu
sinh** — khác các khoá kia ở chỗ đây là khoá **thực hành công cụ trên dữ liệu
thật** (Excel/SPSS/R, một bộ dữ liệu mẫu xuyên suốt có lỗi thật cần tìm), chứ
không dạy lại "khi nào dùng phương pháp nào" — phần đó đã có ở khoá Phương
pháp nghiên cứu (`ppnc.`) và NCKH nâng cao (`cbqt.`).

Danh sách lỗi tư duy dưới đây lớn dần theo từng bài được soạn. Mã đặt tiền tố
`xldl.` để không đụng mã của khoá khác trong cùng DB.
"""

COURSE = {
    "title": "NCKH 401 · Xử lý & Phân tích dữ liệu nghiên cứu",
    "slug": "xu-ly-du-lieu-nghien-cuu",
    "description": (
        "Khoá thực hành dùng chung cho học viên cao học và nghiên cứu sinh — khác các khoá kỹ "
        "năng nghiên cứu khác ở chỗ đây không dạy lại 'khi nào dùng phương pháp nào' (đã có ở "
        "khoá Phương pháp nghiên cứu và NCKH nâng cao), mà đưa tay vào thực hành trên một bộ dữ "
        "liệu khảo sát mẫu có lỗi thật, xuyên suốt cả khoá: làm sạch dữ liệu bằng công thức cụ "
        "thể (Excel/R); đọc đúng bảng kết quả thống kê mô tả và kiểm định giả thuyết; đọc đúng "
        "bảng EFA và độ tin cậy; mã hoá dữ liệu định tính và tính độ tin cậy giữa người mã hoá "
        "bằng tay; và trực quan hoá dữ liệu đúng cách kèm đóng gói để tái lập kết quả. "
        "Mỗi bài đưa ra số liệu, công thức và output thật để người học tự tay tính hoặc đọc, "
        "không chỉ đọc lý thuyết. Mỗi bài kết bằng một bài kiểm tra ngắn, phương án sai gắn mã "
        "lỗi tư duy để phản hồi chỉ đúng chỗ hiểu nhầm."
    ),
    "language": "vi",
    "level": "intermediate",
    "category": "Nghiên cứu khoa học",
    "personalizationEnabled": True,
}

MISCONCEPTIONS = [
    # ── Bài 1 · Làm sạch một bộ dữ liệu khảo sát thật ────────────────────────
    {
        "code": "xldl.duplicate-not-checked",
        "name": "Không kiểm tra dòng trùng lặp trước khi phân tích",
        "description": (
            "Không kiểm ID trùng lặp trước khi tính điểm trung bình construct hoặc chạy kiểm định. "
            "Dòng trùng lặp không bị phần mềm thống kê tự động cảnh báo, và khiến một người có "
            "trọng số gấp đôi trong mọi phép tính sau đó."
        ),
    },
    {
        "code": "xldl.out-of-range-not-caught",
        "name": "Không kiểm giá trị ngoài khoảng hợp lệ trước khi phân tích",
        "description": (
            "Để nguyên giá trị ngoài khoảng hợp lệ của thang đo (ví dụ nhập 7 cho thang Likert "
            "1-5) chạy thẳng vào phân tích. Đây luôn là lỗi nhập liệu cần xử lý, không phải dữ "
            "liệu thật cần giữ nguyên."
        ),
    },
    {
        "code": "xldl.straight-lining-ignored",
        "name": "Không phát hiện câu trả lời straight-lining",
        "description": (
            "Không kiểm độ lệch chuẩn giữa các item của cùng một người trong một construct, nên "
            "không phát hiện được người chọn cùng một giá trị cho mọi câu — dấu hiệu không đọc kỹ "
            "câu hỏi, cần được xem xét trước khi tính vào phân tích."
        ),
    },
    {
        "code": "xldl.reverse-code-formula-wrong",
        "name": "Dùng sai công thức đảo hướng item",
        "description": (
            "Dùng công thức đảo hướng sai (ví dụ chỉ lấy giá trị lớn nhất trừ giá trị gốc, bỏ qua "
            "giá trị nhỏ nhất) hoặc quên đảo hướng hoàn toàn trước khi tính điểm construct. Công "
            "thức đúng là (giá trị lớn nhất + giá trị nhỏ nhất) − giá trị gốc."
        ),
    },
    # ── Bài 2 · Thống kê mô tả và kiểm định giả thuyết ───────────────────────
    {
        "code": "xldl.mean-without-sd",
        "name": "Báo cáo Mean mà không kèm SD hoặc N",
        "description": (
            "Báo cáo giá trị trung bình mà không kèm độ lệch chuẩn hoặc cỡ mẫu. Người đọc không "
            "đánh giá được độ phân tán của dữ liệu quanh giá trị trung bình hay độ tin cậy của "
            "số liệu dựa trên cỡ mẫu."
        ),
    },
    {
        "code": "xldl.ignore-levenes-test",
        "name": "Đọc bảng t-test mà không kiểm Levene's test trước",
        "description": (
            "Đọc thẳng dòng kết quả t-test (thường là dòng đầu tiên) mà không kiểm Levene's test "
            "để biết chọn dòng 'Equal variances assumed' hay 'not assumed'. Hai dòng cho kết quả "
            "t, df và Sig. khác nhau, chọn sai dòng có thể đổi kết luận."
        ),
    },
    {
        "code": "xldl.anova-significant-no-posthoc",
        "name": "Kết luận nhóm nào khác nhóm nào chỉ từ ANOVA, không chạy post-hoc",
        "description": (
            "Thấy ANOVA có ý nghĩa thống kê (p < 0.05) rồi kết luận ngay nhóm nào cao hơn/thấp hơn "
            "nhóm nào mà không chạy kiểm định post-hoc. ANOVA chỉ cho biết có ít nhất một cặp khác "
            "nhau, không cho biết cặp nào."
        ),
    },
    {
        "code": "xldl.chisquare-small-expected-count",
        "name": "Tin vào Pearson Chi-Square dù expected count quá nhỏ",
        "description": (
            "Bỏ qua cảnh báo về expected count dưới 5 ở nhiều ô trong bảng chéo và vẫn báo cáo "
            "kết quả Pearson Chi-Square như bình thường. Khi vi phạm điều kiện này, cần chuyển "
            "sang Fisher's Exact Test."
        ),
    },
    # ── Bài 3 · Đọc bảng EFA và độ tin cậy ────────────────────────────────────
    {
        "code": "xldl.efa-skip-kmo-bartlett",
        "name": "Đọc factor loading mà không kiểm KMO/Bartlett's trước",
        "description": (
            "Chạy EFA và đọc thẳng ma trận factor loading mà không kiểm KMO và Bartlett's Test "
            "trước để xác nhận dữ liệu đủ tương quan và phù hợp cho phân tích nhân tố có ý nghĩa."
        ),
    },
    {
        "code": "xldl.wrong-factor-count",
        "name": "Chọn sai số lượng nhân tố cần trích xuất",
        "description": (
            "Không áp dụng quy tắc Kaiser (eigenvalue > 1) hoặc bỏ qua đối chiếu với lý thuyết nền "
            "khi quyết định số nhân tố trích xuất — giữ hoặc bỏ nhân tố tuỳ tiện, làm sai lệch "
            "toàn bộ ma trận loading đọc sau đó."
        ),
    },
    {
        "code": "xldl.keep-crossloading-item",
        "name": "Giữ nguyên item cross-loading trong cấu trúc construct",
        "description": (
            "Giữ một item load cao ở nhiều nhân tố (cross-loading) trong cấu trúc construct mà "
            "không xem xét loại bỏ hoặc viết lại. Item cross-loading không đo rõ một khái niệm "
            "duy nhất và làm mờ cấu trúc đo lường."
        ),
    },
    {
        "code": "xldl.alpha-not-recalculated",
        "name": "Không tính lại Cronbach's Alpha sau khi điều chỉnh cấu trúc theo EFA",
        "description": (
            "Báo cáo Cronbach's Alpha tính trên bộ item ban đầu (trước khi loại item có vấn đề "
            "theo EFA) mà không tính lại cho cấu trúc construct đã điều chỉnh. Con số Alpha ban "
            "đầu không còn phản ánh đúng cấu trúc sẽ thực sự dùng trong phân tích."
        ),
    },
    # ── Bài 4 · Mã hóa dữ liệu định tính và độ tin cậy giữa người mã hóa ─────
    {
        "code": "xldl.code-too-abstract-early",
        "name": "Trừu tượng hóa mã ngay từ open coding",
        "description": (
            "Gán nhãn trừu tượng, mang tính lý thuyết ngay từ bước open coding, thay vì mô tả cụ "
            "thể bám sát điều người tham gia thực sự nói. Trừu tượng hóa quá sớm làm mất chi tiết "
            "và sắc thái của dữ liệu gốc, không lấy lại được sau đó."
        ),
    },
    {
        "code": "xldl.agreement-percent-not-kappa",
        "name": "Chỉ báo cáo tỉ lệ đồng thuận thô, không tính Cohen's Kappa",
        "description": (
            "Báo cáo tỉ lệ phần trăm hai người mã hóa chọn giống nhau mà không tính thêm Cohen's "
            "Kappa. Tỉ lệ đồng thuận thô không trừ đi phần đồng thuận có thể xảy ra do ngẫu nhiên, "
            "nên có thể bị thổi phồng so với mức đồng thuận thật."
        ),
    },
    {
        "code": "xldl.kappa-low-ignored",
        "name": "Bỏ qua Kappa thấp và tiếp tục mã hóa như không có gì xảy ra",
        "description": (
            "Ghi nhận một giá trị Kappa thấp (dưới 0.4) vào báo cáo rồi tiếp tục mã hóa phần còn "
            "lại của dữ liệu mà không thảo luận lại định nghĩa mã. Kappa thấp là dấu hiệu cần hai "
            "người mã hóa làm rõ định nghĩa trước khi tiếp tục."
        ),
    },
    # ── Bài 5 · Trực quan hóa dữ liệu và đóng gói để tái lập kết quả ─────────
    {
        "code": "xldl.pie-chart-too-many-slices",
        "name": "Dùng biểu đồ tròn cho quá nhiều phần",
        "description": (
            "Dùng biểu đồ tròn để thể hiện tỉ lệ khi có nhiều hơn 5-6 phần (ví dụ 9-10 nhóm). Mắt "
            "người không phân biệt tốt góc của các hình quạt gần bằng nhau — biểu đồ cột dễ so "
            "sánh hơn nhiều khi có nhiều nhóm."
        ),
    },
    {
        "code": "xldl.truncated-yaxis-bar-chart",
        "name": "Trục y bị cắt trên biểu đồ cột",
        "description": (
            "Vẽ biểu đồ cột với trục y không bắt đầu từ 0, làm sự khác biệt nhỏ giữa các nhóm "
            "trông lớn hơn nhiều so với thực tế. Biểu đồ cột nên luôn bắt đầu trục y từ 0."
        ),
    },
    {
        "code": "xldl.dual-axis-misleading",
        "name": "Dùng biểu đồ hai trục y gây hiểu sai về tương quan",
        "description": (
            "Vẽ hai đường với hai thang đo khác nhau trên cùng một biểu đồ, chọn tỉ lệ hai trục "
            "sao cho hai đường trông giống hình dạng nhau. Điều này dễ khiến người xem ngộ nhận "
            "có mối tương quan mạnh trong khi mối tương quan thật có thể rất yếu."
        ),
    },
    {
        "code": "xldl.no-readme-reproducibility",
        "name": "Không lưu script và codebook để tái lập kết quả",
        "description": (
            "Chỉ lưu lại file dữ liệu cuối cùng và bảng kết quả, không lưu script phân tích hay "
            "codebook giải thích từng biến. Không ai, kể cả chính người phân tích sau này, tái "
            "lập lại được chính xác quy trình đã làm."
        ),
    },
]

FEEDBACK_TEMPLATES = [
    {
        "misconception": "xldl.duplicate-not-checked",
        "body": (
            "Trước khi tính bất kỳ điểm trung bình hay kiểm định nào, chạy một bước kiểm ID trùng "
            "lặp (COUNTIF hoặc duplicated()). Xoá bớt dòng trùng khi xác nhận đó là lỗi nhập liệu, "
            "không phải hai người khác nhau vô tình cùng mã."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.out-of-range-not-caught",
        "body": (
            "Chạy một bước kiểm khoảng giá trị hợp lệ cho mỗi biến (min/max của thang đo) trước "
            "khi phân tích. Giá trị ngoài khoảng luôn cần xử lý — sửa lại nếu suy ra được giá trị "
            "đúng, hoặc đặt thành thiếu."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.straight-lining-ignored",
        "body": (
            "Tính độ lệch chuẩn giữa các item trong cùng construct cho từng người. SD = 0 hoặc rất "
            "thấp là dấu hiệu cần xem xét kỹ, đặc biệt nếu xảy ra trên toàn bộ các construct của "
            "khảo sát."
        ),
        "priority": 9,
    },
    {
        "misconception": "xldl.reverse-code-formula-wrong",
        "body": (
            "Dùng đúng công thức (giá trị lớn nhất + giá trị nhỏ nhất) − giá trị gốc. Kiểm bằng "
            "tay 1-2 dòng đầu: sau khi đảo, item đã đảo và các item cùng construct nên có xu "
            "hướng cùng chiều với nhau."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.mean-without-sd",
        "body": (
            "Luôn báo cáo Mean kèm SD và N trong cùng một câu: 'Mean = X (SD = Y, N = Z)'. Không "
            "để một con số Mean đứng riêng không có ngữ cảnh."
        ),
        "priority": 9,
    },
    {
        "misconception": "xldl.ignore-levenes-test",
        "body": (
            "Trước khi đọc t/df/Sig., nhìn sang cột Sig. của Levene's test. Sig. > 0.05 thì đọc "
            "dòng 'Equal variances assumed'; Sig. ≤ 0.05 thì đọc dòng 'not assumed'."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.anova-significant-no-posthoc",
        "body": (
            "Sau khi thấy ANOVA có ý nghĩa, luôn chạy thêm post-hoc test (Tukey HSD hoặc "
            "Games-Howell) trước khi viết bất kỳ câu nào về việc nhóm nào khác nhóm nào."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.chisquare-small-expected-count",
        "body": (
            "Đọc dòng cảnh báo dưới bảng Chi-Square Tests trước khi tin vào Sig. Nếu có cảnh báo "
            "về expected count thấp, chuyển sang đọc kết quả Fisher's Exact Test thay vì Pearson "
            "Chi-Square."
        ),
        "priority": 9,
    },
    {
        "misconception": "xldl.efa-skip-kmo-bartlett",
        "body": (
            "Trước khi mở bảng factor loading, luôn nhìn bảng KMO and Bartlett's Test. KMO dưới "
            "0.6 hoặc Bartlett's Sig. ≥ 0.05 là dấu hiệu dừng lại, không nên tin vào loading."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.wrong-factor-count",
        "body": (
            "Nhìn bảng Total Variance Explained, giữ lại nhân tố có eigenvalue > 1 (quy tắc "
            "Kaiser). Khi eigenvalue của nhân tố kế tiếp gần sát 1, đối chiếu thêm với scree plot "
            "và số construct dự kiến theo lý thuyết trước khi quyết định."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.keep-crossloading-item",
        "body": (
            "Với item cross-loading, xem lại nội dung câu hỏi — có đang hỏi lẫn hai khái niệm "
            "không? Cân nhắc loại item hoặc viết lại và thu thập lại dữ liệu thí điểm trước khi "
            "dùng cho nghiên cứu chính thức."
        ),
        "priority": 9,
    },
    {
        "misconception": "xldl.alpha-not-recalculated",
        "body": (
            "Sau mỗi lần loại hoặc thay đổi item dựa trên EFA, chạy lại Cronbach's Alpha ngay cho "
            "cấu trúc mới. Con số Alpha báo cáo trong bài phải khớp với đúng danh sách item cuối "
            "cùng sẽ dùng."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.code-too-abstract-early",
        "body": (
            "Khi gán nhãn, tự hỏi: nhãn này có bám sát đúng từ ngữ và ý người tham gia dùng "
            "không, hay đã thêm diễn giải của riêng bạn? Giữ mã mô tả cụ thể ở vòng đầu, để việc "
            "trừu tượng hóa diễn ra có chủ đích ở bước axial coding."
        ),
        "priority": 9,
    },
    {
        "misconception": "xldl.agreement-percent-not-kappa",
        "body": (
            "Luôn tính thêm Cohen's Kappa bên cạnh tỉ lệ đồng thuận thô. Nếu một nhóm chiếm đa số "
            "trong dữ liệu, tỉ lệ đồng thuận thô có thể cao giả tạo — Kappa mới cho biết mức đồng "
            "thuận thật sau khi trừ phần ngẫu nhiên."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.kappa-low-ignored",
        "body": (
            "Khi Kappa dưới 0.4, dừng lại và cùng người mã hóa thứ hai xem lại từng đoạn hai "
            "người mã khác nhau, thống nhất lại ranh giới định nghĩa của mỗi mã, trước khi mã hóa "
            "tiếp."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.pie-chart-too-many-slices",
        "body": (
            "Với hơn 5-6 phần, đổi sang biểu đồ cột và sắp xếp theo giá trị giảm dần — dễ so sánh "
            "hơn nhiều so với các hình quạt gần bằng nhau trên biểu đồ tròn."
        ),
        "priority": 9,
    },
    {
        "misconception": "xldl.truncated-yaxis-bar-chart",
        "body": (
            "Đặt lại trục y bắt đầu từ 0 cho mọi biểu đồ cột. Nếu khác biệt trông quá nhỏ khi vẽ "
            "đủ trục, đó là phản ánh đúng thực tế, không phải lý do để cắt trục."
        ),
        "priority": 10,
    },
    {
        "misconception": "xldl.dual-axis-misleading",
        "body": (
            "Tách thành hai biểu đồ riêng đặt cạnh nhau, hoặc chuẩn hóa hai biến về cùng thang "
            "(z-score) trước khi vẽ chung một trục — tránh để phần mềm tự chọn tỉ lệ hai trục y "
            "khác nhau."
        ),
        "priority": 9,
    },
    {
        "misconception": "xldl.no-readme-reproducibility",
        "body": (
            "Lưu đủ ba phần cùng nhau: dữ liệu (thô và đã làm sạch), script/cú pháp đã chạy, và "
            "một codebook ngắn giải thích từng biến — làm ngay khi phân tích, không để dồn lại "
            "viết sau."
        ),
        "priority": 10,
    },
]
