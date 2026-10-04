# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4 · Thu thập và xử lý dữ liệu",
    "durationMin": 100,
    "description": "Làm sạch và mã hóa dữ liệu trước khi phân tích; chạy Cronbach's Alpha và EFA đúng thứ tự để kiểm cấu trúc thang đo; diễn giải hồi quy/PLS-SEM đúng, không nhầm ý nghĩa thống kê với ý nghĩa thực tế; mã hóa dữ liệu định tính có kiểm độ tin cậy giữa người code.",
    "objectives": [
        "Làm sạch và mã hóa một bộ dữ liệu khảo sát trước khi phân tích: xử lý thiếu, outlier, item đảo hướng",
        "Chạy và diễn giải đúng Cronbach's Alpha và EFA để kiểm cấu trúc nhân tố của thang đo trước khi kiểm định giả thuyết",
        "Diễn giải hệ số hồi quy/path coefficient đúng, phân biệt ý nghĩa thống kê (p-value) với ý nghĩa thực tế (effect size)",
        "Mã hóa dữ liệu định tính theo quy trình có kiểm độ tin cậy giữa người code, không chỉ một người code chủ quan",
    ],
    "summary": [
        "Dữ liệu phải được làm sạch (thiếu, outlier, item đảo hướng) và mã hóa theo một codebook cố định trước khi chạy bất kỳ phân tích nào — bỏ qua bước này khiến kết quả sau đó không đáng tin dù kỹ thuật thống kê có đúng.",
        "Cronbach's Alpha cao chỉ cho biết các item có tương quan nội bộ, không đảm bảo chúng đo đúng cấu trúc nhân tố như thiết kế — EFA (hoặc CFA) cần chạy để kiểm cấu trúc đó, đặc biệt với thang đo mới hoặc đã điều chỉnh.",
        "Ý nghĩa thống kê (p < 0.05) và ý nghĩa thực tế là hai việc khác nhau: với mẫu đủ lớn, một hệ số rất nhỏ vẫn có thể đạt p < 0.05 mà không có nghĩa hiệu ứng đó quan trọng trong thực tế.",
        "Dữ liệu định tính cần quy trình mã hóa có kiểm độ tin cậy giữa người code (ít nhất hai người code độc lập rồi so sánh) — một người code hết dữ liệu một mình dễ chủ quan mà không ai kiểm chứng được.",
    ],
    "splitSections": True,
    "body": r"""
Thiết kế đã chọn ở Bài 3 quyết định công cụ; bài này là lúc dữ liệu thật (hoặc dữ liệu thí điểm) bắt đầu chạy qua các công cụ đó — và là lúc các lỗi thầm lặng nhất thường xảy ra, vì phần mềm luôn cho ra một kết quả, đúng hay sai. Bài đi qua bốn phần: trước hết làm sạch và mã hóa dữ liệu (thiếu, outlier, item đảo hướng) trước khi phân tích; sau đó chạy Cronbach's Alpha và EFA đúng thứ tự để kiểm cấu trúc thang đo trước khi tin vào nó; tiếp theo diễn giải hệ số hồi quy/path coefficient đúng, phân biệt ý nghĩa thống kê với ý nghĩa thực tế; và kết bằng quy trình mã hóa dữ liệu định tính có kiểm độ tin cậy giữa người code.

## Chuẩn bị dữ liệu trước khi phân tích

Trước khi mở SPSS hoặc R để chạy bất kỳ kiểm định nào, dữ liệu cần qua ba bước làm sạch.

> [!ghi-nho] **Xử lý dữ liệu thiếu (missing data):** nếu tỉ lệ thiếu thấp (dưới 5% và ngẫu nhiên), loại bỏ theo dòng (listwise deletion) là chấp nhận được; nếu cao hơn, cần phương pháp thay thế (imputation) và phải báo cáo rõ cách xử lý. **Kiểm outlier:** giá trị bất thường có thể do lỗi nhập liệu (ví dụ điểm 15 trên thang 5) hoặc do người trả lời không nghiêm túc (trả lời giống nhau cho mọi câu) — cả hai cần được xử lý trước khi phân tích. **Item đảo hướng (reverse-coded):** một số câu hỏi Likert được viết theo hướng ngược (ví dụ 'Tôi không thấy công cụ này hữu ích') cần đảo điểm lại trước khi tính điểm tổng của construct.

> [!canh-bao] Nhập dữ liệu xong chạy thẳng phân tích mà không kiểm ba bước trên là lỗi thầm lặng nhất trong xử lý dữ liệu: phần mềm không báo lỗi gì, vẫn cho ra kết quả — nhưng kết quả đó tính trên dữ liệu có nhiễu. Luôn kiểm tra bằng thống kê mô tả (min, max, mean, số dòng thiếu) cho từng biến trước khi chạy phân tích chính.

## Cronbach's Alpha và EFA — kiểm cấu trúc trước khi tin thang đo

Cronbach's Alpha cao **không đảm bảo** thang đo đo đúng cấu trúc nhân tố như thiết kế ban đầu — nó chỉ cho biết các item có tương quan nội bộ với nhau.

> [!ghi-nho] **Cronbach's Alpha** (≥ 0.7 là ngưỡng thường dùng) đo độ tin cậy nội bộ — các item trong cùng một construct có nhất quán với nhau không. **EFA (Exploratory Factor Analysis)** kiểm xem các item có thật sự nhóm lại (load) đúng vào các nhân tố như bạn thiết kế không — cần chạy khi dùng thang đo mới, đã dịch, hoặc đã điều chỉnh so với bản gốc, trước khi tin vào cấu trúc đó cho các phân tích tiếp theo (hồi quy, SEM).

| Tình huống | Có cần chạy EFA không |
|---|---|
| Thang đo gốc đã được validate nhiều lần, dùng nguyên văn, đúng bối cảnh gốc | Có thể bỏ qua EFA, chỉ cần kiểm Alpha |
| Thang đo đã dịch sang tiếng Việt hoặc điều chỉnh từ ngữ | Nên chạy EFA để xác nhận cấu trúc nhân tố còn giữ nguyên sau khi dịch/điều chỉnh |
| Thang đo tự phát triển hoặc kết hợp item từ nhiều nguồn khác nhau | Bắt buộc chạy EFA trước khi tin vào cấu trúc construct |

> [!canh-bao] Alpha = 0.85 cho một construct 5 item không chứng minh được cả 5 item đang đo cùng một khái niệm duy nhất — có thể 3 item load vào một nhân tố và 2 item còn lại load vào một nhân tố khác mà Alpha tổng vẫn cao. Chỉ EFA (nhìn vào ma trận hệ số tải factor loading) mới phát hiện được điều này.

> [!vi-du] Một học viên dịch thang đo "sự hài lòng với công cụ AI học tập" từ tiếng Anh sang tiếng Việt, 6 item, Alpha = 0.81 — đạt ngưỡng. Chạy EFA phát hiện 2 item liên quan tới "tốc độ phản hồi của công cụ" tách thành một nhân tố riêng, không load cùng 4 item còn lại (về "chất lượng nội dung phản hồi"). Học viên tách construct ban đầu thành hai construct riêng: "hài lòng về tốc độ" và "hài lòng về nội dung" — một phát hiện mà chỉ nhìn Alpha sẽ bỏ lỡ.

## Từ thang đo đạt tới diễn giải kết quả kiểm định

Sau khi thang đo đạt (Alpha, EFA/CFA như đã học), kết quả hồi quy hoặc path coefficient (PLS-SEM, Bài 3) mới đáng đọc — nhưng đọc đúng cũng cần phân biệt hai loại ý nghĩa.

> [!ghi-nho] **Ý nghĩa thống kê** (p < 0.05) cho biết mối quan hệ quan sát được khó xảy ra do ngẫu nhiên. **Ý nghĩa thực tế** (effect size — hệ số beta, R², Cohen's d) cho biết mối quan hệ đó **lớn tới đâu** trong thực tế. Hai điều này độc lập với nhau: với mẫu đủ lớn, một hệ số beta = 0.08 (rất nhỏ) vẫn có thể đạt p < 0.05.

| Kết quả | Ý nghĩa thống kê | Ý nghĩa thực tế | Kết luận đúng |
|---|---|---|---|
| β = 0.08, p = 0.03, n = 800 | Có (p < 0.05) | Rất nhỏ | Mối quan hệ tồn tại nhưng quá nhỏ để có ý nghĩa ứng dụng |
| β = 0.45, p = 0.04, n = 120 | Có (p < 0.05) | Lớn | Mối quan hệ vừa có ý nghĩa thống kê vừa đáng chú ý trong thực tế |

> [!canh-bao] Viết "kết quả cho thấy X có ảnh hưởng đáng kể tới Y" chỉ vì p < 0.05, mà không nhìn vào độ lớn hệ số, là nhầm ý nghĩa thống kê với ý nghĩa thực tế — một lỗi diễn giải rất phổ biến trong luận văn dùng cỡ mẫu lớn.

## Mã hóa dữ liệu định tính có kiểm độ tin cậy

Với dữ liệu định tính (phỏng vấn, case study từ Bài 3), mã hóa (coding) là bước biến lời nói thành dữ liệu phân tích được — và cần được kiểm chứng, không chỉ dựa vào cách hiểu của một người.

> [!ghi-nho] Quy trình mã hóa cơ bản: **open coding** (gắn nhãn mô tả cho từng đoạn dữ liệu, không gò theo khung có trước), **axial coding** (nhóm các nhãn liên quan thành chủ đề lớn hơn), **selective coding** (chọn ra chủ đề trung tâm nối các chủ đề khác lại). Để đảm bảo độ tin cậy, **ít nhất hai người mã hóa độc lập** một phần dữ liệu, rồi so sánh và thảo luận chỗ khác nhau — sự khác biệt đó chính là nơi cần làm rõ định nghĩa mã, không phải điều nên giấu đi.

> [!canh-bao] Một người mã hóa toàn bộ dữ liệu một mình, không ai kiểm chứng lại, là điểm yếu phổ biến nhất bị hội đồng chỉ ra ở luận văn định tính — không có gì đảm bảo mã hóa đó không bị ảnh hưởng bởi kỳ vọng có sẵn của người mã hóa. Báo cáo độ tin cậy giữa người mã hóa (ví dụ hệ số Cohen's Kappa, hoặc tỉ lệ phần trăm đồng thuận) làm quy trình đáng tin hơn nhiều.

## Luyện tập và tài liệu tham khảo

### Cá nhân (45 phút)

Với dữ liệu thí điểm hoặc dữ liệu thật đã thu thập: (1) kiểm ba bước làm sạch (thiếu, outlier, item đảo hướng) và ghi lại số liệu đã xử lý; (2) chạy Cronbach's Alpha cho mỗi construct — nếu thang đo mới/đã điều chỉnh, chạy thêm EFA và ghi lại kết quả factor loading.

### Nhóm 3-4 người (30 phút)

Đổi kết quả EFA/Alpha cho nhau. Kiểm: có construct nào Alpha cao nhưng EFA cho thấy item tách thành nhiều nhân tố không? Nếu có dữ liệu định tính, thử mã hóa cùng một đoạn transcript độc lập rồi so sánh nhãn — thảo luận chỗ khác nhau.

### Bài tập về nhà (90-120 phút)

Viết phần **Kết quả** liên quan tới kiểm định thang đo (Chương 4, phần đầu): bảng Alpha/EFA cho mỗi construct, và nếu đã có kết quả hồi quy/path, viết một đoạn diễn giải phân biệt rõ ý nghĩa thống kê và ý nghĩa thực tế.

:::mau Mẫu nộp bài tập về nhà
**Xử lý dữ liệu:** thiếu … dòng (xử lý bằng …), outlier … , item đảo hướng đã đảo: …

**Bảng Cronbach's Alpha / EFA**

| Construct | Số item | Alpha | Kết quả EFA (nếu có) |
|---|---|---|---|
| … | … | … | … |

**Diễn giải kết quả kiểm định (nếu có):** …
:::

### Nguồn tham khảo

- Field, A. (2018). *Discovering Statistics Using IBM SPSS Statistics* (5th ed.). SAGE Publications.
- Tabachnick, B. G., & Fidell, L. S. (2019). *Using Multivariate Statistics* (7th ed.). Pearson. — chương về EFA.
- Wasserstein, R. L., & Lazar, N. A. (2016). The ASA statement on p-values: Context, process, and purpose. *The American Statistician*, 70(2), 129-133.
- Miles, M. B., Huberman, A. M., & Saldaña, J. (2020). *Qualitative Data Analysis: A Methods Sourcebook* (4th ed.). SAGE Publications.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "ppnc4-lam-sach-truoc",
                "type": "mcq",
                "prompt": "Vì sao cần kiểm dữ liệu thiếu, outlier và item đảo hướng trước khi chạy phân tích chính, dù phần mềm vẫn chạy được và cho ra kết quả nếu bỏ qua bước này?",
                "explanation": "Phần mềm thống kê không báo lỗi khi dữ liệu có nhiễu — nó vẫn tính ra một kết quả, nhưng kết quả đó không đáng tin vì tính trên dữ liệu chưa được làm sạch.",
                "points": 2,
                "options": [
                    {"label": "Phần mềm không tự phát hiện dữ liệu nhiễu; nó vẫn cho ra kết quả nhưng kết quả đó không đáng tin", "isCorrect": True},
                    {"label": "Không cần thiết nếu cỡ mẫu đủ lớn, vì mẫu lớn tự động loại bỏ nhiễu", "isCorrect": False, "misconception": "ppnc.skip-data-cleaning"},
                    {"label": "Chỉ cần thiết khi dùng SPSS, không cần khi dùng R", "isCorrect": False, "misconception": "ppnc.skip-data-cleaning"},
                    {"label": "Không cần thiết, vì đây chỉ là yêu cầu hình thức của giảng viên hướng dẫn", "isCorrect": False, "misconception": "ppnc.skip-data-cleaning"},
                ],
            },
            {
                "key": "ppnc4-alpha-khong-du",
                "type": "mcq",
                "prompt": "Một construct 5 item có Cronbach's Alpha = 0.85. Điều này chứng minh được gì?",
                "explanation": "Alpha cao chỉ cho biết các item có tương quan nội bộ với nhau, không chứng minh được cả 5 item đang đo cùng một cấu trúc nhân tố duy nhất — cần EFA để kiểm điều đó, đặc biệt với thang đo mới hoặc đã điều chỉnh.",
                "points": 3,
                "options": [
                    {"label": "Chỉ chứng minh các item có tương quan nội bộ cao; chưa chứng minh được cả 5 item đo đúng cùng một cấu trúc nhân tố như thiết kế", "isCorrect": True},
                    {"label": "Chứng minh chắc chắn cả 5 item đo đúng cùng một khái niệm duy nhất, không cần kiểm gì thêm", "isCorrect": False, "misconception": "ppnc.alpha-only-no-structure"},
                    {"label": "Chứng minh thang đo này tốt hơn mọi thang đo khác có Alpha thấp hơn", "isCorrect": False, "misconception": "ppnc.alpha-only-no-structure"},
                    {"label": "Không chứng minh được gì, Alpha là một chỉ số không có ý nghĩa thống kê", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc4-khi-nao-can-efa",
                "type": "mcq",
                "prompt": "Trường hợp nào bắt buộc phải chạy EFA trước khi tin vào cấu trúc construct?",
                "explanation": "Thang đo tự phát triển hoặc kết hợp item từ nhiều nguồn khác nhau chưa từng được kiểm cấu trúc nhân tố trong bối cảnh đó, nên bắt buộc chạy EFA trước khi dùng cho các phân tích tiếp theo như hồi quy hoặc SEM.",
                "points": 2,
                "options": [
                    {"label": "Thang đo tự phát triển hoặc kết hợp item từ nhiều nguồn khác nhau", "isCorrect": True},
                    {"label": "Thang đo gốc đã validate nhiều lần, dùng nguyên văn, đúng bối cảnh gốc", "isCorrect": False},
                    {"label": "Không bao giờ cần EFA nếu đã có Cronbach's Alpha đạt ngưỡng", "isCorrect": False, "misconception": "ppnc.alpha-only-no-structure"},
                    {"label": "Chỉ cần khi cỡ mẫu dưới 100", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc4-y-nghia-thong-ke-vs-thuc-te",
                "type": "mcq",
                "prompt": "Kết quả hồi quy: β = 0.08, p = 0.03, n = 800. Kết luận nào đúng nhất?",
                "explanation": "Với mẫu lớn, một hệ số rất nhỏ vẫn có thể đạt ý nghĩa thống kê (p < 0.05). Mối quan hệ tồn tại về mặt thống kê nhưng quá nhỏ để có ý nghĩa ứng dụng thực tế — cần phân biệt rõ hai loại ý nghĩa này khi viết kết luận.",
                "points": 3,
                "options": [
                    {"label": "Mối quan hệ có ý nghĩa thống kê nhưng độ lớn thực tế rất nhỏ, cần nói rõ cả hai khi diễn giải", "isCorrect": True},
                    {"label": "Kết quả cho thấy X có ảnh hưởng đáng kể tới Y vì p < 0.05", "isCorrect": False, "misconception": "ppnc.significant-equals-important"},
                    {"label": "Kết quả này không có ý nghĩa gì vì hệ số beta quá nhỏ", "isCorrect": False},
                    {"label": "Kết quả này sai vì p-value và beta phải luôn tỉ lệ thuận với nhau", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc4-ma-hoa-mot-nguoi",
                "type": "mcq",
                "prompt": "Một học viên tự mã hóa toàn bộ 20 bản phỏng vấn một mình, không có ai kiểm chứng lại. Vấn đề chính của cách làm này là gì?",
                "explanation": "Không có cách nào đảm bảo mã hóa đó không bị ảnh hưởng bởi kỳ vọng có sẵn của người mã hóa nếu không có người thứ hai mã hóa độc lập để so sánh — đây là điểm yếu phổ biến hội đồng thường chỉ ra ở luận văn định tính.",
                "points": 3,
                "options": [
                    {"label": "Không có cách kiểm chứng mã hóa đó không bị ảnh hưởng bởi kỳ vọng chủ quan của người mã hóa duy nhất", "isCorrect": True},
                    {"label": "Không có vấn đề gì, một người mã hóa vẫn đủ tin cậy nếu người đó cẩn thận", "isCorrect": False, "misconception": "ppnc.one-coder-only"},
                    {"label": "Vấn đề duy nhất là tốn thời gian, không liên quan tới độ tin cậy", "isCorrect": False, "misconception": "ppnc.one-coder-only"},
                    {"label": "Cần ít nhất 5 người mã hóa độc lập mới coi là đủ tin cậy", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc4-thu-tu-xu-ly",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước xử lý dữ liệu định lượng, từ thu thập tới diễn giải kết quả.",
                "explanation": "Từ làm sạch dữ liệu, kiểm Cronbach's Alpha, chạy EFA nếu cần, tới kiểm định giả thuyết và diễn giải phân biệt ý nghĩa thống kê với ý nghĩa thực tế.",
                "points": 3,
                "sequence": [
                    "Làm sạch dữ liệu: xử lý thiếu, outlier, đảo hướng item",
                    "Chạy Cronbach's Alpha cho từng construct",
                    "Chạy EFA nếu thang đo mới hoặc đã điều chỉnh, kiểm cấu trúc nhân tố",
                    "Chạy kiểm định giả thuyết (hồi quy hoặc mô hình cấu trúc PLS-SEM)",
                    "Diễn giải kết quả, phân biệt ý nghĩa thống kê và ý nghĩa thực tế",
                ],
            },
            {
                "key": "ppnc4-noi-khai-niem-xu-ly",
                "type": "matching",
                "prompt": "Nối mỗi khái niệm với đúng vai trò của nó trong xử lý dữ liệu.",
                "explanation": "Cronbach's Alpha đo độ tin cậy nội bộ; EFA kiểm cấu trúc nhân tố; effect size đo độ lớn thực tế của mối quan hệ; bão hòa dữ liệu (đã học ở Bài 3) và độ tin cậy giữa người mã hóa đều thuộc quy trình xử lý dữ liệu định tính.",
                "points": 3,
                "pairs": [
                    {"left": "Cronbach's Alpha", "right": "Đo độ tin cậy nội bộ của các item trong một construct"},
                    {"left": "EFA (Exploratory Factor Analysis)", "right": "Kiểm các item có load đúng vào cấu trúc nhân tố như thiết kế"},
                    {"left": "Effect size (beta, R², Cohen's d)", "right": "Đo độ lớn thực tế của một mối quan hệ, khác với p-value"},
                    {"left": "Độ tin cậy giữa người mã hóa", "right": "Kiểm chứng mã hóa dữ liệu định tính không chỉ dựa vào một người"},
                ],
            },
            {
                "key": "ppnc4-viet-ket-qua-kiem-dinh",
                "type": "essay",
                "prompt": "Từ dữ liệu (thật hoặc thí điểm) của bạn, viết một đoạn 200-300 từ báo cáo: (a) các bước làm sạch dữ liệu đã thực hiện; (b) kết quả Cronbach's Alpha (và EFA nếu áp dụng) cho các construct; (c) nếu đã có kết quả kiểm định giả thuyết, một câu diễn giải phân biệt rõ ý nghĩa thống kê và ý nghĩa thực tế.",
                "points": 5,
            },
        ],
    },
}
