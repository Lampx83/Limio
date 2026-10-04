# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3 · Phương pháp nghiên cứu nâng cao",
    "durationMin": 100,
    "description": "Kiểm định hiệu ứng trung gian có điều kiện (moderated mediation) khi lý thuyết đòi hỏi; kiểm đo lường bất biến trước khi so sánh mô hình giữa các nhóm; dùng manipulation check trong thiết kế thực nghiệm; hiểu vì sao longitudinal design xác lập nhân quả tốt hơn hai lần đo cắt ngang.",
    "objectives": [
        "Nhận diện khi nào lý thuyết đòi hỏi một mô hình moderated mediation tích hợp, thay vì kiểm mediation và moderation riêng rẽ",
        "Kiểm đo lường bất biến (measurement invariance) trước khi so sánh path coefficient giữa các nhóm trong multi-group analysis",
        "Thiết kế và diễn giải đúng manipulation check trong một thiết kế thực nghiệm trước khi đọc kết quả biến phụ thuộc",
        "Giải thích được vì sao longitudinal design xác lập trình tự thời gian tốt hơn thiết kế hai lần đo, và giới hạn còn lại của nó với các yếu tố gây nhiễu",
    ],
    "summary": [
        "Khi lý thuyết đề xuất một hiệu ứng trung gian thay đổi theo mức của một biến điều tiết, cần một mô hình moderated mediation tích hợp — chạy riêng hai mô hình mediation và moderation làm mất thông tin về việc hiệu ứng trung gian mạnh hay yếu ở điều kiện nào.",
        "So sánh path coefficient giữa các nhóm (multi-group analysis) chỉ có ý nghĩa sau khi đã xác nhận đo lường bất biến — nếu thang đo không đo cùng một cách giữa các nhóm, sự khác biệt về path có thể do khác biệt đo lường, không phải khác biệt thật về mối quan hệ.",
        "Manipulation check xác nhận can thiệp thực nghiệm có thực sự tạo ra sự khác biệt ở biến độc lập như dự kiến — không kiểm bước này trước khi đọc kết quả biến phụ thuộc là đọc một kết quả không rõ nguyên nhân thật.",
        "Longitudinal design (đo nhiều lần theo thời gian) xác lập được trình tự thời gian, điều mà thiết kế cắt ngang không làm được — nhưng ngay cả thiết kế hai lần đo cũng chưa đủ để khẳng định nhân quả hoàn toàn nếu các yếu tố gây nhiễu chưa được kiểm soát.",
    ],
    "splitSections": True,
    "body": r"""
Các kỹ thuật ở khoá Phương pháp nghiên cứu (SEM/PLS-SEM cơ bản, mediation, moderation riêng lẻ) đủ cho một luận văn. Reviewer của tạp chí quốc tế thường kỳ vọng một bước sâu hơn khi lý thuyết của bạn đòi hỏi: bài đi qua bốn kỹ thuật nâng cao, từ moderated mediation khi hiệu ứng trung gian thay đổi theo một biến điều tiết, tới kiểm đo lường bất biến trước khi so sánh mô hình giữa các nhóm, dùng manipulation check để xác nhận can thiệp thực nghiệm có hiệu quả, và kết bằng longitudinal design cùng giới hạn thật của nó trong việc xác lập nhân quả.

## Hiệu ứng trung gian có điều kiện: moderated mediation

> [!ghi-nho] **Moderated mediation** kiểm định khi một hiệu ứng trung gian (indirect effect, đã học ở khoá Phương pháp nghiên cứu) **thay đổi độ mạnh tuỳ theo mức của một biến điều tiết** — gọi là **conditional indirect effect**. Đây khác với việc chỉ có một mediator hoặc chỉ có một moderator riêng lẻ.

> [!canh-bao] Nếu lý thuyết của bạn thực chất đề xuất "cơ chế trung gian này chỉ hoạt động mạnh trong một số điều kiện" — ví dụ hiệu ứng trung gian của "ý định sử dụng" giữa nhận thức hữu ích và hành vi sử dụng chỉ mạnh ở người có kinh nghiệm công nghệ thấp — chạy riêng một mô hình mediation và một mô hình moderation sẽ **mất thông tin quan trọng nhất**: bạn sẽ biết có trung gian, biết có điều tiết, nhưng không biết trung gian đó mạnh/yếu ở điều kiện nào.

> [!vi-du] Một nghiên cứu kiểm mô hình: nhận thức hữu ích → ý định sử dụng (mediator) → hành vi sử dụng, với kinh nghiệm công nghệ là moderator trên đường dẫn ý định → hành vi. Chạy moderated mediation cho thấy conditional indirect effect có ý nghĩa ở nhóm kinh nghiệm thấp (β = 0.38, p < 0.01) nhưng không có ý nghĩa ở nhóm kinh nghiệm cao (β = 0.06, p = 0.41) — một phát hiện chỉ nhìn thấy được khi hai cơ chế được kiểm cùng lúc trong một mô hình tích hợp.

> [!ghi-nho] Ngoài việc so sánh conditional indirect effect ở từng mức riêng lẻ (thấp/cao), cách báo cáo chặt chẽ hơn là **index of moderated mediation (Hayes, 2015)** — một chỉ số duy nhất kiểm định trực tiếp xem độ dốc của conditional indirect effect theo moderator có khác 0 hay không (tức là bản thân sự "thay đổi theo moderator" có ý nghĩa thống kê, chứ không chỉ suy luận gián tiếp từ việc một điều kiện có ý nghĩa còn điều kiện kia thì không). Với ví dụ trên, index = −0.021 (khoảng tin cậy bootstrap 95% [−0.038, −0.006], không chứa 0) xác nhận độ mạnh của hiệu ứng trung gian **thực sự giảm dần** khi kinh nghiệm công nghệ tăng lên — một kết luận mạnh hơn việc chỉ nói "có ý nghĩa ở nhóm này, không ở nhóm kia" (hai nhóm có thể "trông khác nhau" mà bản thân sự khác biệt đó lại không có ý nghĩa thống kê nếu không kiểm trực tiếp).

## Multi-group analysis: kiểm đo lường bất biến trước khi so sánh

Nghiên cứu công bố quốc tế thường so sánh mô hình giữa các nhóm (nam/nữ, các quốc gia, các ngành...) — nhưng bước này có một điều kiện tiên quyết hay bị bỏ qua.

> [!canh-bao] So sánh trực tiếp path coefficient giữa hai nhóm mà chưa kiểm **đo lường bất biến (measurement invariance)** là lỗi phổ biến nhất trong multi-group analysis (MGA). Nếu thang đo không đo cùng một cách ở hai nhóm (ví dụ một item được hiểu khác nhau giữa nam và nữ), sự khác biệt về path coefficient giữa hai nhóm có thể do khác biệt trong cách đo lường, không phải do khác biệt thật trong mối quan hệ giữa các biến.

> [!ghi-nho] Quy trình MGA đúng thứ tự: kiểm **configural invariance** (cấu trúc mô hình giống nhau giữa các nhóm) → **metric invariance** (hệ số tải factor loading tương đương giữa các nhóm) → chỉ khi đã đạt các bước này mới so sánh path coefficient giữa các nhóm bằng kiểm định (ví dụ permutation test trong PLS-SEM, hoặc chi-square difference test trong CB-SEM).

Với CB-SEM, metric invariance được kiểm bằng cách so sánh độ khớp mô hình giữa hai mô hình lồng nhau (nested): mô hình để factor loading tự do ước lượng riêng cho từng nhóm, so với mô hình ràng buộc factor loading bằng nhau giữa các nhóm.

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Mô hình configural (loading tự do từng nhóm)     CFI = 0.951
Mô hình metric (loading ràng buộc bằng nhau)     CFI = 0.947
ΔCFI = 0.951 − 0.947 = 0.004</pre></div>
```

> [!ghi-nho] Ngưỡng thường dùng (Cheung & Rensvold, 2002): **ΔCFI ≤ 0.01** giữa hai mô hình lồng nhau được coi là đạt metric invariance — ràng buộc loading bằng nhau giữa các nhóm không làm độ khớp mô hình xấu đi đáng kể. Với ví dụ trên, ΔCFI = 0.004 < 0.01 → đạt metric invariance, có thể tiến tới so sánh path coefficient giữa hai nhóm một cách đáng tin cậy.

> [!canh-bao] ΔCFI vượt 0.01 (ví dụ 0.025) nghĩa là thang đo **không đo cùng một cách** giữa hai nhóm — dừng lại ở đây, không so sánh path coefficient. Bước tiếp theo là tìm item nào gây ra sự không bất biến (partial invariance) trước khi quyết định có thể so sánh phần còn lại của mô hình hay không, không phải bỏ qua cảnh báo và so sánh path như bình thường.

## Manipulation check trong thiết kế thực nghiệm

Khi đóng góp của bạn cần khẳng định nhân quả mạnh hơn những gì một mô hình cắt ngang (SEM/PLS-SEM) cho phép, thiết kế thực nghiệm hoặc bán thực nghiệm (quasi-experimental) là công cụ phù hợp — nhưng cần một bước kiểm tra trước khi đọc kết quả chính.

> [!ghi-nho] **Manipulation check** là bước kiểm tra can thiệp thực nghiệm có thực sự tạo ra sự khác biệt ở biến độc lập **như dự kiến** hay không, trước khi nhìn vào kết quả biến phụ thuộc. Ví dụ: nếu thí nghiệm định tạo ra hai mức "tin tưởng vào AI" (cao/thấp) bằng cách cho hai nhóm đọc hai đoạn văn khác nhau, cần đo lại mức tin tưởng thật của người tham gia sau khi đọc — không giả định đoạn văn chắc chắn tạo ra đúng hiệu ứng dự kiến.

> [!canh-bao] Bỏ qua manipulation check và đọc thẳng kết quả biến phụ thuộc là đọc một kết quả **không rõ nguyên nhân thật**: nếu can thiệp không thực sự tạo ra sự khác biệt ở biến độc lập (manipulation thất bại), một kết quả không có ý nghĩa ở biến phụ thuộc có thể là do manipulation yếu, không phải do lý thuyết sai — hai kết luận rất khác nhau.

## Longitudinal design và giới hạn còn lại của nó

> [!ghi-nho] **Longitudinal design** (đo cùng một mẫu ở nhiều thời điểm) xác lập được **trình tự thời gian** giữa các biến — điều kiện cần (nhưng chưa đủ) cho việc khẳng định nhân quả, và điều mà thiết kế cắt ngang (đã học ở Bài 5, khoá Phương pháp nghiên cứu) không làm được. Mô hình **cross-lagged panel** (đo X và Y ở cả hai thời điểm, kiểm cả hai chiều tác động) cho phép so sánh: X ở T1 dự báo Y ở T2 mạnh hơn, hay Y ở T1 dự báo X ở T2 mạnh hơn.

> [!canh-bao] Chỉ đo hai lần (T1, T2) và thấy X ở T1 dự báo Y ở T2 có ý nghĩa thống kê **chưa đủ** để khẳng định nhân quả hoàn toàn — trình tự thời gian là một điều kiện cần, nhưng các yếu tố gây nhiễu (confounders) không được đo và kiểm soát vẫn có thể tạo ra mối quan hệ giả. Longitudinal design cải thiện đáng kể so với cắt ngang, nhưng không thay thế được một thiết kế thực nghiệm có phân nhóm ngẫu nhiên nếu mục tiêu là khẳng định nhân quả chắc chắn.

## Luyện tập và tài liệu tham khảo

### Cá nhân (45 phút)

Xem lại khung lý thuyết của bạn: có mối quan hệ nào thực chất là moderated mediation (một mediator mà độ mạnh thay đổi theo một moderator) mà bạn đang định kiểm riêng rẽ không? Nếu đề tài của bạn so sánh giữa các nhóm, viết quy trình kiểm đo lường bất biến trước khi so sánh path. Nếu dùng thiết kế thực nghiệm, viết cách bạn sẽ đo manipulation check.

### Nhóm 3-4 người (30 phút)

Phản biện chéo: với thiết kế multi-group, hỏi "bạn đã kiểm configural và metric invariance trước khi so sánh path chưa?" Với thiết kế thực nghiệm, hỏi "manipulation check của bạn đo được gì, và nếu nó thất bại thì bạn sẽ diễn giải kết quả biến phụ thuộc thế nào?"

### Bài tập về nhà (90 phút)

Viết phần Phương pháp nâng cao cho bài báo (300-400 từ): mô tả kỹ thuật cụ thể sẽ dùng (moderated mediation, multi-group analysis, thiết kế thực nghiệm, hoặc longitudinal), quy trình kiểm định đi kèm (invariance, manipulation check...), và lý do kỹ thuật này phù hợp với câu hỏi/lý thuyết của bạn.

:::mau Mẫu nộp bài tập về nhà
**Kỹ thuật nâng cao đã chọn:** ☐ Moderated mediation ☐ Multi-group analysis ☐ Thiết kế thực nghiệm ☐ Longitudinal

**Lý do chọn (nối với lý thuyết/câu hỏi):** …

**Quy trình kiểm định đi kèm:** …

**Kết quả dự kiến nếu giả thuyết đúng, và nếu giả thuyết sai:** …
:::

### Nguồn tham khảo

- Hayes, A. F. (2022). *Introduction to Mediation, Moderation, and Conditional Process Analysis* (3rd ed.). Guilford Press.
- Henseler, J., Ringle, C. M., & Sarstedt, M. (2016). Testing measurement invariance of composites using partial least squares. *International Marketing Review*, 33(3), 405-431.
- Perdue, B. C., & Summers, J. O. (1986). Checking the success of manipulations in marketing experiments. *Journal of Marketing Research*, 23(4), 317-326.
- Ployhart, R. E., & Vandenberg, R. J. (2010). Longitudinal research: The theory, design, and analysis of change. *Journal of Management*, 36(1), 94-120.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "cbqt3-moderated-mediation",
                "type": "mcq",
                "prompt": "Lý thuyết cho rằng hiệu ứng trung gian của 'ý định sử dụng' chỉ mạnh ở người có kinh nghiệm công nghệ thấp, yếu ở người kinh nghiệm cao. Cách kiểm định nào đúng?",
                "explanation": "Đây là một moderated mediation: hiệu ứng trung gian thay đổi theo mức của biến điều tiết. Chạy riêng mediation và moderation làm mất thông tin về việc hiệu ứng trung gian mạnh/yếu ở điều kiện nào.",
                "points": 3,
                "options": [
                    {"label": "Chạy một mô hình moderated mediation tích hợp để kiểm conditional indirect effect ở từng mức của biến điều tiết", "isCorrect": True},
                    {"label": "Chạy riêng một mô hình mediation và một mô hình moderation, rồi so sánh kết quả bằng mắt", "isCorrect": False, "misconception": "cbqt.mediation-moderation-separate"},
                    {"label": "Chỉ cần chạy mediation, vì moderation chỉ là chi tiết phụ không cần kiểm riêng", "isCorrect": False, "misconception": "cbqt.mediation-moderation-separate"},
                    {"label": "Không thể kiểm định được loại quan hệ này bằng bất kỳ mô hình thống kê nào", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt3-mga-invariance",
                "type": "mcq",
                "prompt": "Trước khi so sánh path coefficient giữa nhóm nam và nữ trong một multi-group analysis, bước nào cần thực hiện trước?",
                "explanation": "Cần kiểm đo lường bất biến (configural và metric invariance) trước — nếu thang đo không đo cùng một cách giữa hai nhóm, sự khác biệt về path có thể do khác biệt đo lường, không phải khác biệt thật.",
                "points": 3,
                "options": [
                    {"label": "Kiểm đo lường bất biến (configural và metric invariance) giữa hai nhóm", "isCorrect": True},
                    {"label": "Không cần bước nào trước, có thể so sánh path coefficient trực tiếp giữa hai nhóm", "isCorrect": False, "misconception": "cbqt.compare-groups-no-invariance"},
                    {"label": "Chỉ cần đảm bảo cỡ mẫu hai nhóm bằng nhau", "isCorrect": False, "misconception": "cbqt.compare-groups-no-invariance"},
                    {"label": "Chỉ cần chạy lại Cronbach's Alpha cho từng nhóm", "isCorrect": False, "misconception": "cbqt.compare-groups-no-invariance"},
                ],
            },
            {
                "key": "cbqt3-manipulation-check",
                "type": "mcq",
                "prompt": "Một thí nghiệm cho hai nhóm đọc hai đoạn văn khác nhau để tạo ra hai mức 'tin tưởng vào AI' (cao/thấp), rồi đo thẳng biến phụ thuộc mà không kiểm tra lại mức tin tưởng thật của người tham gia. Vấn đề của thiết kế này là gì?",
                "explanation": "Thiếu manipulation check: không biết liệu đoạn văn có thực sự tạo ra sự khác biệt về mức tin tưởng như dự kiến hay không — nếu manipulation thất bại, một kết quả không có ý nghĩa ở biến phụ thuộc có thể do manipulation yếu, không phải do lý thuyết sai.",
                "points": 3,
                "options": [
                    {"label": "Thiếu manipulation check — không xác nhận được can thiệp có thực sự tạo ra sự khác biệt ở biến độc lập như dự kiến", "isCorrect": True},
                    {"label": "Không có vấn đề gì, vì đã có hai nhóm khác nhau đọc hai đoạn văn khác nhau", "isCorrect": False, "misconception": "cbqt.no-manipulation-check"},
                    {"label": "Vấn đề duy nhất là cần tăng số người tham gia trong mỗi nhóm", "isCorrect": False, "misconception": "cbqt.no-manipulation-check"},
                    {"label": "Không có vấn đề, miễn là kết quả biến phụ thuộc có ý nghĩa thống kê", "isCorrect": False, "misconception": "cbqt.no-manipulation-check"},
                ],
            },
            {
                "key": "cbqt3-longitudinal-vs-causal",
                "type": "mcq",
                "prompt": "Một nghiên cứu đo X và Y ở hai thời điểm (T1, T2), thấy X ở T1 dự báo Y ở T2 có ý nghĩa thống kê, và kết luận 'X gây ra Y'. Nhận định nào đúng?",
                "explanation": "Trình tự thời gian là điều kiện cần nhưng chưa đủ cho nhân quả — các yếu tố gây nhiễu không được đo và kiểm soát vẫn có thể tạo ra mối quan hệ giả, dù đã có bằng chứng về trình tự thời gian.",
                "points": 3,
                "options": [
                    {"label": "Kết luận còn vội — trình tự thời gian là điều kiện cần nhưng chưa đủ, các yếu tố gây nhiễu chưa được kiểm soát vẫn có thể tạo ra mối quan hệ giả", "isCorrect": True},
                    {"label": "Kết luận đúng hoàn toàn, vì đo hai lần theo thời gian là đủ để khẳng định nhân quả", "isCorrect": False, "misconception": "cbqt.two-wave-enough-for-causality"},
                    {"label": "Kết luận sai hoàn toàn, vì thiết kế longitudinal không cho biết gì về nhân quả", "isCorrect": False},
                    {"label": "Kết luận đúng nếu cỡ mẫu đủ lớn ở cả hai thời điểm", "isCorrect": False, "misconception": "cbqt.two-wave-enough-for-causality"},
                ],
            },
            {
                "key": "cbqt3-khi-nao-dung-ky-thuat",
                "type": "mcq",
                "prompt": "Câu hỏi nghiên cứu cần khẳng định nhân quả chắc chắn hơn những gì một mô hình PLS-SEM cắt ngang cho phép. Hướng nào phù hợp nhất?",
                "explanation": "Thiết kế thực nghiệm hoặc bán thực nghiệm với phân nhóm ngẫu nhiên và manipulation check là công cụ phù hợp nhất để khẳng định nhân quả mạnh hơn một mô hình cắt ngang.",
                "points": 2,
                "options": [
                    {"label": "Chuyển sang thiết kế thực nghiệm hoặc bán thực nghiệm với phân nhóm ngẫu nhiên và manipulation check", "isCorrect": True},
                    {"label": "Tăng cỡ mẫu của mô hình PLS-SEM cắt ngang để p-value nhỏ hơn", "isCorrect": False},
                    {"label": "Chạy lại mô hình PLS-SEM nhiều lần với các mẫu con khác nhau", "isCorrect": False},
                    {"label": "Không cần thay đổi gì, PLS-SEM cắt ngang luôn đủ để khẳng định nhân quả nếu p < 0.05", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt3-thu-tu-mga",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước thực hiện multi-group analysis.",
                "explanation": "Từ kiểm configural invariance (cấu trúc mô hình giống nhau), tới metric invariance (hệ số tải tương đương), rồi mới so sánh path coefficient giữa các nhóm bằng kiểm định phù hợp.",
                "points": 3,
                "sequence": [
                    "Xác định các nhóm cần so sánh (ví dụ theo giới tính, quốc gia)",
                    "Kiểm configural invariance: cấu trúc mô hình giống nhau giữa các nhóm",
                    "Kiểm metric invariance: hệ số tải factor loading tương đương giữa các nhóm",
                    "So sánh path coefficient giữa các nhóm bằng kiểm định phù hợp",
                    "Diễn giải sự khác biệt path là khác biệt thật, chỉ sau khi đã qua các bước kiểm invariance",
                ],
            },
            {
                "key": "cbqt3-noi-ky-thuat-nang-cao",
                "type": "matching",
                "prompt": "Nối mỗi kỹ thuật nâng cao với đúng vấn đề nó giải quyết.",
                "explanation": "Moderated mediation kiểm hiệu ứng trung gian có điều kiện; multi-group analysis so sánh mô hình giữa các nhóm (cần invariance trước); manipulation check xác nhận can thiệp thực nghiệm có hiệu quả; longitudinal design xác lập trình tự thời gian.",
                "points": 3,
                "pairs": [
                    {"left": "Moderated mediation", "right": "Kiểm hiệu ứng trung gian thay đổi theo mức của biến điều tiết"},
                    {"left": "Multi-group analysis (sau khi kiểm invariance)", "right": "So sánh mô hình đường dẫn giữa các nhóm khác nhau"},
                    {"left": "Manipulation check", "right": "Xác nhận can thiệp thực nghiệm tạo ra khác biệt đúng như dự kiến"},
                    {"left": "Longitudinal design", "right": "Xác lập trình tự thời gian giữa các biến"},
                ],
            },
            {
                "key": "cbqt3-viet-phuong-phap-nang-cao",
                "type": "essay",
                "prompt": "Viết phần Phương pháp nâng cao cho bài báo của bạn (250-350 từ), gồm: (a) kỹ thuật nâng cao đã chọn và lý do nối với lý thuyết/câu hỏi; (b) quy trình kiểm định đi kèm (invariance, manipulation check, hoặc thiết kế đo lặp); (c) một câu giải thích kết quả sẽ khác gì nếu chỉ dùng kỹ thuật cơ bản (SEM cắt ngang đơn giản) thay vì kỹ thuật nâng cao này.",
                "points": 5,
            },
        ],
    },
}
