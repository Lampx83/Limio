# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4 · Mã hóa dữ liệu định tính và độ tin cậy giữa người mã hóa",
    "durationMin": 90,
    "description": "Mã hóa một đoạn transcript thật bằng open coding mô tả cụ thể, không trừu tượng hóa quá sớm; nhóm mã thành chủ đề; tự tay tính Cohen's Kappa từ bảng đồng thuận giữa hai người mã hóa; diễn giải Kappa đúng ngưỡng và biết khi nào cần quay lại thảo luận định nghĩa mã.",
    "objectives": [
        "Mã hóa một đoạn transcript bằng open coding mô tả cụ thể, tránh trừu tượng hóa quá sớm làm mất chi tiết dữ liệu gốc",
        "Nhóm các mã mô tả thành chủ đề lớn hơn (axial coding) từ một tập mã cụ thể",
        "Tự tay tính Cohen's Kappa từ bảng đồng thuận 2×2 giữa hai người mã hóa, phân biệt với tỉ lệ đồng thuận thô",
        "Diễn giải giá trị Kappa theo ngưỡng chuẩn và biết khi nào cần quay lại thảo luận định nghĩa mã trước khi tiếp tục",
    ],
    "summary": [
        "Open coding nên mô tả cụ thể điều đang xảy ra trong dữ liệu trước khi trừu tượng hóa thành khái niệm lý thuyết — gán nhãn trừu tượng quá sớm làm mất chi tiết mà sau này không lấy lại được.",
        "Axial coding nhóm các mã mô tả cụ thể thành chủ đề lớn hơn, dựa trên việc chúng cùng nói về một khía cạnh chung của hiện tượng, không phải nhóm theo cảm tính.",
        "Tỉ lệ đồng thuận thô (% hai người mã hóa chọn giống nhau) không tính tới đồng thuận có thể xảy ra do ngẫu nhiên — Cohen's Kappa trừ đi phần ngẫu nhiên đó, và là chỉ số đáng tin hơn để báo cáo.",
        "Kappa dưới 0.4 (theo ngưỡng Landis & Koch) là dấu hiệu cần quay lại thảo luận định nghĩa từng mã với người mã hóa thứ hai trước khi tiếp tục mã hóa phần còn lại của dữ liệu, không phải một con số chỉ để báo cáo rồi bỏ qua.",
    ],
    "splitSections": True,
    "body": r"""
Khoá Phương pháp nghiên cứu đã nói cần ít nhất hai người mã hóa độc lập. Bài này thực hành mã hóa thật trên một đoạn transcript, và tính tay độ tin cậy giữa hai người mã hóa — đi từ open coding mô tả cụ thể trước khi trừu tượng hóa, tới axial coding nhóm các mã thành chủ đề, rồi tính Cohen's Kappa từng bước từ bảng đồng thuận, và cuối cùng diễn giải Kappa theo ngưỡng chuẩn để biết khi nào cần quay lại thảo luận định nghĩa mã. Bài khép lại bằng phần luyện tập và tài liệu tham khảo.

## Open coding: mô tả cụ thể trước, trừu tượng hóa sau

> [!vi-du] Đoạn transcript (phỏng vấn giảng viên về công cụ AI chấm bài): *"Lúc đầu tôi thấy nó tiết kiệm thời gian lắm, chấm được nhiều bài hơn. Nhưng sau vài tuần tôi nhận ra học sinh không còn nhận được góp ý riêng cho bài của mình nữa, AI chấm theo khuôn mẫu chung. Tôi cũng lo là dần dần mình sẽ mất khả năng đánh giá bài viết tinh tế như trước, vì cứ để AI làm hết."*

> [!ghi-nho] **Open coding** gắn nhãn mô tả **cụ thể** cho từng đoạn dữ liệu, bám sát điều người tham gia thực sự nói, trước khi trừu tượng hóa thành khái niệm lý thuyết. Với đoạn trên: "tiết kiệm thời gian chấm bài" (không phải nhãn trừu tượng "hiệu quả công nghệ"), "mất góp ý cá nhân hóa cho học sinh" (không phải "chất lượng giảng dạy giảm"), "lo mất kỹ năng đánh giá của bản thân" (không phải "đe dọa chuyên môn" — đó là diễn giải, chưa phải mô tả).

> [!canh-bao] Gán nhãn trừu tượng ngay từ open coding (ví dụ nhãn hóa thẳng thành "đe dọa bản sắc nghề nghiệp" cho câu trên) làm mất chi tiết cụ thể của dữ liệu gốc — một khi đã trừu tượng hóa, không thể lấy lại được sắc thái ban đầu (ở đây, giảng viên đang lo về "kỹ năng", chưa chắc là "bản sắc nghề nghiệp" — hai điều gần nhau nhưng không giống nhau, và kết luận sau này về hai khái niệm này rất khác). Giữ mã mô tả cụ thể ở vòng đầu; việc nhóm và trừu tượng hóa diễn ra ở bước axial coding tiếp theo.

## Axial coding: nhóm mã thành chủ đề

Sau khi mã hóa nhiều đoạn dữ liệu (giả sử có thêm các mã mô tả từ những phỏng vấn khác: "chấm được nhiều bài hơn trong ít thời gian", "không phải làm việc ngoài giờ để chấm bài", "học sinh phàn nàn phản hồi AI chung, không cụ thể", "cảm thấy vai trò của mình bị thay thế một phần"), bước tiếp theo là nhóm các mã có liên quan.

| Mã mô tả cụ thể | Chủ đề (sau axial coding) |
|---|---|
| Tiết kiệm thời gian chấm bài, chấm nhiều bài hơn | Hiệu quả về thời gian |
| Không phải làm việc ngoài giờ để chấm bài | Hiệu quả về thời gian |
| Mất góp ý cá nhân hóa cho học sinh | Chất lượng phản hồi cho học sinh |
| Học sinh phàn nàn phản hồi chung, không cụ thể | Chất lượng phản hồi cho học sinh |
| Lo mất kỹ năng đánh giá của bản thân | Lo ngại về vai trò chuyên môn |
| Cảm thấy vai trò của mình bị thay thế một phần | Lo ngại về vai trò chuyên môn |

> [!meo] Axial coding nhóm theo việc các mã cùng nói về một **khía cạnh chung** của hiện tượng, không phải nhóm theo cảm tính "nghe có vẻ giống nhau". Luôn quay lại đọc chính đoạn dữ liệu gốc của mỗi mã trước khi quyết định nhóm nó vào chủ đề nào — nhóm sai làm sai cả cấu trúc phân tích sau đó.

## Tính Cohen's Kappa giữa hai người mã hóa

Hai người mã hóa độc lập 20 đoạn phỏng vấn vào hai nhóm: "Có lo ngại về vai trò chuyên môn" (A) hoặc "Không lo ngại" (B). Bảng đồng thuận:

| | Người 2: A | Người 2: B | Tổng |
|---|---|---|---|
| **Người 1: A** | 8 | 2 | 10 |
| **Người 1: B** | 3 | 7 | 10 |
| **Tổng** | 11 | 9 | 20 |

> [!ghi-nho] **Tỉ lệ đồng thuận thô** (Po) = số lần hai người chọn giống nhau ÷ tổng số: Po = (8+7)/20 = **0.75** (75%). Nhưng con số này không trừ đi phần đồng thuận có thể xảy ra **do ngẫu nhiên** — nếu một nhóm (ví dụ A) chiếm đa số, hai người mã hóa ngẫu nhiên vẫn dễ "trùng" nhau ở nhóm đó mà không thực sự đồng ý về nội dung.

**Tính Cohen's Kappa từng bước:**

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Pe (đồng thuận kỳ vọng do ngẫu nhiên)
  = (Tổng A của Người 1 ÷ 20 × Tổng A của Người 2 ÷ 20) + (Tổng B của Người 1 ÷ 20 × Tổng B của Người 2 ÷ 20)
  = (10/20 × 11/20) + (10/20 × 9/20)
  = (0.5 × 0.55) + (0.5 × 0.45)
  = 0.275 + 0.225 = 0.5

Kappa (κ) = (Po − Pe) / (1 − Pe)
          = (0.75 − 0.5) / (1 − 0.5)
          = 0.25 / 0.5 = 0.5</pre></div>
```

> [!canh-bao] Chỉ báo cáo tỉ lệ đồng thuận thô (75%) mà không tính Kappa là báo cáo một con số bị **thổi phồng** — sau khi trừ đồng thuận do ngẫu nhiên, mức độ đồng thuận thật (Kappa = 0.5) thấp hơn nhiều so với 75% nghe được.

> [!vi-du] Kappa có thể còn **âm**. Giả sử với 10 đoạn khác (Người 1: A=6/B=4; Người 2: A=3/B=7), hai người chỉ thực sự đồng ý ở 4 đoạn (A&A=1, B&B=3): Po = 4/10 = 0.4. Pe = (6/10×3/10) + (4/10×7/10) = 0.18 + 0.28 = 0.46. Kappa = (0.4 − 0.46) / (1 − 0.46) = −0.06/0.54 ≈ **−0.11**. Đồng thuận quan sát được còn **thấp hơn cả** mức kỳ vọng do ngẫu nhiên — nghĩa là hai người đang lệch nhau còn hệ thống hơn việc đoán ngẫu nhiên theo tỉ lệ riêng của mỗi người. Đây là dấu hiệu nghiêm trọng hơn cả Kappa thấp: không chỉ mơ hồ mà định nghĩa mã của hai người đang **xung đột** nhau — cần dừng hẳn và thảo luận lại từ đầu, không chỉ xem lại vài đoạn khác biệt.

> [!meo] Cách tính Po và Pe ở trên áp dụng tương tự khi có **nhiều hơn 2 danh mục** (không chỉ A/B) — dựng bảng đồng thuận k×k, Po vẫn là tổng các ô trên đường chéo chia cho tổng số, Pe vẫn là tổng các tích giữa tổng hàng và tổng cột tương ứng (chia cho tổng số bình phương) của từng danh mục cộng lại.

## Diễn giải Kappa và bước tiếp theo

> [!ghi-nho] Theo ngưỡng thường dùng (Landis & Koch, 1977): Kappa < 0.4 là **kém**, 0.4-0.6 là **trung bình (fair-moderate)**, 0.6-0.8 là **tốt**, trên 0.8 là **rất tốt**. Với ví dụ trên, Kappa = 0.5 rơi vào mức trung bình — chấp nhận được nhưng chưa mạnh.

> [!canh-bao] Kappa thấp (đặc biệt dưới 0.4) không nên chỉ được ghi vào báo cáo rồi tiếp tục mã hóa phần còn lại của dữ liệu như không có gì xảy ra. Đây là dấu hiệu cần **hai người mã hóa ngồi lại thảo luận** những đoạn họ mã khác nhau, làm rõ định nghĩa từng mã (ranh giới giữa "có lo ngại" và "không lo ngại" đang được hiểu khác nhau ở đâu), rồi mới tiếp tục mã hóa với định nghĩa đã thống nhất rõ hơn.

## Luyện tập và tài liệu tham khảo

### Cá nhân (40 phút)

Mã hóa (open coding) một đoạn transcript của bạn (thật hoặc tự viết mô phỏng, 3-5 câu) bằng nhãn mô tả cụ thể. Nhóm các mã (của bạn và ít nhất 3-4 mã giả định khác) thành 2-3 chủ đề bằng axial coding.

### Nhóm 3-4 người (30 phút)

Đổi transcript đã mã hóa cho một người khác mã hóa độc lập cùng đoạn đó. So sánh nhãn — tạo bảng đồng thuận 2×2 nếu có thể quy về hai nhóm, và tính Kappa. Nếu Kappa thấp, thảo luận ngay tại sao hai người hiểu định nghĩa mã khác nhau.

### Bài tập về nhà (60 phút)

Viết phần báo cáo mã hóa cho luận văn/bài báo (200-300 từ): mô tả quy trình open coding → axial coding, bảng đồng thuận 2×2 thật hoặc giả định, và Kappa đã tính kèm diễn giải theo ngưỡng.

:::mau Mẫu nộp bài tập về nhà
**Mã mô tả (open coding, ít nhất 5 mã):** …

**Chủ đề sau axial coding:** …

**Bảng đồng thuận 2×2 giữa hai người mã hóa:** …

**Po, Pe, Kappa (tính từng bước):** …

**Diễn giải và bước tiếp theo (nếu Kappa thấp):** …
:::

### Nguồn tham khảo

- Cohen, J. (1960). A coefficient of agreement for nominal scales. *Educational and Psychological Measurement*, 20(1), 37-46.
- Landis, J. R., & Koch, G. G. (1977). The measurement of observer agreement for categorical data. *Biometrics*, 33(1), 159-174.
- Charmaz, K. (2014). *Constructing Grounded Theory* (2nd ed.). SAGE Publications. — về open coding và axial coding.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "xldl4-open-coding-cu-the",
                "type": "mcq",
                "prompt": "Một giảng viên nói 'tôi lo dần mình sẽ mất khả năng đánh giá bài viết tinh tế'. Nhãn open coding nào đúng cách nhất?",
                "explanation": "Open coding nên mô tả cụ thể, bám sát điều người tham gia thực sự nói. 'Lo mất kỹ năng đánh giá của bản thân' bám sát câu nói; 'đe dọa bản sắc nghề nghiệp' là trừu tượng hóa quá sớm, có thể không đúng hoàn toàn với ý người nói.",
                "points": 3,
                "options": [
                    {"label": "'Lo mất kỹ năng đánh giá của bản thân' — mô tả cụ thể, bám sát câu nói", "isCorrect": True},
                    {"label": "'Đe dọa bản sắc nghề nghiệp' — trừu tượng hóa ngay từ đầu", "isCorrect": False, "misconception": "xldl.code-too-abstract-early"},
                    {"label": "'Khủng hoảng tồn tại nghề nghiệp trong thời đại AI'", "isCorrect": False, "misconception": "xldl.code-too-abstract-early"},
                    {"label": "'Vấn đề tâm lý học đường'", "isCorrect": False, "misconception": "xldl.code-too-abstract-early"},
                ],
            },
            {
                "key": "xldl4-po-vs-kappa",
                "type": "mcq",
                "prompt": "Hai người mã hóa có tỉ lệ đồng thuận thô 75%. Vì sao không nên chỉ báo cáo con số này mà cần tính thêm Cohen's Kappa?",
                "explanation": "Tỉ lệ đồng thuận thô không trừ đi phần đồng thuận có thể xảy ra do ngẫu nhiên — nếu một nhóm chiếm đa số, hai người mã hóa ngẫu nhiên vẫn dễ 'trùng' mà không thực sự đồng ý. Kappa trừ đi phần này, cho một con số đáng tin hơn.",
                "points": 3,
                "options": [
                    {"label": "Tỉ lệ đồng thuận thô không trừ đi phần đồng thuận có thể xảy ra do ngẫu nhiên, nên có thể bị thổi phồng", "isCorrect": True},
                    {"label": "Không cần tính Kappa nếu tỉ lệ đồng thuận thô đã trên 70%", "isCorrect": False, "misconception": "xldl.agreement-percent-not-kappa"},
                    {"label": "Tỉ lệ đồng thuận thô luôn chính xác hơn Kappa nên không cần tính thêm", "isCorrect": False, "misconception": "xldl.agreement-percent-not-kappa"},
                    {"label": "Kappa chỉ cần tính khi có hơn hai người mã hóa", "isCorrect": False, "misconception": "xldl.agreement-percent-not-kappa"},
                ],
            },
            {
                "key": "xldl4-tinh-kappa",
                "type": "mcq",
                "prompt": "Với bảng đồng thuận ở bài học (Po = 0.75, Pe = 0.5), Kappa tính được là bao nhiêu?",
                "explanation": "Kappa = (Po − Pe) / (1 − Pe) = (0.75 − 0.5) / (1 − 0.5) = 0.25 / 0.5 = 0.5.",
                "points": 3,
                "options": [
                    {"label": "0.5", "isCorrect": True},
                    {"label": "0.75", "isCorrect": False},
                    {"label": "0.25", "isCorrect": False},
                    {"label": "1.25", "isCorrect": False},
                ],
            },
            {
                "key": "xldl4-kappa-thap-xu-ly",
                "type": "mcq",
                "prompt": "Hai người mã hóa tính được Kappa = 0.28 (mức kém theo Landis & Koch). Nên làm gì tiếp theo?",
                "explanation": "Kappa thấp là dấu hiệu cần hai người mã hóa ngồi lại thảo luận những đoạn mã khác nhau, làm rõ định nghĩa từng mã, trước khi tiếp tục mã hóa phần còn lại — không nên chỉ ghi vào báo cáo và tiếp tục như không có gì xảy ra.",
                "points": 3,
                "options": [
                    {"label": "Ngồi lại thảo luận các đoạn mã khác nhau, làm rõ định nghĩa mã, trước khi tiếp tục mã hóa phần còn lại", "isCorrect": True},
                    {"label": "Ghi Kappa = 0.28 vào báo cáo và tiếp tục mã hóa phần còn lại như bình thường", "isCorrect": False, "misconception": "xldl.kappa-low-ignored"},
                    {"label": "Bỏ hẳn việc tính Kappa vì kết quả không như mong đợi", "isCorrect": False, "misconception": "xldl.kappa-low-ignored"},
                    {"label": "Chỉ cần một người mã hóa lại toàn bộ một mình cho nhanh", "isCorrect": False, "misconception": "xldl.kappa-low-ignored"},
                ],
            },
            {
                "key": "xldl4-nguong-kappa",
                "type": "mcq",
                "prompt": "Theo ngưỡng Landis & Koch (1977), Kappa = 0.5 được xếp vào mức nào?",
                "explanation": "Theo ngưỡng thường dùng: dưới 0.4 là kém, 0.4-0.6 là trung bình (fair-moderate), 0.6-0.8 là tốt, trên 0.8 là rất tốt. Kappa = 0.5 rơi vào mức trung bình.",
                "points": 2,
                "options": [
                    {"label": "Trung bình (fair-moderate)", "isCorrect": True},
                    {"label": "Kém", "isCorrect": False},
                    {"label": "Tốt", "isCorrect": False},
                    {"label": "Rất tốt (excellent)", "isCorrect": False},
                ],
            },
            {
                "key": "xldl4-thu-tu-ma-hoa",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự quy trình mã hóa dữ liệu định tính có kiểm độ tin cậy.",
                "explanation": "Từ open coding mô tả cụ thể, nhóm thành chủ đề (axial coding), hai người mã hóa độc lập một phần dữ liệu, tính Kappa, tới thảo luận nếu Kappa thấp trước khi tiếp tục.",
                "points": 3,
                "sequence": [
                    "Mã hóa mô tả cụ thể (open coding) cho từng đoạn dữ liệu",
                    "Nhóm các mã mô tả thành chủ đề lớn hơn (axial coding)",
                    "Có người thứ hai mã hóa độc lập một phần dữ liệu",
                    "Tính Cohen's Kappa từ bảng đồng thuận giữa hai người",
                    "Nếu Kappa thấp, thảo luận định nghĩa mã trước khi mã hóa tiếp phần còn lại",
                ],
            },
            {
                "key": "xldl4-noi-khai-niem-ma-hoa",
                "type": "matching",
                "prompt": "Nối mỗi khái niệm với đúng vai trò của nó trong quy trình mã hóa định tính.",
                "explanation": "Open coding mô tả cụ thể; axial coding nhóm mã thành chủ đề; Po là tỉ lệ đồng thuận thô; Kappa trừ đi phần đồng thuận do ngẫu nhiên để cho con số đáng tin hơn.",
                "points": 3,
                "pairs": [
                    {"left": "Open coding", "right": "Gắn nhãn mô tả cụ thể cho từng đoạn dữ liệu"},
                    {"left": "Axial coding", "right": "Nhóm các mã mô tả thành chủ đề lớn hơn"},
                    {"left": "Po (tỉ lệ đồng thuận thô)", "right": "Số lần hai người chọn giống nhau chia cho tổng số"},
                    {"left": "Cohen's Kappa", "right": "Đồng thuận thật sau khi trừ đi phần có thể do ngẫu nhiên"},
                ],
            },
            {
                "key": "xldl4-tinh-kappa-moi",
                "type": "essay",
                "prompt": "Cho bảng đồng thuận mới giữa hai người mã hóa 25 đoạn dữ liệu vào 2 nhóm (A/B): Người 1 chọn A cho 15 đoạn, B cho 10 đoạn; Người 2 chọn A cho 12 đoạn, B cho 13 đoạn; số đoạn cả hai cùng chọn A là 10. Viết 150-200 từ: (a) dựng bảng đồng thuận 2×2 đầy đủ; (b) tính Po, Pe, Kappa từng bước; (c) diễn giải mức Kappa theo ngưỡng Landis & Koch và đề xuất bước tiếp theo.",
                "points": 5,
            },
        ],
    },
}
