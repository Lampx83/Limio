# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 1 · Làm sạch một bộ dữ liệu khảo sát thật",
    "durationMin": 90,
    "description": "Tự tay tìm và sửa 5 loại lỗi trong một bộ dữ liệu khảo sát mẫu: giá trị thiếu, dòng trùng lặp, giá trị ngoài khoảng hợp lệ, câu trả lời straight-lining, và item chưa đảo hướng — bằng công thức Excel và mã R cụ thể, không chỉ đọc lý thuyết.",
    "objectives": [
        "Phát hiện được giá trị thiếu và dòng trùng lặp trong một bộ dữ liệu bằng công thức Excel hoặc mã R cụ thể",
        "Phát hiện được giá trị ngoài khoảng hợp lệ và câu trả lời straight-lining bằng ngưỡng và công thức cụ thể",
        "Đảo hướng đúng công thức cho item đảo hướng trên thang Likert, và tính điểm construct sau khi đã đảo",
        "Tạo ra được một bộ dữ liệu đã làm sạch hoàn chỉnh từ một bộ dữ liệu thô có đủ 5 loại lỗi thường gặp",
    ],
    "summary": [
        "Một bộ dữ liệu khảo sát thô thường có ít nhất 5 loại lỗi cần tìm bằng công thức cụ thể: giá trị thiếu, dòng trùng lặp, giá trị ngoài khoảng hợp lệ, câu trả lời straight-lining, và item chưa đảo hướng — không loại nào tự lộ ra khi chỉ nhìn qua bảng dữ liệu.",
        "Dòng trùng lặp không bị phần mềm thống kê tự động cảnh báo — nó âm thầm khiến một người trả lời có trọng số gấp đôi trong mọi phép tính trung bình và kiểm định sau đó.",
        "Công thức đảo hướng đúng cho thang Likert là (giá trị lớn nhất + giá trị nhỏ nhất) − giá trị gốc — với thang 1-5 là 6 − giá trị, không phải 5 − giá trị.",
        "Straight-lining (chọn cùng một giá trị cho mọi câu hỏi trong một construct) là dấu hiệu người trả lời không đọc kỹ câu hỏi — phát hiện bằng độ lệch chuẩn giữa các item của cùng một người bằng 0 hoặc rất thấp.",
    ],
    "splitSections": True,
    "body": r"""
Các khoá trước đã nói *vì sao* cần làm sạch dữ liệu trước khi phân tích. Bài này đưa một bộ dữ liệu thô thật — 11 dòng, đủ nhỏ để tự tay kiểm — và đi qua từng công thức cụ thể để tìm và sửa lỗi: trước hết nhận diện đủ 5 loại lỗi có mặt trong bộ dữ liệu mẫu, sau đó lần lượt phát hiện giá trị thiếu và dòng trùng lặp, rồi tới giá trị ngoài khoảng hợp lệ và straight-lining, và cuối cùng là đảo hướng item để tính đúng điểm construct. Bài kết bằng phần luyện tập tự tay làm sạch trọn bộ dữ liệu và tài liệu tham khảo.

## Bộ dữ liệu thô và 5 loại lỗi cần tìm

Bộ dữ liệu mẫu: khảo sát 10 người về hài lòng (Q1, Q2 — Q2 là item **đảo hướng**) và nhận thức hữu ích (Q3), thang Likert 1-5.

| ID | Q1 (Hài lòng) | Q2 (Hài lòng, đảo hướng) | Q3 (Nhận thức hữu ích) | Tuổi | Giới tính |
|---|---|---|---|---|---|
| 1 | 4 | 2 | 4 | 20 | Nữ |
| 2 | 3 | *(trống)* | 3 | 21 | Nam |
| 2 | 3 | *(trống)* | 3 | 21 | Nam |
| 3 | 5 | 1 | 5 | 22 | Nữ |
| 4 | 2 | 4 | 2 | 19 | Nam |
| 5 | **7** | 2 | 4 | 23 | Nữ |
| 6 | 3 | 3 | 3 | 20 | Nam |
| 7 | 4 | 1 | 5 | **999** | Nữ |
| 8 | 3 | 3 | 3 | 21 | Nam |
| 9 | 5 | 2 | 4 | 22 | Nữ |
| 10 | 4 | 2 | 4 | 20 | Nam |

> [!ghi-nho] Bảng trên chứa đủ 5 loại lỗi cần tìm trước khi phân tích: **giá trị thiếu** (Q2 của ID2), **dòng trùng lặp** (ID2 xuất hiện hai lần với cùng giá trị), **giá trị ngoài khoảng hợp lệ** (Q1 của ID5 = 7, ngoài thang 1-5; Tuổi của ID7 = 999), **straight-lining** (ID8 chọn đúng giá trị 3 cho cả ba câu — nghi ngờ không đọc kỹ), và **item chưa đảo hướng** (Q2 là item đảo hướng, chưa được xử lý).

## Phát hiện giá trị thiếu và dòng trùng lặp

**Giá trị thiếu** — đếm số ô trống trong mỗi cột:

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Excel:  =COUNTBLANK(C2:C11)          → đếm số ô trống trong cột Q2
R:      sum(is.na(df$Q2))            → 2 (vì ID2 xuất hiện hai lần, cả hai đều thiếu Q2)</pre></div>
```

**Dòng trùng lặp** — tìm ID xuất hiện nhiều hơn một lần:

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Excel:  =COUNTIF($A$2:$A$11, A2) &gt; 1  → điền công thức này ở cột phụ, kéo xuống, lọc giá trị TRUE
R:      df[duplicated(df$ID) | duplicated(df$ID, fromLast = TRUE), ]   → in ra cả hai dòng của ID2</pre></div>
```

> [!canh-bao] Dòng trùng lặp không bị phần mềm thống kê tự động cảnh báo khi chạy phân tích — nó âm thầm cho người đó trọng số gấp đôi trong mọi điểm trung bình và kiểm định sau này. Với bộ dữ liệu 10 người, ID2 xuất hiện hai lần nghĩa là ý kiến của một người chiếm 2/11 tổng trọng số thay vì 1/10 đúng ra phải có — **luôn kiểm trùng lặp theo ID trước khi làm bất cứ điều gì khác**, xoá bớt một trong hai dòng trùng khi xác nhận đó là lỗi nhập liệu (không phải hai người khác nhau vô tình cùng ID).

## Phát hiện giá trị ngoài khoảng và straight-lining

**Giá trị ngoài khoảng hợp lệ** — với thang Likert 1-5, mọi giá trị ngoài [1, 5] là lỗi nhập liệu:

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Excel:  =OR(B2&lt;1, B2&gt;5)              → TRUE nếu Q1 ngoài khoảng 1-5
R:      df$ID[df$Q1 &lt; 1 | df$Q1 &gt; 5] → 5 (ID5 có Q1 = 7)</pre></div>
```

Với biến liên tục như Tuổi, ngưỡng hợp lệ dựa trên bối cảnh thực tế (ví dụ 18-60 cho khảo sát học viên/giảng viên):

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">R:      df$ID[df$Tuoi &gt; 60]          → 7 (ID7 có Tuổi = 999 — rõ ràng là mã lỗi/placeholder, không phải tuổi thật)</pre></div>
```

Khi không có ngưỡng hợp lý rõ ràng theo bối cảnh (ví dụ biến ít quen thuộc, hoặc cỡ mẫu lớn khó rà bằng mắt), dùng quy tắc thống kê **IQR (khoảng tứ phân vị)**: giá trị ngoài [Q1 − 1.5×IQR, Q3 + 1.5×IQR] được coi là outlier.

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">R:      Q1 &lt;- quantile(df$Tuoi, .25); Q3 &lt;- quantile(df$Tuoi, .75)
        IQR &lt;- Q3 - Q1
        df$ID[df$Tuoi &lt; Q1 - 1.5*IQR | df$Tuoi &gt; Q3 + 1.5*IQR]</pre></div>
```

> [!meo] Ngưỡng theo bối cảnh (ví dụ 18-60 tuổi cho khảo sát học viên/giảng viên) luôn ưu tiên hơn IQR khi đã có sẵn — IQR chỉ là phương án dự phòng khi không có ngưỡng hợp lý rõ ràng. Dùng IQR một cách máy móc có thể đánh dấu nhầm một giá trị hợp lệ nhưng hiếm gặp (ví dụ một học viên 55 tuổi trong lớp đa số 20-25 tuổi) thành outlier — luôn xem lại bối cảnh trước khi loại.

**Straight-lining** — tính độ lệch chuẩn giữa các item trong cùng một construct, cho từng người:

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">R:      apply(df[, c("Q1","Q2_rev","Q3")], 1, sd, na.rm = TRUE)
        → ID8 có SD = 0 (chọn đúng 3 cho cả ba câu) — dấu hiệu straight-lining</pre></div>
```

> [!canh-bao] SD = 0 hoặc rất thấp giữa các item của cùng một người là dấu hiệu straight-lining — không có nghĩa chắc chắn người đó trả lời gian dối, nhưng cần xem xét kỹ (ví dụ so sánh thời gian hoàn thành khảo sát của người đó nếu có, hoặc quyết định loại nếu SD = 0 trên toàn bộ các construct, không chỉ một construct).

## Đảo hướng item và tính điểm construct đúng cách

> [!ghi-nho] Công thức đảo hướng đúng cho thang Likert: **(giá trị lớn nhất + giá trị nhỏ nhất) − giá trị gốc**. Với thang 1-5 (lớn nhất = 5, nhỏ nhất = 1): công thức là **6 − giá trị gốc**, không phải 5 − giá trị gốc (lỗi rất dễ mắc — 5 là giá trị lớn nhất, nhưng công thức cần cả lớn nhất **và** nhỏ nhất).

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">R:      df$Q2_rev &lt;- 6 - df$Q2        → ID1: Q2 = 2 → Q2_rev = 4 (khớp hướng với Q1 = 4)
Excel:  =6-C2                         → áp dụng cho cả cột Q2</pre></div>
```

> [!canh-bao] Dùng sai công thức (ví dụ 5 − giá trị, quên cộng giá trị nhỏ nhất) cho ra kết quả đảo hướng sai lệch một cách có hệ thống — không phải lỗi ngẫu nhiên mà lỗi này làm sai **toàn bộ** cột đã đảo, làm sai điểm construct và mọi kiểm định dùng construct đó sau này. Luôn kiểm bằng tay 1-2 dòng đầu: nếu Q1 và Q2_rev sau khi đảo có xu hướng cùng chiều nhau (người hài lòng cao ở Q1 cũng có Q2_rev cao), công thức đã đúng.

Sau khi đảo hướng Q2, điểm construct "Hài lòng" của mỗi người là trung bình của Q1 và Q2_rev — **không phải trung bình của Q1 và Q2 gốc**.

:::mau Ví dụ minh hoạ nhanh (bộ số liệu khác, không phải bảng dùng để luyện tập ở mục dưới)
Ba người trả lời thang Likert 1-5 cho Q1 (Hài lòng) và Q2 (Hài lòng, đảo hướng):

| Người | Q1 | Q2 | Q2_rev = 6 − Q2 | Hài lòng = (Q1 + Q2_rev)/2 |
|---|---|---|---|---|
| X | 5 | 1 | 5 | 5.0 |
| Y | 2 | 5 | 1 | 1.5 |
| Z | 4 | 4 | 2 | 3.0 |

Người X và Y nhất quán: Q1 cao đi cùng Q2_rev cao (X), Q1 thấp đi cùng Q2_rev thấp (Y) — đúng như kỳ vọng khi cả hai item đo cùng một khái niệm. Người Z lại **mâu thuẫn nội bộ**: Q1 = 4 (hài lòng cao) nhưng sau khi đảo hướng, Q2_rev chỉ còn 2 (ngụ ý hài lòng thấp) — hai item của cùng một construct đang "nói ngược nhau". Đây không phải straight-lining (SD giữa hai item của Z không bằng 0), nhưng vẫn là dấu hiệu đáng ghi chú: có thể Z hiểu nhầm chiều của câu hỏi đảo hướng, hoặc thực sự có cảm nhận mâu thuẫn — điểm construct 3.0 của Z che giấu sự mâu thuẫn này chứ không phản ánh một cảm nhận "trung bình" thực sự.
:::

## Luyện tập và tài liệu tham khảo

### Cá nhân (40 phút)

Dùng bảng dữ liệu thô ở mục 1, tự tay (hoặc bằng Excel/R) thực hiện đủ 5 bước: (1) đếm giá trị thiếu, (2) xoá dòng trùng lặp, (3) đánh dấu giá trị ngoài khoảng (Q1 của ID5, Tuổi của ID7), (4) đánh dấu straight-lining (ID8), (5) đảo hướng Q2 và tính điểm construct Hài lòng cho mỗi người còn lại sau khi xử lý các lỗi trên.

### Nhóm 3-4 người (25 phút)

So sánh bộ dữ liệu đã làm sạch của nhau. Có ai xử lý ID5 (Q1=7) hoặc ID7 (Tuổi=999) khác cách của bạn không (sửa lại vs loại bỏ dòng)? Thảo luận: khi nào nên sửa lại một giá trị lỗi rõ ràng (nếu có cách suy ra giá trị đúng) và khi nào nên loại bỏ cả dòng.

### Bài tập về nhà (60 phút)

Viết đoạn mô tả quy trình làm sạch dữ liệu (200-250 từ) dùng cho phần Phương pháp của bài báo/luận văn, kèm bảng tóm tắt số liệu đã xử lý (bao nhiêu dòng thiếu, trùng, ngoài khoảng, straight-lining, đã loại/sửa bao nhiêu).

:::mau Mẫu nộp bài tập về nhà
**Đoạn mô tả quy trình làm sạch dữ liệu (200-250 từ):** …

**Bảng tóm tắt xử lý**

| Loại lỗi | Số trường hợp phát hiện | Cách xử lý |
|---|---|---|
| Giá trị thiếu | … | … |
| Dòng trùng lặp | … | … |
| Ngoài khoảng hợp lệ | … | … |
| Straight-lining | … | … |
| Item đảo hướng | … | … |

**Điểm construct Hài lòng sau khi làm sạch (cho từng ID còn lại):** …
:::

### Nguồn tham khảo

- Van den Broeck, J., Cunningham, S. A., Eeckels, R., & Herbst, K. (2005). Data cleaning: Detecting, diagnosing, and editing data abnormalities. *PLOS Medicine*, 2(10), e267.
- Meade, A. W., & Craig, S. B. (2012). Identifying careless responses in survey data. *Psychological Methods*, 17(3), 437-455.
- Wickham, H., & Grolemund, G. (2017). *R for Data Science.* O'Reilly Media. — chương về làm sạch dữ liệu với dplyr.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 1",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "xldl1-phat-hien-trung-lap",
                "type": "mcq",
                "prompt": "Trong bộ dữ liệu mẫu, ID nào xuất hiện dưới dạng dòng trùng lặp?",
                "explanation": "ID2 xuất hiện hai lần với cùng giá trị Q1, Q3, Tuổi, Giới tính — đây là dòng trùng lặp cần xoá bớt một dòng trước khi phân tích, nếu không người này sẽ có trọng số gấp đôi.",
                "points": 2,
                "options": [
                    {"label": "ID2", "isCorrect": True},
                    {"label": "Không có dòng nào trùng lặp trong bộ dữ liệu này", "isCorrect": False, "misconception": "xldl.duplicate-not-checked"},
                    {"label": "ID8, vì có giá trị giống nhau ở cả ba câu", "isCorrect": False, "misconception": "xldl.duplicate-not-checked"},
                    {"label": "ID5, vì có giá trị bất thường", "isCorrect": False, "misconception": "xldl.duplicate-not-checked"},
                ],
            },
            {
                "key": "xldl1-cong-thuc-dao-huong",
                "type": "mcq",
                "prompt": "Với thang Likert 1-5, công thức đúng để đảo hướng một item là gì?",
                "explanation": "Công thức đảo hướng đúng là (giá trị lớn nhất + giá trị nhỏ nhất) − giá trị gốc. Với thang 1-5, đó là (5+1) − giá trị = 6 − giá trị, không phải chỉ 5 − giá trị.",
                "points": 3,
                "options": [
                    {"label": "6 − giá trị gốc (vì (5 + 1) − giá trị gốc)", "isCorrect": True},
                    {"label": "5 − giá trị gốc", "isCorrect": False, "misconception": "xldl.reverse-code-formula-wrong"},
                    {"label": "Giá trị gốc × (-1)", "isCorrect": False, "misconception": "xldl.reverse-code-formula-wrong"},
                    {"label": "Không cần công thức, chỉ cần đổi thứ tự các câu trả lời trong bảng hỏi lần sau", "isCorrect": False, "misconception": "xldl.reverse-code-formula-wrong"},
                ],
            },
            {
                "key": "xldl1-gia-tri-ngoai-khoang",
                "type": "mcq",
                "prompt": "ID5 có Q1 = 7 trên thang Likert 1-5. Cách xử lý nào đúng trước khi phân tích?",
                "explanation": "Giá trị 7 ngoài khoảng hợp lệ [1,5] là lỗi nhập liệu rõ ràng — cần xử lý (sửa lại nếu suy ra được giá trị đúng, hoặc đặt thành thiếu/loại dòng) trước khi tính vào bất kỳ phân tích nào, không được giữ nguyên.",
                "points": 3,
                "options": [
                    {"label": "Xử lý như lỗi nhập liệu — sửa lại nếu suy ra được giá trị đúng, hoặc đặt thành thiếu/loại dòng, không giữ nguyên giá trị 7", "isCorrect": True},
                    {"label": "Giữ nguyên giá trị 7 vì đó là dữ liệu thật do người tham gia nhập", "isCorrect": False, "misconception": "xldl.out-of-range-not-caught"},
                    {"label": "Đổi thang đo từ 1-5 thành 1-7 để giá trị này hợp lệ", "isCorrect": False, "misconception": "xldl.out-of-range-not-caught"},
                    {"label": "Không cần làm gì, phần mềm thống kê sẽ tự động loại giá trị này", "isCorrect": False, "misconception": "xldl.out-of-range-not-caught"},
                ],
            },
            {
                "key": "xldl1-straight-lining",
                "type": "mcq",
                "prompt": "ID8 chọn đúng giá trị 3 cho cả ba câu Q1, Q2, Q3. Đây là dấu hiệu gì, và nên xử lý thế nào?",
                "explanation": "Đây là dấu hiệu straight-lining (SD giữa các item bằng 0) — cần xem xét kỹ, có thể loại nếu xảy ra trên toàn bộ các construct trong khảo sát, không nên tính thẳng vào phân tích mà không xem xét.",
                "points": 3,
                "options": [
                    {"label": "Dấu hiệu straight-lining (SD = 0 giữa các item) — cần xem xét kỹ, có thể loại nếu xảy ra ở toàn bộ khảo sát", "isCorrect": True},
                    {"label": "Không có gì bất thường, đây chỉ là một người trả lời trung lập nhất quán", "isCorrect": False, "misconception": "xldl.straight-lining-ignored"},
                    {"label": "Đây là dấu hiệu tốt cho thấy dữ liệu nhất quán, nên giữ nguyên không cần xem xét", "isCorrect": False, "misconception": "xldl.straight-lining-ignored"},
                    {"label": "Cần xoá toàn bộ khảo sát này ngay không cần xem xét thêm", "isCorrect": False},
                ],
            },
            {
                "key": "xldl1-tuoi-999",
                "type": "mcq",
                "prompt": "ID7 có Tuổi = 999. Cách hiểu đúng nhất về giá trị này là gì?",
                "explanation": "999 là một giá trị không hợp lý cho tuổi con người, thường là mã lỗi hoặc giá trị placeholder mặc định của phần mềm khảo sát khi người trả lời bỏ qua câu hỏi — cần xử lý như dữ liệu thiếu, không phải tuổi thật.",
                "points": 2,
                "options": [
                    {"label": "Rất có thể là mã lỗi/placeholder khi người trả lời bỏ qua câu hỏi, cần xử lý như dữ liệu thiếu", "isCorrect": True},
                    {"label": "Có thể là tuổi thật của một người tham gia rất lớn tuổi", "isCorrect": False},
                    {"label": "Không cần xử lý gì vì biến Tuổi không quan trọng trong phân tích", "isCorrect": False},
                    {"label": "Nên giữ nguyên vì đây là số liệu do người tham gia tự khai", "isCorrect": False},
                ],
            },
            {
                "key": "xldl1-thu-tu-lam-sach",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước làm sạch bộ dữ liệu mẫu trước khi tính điểm construct.",
                "explanation": "Từ kiểm giá trị thiếu, xoá dòng trùng lặp, xử lý giá trị ngoài khoảng, xem xét straight-lining, tới đảo hướng item và tính điểm construct — thứ tự này đảm bảo mỗi bước không bị ảnh hưởng bởi lỗi của bước trước.",
                "points": 3,
                "sequence": [
                    "Đếm và kiểm tra giá trị thiếu trong mỗi cột",
                    "Tìm và xoá bớt dòng trùng lặp theo ID",
                    "Xử lý giá trị ngoài khoảng hợp lệ (Likert, tuổi)",
                    "Kiểm tra và xem xét các trường hợp straight-lining",
                    "Đảo hướng item cần đảo, rồi tính điểm construct",
                ],
            },
            {
                "key": "xldl1-noi-cong-thuc",
                "type": "matching",
                "prompt": "Nối mỗi loại lỗi với đúng công thức hoặc cách phát hiện nó.",
                "explanation": "COUNTBLANK/is.na phát hiện thiếu; COUNTIF trên ID/duplicated() phát hiện trùng lặp; kiểm khoảng [1,5] phát hiện giá trị ngoài khoảng; SD giữa các item bằng 0 phát hiện straight-lining.",
                "points": 3,
                "pairs": [
                    {"left": "Giá trị thiếu", "right": "COUNTBLANK (Excel) / is.na() (R)"},
                    {"left": "Dòng trùng lặp", "right": "COUNTIF theo ID (Excel) / duplicated() (R)"},
                    {"left": "Giá trị ngoài khoảng hợp lệ", "right": "Kiểm giá trị nằm ngoài [giá trị nhỏ nhất, giá trị lớn nhất] của thang đo"},
                    {"left": "Straight-lining", "right": "Độ lệch chuẩn (SD) giữa các item của cùng một người bằng 0 hoặc rất thấp"},
                ],
            },
            {
                "key": "xldl1-lam-sach-thuc-hanh",
                "type": "essay",
                "prompt": "Từ bảng dữ liệu thô ở mục 1, viết kết quả làm sạch của bạn: (a) danh sách các lỗi đã tìm thấy (thiếu, trùng, ngoài khoảng, straight-lining) kèm ID cụ thể; (b) cách bạn xử lý mỗi lỗi; (c) công thức đảo hướng Q2 đã dùng; (d) điểm construct Hài lòng (trung bình Q1 và Q2 đã đảo) cho ít nhất 3 người trong dữ liệu còn lại sau khi làm sạch.",
                "points": 5,
            },
        ],
    },
}
