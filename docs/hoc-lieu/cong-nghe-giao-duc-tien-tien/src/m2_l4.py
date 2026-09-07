# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2.4 · Sinh học liệu và chấm bài bằng AI",
    "durationMin": 55,
    "description": "Quy trình sinh câu hỏi có kiểm soát, các chỉ số trắc nghiệm để biết câu hỏi tốt hay xấu, độ tin cậy và thiên lệch của chấm tự luận bằng máy, và mô hình phân công trách nhiệm giữa người và máy.",
    "objectives": [
        "Tính và diễn giải được độ khó và độ phân biệt của một câu hỏi từ dữ liệu lượt làm",
        "Chỉ ra được ba lỗi điển hình của câu hỏi do mô hình sinh ra mà người rà soát hay bỏ sót",
        "Thiết kế được quy trình chấm bài có AI tham gia mà trách nhiệm quyết định vẫn thuộc về người",
    ],
    "summary": [
        "Sinh câu hỏi bằng mô hình là bài toán phân rã: trích ý chính, viết câu hỏi, sinh phương án nhiễu từ lỗi sai thường gặp, rồi rà theo bảng kiểm — không phải một lời nhắc duy nhất.",
        "Chất lượng câu hỏi không đánh giá bằng cảm nhận mà bằng số liệu lượt làm: độ khó, độ phân biệt và phân tích từng phương án nhiễu.",
        "Chấm tự luận bằng máy có thể đạt mức đồng thuận gần bằng hai người chấm, nhưng đồng thuận cao không loại trừ thiên lệch có hệ thống với một số nhóm người viết.",
        "Nguyên tắc phân công: máy đề xuất, người quyết định ở mọi quyết định có hậu quả với người học; và mọi quyết định phải tái dựng được khi bị khiếu nại.",
    ],
    "body": r"""
## Sinh câu hỏi: phân rã và ba lỗi hay bị bỏ sót

Sinh câu hỏi là ứng dụng được dùng nhiều nhất và cũng bị làm ẩu nhiều nhất. Quy trình dùng được là quy trình phân rã, đúng như Bài 2.2 đã nêu: trích ý chính từ bài học → viết câu hỏi bám từng ý → sinh phương án nhiễu **dựa trên lỗi sai thường gặp** → rà theo bảng kiểm. Bước thứ ba là bước tạo ra khác biệt: phương án nhiễu ngẫu nhiên chỉ đo được sự đoán mò, còn phương án nhiễu xuất phát từ một lỗi tư duy cụ thể **biến câu hỏi thành công cụ chẩn đoán** — đây chính là cơ chế mà hệ thống bạn đang học vận hành khi gắn mã lỗi tư duy vào từng phương án sai.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Dây chuyền sinh câu hỏi — mũi tên xuống là chỗ chèn kiểm tra của người</div>
  <div style="min-width:36rem;display:flex;align-items:center;gap:.35rem">
    <div style="flex:1;padding:.65rem .5rem;background:rgba(37,99,235,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Trích<br>ý chính</div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(13,148,136,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Viết câu hỏi<br>cho từng ý</div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(124,58,237,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Sinh nhiễu từ<br>lỗi sai thường gặp</div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(217,150,40,.85);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Rà theo<br>bảng kiểm</div>
    <div style="flex:0 0 auto;opacity:.5">→</div>
    <div style="flex:1;padding:.65rem .5rem;background:rgba(220,38,38,.8);color:#fff;border-radius:.4rem;text-align:center;font-size:1rem;line-height:1.45">Dữ liệu lượt làm:<br>độ khó, độ phân biệt</div>
  </div>
  <div style="min-width:36rem;display:flex;gap:.35rem;margin:.35rem 0 0;font-size:.98rem;line-height:1.45;opacity:.75">
    <div style="flex:1;text-align:center">↓ đối chiếu mục tiêu</div>
    <div style="flex:0 0 auto;width:1rem"></div>
    <div style="flex:1;text-align:center">↓ kiểm đo hiểu hay đo chữ</div>
    <div style="flex:0 0 auto;width:1rem"></div>
    <div style="flex:1;text-align:center">↓ nhiễu có căn cứ chưa</div>
    <div style="flex:0 0 auto;width:1rem"></div>
    <div style="flex:1;text-align:center">↓ đọc phương án không đọc đề</div>
    <div style="flex:0 0 auto;width:1rem"></div>
    <div style="flex:1;text-align:center">↓ loại câu phân biệt âm</div>
  </div>
</div>
```

Ba lỗi mà người rà soát nhanh hay bỏ sót:

| Lỗi | Biểu hiện | Vì sao khó thấy |
|---|---|---|
| Lộ đáp án qua hình thức | Phương án đúng dài hơn, chi tiết hơn, dùng từ hạn định mềm; các phương án sai ngắn và tuyệt đối | Đọc từng câu thì không thấy, chỉ lộ ra khi xếp cả bộ cạnh nhau |
| Đo trí nhớ từ ngữ thay vì hiểu | Câu hỏi lặp gần nguyên văn một câu trong bài, chọn được bằng cách khớp chữ | Nhìn qua rất giống câu hỏi hợp lệ, vì nó bám sát tài liệu |
| Nhiễu vô hiệu | Một hoặc hai phương án sai hiển nhiên tới mức không ai chọn | Chỉ phát hiện được sau khi có dữ liệu lượt làm |

> [!meo] Bài kiểm rẻ nhất cho lỗi thứ hai: che phần bài học đi và tự hỏi *người chưa đọc bài, nhưng có kiến thức nền tốt, có trả lời đúng không?* Nếu có, câu hỏi đang đo cái khác. Bài kiểm cho lỗi thứ nhất: đọc bốn phương án mà **không đọc đề**, xem có đoán ra đáp án chỉ bằng hình thức không.

## Biết câu hỏi tốt hay xấu bằng số liệu

Sau khi câu hỏi được dùng thật, ba chỉ số cơ bản cho biết nó có làm việc không. Đây là phần trắc nghiệm học tối thiểu mà một cử nhân Công nghệ giáo dục cần sử dụng thành thạo.

**Độ khó** *p* là tỉ lệ người làm trả lời đúng. Không có ngưỡng tuyệt đối, nhưng với câu bốn phương án, khoảng 0,3 đến 0,8 là vùng dùng được; dưới 0,2 hoặc trên 0,9 thì câu hỏi gần như không phân biệt được ai với ai. Lưu ý bẫy tên gọi: *p* càng cao nghĩa là câu càng **dễ**.

**Độ phân biệt** cho biết câu hỏi có tách được nhóm làm tốt khỏi nhóm làm kém không. Cách tính đơn giản dùng được ngay: lấy 27% người điểm cao nhất và 27% người điểm thấp nhất, rồi trừ tỉ lệ đúng của hai nhóm.

> [!ghi-nho] Độ phân biệt = tỉ lệ đúng của nhóm cao − tỉ lệ đúng của nhóm thấp. Từ 0,30 trở lên là tốt; 0,10 đến 0,29 là cần xem lại; **âm là dấu hiệu câu hỏi hỏng hoặc đáp án bị đánh sai** — nhóm giỏi lại sai nhiều hơn nhóm kém.

**Phân tích phương án nhiễu**: xem tỉ lệ chọn từng phương án sai. Phương án không ai chọn là phương án chết, nên thay. Phương án được nhóm điểm cao chọn nhiều hơn nhóm điểm thấp là dấu hiệu câu hỏi mơ hồ hoặc đáp án tranh cãi được — và nếu bạn đã gắn mã lỗi tư duy cho từng phương án, đó cũng chính là **dữ liệu để phát hiện lỗi tư duy phổ biến của cả lớp**, không chỉ để chấm điểm.

Với hệ thống lớn, các mô hình lý thuyết ứng đáp câu hỏi cho ước lượng tốt hơn vì tách được độ khó của câu ra khỏi năng lực người làm, nhưng chúng đòi cỡ mẫu lớn. Trong phạm vi một trường, ba chỉ số trên đã đủ để loại bỏ những câu hỏi tệ nhất.

## Chấm tự luận bằng máy: đồng thuận không đồng nghĩa với công bằng

Chấm tự luận tự động có lịch sử dài hơn nhiều so với mô hình ngôn ngữ hiện nay, và cách đo chất lượng đã ổn định: so điểm máy với điểm người bằng một chỉ số đồng thuận, phổ biến nhất là **kappa có trọng số bậc hai** — chỉ số phạt nặng những chỗ lệch xa, phù hợp với thang điểm có thứ tự. Mức đồng thuận giữa máy và người trong các hệ tốt có thể xấp xỉ mức đồng thuận giữa hai giám khảo người.

Nhưng đồng thuận cao **không** loại trừ ba rủi ro sau, và đây là chỗ người làm giáo dục phải cẩn thận hơn người làm kỹ thuật:

1. **Đo cái dễ đo.** Hệ chấm dễ bị chi phối bởi độ dài, độ phức tạp từ vựng, cấu trúc câu — những đặc trưng tương quan với chất lượng nhưng không phải chất lượng. Hệ quả: bài dài, dùng từ hoa mỹ được điểm cao hơn bài ngắn gọn sắc sảo.
2. **Thiên lệch theo nhóm.** Mức đồng thuận trung bình cao vẫn có thể che một sai lệch có hệ thống với một nhóm người viết — người viết bằng ngoại ngữ, người dùng phương ngữ, người học có nền tảng khác với dữ liệu huấn luyện. **Phải báo cáo hiệu năng tách theo nhóm**, không chỉ trung bình toàn bộ.
3. **Bị đánh lừa có chủ đích.** Khi biết hệ thống chấm gì, người học tối ưu theo đúng thứ đó — viết dài hơn, nhồi từ khoá, thêm câu chuyển tiếp rỗng. Đây không phải gian lận mà là phản ứng hợp lý với một thước đo lộ.

> [!canh-bao] Quy tắc tối thiểu khi đưa chấm tự động vào thật: **công bố cho người học biết máy chấm phần nào**, giữ quyền phúc khảo bởi người, và chạy kiểm tra thiên lệch tách theo nhóm trước khi triển khai. Bỏ bước ba là chỗ nhà trường gặp rủi ro pháp lý và uy tín lớn nhất.

## Người trong vòng lặp: phân công trách nhiệm cho rõ

Cụm từ *có người giám sát* dễ nói và khó kiểm. Bảng dưới đây làm nó thành các quyết định cụ thể, dùng được để viết vào quy trình của trường.

| Quyết định | Máy được làm gì | Người phải làm gì |
|---|---|---|
| Sinh câu hỏi cho ngân hàng đề | Sinh bản nháp, sinh phương án nhiễu theo lỗi thường gặp | Duyệt nội dung, kiểm đáp án, loại câu đo trí nhớ từ ngữ |
| Chấm bài luyện tập, không tính điểm | Chấm và phản hồi trực tiếp cho người học | Rà mẫu ngẫu nhiên định kỳ, theo dõi chỉ số bất thường |
| Chấm bài lấy điểm | Đề xuất điểm và trích dẫn căn cứ | **Quyết định điểm cuối**; bắt buộc rà toàn bộ ở vùng điểm ranh giới |
| Cảnh báo học sinh có nguy cơ | Tính chỉ số, xếp danh sách | Kiểm bối cảnh từng em trước khi hành động; quyết định can thiệp |
| Kết luận vi phạm liêm chính | Không được kết luận | Toàn quyền, dựa trên bằng chứng quá trình — xem Bài 2.5 |

Nguyên tắc gộp lại thành một câu: **máy đề xuất, người quyết định ở mọi quyết định có hậu quả với người học**. Kèm theo là hai yêu cầu kỹ thuật bắt buộc đã nêu ở Bài 2.1 — lưu vết đủ để tái dựng, và công bố rõ phần nào do máy làm.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Lấy 5 câu hỏi trắc nghiệm do một mô hình sinh ra cho một bài học bạn chọn. Chạy hai bài kiểm nhanh ở hộp mẹo: đọc phương án mà không đọc đề, và tự hỏi người chưa đọc bài có trả lời đúng không. Ghi lại câu nào rơi vào lỗi nào.

### Nhóm 3–4 người (30 phút)

Nhóm nhận một bảng dữ liệu lượt làm bài có thật hoặc mô phỏng (10 câu, 40 người làm). Tính độ khó và độ phân biệt cho từng câu, phân tích phương án nhiễu, rồi xếp ba nhóm: giữ nguyên, sửa, loại. Trình bày hai phút, bắt buộc nêu **một câu có độ phân biệt âm** và giải thích nguyên nhân có thể.

### Bài tập về nhà — sản phẩm số (120 phút)

Dựng một **dây chuyền sinh và kiểm định câu hỏi** cho một bài học trong chuyên môn của bạn.

1. Viết chuỗi bốn lời nhắc theo quy trình phân rã, trong đó bước sinh phương án nhiễu nhận đầu vào là danh sách lỗi sai thường gặp do bạn soạn.
2. Sinh 15 câu hỏi, rồi tự rà bằng bảng kiểm gồm ít nhất sáu tiêu chí (bám mục tiêu, không đo trí nhớ từ ngữ, không lộ đáp án qua hình thức, nhiễu có căn cứ, ngôn ngữ đúng lứa tuổi, đáp án đúng và duy nhất).
3. Cho ít nhất **8 người làm thử** (bạn cùng lớp cũng được), thu dữ liệu lượt làm.
4. Tính độ khó và độ phân biệt từng câu bằng bảng tính, phân tích phương án nhiễu, và đánh dấu câu cần loại hoặc sửa.
5. Nộp: chuỗi lời nhắc, 15 câu, bảng kiểm đã chấm, bảng số liệu, và nửa trang kết luận — mô hình mắc lỗi loại nào nhiều nhất, và bạn sẽ sửa bước nào trong dây chuyền.

**Cách làm (gợi ý từng bước):** giữ mọi câu hỏi trong một bảng tính với cột mã câu, mục tiêu tương ứng, mã lỗi tư duy cho từng phương án nhiễu; thu lượt làm bằng bất kỳ công cụ biểu mẫu nào rồi tải về dạng bảng; công thức độ phân biệt làm bằng hai hàm đếm trên nhóm 27% cao và 27% thấp; đừng loại câu chỉ vì khó — xem độ phân biệt trước.

**Chấm theo:** chuỗi lời nhắc phân rã đúng và nhiễu gắn lỗi tư duy thật (3đ) · bảng kiểm sáu tiêu chí, có bằng chứng đã rà (2đ) · dữ liệu lượt làm thật và tính đúng hai chỉ số (3đ) · kết luận chỉ ra được lỗi hệ thống của dây chuyền, không chỉ liệt kê từng câu (2đ).

### Nguồn tham khảo

- Haladyna, T. M., & Rodriguez, M. C. (2013). *Developing and Validating Test Items.* Routledge.
- Gierl, M. J., & Haladyna, T. M. (2013). *Automatic Item Generation: Theory and Practice.* Routledge.
- Cohen, J. (1968). Weighted kappa: Nominal scale agreement with provision for scaled disagreement. *Psychological Bulletin*, 70(4), 213–220.
- Madnani, N., & Cahill, A. (2018). Automated scoring: Beyond natural language processing. *Proceedings of COLING 2018*, 1099–1109.
""",
    "quiz": {
        "title": "Kiểm tra Bài 2.4",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "2.4-nhieu-co-can-cu",
                "type": "mcq",
                "prompt": "Vì sao phương án nhiễu nên xuất phát từ lỗi sai thường gặp thay vì được sinh ngẫu nhiên?",
                "explanation": "Nhiễu có căn cứ biến câu hỏi thành công cụ chẩn đoán: người chọn nó cho biết đang mắc lỗi tư duy nào. Nhiễu ngẫu nhiên chỉ đo được sự đoán mò.",
                "points": 2,
                "options": [
                    {"label": "Vì nó biến câu hỏi thành công cụ chẩn đoán lỗi tư duy, không chỉ để chấm đúng sai", "isCorrect": True},
                    {"label": "Vì nhiễu ngẫu nhiên làm câu hỏi quá khó", "isCorrect": False},
                    {"label": "Vì mô hình sinh nhiễu ngẫu nhiên chậm hơn", "isCorrect": False},
                    {"label": "Vì quy chế thi bắt buộc như vậy", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-do-kho",
                "type": "fill_in",
                "prompt": "Trong 40 người làm, có 12 người trả lời đúng câu số 7. Độ khó p của câu này bằng bao nhiêu? (Ghi số thập phân, ví dụ 0,25)",
                "explanation": "p = 12 ÷ 40 = 0,30. Đây là ngưỡng dưới của vùng dùng được với câu bốn phương án; cần xem thêm độ phân biệt trước khi kết luận nên giữ hay bỏ.",
                "points": 2,
                "answers": ["0,3", "0.3", "0,30", "0.30"],
            },
            {
                "key": "2.4-phan-biet-am",
                "type": "mcq",
                "prompt": "Một câu hỏi có độ phân biệt âm. Cách đọc đúng là gì?",
                "explanation": "Nhóm điểm cao trả lời đúng ít hơn nhóm điểm thấp — dấu hiệu câu hỏi hỏng, đề mơ hồ, hoặc đáp án bị đánh sai. Phải rà lại ngay, không dùng tiếp.",
                "points": 2,
                "options": [
                    {"label": "Nhóm giỏi sai nhiều hơn nhóm kém: câu hỏi hỏng, đề mơ hồ hoặc đáp án bị đánh sai", "isCorrect": True},
                    {"label": "Câu hỏi quá khó nên cần giảm độ khó", "isCorrect": False},
                    {"label": "Câu hỏi phân biệt rất tốt theo chiều ngược lại", "isCorrect": False},
                    {"label": "Cỡ mẫu chưa đủ nên bỏ qua được", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-tri-nho-tu-ngu",
                "type": "mcq",
                "prompt": "Cách kiểm nhanh nhất để phát hiện câu hỏi chỉ đo trí nhớ từ ngữ chứ không đo hiểu là gì?",
                "explanation": "Che bài học đi và hỏi: người chưa đọc bài nhưng có kiến thức nền tốt có trả lời đúng không. Nếu có, câu hỏi đang đo cái khác — thường là khả năng khớp chữ với tài liệu.",
                "points": 2,
                "options": [
                    {"label": "Hỏi xem người có kiến thức nền tốt nhưng chưa đọc bài có trả lời đúng được không", "isCorrect": True},
                    {"label": "Đếm số từ trong đề bài", "isCorrect": False},
                    {"label": "Xem câu hỏi có nằm trong sách giáo khoa không", "isCorrect": False},
                    {"label": "Hỏi mô hình xem câu hỏi có tốt không", "isCorrect": False, "misconception": "cngdtt.ai-output-unchecked"},
                ],
            },
            {
                "key": "2.4-lo-dap-an-hinh-thuc",
                "type": "mcq",
                "prompt": "Bộ câu hỏi có phương án đúng luôn dài nhất và dùng từ hạn định mềm, còn phương án sai ngắn và tuyệt đối. Vấn đề gì và phát hiện thế nào?",
                "explanation": "Lộ đáp án qua hình thức — người làm đoán được mà không cần biết nội dung. Phát hiện bằng cách đọc bốn phương án mà không đọc đề, và bằng cách xếp cả bộ cạnh nhau.",
                "points": 2,
                "options": [
                    {"label": "Lộ đáp án qua hình thức; phát hiện bằng cách đọc các phương án mà không đọc đề", "isCorrect": True},
                    {"label": "Nhiễu vô hiệu; phát hiện bằng dữ liệu lượt làm", "isCorrect": False},
                    {"label": "Câu hỏi đo trí nhớ từ ngữ; phát hiện bằng cách che bài học", "isCorrect": False},
                    {"label": "Không có vấn đề gì nếu nội dung đáp án đúng", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-qwk",
                "type": "mcq",
                "prompt": "Vì sao kappa có trọng số bậc hai phù hợp để đo đồng thuận giữa điểm máy và điểm người?",
                "explanation": "Thang điểm là thang có thứ tự, và chỉ số này phạt nặng những chỗ lệch xa hơn là lệch gần — đúng với trực giác rằng chấm 3 thay vì 4 nhẹ hơn nhiều so với chấm 1 thay vì 4.",
                "points": 2,
                "options": [
                    {"label": "Vì thang điểm có thứ tự và chỉ số này phạt nặng những chỗ lệch xa hơn lệch gần", "isCorrect": True},
                    {"label": "Vì nó luôn cho giá trị cao hơn hệ số tương quan", "isCorrect": False},
                    {"label": "Vì nó không phụ thuộc vào cỡ mẫu", "isCorrect": False},
                    {"label": "Vì nó đo được cả tính công bằng giữa các nhóm người viết", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-dong-thuan-khong-cong-bang",
                "type": "mcq",
                "prompt": "Một hệ chấm tự luận đạt mức đồng thuận trung bình với giám khảo người ngang mức hai giám khảo người với nhau. Kết luận nào đúng?",
                "explanation": "Đồng thuận trung bình cao vẫn có thể che sai lệch có hệ thống với một nhóm người viết. Phải báo cáo hiệu năng tách theo nhóm trước khi triển khai.",
                "points": 2,
                "options": [
                    {"label": "Chưa đủ: cần kiểm hiệu năng tách theo nhóm người viết để loại trừ thiên lệch có hệ thống", "isCorrect": True},
                    {"label": "Đủ để thay thế hoàn toàn giám khảo người", "isCorrect": False, "misconception": "cngdtt.ai-output-unchecked"},
                    {"label": "Đủ nếu nhà cung cấp đã công bố số liệu này", "isCorrect": False, "misconception": "cngdtt.vendor-evidence"},
                    {"label": "Không kết luận được gì vì chỉ số đồng thuận không có ý nghĩa", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-do-cai-de-do",
                "type": "mcq",
                "prompt": "Rủi ro đo cái dễ đo trong chấm tự động biểu hiện thế nào?",
                "explanation": "Hệ thống bị chi phối bởi độ dài, độ phức tạp từ vựng và cấu trúc câu — những đặc trưng tương quan với chất lượng nhưng không phải chất lượng. Bài dài hoa mỹ được điểm cao hơn bài ngắn gọn sắc sảo.",
                "points": 2,
                "options": [
                    {"label": "Bài dài, từ ngữ hoa mỹ được điểm cao hơn bài ngắn gọn nhưng sắc sảo", "isCorrect": True},
                    {"label": "Máy chấm chậm hơn người", "isCorrect": False},
                    {"label": "Máy không đọc được chữ viết tay", "isCorrect": False},
                    {"label": "Máy luôn chấm điểm thấp hơn người", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-toi-uu-theo-thuoc-do",
                "type": "mcq",
                "prompt": "Khi biết hệ thống chấm gì, học sinh viết dài hơn và nhồi từ khoá. Cách hiểu đúng về hiện tượng này là gì?",
                "explanation": "Đó là phản ứng hợp lý với một thước đo bị lộ, không phải hành vi gian lận. Vấn đề nằm ở thước đo, và cách gỡ là đổi thiết kế đánh giá chứ không phải quy trách nhiệm cho người học.",
                "points": 2,
                "options": [
                    {"label": "Phản ứng hợp lý với thước đo bị lộ — vấn đề nằm ở thiết kế đánh giá", "isCorrect": True},
                    {"label": "Hành vi gian lận cần xử lý kỷ luật", "isCorrect": False},
                    {"label": "Bằng chứng cho thấy hệ chấm hoạt động tốt", "isCorrect": False},
                    {"label": "Hiện tượng ngẫu nhiên, không cần xử lý", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-phan-cong-trach-nhiem",
                "type": "matching",
                "prompt": "Ghép mỗi loại quyết định với mức độ tham gia hợp lý của máy.",
                "explanation": "Nguyên tắc gộp: máy đề xuất, người quyết định ở mọi quyết định có hậu quả với người học; kết luận vi phạm liêm chính thì máy không được tham gia.",
                "points": 3,
                "pairs": [
                    {"left": "Chấm bài luyện tập không tính điểm", "right": "Máy chấm và phản hồi trực tiếp, người rà mẫu ngẫu nhiên"},
                    {"left": "Chấm bài lấy điểm", "right": "Máy đề xuất điểm kèm căn cứ, người quyết định điểm cuối"},
                    {"left": "Cảnh báo học sinh có nguy cơ", "right": "Máy tính chỉ số, người kiểm bối cảnh trước khi hành động"},
                    {"left": "Kết luận vi phạm liêm chính học thuật", "right": "Máy không được kết luận, người toàn quyền dựa trên bằng chứng quá trình"},
                ],
            },
            {
                "key": "2.4-nhieu-chet",
                "type": "mcq",
                "prompt": "Phân tích phương án nhiễu cho thấy một phương án không ai chọn, và một phương án được nhóm điểm cao chọn nhiều hơn nhóm điểm thấp. Nên làm gì?",
                "explanation": "Phương án chết thì thay. Phương án hút nhóm điểm cao là dấu hiệu đề mơ hồ hoặc đáp án tranh cãi được — phải rà lại nội dung câu hỏi, không chỉ đổi phương án.",
                "points": 2,
                "options": [
                    {"label": "Thay phương án chết; rà lại đề và đáp án ở phương án hút nhóm điểm cao", "isCorrect": True},
                    {"label": "Giữ nguyên cả hai vì độ khó vẫn nằm trong vùng dùng được", "isCorrect": False},
                    {"label": "Loại câu hỏi khỏi ngân hàng đề", "isCorrect": False},
                    {"label": "Đảo thứ tự các phương án", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-cong-bo-may-cham",
                "type": "true_false",
                "prompt": "Khi đưa chấm tự động vào sử dụng thật, nhà trường nên công bố cho người học biết máy chấm phần nào và giữ quyền phúc khảo bởi người.",
                "explanation": "Đúng, và cần thêm bước thứ ba: chạy kiểm tra thiên lệch tách theo nhóm trước khi triển khai. Bỏ bước này là chỗ rủi ro pháp lý và uy tín lớn nhất.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "2.4-quy-trinh-sinh",
                "type": "ordering",
                "prompt": "Sắp xếp quy trình sinh câu hỏi có kiểm soát theo đúng thứ tự.",
                "explanation": "Phân rã cho phép chèn kiểm tra của người vào đúng chỗ, và đưa danh sách lỗi sai thường gặp vào bước sinh nhiễu là bước quyết định chất lượng chẩn đoán.",
                "points": 3,
                "sequence": [
                    "Trích các ý chính và đối chiếu với mục tiêu bài học",
                    "Viết câu hỏi bám từng ý chính",
                    "Sinh phương án nhiễu dựa trên danh sách lỗi sai thường gặp",
                    "Rà toàn bộ theo bảng kiểm chất lượng câu hỏi",
                    "Thu dữ liệu lượt làm và tính độ khó, độ phân biệt để loại câu hỏng",
                ],
            },
            {
                "key": "2.4-viet-luan-cham",
                "type": "essay",
                "prompt": "Trường bạn muốn dùng AI chấm bài luận giữa kỳ để giảm tải cho giáo viên. Viết 250–350 từ đề xuất quy trình: máy làm gì, người làm gì, kiểm thiên lệch thế nào, công bố với học sinh ra sao, và xử lý phúc khảo thế nào.",
                "points": 5,
            },
        ],
    },
}
