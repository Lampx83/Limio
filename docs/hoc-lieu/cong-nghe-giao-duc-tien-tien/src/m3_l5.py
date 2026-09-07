# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 3.5 · Đường học thích ứng và bài toán chọn bài kế tiếp",
    "durationMin": 50,
    "description": "Ba trục thích ứng, bốn chiến lược chọn nhiệm vụ tiếp theo, mức thành công mục tiêu, và những vấn đề đạo đức phát sinh khi mỗi người học đi một con đường khác nhau.",
    "objectives": [
        "Phân biệt được ba trục thích ứng và chọn trục phù hợp cho một tình huống dạy học",
        "Viết được quy tắc chọn nhiệm vụ tiếp theo dưới dạng bảng quyết định kiểm được",
        "Nêu được hai rủi ro đạo đức của đường học cá nhân hoá và cách phòng trong thiết kế",
    ],
    "summary": [
        "Thích ứng có ba trục: nội dung nào, độ khó bao nhiêu, và bao nhiêu hỗ trợ — trục thứ ba hay bị bỏ quên nhất dù rẻ nhất để làm.",
        "Chọn bài kế tiếp là bài toán cân bằng: bám kỹ năng đang hổng, giữ mức thành công vừa phải, và thỉnh thoảng thăm dò để mô hình khỏi mắc kẹt.",
        "Mức thành công mục tiêu quanh 85% là điểm khởi đầu hợp lý: quá cao thì người học không học được gì mới, quá thấp thì bỏ cuộc.",
        "Hai rủi ro đạo đức: khoá người học ở mức thấp vì hệ thống luôn hạ độ khó, và biến ước lượng tạm thời thành nhãn theo suốt.",
    ],
    "body": r"""
## Ba trục thích ứng — và trục hay bị bỏ quên

Nói *hệ thống thích ứng* mà không nói thích ứng theo trục nào thì chưa nói gì. Có ba trục, và chúng đòi những thứ rất khác nhau:

| Trục | Hệ thống thay đổi gì | Cần gì để làm được | Chi phí xây dựng |
|---|---|---|---|
| Nội dung | Cho học kỹ năng nào tiếp theo | Bản đồ tri thức và quan hệ tiên quyết | Trung bình |
| Độ khó | Cùng kỹ năng, cho bài dễ hơn hay khó hơn | Ngân hàng bài đủ dày, có ước lượng độ khó | Cao — chỗ tốn công nhất |
| Mức hỗ trợ | Cùng bài, cho nhiều hay ít gợi ý, có hay không ví dụ mẫu | Chỉ cần soạn nhiều lớp gợi ý cho mỗi bài | **Thấp nhất** |

Trục thứ ba là trục rẻ nhất, tác dụng rõ nhất, và bị bỏ quên nhiều nhất. Nó nối thẳng với hai thứ đã học: **hiệu ứng ví dụ mẫu và đảo chiều chuyên môn** ở Bài 1.2 nói rằng mức hỗ trợ phải giảm dần theo trình độ, và **thang gợi ý bốn mức** ở Bài 2.3 chính là hiện thực của trục này trong trợ giảng.

> [!canh-bao] Hiểu lầm phổ biến nhất về thích ứng: coi nó là cơ chế **hạ độ khó cho vừa sức**. Một hệ chỉ có đường đi xuống sẽ đưa người học tới chỗ làm đúng mọi thứ mà không học được gì mới. Kiểm một sản phẩm bằng câu hỏi ngắn: *nó có đường nâng độ khó trở lại không, kích hoạt bằng điều kiện gì?*

## Bốn chiến lược chọn nhiệm vụ kế tiếp

**Theo quan hệ tiên quyết.** Không cho học kỹ năng B khi kỹ năng A mà B dựa vào chưa đạt ngưỡng. Đơn giản, dễ giải thích, và là chiến lược nền của hầu hết hệ thống. Nhược điểm: bản đồ tiên quyết do chuyên gia đặt thường quá chặt, khoá người học ở những nhánh họ đã biết.

**Theo lượng thông tin thu được.** Chiến lược của trắc nghiệm thích ứng: chọn câu mà kết quả của nó làm giảm nhiều nhất độ bất định của ước lượng — tức là câu có độ khó gần với năng lực ước lượng hiện tại. Rất hiệu quả để **đo**, nhưng lưu ý: đo nhanh không phải mục tiêu của một hệ **dạy**, và tối đa hoá thông tin có thể đẩy người học vào chuỗi bài toàn ở ngưỡng khó chịu.

**Theo mức hỗ trợ.** Thay vì đổi bài, đổi lượng trợ giúp trên cùng bài. Koedinger và Aleven gọi cân nhắc này là **thế lưỡng nan trợ giúp**: cho hỗ trợ thì người học qua được nhưng học ít, không cho thì họ có thể bế tắc và bỏ. Không có lời giải chung; nguyên tắc thực hành là bắt đầu bằng ít hỗ trợ và tăng dần khi có dấu hiệu bế tắc, chứ không ngược lại.

**Thăm dò có chủ đích.** Nếu hệ thống luôn chọn theo ước lượng hiện tại, nó sẽ không bao giờ phát hiện mình ước lượng sai. Thỉnh thoảng chèn một nhiệm vụ ngoài dự đoán — kỹ năng hệ thống nghĩ đã vững, hoặc mức khó cao hơn — vừa để kiểm mô hình vừa để người học không bị khoá.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Bảng quyết định — mẫu viết được thành mã và kiểm được bằng ca thử</div>
  <table style="min-width:34rem;border-collapse:collapse;font-size:1.02rem">
    <thead><tr style="background:rgba(127,127,127,.12)">
      <th style="text-align:left;padding:.5rem .6rem">Trạng thái quan sát được</th>
      <th style="text-align:left;padding:.5rem .6rem">Hành động</th>
      <th style="text-align:left;padding:.5rem .6rem">Vì sao</th>
    </tr></thead>
    <tbody>
      <tr><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Xác suất nắm ≥ 0,95</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2);background:rgba(13,148,136,.12)">Chuyển kỹ năng, đưa vào hàng đợi ôn tập</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Luyện thêm không tăng gì, còn tốn thời gian</td></tr>
      <tr><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Ba lượt sai liên tiếp</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2);background:rgba(37,99,235,.12)">Tăng mức hỗ trợ, chưa đổi bài</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Đổi bài ngay thì không biết hổng ở đâu</td></tr>
      <tr><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Sai kèm dấu hiệu hổng kỹ năng tiên quyết</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2);background:rgba(124,58,237,.12)">Quay về kỹ năng tiên quyết</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Chữa gốc thay vì chữa ngọn</td></tr>
      <tr><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Trên 10 lượt, chưa đạt ngưỡng, đường đi ngang</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2);background:rgba(220,38,38,.14)">Đổi loại nhiệm vụ hoặc chuyển cho giáo viên</td><td style="padding:.5rem .6rem;border-bottom:1px solid rgba(127,127,127,.2)">Quay bánh xe: thêm bài chỉ bào mòn niềm tin</td></tr>
      <tr><td style="padding:.5rem .6rem">Đúng liên tiếp, thời gian trả lời rất ngắn</td><td style="padding:.5rem .6rem;background:rgba(217,150,40,.14)">Chèn nhiệm vụ thăm dò khó hơn</td><td style="padding:.5rem .6rem">Có thể mô hình đang đánh giá thấp người học</td></tr>
    </tbody>
  </table>
</div>
```

Bảng quyết định như trên là cách viết một chính sách thích ứng sao cho **kiểm được**: mỗi dòng là một ca kiểm thử, và bạn dựng được bộ ca đúng như cách đã làm với lời nhắc ở Bài 2.2.

## Mức thành công mục tiêu: người học nên đúng bao nhiêu phần trăm

Nếu người học đúng gần như mọi câu, nhiệm vụ quá dễ và họ không học được gì mới. Nếu sai gần hết, họ mất phương hướng và bỏ. Câu hỏi là: **mức đúng nào là tối ưu?**

Nghiên cứu của Wilson và cộng sự (2019) trên một lớp bài toán học có phản hồi đưa ra một câu trả lời định lượng đáng chú ý: tỉ lệ đúng quanh **85%** tối đa hoá tốc độ học. Con số này không phải hằng số vũ trụ cho mọi tình huống dạy học, nhưng nó là điểm khởi đầu tốt hơn nhiều so với trực giác — và trực giác của nhiều người thiết kế là nhắm tới 95% hoặc hơn, tức là quá dễ.

Vận dụng thực tế: theo dõi tỉ lệ đúng trượt trong 10 lượt gần nhất của mỗi người học. Vượt 90% kéo dài thì tăng độ khó hoặc giảm hỗ trợ; xuống dưới 60% thì tăng hỗ trợ trước, hạ độ khó sau. Lưu ý thứ tự: **tăng hỗ trợ trước khi hạ độ khó** — vì hạ độ khó là thay đổi mục tiêu học tập, còn tăng hỗ trợ thì không.

> [!ghi-nho] Ba con số nên có trên bảng theo dõi của mọi hệ thích ứng: tỉ lệ đúng trượt gần đây, số lượt kể từ lần đạt ngưỡng gần nhất, và thời gian trả lời trung vị. Ba con số này bắt được cả ba tình huống hỏng: quá dễ, quay bánh xe, và lách hệ thống.

## Đạo đức của việc mỗi người đi một đường

**Rủi ro khoá trần.** Nếu hệ thống chỉ hạ độ khó khi người học gặp khó, nhóm khởi đầu yếu sẽ nhận nội dung dễ hơn trong thời gian dài hơn, và khoảng cách nới rộng — công nghệ tái tạo lại chính sự phân tầng mà nó hứa xoá. Đây là phiên bản thuật toán của việc phân ban theo học lực. Phòng bằng ba biện pháp: có đường nâng độ khó tự động, đặt sàn nội dung mà **mọi** người học đều phải gặp, và báo cáo định kỳ phân bố độ khó theo nhóm hoàn cảnh.

**Rủi ro nhãn.** Xác suất nắm là ước lượng về một kỹ năng tại một thời điểm, dựa trên vài chục lượt. Khi con số ấy hiển thị cho giáo viên, cho phụ huynh, hoặc theo học sinh sang năm sau, nó dễ biến thành nhãn năng lực — và kỳ vọng của người lớn thay đổi theo nhãn ấy, đúng hiệu ứng đã nói ở Bài 1.5. Phòng bằng: luôn hiển thị kèm mốc thời gian và số lượt làm căn cứ, **đặt hạn sử dụng** cho ước lượng cũ, và không chuyển hồ sơ mô hình sang năm học mới nếu không có lý do sư phạm rõ ràng.

> [!meo] Một câu hỏi kiểm tra đạo đức nhanh cho mọi thiết kế thích ứng: *nếu học sinh và phụ huynh nhìn thấy toàn bộ quy tắc quyết định của hệ thống, họ có thấy nó công bằng không?* Nếu câu trả lời là không, vấn đề nằm ở quy tắc chứ không ở việc nên giấu.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Lấy một ứng dụng học tập bạn đang dùng. Xác định nó thích ứng theo trục nào trong ba trục, và tìm bằng chứng cụ thể cho kết luận ấy. Sau đó thử trả lời sai liên tiếp năm lần và ghi lại hệ thống làm gì — tăng hỗ trợ, hạ độ khó, hay không làm gì.

### Nhóm 3–4 người (30 phút)

Nhóm viết bảng quyết định 6 dòng cho phần luyện tập của một môn học. Đổi chéo với nhóm khác, mỗi nhóm dựng 6 ca kiểm thử để tìm dòng mâu thuẫn hoặc kẽ hở — ví dụ trạng thái khớp hai dòng cùng lúc, hoặc trạng thái không dòng nào phủ. Sửa lại và trình bày chỗ đã vá.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng **bộ mô phỏng chính sách thích ứng** để so hai chính sách trên cùng nhóm người học giả lập.

1. Viết hai chính sách thành hai bảng quyết định: một chính sách chỉ hạ độ khó khi sai, một chính sách tăng hỗ trợ trước rồi mới hạ độ khó, có đường nâng trở lại.
2. Mô phỏng 30 người học với ba mức năng lực ban đầu khác nhau, mỗi người 40 lượt, dùng mô hình BKT ở Bài 3.2 để sinh đúng sai.
3. Ghi lại cho từng chính sách: số kỹ năng đạt ngưỡng, tỉ lệ đúng trung bình, và **phân bố độ khó theo nhóm năng lực ban đầu**.
4. Vẽ biểu đồ so sánh và chỉ ra chính sách nào gây khoá trần với nhóm khởi đầu yếu.
5. Viết nửa trang khuyến nghị cho một trường: chọn chính sách nào, kèm hai chỉ số cần theo dõi định kỳ để phát hiện khoá trần.

**Cách làm (gợi ý từng bước):** dùng bảng tính với một hàng cho mỗi lượt của mỗi người học để so được hai chính sách trên cùng chuỗi ngẫu nhiên; cố định hạt giống ngẫu nhiên để hai chính sách gặp cùng điều kiện, nếu không thì khác biệt có thể chỉ là may rủi; chỉ số khoá trần nên là độ khó trung bình ở 10 lượt cuối, tách theo nhóm năng lực ban đầu.

**Chấm theo:** hai bảng quyết định rõ ràng, không mâu thuẫn (3đ) · mô phỏng công bằng, có cố định hạt giống (2đ) · phát hiện và trình bày được hiện tượng khoá trần bằng số liệu (3đ) · khuyến nghị kèm chỉ số theo dõi cụ thể (2đ).

### Nguồn tham khảo

- Koedinger, K. R., & Aleven, V. (2007). Exploring the assistance dilemma in experiments with cognitive tutors. *Educational Psychology Review*, 19, 239–264.
- Wilson, R. C., Shenhav, A., Straccia, M., & Cohen, J. D. (2019). The eighty five percent rule for optimal learning. *Nature Communications*, 10, 4646.
- Vygotsky, L. S. (1978). *Mind in Society* — vùng phát triển gần.
- Corbett, A. T. (2001). Cognitive computer tutors: Solving the two-sigma problem. *User Modeling 2001*, 137–147.
- Holstein, K., McLaren, B. M., & Aleven, V. (2019). Co-designing a real-time classroom orchestration tool. *Journal of Learning Analytics*, 6(2), 27–52.
""",
    "quiz": {
        "title": "Kiểm tra Bài 3.5",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "3.5-ba-truc",
                "type": "matching",
                "prompt": "Ghép mỗi trục thích ứng với thứ nó đòi hỏi để làm được.",
                "explanation": "Ba trục đòi ba loại đầu tư khác nhau; trục mức hỗ trợ rẻ nhất mà hay bị bỏ quên nhất.",
                "points": 3,
                "pairs": [
                    {"left": "Thích ứng nội dung", "right": "Bản đồ tri thức và quan hệ tiên quyết"},
                    {"left": "Thích ứng độ khó", "right": "Ngân hàng bài đủ dày, có ước lượng độ khó"},
                    {"left": "Thích ứng mức hỗ trợ", "right": "Nhiều lớp gợi ý soạn sẵn cho mỗi bài"},
                ],
            },
            {
                "key": "3.5-khong-phai-lam-de",
                "type": "mcq",
                "prompt": "Câu hỏi ngắn nào kiểm được một sản phẩm có hiểu đúng về thích ứng hay không?",
                "explanation": "Hệ thống có đường nâng độ khó trở lại không, kích hoạt bằng điều kiện gì. Hệ chỉ có đường đi xuống sẽ đưa người học tới chỗ làm đúng mọi thứ mà không học được gì mới.",
                "points": 2,
                "options": [
                    {"label": "Nó có đường nâng độ khó trở lại không, và kích hoạt bằng điều kiện gì", "isCorrect": True},
                    {"label": "Nó có bao nhiêu bài tập trong ngân hàng", "isCorrect": False},
                    {"label": "Nó hạ độ khó nhanh tới mức nào khi người học sai", "isCorrect": False, "misconception": "cngdtt.adaptive-means-easier"},
                    {"label": "Nó dùng mô hình học sâu hay mô hình cổ điển", "isCorrect": False, "misconception": "cngdtt.new-equals-better"},
                ],
            },
            {
                "key": "3.5-cat-vs-day",
                "type": "mcq",
                "prompt": "Chiến lược chọn câu theo lượng thông tin thu được rất mạnh trong trắc nghiệm thích ứng. Vì sao không nên bê nguyên sang hệ dạy học?",
                "explanation": "Đo nhanh không phải mục tiêu của hệ dạy; tối đa hoá thông tin đẩy người học vào chuỗi bài luôn ở ngưỡng khó chịu, trong khi việc học cần cả những lượt củng cố.",
                "points": 2,
                "options": [
                    {"label": "Vì mục tiêu là dạy chứ không phải đo, và chuỗi bài luôn ở ngưỡng khó dễ làm người học kiệt sức", "isCorrect": True},
                    {"label": "Vì chiến lược ấy đòi hỏi quá nhiều tính toán", "isCorrect": False},
                    {"label": "Vì nó chỉ áp dụng được cho môn toán", "isCorrect": False},
                    {"label": "Không có vấn đề gì, nên dùng nguyên", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-the-luong-nan",
                "type": "mcq",
                "prompt": "Thế lưỡng nan trợ giúp phát biểu điều gì, và nguyên tắc thực hành đi kèm là gì?",
                "explanation": "Cho hỗ trợ thì người học qua được nhưng học ít; không cho thì có thể bế tắc và bỏ. Nguyên tắc: bắt đầu bằng ít hỗ trợ rồi tăng dần khi có dấu hiệu bế tắc.",
                "points": 2,
                "options": [
                    {"label": "Hỗ trợ nhiều thì học ít, hỗ trợ ít thì dễ bỏ; nên bắt đầu ít rồi tăng dần theo dấu hiệu bế tắc", "isCorrect": True},
                    {"label": "Hỗ trợ luôn có hại nên cần bỏ hẳn", "isCorrect": False},
                    {"label": "Nên cho hỗ trợ tối đa ngay từ đầu rồi giảm dần", "isCorrect": False, "misconception": "cngdtt.tutor-gives-answer"},
                    {"label": "Mức hỗ trợ nên giống nhau cho mọi người học", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-tham-do",
                "type": "mcq",
                "prompt": "Vì sao hệ thống nên thỉnh thoảng chèn nhiệm vụ ngoài dự đoán của mô hình?",
                "explanation": "Luôn chọn theo ước lượng hiện tại thì hệ thống không bao giờ phát hiện mình ước lượng sai, và người học bị khoá trong vùng mà mô hình nghĩ là phù hợp.",
                "points": 2,
                "options": [
                    {"label": "Để kiểm lại mô hình và tránh khoá người học trong vùng mô hình tự tin sai", "isCorrect": True},
                    {"label": "Để tăng độ khó trung bình của khoá học", "isCorrect": False},
                    {"label": "Để thu thập thêm dữ liệu bán cho bên thứ ba", "isCorrect": False},
                    {"label": "Không nên: mọi nhiệm vụ đều phải khớp ước lượng hiện tại", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-muc-85",
                "type": "mcq",
                "prompt": "Nghiên cứu về mức thành công tối ưu gợi ý tỉ lệ đúng nào, và nên dùng con số ấy thế nào?",
                "explanation": "Quanh 85% cho một lớp bài toán học có phản hồi. Không phải hằng số cho mọi tình huống, nhưng là điểm khởi đầu tốt hơn trực giác nhắm tới 95%.",
                "points": 2,
                "options": [
                    {"label": "Quanh 85%, dùng làm điểm khởi đầu để hiệu chỉnh chứ không như hằng số phổ quát", "isCorrect": True},
                    {"label": "Quanh 95%, vì người học cần cảm giác thành công", "isCorrect": False},
                    {"label": "Quanh 50%, vì như vậy mới thật sự thử thách", "isCorrect": False},
                    {"label": "Không có con số nào có ý nghĩa, tuỳ từng người học", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-thu-tu-can-thiep",
                "type": "mcq",
                "prompt": "Tỉ lệ đúng của một người học rơi xuống dưới 60%. Nên tăng hỗ trợ trước hay hạ độ khó trước, vì sao?",
                "explanation": "Tăng hỗ trợ trước: hạ độ khó là thay đổi mục tiêu học tập, còn tăng hỗ trợ giữ nguyên mục tiêu mà vẫn giúp người học vượt qua.",
                "points": 2,
                "options": [
                    {"label": "Tăng hỗ trợ trước, vì hạ độ khó là thay đổi mục tiêu học tập còn tăng hỗ trợ thì không", "isCorrect": True},
                    {"label": "Hạ độ khó trước, vì đó là cách nhanh nhất khôi phục tỉ lệ đúng", "isCorrect": False, "misconception": "cngdtt.adaptive-means-easier"},
                    {"label": "Không can thiệp, để người học tự vượt qua", "isCorrect": False},
                    {"label": "Chuyển ngay sang chủ đề khác dễ hơn", "isCorrect": False, "misconception": "cngdtt.adaptive-means-easier"},
                ],
            },
            {
                "key": "3.5-ba-con-so",
                "type": "mcq",
                "prompt": "Ba con số nào nên có trên bảng theo dõi của một hệ thích ứng?",
                "explanation": "Tỉ lệ đúng trượt gần đây, số lượt kể từ lần đạt ngưỡng gần nhất, và thời gian trả lời trung vị — ba con số này bắt được quá dễ, quay bánh xe và lách hệ thống.",
                "points": 2,
                "options": [
                    {"label": "Tỉ lệ đúng trượt gần đây, số lượt kể từ lần đạt ngưỡng, thời gian trả lời trung vị", "isCorrect": True},
                    {"label": "Tổng số bài đã làm, tổng thời gian trên hệ thống, số ngày liên tiếp", "isCorrect": False},
                    {"label": "Điểm trung bình, xếp hạng trong lớp, số huy hiệu", "isCorrect": False, "misconception": "cngdtt.mastery-equals-score"},
                    {"label": "Số lần đăng nhập, thiết bị sử dụng, trình duyệt", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-khoa-tran",
                "type": "mcq",
                "prompt": "Rủi ro khoá trần trong hệ thích ứng là gì?",
                "explanation": "Nhóm khởi đầu yếu nhận nội dung dễ hơn trong thời gian dài hơn, nên khoảng cách nới rộng — phiên bản thuật toán của việc phân ban theo học lực.",
                "points": 2,
                "options": [
                    {"label": "Nhóm khởi đầu yếu bị giữ mãi ở nội dung dễ, khiến khoảng cách nới rộng thêm", "isCorrect": True},
                    {"label": "Hệ thống hết bài khó để cho người học giỏi", "isCorrect": False},
                    {"label": "Máy chủ quá tải khi nhiều người dùng cùng lúc", "isCorrect": False},
                    {"label": "Người học thấy nhàm chán vì bài quá khó", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-phong-khoa-tran",
                "type": "mcq",
                "prompt": "Biện pháp nào phòng được rủi ro khoá trần?",
                "explanation": "Có đường nâng độ khó tự động, đặt sàn nội dung mà mọi người học đều phải gặp, và báo cáo định kỳ phân bố độ khó theo nhóm hoàn cảnh.",
                "points": 2,
                "options": [
                    {"label": "Đường nâng độ khó tự động, sàn nội dung bắt buộc cho mọi người, và báo cáo phân bố độ khó theo nhóm", "isCorrect": True},
                    {"label": "Cho người học tự chọn độ khó và không can thiệp", "isCorrect": False},
                    {"label": "Giữ độ khó cố định cho cả lớp", "isCorrect": False},
                    {"label": "Ẩn thông tin độ khó khỏi giáo viên để tránh định kiến", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-han-su-dung",
                "type": "mcq",
                "prompt": "Vì sao nên đặt hạn sử dụng cho ước lượng cũ trong mô hình người học?",
                "explanation": "Vì đó là ước lượng tại một thời điểm; để nó theo học sinh sang năm sau thì nó biến thành nhãn năng lực, và kỳ vọng của người lớn sẽ thay đổi theo nhãn ấy.",
                "points": 2,
                "options": [
                    {"label": "Để ước lượng tạm thời không biến thành nhãn năng lực theo học sinh sang năm sau", "isCorrect": True},
                    {"label": "Để tiết kiệm dung lượng lưu trữ", "isCorrect": False},
                    {"label": "Để mô hình chạy nhanh hơn", "isCorrect": False},
                    {"label": "Không cần: dữ liệu càng nhiều thì ước lượng càng tốt", "isCorrect": False, "misconception": "cngdtt.label-as-ability"},
                ],
            },
            {
                "key": "3.5-kiem-tra-dao-duc",
                "type": "true_false",
                "prompt": "Nếu học sinh và phụ huynh nhìn thấy toàn bộ quy tắc quyết định của hệ thống mà thấy nó không công bằng, thì vấn đề nằm ở quy tắc chứ không ở việc nên giấu quy tắc.",
                "explanation": "Đúng. Đây là bài kiểm tra đạo đức nhanh cho mọi thiết kế thích ứng, và nó cũng phù hợp với nghĩa vụ minh bạch đã học ở Bài 1.5.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "3.5-viet-luan-chinh-sach",
                "type": "essay",
                "prompt": "Viết 250–350 từ mô tả chính sách thích ứng cho phần luyện tập của đồ án: bạn thích ứng theo trục nào, bảng quyết định gồm những dòng nào, mức thành công mục tiêu là bao nhiêu, và hai biện pháp bạn dùng để tránh khoá trần.",
                "points": 5,
            },
        ],
    },
}
