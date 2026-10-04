# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2 · Tổng quan tài liệu hệ thống đầy đủ",
    "durationMin": 100,
    "description": "Xác định tiêu chí chọn/loại trước khi tìm kiếm theo PRISMA đầy đủ; thẩm định chất lượng phương pháp của từng nguồn trước khi tổng hợp; chọn đúng giữa gộp số liệu (meta-analysis) và tổng hợp tường thuật; đăng ký protocol trước để tăng minh bạch.",
    "objectives": [
        "Xác định tiêu chí chọn/loại (eligibility criteria) theo khung PICOS trước khi bắt đầu tìm kiếm, không đặt tiêu chí sau khi đã xem kết quả",
        "Áp dụng được một công cụ thẩm định chất lượng phù hợp với loại thiết kế của các nguồn được đưa vào tổng quan",
        "Quyết định đúng giữa gộp số liệu bằng meta-analysis và tổng hợp tường thuật/theo chủ đề, dựa trên mức độ đồng nhất giữa các nghiên cứu",
        "Đăng ký protocol tổng quan trước khi bắt đầu tìm kiếm để tăng minh bạch và giảm nghi ngờ về thiên lệch lựa chọn",
    ],
    "summary": [
        "Tiêu chí chọn/loại nguồn (eligibility criteria) phải được xác định theo khung PICOS trước khi xem kết quả tìm kiếm — đặt tiêu chí sau khi đã biết kết quả dễ dẫn tới chọn tiêu chí vừa khớp với điều mình muốn tìm thấy.",
        "Không phải mọi nguồn tìm được có giá trị ngang nhau — một tổng quan hệ thống đầy đủ cần thẩm định chất lượng phương pháp của từng nguồn (Cochrane risk of bias, MMAT, CASP tuỳ loại thiết kế) trước khi đưa vào tổng hợp.",
        "Gộp số liệu bằng meta-analysis chỉ có ý nghĩa khi các nghiên cứu đủ đồng nhất về cách đo lường và định nghĩa biến; khi không đủ đồng nhất, tổng hợp tường thuật hoặc theo chủ đề là lựa chọn đúng, không phải lựa chọn kém hơn.",
        "Đăng ký protocol (tiêu chí, chiến lược tìm kiếm, kế hoạch phân tích) trước khi bắt đầu tìm kiếm thật làm tăng độ tin cậy của tổng quan và là yêu cầu ngày càng phổ biến ở các tạp chí quốc tế.",
    ],
    "splitSections": True,
    "body": r"""
Ma trận tổng quan và PRISMA rút gọn (đã học ở khoá Phương pháp nghiên cứu) đủ cho một luận văn. Ở mức công bố quốc tế, tổng quan tài liệu — đặc biệt nếu bản thân nó là một bài báo review — cần đầy đủ và minh bạch hơn nhiều: bài đi qua bốn bước, từ xác định tiêu chí chọn/loại nguồn theo khung PICOS trước khi tìm kiếm, tới thẩm định chất lượng phương pháp của từng nguồn, quyết định giữa gộp số liệu bằng meta-analysis hay tổng hợp tường thuật, và kết bằng việc đăng ký protocol trước khi bắt đầu tìm kiếm thật.

## Xác định tiêu chí chọn/loại trước khi tìm kiếm

> [!ghi-nho] Khung **PICOS** (Population, Intervention/Exposure, Comparison, Outcome, Study design) giúp xác định rõ tiêu chí chọn/loại nguồn **trước khi** chạy tìm kiếm: đối tượng nghiên cứu nào được tính, can thiệp/hiện tượng nào, so sánh gì (nếu có), đo kết quả nào, và chỉ nhận thiết kế nghiên cứu nào (ví dụ chỉ nhận nghiên cứu định lượng có nhóm đối chứng, hoặc mọi thiết kế).

> [!canh-bao] Đặt tiêu chí chọn/loại **sau khi** đã xem qua kết quả tìm kiếm — ví dụ thấy một nhóm nghiên cứu cho kết quả không như mong đợi rồi mới nghĩ ra lý do để loại chúng — là một dạng thiên lệch xác nhận nghiêm trọng. Tiêu chí phải cố định trước khi nhìn thấy nội dung các nghiên cứu, chỉ dựa trên đặc điểm khách quan (năm xuất bản, ngôn ngữ, loại thiết kế, đối tượng).

> [!vi-du] Với câu hỏi "AI tạo sinh ảnh hưởng tới động lực học tập của sinh viên đại học ra sao", khung PICOS được xác định trước: P = sinh viên đại học (loại học sinh phổ thông và sau đại học), I = sử dụng công cụ AI tạo sinh trong học tập, C = không bắt buộc có nhóm so sánh, O = động lực học tập đo bằng thang đo đã công bố, S = nghiên cứu định lượng hoặc hỗn hợp có đo lường định lượng (loại nghiên cứu định tính thuần và bài quan điểm/bình luận).

Với tiêu chí PICOS đã cố định, luồng lọc nguồn theo PRISMA cho một con số cụ thể ở mỗi bước — ví dụ minh hoạ:

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Tìm được từ các cơ sở dữ liệu (Scopus, WoS, ERIC)          n = 450
  − Loại trùng lặp                                          − 130
Sàng lọc theo tiêu đề/tóm tắt                                n = 320
  − Loại theo tiêu chí PICOS (không đúng P, I, hoặc S)       − 250
Đọc toàn văn để đánh giá đủ điều kiện                        n = 70
  − Loại sau đọc toàn văn (ghi rõ lý do từng bài, ví dụ:
    không đo đúng O = 25, không phải nghiên cứu gốc = 10,
    không đủ dữ liệu báo cáo = 5)                            − 40
Đưa vào tổng quan                                            n = 30</pre></div>
```

> [!meo] PRISMA yêu cầu ghi rõ **lý do loại** ở bước đọc toàn văn (không chỉ ở bước tiêu đề/tóm tắt) — vì đây là bước duy nhất reviewer có thể kiểm tra được tính nhất quán của việc áp dụng tiêu chí. Một tổng quan chỉ báo "n = 30 được đưa vào" mà không có số liệu ở các bước trung gian không đạt chuẩn PRISMA 2020.

## Thẩm định chất lượng nguồn

Một tổng quan chỉ liệt kê nguồn mà không đánh giá chất lượng phương pháp coi một nghiên cứu thiết kế yếu và một nghiên cứu thiết kế mạnh có giá trị ngang nhau khi tổng hợp — điều này không đứng được ở mức công bố quốc tế.

| Loại nguồn | Công cụ thẩm định chất lượng phổ biến |
|---|---|
| Nghiên cứu định lượng có nhóm đối chứng/thực nghiệm | Cochrane Risk of Bias Tool |
| Nghiên cứu định lượng không thực nghiệm (khảo sát cắt ngang...) | Các checklist tương ứng trong bộ công cụ JBI (Joanna Briggs Institute) |
| Nghiên cứu định tính | CASP (Critical Appraisal Skills Programme) Qualitative Checklist |
| Tổng quan có cả định lượng và định tính | MMAT (Mixed Methods Appraisal Tool) |

> [!canh-bao] Đưa mọi nguồn tìm được vào tổng hợp mà không thẩm định chất lượng — coi một nghiên cứu mẫu 15 người không mô tả rõ phương pháp chọn mẫu có giá trị ngang một nghiên cứu mẫu 500 người chọn ngẫu nhiên phân tầng — làm loãng chất lượng của toàn bộ tổng quan. Kết quả thẩm định (ví dụ phân loại rủi ro thiên lệch cao/trung bình/thấp) nên được báo cáo trong bảng và có thể dùng để quyết định có loại một số nguồn khỏi tổng hợp chính hay chỉ đưa vào phân tích bổ sung.

## Gộp số liệu hay tổng hợp tường thuật

Sau khi có danh sách nguồn đã thẩm định chất lượng, quyết định tiếp theo là cách tổng hợp.

> [!ghi-nho] **Meta-analysis** gộp effect size từ nhiều nghiên cứu bằng phương pháp thống kê để ra một ước lượng chung, mạnh hơn từng nghiên cứu riêng lẻ — nhưng chỉ có ý nghĩa khi các nghiên cứu đủ **đồng nhất** (cùng đo một hiện tượng bằng cách tương thích được). Mức độ không đồng nhất được đo bằng chỉ số **I²** — I² cao (thường > 75%) là dấu hiệu các nghiên cứu quá khác nhau để gộp số một cách có nghĩa.

> [!canh-bao] Cố gộp effect size từ các nghiên cứu đo "động lực học tập" bằng những thang đo hoàn toàn khác nhau, định nghĩa khái niệm khác nhau, hoặc trên đối tượng quá khác biệt, tạo ra một con số gộp không có ý nghĩa gì thật — dù về mặt tính toán vẫn ra được một số. Khi I² cao hoặc các nghiên cứu không đủ tương thích, **tổng hợp tường thuật hoặc theo chủ đề** (narrative/thematic synthesis) là lựa chọn đúng đắn, không phải một lựa chọn "kém hơn" khi không làm được thống kê.

I² ước lượng phần trăm biến thiên **giữa các nghiên cứu** không do sai số ngẫu nhiên (khác với biến thiên nội tại của từng nghiên cứu). Với 4 nghiên cứu đo cùng một effect size (ví dụ hệ số tương quan giữa dùng AI và động lực học tập):

```html
<div style="background:rgba(127,127,127,.07);border:1px solid rgba(127,127,127,.28);border-radius:.5rem;padding:.8rem 1rem;margin:1rem 0;overflow-x:auto"><pre style="margin:0;font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:1rem;line-height:1.7;white-space:pre">Nghiên cứu    r       n
A             0.42    120
B             0.15    95
C             0.51    150
D             0.08    80

I² = (Q − df) / Q × 100%   (Q: thống kê Cochran, df = số nghiên cứu − 1)
   → với 4 nghiên cứu có độ trải effect size lớn (0.08 tới 0.51) và cỡ mẫu
     đủ lớn để chênh lệch này khó do ngẫu nhiên, Q thường vượt xa df,
     cho I² ở khoảng 70-85% — mức cao</pre></div>
```

> [!ghi-nho] Không cần tự tay tính Q trong bài này (phần mềm như R `metafor` hoặc RevMan tính tự động) — điều quan trọng là **đọc đúng** con số I² phần mềm trả ra và biết ngưỡng: theo Higgins et al. (2003), I² quanh 25% là thấp, 50% là vừa, 75% trở lên là cao. Với ví dụ trên, r dao động từ 0.08 tới 0.51 (chênh lệch hơn 6 lần) trên cỡ mẫu đủ lớn để loại trừ khả năng đây chỉ là nhiễu ngẫu nhiên — đây chính là biểu hiện thực tế của I² cao: các nghiên cứu đang đo những thứ đủ khác nhau (có thể do khác định nghĩa "dùng AI", khác đối tượng) để việc gộp thành một con số duy nhất che giấu sự khác biệt quan trọng đó.

| Tình huống | Cách tổng hợp phù hợp |
|---|---|
| Nhiều nghiên cứu định lượng, cùng đo một biến bằng thang đo tương thích, I² thấp | Meta-analysis |
| Các nghiên cứu đo khác nhau, thiết kế khác nhau, hoặc trộn định lượng/định tính | Tổng hợp tường thuật hoặc theo chủ đề |
| Ít nghiên cứu (dưới 5-10), hoặc chất lượng phương pháp không đồng đều | Thường không đủ điều kiện cho meta-analysis đáng tin |

## Đăng ký protocol trước khi tìm kiếm

> [!ghi-nho] **Đăng ký protocol** (ví dụ trên PROSPERO cho tổng quan y sinh, hoặc OSF cho các lĩnh vực khác) là công bố trước công khai: câu hỏi nghiên cứu, tiêu chí PICOS, chiến lược tìm kiếm, và kế hoạch phân tích — **trước khi** bắt đầu tìm kiếm thật.

> [!canh-bao] Không đăng ký protocol trước không tự động làm tổng quan sai, nhưng nó làm mất một lớp bảo vệ chống thiên lệch: không có bằng chứng khách quan cho thấy tiêu chí và kế hoạch phân tích không bị thay đổi sau khi đã biết kết quả. Nhiều tạp chí quốc tế hàng đầu hiện yêu cầu hoặc ưu tiên các tổng quan có đăng ký protocol trước.

## Luyện tập và tài liệu tham khảo

### Cá nhân (45 phút)

Xác định khung PICOS cho câu hỏi tổng quan của bạn, trước khi xem lại bất kỳ kết quả tìm kiếm đã có. Chọn công cụ thẩm định chất lượng phù hợp với loại nguồn dự kiến. Ước lượng: dữ liệu của bạn có khả năng đủ đồng nhất cho meta-analysis, hay nên đi hướng tổng hợp tường thuật?

### Nhóm 3-4 người (30 phút)

Đổi khung PICOS cho nhau. Kiểm: tiêu chí có đủ khách quan để áp dụng nhất quán không, hay có kẽ hở cho việc chọn tiêu chí theo ý muốn sau khi xem kết quả? Thảo luận lựa chọn công cụ thẩm định chất lượng có phù hợp với loại thiết kế nguồn dự kiến không.

### Bài tập về nhà (90 phút)

Viết bản protocol tổng quan (400-600 từ): câu hỏi nghiên cứu, khung PICOS, chiến lược tìm kiếm (nguồn tra cứu, từ khoá), công cụ thẩm định chất lượng sẽ dùng, và kế hoạch tổng hợp (meta-analysis hoặc tường thuật, kèm lý do).

:::mau Mẫu nộp bài tập về nhà
**Câu hỏi tổng quan:** …

**Khung PICOS:** P … I/E … C … O … S …

**Chiến lược tìm kiếm:** nguồn tra cứu … , từ khoá …

**Công cụ thẩm định chất lượng:** …

**Kế hoạch tổng hợp và lý do:** ☐ Meta-analysis ☐ Tổng hợp tường thuật/theo chủ đề — vì …
:::

### Nguồn tham khảo

- Page, M. J., et al. (2021). The PRISMA 2020 statement: An updated guideline for reporting systematic reviews. *BMJ*, 372, n71.
- Higgins, J. P. T., et al. (Eds.). (2019). *Cochrane Handbook for Systematic Reviews of Interventions* (2nd ed.). Wiley.
- Hong, Q. N., et al. (2018). The Mixed Methods Appraisal Tool (MMAT), version 2018, for information professionals and researchers. *Education for Information*, 34(4), 285-291.
- Popay, J., et al. (2006). *Guidance on the Conduct of Narrative Synthesis in Systematic Reviews.* ESRC Methods Programme.
""",
    "quiz": {
        "title": "Kiểm tra nhanh · Bài 2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "cbqt2-picos-truoc-tim-kiem",
                "type": "mcq",
                "prompt": "Vì sao tiêu chí chọn/loại nguồn (theo khung PICOS) cần được xác định trước khi xem kết quả tìm kiếm, không phải sau?",
                "explanation": "Đặt tiêu chí sau khi đã xem kết quả dễ dẫn tới việc chọn tiêu chí sao cho vừa khớp với điều mình muốn tìm thấy — một dạng thiên lệch xác nhận. Tiêu chí phải dựa trên đặc điểm khách quan, cố định trước khi biết nội dung các nghiên cứu.",
                "points": 3,
                "options": [
                    {"label": "Để tránh thiên lệch xác nhận — chọn tiêu chí sao cho vừa khớp với kết quả mình muốn tìm thấy", "isCorrect": True},
                    {"label": "Không có lý do đặc biệt, chỉ là quy ước trình bày trong bài báo", "isCorrect": False, "misconception": "cbqt.eligibility-criteria-after-search"},
                    {"label": "Vì các cơ sở dữ liệu học thuật yêu cầu nhập tiêu chí trước khi tìm kiếm", "isCorrect": False, "misconception": "cbqt.eligibility-criteria-after-search"},
                    {"label": "Chỉ cần thiết với tổng quan y sinh, không cần với các lĩnh vực khác", "isCorrect": False, "misconception": "cbqt.eligibility-criteria-after-search"},
                ],
            },
            {
                "key": "cbqt2-tham-dinh-chat-luong",
                "type": "mcq",
                "prompt": "Một tổng quan đưa mọi nguồn tìm được vào tổng hợp, coi một nghiên cứu mẫu 15 người không rõ phương pháp chọn mẫu có giá trị ngang một nghiên cứu mẫu 500 người chọn ngẫu nhiên phân tầng. Vấn đề của cách làm này là gì?",
                "explanation": "Không phải mọi nguồn có giá trị ngang nhau — thiếu thẩm định chất lượng làm loãng chất lượng của toàn bộ tổng quan, vì các nghiên cứu thiết kế yếu và mạnh được đối xử như nhau khi tổng hợp.",
                "points": 3,
                "options": [
                    {"label": "Thiếu thẩm định chất lượng phương pháp — coi các nguồn có chất lượng khác nhau có giá trị ngang nhau khi tổng hợp", "isCorrect": True},
                    {"label": "Không có vấn đề gì, vì tổng quan chỉ cần liệt kê đầy đủ mọi nguồn tìm được", "isCorrect": False, "misconception": "cbqt.no-quality-appraisal"},
                    {"label": "Vấn đề duy nhất là nên loại bỏ hết các nghiên cứu mẫu nhỏ", "isCorrect": False, "misconception": "cbqt.no-quality-appraisal"},
                    {"label": "Không có vấn đề gì, cỡ mẫu không liên quan tới chất lượng phương pháp", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt2-i2-cao",
                "type": "mcq",
                "prompt": "Chỉ số I² giữa các nghiên cứu trong một tổng quan là 85% (rất cao). Quyết định nào phù hợp?",
                "explanation": "I² cao là dấu hiệu các nghiên cứu quá khác nhau để gộp số liệu bằng meta-analysis một cách có nghĩa. Trong trường hợp này, tổng hợp tường thuật hoặc theo chủ đề là lựa chọn đúng đắn, không phải lựa chọn kém hơn.",
                "points": 3,
                "options": [
                    {"label": "Chuyển sang tổng hợp tường thuật hoặc theo chủ đề, vì các nghiên cứu quá không đồng nhất để gộp số có nghĩa", "isCorrect": True},
                    {"label": "Vẫn chạy meta-analysis vì phần mềm thống kê vẫn tính ra được một con số", "isCorrect": False, "misconception": "cbqt.meta-analysis-forced"},
                    {"label": "Loại bỏ chỉ số I² khỏi báo cáo để tránh làm phức tạp bài viết", "isCorrect": False, "misconception": "cbqt.meta-analysis-forced"},
                    {"label": "Tăng số lượng nghiên cứu đưa vào để giảm I²", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt2-dang-ky-protocol",
                "type": "mcq",
                "prompt": "Đăng ký protocol tổng quan trước khi tìm kiếm (trên PROSPERO hoặc OSF) mang lại lợi ích gì?",
                "explanation": "Đăng ký trước công khai câu hỏi, tiêu chí và kế hoạch phân tích trước khi biết kết quả, tạo một lớp bảo vệ chống thiên lệch và tăng độ tin cậy của tổng quan — nhiều tạp chí quốc tế hàng đầu hiện ưu tiên các tổng quan có đăng ký protocol.",
                "points": 2,
                "options": [
                    {"label": "Tạo bằng chứng khách quan cho thấy tiêu chí và kế hoạch phân tích không bị thay đổi sau khi biết kết quả", "isCorrect": True},
                    {"label": "Giúp tìm kiếm tài liệu nhanh hơn vì hệ thống PROSPERO tự động tìm nguồn", "isCorrect": False},
                    {"label": "Là yêu cầu bắt buộc với mọi loại bài báo, không riêng tổng quan hệ thống", "isCorrect": False},
                    {"label": "Không có lợi ích gì thực chất, chỉ là thủ tục hình thức thêm", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt2-cong-cu-tham-dinh",
                "type": "mcq",
                "prompt": "Một tổng quan có cả nguồn định lượng và định tính. Công cụ thẩm định chất lượng nào phù hợp nhất?",
                "explanation": "MMAT (Mixed Methods Appraisal Tool) được thiết kế riêng cho tổng quan có cả nghiên cứu định lượng và định tính, khác với Cochrane Risk of Bias (chỉ cho thực nghiệm) hoặc CASP (chỉ cho định tính).",
                "points": 2,
                "options": [
                    {"label": "MMAT (Mixed Methods Appraisal Tool)", "isCorrect": True},
                    {"label": "Chỉ dùng Cochrane Risk of Bias Tool cho toàn bộ nguồn", "isCorrect": False},
                    {"label": "Chỉ dùng CASP Qualitative Checklist cho toàn bộ nguồn", "isCorrect": False},
                    {"label": "Không cần công cụ thẩm định nào nếu tổng quan có cả hai loại nguồn", "isCorrect": False},
                ],
            },
            {
                "key": "cbqt2-thu-tu-tong-quan-day-du",
                "type": "ordering",
                "prompt": "Sắp xếp đúng thứ tự các bước làm một tổng quan tài liệu hệ thống đầy đủ ở mức công bố quốc tế.",
                "explanation": "Từ xác định PICOS và đăng ký protocol, tìm kiếm và lọc theo PRISMA, thẩm định chất lượng từng nguồn, tới quyết định cách tổng hợp dựa trên mức độ đồng nhất.",
                "points": 3,
                "sequence": [
                    "Xác định khung PICOS và đăng ký protocol trước khi tìm kiếm",
                    "Tìm kiếm và lọc nguồn theo luồng PRISMA đầy đủ",
                    "Thẩm định chất lượng phương pháp của từng nguồn được đưa vào",
                    "Đánh giá mức độ đồng nhất (I²) giữa các nghiên cứu",
                    "Chọn cách tổng hợp: meta-analysis nếu đủ đồng nhất, tổng hợp tường thuật nếu không",
                ],
            },
            {
                "key": "cbqt2-noi-cong-cu-tong-quan",
                "type": "matching",
                "prompt": "Nối mỗi công cụ hoặc khái niệm với đúng vai trò của nó trong tổng quan hệ thống đầy đủ.",
                "explanation": "PICOS xác định tiêu chí chọn/loại; Cochrane Risk of Bias thẩm định chất lượng nghiên cứu thực nghiệm; I² đo mức độ đồng nhất giữa các nghiên cứu; PROSPERO/OSF là nơi đăng ký protocol trước khi tìm kiếm.",
                "points": 3,
                "pairs": [
                    {"left": "Khung PICOS", "right": "Xác định tiêu chí chọn/loại nguồn trước khi tìm kiếm"},
                    {"left": "Cochrane Risk of Bias Tool", "right": "Thẩm định chất lượng nghiên cứu thực nghiệm/có đối chứng"},
                    {"left": "Chỉ số I²", "right": "Đo mức độ đồng nhất giữa các nghiên cứu trước khi quyết định gộp số"},
                    {"left": "PROSPERO / OSF", "right": "Nơi đăng ký protocol tổng quan trước khi bắt đầu tìm kiếm"},
                ],
            },
            {
                "key": "cbqt2-viet-protocol",
                "type": "essay",
                "prompt": "Viết bản protocol tổng quan cho đề tài của bạn (250-350 từ), gồm: (a) khung PICOS đầy đủ; (b) chiến lược tìm kiếm (nguồn tra cứu, từ khoá chính); (c) công cụ thẩm định chất lượng sẽ dùng và lý do chọn; (d) kế hoạch tổng hợp dự kiến (meta-analysis hoặc tường thuật) và lý do.",
                "points": 5,
            },
        ],
    },
}
