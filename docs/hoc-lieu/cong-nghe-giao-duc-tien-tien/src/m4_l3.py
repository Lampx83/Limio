# -*- coding: utf-8 -*-
LESSON = {
    "title": "Bài 4.3 · Chỉ số: đo cái gì, và vì sao chỉ số dễ đo lại nguy hiểm",
    "durationMin": 50,
    "description": "Khái niệm cần đo và chỉ số thay thế, bốn chỉ số phổ biến cùng thứ chúng thật sự đo, định luật Goodhart trong lớp học, và cách dựng bộ chỉ số cân bằng.",
    "objectives": [
        "Phân biệt được khái niệm cần đo với chỉ số thay thế và kiểm được quan hệ giữa hai thứ",
        "Chỉ ra được ba chỉ số phổ biến sẽ hỏng thế nào khi người học biết mình bị đo bằng chúng",
        "Dựng được bộ chỉ số cân bằng gồm chỉ số dẫn, chỉ số trễ và chỉ số đối trọng",
    ],
    "summary": [
        "Cái ta quan tâm — hiểu, tiến bộ, hứng thú — không đo trực tiếp được, nên luôn phải dùng chỉ số thay thế; giá trị của chỉ số nằm ở chỗ quan hệ với khái niệm gốc có được kiểm hay không.",
        "Thời gian trên hệ thống, số lần đăng nhập và tỉ lệ hoàn thành đo sự có mặt, không đo tiến bộ.",
        "Khi một chỉ số trở thành mục tiêu, nó thôi là chỉ số tốt: cả người dạy lẫn người học đều tối ưu theo thứ được đo.",
        "Bộ chỉ số dùng được cần ba loại: chỉ số dẫn để hành động sớm, chỉ số trễ để biết kết quả thật, và chỉ số đối trọng để phát hiện tác dụng phụ.",
    ],
    "body": r"""
## Khái niệm cần đo và chỉ số thay thế

Không ai đo trực tiếp được *mức độ hiểu* hay *sự tập trung*. Ta chỉ đo được những dấu vết quan sát được và giả định chúng phản ánh cái mình quan tâm. Trong đo lường, thứ ta quan tâm gọi là **khái niệm cần đo**, thứ ta thật sự ghi lại gọi là **chỉ số thay thế**, và chất lượng của phép đo nằm ở khoảng cách giữa hai thứ đó.

| Khái niệm cần đo | Chỉ số thay thế thường dùng | Khoảng cách giữa chúng |
|---|---|---|
| Mức độ hiểu | Tỉ lệ trả lời đúng | Đoán trúng, câu hỏi đo trí nhớ từ ngữ, câu quá dễ |
| Sự tập trung | Thời gian mở trang | Mở tab rồi đi làm việc khác; đọc chậm vì khó |
| Hứng thú | Số lần đăng nhập | Đăng nhập vì bị nhắc, vì điểm chuyên cần |
| Tiến bộ | Số bài đã hoàn thành | Làm cho xong, chép đáp án, làm bài quá dễ |

> [!ghi-nho] Một chỉ số thay thế chỉ có giá trị khi quan hệ giữa nó và khái niệm gốc **được kiểm trên chính nhóm người học của bạn**. Đừng mượn quan hệ ấy từ một nghiên cứu ở bối cảnh khác: thời gian trên hệ thống có thể tương quan thuận với kết quả ở nhóm này và tương quan nghịch ở nhóm khác — nhóm giỏi làm nhanh hơn.

## Bốn chỉ số phổ biến và thứ chúng thật sự đo

**Thời gian trên nhiệm vụ.** Được coi là chỉ số kinh điển, nhưng dữ liệu web đo nó rất tệ: hệ thống thấy trang mở, không thấy người học có nhìn vào không. Cách cải thiện rẻ nhất là **cắt ngưỡng trên** — mọi khoảng lặng dài hơn ví dụ 15 phút thì tính là rời đi, không cộng vào — và luôn báo cáo kèm trung vị chứ không chỉ trung bình.

**Số lần đăng nhập và chuỗi ngày hoạt động.** Đo thói quen, không đo học tập. Nguy hiểm nhất là khi chúng được gắn với phần thưởng: khi ấy chúng đo đúng thứ được thưởng và không còn nói gì về việc học.

**Tỉ lệ hoàn thành.** Đo việc đi hết đường, không đo học được gì trên đường. Một khoá có tỉ lệ hoàn thành 90% có thể vì nó quá dễ. Nên đọc kèm chỉ số kết quả độc lập.

**Điểm quiz trong hệ thống.** Chỉ số gần khái niệm gốc nhất trong bốn cái, nhưng vẫn phụ thuộc chất lượng câu hỏi — đúng những vấn đề đã phân tích ở Bài 2.4: câu đo trí nhớ từ ngữ, lộ đáp án qua hình thức, nhiễu vô hiệu.

```html
<div style="margin:1.3rem 0">
  <div style="font-size:1rem;font-weight:600;letter-spacing:.03em;text-transform:uppercase;opacity:.65;margin:0 0 .6rem">Khoảng cách giữa chỉ số và thứ cần đo</div>
  <div style="display:flex;flex-direction:column;gap:.4rem">
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 12rem;font-size:1.02rem">Điểm bài kiểm tra độc lập</div><div style="flex:1"><div style="width:78%;background:rgba(13,148,136,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">gần khái niệm gốc</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 12rem;font-size:1.02rem">Tỉ lệ đúng trong hệ thống</div><div style="flex:1"><div style="width:62%;background:rgba(37,99,235,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">phụ thuộc chất lượng câu hỏi</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 12rem;font-size:1.02rem">Tỉ lệ hoàn thành</div><div style="flex:1"><div style="width:38%;background:rgba(217,150,40,.85);color:#fff;padding:.35rem .6rem;border-radius:.3rem;font-size:1rem">đo đi hết đường</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 12rem;font-size:1.02rem">Thời gian trên hệ thống</div><div style="flex:1"><div style="width:24%;background:rgba(220,38,38,.8);color:#fff;padding:.35rem .5rem;border-radius:.3rem;font-size:1rem">đo có mặt</div></div></div>
    <div style="display:flex;align-items:center;gap:.5rem"><div style="flex:0 0 12rem;font-size:1.02rem">Số lần đăng nhập</div><div style="flex:1"><div style="width:16%;min-width:6rem;background:rgba(220,38,38,.8);color:#fff;padding:.35rem .5rem;border-radius:.3rem;font-size:1rem">đo thói quen</div></div></div>
  </div>
  <div style="font-size:1rem;opacity:.75;margin:.6rem 0 0;line-height:1.6">Càng xuống dưới càng dễ đo và càng dễ tối ưu nhầm. Chỉ số dễ thu thập nhất thường là chỉ số xa mục tiêu nhất — đó là lý do chúng phổ biến trên các bảng điều khiển thương mại.</div>
</div>
```

## Định luật Goodhart trong lớp học

Nguyên tắc được phát biểu ngắn gọn: **khi một chỉ số trở thành mục tiêu, nó thôi là một chỉ số tốt**. Trong giáo dục, hiện tượng này xuất hiện ở cả ba phía:

| Ai tối ưu | Chỉ số bị đặt làm mục tiêu | Hành vi sinh ra |
|---|---|---|
| Người học | Chuỗi ngày hoạt động | Mở ứng dụng 30 giây mỗi tối để giữ chuỗi |
| Người dạy | Tỉ lệ hoàn thành khoá học | Hạ độ khó bài tập, nới hạn nộp |
| Nhà trường | Điểm trung bình môn trên hệ thống | Ra đề dễ hơn, cho làm lại nhiều lần |

Ba hàng trên đều là **phản ứng hợp lý** với thước đo, không phải sự gian dối. Vì vậy cách chữa không nằm ở kêu gọi trung thực mà nằm ở thiết kế đo lường: đừng đặt mục tiêu vào một chỉ số duy nhất, và luôn có ít nhất một chỉ số mà việc gian lận theo chỉ số kia sẽ làm xấu đi.

> [!vi-du] Trường đặt chỉ tiêu 90% học sinh hoàn thành khoá luyện tập trực tuyến. Sau một học kỳ, tỉ lệ đạt 94% — và điểm bài kiểm tra độc lập giảm nhẹ. Hai con số ấy không mâu thuẫn: cách nhanh nhất để tăng tỉ lệ hoàn thành là giảm yêu cầu của việc hoàn thành.

## Bộ chỉ số cân bằng: dẫn, trễ và đối trọng

| Loại | Vai trò | Ví dụ trong một lớp học |
|---|---|---|
| Chỉ số dẫn | Biết sớm để kịp can thiệp; đo được hằng tuần | Tỉ lệ nộp bài đúng hạn, số kỹ năng đạt ngưỡng trong tuần, tỉ lệ đúng trượt |
| Chỉ số trễ | Đo cái ta thật sự muốn; chỉ có sau vài tháng | Điểm bài kiểm tra độc lập, khả năng vận dụng ở tình huống mới, kết quả kỳ sau |
| Chỉ số đối trọng | Bắt tác dụng phụ của việc tối ưu chỉ số dẫn | Thời gian học ngoài giờ, mức độ căng thẳng tự báo cáo, tỉ lệ bỏ giữa chừng, chênh lệch giữa các nhóm học sinh |

Chỉ số đối trọng là thứ hay bị bỏ nhất và cũng là thứ phân biệt một hệ đo lường có trách nhiệm với một hệ chạy theo thành tích. Nếu bạn đẩy tỉ lệ nộp bài đúng hạn lên bằng cách tăng nhắc nhở, chỉ số đối trọng sẽ cho biết cái giá: học sinh học tới khuya, hay nhóm yếu bỏ cuộc sớm hơn.

> [!meo] Quy tắc ba câu khi chọn bộ chỉ số cho một dự án: (1) chỉ số nào cho tôi biết sớm để kịp làm gì đó; (2) chỉ số nào nói lên kết quả thật, dù nó tới muộn; (3) nếu ai đó cố tình đẩy chỉ số (1) lên bằng mọi giá, chỉ số nào sẽ xấu đi và tôi có đang theo dõi nó không.

## Luyện tập và tài liệu tham khảo

### Cá nhân (20 phút)

Chọn ba chỉ số mà một ứng dụng học tập bạn dùng đang hiển thị. Với mỗi cái, viết: khái niệm cần đo là gì, chỉ số này đo thật sự cái gì, và bạn sẽ làm gì để đẩy chỉ số ấy lên mà **không** học thêm được gì. Câu thứ ba là câu quan trọng nhất.

### Nhóm 3–4 người (30 phút)

Nhóm nhận một mục tiêu quản lý có thật, ví dụ *tăng tỉ lệ hoàn thành bài tập về nhà lên 90%*. Liệt kê năm cách đạt được chỉ tiêu ấy mà không cải thiện việc học. Sau đó đề xuất bộ chỉ số ba loại khiến năm cách ấy đều bị phát hiện.

### Bài tập về nhà — sản phẩm số (100 phút)

Dựng **bộ chỉ số cân bằng và bảng kiểm hiệu lực** cho một can thiệp giáo dục cụ thể (có thể là chính đồ án sách AR).

1. Nêu can thiệp và mục tiêu học tập của nó bằng một câu.
2. Chọn 2 chỉ số dẫn, 2 chỉ số trễ, 2 chỉ số đối trọng; mỗi chỉ số ghi rõ cách tính từ dữ liệu và nhịp đo.
3. Với mỗi chỉ số dẫn, viết **kịch bản lách**: cách đẩy nó lên mà không cải thiện học tập, và chỉ số nào sẽ bắt được kịch bản ấy.
4. Kiểm hiệu lực trên dữ liệu thật hoặc mô phỏng: tính tương quan giữa mỗi chỉ số dẫn và chỉ số trễ, trình bày bằng một bảng.
5. Viết nửa trang khuyến nghị: chỉ số nào nên đưa lên bảng điều khiển của giáo viên, chỉ số nào chỉ dùng nội bộ khi đánh giá chương trình, và vì sao.

**Cách làm (gợi ý từng bước):** viết công thức tính chỉ số tới mức người khác tính lại ra cùng con số — nêu rõ mẫu số, khoảng thời gian, cách xử lý người học mới vào giữa kỳ; với thời gian trên nhiệm vụ nhớ đặt ngưỡng cắt khoảng lặng và nói rõ ngưỡng ấy; kịch bản lách nên viết như một người thật sẽ làm, không viết chung chung.

**Chấm theo:** đủ ba loại chỉ số, mỗi cái có công thức tính lại được (3đ) · kịch bản lách cụ thể và có chỉ số bắt được (3đ) · kiểm hiệu lực bằng dữ liệu, trình bày gọn (2đ) · khuyến nghị phân biệt được chỉ số cho giáo viên và chỉ số nội bộ (2đ).

### Nguồn tham khảo

- Strathern, M. (1997). Improving ratings: Audit in the British University system. *European Review*, 5(3), 305–321 — phát biểu thường được trích dưới tên định luật Goodhart.
- Kizilcec, R. F., Pérez-Sanagustín, M., & Maldonado, J. J. (2017). Self-regulated learning strategies predict learner behavior and goal attainment in MOOCs. *Computers & Education*, 104, 18–33.
- Muijs, D. (2011). *Doing Quantitative Research in Education with SPSS* — chương về hiệu lực và độ tin cậy của phép đo.
- Macfadyen, L. P., & Dawson, S. (2010). Mining LMS data to develop an early warning system for educators. *Computers & Education*, 54(2), 588–599.
""",
    "quiz": {
        "title": "Kiểm tra Bài 4.3",
        "passThresholdPct": 70,
        "questions": [
            {
                "key": "4.3-proxy",
                "type": "mcq",
                "prompt": "Một chỉ số thay thế có giá trị khi nào?",
                "explanation": "Khi quan hệ giữa nó và khái niệm cần đo được kiểm trên chính nhóm người học của bạn — không mượn quan hệ ấy từ bối cảnh khác.",
                "points": 2,
                "options": [
                    {"label": "Khi quan hệ giữa nó và khái niệm cần đo được kiểm trên chính nhóm người học của mình", "isCorrect": True},
                    {"label": "Khi nó dễ thu thập và có sẵn trong hệ thống", "isCorrect": False, "misconception": "cngdtt.proxy-as-construct"},
                    {"label": "Khi nó được dùng phổ biến trong các sản phẩm khác", "isCorrect": False, "misconception": "cngdtt.hype-as-evidence"},
                    {"label": "Khi nó cho ra con số ổn định qua các tuần", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-time-on-task",
                "type": "mcq",
                "prompt": "Vì sao thời gian trên nhiệm vụ đo bằng dữ liệu web lại là chỉ số yếu, và cải thiện rẻ nhất là gì?",
                "explanation": "Hệ thống chỉ thấy trang mở, không thấy người học có nhìn vào không. Cải thiện rẻ nhất: cắt ngưỡng trên cho khoảng lặng dài và báo cáo kèm trung vị.",
                "points": 2,
                "options": [
                    {"label": "Vì mở trang không đồng nghĩa với đang học; nên cắt ngưỡng khoảng lặng dài và báo cáo trung vị", "isCorrect": True},
                    {"label": "Vì đồng hồ máy chủ không chính xác", "isCorrect": False},
                    {"label": "Vì học sinh học nhanh chậm khác nhau nên không so được", "isCorrect": False},
                    {"label": "Không yếu: đây là chỉ số kinh điển và đáng tin", "isCorrect": False, "misconception": "cngdtt.engagement-equals-learning"},
                ],
            },
            {
                "key": "4.3-chuoi-ngay",
                "type": "mcq",
                "prompt": "Chuỗi ngày hoạt động được gắn với phần thưởng. Điều gì xảy ra với giá trị đo lường của nó?",
                "explanation": "Nó đo đúng thứ được thưởng và không còn nói gì về việc học — biểu hiện trực tiếp của định luật Goodhart.",
                "points": 2,
                "options": [
                    {"label": "Nó chỉ còn đo hành vi giữ chuỗi, không còn phản ánh việc học", "isCorrect": True},
                    {"label": "Nó trở nên chính xác hơn vì có nhiều dữ liệu hơn", "isCorrect": False, "misconception": "cngdtt.engagement-equals-learning"},
                    {"label": "Không thay đổi gì, phần thưởng chỉ tăng động lực", "isCorrect": False},
                    {"label": "Nó trở thành chỉ số trễ thay vì chỉ số dẫn", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-goodhart",
                "type": "mcq",
                "prompt": "Định luật Goodhart phát biểu điều gì và hệ quả cho thiết kế đo lường là gì?",
                "explanation": "Khi một chỉ số trở thành mục tiêu, nó thôi là chỉ số tốt. Hệ quả: không đặt mục tiêu vào một chỉ số duy nhất, và luôn có chỉ số đối trọng.",
                "points": 2,
                "options": [
                    {"label": "Chỉ số thành mục tiêu thì mất giá trị đo; nên cần nhiều chỉ số kèm chỉ số đối trọng", "isCorrect": True},
                    {"label": "Chỉ số càng nhiều thì càng khó quản lý; nên chọn đúng một chỉ số", "isCorrect": False},
                    {"label": "Mọi chỉ số đều vô dụng nên không cần đo", "isCorrect": False},
                    {"label": "Chỉ áp dụng cho kinh tế, không áp dụng cho giáo dục", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-hoan-thanh-94",
                "type": "mcq",
                "prompt": "Tỉ lệ hoàn thành tăng lên 94% trong khi điểm bài kiểm tra độc lập giảm nhẹ. Cách hiểu đúng là gì?",
                "explanation": "Hai con số không mâu thuẫn: cách nhanh nhất để tăng tỉ lệ hoàn thành là giảm yêu cầu của việc hoàn thành.",
                "points": 2,
                "options": [
                    {"label": "Yêu cầu để được tính là hoàn thành nhiều khả năng đã bị hạ xuống", "isCorrect": True},
                    {"label": "Bài kiểm tra độc lập chắc chắn bị soạn sai", "isCorrect": False},
                    {"label": "Học sinh học tốt hơn nhưng thi kém do áp lực", "isCorrect": False},
                    {"label": "Kết quả này chứng minh chương trình hiệu quả", "isCorrect": False, "misconception": "cngdtt.proxy-as-construct"},
                ],
            },
            {
                "key": "4.3-ba-loai-chi-so",
                "type": "matching",
                "prompt": "Ghép mỗi loại chỉ số với vai trò của nó.",
                "explanation": "Ba loại phục vụ ba mục đích khác nhau; chỉ số đối trọng là thứ phân biệt hệ đo lường có trách nhiệm với hệ chạy theo thành tích.",
                "points": 3,
                "pairs": [
                    {"left": "Chỉ số dẫn", "right": "Biết sớm để kịp can thiệp, đo được hằng tuần"},
                    {"left": "Chỉ số trễ", "right": "Đo cái ta thật sự muốn, nhưng chỉ có sau vài tháng"},
                    {"left": "Chỉ số đối trọng", "right": "Bắt tác dụng phụ khi ai đó tối ưu chỉ số dẫn bằng mọi giá"},
                ],
            },
            {
                "key": "4.3-doi-trong-vi-du",
                "type": "mcq",
                "prompt": "Trường đẩy tỉ lệ nộp bài đúng hạn lên bằng cách tăng nhắc nhở. Chỉ số đối trọng nào nên theo dõi?",
                "explanation": "Thời gian học ngoài giờ, mức căng thẳng tự báo cáo, tỉ lệ bỏ giữa chừng, và chênh lệch giữa các nhóm học sinh — chúng cho biết cái giá của việc đẩy chỉ số dẫn.",
                "points": 2,
                "options": [
                    {"label": "Thời gian học ngoài giờ, tỉ lệ bỏ cuộc, và chênh lệch giữa các nhóm học sinh", "isCorrect": True},
                    {"label": "Số lần đăng nhập và thời gian trên hệ thống", "isCorrect": False, "misconception": "cngdtt.engagement-equals-learning"},
                    {"label": "Số thông báo đã gửi", "isCorrect": False},
                    {"label": "Tỉ lệ nộp bài của học kỳ trước", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-cau-hoi-quan-trong",
                "type": "mcq",
                "prompt": "Khi đánh giá một chỉ số, câu hỏi nào bộc lộ điểm yếu của nó nhanh nhất?",
                "explanation": "Tôi làm gì để đẩy chỉ số này lên mà không học thêm được gì. Trả lời được dễ dàng nghĩa là chỉ số ấy rất dễ bị lách.",
                "points": 2,
                "options": [
                    {"label": "Tôi làm gì để đẩy chỉ số này lên mà không học thêm được gì", "isCorrect": True},
                    {"label": "Chỉ số này có dễ thu thập không", "isCorrect": False},
                    {"label": "Chỉ số này có được các sản phẩm khác dùng không", "isCorrect": False},
                    {"label": "Chỉ số này có hiển thị đẹp trên biểu đồ không", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-de-do-xa-muc-tieu",
                "type": "true_false",
                "prompt": "Chỉ số dễ thu thập nhất thường là chỉ số xa mục tiêu học tập nhất.",
                "explanation": "Đúng, và đó là lý do chúng phổ biến trên các bảng điều khiển thương mại: rẻ để đo, dễ hiển thị, và luôn có sẵn.",
                "points": 1,
                "options": [
                    {"label": "Đúng", "isCorrect": True},
                    {"label": "Sai", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-tuong-quan-nghich",
                "type": "mcq",
                "prompt": "Vì sao không nên mượn quan hệ giữa thời gian trên hệ thống và kết quả học tập từ một nghiên cứu ở bối cảnh khác?",
                "explanation": "Quan hệ ấy có thể thuận ở nhóm này và nghịch ở nhóm khác — nhóm giỏi làm nhanh nên tốn ít thời gian hơn.",
                "points": 2,
                "options": [
                    {"label": "Vì quan hệ có thể đảo chiều giữa các nhóm: người giỏi hoàn thành nhanh hơn nên tốn ít thời gian hơn", "isCorrect": True},
                    {"label": "Vì các nghiên cứu nước ngoài không đáng tin", "isCorrect": False},
                    {"label": "Vì hệ thống mỗi nơi đo thời gian theo đơn vị khác nhau", "isCorrect": False},
                    {"label": "Không có vấn đề gì nếu nghiên cứu được công bố trên tạp chí tốt", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-diem-quiz",
                "type": "mcq",
                "prompt": "Điểm quiz trong hệ thống là chỉ số gần khái niệm gốc nhất trong bốn chỉ số phổ biến, nhưng vẫn phụ thuộc điều gì?",
                "explanation": "Chất lượng câu hỏi — câu đo trí nhớ từ ngữ, lộ đáp án qua hình thức, nhiễu vô hiệu, đúng những vấn đề đã phân tích ở Bài 2.4.",
                "points": 2,
                "options": [
                    {"label": "Chất lượng câu hỏi: đo hiểu hay đo trí nhớ từ ngữ, có lộ đáp án qua hình thức không", "isCorrect": True},
                    {"label": "Tốc độ mạng của người học", "isCorrect": False},
                    {"label": "Số lượng câu hỏi trong ngân hàng đề", "isCorrect": False},
                    {"label": "Giao diện hiển thị câu hỏi", "isCorrect": False},
                ],
            },
            {
                "key": "4.3-quy-tac-ba-cau",
                "type": "ordering",
                "prompt": "Sắp xếp ba câu hỏi khi chọn bộ chỉ số cho một dự án theo thứ tự nên hỏi.",
                "explanation": "Chỉ số dẫn để hành động sớm, chỉ số trễ để biết kết quả thật, và chỉ số đối trọng để bắt tác dụng phụ của việc tối ưu chỉ số dẫn.",
                "points": 3,
                "sequence": [
                    "Chỉ số nào cho tôi biết sớm để kịp làm gì đó",
                    "Chỉ số nào nói lên kết quả thật, dù nó tới muộn",
                    "Nếu ai đó đẩy chỉ số đầu lên bằng mọi giá, chỉ số nào sẽ xấu đi và tôi có theo dõi nó không",
                ],
            },
            {
                "key": "4.3-viet-luan-chi-so",
                "type": "essay",
                "prompt": "Chọn một can thiệp giáo dục cụ thể. Viết 250–350 từ nêu bộ chỉ số cân bằng của bạn: hai chỉ số dẫn kèm công thức tính, một chỉ số trễ, hai chỉ số đối trọng, và một kịch bản lách cụ thể mà bộ chỉ số của bạn bắt được.",
                "points": 5,
            },
        ],
    },
}
