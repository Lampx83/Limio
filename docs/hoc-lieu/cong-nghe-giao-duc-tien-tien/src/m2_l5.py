# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 2.5 · Liêm chính, thiên lệch và chính sách dùng AI trong nhà trường",
    "durationMin": 50,
    "description": "Vì sao công cụ dò văn bản AI không dùng được làm bằng chứng, cách thiết kế đánh giá trong thời AI, thiên lệch với người học Việt Nam, và khung chính sách phải tuân thủ.",
    "objectives": [
        "Giải thích được bằng số liệu vì sao không được kết luận gian lận dựa trên công cụ dò văn bản AI",
        "Thiết kế được nhiệm vụ đánh giá thu được bằng chứng quá trình thay vì chỉ sản phẩm cuối",
        "Soạn được quy định mức độ cho phép dùng AI cho một học phần, kèm cách kiểm chứng",
    ],
    "summary": [
        "Công cụ dò văn bản AI có tỉ lệ báo động giả cao và lệch có hệ thống: hơn một nửa bài luận của người viết tiếng Anh không phải bản ngữ bị gán nhầm là do AI viết.",
        "Cách gỡ không phải công cụ dò tốt hơn mà là thiết kế đánh giá thu bằng chứng quá trình: bản nháp, lịch sử sửa, trình bày miệng, nhiệm vụ gắn bối cảnh cá nhân.",
        "Thang mức độ cho phép dùng AI biến câu hỏi cấm hay không cấm thành câu hỏi mức nào cho nhiệm vụ nào, và bắt buộc người học khai báo phần AI tham gia.",
        "Ràng buộc chính sách hiện hành gồm hướng dẫn quốc tế về ngưỡng tuổi và giám sát, khung giáo dục AI cho phổ thông của Bộ, và nghĩa vụ bảo vệ dữ liệu khi gọi dịch vụ bên thứ ba.",
    ],
    "body": r"""
## Công cụ dò văn bản AI: vì sao không dùng làm bằng chứng

Đây là chỗ một quyết định sai làm hỏng cuộc đời một học sinh, nên phải nắm bằng số liệu chứ không bằng cảm tính.

Nghiên cứu được trích dẫn nhiều nhất là Liang và cộng sự (2023) trên *Patterns*: khi cho các công cụ dò văn bản AI phổ biến chấm bài luận **do người thật viết**, các công cụ này gán nhầm **hơn một nửa số bài luận của người viết tiếng Anh không phải bản ngữ** là do AI tạo ra, trong khi gần như không mắc lỗi với bài của học sinh bản ngữ. Cơ chế giải thích: các công cụ này dựa vào độ bất ngờ của chuỗi từ; người viết bằng ngoại ngữ dùng cấu trúc và từ vựng đều đặn hơn, nên văn bản của họ trông giống văn bản máy theo đúng thước đo ấy.

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Tỉ lệ bài do NGƯỜI THẬT viết bị gán nhầm là AI · Liang và cộng sự, 2023</div>
  <div style="display:flex;flex-direction:column;gap:.45rem">
    <div style="display:flex;align-items:center;gap:.6rem">
      <div style="flex:0 0 14rem;font-size:1.05rem;line-height:1.45">Bài luận của học sinh bản ngữ</div>
      <div style="flex:1"><div style="width:4%;min-width:4.5rem;background:rgba(13,148,136,.9);color:#fff;padding:.4rem .5rem;border-radius:.3rem;font-size:1rem">gần 0%</div></div>
    </div>
    <div style="display:flex;align-items:center;gap:.6rem">
      <div style="flex:0 0 14rem;font-size:1.05rem;line-height:1.45"><strong>Bài luận TOEFL của người viết không phải bản ngữ</strong></div>
      <div style="flex:1"><div style="width:56%;background:rgba(220,38,38,.9);color:#fff;padding:.4rem .5rem;border-radius:.3rem;font-size:1rem;font-weight:600">hơn một nửa bị gán nhầm</div></div>
    </div>
  </div>
  <div style="margin:.7rem 0 0;padding:.6rem .8rem;background:rgba(220,38,38,.12);border-left:4px solid rgba(220,38,38,.6);border-radius:0 .35rem .35rem 0;font-size:1.05rem;line-height:1.6">Học sinh Việt Nam viết tiếng Anh nằm đúng vào nhóm bị báo động giả nhiều nhất. Một quy định kỷ luật dựa trên điểm số của công cụ dò sẽ đánh trúng nhóm này trước tiên.</div>
</div>
```

Ba hệ quả trực tiếp cho nhà trường Việt Nam:

1. **Đúng nhóm học sinh của chúng ta là nhóm bị báo động giả nhiều nhất** khi viết tiếng Anh, và cơ chế tương tự áp cho học sinh viết bằng văn phong khuôn mẫu đã được luyện.
2. Điểm số của công cụ dò **không phải bằng chứng**: nó không nêu được căn cứ kiểm chứng được, không tái lập được, và không cho bị cáo cơ hội phản bác cụ thể.
3. Người học đã dùng AI **và biết cách viết lại** thì gần như không bị phát hiện — nên công cụ dò chủ yếu bắt được người thật thà hoặc người viết bằng ngoại ngữ.

> [!canh-bao] Quy tắc nghề nghiệp: **không bao giờ mở một cuộc kỷ luật chỉ dựa trên điểm số của công cụ dò AI.** Nếu nhà trường muốn có quy định, quy định ấy phải nêu rõ công cụ dò chỉ là tín hiệu để mở đối thoại, và kết luận phải dựa trên bằng chứng quá trình.

## Thiết kế đánh giá thay vì đuổi bắt

Câu hỏi đúng không phải *làm sao phát hiện học sinh dùng AI*, mà là *làm sao thiết kế nhiệm vụ mà sản phẩm cuối không đủ để kết luận, còn quá trình thì nói lên năng lực*. Bốn nhóm biện pháp, xếp theo mức độ hiệu quả trong thực tế:

| Nhóm | Biện pháp | Vì sao khó lách |
|---|---|---|
| Bằng chứng quá trình | Nộp kèm bản nháp theo mốc, lịch sử sửa, ghi chú nghiên cứu, nhật ký quyết định | Bắt chước cả một quá trình tốn công hơn tự làm |
| Gắn bối cảnh cá nhân và địa phương | Phân tích dữ liệu do chính người học thu, trường hợp ở chính lớp mình, phỏng vấn người thật | Mô hình không có dữ liệu ấy |
| Trình bày và bảo vệ | Vấn đáp năm phút về chính sản phẩm mình nộp, chất vấn vào lựa chọn thiết kế | Không hiểu thì không trả lời được, dù sản phẩm hoàn hảo |
| Đánh giá tại chỗ | Bài viết ngắn tại lớp, thao tác trực tiếp | Kiểm soát điều kiện, nhưng đo được ít loại năng lực hơn |

Trong đồ án sách AR của học phần này, ba nhóm đầu đều đã có sẵn: các bạn nộp theo sáu mốc, làm trên nội dung và người học cụ thể của mình, và bảo vệ bằng demo trực tiếp. Đó không phải sự trùng hợp — đây là thiết kế đánh giá thời AI, và các bạn nên mang đúng mẫu hình ấy sang lớp học của mình sau này.

Song song, cần chuyển từ câu hỏi *cấm hay không cấm* sang **quy định mức độ cho phép theo từng nhiệm vụ**. Một thang bốn mức đủ dùng cho hầu hết học phần:

| Mức | Cho phép | Người học phải khai báo |
|---|---|---|
| 0 — Không dùng | Nhiệm vụ đo năng lực nền, làm tại chỗ | Không áp dụng |
| 1 — Hỗ trợ chuẩn bị | Dùng để tìm ý, giải thích khái niệm, luyện tập; sản phẩm nộp phải tự viết | Nêu đã dùng cho việc gì |
| 2 — Đồng soạn có kiểm chứng | Dùng để sinh bản nháp, người học biên tập và chịu trách nhiệm nội dung | Nộp kèm nhật ký: lời nhắc chính, phần giữ, phần sửa, phần bỏ và lý do |
| 3 — Đối tượng nghiên cứu | Chính đầu ra của AI là dữ liệu để phân tích, phê phán | Nộp nguyên văn đầu ra kèm phân tích |

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="min-width:34rem;display:flex;gap:.35rem">
    <div style="flex:1;border-radius:.45rem;overflow:hidden;border:1px solid rgba(127,127,127,.3)">
      <div style="background:rgba(120,113,108,.85);color:#fff;padding:.5rem;text-align:center;font-size:1.02rem;font-weight:600">Mức 0<br>Không dùng</div>
      <div style="padding:.6rem;font-size:1rem;line-height:1.5">Đo năng lực nền, làm tại chỗ</div>
    </div>
    <div style="flex:1;border-radius:.45rem;overflow:hidden;border:1px solid rgba(127,127,127,.3)">
      <div style="background:rgba(37,99,235,.85);color:#fff;padding:.5rem;text-align:center;font-size:1.02rem;font-weight:600">Mức 1<br>Hỗ trợ chuẩn bị</div>
      <div style="padding:.6rem;font-size:1rem;line-height:1.5">Tìm ý, giải thích khái niệm; sản phẩm tự viết</div>
    </div>
    <div style="flex:1;border-radius:.45rem;overflow:hidden;border:2px solid rgba(13,148,136,.6)">
      <div style="background:rgba(13,148,136,.9);color:#fff;padding:.5rem;text-align:center;font-size:1.02rem;font-weight:600">Mức 2<br>Đồng soạn có kiểm chứng</div>
      <div style="padding:.6rem;font-size:1rem;line-height:1.5">Sinh bản nháp, người học biên tập và chịu trách nhiệm — <strong>nộp kèm nhật ký AI</strong><br><span style="opacity:.75">mốc 2 của đồ án nằm ở đây</span></div>
    </div>
    <div style="flex:1;border-radius:.45rem;overflow:hidden;border:1px solid rgba(127,127,127,.3)">
      <div style="background:rgba(124,58,237,.85);color:#fff;padding:.5rem;text-align:center;font-size:1.02rem;font-weight:600">Mức 3<br>Đối tượng nghiên cứu</div>
      <div style="padding:.6rem;font-size:1rem;line-height:1.5">Chính đầu ra của AI là dữ liệu để phân tích, phê phán</div>
    </div>
  </div>
</div>
```

> [!ghi-nho] Điều kiện để thang này chạy được: **mỗi nhiệm vụ trong đề cương học phần phải ghi rõ mức**, và nhiệm vụ mức 2 phải yêu cầu nhật ký như một phần của sản phẩm nộp — chấm nhật ký chứ không chỉ chấm bài.

## Thiên lệch và công bằng với người học Việt Nam

Ngoài thiên lệch của công cụ dò, có ba dạng thiên lệch khác cần tính khi triển khai ở Việt Nam:

**Chênh lệch chất lượng theo ngôn ngữ.** Mô hình được huấn luyện chủ yếu trên văn bản tiếng Anh; chất lượng tiếng Việt kém hơn ở những chỗ khó thấy — thuật ngữ chuyên ngành theo chương trình Việt Nam, cách diễn đạt trong sách giáo khoa, tên riêng và địa danh. Với tiếng dân tộc thiểu số thì gần như không dùng được. Hệ quả thiết kế: **luôn kiểm chất lượng đầu ra trên chính ngữ liệu tiếng Việt của môn học**, đừng suy ra từ ấn tượng khi dùng tiếng Anh.

**Chênh lệch nội dung theo bối cảnh.** Mô hình biết rất nhiều về hệ thống giáo dục nói tiếng Anh và rất ít về chương trình, quy chế, kỳ thi của Việt Nam. Câu trả lời về những chủ đề này thường trôi chảy và sai — kiểu sai nguy hiểm nhất.

**Chênh lệch tiếp cận.** Bản miễn phí và bản trả phí khác nhau đáng kể về chất lượng và giới hạn sử dụng. Khi giao bài tập bắt buộc dùng AI, giáo viên tạo ra một lớp bất bình đẳng mới ngay trong lớp học của mình — đây là tầng thứ nhất của khoảng cách số ở Bài 1.5, xuất hiện lại dưới hình thức mới.

## Khung chính sách và nghĩa vụ phải tuân thủ

| Nguồn | Nội dung liên quan | Việc phải làm |
|---|---|---|
| Hướng dẫn của UNESCO về AI tạo sinh trong giáo dục (2023) | Khuyến nghị ngưỡng tuổi tối thiểu cho việc dùng độc lập trong lớp, yêu cầu giám sát của người lớn, thẩm định trước khi đưa vào dạy học | Nêu rõ trong kế hoạch: học sinh lớp nào được dùng, có ai giám sát |
| Quyết định 2422/QĐ-BGDĐT (2026) và hướng dẫn kèm theo | Khung nội dung giáo dục AI cho học sinh phổ thông, gồm cả yêu cầu về sử dụng an toàn, có đạo đức, có kiểm chứng | Học liệu bạn làm phải bám yêu cầu cần đạt trong khung này |
| Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15 | Nghĩa vụ khi gửi dữ liệu người học cho bên thứ ba, kể cả xuyên biên giới | Khử nhận dạng trước khi gửi; nêu căn cứ; không dán bài làm có thông tin định danh |
| Quy chế của cơ sở giáo dục | Mức cho phép dùng AI theo nhiệm vụ, quy trình xử lý nghi vấn liêm chính | Đề cương học phần ghi rõ mức cho từng nhiệm vụ |

> [!vi-du] Tình huống rất hay gặp và thường bị làm sai: giáo viên dán cả tệp bài làm của lớp vào một dịch vụ AI công cộng để nhờ tóm tắt lỗi sai chung. Bài làm có tên học sinh, có thể có thông tin cá nhân trong nội dung. Đó là chuyển dữ liệu cá nhân cho bên thứ ba, thường xuyên biên giới, không có căn cứ và không có sự đồng ý. Cách làm đúng: bỏ tên và mọi chi tiết định danh, chỉ gửi phần văn bản cần phân tích.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Lấy hai đoạn văn: một do bạn tự viết bằng tiếng Anh, một do mô hình viết. Cho qua hai công cụ dò văn bản AI miễn phí và ghi lại kết quả. Viết ba dòng: kết quả có nhất quán giữa hai công cụ không, và bạn sẽ nói gì nếu một giáo viên định dùng kết quả ấy để kỷ luật học sinh.

### Nhóm 3–4 người (30 phút)

Nhóm nhận một nhiệm vụ đánh giá truyền thống (bài tiểu luận 1500 từ nộp cuối kỳ). Thiết kế lại nó thành nhiệm vụ thu được bằng chứng quá trình, dùng ít nhất ba nhóm biện pháp trong bảng, mà **không tăng thời gian chấm của giáo viên quá 20%**. Trình bày và bảo vệ ràng buộc thời gian ấy.

### Bài tập về nhà — sản phẩm số (90 phút)

Soạn **bộ quy định dùng AI cho một học phần**, dạng tài liệu phát cho sinh viên, dùng được ngay.

1. Liệt kê mọi nhiệm vụ đánh giá của học phần, gán mức 0–3 cho từng nhiệm vụ kèm một câu lý do.
2. Soạn **mẫu nhật ký AI** cho nhiệm vụ mức 2: các trường bắt buộc, độ dài mong đợi, ví dụ điền mẫu.
3. Viết quy trình xử lý nghi vấn: tín hiệu nào khởi động đối thoại, đối thoại gồm gì, bằng chứng nào được và không được dùng làm căn cứ kết luận.
4. Viết một đoạn về bảo vệ dữ liệu: giáo viên và sinh viên được và không được đưa gì vào dịch vụ AI.
5. Thử nghiệm: đưa bản quy định cho ít nhất **hai người ngoài nhóm** đọc, ghi lại chỗ họ hiểu sai, và sửa.

**Cách làm (gợi ý từng bước):** viết bằng ngôn ngữ nói được với sinh viên, câu ngắn, không dùng thuật ngữ pháp lý không giải thích; mẫu nhật ký nên gọn tới mức điền trong 10 phút, nếu không sẽ không ai điền; phần xử lý nghi vấn phải nêu rõ điều gì **không** được dùng làm bằng chứng — đó là phần bảo vệ cả thầy lẫn trò.

**Chấm theo:** gán mức có lý do gắn với mục tiêu học tập (3đ) · mẫu nhật ký thực dụng, điền được nhanh (2đ) · quy trình xử lý nghi vấn nêu rõ giới hạn của bằng chứng (3đ) · phần dữ liệu đúng nghĩa vụ pháp lý (1đ) · có bằng chứng đã thử với người đọc và đã sửa (1đ).

### Nguồn tham khảo

- Liang, W., Yuksekgonul, M., Mao, Y., Wu, E., & Zou, J. (2023). GPT detectors are biased against non-native English writers. *Patterns*, 4(7). — [doi.org/10.1016/j.patter.2023.100779](https://doi.org/10.1016/j.patter.2023.100779)
- UNESCO (2023). *Guidance for generative AI in education and research.* — [unesco.org](https://www.unesco.org/en/articles/guidance-generative-ai-education-and-research)
- Perkins, M., Furze, L., Roe, J., & MacVaugh, J. (2024). The AI Assessment Scale: A framework for ethical integration of generative AI in educational assessment. *Journal of University Teaching and Learning Practice*, 21(6).
- Bộ Giáo dục và Đào tạo (2026). *Quyết định 2422/QĐ-BGDĐT* ban hành Khung nội dung giáo dục trí tuệ nhân tạo cho học sinh phổ thông.
- Quốc hội (2025). *Luật Bảo vệ dữ liệu cá nhân số 91/2025/QH15.*
""",
    "quiz": {
        "title": "Kiểm tra Bài 2.5",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "2.5-detector-thien-lech",
                "type": "mcq",
                "prompt": "Nghiên cứu của Liang và cộng sự (2023) phát hiện điều gì về công cụ dò văn bản AI?",
                "explanation": "Hơn một nửa bài luận do người viết tiếng Anh không phải bản ngữ viết bị gán nhầm là do AI tạo ra, trong khi công cụ gần như không mắc lỗi với bài của người bản ngữ.",
                "points": 2,
                "options": [
                    {"label": "Chúng gán nhầm hơn một nửa bài luận của người viết tiếng Anh không phải bản ngữ là do AI viết", "isCorrect": True},
                    {"label": "Chúng chính xác trên 95% với mọi nhóm người viết", "isCorrect": False, "misconception": "cngdtt.ai-detector-reliable"},
                    {"label": "Chúng chỉ sai khi văn bản quá ngắn", "isCorrect": False},
                    {"label": "Chúng lệch bất lợi cho người viết bản ngữ", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-co-che-lech",
                "type": "mcq",
                "prompt": "Cơ chế nào giải thích thiên lệch của công cụ dò văn bản AI với người viết bằng ngoại ngữ?",
                "explanation": "Các công cụ này dựa vào độ bất ngờ của chuỗi từ. Người viết bằng ngoại ngữ dùng cấu trúc và từ vựng đều đặn hơn, nên văn bản của họ trông giống văn bản máy theo đúng thước đo ấy.",
                "points": 2,
                "options": [
                    {"label": "Chúng đo độ bất ngờ của chuỗi từ, mà văn bản của người viết ngoại ngữ vốn đều đặn hơn", "isCorrect": True},
                    {"label": "Chúng nhận diện lỗi ngữ pháp và coi đó là dấu hiệu AI", "isCorrect": False},
                    {"label": "Chúng chỉ được huấn luyện trên văn bản học thuật", "isCorrect": False},
                    {"label": "Chúng so khớp với cơ sở dữ liệu văn bản do AI sinh", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-khong-ky-luat",
                "type": "mcq",
                "prompt": "Nhà trường nên quy định thế nào về vai trò của công cụ dò AI trong xử lý nghi vấn liêm chính?",
                "explanation": "Chỉ là tín hiệu để mở đối thoại, không phải căn cứ kết luận. Kết luận phải dựa trên bằng chứng quá trình — bản nháp, lịch sử sửa, phần trình bày miệng.",
                "points": 2,
                "options": [
                    {"label": "Chỉ là tín hiệu mở đối thoại; kết luận phải dựa trên bằng chứng quá trình", "isCorrect": True},
                    {"label": "Là bằng chứng đủ nếu điểm số vượt ngưỡng nhà cung cấp khuyến nghị", "isCorrect": False, "misconception": "cngdtt.ai-detector-reliable"},
                    {"label": "Là bằng chứng đủ nếu hai công cụ khác nhau cùng cho kết quả cao", "isCorrect": False, "misconception": "cngdtt.ai-detector-reliable"},
                    {"label": "Không cần quy định vì công cụ dò sẽ sớm chính xác hơn", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-bang-chung-qua-trinh",
                "type": "matching",
                "prompt": "Ghép mỗi nhóm biện pháp thiết kế đánh giá với ví dụ tương ứng.",
                "explanation": "Bốn nhóm biện pháp chuyển trọng tâm từ đuổi bắt sang thiết kế: sản phẩm cuối không đủ để kết luận, còn quá trình thì nói lên năng lực.",
                "points": 3,
                "pairs": [
                    {"left": "Bằng chứng quá trình", "right": "Nộp kèm bản nháp theo mốc và nhật ký quyết định"},
                    {"left": "Gắn bối cảnh cá nhân, địa phương", "right": "Phân tích dữ liệu do chính người học thu ở lớp mình"},
                    {"left": "Trình bày và bảo vệ", "right": "Vấn đáp năm phút chất vấn vào lựa chọn thiết kế của chính sản phẩm"},
                    {"left": "Đánh giá tại chỗ", "right": "Bài viết ngắn làm trực tiếp trong giờ"},
                ],
            },
            {
                "key": "2.5-thang-muc-do",
                "type": "mcq",
                "prompt": "Điều kiện để thang mức độ cho phép dùng AI vận hành được trong một học phần là gì?",
                "explanation": "Mỗi nhiệm vụ trong đề cương phải ghi rõ mức, và nhiệm vụ mức đồng soạn phải yêu cầu nhật ký AI như một phần của sản phẩm nộp — tức là chấm cả nhật ký.",
                "points": 2,
                "options": [
                    {"label": "Ghi rõ mức cho từng nhiệm vụ trong đề cương và chấm cả nhật ký AI ở nhiệm vụ đồng soạn", "isCorrect": True},
                    {"label": "Cấm hoàn toàn ở mọi nhiệm vụ để tránh tranh cãi", "isCorrect": False},
                    {"label": "Để sinh viên tự quyết định mức phù hợp", "isCorrect": False},
                    {"label": "Dùng công cụ dò AI để kiểm tra việc tuân thủ", "isCorrect": False, "misconception": "cngdtt.ai-detector-reliable"},
                ],
            },
            {
                "key": "2.5-chat-luong-tieng-viet",
                "type": "mcq",
                "prompt": "Vì sao không được suy ra chất lượng đầu ra tiếng Việt từ ấn tượng khi dùng mô hình bằng tiếng Anh?",
                "explanation": "Mô hình được huấn luyện chủ yếu trên tiếng Anh; tiếng Việt yếu hơn ở chỗ khó thấy — thuật ngữ theo chương trình Việt Nam, cách diễn đạt sách giáo khoa, tên riêng. Phải kiểm trên chính ngữ liệu của môn học.",
                "points": 2,
                "options": [
                    {"label": "Vì chất lượng tiếng Việt kém hơn ở đúng những chỗ khó thấy như thuật ngữ chương trình và tên riêng", "isCorrect": True},
                    {"label": "Vì mô hình không hiểu tiếng Việt", "isCorrect": False},
                    {"label": "Vì tiếng Việt cần nhiều token hơn nên câu trả lời bị cắt", "isCorrect": False},
                    {"label": "Không có khác biệt đáng kể giữa hai ngôn ngữ", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-sai-nguy-hiem",
                "type": "mcq",
                "prompt": "Vì sao câu trả lời của mô hình về chương trình, quy chế và kỳ thi của Việt Nam thuộc loại rủi ro cao nhất?",
                "explanation": "Đây là vùng mô hình có rất ít dữ liệu, nhưng câu trả lời vẫn trôi chảy và tự tin — kết hợp giữa xác suất sai cao và tín hiệu cảnh báo thấp.",
                "points": 2,
                "options": [
                    {"label": "Vì xác suất sai cao trong khi câu trả lời vẫn trôi chảy, nên người đọc ít nghi ngờ", "isCorrect": True},
                    {"label": "Vì mô hình từ chối trả lời các câu hỏi về pháp luật", "isCorrect": False},
                    {"label": "Vì các quy chế thay đổi hằng năm", "isCorrect": False},
                    {"label": "Vì đây là thông tin thuộc phạm vi bảo mật", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-bat-binh-dang-moi",
                "type": "mcq",
                "prompt": "Giáo viên giao bài tập bắt buộc dùng một công cụ AI trả phí. Vấn đề công bằng ở đây là gì?",
                "explanation": "Bản miễn phí và trả phí khác nhau đáng kể về chất lượng và giới hạn sử dụng, nên yêu cầu này tạo ra một lớp bất bình đẳng mới ngay trong lớp — chính là tầng tiếp cận của khoảng cách số.",
                "points": 2,
                "options": [
                    {"label": "Tạo ra bất bình đẳng tiếp cận mới trong lớp, giữa người trả được phí và người không", "isCorrect": True},
                    {"label": "Không có vấn đề gì vì công cụ nào cũng có bản miễn phí", "isCorrect": False, "misconception": "cngdtt.digital-divide-access-only"},
                    {"label": "Vấn đề duy nhất là chi phí cho nhà trường", "isCorrect": False},
                    {"label": "Vấn đề chỉ nằm ở việc học sinh chưa biết dùng công cụ", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-dan-bai-lam",
                "type": "mcq",
                "prompt": "Giáo viên dán toàn bộ bài làm của lớp (có tên học sinh) vào một dịch vụ AI công cộng để nhờ tóm tắt lỗi sai chung. Đánh giá đúng là gì?",
                "explanation": "Đó là chuyển dữ liệu cá nhân cho bên thứ ba, thường xuyên biên giới, không có căn cứ và không có sự đồng ý. Cách đúng là khử mọi chi tiết định danh trước khi gửi.",
                "points": 2,
                "options": [
                    {"label": "Vi phạm nghĩa vụ bảo vệ dữ liệu; phải khử mọi chi tiết định danh trước khi gửi", "isCorrect": True},
                    {"label": "Chấp nhận được vì mục đích là cải thiện việc dạy", "isCorrect": False, "misconception": "cngdtt.paste-student-data"},
                    {"label": "Chấp nhận được nếu giáo viên xoá lịch sử trò chuyện sau khi dùng", "isCorrect": False, "misconception": "cngdtt.paste-student-data"},
                    {"label": "Chỉ là vấn đề bản quyền bài làm của học sinh", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-nhat-ky-ai",
                "type": "mcq",
                "prompt": "Nhật ký AI cho nhiệm vụ mức đồng soạn nên gồm những gì để có giá trị đánh giá?",
                "explanation": "Lời nhắc chính, phần giữ lại, phần sửa, phần bỏ và lý do. Chính phần sửa và bỏ mới cho thấy người học có phán đoán chuyên môn, chứ không phải danh sách công cụ đã dùng.",
                "points": 2,
                "options": [
                    {"label": "Lời nhắc chính, phần giữ, phần sửa, phần bỏ và lý do của từng quyết định", "isCorrect": True},
                    {"label": "Danh sách các công cụ AI đã sử dụng", "isCorrect": False},
                    {"label": "Ảnh chụp màn hình toàn bộ hội thoại", "isCorrect": False},
                    {"label": "Cam kết không sao chép của người học", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-do-an-thoi-ai",
                "type": "mcq",
                "prompt": "Vì sao đồ án sách AR của học phần này đã là một thiết kế đánh giá phù hợp thời AI?",
                "explanation": "Nó nộp theo sáu mốc (bằng chứng quá trình), làm trên nội dung và người học cụ thể của từng sinh viên (bối cảnh cá nhân), và bảo vệ bằng demo trực tiếp (trình bày).",
                "points": 2,
                "options": [
                    {"label": "Vì nó gồm bằng chứng quá trình theo mốc, bối cảnh cá nhân, và bảo vệ trực tiếp", "isCorrect": True},
                    {"label": "Vì AI không làm được sản phẩm AR", "isCorrect": False},
                    {"label": "Vì sinh viên bị cấm dùng AI trong đồ án", "isCorrect": False},
                    {"label": "Vì sản phẩm cuối được kiểm bằng công cụ dò AI", "isCorrect": False, "misconception": "cngdtt.ai-detector-reliable"},
                ],
            },
            {
                "key": "2.5-unesco-tuoi",
                "type": "true_false",
                "prompt": "Hướng dẫn của UNESCO về AI tạo sinh trong giáo dục khuyến nghị đặt ngưỡng tuổi tối thiểu và yêu cầu giám sát của người lớn khi đưa công cụ vào lớp học.",
                "explanation": "Đúng. Kế hoạch triển khai phải nêu rõ học sinh lớp nào được dùng, ai giám sát, và công cụ đã được thẩm định trước khi vào lớp hay chưa.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "2.5-thu-tu-xu-ly",
                "type": "ordering",
                "prompt": "Sắp xếp quy trình xử lý một nghi vấn liêm chính học thuật theo thứ tự đúng.",
                "explanation": "Bắt đầu bằng tín hiệu, chuyển sang thu bằng chứng quá trình và đối thoại, rồi mới kết luận. Không bao giờ mở kỷ luật chỉ từ điểm số của công cụ dò.",
                "points": 3,
                "sequence": [
                    "Ghi nhận tín hiệu nghi vấn, coi đó là lý do tìm hiểu chứ không phải kết luận",
                    "Thu thập bằng chứng quá trình: bản nháp, lịch sử sửa, nhật ký AI đã nộp",
                    "Mời người học trao đổi và trình bày về chính sản phẩm của mình",
                    "Kết luận dựa trên bằng chứng quá trình và phần trình bày, có văn bản nêu căn cứ",
                ],
            },
            {
                "key": "2.5-viet-luan-chinh-sach",
                "type": "essay",
                "prompt": "Trường bạn yêu cầu soạn quy định dùng AI cho khối 11. Viết 250–350 từ nêu: ba nhiệm vụ đánh giá và mức cho phép của từng nhiệm vụ, quy trình xử lý nghi vấn, và một đoạn giải thích cho phụ huynh vì sao trường không dùng công cụ dò AI làm căn cứ kỷ luật.",
                "points": 5,
            },
        ],
    },
}
