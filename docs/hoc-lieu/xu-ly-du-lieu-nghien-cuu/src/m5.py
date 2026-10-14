# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5 · Trực quan hóa dữ liệu và đóng gói để tái lập kết quả",
    "durationMin": 75,
    "description": "Chọn đúng loại biểu đồ theo loại dữ liệu; tránh trục y bị cắt trên biểu đồ cột và biểu đồ hai trục gây hiểu sai; chuyển một bảng output thô thành biểu đồ đúng cách; đóng gói dữ liệu, script và codebook để người khác (hoặc chính mình sau này) tái lập được kết quả.",
    "objectives": [
        "Chọn đúng loại biểu đồ (cột, đường, phân tán, hộp) theo loại dữ liệu và mục đích so sánh",
        "Nhận diện và tránh hai lỗi trực quan hóa phổ biến: trục y bị cắt trên biểu đồ cột, và biểu đồ hai trục y gây hiểu sai về tương quan",
        "Chuyển một bảng kết quả thống kê thô thành một biểu đồ đúng cách, có chú thích đầy đủ",
        "Đóng gói dữ liệu, script phân tích và codebook thành một bộ hồ sơ để tái lập được kết quả sau này",
    ],
    "summary": [
        "Loại biểu đồ phải khớp với loại dữ liệu và mục đích: biểu đồ cột cho so sánh giữa các nhóm, biểu đồ đường cho thay đổi theo thời gian, biểu đồ phân tán cho tương quan giữa hai biến liên tục — không phải chọn theo biểu đồ nào 'nhìn đẹp'.",
        "Biểu đồ cột không bắt đầu trục y từ 0 làm sự khác biệt giữa các nhóm trông lớn hơn thực tế — đây là lỗi trực quan hóa phổ biến và dễ gây hiểu sai nhất.",
        "Biểu đồ hai trục y (dùng hai thang đo khác nhau cho hai đường trên cùng một biểu đồ) dễ khiến người xem ngộ nhận về mối tương quan không thực chất tồn tại, vì có thể chọn tỉ lệ hai trục để hai đường trông giống nhau.",
        "Một bộ hồ sơ tái lập kết quả cần đủ ba phần: dữ liệu, script phân tích, và codebook giải thích từng biến — thiếu một trong ba phần khiến không ai, kể cả chính người phân tích một năm sau, tái lập lại được đúng quy trình.",
    ],
    "splitSections": True,
    "body": r"""
Với các bảng output đã đọc đúng ở Bài 2-4, bài cuối này chuyển kết quả thành biểu đồ đúng cách, và đóng gói toàn bộ quy trình để tái lập được. Bài đi qua bốn phần: chọn đúng loại biểu đồ theo loại dữ liệu, nhận diện hai lỗi trực quan hóa gây hiểu sai (trục y bị cắt, biểu đồ hai trục), chuyển một bảng kết quả thống kê thô thành biểu đồ đúng cách có chú thích đầy đủ, và đóng gói dữ liệu — script — codebook thành một bộ hồ sơ để tái lập được kết quả sau này. Phần luyện tập và tài liệu tham khảo khép lại khoá học.

## Chọn đúng loại biểu đồ

| Mục đích | Loại biểu đồ phù hợp |
|---|---|
| So sánh giá trị trung bình giữa các nhóm | Biểu đồ cột (bar chart) |
| Thay đổi của một biến theo thời gian | Biểu đồ đường (line chart) |
| Mối tương quan giữa hai biến liên tục | Biểu đồ phân tán (scatter plot) |
| Phân phối của một biến liên tục (xem hình dạng, outlier) | Histogram hoặc box plot |
| Tỉ lệ phần trăm của một tổng, khi có ít hơn 5-6 phần | Biểu đồ tròn (dùng hạn chế) |

> [!canh-bao] Dùng biểu đồ tròn cho một biến có 8-10 phần (ví dụ tỉ lệ sinh viên theo 10 ngành học) làm người xem không thể so sánh chính xác các phần gần bằng nhau — mắt người không phân biệt tốt góc của các hình quạt nhỏ. Với nhiều hơn 5-6 phần, **biểu đồ cột** luôn dễ so sánh hơn biểu đồ tròn.

Với biểu đồ phân tán (scatter plot), luôn tính kèm hệ số tương quan **r** và diễn giải độ mạnh của nó theo cùng quy ước Cohen (1988) đã dùng cho Cohen's d và eta-squared ở Bài 2:

| |r| | Mức độ tương quan |
|---|---|
| 0.10 – 0.29 | Yếu |
| 0.30 – 0.49 | Vừa |
| ≥ 0.50 | Mạnh |

> [!vi-du] Biểu đồ phân tán giữa "số giờ tự học mỗi tuần" và "điểm hài lòng với công cụ AI chấm bài" cho r = 0.42 — tương quan dương mức **vừa**: xu hướng chung là tự học nhiều hơn đi kèm hài lòng cao hơn, nhưng r = 0.42 (không phải r gần 1) nghĩa là các điểm trên biểu đồ vẫn phân tán khá rộng quanh đường xu hướng, không nằm sát một đường thẳng.

> [!canh-bao] Độ mạnh tương quan (r) và ý nghĩa thống kê (p-value) là hai điều khác nhau — đừng lẫn lộn. Với cỡ mẫu lớn, một r rất nhỏ (ví dụ 0.12, mức "yếu") vẫn có thể cho p < 0.05; ngược lại với cỡ mẫu nhỏ, một r khá lớn (ví dụ 0.45) có thể chưa đạt p < 0.05. Khi trình bày biểu đồ phân tán, nên ghi cả r và p (nếu có) thay vì chỉ nói "có tương quan có ý nghĩa" mà không cho biết tương quan đó mạnh hay yếu.

## Hai lỗi trực quan hóa gây hiểu sai

> [!canh-bao] **Trục y bị cắt trên biểu đồ cột** (không bắt đầu từ 0) là lỗi phổ biến và dễ gây hiểu sai nhất: một sự khác biệt nhỏ (ví dụ Mean 3.44 so với 3.60) khi vẽ trên trục y chạy từ 3.4 tới 3.7 trông như một khác biệt rất lớn, trong khi trên trục y đầy đủ từ 0 tới 5 (đúng với thang Likert), sự khác biệt đó trông nhỏ hơn nhiều — và đúng với thực tế hơn. **Biểu đồ cột nên luôn bắt đầu trục y từ 0.**

```html
<div style="border:1px solid rgba(127,127,127,0.32);border-radius:.6rem;padding:1rem 1.1rem;margin:1.2rem 0">
  <div style="font-size:1rem;color:rgba(127,127,127,0.95);text-transform:uppercase;letter-spacing:.04em;font-weight:600;margin-bottom:.8rem">Cùng số liệu, hai cách vẽ khác nhau</div>
  <div style="display:flex;gap:1.2rem;flex-wrap:wrap">
    <div style="flex:1;min-width:200px">
      <div style="font-size:1rem;color:rgba(217,150,40,.95);font-weight:600;margin-bottom:.4rem">Trục y từ 3.0 (gây hiểu sai)</div>
      <div style="display:flex;align-items:flex-end;gap:.6rem;height:80px">
        <div style="width:40px;height:70px;background:rgba(59,130,246,.5);border-radius:.2rem 0.2rem 0 0"></div>
        <div style="width:40px;height:44px;background:rgba(139,92,246,.5);border-radius:.2rem 0.2rem 0 0"></div>
      </div>
      <div style="font-size:.95rem;color:rgba(127,127,127,.85);margin-top:.3rem">Nhóm A: 3.60 &nbsp;&nbsp; Nhóm B: 3.44 — trông như gấp rưỡi</div>
    </div>
    <div style="flex:1;min-width:200px">
      <div style="font-size:1rem;color:rgba(13,148,136,.95);font-weight:600;margin-bottom:.4rem">Trục y từ 0 (đúng thực tế)</div>
      <div style="display:flex;align-items:flex-end;gap:.6rem;height:80px">
        <div style="width:40px;height:72px;background:rgba(59,130,246,.5);border-radius:.2rem 0.2rem 0 0"></div>
        <div style="width:40px;height:69px;background:rgba(139,92,246,.5);border-radius:.2rem 0.2rem 0 0"></div>
      </div>
      <div style="font-size:.95rem;color:rgba(127,127,127,.85);margin-top:.3rem">Nhóm A: 3.60 &nbsp;&nbsp; Nhóm B: 3.44 — khác biệt thật, khá nhỏ</div>
    </div>
  </div>
</div>
```

> [!canh-bao] **Biểu đồ hai trục y** (vẽ hai đường với hai thang đo khác nhau trên cùng một biểu đồ, ví dụ số lượt dùng AI bên trái, điểm hài lòng bên phải) rất dễ bị chọn tỉ lệ hai trục sao cho hai đường "khớp" nhau về hình dạng, khiến người xem ngộ nhận có mối tương quan mạnh — trong khi mối tương quan thật (nếu tính hệ số) có thể rất yếu. Nếu cần so sánh hai biến khác đơn vị, ưu tiên hai biểu đồ riêng đặt cạnh nhau, hoặc chuẩn hóa cả hai về cùng thang (z-score) trước khi vẽ chung.

## Từ bảng output thô tới biểu đồ đúng

Với bảng t-test ở Bài 2 (Nữ: Mean=4.25, SD=0.50; Nam: Mean=2.80, SD=0.84), biểu đồ cột đúng cách cần: trục y từ 0 tới 5 (đúng thang Likert), có **thanh sai số** (error bar, thường ±1 SD hoặc khoảng tin cậy 95%) để người xem thấy được độ phân tán, không chỉ điểm trung bình, và chú thích rõ đơn vị đo (thang Likert 1-5) cùng cỡ mẫu mỗi nhóm.

> [!meo] Luôn tự hỏi trước khi hoàn thiện một biểu đồ: nếu chỉ nhìn biểu đồ này mà không đọc chữ nào khác, người xem có hiểu đúng độ lớn thật của sự khác biệt/mối quan hệ không? Nếu câu trả lời là biểu đồ đang "phóng đại" ấn tượng so với số liệu thật, cần vẽ lại.

## Đóng gói dữ liệu để tái lập kết quả

> [!ghi-nho] Một bộ hồ sơ tái lập kết quả (reproducibility package) đầy đủ cần ba phần: **dữ liệu** (cả bản thô và bản đã làm sạch, giữ riêng hai bản), **script phân tích** (mã R/cú pháp SPSS đã chạy, không phải chỉ lưu kết quả output), và **codebook** (giải thích mỗi biến là gì, đơn vị đo, thang đo, cách các biến dẫn xuất — như điểm construct — được tính từ biến gốc).

> [!canh-bao] Chỉ lưu lại file dữ liệu cuối cùng và bảng kết quả, không lưu script hay codebook, khiến không ai — kể cả chính người phân tích một năm sau — tái lập lại được chính xác quy trình đã làm: item nào đã bị loại, công thức đảo hướng nào đã dùng, hay tiêu chí loại outlier nào đã áp dụng đều bị mất theo thời gian nếu không ghi lại.

## Luyện tập và tài liệu tham khảo

### Cá nhân (35 phút)

Với một bảng kết quả bạn đã có (từ Bài 2, 3, hoặc dữ liệu của bạn), chọn đúng loại biểu đồ và vẽ (hoặc mô tả) nó, đảm bảo trục y bắt đầu từ 0 nếu là biểu đồ cột, và có chú thích đơn vị/cỡ mẫu.

### Nhóm 3-4 người (20 phút)

Đổi biểu đồ cho nhau. Kiểm: biểu đồ này có "phóng đại" ấn tượng so với số liệu thật không? Loại biểu đồ đã chọn có đúng với loại dữ liệu và mục đích không?

### Bài tập về nhà (45-60 phút)

Đóng gói một bộ hồ sơ tái lập kết quả cho một phân tích bạn đã làm ở các bài trước: dữ liệu thô + đã làm sạch, script/cú pháp đã dùng, và codebook giải thích từng biến.

:::mau Mẫu nộp bài tập về nhà
**Biểu đồ đã chọn và lý do phù hợp với loại dữ liệu:** …

**Hồ sơ tái lập kết quả**

| Thành phần | Có / Chưa có | Ghi chú |
|---|---|---|
| Dữ liệu thô | … | … |
| Dữ liệu đã làm sạch | … | … |
| Script/cú pháp phân tích | … | … |
| Codebook (giải thích từng biến) | … | … |
:::

### Nguồn tham khảo

- Tufte, E. R. (2001). *The Visual Display of Quantitative Information* (2nd ed.). Graphics Press.
- Wilkinson, L. (2005). *The Grammar of Graphics* (2nd ed.). Springer.
- Wilson, G., et al. (2017). Good enough practices in scientific computing. *PLOS Computational Biology*, 13(6), e1005510.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 5",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "xldl5-chon-bieu-do",
                "type": "mcq",
                "prompt": "Bạn muốn thể hiện tỉ lệ sinh viên theo 9 ngành học khác nhau. Loại biểu đồ nào phù hợp nhất?",
                "explanation": "Với nhiều hơn 5-6 phần, biểu đồ tròn khiến mắt người khó phân biệt các phần gần bằng nhau — biểu đồ cột luôn dễ so sánh hơn khi có nhiều nhóm.",
                "points": 2,
                "options": [
                    {"label": "Biểu đồ cột", "isCorrect": True},
                    {"label": "Biểu đồ tròn", "isCorrect": False, "misconception": "xldl.pie-chart-too-many-slices"},
                    {"label": "Biểu đồ đường", "isCorrect": False},
                    {"label": "Biểu đồ phân tán", "isCorrect": False},
                ],
            },
            {
                "key": "xldl5-truc-y-cat",
                "type": "mcq",
                "prompt": "Một biểu đồ cột so sánh Mean 3.44 và 3.60 (thang Likert 1-5) vẽ trục y chạy từ 3.0 tới 3.8. Vấn đề của biểu đồ này là gì?",
                "explanation": "Trục y bị cắt (không bắt đầu từ 0) làm sự khác biệt nhỏ trông như lớn hơn nhiều so với thực tế — biểu đồ cột nên luôn bắt đầu trục y từ 0, đặc biệt với thang đo có điểm 0 rõ ràng như Likert.",
                "points": 3,
                "options": [
                    {"label": "Trục y bị cắt (không bắt đầu từ 0) làm sự khác biệt nhỏ trông như lớn hơn nhiều so với thực tế", "isCorrect": True},
                    {"label": "Không có vấn đề gì, cắt trục y luôn giúp biểu đồ dễ đọc hơn", "isCorrect": False, "misconception": "xldl.truncated-yaxis-bar-chart"},
                    {"label": "Không có vấn đề gì với biểu đồ cột, chỉ cần tránh với biểu đồ đường", "isCorrect": False, "misconception": "xldl.truncated-yaxis-bar-chart"},
                    {"label": "Vấn đề duy nhất là màu sắc chưa đủ nổi bật", "isCorrect": False},
                ],
            },
            {
                "key": "xldl5-hai-truc-y",
                "type": "mcq",
                "prompt": "Một biểu đồ vẽ hai đường (số lượt dùng AI và điểm hài lòng) trên hai trục y khác nhau, và hai đường trông rất giống hình dạng nhau. Rủi ro của cách trình bày này là gì?",
                "explanation": "Biểu đồ hai trục y dễ bị chọn tỉ lệ trục sao cho hai đường 'khớp' hình dạng, khiến người xem ngộ nhận có mối tương quan mạnh trong khi mối tương quan thật có thể rất yếu.",
                "points": 3,
                "options": [
                    {"label": "Dễ khiến người xem ngộ nhận có mối tương quan mạnh giữa hai biến, dù mối tương quan thật có thể yếu", "isCorrect": True},
                    {"label": "Không có rủi ro gì, hai trục y luôn giúp so sánh chính xác hơn một trục", "isCorrect": False, "misconception": "xldl.dual-axis-misleading"},
                    {"label": "Rủi ro duy nhất là khó đọc màu sắc trên biểu đồ", "isCorrect": False, "misconception": "xldl.dual-axis-misleading"},
                    {"label": "Không có rủi ro nếu cả hai biến đều có ý nghĩa thống kê riêng", "isCorrect": False, "misconception": "xldl.dual-axis-misleading"},
                ],
            },
            {
                "key": "xldl5-tai-lap-thieu-gi",
                "type": "mcq",
                "prompt": "Một nhà nghiên cứu chỉ lưu lại file dữ liệu cuối cùng và bảng kết quả, không lưu script phân tích hay codebook. Một năm sau, vấn đề nào sẽ xảy ra?",
                "explanation": "Không lưu script và codebook khiến không ai, kể cả chính người phân tích, tái lập lại được chính xác quy trình đã làm — item nào bị loại, công thức nào đã dùng đều bị mất theo thời gian.",
                "points": 3,
                "options": [
                    {"label": "Không ai, kể cả chính người phân tích, tái lập lại được chính xác quy trình đã làm để ra kết quả đó", "isCorrect": True},
                    {"label": "Không có vấn đề gì, vì file dữ liệu cuối cùng đã đủ để hiểu lại toàn bộ quy trình", "isCorrect": False, "misconception": "xldl.no-readme-reproducibility"},
                    {"label": "Không có vấn đề gì, miễn là bảng kết quả đã được công bố", "isCorrect": False, "misconception": "xldl.no-readme-reproducibility"},
                    {"label": "Vấn đề duy nhất là mất thời gian định dạng lại file dữ liệu", "isCorrect": False, "misconception": "xldl.no-readme-reproducibility"},
                ],
            },
            {
                "key": "xldl5-error-bar",
                "type": "mcq",
                "prompt": "Vì sao nên thêm thanh sai số (error bar) vào biểu đồ cột so sánh trung bình giữa các nhóm?",
                "explanation": "Thanh sai số cho người xem thấy được độ phân tán của dữ liệu, không chỉ điểm trung bình — hai nhóm có Mean khác nhau nhưng SD lớn có thể không thực sự khác biệt có ý nghĩa.",
                "points": 2,
                "options": [
                    {"label": "Để người xem thấy được độ phân tán của dữ liệu, không chỉ điểm trung bình đơn lẻ", "isCorrect": True},
                    {"label": "Chỉ để biểu đồ trông chuyên nghiệp hơn, không có ý nghĩa thống kê", "isCorrect": False},
                    {"label": "Để thay thế hoàn toàn cho việc báo cáo p-value trong văn bản", "isCorrect": False},
                    {"label": "Không cần thiết nếu đã có bảng số liệu đầy đủ đi kèm", "isCorrect": False},
                ],
            },
            {
                "key": "xldl5-thu-tu-truc-quan-hoa",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước tạo một biểu đồ đúng cách từ bảng kết quả thô.",
                "explanation": "Từ chọn loại biểu đồ đúng với loại dữ liệu, đặt trục y từ 0 (nếu là biểu đồ cột), thêm thanh sai số, chú thích đơn vị/cỡ mẫu, tới tự kiểm biểu đồ có phóng đại ấn tượng so với số liệu thật không.",
                "points": 3,
                "sequence": [
                    "Chọn loại biểu đồ phù hợp với loại dữ liệu và mục đích so sánh",
                    "Đặt trục y bắt đầu từ 0 nếu là biểu đồ cột",
                    "Thêm thanh sai số hoặc khoảng tin cậy để thể hiện độ phân tán",
                    "Chú thích đầy đủ đơn vị đo và cỡ mẫu",
                    "Tự kiểm lại: biểu đồ có phóng đại ấn tượng so với số liệu thật không",
                ],
            },
            {
                "key": "xldl5-noi-thanh-phan-tai-lap",
                "type": "matching",
                "prompt": "Nối mỗi thành phần với đúng vai trò của nó trong một bộ hồ sơ tái lập kết quả.",
                "explanation": "Dữ liệu thô là điểm bắt đầu chưa xử lý; dữ liệu đã làm sạch là đầu vào cho phân tích; script ghi lại chính xác các bước đã chạy; codebook giải thích ý nghĩa của từng biến.",
                "points": 3,
                "pairs": [
                    {"left": "Dữ liệu thô", "right": "Điểm bắt đầu chưa qua xử lý, giữ lại để đối chiếu"},
                    {"left": "Dữ liệu đã làm sạch", "right": "Đầu vào thực sự dùng cho các phân tích"},
                    {"left": "Script/cú pháp phân tích", "right": "Ghi lại chính xác các bước tính toán đã chạy"},
                    {"left": "Codebook", "right": "Giải thích ý nghĩa, đơn vị đo, và cách tính của từng biến"},
                ],
            },
            {
                "key": "xldl5-thiet-ke-bieu-do",
                "type": "essay",
                "prompt": "Từ bảng t-test ở Bài 2 (Nữ: Mean=4.25, SD=0.50, N=4; Nam: Mean=2.80, SD=0.84, N=5), viết mô tả một biểu đồ cột đúng cách (150-200 từ): (a) khoảng trục y sẽ dùng và vì sao; (b) cách thể hiện thanh sai số; (c) các chú thích cần có (đơn vị, cỡ mẫu); (d) một câu xác nhận biểu đồ này không phóng đại ấn tượng so với số liệu thật.",
                "points": 5,
            },
        ],
    },
}
