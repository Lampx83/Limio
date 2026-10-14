# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3 · Thiết kế nghiên cứu",
    "durationMin": 100,
    "description": "Chọn thiết kế phù hợp với khung lý thuyết đã dựng ở Bài 1; hiểu quy trình hai bước của PLS-SEM (mô hình đo trước, mô hình cấu trúc sau); thiết kế case study/phỏng vấn sâu theo tiêu chí lý thuyết và bão hòa dữ liệu; chọn đúng dạng thiết kế hỗn hợp khi cần cả hai.",
    "objectives": [
        "Biện luận được khi nào một khung lý thuyết có nhiều biến trung gian/điều tiết cần SEM thay vì nhiều hồi quy riêng lẻ",
        "Trình bày được quy trình hai bước của PLS-SEM: kiểm mô hình đo (reliability, validity) trước khi đọc kết quả mô hình cấu trúc (path coefficient)",
        "Thiết kế được case study hoặc phỏng vấn sâu với tiêu chí chọn mẫu theo lý thuyết và nguyên tắc bão hòa dữ liệu, không cố định số lượng trước",
        "Chọn được một trong ba dạng thiết kế hỗn hợp (đồng thời, tuần tự giải thích, tuần tự khám phá) phù hợp với mục đích tích hợp dữ liệu của đề tài",
    ],
    "summary": [
        "Một khung lý thuyết có nhiều biến trung gian hoặc điều tiết nên được kiểm bằng SEM/PLS-SEM — chạy nhiều hồi quy riêng lẻ làm mất mối liên hệ giữa các đường dẫn và tích lũy sai số.",
        "PLS-SEM luôn đi hai bước: kiểm mô hình đo (độ tin cậy, độ giá trị của thang đo) trước, chỉ đọc kết quả mô hình cấu trúc (path coefficient, R²) sau khi mô hình đo đã đạt — đọc path trước khi kiểm đo là đọc một kết quả không có ý nghĩa.",
        "Cỡ mẫu định tính (số ca nghiên cứu, số người phỏng vấn) không cố định trước một số cụ thể — nó được quyết định bởi tiêu chí lý thuyết và điểm bão hòa dữ liệu, tức là lúc thêm dữ liệu không còn sinh ra thông tin mới.",
        "Thiết kế hỗn hợp không phải là làm định lượng và định tính tách biệt rồi ghép báo cáo lại — nó cần một chiến lược tích hợp cụ thể: đồng thời để so sánh, tuần tự để giải thích, hoặc tuần tự để khám phá và xây công cụ.",
    ],
    "splitSections": True,
    "body": r"""
Bài 1 đã dựng khung lý thuyết với các biến và giả thuyết. Bài này chọn công cụ để kiểm định khung đó — và ở mức luận văn, việc chọn công cụ cần biện luận chặt hơn nhiều so với việc chỉ chọn "định lượng hay định tính" — đi qua bốn phần: trước hết nối đặc điểm của khung lý thuyết với công cụ phù hợp; sau đó đi sâu vào quy trình hai bước bắt buộc của PLS-SEM và cách phân biệt construct phản ánh với construct hình thành; tiếp theo là thiết kế case study/phỏng vấn sâu theo tiêu chí lý thuyết và điểm bão hòa dữ liệu; và kết bằng ba chiến lược tích hợp của thiết kế hỗn hợp khi cần cả định lượng lẫn định tính.

## Từ khung lý thuyết tới thiết kế

Khung lý thuyết ở Bài 1 quyết định phần lớn việc chọn thiết kế, không phải sở thích hay năng lực có sẵn.

> [!canh-bao] Một khung có nhiều biến trung gian hoặc điều tiết (ví dụ: IV → mediator → DV, với một moderator tác động vào một đường dẫn) mà kiểm bằng **nhiều phép hồi quy tuyến tính riêng lẻ** (một hồi quy IV→mediator, một hồi quy mediator→DV) là một lỗi thống kê phổ biến: mỗi hồi quy ước lượng riêng, sai số của bước trước không được đưa vào bước sau, và mối quan hệ giữa các đường dẫn trong toàn mô hình bị mất. **SEM/PLS-SEM** ước lượng toàn bộ mô hình đường dẫn (bao gồm tất cả các đường dẫn, trung gian, điều tiết) cùng một lúc.

| Đặc điểm khung lý thuyết | Công cụ phù hợp |
|---|---|
| Chỉ 1-2 biến, không có trung gian/điều tiết, cỡ mẫu nhỏ | Hồi quy tuyến tính/logistic đơn giản là đủ |
| Nhiều biến, có trung gian và/hoặc điều tiết, các construct đo bằng nhiều item (Likert) | SEM/PLS-SEM |
| Muốn hiểu sâu trải nghiệm, cơ chế, hoặc một hiện tượng phức tạp trong một bối cảnh cụ thể | Case study hoặc phỏng vấn sâu (định tính) |
| Cần vừa kiểm định mối quan hệ vừa hiểu cơ chế/trải nghiệm | Thiết kế hỗn hợp |

## Định lượng nâng cao: quy trình hai bước của PLS-SEM

PLS-SEM (Partial Least Squares Structural Equation Modeling) là công cụ phổ biến nhất cho luận văn dùng dữ liệu khảo sát với construct đa item. Điểm mấu chốt: **luôn đi hai bước**, không được đọc kết quả bước 2 nếu bước 1 chưa đạt.

> [!ghi-nho] **Bước 1 — Mô hình đo (measurement/outer model):** kiểm độ tin cậy (Cronbach's Alpha, Composite Reliability, cả hai nên ≥ 0.7) và độ giá trị (AVE ≥ 0.5 cho hội tụ; HTMT < 0.85-0.90 cho phân biệt) của từng thang đo. **Bước 2 — Mô hình cấu trúc (structural/inner model):** chỉ đọc path coefficient, R², và kiểm định bootstrap (t-value, p-value) sau khi bước 1 đã đạt tiêu chuẩn.

> [!canh-bao] Đọc kết quả path coefficient của mô hình cấu trúc trước khi kiểm mô hình đo là đọc một kết quả **không có ý nghĩa thống kê thật**: nếu thang đo không đạt độ tin cậy hoặc độ giá trị, các hệ số đường dẫn được tính từ dữ liệu không đáng tin, bất kể p-value có nhỏ đến đâu.

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:.8rem">Quy trình PLS-SEM — không đảo thứ tự</div>
  <div style="display:flex;flex-direction:column;gap:.5rem;font-size:1.1rem">
    <div style="background:rgba(59,130,246,.14);border-left:4px solid rgba(59,130,246,.7);padding:.6rem .9rem;border-radius:.3rem"><b>1. Mô hình đo</b> — Cronbach's Alpha, Composite Reliability, AVE, HTMT</div>
    <div style="text-align:center;color:rgba(127,127,127,.7)">↓ chỉ đi tiếp nếu đạt tiêu chuẩn</div>
    <div style="background:rgba(13,148,136,.14);border-left:4px solid rgba(13,148,136,.7);padding:.6rem .9rem;border-radius:.3rem"><b>2. Mô hình cấu trúc</b> — path coefficient, R², bootstrap (t/p-value)</div>
  </div>
</div>
```

Một khái niệm hay bị bỏ qua: **construct phản ánh (reflective) và construct hình thành (formative)**. Construct phản ánh (ví dụ "sự hài lòng") có các item đều **phản ánh** cùng một khái niệm nền — bỏ một item vẫn đo được khái niệm đó, các item tương quan cao với nhau. Construct hình thành (ví dụ "tình trạng kinh tế gia đình" = thu nhập + tài sản + nợ) có các item **tạo thành** khái niệm — bỏ một thành phần là khái niệm đổi nghĩa, và các thành phần không cần tương quan cao với nhau. Áp nhầm loại construct làm sai toàn bộ cách kiểm định mô hình đo.

> [!vi-du] Một học viên đo "mức độ số hoá của doanh nghiệp" bằng ba chỉ số: tỉ lệ quy trình đã số hoá, số lượng phần mềm quản trị đang dùng, và mức đầu tư công nghệ hàng năm. Ba chỉ số này không cần tương quan cao với nhau (một doanh nghiệp có thể đầu tư nhiều tiền nhưng ít quy trình số hoá) — đây là construct **hình thành**, không phải phản ánh. Áp kiểm định Cronbach's Alpha (dành cho construct phản ánh) vào đây sẽ cho kết quả gây hiểu nhầm là thang đo "không đáng tin cậy".

## Định tính chuyên sâu: case study và phỏng vấn sâu

Với thiết kế định tính, hai quyết định quan trọng nhất là chọn ca nghiên cứu (case) theo tiêu chí gì, và biết khi nào dừng thu thập dữ liệu.

> [!ghi-nho] Case study chọn theo **tiêu chí lý thuyết** (theoretical sampling) — chọn ca vì nó đại diện điển hình, đối lập cực đoan, hoặc hiếm gặp và có giá trị lý thuyết — không chọn vì đó là ca dễ tiếp cận nhất. Case study **đơn ca** phù hợp khi hiện tượng hiếm hoặc mang tính cực đoan điển hình; **đa ca** phù hợp khi muốn so sánh giữa các bối cảnh khác nhau để tìm mẫu hình chung.

> [!canh-bao] Cố định trước "sẽ phỏng vấn đúng 10 người" trước khi bắt đầu thu thập dữ liệu là một lỗi phổ biến. Cỡ mẫu định tính nên được quyết định bởi **bão hòa dữ liệu** (data saturation) — điểm mà việc phỏng vấn thêm người không còn sinh ra chủ đề hoặc thông tin mới. Có thể là 8 người, có thể là 20 — biết trước con số chính xác trước khi thu thập dữ liệu là dấu hiệu chưa hiểu logic của lấy mẫu định tính.

> [!vi-du] Một học viên nghiên cứu trải nghiệm giảng viên chuyển đổi sang dạy trực tuyến trong đại dịch, dự kiến phỏng vấn 12 giảng viên. Sau phỏng vấn thứ 9, các chủ đề mới không còn xuất hiện — hai giảng viên tiếp theo lặp lại đúng các chủ đề đã có (khó khăn kỹ thuật, mất kết nối với sinh viên, áp lực chuẩn bị tài liệu mới). Học viên dừng ở 11 người và ghi rõ trong luận văn: "dữ liệu đạt bão hòa sau người tham gia thứ 9, phỏng vấn thêm 2 người để xác nhận không có chủ đề mới xuất hiện."

## Thiết kế hỗn hợp: ba chiến lược tích hợp

Khi khung lý thuyết cần cả đo lường và hiểu cơ chế, thiết kế hỗn hợp cần một **chiến lược tích hợp cụ thể** — không phải làm hai phần tách biệt rồi ghép báo cáo.

| Dạng | Trình tự | Mục đích tích hợp |
|---|---|---|
| Đồng thời (convergent) | Định lượng và định tính thu thập cùng lúc, độc lập | So sánh hai bộ kết quả để xác nhận hoặc làm rõ điểm khác biệt |
| Tuần tự giải thích (explanatory sequential) | Định lượng trước → định tính sau | Dùng phỏng vấn để giải thích **vì sao** một kết quả định lượng (đặc biệt kết quả bất ngờ) lại xảy ra |
| Tuần tự khám phá (exploratory sequential) | Định tính trước → định lượng sau | Dùng phỏng vấn để khám phá biến/khái niệm mới, rồi xây thang đo và kiểm định trên mẫu lớn hơn |

> [!canh-bao] "Làm cả khảo sát và phỏng vấn" không tự động là thiết kế hỗn hợp đúng nghĩa nếu không có chiến lược tích hợp: phần thảo luận phải nói rõ kết quả định tính giải thích/xác nhận/mở rộng kết quả định lượng ở điểm nào cụ thể, không phải trình bày hai phần kết quả cạnh nhau không liên hệ.

## Luyện tập và tài liệu tham khảo

### Cá nhân (45 phút)

Với đề tài của bạn: nếu định lượng, vẽ sơ đồ mô hình đo (construct nào phản ánh, construct nào hình thành) và mô hình cấu trúc (đường dẫn chính, trung gian, điều tiết nếu có). Nếu định tính, viết tiêu chí chọn case hoặc người tham gia theo lý thuyết, và dự kiến (không cố định) khoảng cỡ mẫu. Nếu hỗn hợp, chọn một trong ba dạng và viết một đoạn giải thích chiến lược tích hợp.

### Nhóm 3-4 người (30 phút)

Phản biện chéo. Với thiết kế định lượng: kiểm mỗi construct đã được xác định đúng là phản ánh hay hình thành chưa. Với định tính: kiểm tiêu chí chọn case có dựa trên lý thuyết không, hay chỉ là "dễ tiếp cận". Với hỗn hợp: hỏi "kết quả định tính của bạn sẽ giải thích/xác nhận/mở rộng điều gì cụ thể từ kết quả định lượng?"

### Bài tập về nhà (90 phút)

Viết phần **Thiết kế nghiên cứu** cho Chương 3: loại thiết kế đã chọn và lý do (nối lại với khung lý thuyết ở Bài 1), mô tả công cụ/quy trình cụ thể (PLS-SEM hai bước, hoặc tiêu chí chọn case/bão hòa dữ liệu, hoặc chiến lược tích hợp hỗn hợp).

:::mau Mẫu nộp bài tập về nhà
**Loại thiết kế đã chọn:** ☐ Định lượng (SEM/PLS-SEM) ☐ Định tính (case study/phỏng vấn sâu) ☐ Hỗn hợp (…)

**Lý do chọn (nối với khung lý thuyết Bài 1):** …

**Nếu định lượng:** danh sách construct, loại (phản ánh/hình thành), số item dự kiến mỗi construct

**Nếu định tính:** tiêu chí chọn case/người tham gia, khoảng cỡ mẫu dự kiến, tiêu chí dừng

**Nếu hỗn hợp:** chiến lược tích hợp cụ thể (đồng thời/tuần tự giải thích/tuần tự khám phá) và lý do
:::

### Nguồn tham khảo

- Hair, J. F., Hult, G. T. M., Ringle, C. M., & Sarstedt, M. (2021). *A Primer on Partial Least Squares Structural Equation Modeling (PLS-SEM)* (3rd ed.). SAGE Publications.
- Yin, R. K. (2018). *Case Study Research and Applications: Design and Methods* (6th ed.). SAGE Publications.
- Creswell, J. W., & Plano Clark, V. L. (2018). *Designing and Conducting Mixed Methods Research* (3rd ed.). SAGE Publications.
- Guest, G., Bunce, A., & Johnson, L. (2006). How many interviews are enough? An experiment with data saturation and variability. *Field Methods*, 18(1), 59-82.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "ppnc3-sem-vs-hoi-quy",
                "type": "mcq",
                "prompt": "Một khung lý thuyết có 2 biến trung gian và 1 biến điều tiết. Vì sao nên dùng SEM/PLS-SEM thay vì chạy nhiều hồi quy tuyến tính riêng lẻ cho từng đường dẫn?",
                "explanation": "Chạy nhiều hồi quy riêng lẻ ước lượng từng đường dẫn độc lập, làm mất mối liên hệ giữa các đường dẫn trong toàn mô hình và tích lũy sai số qua các bước — SEM ước lượng toàn bộ mô hình đường dẫn cùng lúc.",
                "points": 2,
                "options": [
                    {"label": "Nhiều hồi quy riêng lẻ làm mất mối liên hệ giữa các đường dẫn và tích lũy sai số qua từng bước ước lượng", "isCorrect": True},
                    {"label": "Hồi quy tuyến tính không thể chạy trên phần mềm thống kê hiện đại", "isCorrect": False, "misconception": "ppnc.regression-instead-of-sem"},
                    {"label": "Không có khác biệt thật sự, chỉ là SEM nghe học thuật hơn", "isCorrect": False, "misconception": "ppnc.regression-instead-of-sem"},
                    {"label": "SEM luôn cho p-value nhỏ hơn hồi quy nên dễ đạt ý nghĩa thống kê", "isCorrect": False, "misconception": "ppnc.regression-instead-of-sem"},
                ],
            },
            {
                "key": "ppnc3-thu-tu-plssem",
                "type": "mcq",
                "prompt": "Trong PLS-SEM, vì sao không nên đọc kết quả path coefficient của mô hình cấu trúc trước khi kiểm mô hình đo?",
                "explanation": "Nếu thang đo chưa đạt độ tin cậy hoặc độ giá trị ở mô hình đo, các hệ số đường dẫn ở mô hình cấu trúc được tính từ dữ liệu không đáng tin — kết quả không có ý nghĩa thống kê thật, bất kể p-value nhỏ tới đâu.",
                "points": 3,
                "options": [
                    {"label": "Nếu thang đo không đạt độ tin cậy/độ giá trị, các hệ số đường dẫn được tính từ dữ liệu không đáng tin cậy", "isCorrect": True},
                    {"label": "Vì phần mềm PLS-SEM luôn tính mô hình đo trước theo mặc định, không thể đổi thứ tự", "isCorrect": False, "misconception": "ppnc.skip-measurement-model"},
                    {"label": "Không có lý do thống kê nào, chỉ là quy ước trình bày trong luận văn", "isCorrect": False, "misconception": "ppnc.skip-measurement-model"},
                    {"label": "Vì mô hình cấu trúc luôn cho kết quả không có ý nghĩa nếu chạy trước", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc3-reflective-formative",
                "type": "mcq",
                "prompt": "'Tình trạng kinh tế gia đình' được đo bằng ba chỉ số không cần tương quan cao với nhau: thu nhập, tài sản, nợ. Đây là loại construct nào?",
                "explanation": "Construct hình thành (formative): các thành phần tạo thành khái niệm chứ không phản ánh chung một khái niệm nền, nên không cần tương quan cao với nhau như construct phản ánh.",
                "points": 3,
                "options": [
                    {"label": "Construct hình thành (formative)", "isCorrect": True},
                    {"label": "Construct phản ánh (reflective)", "isCorrect": False},
                    {"label": "Biến điều tiết (moderator)", "isCorrect": False},
                    {"label": "Biến trung gian (mediator)", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc3-co-mau-dinh-tinh",
                "type": "mcq",
                "prompt": "Một học viên quyết định trước 'sẽ phỏng vấn đúng 10 người' cho nghiên cứu định tính, không dựa trên tiêu chí nào khác. Nhận định nào đúng nhất?",
                "explanation": "Cỡ mẫu định tính nên được quyết định bởi bão hòa dữ liệu — điểm mà phỏng vấn thêm không còn sinh ra thông tin mới — không cố định một số trước khi thu thập dữ liệu.",
                "points": 2,
                "options": [
                    {"label": "Nên quyết định dừng dựa trên bão hòa dữ liệu, không cố định số lượng trước khi thu thập", "isCorrect": True},
                    {"label": "10 người luôn là cỡ mẫu chuẩn cho mọi nghiên cứu định tính", "isCorrect": False, "misconception": "ppnc.fixed-sample-qualitative"},
                    {"label": "Cỡ mẫu định tính không quan trọng vì không cần đại diện cho ai", "isCorrect": False, "misconception": "ppnc.fixed-sample-qualitative"},
                    {"label": "Nên tăng lên ít nhất 30 người để có ý nghĩa thống kê", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc3-hon-hop-tich-hop",
                "type": "mcq",
                "prompt": "Một học viên làm cả khảo sát định lượng và phỏng vấn định tính, nhưng trình bày hai phần kết quả cạnh nhau trong luận văn mà không liên hệ chúng với nhau. Vấn đề của thiết kế này là gì?",
                "explanation": "Thiết kế hỗn hợp cần một chiến lược tích hợp cụ thể — kết quả định tính phải giải thích, xác nhận hoặc mở rộng kết quả định lượng ở điểm cụ thể nào — làm hai phần tách biệt không liên hệ không phải là thiết kế hỗn hợp đúng nghĩa.",
                "points": 3,
                "options": [
                    {"label": "Thiếu chiến lược tích hợp cụ thể — không có kết quả nào giải thích, xác nhận hoặc mở rộng kết quả còn lại", "isCorrect": True},
                    {"label": "Không có vấn đề gì, làm cả hai phần là đủ để gọi là thiết kế hỗn hợp", "isCorrect": False, "misconception": "ppnc.mixed-is-just-both"},
                    {"label": "Vấn đề duy nhất là thứ tự trình bày hai phần trong luận văn", "isCorrect": False, "misconception": "ppnc.mixed-is-just-both"},
                    {"label": "Không nên làm cả hai phần, nên chọn hẳn một trong hai phương pháp", "isCorrect": False},
                ],
            },
            {
                "key": "ppnc3-thu-tu-thiet-ke",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước thiết kế nghiên cứu định lượng bằng PLS-SEM.",
                "explanation": "Từ khung lý thuyết, xác định loại construct, thu thập dữ liệu, kiểm mô hình đo trước, chỉ đọc mô hình cấu trúc sau khi mô hình đo đạt.",
                "points": 3,
                "sequence": [
                    "Xác định các construct từ khung lý thuyết ở Bài 1",
                    "Phân loại mỗi construct là phản ánh (reflective) hay hình thành (formative)",
                    "Thu thập dữ liệu khảo sát theo thang đo đã chọn",
                    "Kiểm mô hình đo: độ tin cậy và độ giá trị của từng construct",
                    "Đọc kết quả mô hình cấu trúc (path coefficient, R²) chỉ sau khi mô hình đo đạt tiêu chuẩn",
                ],
            },
            {
                "key": "ppnc3-noi-thiet-ke-hon-hop",
                "type": "matching",
                "prompt": "Nối mỗi dạng thiết kế hỗn hợp với đúng mục đích tích hợp của nó.",
                "explanation": "Đồng thời so sánh hai bộ kết quả độc lập; tuần tự giải thích dùng định tính để hiểu vì sao một kết quả định lượng xảy ra; tuần tự khám phá dùng định tính để tìm biến mới trước khi xây thang đo định lượng.",
                "points": 3,
                "pairs": [
                    {"left": "Đồng thời (convergent)", "right": "So sánh hai bộ kết quả thu thập độc lập, cùng lúc"},
                    {"left": "Tuần tự giải thích (explanatory sequential)", "right": "Dùng định tính để giải thích một kết quả định lượng đã có"},
                    {"left": "Tuần tự khám phá (exploratory sequential)", "right": "Dùng định tính để khám phá biến mới, rồi xây thang đo định lượng"},
                    {"left": "Case study đa ca", "right": "So sánh nhiều bối cảnh để tìm mẫu hình chung"},
                ],
            },
            {
                "key": "ppnc3-viet-thiet-ke",
                "type": "essay",
                "prompt": "Viết phần Thiết kế nghiên cứu cho đề tài của bạn (200-300 từ), gồm: (a) loại thiết kế đã chọn và lý do nối với khung lý thuyết ở Bài 1; (b) nếu định lượng — construct nào phản ánh/hình thành; nếu định tính — tiêu chí chọn case/người tham gia và tiêu chí dừng; nếu hỗn hợp — chiến lược tích hợp cụ thể.",
                "points": 5,
            },
        ],
    },
}
