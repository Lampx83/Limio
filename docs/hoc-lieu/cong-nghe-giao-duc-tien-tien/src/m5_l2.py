# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 5.2 · Thiết kế học liệu nhập vai: nguyên tắc và cạm bẫy",
    "durationMin": 50,
    "description": "Nguyên tắc đa phương tiện áp vào môi trường ba chiều, bốn cạm bẫy đặc trưng của học liệu nhập vai, và bảng kiểm thiết kế dùng được ngay cho từng cảnh AR.",
    "objectives": [
        "Áp được nguyên tắc mạch lạc, chỉ dẫn và kề nhau vào một cảnh ba chiều",
        "Nhận diện được bốn cạm bẫy đặc trưng của học liệu nhập vai trong sản phẩm của mình",
        "Thiết kế được hoạt động sinh nội dung để nâng mức tham gia của người học",
    ],
    "summary": [
        "Các nguyên tắc học đa phương tiện vẫn đúng trong môi trường ba chiều, nhưng khó tuân thủ hơn vì không gian mở ra vô số chỗ để thêm chi tiết thừa.",
        "Bốn cạm bẫy: chi tiết hấp dẫn lạc mục tiêu, chia chú ý giữa nhiều mặt phẳng, tự do di chuyển không có hướng dẫn, và nhập vai thay cho nhiệm vụ học tập.",
        "Người học phải sinh ra thứ gì đó trong hoặc sau trải nghiệm nhập vai — nếu không, mức tham gia dừng ở chủ động và hiệu quả thấp.",
        "Bảng kiểm chín dòng áp được cho từng cảnh trước khi dựng, rẻ hơn nhiều so với sửa sau khi đã dựng xong.",
    ],
    "body": r"""
## Nguyên tắc đa phương tiện trong không gian ba chiều

Sáu nguyên tắc ở Bài 1.2 không mất hiệu lực khi chuyển sang môi trường nhập vai — chúng chỉ **khó tuân thủ hơn**, vì không gian ba chiều mở ra vô số chỗ để nhét thêm thứ trông hay.

| Nguyên tắc | Vi phạm điển hình trong AR/VR | Cách sửa |
|---|---|---|
| Mạch lạc | Nhạc nền, hiệu ứng hạt, mô hình phụ đứng xung quanh cho sinh động | Cảnh chỉ chứa thứ phục vụ mục tiêu; nền trung tính |
| Chỉ dẫn | Người học không biết nhìn vào đâu trong một cảnh có mười chi tiết | Làm nổi chi tiết đang nói tới, làm mờ phần còn lại; dẫn theo trình tự |
| Kề nhau | Chú giải nằm trên giấy, mô hình nằm trên màn hình | Đưa nhãn vào chính lớp phủ, neo vào bộ phận tương ứng |
| Chia đoạn | Một cảnh dài trình bày cả quy trình bảy bước | Mỗi cảnh một bước, người học tự bấm tiếp |
| Chuẩn bị trước | Lao thẳng vào mô phỏng khi người học chưa biết tên các bộ phận | Một trang giấy giới thiệu tên gọi trước khi quét |
| Tránh trùng lặp | Thuyết minh đọc y nguyên chữ đang hiện trong không gian | Chọn một kênh: hoặc chữ, hoặc lời |

> [!ghi-nho] Nguyên tắc **chuẩn bị trước** đặc biệt quan trọng với sách AR, và nó chính là lý do sách AR mạnh hơn ứng dụng AR thuần: trang giấy làm phần chuẩn bị — tên gọi, bối cảnh, câu hỏi dẫn — còn lớp phủ làm phần mà giấy không làm được.

## Bốn cạm bẫy đặc trưng của học liệu nhập vai

**Chi tiết hấp dẫn lạc mục tiêu.** Trong học liệu phẳng, một hình trang trí chiếm một góc trang. Trong không gian ba chiều, một mô hình phụ sinh động chiếm cả trường nhìn và cả sự chú ý. Đây là lý do cạm bẫy này nặng hơn hẳn ở AR và VR — người học sẽ nhớ con khủng long biết gầm, không nhớ nguyên lý.

**Chia chú ý giữa nhiều mặt phẳng.** Đã phân tích ở Bài 1.7: giấy, màn hình, tay giữ thiết bị. Với VR còn thêm điều khiển cầm tay. Mỗi lần người học phải chuyển giữa hai nguồn thông tin là một lần tải thừa.

**Tự do di chuyển không có hướng dẫn.** Tác tử là ưu điểm, nhưng tự do tuyệt đối trong môi trường mới khiến người học dành phần lớn thời gian để khám phá giao diện thay vì nội dung. Giải pháp không phải khoá tự do, mà là **đưa nhiệm vụ có mục tiêu rõ**: tìm bộ phận nào chịu trách nhiệm việc gì, đặt các bước theo đúng trình tự.

**Nhập vai thay cho nhiệm vụ học tập.** Cạm bẫy nghiêm trọng nhất và khó thấy nhất: sản phẩm rất ấn tượng, người học rất thích, và không có lúc nào họ phải suy nghĩ. Theo khung ICAP ở Bài 1.2, xoay mô hình chỉ là mức **chủ động**; muốn lên mức kiến tạo, người học phải **sinh ra thứ gì đó**.

```html
<div style="margin:1.3rem 0;overflow-x:auto">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Nâng mức tham gia trong cùng một cảnh AR</div>
  <div style="min-width:34rem;display:flex;gap:.4rem;align-items:stretch">
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(120,113,108,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Thụ động</div>
      <div style="padding:.6rem;font-size:1.02rem;line-height:1.55">Xem hoạt hình mô hình tự chạy</div>
    </div>
    <div style="flex:1;border:1px solid rgba(127,127,127,.3);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(37,99,235,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Chủ động</div>
      <div style="padding:.6rem;font-size:1.02rem;line-height:1.55">Xoay mô hình, phóng to, bật tắt lớp</div>
    </div>
    <div style="flex:1;border:2px solid rgba(13,148,136,.55);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(13,148,136,.9);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Kiến tạo</div>
      <div style="padding:.6rem;font-size:1.02rem;line-height:1.55"><strong>Dự đoán</strong> chuyện gì xảy ra khi bấm, rồi kiểm; tự vẽ lại sơ đồ vào vở sau khi cất điện thoại</div>
    </div>
    <div style="flex:1;border:1px solid rgba(124,58,237,.5);border-radius:.5rem;overflow:hidden">
      <div style="background:rgba(124,58,237,.85);color:#fff;padding:.5rem;font-size:1.02rem;font-weight:600">Tương tác</div>
      <div style="padding:.6rem;font-size:1.02rem;line-height:1.55">Hai bạn cùng quét, một người mô tả, một người kiểm và phản biện</div>
    </div>
  </div>
  <div style="min-width:34rem;font-size:1rem;opacity:.75;margin:.55rem 0 0;line-height:1.6">Hai cột phải <strong>không tốn thêm chi phí kỹ thuật</strong> — chúng chỉ đòi thêm một câu lệnh trên trang giấy. Đây là cách rẻ nhất nâng chất lượng sư phạm của sản phẩm.</div>
</div>
```

> [!vi-du] Cùng một mô hình van tim. Phiên bản yếu: người học quét, xem hoạt hình ba mươi giây, đọc chú giải. Phiên bản mạnh: trang giấy hỏi trước *nếu van này không đóng kín, máu sẽ đi đâu*; người học viết dự đoán vào ô trống; rồi mới quét để kiểm; sau đó cất điện thoại và vẽ lại dòng chảy vào vở. Chi phí kỹ thuật của hai phiên bản là như nhau.

## Bảng kiểm thiết kế cho từng cảnh

Áp bảng này **trước khi dựng mô hình**, vì sửa sau khi đã dựng tốn gấp nhiều lần:

| # | Câu hỏi | Đạt khi |
|---|---|---|
| 1 | Cảnh này phục vụ mục tiêu học tập nào | Nêu được một mục tiêu, viết bằng động từ hành vi |
| 2 | Người học phải làm gì, không chỉ nhìn gì | Có ít nhất một hành động sinh ra thông tin mới |
| 3 | Chi tiết nào có thể bỏ mà không mất mục tiêu | Đã liệt kê và đã bỏ |
| 4 | Người học biết nhìn vào đâu trước | Có cơ chế làm nổi hoặc dẫn trình tự |
| 5 | Chú giải nằm ở đâu | Neo vào chính chi tiết tương ứng trong lớp phủ |
| 6 | Cảnh dài bao lâu | Dưới một phút cho mỗi bước; dài hơn thì chia |
| 7 | Người học đã biết tên các bộ phận chưa | Phần chuẩn bị nằm trên trang giấy |
| 8 | Nếu không quét được thì sao | Trang giấy tự nó vẫn đủ nghĩa |
| 9 | Sau khi cất thiết bị, người học còn lại gì | Có sản phẩm ghi lại: sơ đồ, câu trả lời, ghi chú |

Dòng 9 là dòng phân biệt học liệu nhập vai tốt với một buổi trình diễn công nghệ. Nếu người học không mang theo được gì sau khi cất điện thoại, trải nghiệm ấy sẽ mờ đi cùng tốc độ với sự mới lạ.

## Luyện tập và tài liệu tham khảo

### Cá nhân (25 phút)

Lấy một cảnh AR bạn định dựng. Chạy đủ chín dòng bảng kiểm và ghi kết quả từng dòng. Với dòng 3, liệt kê ít nhất ba chi tiết bạn đã định đưa vào và quyết định bỏ, kèm lý do.

### Nhóm 3–4 người (30 phút)

Mỗi người mô tả một cảnh của mình trong hai phút. Nhóm chất vấn bằng đúng hai câu: *người học phải sinh ra cái gì trong cảnh này* và *nếu bỏ phần AR đi thì mất gì*. Cùng nâng một cảnh yếu nhất từ mức chủ động lên mức kiến tạo mà không thêm chi phí kỹ thuật.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng **kịch bản chi tiết cho bốn cảnh AR** của đồ án, ở mức người khác dựng được theo.

1. Mỗi cảnh một trang: mục tiêu, thứ hiện lên, thứ người học phải làm, chú giải và vị trí neo của nó, thời lượng dự kiến.
2. Chạy bảng kiểm chín dòng cho từng cảnh, ghi kết quả vào bảng chung.
3. Với mỗi cảnh, thiết kế **một hoạt động sinh nội dung**: dự đoán trước khi quét, vẽ lại sau khi cất thiết bị, hoặc giải thích cho bạn cùng bàn.
4. Nêu rõ phần trên trang giấy làm nhiệm vụ chuẩn bị trước cho từng cảnh.
5. Kiểm chéo với một bạn: đưa kịch bản cho họ đọc và hỏi họ hình dung ra cảnh nào khác với ý bạn.

**Cách làm (gợi ý từng bước):** viết mục tiêu trước rồi mới nghĩ tới mô hình, không làm ngược; phần thứ người học phải làm viết bằng động từ ở dạng mệnh lệnh để dễ kiểm; thời lượng ước lượng bằng cách đọc to kịch bản và bấm giờ; hoạt động sinh nội dung nên nằm trên giấy để không phải lập trình thêm.

**Chấm theo:** bốn cảnh có mục tiêu rõ và hành động cụ thể (3đ) · bảng kiểm chín dòng đầy đủ, có chi tiết đã bị bỏ (2đ) · hoạt động sinh nội dung thật sự nâng mức tham gia (3đ) · phần chuẩn bị trên giấy hợp lý và kiểm chéo có ghi nhận (2đ).

### Nguồn tham khảo

- Mayer, R. E. (2021). *Multimedia Learning* (3rd ed.). Cambridge University Press.
- Makransky, G., & Petersen, G. B. (2021). The Cognitive Affective Model of Immersive Learning (CAMIL). *Educational Psychology Review*, 33, 937–958.
- Chi, M. T. H., & Wylie, R. (2014). The ICAP framework. *Educational Psychologist*, 49(4), 219–243.
- Parong, J., & Mayer, R. E. (2018). Learning science in immersive virtual reality. *Journal of Educational Psychology*, 110(6), 785–797.
""",
    "quiz": {
        "title": "Kiểm tra Bài 5.2",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "5.2-kho-tuan-thu-hon",
                "type": "mcq",
                "prompt": "Vì sao các nguyên tắc học đa phương tiện khó tuân thủ hơn trong môi trường ba chiều?",
                "explanation": "Không gian ba chiều mở ra vô số chỗ để thêm chi tiết trông hay, trong khi trang phẳng giới hạn tự nhiên số thứ có thể nhét vào.",
                "points": 2,
                "options": [
                    {"label": "Vì không gian ba chiều mở ra vô số chỗ để thêm chi tiết thừa", "isCorrect": True},
                    {"label": "Vì các nguyên tắc ấy chỉ được kiểm chứng trên học liệu in", "isCorrect": False},
                    {"label": "Vì thiết bị nhập vai có độ phân giải thấp", "isCorrect": False},
                    {"label": "Chúng không còn hiệu lực trong môi trường ba chiều", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-chuan-bi-truoc",
                "type": "mcq",
                "prompt": "Vì sao nguyên tắc chuẩn bị trước khiến sách AR mạnh hơn ứng dụng AR thuần?",
                "explanation": "Trang giấy làm phần chuẩn bị — tên gọi, bối cảnh, câu hỏi dẫn — còn lớp phủ làm phần mà giấy không làm được. Hai phương tiện chia việc theo đúng thế mạnh.",
                "points": 2,
                "options": [
                    {"label": "Trang giấy lo phần giới thiệu tên gọi và bối cảnh, lớp phủ lo phần giấy không làm được", "isCorrect": True},
                    {"label": "Vì giấy rẻ hơn màn hình", "isCorrect": False},
                    {"label": "Vì học sinh quen đọc sách hơn dùng ứng dụng", "isCorrect": False},
                    {"label": "Vì sách AR không cần lập trình", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-chi-tiet-hap-dan",
                "type": "mcq",
                "prompt": "Vì sao cạm bẫy chi tiết hấp dẫn lạc mục tiêu nặng hơn ở AR và VR so với học liệu phẳng?",
                "explanation": "Trong học liệu phẳng, hình trang trí chiếm một góc trang; trong không gian ba chiều, một mô hình phụ sinh động chiếm cả trường nhìn và cả sự chú ý.",
                "points": 2,
                "options": [
                    {"label": "Vì chi tiết ba chiều chiếm cả trường nhìn chứ không chỉ một góc trang", "isCorrect": True},
                    {"label": "Vì học sinh dễ bị phân tâm hơn khi dùng điện thoại", "isCorrect": False},
                    {"label": "Vì thiết bị nhập vai hiển thị màu sắc rực rỡ hơn", "isCorrect": False},
                    {"label": "Không nặng hơn: nguyên tắc mạch lạc áp dụng như nhau", "isCorrect": False, "misconception": "cngdtt.more-media-better"},
                ],
            },
            {
                "key": "5.2-tu-do-di-chuyen",
                "type": "mcq",
                "prompt": "Người học dành phần lớn thời gian khám phá giao diện thay vì nội dung. Giải pháp đúng là gì?",
                "explanation": "Không khoá tự do, mà đưa nhiệm vụ có mục tiêu rõ: tìm bộ phận chịu trách nhiệm việc gì, sắp các bước theo trình tự.",
                "points": 2,
                "options": [
                    {"label": "Giao nhiệm vụ có mục tiêu rõ trong cảnh, thay vì khoá bớt tự do", "isCorrect": True},
                    {"label": "Khoá mọi thao tác trừ nút tiếp theo", "isCorrect": False},
                    {"label": "Rút ngắn thời gian mỗi cảnh xuống 10 giây", "isCorrect": False},
                    {"label": "Thêm hướng dẫn bằng giọng nói liên tục", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-cam-bay-nghiem-trong",
                "type": "mcq",
                "prompt": "Cạm bẫy nào của học liệu nhập vai nghiêm trọng nhất và khó thấy nhất?",
                "explanation": "Nhập vai thay cho nhiệm vụ học tập: sản phẩm ấn tượng, người học thích, và không có lúc nào họ phải suy nghĩ.",
                "points": 2,
                "options": [
                    {"label": "Trải nghiệm nhập vai thay thế cho nhiệm vụ học tập — người học không phải suy nghĩ", "isCorrect": True},
                    {"label": "Mô hình ba chiều có số đa giác quá cao", "isCorrect": False},
                    {"label": "Chú giải viết quá ngắn", "isCorrect": False},
                    {"label": "Cảnh chuyển quá nhanh", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-icap-ar",
                "type": "mcq",
                "prompt": "Theo khung ICAP, xoay và phóng to mô hình ba chiều thuộc mức nào, và làm sao nâng lên mức kiến tạo?",
                "explanation": "Xoay mô hình là mức chủ động. Muốn lên kiến tạo, người học phải sinh ra thứ gì đó: dự đoán rồi kiểm, hoặc vẽ lại sau khi cất thiết bị.",
                "points": 2,
                "options": [
                    {"label": "Mức chủ động; nâng lên bằng cách bắt dự đoán trước khi quét hoặc vẽ lại sau khi cất thiết bị", "isCorrect": True},
                    {"label": "Mức kiến tạo rồi, vì người học đang thao tác", "isCorrect": False},
                    {"label": "Mức tương tác, vì có phản hồi từ hệ thống", "isCorrect": False},
                    {"label": "Mức thụ động; nâng lên bằng cách thêm hoạt hình", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-chi-phi-nang-muc",
                "type": "mcq",
                "prompt": "Nâng cảnh AR từ mức chủ động lên mức kiến tạo tốn thêm bao nhiêu chi phí kỹ thuật?",
                "explanation": "Gần như không tốn thêm: hoạt động sinh nội dung nằm trên trang giấy — một câu lệnh dự đoán, một ô trống để viết, một yêu cầu vẽ lại.",
                "points": 2,
                "options": [
                    {"label": "Gần như không tốn thêm, vì hoạt động sinh nội dung nằm trên trang giấy", "isCorrect": True},
                    {"label": "Tốn gấp đôi vì phải lập trình thêm tương tác", "isCorrect": False},
                    {"label": "Cần thêm mô hình ba chiều mới", "isCorrect": False},
                    {"label": "Không nâng được nếu không có thiết bị mạnh hơn", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-dong-9",
                "type": "mcq",
                "prompt": "Dòng 9 của bảng kiểm hỏi *sau khi cất thiết bị, người học còn lại gì*. Vì sao đó là dòng quan trọng nhất?",
                "explanation": "Nó phân biệt học liệu nhập vai tốt với một buổi trình diễn công nghệ: không mang theo được gì thì trải nghiệm sẽ mờ đi cùng tốc độ với sự mới lạ.",
                "points": 2,
                "options": [
                    {"label": "Vì nó phân biệt học liệu với buổi trình diễn: không có sản phẩm mang theo thì trải nghiệm mờ đi cùng sự mới lạ", "isCorrect": True},
                    {"label": "Vì giáo viên cần bằng chứng để chấm điểm", "isCorrect": False},
                    {"label": "Vì cần dữ liệu cho hệ thống phân tích", "isCorrect": False},
                    {"label": "Vì quy chế yêu cầu học sinh có vở ghi", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-ke-nhau-3d",
                "type": "mcq",
                "prompt": "Nguyên tắc kề nhau áp vào cảnh AR nghĩa là gì?",
                "explanation": "Đưa nhãn vào chính lớp phủ và neo vào bộ phận tương ứng, thay vì để chú giải trên giấy còn mô hình trên màn hình.",
                "points": 2,
                "options": [
                    {"label": "Neo nhãn vào chính bộ phận tương ứng trong lớp phủ, không để lệch giữa giấy và màn hình", "isCorrect": True},
                    {"label": "Đặt mọi chú giải ở góc dưới bên phải cho thống nhất", "isCorrect": False},
                    {"label": "Gom toàn bộ chú giải vào một bảng riêng cuối trang", "isCorrect": False},
                    {"label": "Đọc chú giải bằng giọng nói thay vì hiển thị", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-vi-du-van-tim",
                "type": "mcq",
                "prompt": "Trong ví dụ về mô hình van tim, điều gì làm phiên bản mạnh khác phiên bản yếu?",
                "explanation": "Người học viết dự đoán trước khi quét, rồi quét để kiểm, rồi cất thiết bị và vẽ lại — ba hành động sinh nội dung, chi phí kỹ thuật như nhau.",
                "points": 2,
                "options": [
                    {"label": "Có dự đoán trước khi quét, kiểm bằng mô hình, rồi vẽ lại sau khi cất thiết bị", "isCorrect": True},
                    {"label": "Mô hình ba chiều chi tiết hơn và hoạt hình mượt hơn", "isCorrect": False, "misconception": "cngdtt.more-media-better"},
                    {"label": "Có thêm nhạc nền và hiệu ứng chuyển cảnh", "isCorrect": False},
                    {"label": "Thời lượng hoạt hình dài hơn", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-bang-kiem-truoc",
                "type": "true_false",
                "prompt": "Nên chạy bảng kiểm thiết kế trước khi dựng mô hình ba chiều, không phải sau.",
                "explanation": "Đúng — sửa sau khi đã dựng tốn gấp nhiều lần, và người ta có xu hướng giữ lại thứ mình đã tốn công làm dù nó không phục vụ mục tiêu.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "5.2-viet-luan-canh",
                "type": "essay",
                "prompt": "Chọn một cảnh AR trong đồ án của bạn. Viết 250–350 từ mô tả nó theo bảng kiểm: mục tiêu, người học phải làm gì, ba chi tiết bạn đã bỏ và lý do, cách neo chú giải, và hoạt động sinh nội dung để nâng mức tham gia.",
                "points": 5,
            },
        ],
    },
}
