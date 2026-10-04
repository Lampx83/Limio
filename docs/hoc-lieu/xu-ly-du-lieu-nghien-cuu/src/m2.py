# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2 · Thống kê mô tả và kiểm định giả thuyết",
    "durationMin": 90,
    "description": "Đọc đúng bảng thống kê mô tả (không chỉ nhìn trung bình); kiểm Levene's test trước khi đọc t-test; chạy post-hoc sau ANOVA có ý nghĩa để biết nhóm nào khác nhóm nào; chọn đúng giữa Chi-square và Fisher's Exact Test theo expected count.",
    "objectives": [
        "Đọc đầy đủ một bảng thống kê mô tả (N, Mean, SD, Min, Max, Skewness) và nhận ra khi phân phối lệch đáng kể",
        "Đọc đúng thứ tự bảng kết quả independent samples t-test: kiểm Levene's test trước khi chọn dòng kết quả phù hợp",
        "Chạy kiểm định hậu định (post-hoc) sau khi ANOVA cho kết quả có ý nghĩa để xác định cụ thể nhóm nào khác nhóm nào",
        "Chọn đúng giữa Chi-square và Fisher's Exact Test dựa trên expected count của bảng chéo",
    ],
    "summary": [
        "Một bảng thống kê mô tả đầy đủ cần N, Mean, SD, Min, Max — báo cáo Mean mà không kèm SD hoặc N khiến người đọc không đánh giá được độ phân tán hay độ tin cậy của số liệu.",
        "Bảng kết quả independent samples t-test luôn có Levene's test đi trước — phải đọc Levene's test để biết chọn dòng 'Equal variances assumed' hay 'not assumed', đọc thẳng dòng t-test mà không kiểm Levene's trước là đọc sai dòng.",
        "ANOVA có ý nghĩa (p < 0.05) chỉ cho biết có sự khác biệt tổng thể giữa các nhóm, không cho biết nhóm nào khác nhóm nào — cần chạy post-hoc test (Tukey HSD, Bonferroni) để xác định cụ thể.",
        "Chi-square chỉ đáng tin khi expected count đủ lớn (thường ≥ 5) ở đa số ô trong bảng chéo — khi không đạt, cần chuyển sang Fisher's Exact Test.",
    ],
    "splitSections": True,
    "body": r"""
Với dữ liệu đã làm sạch ở Bài 1, bài này đọc đúng các bảng output thống kê phổ biến nhất trong SPSS/R — từng bảng, từng dòng, đúng thứ tự. Bài đi qua bốn kiểm định theo thứ tự: đọc đầy đủ một bảng thống kê mô tả chứ không chỉ nhìn Mean, rồi tới independent samples t-test với bước kiểm Levene's test bắt buộc trước khi chọn dòng kết quả, tiếp theo ANOVA và lý do có ý nghĩa chưa đủ để biết nhóm nào khác nhóm nào, và kết bằng Chi-square cùng điều kiện expected count cần kiểm trước khi tin kết quả — trước khi sang phần luyện tập và tài liệu tham khảo.

## Thống kê mô tả: đọc hết bảng, không chỉ Mean

> [!ghi-nho] Một bảng thống kê mô tả (Descriptives) đầy đủ cần đọc cả: **N** (cỡ mẫu thật, sau khi loại thiếu), **Mean**, **SD** (độ lệch chuẩn — cho biết dữ liệu phân tán quanh Mean bao nhiêu), **Min/Max** (kiểm nhanh còn giá trị ngoài khoảng nào sót lại từ Bài 1 không), và **Skewness** (độ lệch — giá trị tuyệt đối lớn hơn 2 gợi ý phân phối lệch đáng kể, ảnh hưởng tới việc chọn kiểm định tham số hay phi tham số).

| Biến | N | Mean | SD | Min | Max | Skewness |
|---|---|---|---|---|---|---|
| Hài lòng | 9 | 3.44 | 1.01 | 2.00 | 5.00 | -0.12 |
| Nhận thức hữu ích | 9 | 3.78 | 0.97 | 2.00 | 5.00 | -0.31 |

> [!canh-bao] Báo cáo "Điểm hài lòng trung bình là 3.44" mà không kèm SD hoặc N là báo cáo thiếu — người đọc không biết 3.44 đó đến từ một nhóm đồng nhất (SD nhỏ) hay rất phân tán (SD lớn, có thể che giấu hai nhóm ý kiến rất khác nhau), và không biết kết luận này dựa trên bao nhiêu người.

## Independent samples t-test: đọc Levene's test trước

So sánh điểm Hài lòng giữa Nam và Nữ — bảng SPSS luôn có hai phần, và thứ tự đọc quan trọng.

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Group Statistics
Giới tính     N     Mean     SD
Nữ            4     4.25     0.50
Nam           5     2.80     0.84

Independent Samples Test
                              Levene's Test         t-test for Equality of Means
                           F      Sig.        t        df      Sig.(2-tailed)
Equal variances assumed   1.82   0.214      3.05      7        0.018
Equal variances not assumed              3.13      5.4        0.021</pre></div>
```

> [!ghi-nho] **Levene's test** kiểm giả định phương sai hai nhóm bằng nhau — đọc cột **Sig.** của Levene's test **trước**: nếu Sig. > 0.05 (như ví dụ trên, 0.214), phương sai được coi là bằng nhau, đọc dòng **"Equal variances assumed"**. Nếu Sig. ≤ 0.05, phương sai không bằng nhau, đọc dòng **"Equal variances not assumed"** (dùng df đã điều chỉnh, ở đây là 5.4).

> [!canh-bao] Đọc thẳng dòng đầu tiên (hoặc dòng quen mắt) của bảng t-test mà không kiểm Levene's test trước là đọc sai dòng khi phương sai hai nhóm khác nhau đáng kể — hai dòng cho ra t, df và Sig. khác nhau, và chọn sai dòng có thể đổi kết luận có ý nghĩa thống kê hay không.

Với ví dụ trên: Levene's Sig. = 0.214 > 0.05 → đọc dòng "Equal variances assumed" → t = 3.05, df = 7, Sig. (2-tailed) = 0.018 < 0.05 → **có sự khác biệt có ý nghĩa** giữa Nam và Nữ về điểm Hài lòng.

> [!ghi-nho] Có ý nghĩa thống kê (p < 0.05) chưa nói lên **độ lớn** của sự khác biệt — cần thêm **Cohen's d** (effect size). Với hai nhóm ở trên (Nữ: Mean=4.25, SD=0.50, n=4; Nam: Mean=2.80, SD=0.84, n=5):

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">SD gộp (pooled) = √[((n1-1)×SD1² + (n2-1)×SD2²) / (n1+n2-2)]
                = √[(3×0.50² + 4×0.84²) / 7] = √[(0.75 + 2.82) / 7] = √0.510 = 0.714

Cohen's d = (Mean1 - Mean2) / SD gộp = (4.25 - 2.80) / 0.714 ≈ 2.03</pre></div>
```

Theo quy ước của Cohen (1988): d ≈ 0.2 là **nhỏ**, 0.5 là **vừa**, 0.8 trở lên là **lớn**. d ≈ 2.03 ở đây là một khác biệt rất lớn — đáng báo cáo cùng với p-value, vì với cỡ mẫu nhỏ (n=9), một kết quả có ý nghĩa thống kê **và** effect size lớn thuyết phục hơn nhiều so với chỉ có p < 0.05.

> [!canh-bao] Chỉ báo cáo "p = 0.018, có ý nghĩa thống kê" mà không kèm Cohen's d là báo cáo thiếu — với cỡ mẫu đủ lớn, ngay cả một khác biệt rất nhỏ (d ≈ 0.1, gần như không có ý nghĩa thực tiễn) cũng có thể cho p < 0.05. Effect size cho biết khác biệt đó có **đáng quan tâm** hay không, p-value chỉ cho biết nó có **khác 0** hay không.

## ANOVA: có ý nghĩa không cho biết nhóm nào khác nhóm nào

Khi so sánh 3 nhóm hoặc nhiều hơn (ví dụ Hài lòng theo 3 khoa), ANOVA cho một kiểm định tổng thể trước.

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">ANOVA
                Sum of Squares   df    Mean Square    F      Sig.
Between Groups      12.400        2       6.200      5.14    0.023
Within Groups        9.600       16       0.600
Total               22.000       18</pre></div>
```

> [!canh-bao] Sig. = 0.023 < 0.05 chỉ cho biết **có ít nhất một cặp nhóm khác nhau có ý nghĩa** trong ba khoa — nó **không** cho biết khoa nào khác khoa nào. Kết luận ngay "Khoa A cao hơn Khoa B" chỉ từ bảng ANOVA mà không chạy thêm kiểm định là một kết luận không có cơ sở từ chính bảng này.

> [!ghi-nho] Sau ANOVA có ý nghĩa, chạy **post-hoc test** (Tukey HSD nếu phương sai các nhóm tương đương, Games-Howell nếu không) để so sánh từng cặp nhóm cụ thể và xác định chính xác cặp nào khác nhau có ý nghĩa.

Với ví dụ trên (3 khoa A, B, C), bảng Tukey HSD sau ANOVA có thể cho kết quả sau:

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Multiple Comparisons (Tukey HSD)
Khoa (I)   Khoa (J)   Mean Difference (I-J)   Sig.
A          B                  0.80            0.041
A          C                  1.10            0.009
B          C                  0.30            0.612</pre></div>
```

Đọc cột **Sig.** của từng cặp: A khác B có ý nghĩa (0.041 < 0.05), A khác C có ý nghĩa (0.009 < 0.05), nhưng B và C **không** khác nhau có ý nghĩa (0.612 > 0.05). Kết luận đầy đủ: "Khoa A có điểm Hài lòng cao hơn có ý nghĩa so với cả Khoa B và Khoa C; Khoa B và C không khác biệt có ý nghĩa với nhau" — chi tiết hơn nhiều so với chỉ nói "có sự khác biệt giữa 3 khoa".

Cũng nên báo cáo **eta-squared (η²)** — effect size cho ANOVA — dùng ngay số liệu trong bảng ANOVA phía trên: η² = Sum of Squares Between ÷ Sum of Squares Total = 12.400 / 22.000 ≈ **0.56**. Theo quy ước Cohen (1988): η² ≈ 0.01 là nhỏ, 0.06 là vừa, 0.14 trở lên là lớn — 0.56 là một effect size rất lớn, khoa học có ảnh hưởng mạnh tới điểm Hài lòng trong ví dụ này.

## Chi-square: kiểm expected count trước khi tin kết quả

Với hai biến định danh (ví dụ Giới tính × Có/không sử dụng công cụ AI), bảng chéo và Chi-square cho kết quả sau:

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Chi-Square Tests
                          Value    df    Asymp. Sig. (2-sided)
Pearson Chi-Square        4.02      1          0.045</pre></div>
```

> [!canh-bao] Chi-square chỉ đáng tin khi **expected count** (số lượng kỳ vọng theo giả thuyết không có liên hệ) đủ lớn — quy tắc thường dùng: không quá 20% số ô có expected count dưới 5, và không ô nào dưới 1. SPSS tự in cảnh báo này dưới bảng ("X cells have expected count less than 5"); **đọc dòng cảnh báo này trước khi tin vào Sig.** Khi vi phạm, chuyển sang **Fisher's Exact Test** (chính xác hơn với mẫu nhỏ), không tiếp tục dùng Pearson Chi-Square.

## Luyện tập và tài liệu tham khảo

### Cá nhân (40 phút)

Với dữ liệu đã làm sạch ở Bài 1, tính hoặc mô tả bảng thống kê mô tả đầy đủ (N, Mean, SD, Min, Max) cho điểm construct Hài lòng. Nếu có biến nhóm (Giới tính), phác một bảng t-test giả định và xác định trước sẽ đọc dòng nào dựa trên Levene's test.

### Nhóm 3-4 người (25 phút)

Đổi bảng ANOVA hoặc Chi-square giả định cho nhau (tự tạo số liệu mẫu). Kiểm: người làm bài có đọc đúng Levene's test trước t-test không? Có chạy post-hoc sau ANOVA có ý nghĩa không? Có kiểm expected count trước khi tin Chi-square không?

### Bài tập về nhà (60-90 phút)

Chạy (hoặc mô phỏng bằng tay có số liệu cụ thể) một t-test hoặc ANOVA trên dữ liệu của bạn, viết đoạn báo cáo kết quả đầy đủ đúng chuẩn APA (kèm t/F, df, p, và Mean/SD của các nhóm).

:::mau Mẫu nộp bài tập về nhà
**Bảng thống kê mô tả:** …

**Kiểm định đã chạy:** ☐ t-test ☐ ANOVA (+ post-hoc) ☐ Chi-square (+ kiểm expected count)

**Kết quả đầy đủ (kèm t/F/χ², df, p):** …

**Đoạn báo cáo chuẩn APA:** …
:::

### Nguồn tham khảo

- Field, A. (2018). *Discovering Statistics Using IBM SPSS Statistics* (5th ed.). SAGE Publications.
- Tabachnick, B. G., & Fidell, L. S. (2019). *Using Multivariate Statistics* (7th ed.). Pearson.
- Agresti, A. (2018). *Statistical Methods for the Social Sciences* (5th ed.). Pearson. — chương về Chi-square và Fisher's Exact Test.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "xldl2-mean-can-sd",
                "type": "mcq",
                "prompt": "Một báo cáo viết 'Điểm hài lòng trung bình là 3.44' mà không kèm số liệu nào khác. Vấn đề của cách báo cáo này là gì?",
                "explanation": "Thiếu SD và N khiến người đọc không đánh giá được độ phân tán của dữ liệu quanh giá trị trung bình hay độ tin cậy dựa trên cỡ mẫu — một báo cáo đầy đủ cần cả Mean, SD và N.",
                "points": 2,
                "options": [
                    {"label": "Thiếu SD và N, khiến không đánh giá được độ phân tán dữ liệu và độ tin cậy của số liệu", "isCorrect": True},
                    {"label": "Không có vấn đề gì, Mean luôn là số liệu đầy đủ để báo cáo", "isCorrect": False, "misconception": "xldl.mean-without-sd"},
                    {"label": "Vấn đề duy nhất là nên làm tròn thành 3.4 cho gọn", "isCorrect": False, "misconception": "xldl.mean-without-sd"},
                    {"label": "Không có vấn đề gì nếu cỡ mẫu đủ lớn", "isCorrect": False, "misconception": "xldl.mean-without-sd"},
                ],
            },
            {
                "key": "xldl2-levene-truoc",
                "type": "mcq",
                "prompt": "Trong bảng Independent Samples Test của SPSS, cần đọc gì trước khi chọn dòng kết quả t-test?",
                "explanation": "Cần đọc cột Sig. của Levene's test trước — nếu Sig. > 0.05 đọc dòng 'Equal variances assumed', nếu Sig. ≤ 0.05 đọc dòng 'Equal variances not assumed'. Đọc sai dòng có thể đổi kết luận có ý nghĩa thống kê hay không.",
                "points": 3,
                "options": [
                    {"label": "Cột Sig. của Levene's test, để biết chọn dòng 'Equal variances assumed' hay 'not assumed'", "isCorrect": True},
                    {"label": "Không cần đọc gì trước, luôn dùng dòng đầu tiên của bảng", "isCorrect": False, "misconception": "xldl.ignore-levenes-test"},
                    {"label": "Chỉ cần đọc cột t ở dòng 'Equal variances assumed', bỏ qua Levene's test", "isCorrect": False, "misconception": "xldl.ignore-levenes-test"},
                    {"label": "Cột Mean của bảng Group Statistics", "isCorrect": False, "misconception": "xldl.ignore-levenes-test"},
                ],
            },
            {
                "key": "xldl2-anova-post-hoc",
                "type": "mcq",
                "prompt": "Bảng ANOVA cho Sig. = 0.023 khi so sánh Hài lòng giữa 3 khoa. Kết luận nào đúng?",
                "explanation": "ANOVA có ý nghĩa chỉ cho biết có ít nhất một cặp nhóm khác nhau, không cho biết khoa nào khác khoa nào — cần chạy post-hoc test (Tukey HSD hoặc Games-Howell) để xác định cụ thể cặp nhóm nào khác nhau.",
                "points": 3,
                "options": [
                    {"label": "Có ít nhất một cặp khoa khác nhau có ý nghĩa; cần chạy post-hoc test để biết cụ thể khoa nào khác khoa nào", "isCorrect": True},
                    {"label": "Khoa có Mean cao nhất chắc chắn khác biệt có ý nghĩa với khoa có Mean thấp nhất, không cần kiểm thêm", "isCorrect": False, "misconception": "xldl.anova-significant-no-posthoc"},
                    {"label": "Cả ba khoa đều khác nhau có ý nghĩa với nhau từng cặp", "isCorrect": False, "misconception": "xldl.anova-significant-no-posthoc"},
                    {"label": "Không cần làm gì thêm, ANOVA đã cho đủ thông tin cần thiết", "isCorrect": False, "misconception": "xldl.anova-significant-no-posthoc"},
                ],
            },
            {
                "key": "xldl2-chi-square-expected-count",
                "type": "mcq",
                "prompt": "Một bảng chéo 2×2 có 30% số ô với expected count dưới 5, và bảng Chi-Square Tests của SPSS in cảnh báo về điều này. Nên làm gì?",
                "explanation": "Khi expected count không đủ lớn (nhiều ô dưới 5), Pearson Chi-Square không đáng tin — cần chuyển sang Fisher's Exact Test, chính xác hơn với mẫu nhỏ hoặc expected count thấp.",
                "points": 3,
                "options": [
                    {"label": "Chuyển sang Fisher's Exact Test thay vì tin vào Pearson Chi-Square", "isCorrect": True},
                    {"label": "Bỏ qua cảnh báo và vẫn báo cáo kết quả Pearson Chi-Square như bình thường", "isCorrect": False, "misconception": "xldl.chisquare-small-expected-count"},
                    {"label": "Tăng mức ý nghĩa (alpha) lên 0.10 để bù cho expected count thấp", "isCorrect": False, "misconception": "xldl.chisquare-small-expected-count"},
                    {"label": "Không cần làm gì khác, cảnh báo này không ảnh hưởng tới độ tin cậy của kết quả", "isCorrect": False, "misconception": "xldl.chisquare-small-expected-count"},
                ],
            },
            {
                "key": "xldl2-skewness",
                "type": "mcq",
                "prompt": "Một biến có Skewness = 2.8 trong bảng thống kê mô tả. Điều này gợi ý gì?",
                "explanation": "Giá trị tuyệt đối của Skewness lớn hơn 2 gợi ý phân phối lệch đáng kể, có thể ảnh hưởng tới việc chọn kiểm định tham số (giả định phân phối chuẩn) hay phi tham số.",
                "points": 2,
                "options": [
                    {"label": "Phân phối của biến này lệch đáng kể, cần xem xét khi chọn kiểm định tham số hay phi tham số", "isCorrect": True},
                    {"label": "Không có ý nghĩa gì đặc biệt, Skewness chỉ là một chỉ số phụ có thể bỏ qua", "isCorrect": False},
                    {"label": "Biến này chắc chắn có lỗi nhập liệu cần loại bỏ hoàn toàn", "isCorrect": False},
                    {"label": "Phân phối của biến này hoàn toàn chuẩn (normal distribution)", "isCorrect": False},
                ],
            },
            {
                "key": "xldl2-thu-tu-doc-ttest",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự đọc một bảng Independent Samples Test của SPSS.",
                "explanation": "Đọc Group Statistics để biết Mean/SD từng nhóm, kiểm Levene's test, chọn dòng phù hợp dựa trên kết quả Levene's, rồi đọc t/df/Sig. của dòng đó.",
                "points": 3,
                "sequence": [
                    "Đọc bảng Group Statistics để biết N, Mean, SD của từng nhóm",
                    "Đọc cột Sig. của Levene's Test for Equality of Variances",
                    "Chọn dòng 'Equal variances assumed' hoặc 'not assumed' dựa trên Levene's Sig.",
                    "Đọc t, df, và Sig. (2-tailed) của đúng dòng đã chọn",
                    "Kết luận có ý nghĩa thống kê hay không dựa trên Sig. của dòng đó",
                ],
            },
            {
                "key": "xldl2-noi-kiem-dinh",
                "type": "matching",
                "prompt": "Nối mỗi tình huống với đúng kiểm định hoặc bước cần thực hiện.",
                "explanation": "So sánh 2 nhóm dùng t-test (sau khi kiểm Levene's); so sánh 3+ nhóm dùng ANOVA rồi post-hoc; hai biến định danh dùng Chi-square (kiểm expected count trước); phân phối lệch mạnh cần xem xét kiểm định phi tham số.",
                "points": 3,
                "pairs": [
                    {"left": "So sánh trung bình giữa 2 nhóm độc lập", "right": "Independent samples t-test (kiểm Levene's test trước)"},
                    {"left": "So sánh trung bình giữa 3 nhóm trở lên", "right": "ANOVA, kèm post-hoc test nếu có ý nghĩa"},
                    {"left": "Kiểm liên hệ giữa hai biến định danh", "right": "Chi-square (kiểm expected count trước khi tin kết quả)"},
                    {"left": "Expected count dưới 5 ở nhiều ô trong bảng chéo", "right": "Chuyển sang Fisher's Exact Test"},
                ],
            },
            {
                "key": "xldl2-doc-bang-ket-qua",
                "type": "essay",
                "prompt": "Cho bảng Independent Samples Test với Levene's Sig. = 0.03, dòng 'Equal variances assumed' có t=2.1, df=18, Sig.=0.05, dòng 'Equal variances not assumed' có t=2.3, df=12.4, Sig.=0.04. Viết đoạn 150-200 từ giải thích: (a) dòng nào nên đọc và vì sao; (b) kết luận cuối cùng về ý nghĩa thống kê; (c) một câu về việc kết luận có thể khác đi nếu đọc nhầm dòng.",
                "points": 5,
            },
        ],
    },
}
