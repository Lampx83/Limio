# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3 · Đọc bảng EFA và độ tin cậy",
    "durationMin": 90,
    "description": "Kiểm KMO và Bartlett's Test trước khi tin kết quả EFA; đọc ma trận factor loading để quyết định giữ, loại, hay viết lại từng item; tính lại Cronbach's Alpha sau khi đã điều chỉnh cấu trúc theo EFA, không dùng con số ban đầu.",
    "objectives": [
        "Đọc và diễn giải đúng KMO và Bartlett's Test of Sphericity trước khi tin vào kết quả EFA",
        "Áp dụng quy tắc Kaiser (eigenvalue > 1) để xác định số lượng nhân tố cần trích xuất, đối chiếu với lý thuyết nền khi cần",
        "Đọc một ma trận factor loading thật để quyết định giữ, loại, hay xem xét viết lại từng item, bao gồm item cross-loading",
        "Tính lại Cronbach's Alpha cho cấu trúc construct đã điều chỉnh sau EFA, không dùng con số Alpha tính trên bộ item ban đầu",
        "Tổng hợp một quy trình EFA hoàn chỉnh từ dữ liệu thô tới cấu trúc construct cuối cùng đã xác nhận",
    ],
    "summary": [
        "KMO nên đạt tối thiểu 0.6 (tốt hơn nếu ≥ 0.8) và Bartlett's Test cần có p < 0.05 trước khi tin vào bất kỳ kết quả EFA nào — hai chỉ số này xác nhận dữ liệu đủ tương quan để chạy phân tích nhân tố có ý nghĩa.",
        "Quy tắc Kaiser (chỉ giữ nhân tố có eigenvalue > 1) quyết định số lượng nhân tố trích xuất — khi eigenvalue nhân tố kế tiếp gần sát 1, cần đối chiếu thêm với scree plot và lý thuyết nền, không áp máy móc một quy tắc.",
        "Loading từ 0.4-0.5 trở lên (tuỳ quy ước ngành) mới coi là item 'load' vào một nhân tố; item cross-loading (load cao ở nhiều nhân tố) hoặc loading thấp ở mọi nhân tố cần được xem xét loại hoặc viết lại, không giữ nguyên như dự kiến ban đầu.",
        "Sau khi loại hoặc thay đổi item dựa trên EFA, Cronbach's Alpha phải được tính lại cho cấu trúc construct đã điều chỉnh — báo cáo Alpha tính trên bộ item ban đầu (trước điều chỉnh) là báo cáo sai con số cho cấu trúc thực tế sẽ dùng.",
        "Một quy trình EFA hoàn chỉnh đi theo thứ tự: kiểm KMO/Bartlett's → trích xuất và xoay nhân tố → đọc ma trận loading để quyết định cấu trúc cuối cùng → tính lại độ tin cậy cho cấu trúc đó.",
    ],
    "splitSections": True,
    "body": r"""
Khoá Phương pháp nghiên cứu đã giải thích *vì sao* cần EFA. Bài này đọc từng bảng output thật, theo đúng thứ tự, với một ví dụ cụ thể: 6 item dự kiến đo hai construct (Hài lòng, Nhận thức hữu ích) — bắt đầu từ kiểm KMO và Bartlett's Test trước khi tin bất kỳ kết quả nào, xác định số nhân tố cần trích xuất theo quy tắc Kaiser, đọc ma trận factor loading để quyết định giữ/loại/viết lại từng item, và kết bằng việc tính lại Cronbach's Alpha cho cấu trúc đã điều chỉnh. Phần luyện tập và tài liệu tham khảo ở cuối giúp áp dụng cả quy trình này trên dữ liệu của người học.

## Kiểm điều kiện trước khi chạy EFA

Trước khi nhìn vào bất kỳ hệ số tải nào, hai chỉ số sau quyết định EFA có đáng tin không.

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">KMO and Bartlett's Test
Kaiser-Meyer-Olkin Measure of Sampling Adequacy       0.71
Bartlett's Test of Sphericity    Approx. Chi-Square    142.30
                                 df                     15
                                 Sig.                   0.000</pre></div>
```

> [!ghi-nho] **KMO (Kaiser-Meyer-Olkin)** đo mức độ phù hợp của dữ liệu cho EFA — ngưỡng tối thiểu thường dùng là **0.6**, từ 0.8 trở lên được coi là tốt. **Bartlett's Test of Sphericity** kiểm giả thuyết ma trận tương quan giữa các item là ma trận đơn vị (các item không tương quan với nhau) — cần **Sig. < 0.05** để bác bỏ giả thuyết này, xác nhận các item đủ tương quan để phân tích nhân tố có ý nghĩa.

> [!canh-bao] Chạy EFA và đọc thẳng bảng factor loading mà không kiểm KMO và Bartlett's trước là bỏ qua bước xác nhận dữ liệu có đáng để phân tích nhân tố hay không. Với ví dụ trên, KMO = 0.71 (đạt) và Bartlett's Sig. = 0.000 (đạt) — dữ liệu đủ điều kiện để tin vào bước tiếp theo.

## Xác định số lượng nhân tố cần trích xuất

Trước khi đọc ma trận loading, cần biết **trích xuất bao nhiêu nhân tố** — quyết định này ảnh hưởng trực tiếp tới toàn bộ ma trận loading đọc ở bước sau. Với 6 item ở ví dụ này, bảng Total Variance Explained:

| Nhân tố | Eigenvalue | % Phương sai | % Tích lũy |
|---|---|---|---|
| 1 | 2.81 | 46.83 | 46.83 |
| 2 | 1.34 | 22.33 | 69.16 |
| 3 | 0.68 | 11.33 | 80.49 |
| 4 | 0.52 | 8.67 | 89.16 |
| 5 | 0.38 | 6.33 | 95.49 |
| 6 | 0.27 | 4.51 | 100.00 |

> [!ghi-nho] Quy tắc **Kaiser (eigenvalue > 1)**: chỉ giữ lại các nhân tố có eigenvalue lớn hơn 1 — ở bảng trên, chỉ Nhân tố 1 (2.81) và Nhân tố 2 (1.34) đạt ngưỡng này, khớp với kỳ vọng lý thuyết là 2 construct (Hài lòng, Nhận thức hữu ích). Hai nhân tố này giải thích được 69.16% tổng phương sai — mức chấp nhận được (thường ngưỡng tối thiểu 60% trong khoa học xã hội).

> [!canh-bao] Quy tắc Kaiser chỉ là điểm khởi đầu, không phải quyết định cuối cùng. Khi eigenvalue của nhân tố kế tiếp nằm sát ngưỡng 1 (ví dụ 0.95-1.05), cần đối chiếu thêm với **scree plot** (biểu đồ eigenvalue theo thứ tự nhân tố — tìm điểm "gãy khuỷu tay", nơi đường bắt đầu phẳng lại) và với **số construct dự kiến theo khung lý thuyết** trước khi chốt số nhân tố, không áp máy móc chỉ một quy tắc.

## Đọc ma trận factor loading

Với 6 item dự kiến đo 2 construct (Q1-Q3 cho Hài lòng, Q4-Q6 cho Nhận thức hữu ích), ma trận loading sau khi xoay (rotated) như sau:

| Item | Nhân tố 1 | Nhân tố 2 |
|---|---|---|
| Q1 | 0.81 | 0.12 |
| Q2 | 0.76 | 0.15 |
| Q3 | 0.45 | **0.52** |
| Q4 | 0.10 | 0.79 |
| Q5 | 0.18 | 0.74 |
| Q6 | 0.22 | 0.31 |

> [!ghi-nho] Item **"load"** vào một nhân tố khi hệ số tải đạt ngưỡng (thường **0.4-0.5** trở lên, tuỳ quy ước ngành) ở đúng một nhân tố, và thấp ở các nhân tố còn lại. Q1, Q2 load rõ vào Nhân tố 1; Q4, Q5 load rõ vào Nhân tố 2 — đây là cấu trúc mong đợi.

> [!canh-bao] Hai item trong bảng trên có vấn đề: **Q3** load gần bằng nhau ở cả hai nhân tố (0.45 và 0.52) — đây là **cross-loading**, dấu hiệu item này không đo rõ một khái niệm duy nhất, có thể do câu hỏi mơ hồ hoặc thực chất đo một khái niệm pha trộn cả hai. **Q6** không load đủ mạnh ở nhân tố nào (0.22 và 0.31, cả hai dưới ngưỡng 0.4) — item này không đo tốt bất kỳ construct nào trong mô hình.

> [!vi-du] Với Q3 (cross-loading) và Q6 (loading thấp), quyết định hợp lý là: loại cả hai khỏi cấu trúc construct cuối cùng, hoặc — nếu về mặt nội dung hai item này quan trọng — xem lại cách viết câu hỏi (có thể Q3 đang hỏi lẫn cả hài lòng và nhận thức hữu ích trong một câu) và thu thập lại dữ liệu thí điểm với câu hỏi đã sửa trước khi dùng cho nghiên cứu chính thức. **Không nên giữ nguyên Q3 và Q6** trong cấu trúc construct chỉ vì đã viết sẵn từ đầu.

## Tính lại độ tin cậy sau khi điều chỉnh cấu trúc

> [!canh-bao] Sau khi loại Q3 và Q6 dựa trên kết quả EFA, Cronbach's Alpha **phải được tính lại** cho cấu trúc mới — Alpha ban đầu tính trên 3 item Q1-Q3 (bao gồm Q3 có vấn đề) không còn phản ánh đúng construct Hài lòng sẽ thực sự dùng trong phân tích (chỉ còn Q1, Q2).

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Trước khi loại Q3:  Hài lòng (Q1, Q2, Q3)     Cronbach's Alpha = 0.74
Sau khi loại Q3:    Hài lòng (Q1, Q2)          Cronbach's Alpha = 0.81</pre></div>
```

> [!ghi-nho] Trong ví dụ này, Alpha thực ra **tăng** sau khi loại Q3 — dấu hiệu cho thấy Q3 đang làm giảm độ nhất quán nội bộ của construct, càng xác nhận quyết định loại là đúng. Báo cáo con số Alpha = 0.74 (tính trên bộ item ban đầu) trong bài báo/luận văn khi cấu trúc thực tế đã đổi là báo cáo sai con số cho construct sẽ dùng trong các phân tích tiếp theo.

## Luyện tập và tài liệu tham khảo

### Cá nhân (40 phút)

Với dữ liệu của bạn (thật hoặc thí điểm), chạy hoặc mô phỏng EFA: ghi lại KMO, Bartlett's Sig., và ma trận loading. Xác định item nào cross-loading hoặc loading thấp, quyết định giữ/loại/viết lại, và tính lại Cronbach's Alpha cho cấu trúc đã điều chỉnh.

### Nhóm 3-4 người (25 phút)

Đổi ma trận loading cho nhau. Với mỗi ma trận, tìm item có vấn đề (cross-loading hoặc loading thấp) mà người làm có thể đã bỏ sót. Thảo luận: nên loại item hay viết lại và thu thập lại — khi nào chọn cách nào?

### Bài tập về nhà (60 phút)

Viết phần báo cáo EFA cho Chương 4/phần Kết quả (250-350 từ): KMO, Bartlett's, bảng loading đầy đủ, quyết định về từng item có vấn đề, và Cronbach's Alpha đã tính lại cho cấu trúc cuối cùng.

:::mau Mẫu nộp bài tập về nhà
**KMO:** … **Bartlett's Sig.:** …

**Ma trận loading (đầy đủ các item):** …

**Item có vấn đề và quyết định:** …

**Cronbach's Alpha trước và sau điều chỉnh, cho từng construct:** …
:::

### Nguồn tham khảo

- Tabachnick, B. G., & Fidell, L. S. (2019). *Using Multivariate Statistics* (7th ed.). Pearson.
- Kaiser, H. F. (1974). An index of factorial simplicity. *Psychometrika*, 39(1), 31-36.
- Hair, J. F., Black, W. C., Babin, B. J., & Anderson, R. E. (2019). *Multivariate Data Analysis* (8th ed.). Cengage Learning.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "xldl3-kmo-bartlett-truoc",
                "type": "mcq",
                "prompt": "Vì sao cần kiểm KMO và Bartlett's Test trước khi đọc ma trận factor loading?",
                "explanation": "KMO và Bartlett's xác nhận dữ liệu đủ tương quan và phù hợp để phân tích nhân tố có ý nghĩa — chạy EFA và đọc loading mà không kiểm hai chỉ số này trước là bỏ qua bước xác nhận dữ liệu có đáng phân tích hay không.",
                "points": 3,
                "options": [
                    {"label": "Để xác nhận dữ liệu đủ tương quan và phù hợp cho phân tích nhân tố có ý nghĩa trước khi tin vào loading", "isCorrect": True},
                    {"label": "Không cần thiết, factor loading luôn đáng tin bất kể KMO và Bartlett's cho kết quả gì", "isCorrect": False, "misconception": "xldl.efa-skip-kmo-bartlett"},
                    {"label": "Chỉ cần thiết khi cỡ mẫu dưới 100", "isCorrect": False, "misconception": "xldl.efa-skip-kmo-bartlett"},
                    {"label": "Chỉ là bước hình thức, không ảnh hưởng tới việc diễn giải loading", "isCorrect": False, "misconception": "xldl.efa-skip-kmo-bartlett"},
                ],
            },
            {
                "key": "xldl3-doc-kmo",
                "type": "mcq",
                "prompt": "KMO = 0.71 và Bartlett's Sig. = 0.000. Kết luận nào đúng?",
                "explanation": "KMO = 0.71 vượt ngưỡng tối thiểu 0.6, và Bartlett's Sig. = 0.000 < 0.05 xác nhận các item đủ tương quan — dữ liệu đủ điều kiện để tin vào kết quả EFA tiếp theo.",
                "points": 2,
                "options": [
                    {"label": "Dữ liệu đủ điều kiện để chạy và tin vào kết quả EFA", "isCorrect": True},
                    {"label": "Dữ liệu không đủ điều kiện vì KMO dưới 0.8", "isCorrect": False},
                    {"label": "Không thể kết luận gì nếu chưa biết cỡ mẫu cụ thể", "isCorrect": False},
                    {"label": "Bartlett's Sig. = 0.000 cho thấy dữ liệu không phù hợp để chạy EFA", "isCorrect": False},
                ],
            },
            {
                "key": "xldl3-quy-tac-kaiser",
                "type": "mcq",
                "prompt": "Bảng Total Variance Explained cho 6 nhân tố với eigenvalue lần lượt là 2.81, 1.34, 0.68, 0.52, 0.38, 0.27. Theo quy tắc Kaiser, nên giữ lại bao nhiêu nhân tố?",
                "explanation": "Quy tắc Kaiser chỉ giữ lại nhân tố có eigenvalue lớn hơn 1 — ở đây chỉ Nhân tố 1 (2.81) và Nhân tố 2 (1.34) đạt ngưỡng này, khớp với 2 construct dự kiến theo lý thuyết.",
                "points": 3,
                "options": [
                    {"label": "2 nhân tố — chỉ Nhân tố 1 và Nhân tố 2 có eigenvalue lớn hơn 1", "isCorrect": True},
                    {"label": "6 nhân tố — giữ tất cả vì mỗi nhân tố đều giải thích một phần phương sai", "isCorrect": False, "misconception": "xldl.wrong-factor-count"},
                    {"label": "1 nhân tố — chỉ giữ nhân tố có eigenvalue cao nhất", "isCorrect": False, "misconception": "xldl.wrong-factor-count"},
                    {"label": "Không thể xác định nếu chưa có ma trận factor loading", "isCorrect": False, "misconception": "xldl.wrong-factor-count"},
                ],
            },
            {
                "key": "xldl3-cross-loading",
                "type": "mcq",
                "prompt": "Item Q3 có loading 0.45 ở Nhân tố 1 và 0.52 ở Nhân tố 2. Nên xử lý thế nào?",
                "explanation": "Đây là cross-loading — item không load rõ vào một nhân tố duy nhất. Nên xem xét loại item này hoặc viết lại câu hỏi và thu thập lại dữ liệu, không giữ nguyên trong cấu trúc construct.",
                "points": 3,
                "options": [
                    {"label": "Xem xét loại item này khỏi cấu trúc construct, hoặc viết lại câu hỏi và thu thập lại dữ liệu thí điểm", "isCorrect": True},
                    {"label": "Giữ nguyên item này trong construct có loading cao hơn (Nhân tố 2) vì 0.52 > 0.45", "isCorrect": False, "misconception": "xldl.keep-crossloading-item"},
                    {"label": "Giữ nguyên item này ở cả hai construct vì cả hai loading đều trên 0.4", "isCorrect": False, "misconception": "xldl.keep-crossloading-item"},
                    {"label": "Không cần làm gì, cross-loading là hiện tượng bình thường không ảnh hưởng gì", "isCorrect": False, "misconception": "xldl.keep-crossloading-item"},
                ],
            },
            {
                "key": "xldl3-tinh-lai-alpha",
                "type": "mcq",
                "prompt": "Sau khi loại Q3 khỏi construct Hài lòng dựa trên kết quả EFA, Cronbach's Alpha ban đầu (tính trên Q1, Q2, Q3) là 0.74. Bước tiếp theo đúng là gì?",
                "explanation": "Cần tính lại Cronbach's Alpha cho cấu trúc mới (chỉ còn Q1, Q2) — Alpha ban đầu không còn phản ánh đúng construct sẽ thực sự dùng trong các phân tích tiếp theo.",
                "points": 3,
                "options": [
                    {"label": "Tính lại Cronbach's Alpha chỉ với Q1 và Q2, và báo cáo con số mới cho cấu trúc đã điều chỉnh", "isCorrect": True},
                    {"label": "Giữ báo cáo Alpha = 0.74 vì đó là con số đã tính được ban đầu", "isCorrect": False, "misconception": "xldl.alpha-not-recalculated"},
                    {"label": "Không cần tính lại Alpha nếu đã loại item theo đúng kết quả EFA", "isCorrect": False, "misconception": "xldl.alpha-not-recalculated"},
                    {"label": "Báo cáo cả hai con số Alpha như nhau vì chúng đo cùng một khái niệm", "isCorrect": False, "misconception": "xldl.alpha-not-recalculated"},
                ],
            },
            {
                "key": "xldl3-loading-thap",
                "type": "mcq",
                "prompt": "Item Q6 có loading 0.22 ở Nhân tố 1 và 0.31 ở Nhân tố 2, cả hai dưới ngưỡng 0.4. Điều này gợi ý gì?",
                "explanation": "Loading thấp ở mọi nhân tố nghĩa là item này không đo tốt bất kỳ construct nào trong mô hình hiện tại — cần xem xét loại khỏi cấu trúc.",
                "points": 2,
                "options": [
                    {"label": "Item này không đo tốt bất kỳ construct nào trong mô hình, nên xem xét loại", "isCorrect": True},
                    {"label": "Item này đo một construct thứ ba chưa được tính tới trong mô hình", "isCorrect": False},
                    {"label": "Item này vẫn nên giữ vì mọi item trong bảng hỏi ban đầu đều quan trọng", "isCorrect": False},
                    {"label": "Loading thấp không có ý nghĩa gì, chỉ cần quan tâm tới Cronbach's Alpha tổng", "isCorrect": False},
                ],
            },
            {
                "key": "xldl3-thu-tu-efa",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước thực hiện EFA từ dữ liệu thô tới cấu trúc construct cuối cùng.",
                "explanation": "Từ kiểm KMO/Bartlett's, xác định số nhân tố theo eigenvalue, trích xuất và xoay nhân tố, đọc ma trận loading để quyết định cấu trúc, tới tính lại độ tin cậy cho cấu trúc đã điều chỉnh.",
                "points": 3,
                "sequence": [
                    "Kiểm KMO và Bartlett's Test of Sphericity",
                    "Xác định số lượng nhân tố cần trích xuất theo quy tắc Kaiser (eigenvalue > 1)",
                    "Trích xuất nhân tố và xoay (rotation) ma trận loading",
                    "Đọc ma trận loading, xác định item cross-loading hoặc loading thấp",
                    "Quyết định giữ, loại, hoặc viết lại từng item có vấn đề",
                    "Tính lại Cronbach's Alpha cho cấu trúc construct đã điều chỉnh",
                ],
            },
            {
                "key": "xldl3-noi-chi-so-efa",
                "type": "matching",
                "prompt": "Nối mỗi chỉ số hoặc khái niệm với đúng vai trò của nó trong EFA.",
                "explanation": "KMO đo độ phù hợp dữ liệu; Bartlett's kiểm các item có đủ tương quan; cross-loading là item load cao ở nhiều nhân tố; Cronbach's Alpha sau điều chỉnh phản ánh đúng cấu trúc cuối cùng.",
                "points": 3,
                "pairs": [
                    {"left": "KMO", "right": "Đo mức độ phù hợp của dữ liệu cho phân tích nhân tố"},
                    {"left": "Bartlett's Test of Sphericity", "right": "Kiểm các item có đủ tương quan với nhau để phân tích"},
                    {"left": "Cross-loading", "right": "Item load cao ở nhiều nhân tố, không đo rõ một khái niệm"},
                    {"left": "Cronbach's Alpha sau điều chỉnh", "right": "Phản ánh đúng độ tin cậy của cấu trúc construct cuối cùng"},
                ],
            },
            {
                "key": "xldl3-doc-ma-tran-loading",
                "type": "essay",
                "prompt": "Cho ma trận loading ở mục 2 của bài học (6 item, 2 nhân tố). Viết đoạn 150-200 từ: (a) xác định item nào load tốt, item nào có vấn đề (cross-loading hoặc loading thấp); (b) quyết định của bạn cho mỗi item có vấn đề; (c) cấu trúc construct cuối cùng (item nào thuộc construct nào) sau khi đã điều chỉnh.",
                "points": 5,
            },
        ],
    },
}
