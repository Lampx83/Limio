# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.2 · Thiết kế dữ liệu hành vi: sự kiện và chuẩn ghi nhận",
    "durationMin": 50,
    "description": "Cách mô hình hoá hoạt động học thành sự kiện, chuẩn xAPI và Caliper, năm nguyên tắc thiết kế nhật ký sự kiện, và ranh giới giữa thu đủ và thu quá.",
    "objectives": [
        "Mô hình hoá được một hoạt động học thành tập sự kiện có cấu trúc",
        "Áp được năm nguyên tắc thiết kế nhật ký để dữ liệu còn dùng được sau một năm",
        "Quyết định được trường dữ liệu nào nên thu và trường nào không, có lý do",
    ],
    "summary": [
        "Sự kiện là đơn vị dữ liệu của phân tích học tập: ai làm gì, với đối tượng nào, lúc nào, trong bối cảnh nào.",
        "Chuẩn xAPI và Caliper cho một khuôn chung để dữ liệu chuyển được giữa các hệ thống — điều kiện của khả năng rời bỏ đã bàn ở Bài 1.3.",
        "Năm nguyên tắc: chỉ ghi thêm, đặt tên nhất quán, có lược đồ cho từng loại, ghi đủ bối cảnh, và mỗi trường gắn với một quyết định.",
        "Thu quá nhiều vừa vi phạm nguyên tắc tối thiểu hoá vừa tạo ra kho dữ liệu không ai phân tích.",
    ],
    "body": r"""
## Sự kiện: đơn vị dữ liệu của phân tích học tập

Bảng điểm cho biết kết quả; **sự kiện** cho biết quá trình. Một sự kiện trả lời năm câu: ai, làm gì, với cái gì, lúc nào, trong bối cảnh nào.

| Thành phần | Nội dung | Ví dụ |
|---|---|---|
| Chủ thể | Ai thực hiện | Người học có mã 4821 |
| Hành động | Động từ ở thì quá khứ | đã xem, đã nộp, đã trả lời, đã xin gợi ý |
| Đối tượng | Cái được tác động | Bài 3.2, câu hỏi số 7, thẻ ôn số 12 |
| Thời điểm | Dấu thời gian chính xác | 2026-09-07T14:32:11+07:00 |
| Bối cảnh | Thông tin cần để diễn giải | Lượt làm thứ mấy, thiết bị, thời gian dừng trước khi trả lời |

Đây chính là cấu trúc mà **xAPI** chuẩn hoá: mỗi bản ghi là một phát biểu dạng *chủ thể – động từ – đối tượng* kèm ngữ cảnh và kết quả. Chuẩn song song trong hệ sinh thái giáo dục đại học là **Caliper Analytics**. Giá trị của việc theo chuẩn không nằm ở kỹ thuật mà nằm ở chỗ đã bàn tại Bài 1.3: dữ liệu theo chuẩn thì **mang đi được** khi đổi nhà cung cấp, và ghép được với dữ liệu từ hệ thống khác.

> [!vi-du] Cùng một hoạt động, hai cách ghi. Cách nghèo: *học sinh 4821, bài 3.2, điểm 7*. Cách đủ: một chuỗi sự kiện — đã mở bài lúc 14:02, đã xem tới hết mục 3 lúc 14:11, bắt đầu quiz lúc 14:15, trả lời câu 1 sau 42 giây (đúng), xin gợi ý ở câu 4, trả lời câu 4 sau 6 giây (sai), nộp lúc 14:29. Cách thứ hai trả lời được cả câu hỏi *em ấy tắc ở đâu* lẫn *em ấy có đang lách hệ thống không*.

## Năm nguyên tắc thiết kế nhật ký sự kiện

**1 · Chỉ ghi thêm, không sửa, không xoá.** Nhật ký là bản ghi lịch sử. Muốn sửa một sai sót thì ghi thêm một sự kiện đính chính, chứ không viết đè lên sự kiện cũ. Chỉ như vậy mới dựng lại được trạng thái ở bất kỳ thời điểm nào — và mới trả lời được khiếu nại về điểm số ba tháng sau.

**2 · Đặt tên nhất quán và có không gian tên.** Quy ước dạng `miền.đối_tượng.động_từ` — ví dụ `quiz.question.answered`, `lesson.viewed`, `hint.requested`. Nghe như chi tiết vụn, nhưng một hệ thống hai năm tuổi với tên sự kiện đặt tuỳ hứng thì không ai truy vấn nổi.

**3 · Mỗi loại sự kiện có một lược đồ.** Sự kiện trả lời câu hỏi phải luôn có đủ: mã câu hỏi, đáp án đã chọn, đúng hay sai, thời gian suy nghĩ. Không có lược đồ thì sau vài lần sửa mã nguồn, cùng một loại sự kiện sẽ có ba dạng khác nhau và phân tích trở thành khảo cổ học.

**4 · Ghi đủ bối cảnh để diễn giải sau này.** Trường quan trọng nhất mà người mới hay quên: **thời gian dừng trước khi hành động**, **số lần thử**, **có xin gợi ý không**. Đây đúng là ba trường cần để phát hiện quay bánh xe và lách hệ thống ở Bài 3.3.

**5 · Mỗi trường dữ liệu phải gắn với một quyết định.** Trước khi thêm một trường, viết ra câu: *nhờ trường này, ai sẽ quyết định điều gì khác đi*. Không viết được thì không thu.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Cùng một lượt làm bài, ba mức độ ghi nhận</div>
  <div style="min-width:34rem;display:flex;gap:.5rem;align-items:stretch">
    <div style="flex:1;border:1px solid rgba(220,38,38,.45);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(220,38,38,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Nghèo</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Chỉ điểm tổng<br><span style="opacity:.75">Trả lời được: em ấy được mấy điểm</span></div>
    </div>
    <div style="flex:1;border:1px solid rgba(217,150,40,.5);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(217,150,40,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Vừa</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Kết quả từng câu + đáp án đã chọn<br><span style="opacity:.75">Thêm: em ấy hổng kỹ năng nào, mắc lỗi tư duy nào</span></div>
    </div>
    <div style="flex:1;border:2px solid rgba(13,148,136,.55);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(13,148,136,.9);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Đủ</div>
      <div style="padding:.65rem;font-size:1.02rem;line-height:1.55">Thêm dấu thời gian, thời gian suy nghĩ, số lần đổi đáp án, lần xin gợi ý<br><span style="opacity:.75">Thêm: em ấy tắc ở đâu, có đang lách hệ thống không, có quay bánh xe không</span></div>
    </div>
  </div>
  <div style="min-width:34rem;font-size:1rem;opacity:.75;margin:.55rem 0 0;line-height:1.6">Bên phải cột <strong>Đủ</strong> là vùng thu quá: vị trí địa lý, danh bạ, ảnh khuôn mặt, nội dung ngoài phạm vi học tập — thêm rủi ro mà không thêm quyết định nào.</div>
</div>
```

## Thu đủ và thu quá: ranh giới nằm ở đâu

Nguyên tắc 5 là ranh giới, và nó cụ thể hơn nhiều so với cảm giác *thu vừa phải*. Áp vào một hệ thống học tập điển hình:

| Trường dữ liệu | Quyết định nó phục vụ | Kết luận |
|---|---|---|
| Thời gian suy nghĩ trước khi trả lời | Phát hiện đoán bừa và lách hệ thống, hiệu chỉnh độ khó | Thu |
| Số lần xin gợi ý | Điều chỉnh mức hỗ trợ, phát hiện bế tắc | Thu |
| Thiết bị và cỡ màn hình | Sửa lỗi hiển thị, đánh giá điều kiện tiếp cận | Thu ở mức thô, không cần định danh máy |
| Vị trí địa lý chính xác | Không quyết định sư phạm nào cần tới | **Không thu** |
| Ảnh chụp màn hình định kỳ khi làm bài | Chống gian lận — nhưng đổi lại là giám sát thường trực | Không thu ở phổ thông; nếu bắt buộc thì phải có căn cứ, thông báo và thời hạn |
| Nội dung trò chuyện ngoài phạm vi bài học | Không phục vụ mục tiêu đã công bố | **Không thu** |

> [!canh-bao] Lập luận *cứ thu hết, sau này biết đâu cần* sai ở ba điểm cùng lúc: nó vi phạm giới hạn mục đích trong Luật Bảo vệ dữ liệu cá nhân (Bài 1.5), nó tạo rủi ro lộ lọt tỉ lệ với khối dữ liệu giữ trong tay, và trong thực tế **phần lớn dữ liệu thu kiểu ấy không bao giờ được phân tích** — nó chỉ tồn tại như một khoản nợ.

## Từ sự kiện tới bảng phân tích

Dữ liệu sự kiện thô không dùng trực tiếp để phân tích. Giữa chúng cần một lớp tổng hợp, và thiết kế lớp này quyết định tốc độ làm việc về sau:

| Lớp | Nội dung | Ví dụ |
|---|---|---|
| Sự kiện thô | Mỗi hành động một dòng, chỉ ghi thêm | 240 000 dòng cho một học kỳ một lớp |
| Bảng tổng hợp theo phiên | Mỗi phiên học một dòng | Thời lượng, số câu, tỉ lệ đúng, số lần xin gợi ý |
| Bảng trạng thái người học | Mỗi người học một dòng, cập nhật liên tục | Xác suất nắm từng kỹ năng, lần hoạt động gần nhất |
| Bảng cho báo cáo | Đúng những cột mà báo cáo cần | Danh sách em cần chú ý tuần này kèm lý do |

Sai lầm phổ biến của khoá luận: truy vấn thẳng từ sự kiện thô mỗi lần vẽ biểu đồ. Nó chạy được với dữ liệu mô phỏng vài nghìn dòng và sập khi gặp dữ liệu thật.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Chọn một hoạt động học cụ thể trong sách AR của bạn (ví dụ: người học quét trang, xem mô hình, trả lời câu hỏi mức 1). Viết ra chuỗi sự kiện đầy đủ theo năm thành phần. Đánh dấu trường nào bạn cần cho mốc 4, trường nào chỉ *có thì tốt*.

### Nhóm 3–4 người (30 phút)

Nhóm nhận danh sách 12 trường dữ liệu, trong đó có vài trường thuộc vùng thu quá. Với mỗi trường, viết câu *nhờ trường này, ai quyết định điều gì khác đi*. Trường nào không viết được thì loại. So kết quả giữa các nhóm và tranh luận những trường gây bất đồng.

### Bài tập về nhà — sản phẩm số (100 phút)

Thiết kế **lược đồ sự kiện** cho phần luyện tập của đồ án, ở mức người khác cài đặt được.

1. Liệt kê 8–12 loại sự kiện, đặt tên theo quy ước `miền.đối_tượng.động_từ`.
2. Với mỗi loại, viết lược đồ: các trường bắt buộc, kiểu dữ liệu, ví dụ một bản ghi thật.
3. Với mỗi trường, ghi **quyết định mà nó phục vụ**; trường nào không có thì bỏ khỏi lược đồ và ghi lý do vào phần phụ lục.
4. Vẽ ba lớp tổng hợp: từ sự kiện thô lên bảng phiên, bảng trạng thái người học, và bảng báo cáo — nêu rõ mỗi lớp cập nhật khi nào.
5. Viết một truy vấn hoặc công thức trả lời được câu hỏi: *ai đang quay bánh xe ở kỹ năng nào* — và chỉ rõ nó chạy trên lớp nào.

**Cách làm (gợi ý từng bước):** viết ví dụ bản ghi thật cho từng loại sự kiện, đừng chỉ mô tả trường — ví dụ cụ thể là chỗ lộ ra thiếu sót; dấu thời gian ghi kèm múi giờ, tránh giờ địa phương không rõ; phần phụ lục ghi trường đã loại có giá trị chấm điểm ngang phần giữ lại, vì nó chứng minh bạn đã quyết định có ý thức.

**Chấm theo:** lược đồ đủ chi tiết để người khác cài đặt (3đ) · mỗi trường gắn với một quyết định, có trường bị loại kèm lý do (3đ) · ba lớp tổng hợp hợp lý, nêu rõ nhịp cập nhật (2đ) · truy vấn phát hiện quay bánh xe đúng và chạy trên lớp phù hợp (2đ).

### Nguồn tham khảo

- ADL Initiative. *Experience API (xAPI) Specification* — cấu trúc phát biểu chủ thể – động từ – đối tượng.
- 1EdTech. *Caliper Analytics Specification.*
- Kleinberg, J., Ludwig, J., Mullainathan, S., & Obermeyer, Z. (2015). Prediction policy problems. *American Economic Review*, 105(5), 491–495.
- Siemens, G. (2013). Learning analytics: The emergence of a discipline. *American Behavioral Scientist*, 57(10), 1380–1400.
""",
    "quiz": {
        "title": "Kiểm tra Bài 4.2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.2-nam-thanh-phan",
                "type": "mcq",
                "prompt": "Một sự kiện học tập đầy đủ trả lời năm câu hỏi nào?",
                "explanation": "Ai, làm gì, với cái gì, lúc nào, trong bối cảnh nào — đây cũng là cấu trúc mà xAPI chuẩn hoá.",
                "points": 2,
                "options": [
                    {"label": "Chủ thể, hành động, đối tượng, thời điểm, bối cảnh", "isCorrect": True},
                    {"label": "Tên, lớp, điểm, xếp hạng, ghi chú", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                    {"label": "Thiết bị, trình duyệt, địa chỉ mạng, vị trí, thời gian", "isCorrect": False},
                    {"label": "Câu hỏi, đáp án, điểm, thời gian, giáo viên", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-vi-sao-chuan",
                "type": "mcq",
                "prompt": "Giá trị chính của việc ghi dữ liệu theo chuẩn xAPI hay Caliper nằm ở đâu?",
                "explanation": "Dữ liệu theo chuẩn thì mang đi được khi đổi nhà cung cấp và ghép được với dữ liệu hệ thống khác — chính là tiêu chí khả năng rời bỏ ở Bài 1.3.",
                "points": 2,
                "options": [
                    {"label": "Dữ liệu mang đi được và ghép được với hệ thống khác, tránh khoá nhà cung cấp", "isCorrect": True},
                    {"label": "Chuẩn làm dữ liệu chiếm ít dung lượng hơn", "isCorrect": False},
                    {"label": "Chuẩn giúp mô hình dự đoán chính xác hơn", "isCorrect": False},
                    {"label": "Chuẩn là yêu cầu bắt buộc theo quy định Việt Nam", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-chi-ghi-them",
                "type": "mcq",
                "prompt": "Vì sao nhật ký sự kiện chỉ được ghi thêm, không sửa đè?",
                "explanation": "Chỉ như vậy mới dựng lại được trạng thái ở bất kỳ thời điểm nào, và mới trả lời được khiếu nại về điểm số vài tháng sau. Sai sót thì ghi thêm sự kiện đính chính.",
                "points": 2,
                "options": [
                    {"label": "Để dựng lại được trạng thái tại mọi thời điểm và trả lời được khiếu nại về sau", "isCorrect": True},
                    {"label": "Để tiết kiệm thời gian ghi dữ liệu", "isCorrect": False},
                    {"label": "Vì cơ sở dữ liệu không hỗ trợ sửa bản ghi", "isCorrect": False},
                    {"label": "Vì quy định cấm sửa dữ liệu học tập", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-ba-truong-hay-quen",
                "type": "mcq",
                "prompt": "Ba trường bối cảnh nào người mới thiết kế hay quên, mà lại cần để phát hiện quay bánh xe và lách hệ thống?",
                "explanation": "Thời gian dừng trước khi hành động, số lần thử, và có xin gợi ý không — đúng ba trường đã nêu ở Bài 3.3.",
                "points": 2,
                "options": [
                    {"label": "Thời gian suy nghĩ trước khi trả lời, số lần thử, số lần xin gợi ý", "isCorrect": True},
                    {"label": "Tên đăng nhập, địa chỉ mạng, trình duyệt", "isCorrect": False},
                    {"label": "Điểm trung bình, xếp hạng, học lực", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                    {"label": "Vị trí địa lý, danh bạ, ảnh khuôn mặt", "isCorrect": False, "misconception": "cngdtt.collect-all-data"},
                ],
            },
            {
                "key": "4.2-nguyen-tac-5",
                "type": "mcq",
                "prompt": "Nguyên tắc thứ năm — mỗi trường gắn với một quyết định — được kiểm bằng câu hỏi nào?",
                "explanation": "Nhờ trường này, ai sẽ quyết định điều gì khác đi. Không viết được câu ấy thì không thu.",
                "points": 2,
                "options": [
                    {"label": "Nhờ trường này, ai sẽ quyết định điều gì khác đi", "isCorrect": True},
                    {"label": "Trường này có tốn nhiều dung lượng không", "isCorrect": False},
                    {"label": "Trường này có dễ thu thập không", "isCorrect": False},
                    {"label": "Trường này có trong chuẩn xAPI không", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-thu-het",
                "type": "mcq",
                "prompt": "Lập luận cứ thu hết dữ liệu, sau này biết đâu cần sai ở những điểm nào?",
                "explanation": "Vi phạm giới hạn mục đích, tạo rủi ro lộ lọt tỉ lệ với khối dữ liệu, và phần lớn dữ liệu ấy không bao giờ được phân tích — nó chỉ tồn tại như một khoản nợ.",
                "points": 2,
                "options": [
                    {"label": "Vi phạm giới hạn mục đích, tăng rủi ro lộ lọt, và phần lớn không bao giờ được phân tích", "isCorrect": True},
                    {"label": "Chỉ sai ở chỗ tốn chi phí lưu trữ", "isCorrect": False, "misconception": "cngdtt.collect-all-data"},
                    {"label": "Không sai, vì dữ liệu càng nhiều mô hình càng tốt", "isCorrect": False, "misconception": "cngdtt.collect-all-data"},
                    {"label": "Chỉ sai khi dữ liệu bị chuyển ra nước ngoài", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-vung-thu-qua",
                "type": "matching",
                "prompt": "Xếp mỗi trường dữ liệu vào nhóm nên thu hay không nên thu trong hệ thống học tập phổ thông.",
                "explanation": "Ranh giới nằm ở nguyên tắc thứ năm: trường nào không phục vụ quyết định sư phạm nào thì không thu.",
                "points": 3,
                "pairs": [
                    {"left": "Thời gian suy nghĩ trước khi trả lời", "right": "Nên thu — phục vụ hiệu chỉnh độ khó và phát hiện đoán bừa"},
                    {"left": "Số lần xin gợi ý", "right": "Nên thu — phục vụ điều chỉnh mức hỗ trợ"},
                    {"left": "Vị trí địa lý chính xác", "right": "Không thu — không quyết định sư phạm nào cần tới"},
                    {"left": "Nội dung trò chuyện ngoài phạm vi bài học", "right": "Không thu — ngoài mục tiêu đã công bố"},
                ],
            },
            {
                "key": "4.2-dat-ten",
                "type": "mcq",
                "prompt": "Quy ước đặt tên sự kiện dạng `quiz.question.answered` có lợi ích gì?",
                "explanation": "Tên nhất quán và có không gian tên giúp truy vấn được sau nhiều năm; hệ thống với tên đặt tuỳ hứng thì không ai lọc nổi dữ liệu.",
                "points": 2,
                "options": [
                    {"label": "Giữ cho dữ liệu còn truy vấn được khi hệ thống lớn lên và nhiều người cùng phát triển", "isCorrect": True},
                    {"label": "Giúp hệ thống chạy nhanh hơn", "isCorrect": False},
                    {"label": "Là yêu cầu bắt buộc của chuẩn xAPI", "isCorrect": False},
                    {"label": "Giúp giảm dung lượng lưu trữ", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-lop-tong-hop",
                "type": "ordering",
                "prompt": "Sắp xếp bốn lớp dữ liệu từ thô tới gần báo cáo nhất.",
                "explanation": "Truy vấn thẳng từ sự kiện thô mỗi lần vẽ biểu đồ chạy được với dữ liệu mô phỏng và sập với dữ liệu thật — nên cần các lớp tổng hợp ở giữa.",
                "points": 3,
                "sequence": [
                    "Sự kiện thô, mỗi hành động một dòng",
                    "Bảng tổng hợp theo phiên học",
                    "Bảng trạng thái người học, cập nhật liên tục",
                    "Bảng phục vụ đúng một báo cáo cụ thể",
                ],
            },
            {
                "key": "4.2-luoc-do",
                "type": "mcq",
                "prompt": "Vì sao mỗi loại sự kiện cần một lược đồ cố định?",
                "explanation": "Không có lược đồ thì sau vài lần sửa mã nguồn, cùng một loại sự kiện sẽ có nhiều dạng khác nhau và việc phân tích biến thành khảo cổ học.",
                "points": 2,
                "options": [
                    {"label": "Để cùng một loại sự kiện không sinh ra nhiều dạng khác nhau sau mỗi lần sửa mã", "isCorrect": True},
                    {"label": "Để giảm số dòng dữ liệu", "isCorrect": False},
                    {"label": "Để hệ thống tự sinh biểu đồ", "isCorrect": False},
                    {"label": "Để đáp ứng yêu cầu của cơ quan quản lý", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-anh-man-hinh",
                "type": "mcq",
                "prompt": "Đề xuất chụp màn hình định kỳ khi học sinh làm bài để chống gian lận. Đánh giá đúng trong bối cảnh phổ thông là gì?",
                "explanation": "Đó là giám sát thường trực với người chưa thành niên; nếu bắt buộc phải làm thì cần căn cứ, thông báo và thời hạn lưu rõ ràng — và trước đó nên xét lại thiết kế đánh giá.",
                "points": 2,
                "options": [
                    {"label": "Là giám sát thường trực; nếu buộc phải dùng thì phải có căn cứ, thông báo và thời hạn lưu", "isCorrect": True},
                    {"label": "Nên làm mặc định vì chống gian lận là mục tiêu chính đáng", "isCorrect": False, "misconception": "cngdtt.collect-all-data"},
                    {"label": "Không có vấn đề gì vì ảnh chỉ lưu trong hệ thống của trường", "isCorrect": False, "misconception": "cngdtt.policy-blind"},
                    {"label": "Chỉ là vấn đề dung lượng lưu trữ", "isCorrect": False},
                ],
            },
            {
                "key": "4.2-truy-van-tho",
                "type": "true_false",
                "prompt": "Truy vấn thẳng từ bảng sự kiện thô mỗi lần vẽ báo cáo là thiết kế chấp nhận được cho hệ thống chạy thật.",
                "explanation": "Sai — cách này chạy được với dữ liệu mô phỏng vài nghìn dòng nhưng không chịu nổi dữ liệu thật của một học kỳ. Cần các lớp tổng hợp ở giữa.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": False},
                    {"label": "Sai", "isCorrect": True},
                ],
            },
            {
                "key": "4.2-viet-luan-su-kien",
                "type": "essay",
                "prompt": "Viết 250–350 từ thiết kế nhật ký sự kiện cho phần luyện tập của đồ án: liệt kê 5 loại sự kiện quan trọng nhất kèm trường bắt buộc, nêu hai trường bạn quyết định KHÔNG thu và lý do, và mô tả truy vấn bạn sẽ dùng để trả lời một câu hỏi sư phạm cụ thể.",
                "points": 5,
            },
        ],
    },
}
